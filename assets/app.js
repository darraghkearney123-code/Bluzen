(() => {
  "use strict";

  // ── Formspree — waitlist and contact forms notify you directly (formspree.io -> create a form -> copy its endpoint).
  // Both forms below post here; a hidden "form_name" field tells them apart in your inbox/dashboard.
  const FORMSPREE_ENDPOINT = "https://formspree.io/f/xwvgweed";

  // ── MailerLite — sends the actual sleep-audio email itself via its own automation (locked
  // pattern: email address only, per canon). This code's only job is to get the visitor's email
  // into the right group. MailerLite's plan doesn't expose an embeddable form or API endpoint
  // safe to call directly from the browser, so this goes through a small serverless proxy
  // instead (see /cloudflare-worker/mailerlite-proxy.js and the README for setup).
  const MAILERLITE_WORKER_URL = "https://mailerlite-proxy.darraghkearney123.workers.dev";

  const state = {
    sleepSubmitted: false,
    waitlist: "idle", // idle | open | done
    contactSubmitted: false,
    sleepPopupDismissed: false,
    sensorySubmitted: false,
    oneToOneSubmitted: false
  };

  function setGroup(groupName, activeWhen) {
    document.querySelectorAll(`[data-group="${groupName}"] > [data-when]`).forEach((el) => {
      el.hidden = el.dataset.when !== activeWhen;
    });
  }

  function showSleepForm() {
    setGroup("sleep", state.sleepSubmitted ? "audioSubmitted" : "audioNotSubmitted");
  }

  function showWaitlist() {
    const map = { idle: "waitlistIdle", open: "waitlistOpen", done: "waitlistDone" };
    setGroup("waitlist", map[state.waitlist]);
  }

  function showContact() {
    setGroup("contact", state.contactSubmitted ? "contactSubmitted" : "contactNotSubmitted");
  }

  function showSensory() {
    setGroup("sensory", state.sensorySubmitted ? "sensoryDone" : "sensoryForm");
  }

  function showOneToOne() {
    setGroup("oneToOne", state.oneToOneSubmitted ? "oneToOneDone" : "oneToOneForm");
  }

  // app.js is shared by index.html and programmes.html, and only the homepage has the
  // sleep popup, so every reference to it tolerates the element not being there.
  function sleepPopup() {
    return document.getElementById("sleep-popup");
  }

  function closeSleepPopup() {
    state.sleepPopupDismissed = true;
    const popup = sleepPopup();
    if (popup) popup.hidden = true;
  }

  const actions = {
    openWaitlist: () => { state.waitlist = "open"; showWaitlist(); },
    closeSleepPopup
  };

  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-action]");
    if (!target || target.tagName === "FORM") return;
    const action = actions[target.dataset.action];
    if (action) action();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const popup = sleepPopup();
    if (popup && !popup.hidden) closeSleepPopup();
  });

  function fieldError(form, message) {
    let box = form.querySelector(".bz-form-error");
    if (!box) {
      box = document.createElement("p");
      box.className = "bz-form-error";
      form.appendChild(box);
    }
    box.textContent = message;
    box.classList.add("bz-visible");
  }

  function clearFieldError(form) {
    const box = form.querySelector(".bz-form-error");
    if (box) box.classList.remove("bz-visible");
  }

  // ── RESILIENT DELIVERY ──
  // Programme enquiries are leads, so they get the same treatment as quiz completions: a durable
  // KV record via the Worker plus an instant Formspree email, each retried once and then parked
  // in localStorage to be flushed on a later page load. The queue key is shared with quiz.html,
  // so either page will flush whatever the other left behind.
  const SEND_QUEUE_KEY = "bluzen_pending_sends";
  const RETRY_DELAY_MS = 1500;
  const MAX_QUEUED = 25;

  function endpointFor(kind) {
    return kind === "worker" ? MAILERLITE_WORKER_URL : FORMSPREE_ENDPOINT;
  }

  function isConfigured(kind) {
    const url = endpointFor(kind);
    return !!url && !url.startsWith("REPLACE_WITH_") && !url.includes("YOUR_FORM_ID");
  }

  function readQueue() {
    try { return JSON.parse(localStorage.getItem(SEND_QUEUE_KEY)) || []; } catch (err) { return []; }
  }

  function writeQueue(items) {
    try { localStorage.setItem(SEND_QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUED))); } catch (err) {}
  }

  async function postOnce(kind, body) {
    if (!isConfigured(kind)) return false;
    try {
      const res = await fetch(endpointFor(kind), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) { console.error(`Bluzen: ${kind} responded ${res.status}`); return false; }
      if (kind === "worker") {
        const info = await res.json().catch(() => null);
        if (info && info.kv && info.kv !== "stored" && info.kv !== "no-submission") {
          console.error("Bluzen: record was NOT stored in KV:", info.kv);
        }
      }
      return true;
    } catch (err) {
      console.error(`Bluzen: ${kind} send failed:`, err);
      return false;
    }
  }

  function sendWithRetry(kind, body) {
    if (!isConfigured(kind)) { console.warn(`Bluzen: ${kind} isn't configured — nothing sent.`); return; }
    postOnce(kind, body).then(ok => {
      if (ok) return;
      setTimeout(() => {
        postOnce(kind, body).then(retryOk => {
          if (retryOk) return;
          const q = readQueue();
          q.push({ kind, body, queued_at: new Date().toISOString() });
          writeQueue(q);
          console.warn(`Bluzen: ${kind} send failed twice; queued for the next page load.`);
        });
      }, RETRY_DELAY_MS);
    });
  }

  async function flushQueue() {
    const pending = readQueue();
    if (!pending.length) return;
    writeQueue([]);
    const stillFailing = [];
    for (const item of pending) {
      if (!isConfigured(item.kind)) { stillFailing.push(item); continue; }
      const ok = await postOnce(item.kind, item.body);
      if (!ok) stillFailing.push(item);
    }
    if (stillFailing.length) writeQueue(readQueue().concat(stillFailing));
    else console.log(`Bluzen: flushed ${pending.length} queued submission(s).`);
  }

  // Sends { group, email, fields } to the serverless proxy, which adds the visitor to that
  // MailerLite group. Fire-and-forget — never throws, never blocks the visitor's own form.
  function submitToMailerLite(group, email, fields) {
    if (MAILERLITE_WORKER_URL.startsWith("REPLACE_WITH_")) {
      console.warn(`MailerLite proxy isn't set up yet — ${group} signup was not sent. See cloudflare-worker/mailerlite-proxy.js.`);
      return;
    }
    fetch(MAILERLITE_WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group, email, fields: fields || {} })
    }).catch(err => console.error("MailerLite proxy call failed:", err));
  }

  async function submitToFormspree(form, formName) {
    const button = form.querySelector('button[type="submit"]');
    clearFieldError(form);

    if (FORMSPREE_ENDPOINT.includes("YOUR_FORM_ID")) {
      fieldError(form, "This form isn't connected yet — add your Formspree endpoint in assets/app.js.");
      return false;
    }

    const data = new FormData(form);
    data.set("form_name", formName);

    if (button) button.disabled = true;
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" }
      });
      if (!res.ok) throw new Error("Submission failed");
      form.reset();
      return true;
    } catch (err) {
      fieldError(form, "Something went wrong sending that — please try again, or email info@bluzenfocus.com directly.");
      return false;
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function submitSleepAudio(form) {
    clearFieldError(form);

    if (MAILERLITE_WORKER_URL.startsWith("REPLACE_WITH_")) {
      fieldError(form, "This form isn't connected yet — set up the MailerLite proxy (see cloudflare-worker/mailerlite-proxy.js).");
      return false;
    }

    const email = new FormData(form).get("email");
    submitToMailerLite("sleep_audio", email);
    form.reset();
    return true;
  }

  // Programme enquiries go to Darragh directly. No MailerLite group and no automated email,
  // so nothing is sent to the person beyond what he writes himself.
  function submitProgramme(form, programme) {
    clearFieldError(form);
    const data = new FormData(form);
    const record = {
      record_type: "programme",
      submission_id: Math.random().toString(36).slice(2, 10),
      completed_at: new Date().toISOString(),
      programme: programme,
      name: (data.get("name") || "").toString().trim(),
      email: (data.get("email") || "").toString().trim(),
      phone: (data.get("phone") || "").toString().trim(),
      enquiring_as: (data.get("enquiring_as") || "").toString()
    };

    if (!isConfigured("worker") && !isConfigured("formspree")) {
      fieldError(form, "This form isn't connected yet. Please email info@bluzenfocus.com directly.");
      return false;
    }

    // Durable record first, then the notification email.
    sendWithRetry("worker", { submission: record });
    sendWithRetry("formspree", {
      form_name: "programme_interest",
      _subject: `Bluzen enquiry: ${programme} - ${record.name}`,
      programme: programme,
      name: record.name,
      email: record.email,
      phone: record.phone,
      enquiring_as: record.enquiring_as || "n/a",
      submitted_at: record.completed_at
    });

    form.reset();
    return true;
  }

  document.addEventListener("submit", async (e) => {
    const form = e.target.closest("form[data-action]");
    if (!form) return;
    e.preventDefault();
    const action = form.dataset.action;

    if (action === "submitAudio") {
      const ok = await submitSleepAudio(form);
      if (ok) {
        state.sleepSubmitted = true;
        showSleepForm();
        const popup = sleepPopup();
        if (popup) popup.hidden = true;
      }
    } else if (action === "submitWaitlist") {
      const email = new FormData(form).get("email");
      const ok = await submitToFormspree(form, "library_waitlist");
      if (ok) {
        submitToMailerLite("library_waitlist", email);
        state.waitlist = "done";
        showWaitlist();
      }
    } else if (action === "submitContact") {
      const ok = await submitToFormspree(form, "contact");
      if (ok) {
        state.contactSubmitted = true;
        showContact();
      }
    } else if (action === "submitSensory") {
      if (submitProgramme(form, "Sensory Kitchens")) {
        state.sensorySubmitted = true;
        showSensory();
      }
    } else if (action === "submitOneToOne") {
      if (submitProgramme(form, "1:1 hypnotherapy")) {
        state.oneToOneSubmitted = true;
        showOneToOne();
      }
    }
  });

  // Show the sleep-audio popup after a short delay, unless it's already been handled.
  // The welcome overlay gets out of the way first: without this the two would stack
  // inside about four seconds of landing, which is the opposite of the point of it.
  // assets/sigh.js fires this event either when the overlay closes or immediately if
  // it isn't showing this visit, so the timer always starts.
  function startSleepPopupTimer() {
    setTimeout(() => {
      const popup = sleepPopup();
      if (popup && !state.sleepSubmitted && !state.sleepPopupDismissed) {
        popup.hidden = false;
      }
    }, 3500);
  }

  if (window.bluzenOverlay && window.bluzenOverlay.willShow) {
    document.addEventListener("bluzen:overlay-closed", startSleepPopupTimer, { once: true });
  } else {
    startSleepPopupTimer();
  }

  showSleepForm();
  showWaitlist();
  showContact();
  showSensory();
  showOneToOne();
  flushQueue();
})();
