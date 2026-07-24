(() => {
  "use strict";

  // ── Formspree — waitlist and contact forms notify you directly (formspree.io -> create a form -> copy its endpoint).
  // Both forms below post here; a hidden "form_name" field tells them apart in your inbox/dashboard.
  const FORMSPREE_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";

  // ── MailerLite — sends the actual sleep-audio email itself via its own automation (locked
  // pattern: email address only, per canon). This code's only job is to get the visitor's email
  // into the right group by driving the real embedded MailerLite form on the page.
  //
  // TODO: paste MailerLite's EMBED CODE (Forms -> Embedded -> [group] -> "Embed" tab, not the
  // "Share" link) into the matching placeholder container in index.html:
  //   #ml-embed-sleep     -> "Sleep Audio" group
  //   #ml-embed-waitlist  -> "Library Waitlist" group (optional — just for building an audience)
  // Then flip the matching flag below to true.
  const MAILERLITE_SLEEP_EMBEDDED = false;
  const MAILERLITE_WAITLIST_EMBEDDED = false;

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

  // Writes fields into the real MailerLite embedded form inside `containerSelector` and submits
  // it. MailerLite's embed script renders asynchronously, so this retries briefly before giving
  // up quietly — it never throws and never blocks the visitor's own form from completing.
  function injectFieldsAndSubmit(containerSelector, fields, attemptsLeft = 8) {
    const form = document.querySelector(`${containerSelector} form`);
    if (!form) {
      if (attemptsLeft > 0) setTimeout(() => injectFieldsAndSubmit(containerSelector, fields, attemptsLeft - 1), 400);
      else console.warn(`MailerLite form never appeared in ${containerSelector} — nothing was sent to MailerLite. Check the embed code is pasted in and the matching *_EMBEDDED flag is true in assets/app.js.`);
      return;
    }
    Object.entries(fields).forEach(([key, value]) => {
      let input = form.querySelector(`[name="fields[${key}]"], [name="${key}"]`);
      if (!input) {
        input = document.createElement("input");
        input.type = "hidden";
        input.name = `fields[${key}]`;
        form.appendChild(input);
      }
      input.value = value ?? "";
    });
    if (typeof form.requestSubmit === "function") form.requestSubmit();
    else form.submit();
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

    if (!MAILERLITE_SLEEP_EMBEDDED) {
      fieldError(form, "This form isn't connected yet — paste the MailerLite embed code into index.html (see assets/app.js).");
      return false;
    }

    const email = new FormData(form).get("email");
    injectFieldsAndSubmit("#ml-embed-sleep", { email });
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
        if (MAILERLITE_WAITLIST_EMBEDDED) injectFieldsAndSubmit("#ml-embed-waitlist", { email });
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
