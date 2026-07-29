(() => {
  "use strict";

  // ── Physiological sigh welcome overlay ────────────────────────────────────
  // Two inhales through the nose, the second stacked on top of the first, then a
  // long exhale out the mouth. Guided by timing and plain labels rather than by
  // any claim about what it does, per the scope rules.

  const STORAGE_KEY = "bluzen_sigh_seen";
  const SHOW_AGAIN_AFTER_MS = 24 * 60 * 60 * 1000; // once a day
  const OPEN_DELAY_MS = 1500;
  const AUTO_RUN = false; // true starts the breath on open instead of waiting for the button
  const MAX_CYCLES = 2;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Reduced motion keeps the timing and the labels, which are the actual guidance,
  // and drops most of the movement.
  const PHASES = [
    { label: "Deep inhale...", scale: reduceMotion ? 0.94 : 0.85, ms: 3500, ease: "cubic-bezier(.4,0,.5,1)" },
    { label: "Squeeze in a bit more...", scale: 1, ms: 1000, ease: "cubic-bezier(.4,0,.6,1)" },
    { label: "Long, slow exhale...", scale: reduceMotion ? 0.9 : 0.55, ms: 6000, ease: "cubic-bezier(.35,0,.4,1)" }
  ];
  const RESTING_SCALE = reduceMotion ? 0.9 : 0.55;

  const overlay = document.getElementById("bz-sigh");
  if (!overlay) return;

  const modal = overlay.querySelector(".bz-sigh-modal");
  const orb = document.getElementById("bz-sigh-orb");
  const phaseLabel = document.getElementById("bz-sigh-phase");
  const startBtn = document.getElementById("bz-sigh-start");
  const againBtn = document.getElementById("bz-sigh-again");
  const continueBtn = document.getElementById("bz-sigh-continue");
  const closeBtn = document.getElementById("bz-sigh-close");
  const dots = Array.from(overlay.querySelectorAll(".bz-sigh-dot"));

  let timers = [];
  let cancelled = false;
  let running = false;
  let cyclesDone = 0;
  let lastFocused = null;

  function schedule(fn, ms) {
    const t = setTimeout(fn, ms);
    timers.push(t);
    return t;
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  function wait(ms) {
    return new Promise(resolve => schedule(resolve, ms));
  }

  function shouldShow() {
    // A hash means they followed a link to something specific, so leave them to it.
    if (window.location.hash) return false;
    try {
      const seen = Number(localStorage.getItem(STORAGE_KEY) || 0);
      return !seen || Date.now() - seen > SHOW_AGAIN_AFTER_MS;
    } catch (err) {
      return true; // private browsing, just show it
    }
  }

  function remember() {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch (err) {}
  }

  function setOrb(scale, ms, ease) {
    orb.style.transition = `transform ${ms}ms ${ease}, box-shadow ${ms}ms ${ease}`;
    orb.style.transform = `scale(${scale})`;
    orb.classList.toggle("bz-sigh-orb-full", scale > 0.95);
  }

  function setPhase(phase) {
    phaseLabel.textContent = phase.label;
    setOrb(phase.scale, phase.ms, phase.ease);
  }

  async function runCycle() {
    if (running) return;
    running = true;
    startBtn.hidden = true;
    againBtn.hidden = true;

    for (const phase of PHASES) {
      if (cancelled) return;
      setPhase(phase);
      await wait(phase.ms);
    }
    if (cancelled) return;

    running = false;
    cyclesDone += 1;
    dots.forEach((d, i) => d.classList.toggle("bz-sigh-dot-on", i < cyclesDone));

    phaseLabel.textContent = cyclesDone >= MAX_CYCLES
      ? "That's it. Whenever you're ready."
      : "Nicely done. One more if you'd like.";
    setOrb(RESTING_SCALE, 900, "ease-out");

    if (cyclesDone < MAX_CYCLES) againBtn.hidden = false;
    continueBtn.hidden = false;
    continueBtn.focus();
  }

  // ── Focus handling ──
  function focusable() {
    return Array.from(modal.querySelectorAll("button:not([hidden])")).filter(el => !el.disabled);
  }

  function trapFocus(e) {
    if (e.key !== "Tab") return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onKeydown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    trapFocus(e);
  }

  function open() {
    lastFocused = document.activeElement;
    overlay.hidden = false;
    // Next frame so the transition actually runs.
    requestAnimationFrame(() => overlay.classList.add("bz-sigh-open"));
    document.body.classList.add("modal-open");
    document.addEventListener("keydown", onKeydown);
    setOrb(RESTING_SCALE, 600, "ease-out");
    remember();

    if (AUTO_RUN) runCycle();
    else startBtn.focus();
  }

  function close() {
    cancelled = true;
    clearTimers();
    overlay.classList.remove("bz-sigh-open");
    document.removeEventListener("keydown", onKeydown);
    document.body.classList.remove("modal-open");

    schedule(() => {
      overlay.hidden = true;
      // Lets the sleep-audio popup start its own timer now rather than stacking
      // a second interruption on top of this one.
      document.dispatchEvent(new CustomEvent("bluzen:overlay-closed"));
      if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    }, 420);
  }

  startBtn.addEventListener("click", runCycle);
  againBtn.addEventListener("click", () => { againBtn.hidden = true; runCycle(); });
  continueBtn.addEventListener("click", close);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("mousedown", e => { if (e.target === overlay) close(); });

  // Published synchronously, because this file runs before app.js and app.js needs to
  // know whether to wait for the event or just get on with its own timer. Relying on
  // the event alone would lose it when the overlay isn't showing, since nothing has
  // subscribed yet at that point.
  const willShow = shouldShow();
  window.bluzenOverlay = { willShow: willShow };

  if (willShow) setTimeout(open, OPEN_DELAY_MS);
})();
