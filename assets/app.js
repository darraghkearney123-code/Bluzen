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
  const MAILERLITE_WORKER_URL = "REPLACE_WITH_YOUR_WORKER_URL"; // e.g. https://mailerlite-proxy.you.workers.dev

  const state = {
    sleepSubmitted: false,
    waitlist: "idle", // idle | open | done
    contactSubmitted: false,
    sleepPopupDismissed: false
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

  function closeSleepPopup() {
    state.sleepPopupDismissed = true;
    document.getElementById("sleep-popup").hidden = true;
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
    const popup = document.getElementById("sleep-popup");
    if (!popup.hidden) closeSleepPopup();
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
        document.getElementById("sleep-popup").hidden = true;
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
    }
  });

  // Show the sleep-audio popup after a short delay, unless it's already been handled.
  setTimeout(() => {
    if (!state.sleepSubmitted && !state.sleepPopupDismissed) {
      document.getElementById("sleep-popup").hidden = false;
    }
  }, 3500);

  showSleepForm();
  showWaitlist();
  showContact();
})();
