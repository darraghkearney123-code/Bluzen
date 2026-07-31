/* GENERATED FILE, DO NOT EDIT.
 *
 * Built from MidweekCheckIn.jsx by components/build.mjs. Edit the .jsx and
 * rebuild:  node components/build.mjs
 *
 * Committed on purpose. checkin.html loads this directly, so there is no
 * build step and no CDN between a client and their check-in.
 */
(function (global, React) {
  'use strict';
  if (!React) throw new Error('MidweekCheckIn needs React on the page before it loads.');
  var useEffect = React.useEffect,
    useMemo = React.useMemo,
    useRef = React.useRef,
    useState = React.useState;


  /**
   * MidweekCheckIn
   *
   * A between-session check-in for adult hypnotherapy clients at Bluzen.
   * One honest reading of where the client is, and one piece of evidence that
   * something moved, in under sixty seconds on a phone.
   *
   * Pure. It does not fetch, it does not touch storage, it does not know what a
   * clientId is. The parent adds id, clientId, createdAt and weekOf before it
   * persists whatever onSubmit receives.
   *
   *   <MidweekCheckIn
   *     scaleTopic={string | null}
   *     history={CheckIn[]}          full history, newest last
   *     onSubmit={draft => Promise}  reject to keep the client on the anchor
   *                                  screen. Put client-facing copy on the error
   *                                  as `clientMessage` to say why it failed.
   *     onCancel={() => void}        optional
   *   />
   *
   * draft: { score, bodyArea, microWin, anchor }
   */

  /* ── Tokens ─────────────────────────────────────────────────── */

  const T = {
    navy: '#1B2A4A',
    cyan: '#2BB3C0',
    bright: '#3DD6E3',
    teal: '#14506B',
    slate: '#5A6B7B',
    ink: '#1A2332',
    mist: '#F4F8FA',
    wash: '#DCF2F5',
    cloud: '#FFFFFF'
  };

  /* The sky. Derived from the score, never chosen by the client. The header band
     carries no text of its own, so `text` is only there for anything added to it
     later: it says which way that text would have to go against each band. */
  const SKY = [{
    min: 1,
    max: 3,
    gradient: 'linear-gradient(165deg,#3B4C60 0%,#66768A 52%,#9EABB7 100%)',
    text: 'light'
  }, {
    min: 4,
    max: 5,
    gradient: 'linear-gradient(165deg,#94A6B1 0%,#C0CBD2 52%,#E4E9EC 100%)',
    text: 'dark'
  }, {
    min: 6,
    max: 7,
    gradient: 'linear-gradient(165deg,#B4CFD8 0%,#DDE9ED 52%,#F4F8FA 100%)',
    text: 'dark'
  }, {
    min: 8,
    max: 10,
    gradient: 'linear-gradient(165deg,#8FE0E8 0%,#DCF2F5 52%,#F4F8FA 100%)',
    text: 'dark'
  }];
  const NEUTRAL_BAND = 2; // the 6 to 7 sky, used before any score exists

  function bandFor(score) {
    if (typeof score !== 'number' || Number.isNaN(score)) return NEUTRAL_BAND;
    const i = SKY.findIndex(b => score >= b.min && score <= b.max);
    return i === -1 ? NEUTRAL_BAND : i;
  }
  function gradientFor(score) {
    return SKY[bandFor(score)].gradient;
  }
  const BODY_AREAS = [{
    value: 'chest',
    label: 'Chest'
  }, {
    value: 'jaw',
    label: 'Jaw or face'
  }, {
    value: 'shoulders',
    label: 'Shoulders or neck'
  }, {
    value: 'stomach',
    label: 'Stomach'
  }, {
    value: 'head',
    label: 'Head'
  }, {
    value: 'none',
    label: 'Nowhere much'
  }];
  const SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const STEPS = ['scale', 'win', 'anchor'];

  /* ── Helpers ────────────────────────────────────────────────── */

  function formatDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
  function moments(n) {
    return n === 1 ? '1 moment' : n + ' moments';
  }

  /* ── Styles ─────────────────────────────────────────────────── */

  const CSS = `
  .bz-mwci{
    font-family:'Nunito',system-ui,-apple-system,'Segoe UI',sans-serif;
    font-weight:400;color:${T.ink};background:${T.mist};
    min-height:100%;padding:22px 16px 30px;
    -webkit-font-smoothing:antialiased;
  }
  .bz-mwci *{box-sizing:border-box;}
  .bz-mwci-shell{max-width:520px;margin:0 auto;}

  .bz-mwci-card{
    position:relative;background:${T.cloud};border-radius:23px;overflow:hidden;
    box-shadow:0 1px 2px rgba(27,42,74,.05),0 14px 40px rgba(27,42,74,.07);
  }

  /* Header. Four fixed gradient layers, cross-faded so the sky can transition. */
  .bz-mwci-sky{position:relative;height:104px;background:${T.mist};}
  .bz-mwci-sky-layer{
    position:absolute;inset:0;opacity:0;
    transition:opacity 900ms cubic-bezier(.4,0,.2,1);
  }
  .bz-mwci-sky-layer[data-on="true"]{opacity:1;}
  .bz-mwci-sky-orb{position:absolute;left:26px;bottom:24px;}

  .bz-mwci-orb{
    width:24px;height:24px;border-radius:50%;
    background:radial-gradient(circle at 34% 32%,#7FE3EC 0%,${T.cyan} 46%,${T.teal} 100%);
    animation:bz-mwci-breathe 6s ease-in-out infinite;
  }
  @keyframes bz-mwci-breathe{
    0%,100%{transform:scale(1);opacity:.86;}
    50%{transform:scale(1.14);opacity:1;}
  }

  .bz-mwci-body{padding:26px 26px 30px;}

  .bz-mwci-eyebrow{
    font-family:'Nunito',system-ui,sans-serif;font-weight:700;font-size:10.5px;
    text-transform:uppercase;letter-spacing:.18em;color:${T.cyan};
    margin:0 0 14px;
  }

  .bz-mwci-h{
    font-family:'Lora',Georgia,serif;font-weight:500;font-size:25px;line-height:1.28;
    color:${T.navy};margin:0 0 12px;letter-spacing:-.01em;
  }
  .bz-mwci-h:focus{outline:none;}
  .bz-mwci-p{font-size:15.5px;line-height:1.62;color:${T.slate};margin:0 0 22px;font-weight:400;}

  /* Topic panel: the client's own words */
  .bz-mwci-topic{
    background:${T.wash};border-radius:16px;padding:16px 18px;margin:0 0 22px;
    font-family:'Lora',Georgia,serif;font-weight:400;font-size:17px;line-height:1.5;
    color:${T.teal};
  }

  /* Score row */
  .bz-mwci-scores{
    display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:0 0 14px;
  }
  @media (min-width:430px){.bz-mwci-scores{grid-template-columns:repeat(10,1fr);gap:6px;}}
  .bz-mwci-score{
    min-height:46px;border-radius:13px;border:1px solid #DCE5EA;background:${T.cloud};
    color:${T.navy};font-family:'Nunito',system-ui,sans-serif;font-size:16px;font-weight:600;
    cursor:pointer;padding:0;transition:background-color .18s ease,border-color .18s ease,color .18s ease;
  }
  .bz-mwci-score:hover{border-color:${T.cyan};}
  .bz-mwci-score[aria-pressed="true"]{background:${T.cyan};border-color:${T.cyan};color:${T.cloud};}
  .bz-mwci-ends{
    display:flex;justify-content:space-between;gap:12px;
    font-size:12.5px;line-height:1.45;color:${T.slate};margin:0 0 30px;
  }
  .bz-mwci-ends span:last-child{text-align:right;}
  .bz-mwci-ends b{font-weight:700;color:${T.teal};}

  /* Body area */
  .bz-mwci-rule{height:1px;background:${T.wash};border:0;margin:0 0 26px;}
  .bz-mwci-label{
    font-family:'Lora',Georgia,serif;font-weight:400;font-size:19px;line-height:1.35;
    color:${T.navy};margin:0 0 6px;
  }
  .bz-mwci-sub{font-size:14px;line-height:1.55;color:${T.slate};margin:0 0 16px;}
  .bz-mwci-areas{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 30px;}
  .bz-mwci-area{
    min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #DCE5EA;
    background:${T.cloud};color:${T.ink};font-family:'Nunito',system-ui,sans-serif;
    font-size:14.5px;font-weight:400;cursor:pointer;
    transition:background-color .18s ease,border-color .18s ease,color .18s ease;
  }
  .bz-mwci-area:hover{border-color:${T.cyan};}
  .bz-mwci-area[aria-pressed="true"]{background:${T.wash};border-color:${T.cyan};color:${T.teal};font-weight:600;}

  /* Text inputs */
  .bz-mwci-textarea{
    width:100%;min-height:118px;resize:vertical;
    background:${T.mist};border:1px solid #DCE5EA;border-radius:16px;padding:15px 16px;
    font-family:'Nunito',system-ui,sans-serif;font-size:16px;line-height:1.6;color:${T.ink};
    margin:0 0 26px;
  }
  .bz-mwci-textarea::placeholder{color:#94A5B2;}
  .bz-mwci-textarea:focus{border-color:${T.cyan};}

  /* Buttons */
  .bz-mwci-primary{
    width:100%;min-height:52px;border-radius:15px;border:0;background:${T.navy};
    color:${T.cloud};font-family:'Nunito',system-ui,sans-serif;font-size:16px;font-weight:600;
    cursor:pointer;transition:background-color .18s ease,opacity .18s ease;
  }
  .bz-mwci-primary:hover:not(:disabled){background:#22355C;}
  .bz-mwci-primary:disabled{opacity:.4;cursor:not-allowed;}
  .bz-mwci-quiet{
    display:block;width:100%;min-height:44px;margin:12px 0 0;padding:0;
    background:none;border:0;cursor:pointer;
    font-family:'Nunito',system-ui,sans-serif;font-size:14.5px;font-weight:400;color:${T.teal};
    text-decoration:underline;text-underline-offset:3px;text-decoration-color:#9CC5D2;
  }
  .bz-mwci-quiet:hover{text-decoration-color:${T.cyan};}
  .bz-mwci-back{
    min-height:44px;padding:0 2px;margin:0 0 10px;background:none;border:0;cursor:pointer;
    font-family:'Nunito',system-ui,sans-serif;font-size:14.5px;color:${T.slate};
  }
  .bz-mwci-back:hover{color:${T.teal};}

  /* Progress dots */
  .bz-mwci-dots{display:flex;gap:7px;margin:0 0 20px;}
  .bz-mwci-dot{width:7px;height:7px;border-radius:50%;background:#D6E3E8;}
  .bz-mwci-dot[data-on="true"]{background:${T.cyan};}

  /* Evidence list */
  .bz-mwci-list{list-style:none;margin:0 0 26px;padding:0;}
  .bz-mwci-item{display:flex;gap:14px;padding:16px 0;border-top:1px solid ${T.wash};}
  .bz-mwci-item:first-child{border-top:0;padding-top:2px;}
  .bz-mwci-bar{width:5px;border-radius:3px;flex:0 0 5px;align-self:stretch;min-height:44px;}
  .bz-mwci-when{
    font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;
    color:${T.slate};margin:0 0 6px;
  }
  .bz-mwci-win{font-size:15.5px;line-height:1.6;color:${T.ink};margin:0;}
  .bz-mwci-carried{font-size:14px;line-height:1.55;color:${T.teal};margin:8px 0 0;}

  /* Trend strip */
  .bz-mwci-trend{margin:0 0 26px;padding:20px 0 0;border-top:1px solid ${T.wash};}
  .bz-mwci-trend-h{
    font-family:'Lora',Georgia,serif;font-weight:400;font-size:19px;color:${T.navy};margin:0 0 16px;
  }
  .bz-mwci-strip{display:flex;align-items:flex-end;gap:5px;height:88px;}
  .bz-mwci-stripbar{flex:1;border-radius:6px 6px 0 0;min-width:6px;}
  .bz-mwci-stripdates{display:flex;justify-content:space-between;font-size:12px;color:${T.slate};margin:10px 0 0;}

  /* Footer */
  .bz-mwci-footer{border-top:1px solid rgba(43,179,192,.34);margin:24px 0 0;padding:18px 6px 0;}
  .bz-mwci-footer p{font-size:11.5px;line-height:1.65;color:${T.slate};margin:0 0 10px;font-weight:400;}
  .bz-mwci-footer p:last-child{margin-bottom:0;}

  .bz-mwci-note{font-size:14px;line-height:1.55;color:${T.teal};margin:14px 0 0;}

  /* Focus */
  .bz-mwci :focus-visible{outline:2.5px solid ${T.cyan};outline-offset:3px;}

  @media (prefers-reduced-motion:reduce){
    .bz-mwci-orb{animation:none;}
    .bz-mwci-sky-layer{transition:none;}
  }

  @media (max-width:379px){
    .bz-mwci{padding:16px 12px 24px;}
    .bz-mwci-body{padding:22px 18px 26px;}
    .bz-mwci-h{font-size:23px;}
  }
  `;
  function Styles() {
    return /*#__PURE__*/React.createElement("style", null, CSS);
  }

  /* ── Pieces ─────────────────────────────────────────────────── */

  function Sky({
    score
  }) {
    const active = bandFor(score);
    return /*#__PURE__*/React.createElement("div", {
      className: "bz-mwci-sky",
      "aria-hidden": "true"
    }, SKY.map((band, i) => /*#__PURE__*/React.createElement("div", {
      key: band.gradient,
      className: "bz-mwci-sky-layer",
      "data-on": i === active,
      style: {
        backgroundImage: band.gradient
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "bz-mwci-sky-orb"
    }, /*#__PURE__*/React.createElement("div", {
      className: "bz-mwci-orb"
    })));
  }
  function Dots({
    step
  }) {
    const at = STEPS.indexOf(step);
    if (at === -1) return null;
    return /*#__PURE__*/React.createElement("div", {
      className: "bz-mwci-dots",
      "aria-hidden": "true"
    }, STEPS.map((s, i) => /*#__PURE__*/React.createElement("span", {
      key: s,
      className: "bz-mwci-dot",
      "data-on": i <= at
    })));
  }
  function Footer() {
    return /*#__PURE__*/React.createElement("div", {
      className: "bz-mwci-footer"
    }, /*#__PURE__*/React.createElement("p", null, "This is part of solution-focused hypnotherapy work with Bluzen. It is complementary, it is not medical or psychological treatment, and it is not a substitute for either. Your GP is the first port of call for any health concern. For adults, 18 and over."), /*#__PURE__*/React.createElement("p", null, "If you need someone today, please ring rather than write it here. Emergency 999 or 112. Samaritans 116 123, free, 24 hours, the same number North and South. Northern Ireland: Lifeline 0808 808 8000, 24 hours. Republic of Ireland: Pieta 1800 247 247, or text HELP to 51444. Aware 1800 80 48 48, 10am to 10pm, 7 days. Text HELLO to 50808, 24 hours. On An Post and 48 the shortcode can fail, so text 086 1800 280 instead."));
  }
  function TrendStrip({
    entries
  }) {
    const last = entries.slice(-16);
    if (!last.length) return null;
    return /*#__PURE__*/React.createElement("div", {
      className: "bz-mwci-trend"
    }, /*#__PURE__*/React.createElement("h3", {
      className: "bz-mwci-trend-h"
    }, "A season, not a score."), /*#__PURE__*/React.createElement("div", {
      className: "bz-mwci-strip"
    }, last.map((e, i) => /*#__PURE__*/React.createElement("div", {
      key: e.id || i,
      className: "bz-mwci-stripbar",
      style: {
        height: Math.max(0, Math.min(10, e.score)) * 10 + '%',
        backgroundImage: gradientFor(e.score)
      }
    }))), /*#__PURE__*/React.createElement("div", {
      className: "bz-mwci-stripdates"
    }, /*#__PURE__*/React.createElement("span", null, formatDate(last[0].createdAt)), /*#__PURE__*/React.createElement("span", null, formatDate(last[last.length - 1].createdAt))));
  }

  /* ── Component ──────────────────────────────────────────────── */

  function MidweekCheckIn({
    scaleTopic = null,
    history = [],
    onSubmit,
    onCancel
  }) {
    const [step, setStep] = useState('evidence');
    const [score, setScore] = useState(null);
    const [bodyArea, setBodyArea] = useState(null);
    const [microWin, setMicroWin] = useState('');
    const [anchor, setAnchor] = useState('');
    const [showTrend, setShowTrend] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveFailed, setSaveFailed] = useState(false);
    const [echoes, setEchoes] = useState([]);
    const headingRef = useRef(null);
    const firstRender = useRef(true);

    /* Echoes are local copies of what was submitted this session, so the evidence
       list stays honest in the gap between a save landing and the parent handing
       back a longer history. An echo is dropped once a matching entry turns up in
       history, matched one to one so a single history entry can never clear two. */
    const entries = useMemo(() => {
      const claimed = new Set();
      const pending = [];
      for (const e of echoes) {
        const i = history.findIndex((h, idx) => !claimed.has(idx) && h.score === e.score && (h.microWin || '') === e.microWin && (h.anchor || '') === e.anchor);
        if (i === -1) pending.push(e);else claimed.add(i);
      }
      return [...history, ...pending];
    }, [history, echoes]);

    /* Derived, never stored separately. */
    const evidence = useMemo(() => entries.filter(h => (h.microWin || '').trim()).reverse(), [entries]);
    const trend = useMemo(() => [...entries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)), [entries]);
    const latestScore = entries.length ? entries[entries.length - 1].score : null;
    const skyScore = score != null ? score : latestScore;
    useEffect(() => {
      if (firstRender.current) {
        firstRender.current = false;
        return;
      }
      if (headingRef.current) headingRef.current.focus();
    }, [step]);
    const go = next => {
      setSaveFailed(false);
      setStep(next);
    };
    const submit = async () => {
      if (score == null || saving) return;
      setSaving(true);
      setSaveFailed(false);
      try {
        await onSubmit({
          score,
          bodyArea,
          microWin,
          anchor
        });
        setEchoes(prev => [...prev, {
          id: 'local-' + prev.length,
          createdAt: new Date().toISOString(),
          score,
          bodyArea,
          microWin,
          anchor
        }]);
        setStep('done');
      } catch (err) {
        /* A parent that knows why the save failed can say so by putting a line of
           client-facing copy on the error as `clientMessage`. Only that field is
           read, never `message`, so a stray technical error cannot end up on the
           screen in front of somebody. */
        const said = err && typeof err.clientMessage === 'string' && err.clientMessage.trim();
        setSaveFailed(said || true);
      } finally {
        setSaving(false);
      }
    };
    const restart = () => {
      setScore(null);
      setBodyArea(null);
      setMicroWin('');
      setAnchor('');
      setSaveFailed(false);
      setStep('evidence');
    };

    /* Plain element factories, not nested components. A nested component would be
       a new type on every render and would remount the heading, losing focus. */
    const heading = text => /*#__PURE__*/React.createElement("h2", {
      className: "bz-mwci-h",
      tabIndex: -1,
      ref: headingRef
    }, text);
    const back = to => /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "bz-mwci-back",
      onClick: () => go(to)
    }, "Back");

    /* ── Screens ── */

    const evidenceScreen = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-eyebrow"
    }, "Your evidence"), evidence.length ? /*#__PURE__*/React.createElement(React.Fragment, null, heading(`${moments(evidence.length)} you noticed`), /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-p"
    }, "Worth reading back on a heavy day. These happened, and you spotted them."), /*#__PURE__*/React.createElement("ul", {
      className: "bz-mwci-list"
    }, evidence.map((e, i) => /*#__PURE__*/React.createElement("li", {
      className: "bz-mwci-item",
      key: e.id || i
    }, /*#__PURE__*/React.createElement("span", {
      className: "bz-mwci-bar",
      style: {
        backgroundImage: gradientFor(e.score)
      }
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-when"
    }, formatDate(e.createdAt)), /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-win"
    }, e.microWin), (e.anchor || '').trim() ? /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-carried"
    }, "Carried in: ", e.anchor) : null))))) : /*#__PURE__*/React.createElement(React.Fragment, null, heading('Nothing here yet'), /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-p"
    }, "Anything you notice in a check-in gets kept here. It builds up quicker than you'd think.")), trend.length ? showTrend ? /*#__PURE__*/React.createElement(TrendStrip, {
      entries: trend
    }) : /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "bz-mwci-quiet",
      style: {
        margin: '0 0 26px'
      },
      onClick: () => setShowTrend(true)
    }, "See your weeks") : null, /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "bz-mwci-primary",
      onClick: () => go('scale')
    }, entries.length ? 'Check in for this week' : 'Start your first check-in'), onCancel ? /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "bz-mwci-quiet",
      onClick: onCancel
    }, "Close") : null);
    const scaleScreen = /*#__PURE__*/React.createElement(React.Fragment, null, back('evidence'), /*#__PURE__*/React.createElement(Dots, {
      step: "scale"
    }), /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-eyebrow"
    }, "This week"), scaleTopic ? /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-topic"
    }, '\u201C' + scaleTopic + '\u201D') : null, heading('Where are you today?'), /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-p"
    }, "Ten is things being where you'd want them. One is the worst it's been."), /*#__PURE__*/React.createElement("div", {
      className: "bz-mwci-scores",
      role: "group",
      "aria-label": "Where are you today, 1 to 10"
    }, SCORES.map(n => /*#__PURE__*/React.createElement("button", {
      key: n,
      type: "button",
      className: "bz-mwci-score",
      "aria-pressed": score === n,
      onClick: () => setScore(n)
    }, n))), /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-ends"
    }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "1"), " the worst it's been"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("b", null, "10"), " where you'd want it")), /*#__PURE__*/React.createElement("hr", {
      className: "bz-mwci-rule"
    }), /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-label",
      id: "bz-mwci-area-label"
    }, "Where did you notice it this week?"), /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-sub"
    }, "One tap. Skip it if nothing stands out."), /*#__PURE__*/React.createElement("div", {
      className: "bz-mwci-areas",
      role: "group",
      "aria-labelledby": "bz-mwci-area-label"
    }, BODY_AREAS.map(a => /*#__PURE__*/React.createElement("button", {
      key: a.value,
      type: "button",
      className: "bz-mwci-area",
      "aria-pressed": bodyArea === a.value,
      onClick: () => setBodyArea(bodyArea === a.value ? null : a.value)
    }, a.label))), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "bz-mwci-primary",
      disabled: score == null,
      onClick: () => go('win')
    }, "Next"));
    const softer = score != null && score <= 4;
    const winScreen = /*#__PURE__*/React.createElement(React.Fragment, null, back('scale'), /*#__PURE__*/React.createElement(Dots, {
      step: "win"
    }), /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-eyebrow"
    }, "This week"), softer ? /*#__PURE__*/React.createElement(React.Fragment, null, heading('Was there a minute that was even slightly easier than the rest?'), /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-p"
    }, "It doesn't have to be much. If this week was heavier than that, skip on by.")) : /*#__PURE__*/React.createElement(React.Fragment, null, heading('Where did you feel five percent more here than usual?'), /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-p"
    }, "A minute, not a whole day. Small counts, and small is the point.")), /*#__PURE__*/React.createElement("textarea", {
      className: "bz-mwci-textarea",
      value: microWin,
      onChange: e => setMicroWin(e.target.value),
      "aria-label": "What you noticed",
      placeholder: softer ? 'e.g. the first ten minutes after I got in the door' : 'e.g. I noticed my shoulders drop when I sat down with the tea'
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "bz-mwci-primary",
      onClick: () => go('anchor')
    }, "Next"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "bz-mwci-quiet",
      onClick: () => {
        setMicroWin('');
        go('anchor');
      }
    }, "Nothing comes to mind, skip"));
    const anchorScreen = /*#__PURE__*/React.createElement(React.Fragment, null, back('win'), /*#__PURE__*/React.createElement(Dots, {
      step: "anchor"
    }), /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-eyebrow"
    }, "This week"), heading('What are you carrying into the rest of the week?'), /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-p"
    }, "One small thing. An anchor, a boundary, a line you'll hold. Something you'd actually do."), /*#__PURE__*/React.createElement("textarea", {
      className: "bz-mwci-textarea",
      value: anchor,
      onChange: e => setAnchor(e.target.value),
      "aria-label": "What you are carrying into the rest of the week",
      placeholder: "e.g. phone stays downstairs after nine"
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "bz-mwci-primary",
      disabled: saving,
      onClick: submit
    }, saving ? 'Saving' : 'Done for this week'), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "bz-mwci-quiet",
      disabled: saving,
      onClick: () => {
        setAnchor('');
        submit();
      }
    }, "Leave it blank"), saveFailed ? /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-note",
      role: "status"
    }, typeof saveFailed === 'string' ? saveFailed : 'That did not save. Have another go in a moment.') : null);
    const kept = microWin.trim().length > 0;
    const doneScreen = /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-eyebrow"
    }, "This week"), heading(softer ? 'That was worth doing on a day like today.' : "That's it. Sixty seconds well spent."), /*#__PURE__*/React.createElement("p", {
      className: "bz-mwci-p"
    }, kept ? `Your evidence bank is up to ${moments(evidence.length)}. It's there whenever you want to read it back.` : 'Nothing landed in the evidence bank this time, which is grand. Some weeks are like that.'), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "bz-mwci-primary",
      onClick: restart
    }, "See your evidence"));
    const screens = {
      evidence: evidenceScreen,
      scale: scaleScreen,
      win: winScreen,
      anchor: anchorScreen,
      done: doneScreen
    };
    return /*#__PURE__*/React.createElement("div", {
      className: "bz-mwci"
    }, /*#__PURE__*/React.createElement(Styles, null), /*#__PURE__*/React.createElement("div", {
      className: "bz-mwci-shell"
    }, /*#__PURE__*/React.createElement("div", {
      className: "bz-mwci-card"
    }, /*#__PURE__*/React.createElement(Sky, {
      score: skyScore
    }), /*#__PURE__*/React.createElement("div", {
      className: "bz-mwci-body"
    }, screens[step])), /*#__PURE__*/React.createElement(Footer, null)));
  }

  /* Exposed so a host page can put its own screen in front of the check-in without
     keeping a second copy of the disclaimer, the helpline numbers or the styles.
     The safety copy in particular should exist once and only once. A host showing
     its own screen renders both; a host showing the check-in renders neither,
     because the component brings them itself. */
  MidweekCheckIn.Footer = Footer;
  MidweekCheckIn.Styles = Styles;
  global.MidweekCheckIn = MidweekCheckIn;
})(typeof window !== 'undefined' ? window : this, typeof window !== 'undefined' ? window.React : undefined);
