(() => {
  "use strict";

  // ── Formspree — waitlist and contact forms notify you directly (formspree.io -> create a form -> copy its endpoint).
  // Both forms below post here; a hidden "form_name" field tells them apart in your inbox/dashboard.
  const FORMSPREE_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";

  // ── EmailJS — sends the free sleep audio straight to the visitor (emailjs.com).
  const EMAILJS_PUBLIC_KEY = "YOUR_EMAILJS_PUBLIC_KEY";
  const EMAILJS_SERVICE_ID = "YOUR_EMAILJS_SERVICE_ID";
  const EMAILJS_SLEEP_TEMPLATE_ID = "YOUR_EMAILJS_TEMPLATE_ID_SLEEP_AUDIO"; // template vars: to_email, to_name, audio_link
  const SLEEP_AUDIO_LINK = "REPLACE_WITH_SLEEP_AUDIO_LINK";

  // ── MailerLite — list-building only (does not send any email itself). Embedded-form action URL per group,
  // from MailerLite: Forms -> Embedded -> (group) -> copy the form's action URL.
  const MAILERLITE_SLEEP_ENDPOINT = ""; // "Sleep Audio" group

  if (window.emailjs && !EMAILJS_PUBLIC_KEY.startsWith("YOUR_")) {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }

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

  // Posts via a hidden form + iframe so this works cross-origin with no CORS setup —
  // the same way MailerLite's own embedded-form snippets work. List-building only, fire-and-forget.
  function submitToMailerLite(actionUrl, fields) {
    if (!actionUrl) return;
    const iframeName = "ml-submit-" + Date.now();
    const iframe = document.createElement("iframe");
    iframe.name = iframeName;
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    const form = document.createElement("form");
    form.action = actionUrl;
    form.method = "POST";
    form.target = iframeName;
    form.style.display = "none";

    Object.entries(fields).forEach(([key, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value ?? "";
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    setTimeout(() => { form.remove(); iframe.remove(); }, 3000);
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
    const button = form.querySelector('button[type="submit"]');
    clearFieldError(form);

    if (!window.emailjs || EMAILJS_PUBLIC_KEY.startsWith("YOUR_")) {
      fieldError(form, "This form isn't connected yet — set up EmailJS in assets/app.js.");
      return false;
    }

    const data = new FormData(form);
    const name = data.get("first_name");
    const email = data.get("email");

    if (button) button.disabled = true;
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_SLEEP_TEMPLATE_ID, {
        to_email: email,
        to_name: name,
        audio_link: SLEEP_AUDIO_LINK
      });
      submitToMailerLite(MAILERLITE_SLEEP_ENDPOINT, { email, name });
      form.reset();
      return true;
    } catch (err) {
      fieldError(form, "Something went wrong sending that — please try again, or email info@bluzenfocus.com directly.");
      return false;
    } finally {
      if (button) button.disabled = false;
    }
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
      const ok = await submitToFormspree(form, "library_waitlist");
      if (ok) {
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
