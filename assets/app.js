(() => {
  "use strict";

  // Replace this with your own Formspree endpoint (formspree.io -> create a form -> copy its endpoint URL).
  // All three forms on this page post here; a hidden "form_name" field tells them apart in your inbox/dashboard.
  const FORMSPREE_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";

  const state = {
    sleepSubmitted: false,
    waitlist: "idle", // idle | open | done
    contactSubmitted: false,
    sleepPopupDismissed: false,
    quizContext: "self" // self | support
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

  function showQuizline() {
    setGroup("quizline", state.quizContext === "support" ? "quizline-support" : "quizline-self");
  }

  function openModal(el) {
    el.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeModal(el) {
    el.hidden = true;
    document.body.classList.remove("modal-open");
  }

  function openQuiz(context) {
    state.quizContext = context || "self";
    showQuizline();
    openModal(document.getElementById("quiz-modal"));
  }

  function closeQuiz() {
    closeModal(document.getElementById("quiz-modal"));
  }

  function closeSleepPopup() {
    state.sleepPopupDismissed = true;
    document.getElementById("sleep-popup").hidden = true;
  }

  const actions = {
    openQuiz: () => openQuiz("self"),
    openQuizSelf: () => openQuiz("self"),
    openQuizSupport: () => openQuiz("support"),
    closeQuiz,
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
    const modal = document.getElementById("quiz-modal");
    if (!modal.hidden) closeQuiz();
    else if (!popup.hidden) closeSleepPopup();
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

  document.addEventListener("submit", async (e) => {
    const form = e.target.closest("form[data-action]");
    if (!form) return;
    e.preventDefault();
    const action = form.dataset.action;

    if (action === "submitAudio") {
      const ok = await submitToFormspree(form, "sleep_audio");
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
  showQuizline();
})();
