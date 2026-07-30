/**
 * Acceptance checks for MidweekCheckIn, section 10 of the build spec made runnable.
 * Walks both score paths through all five screens in jsdom and greps the source
 * for the hard rules: no em dashes, no emoji, no exclamation marks, no streaks,
 * no copy about missed weeks, no storage, no clientId.
 *
 * The site itself has no build step and no node_modules. Install the four dev
 * dependencies somewhere and point node at this file:
 *
 *     npm i react react-dom jsdom @babel/core @babel/preset-react \
 *           @babel/plugin-transform-modules-commonjs
 *     node components/MidweekCheckIn.test.mjs
 *
 * Exits non-zero and lists what broke.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import * as babel from '@babel/core';

const SRC = fileURLToPath(new URL('./MidweekCheckIn.jsx', import.meta.url));
const code = fs.readFileSync(SRC, 'utf8');

/* ── static checks ── */
const fails = [];
const ok = [];
function check(name, cond, detail = '') {
  (cond ? ok : fails).push(name + (detail ? ' :: ' + detail : ''));
}
check('no em dash', !/—/.test(code), (code.match(/.{0,40}—.{0,40}/) || [''])[0]);
check('no en dash in copy', !/–/.test(code));
check('no emoji', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(code));
const noOps = code.replace(/!==?/g, '  ').replace(/([(&|\s])!(?=[a-zA-Z(])/g, '$1 ');
check('no exclamation marks in copy', !/!/.test(noOps), (noOps.match(/.{0,60}!.{0,20}/) || [''])[0]);
check('no clientId', !/clientId/.test(code.replace(/^[\s\S]*?\*\//, '')));
check('no fetch/localStorage', !/\bfetch\(|localStorage|sessionStorage|indexedDB/.test(code));
check('no streak/badge language', !/streak|badge|Well done|great job|keep it up|you've got this|welcome back/i.test(code));
check('no missed-week language', !/last checked in|weeks ago|since you/i.test(code));
// wellness-speak, checked against copy only (strip the CSS template and code identifiers)
const copyOnly = code.slice(code.indexOf('/* \u2500\u2500 Pieces'));
for (const w of ['journey', 'unlock', 'empower', 'optimise', 'transform', 'wellness', 'mindset']) {
  check('no wellness-speak: ' + w, !new RegExp('\\b' + w, 'i').test(copyOnly));
}
check('Lora never above 500', !/font-family:'Lora'[^}]*font-weight:(6|7|8|9)00/.test(code) && !/Lora[\s\S]{0,80}font-weight:(600|700|800|900)/.test(code));
check('orb 6s', /bz-mwci-breathe 6s ease-in-out/.test(code));
check('reduced motion honoured', /prefers-reduced-motion:reduce\)\{[\s\S]*?animation:none/.test(code));
check('sky transition 900ms', /transition:opacity 900ms cubic-bezier\(\.4,0,\.2,1\)/.test(code));
check('focus ring cyan 2.5px offset 3px', /:focus-visible\{outline:2\.5px solid \$\{T\.cyan\};outline-offset:3px/.test(code));
check('44px minimum tap targets', (code.match(/min-height:(4[4-9]|[5-9]\d)px/g) || []).length >= 5);

/* ── transpile ── */
const out = babel.transformSync(code, {
  presets: [['@babel/preset-react', { runtime: 'classic' }]],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
  filename: 'MidweekCheckIn.jsx',
  sourceType: 'module',
}).code;

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
Object.defineProperty(global, 'navigator', { value: dom.window.navigator, configurable: true });
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;
global.Node = dom.window.Node;
global.MutationObserver = dom.window.MutationObserver;
global.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { act } = await import('react');

const reqShim = (id) => { if (id === 'react') return { __esModule: true, default: React, ...React }; throw new Error('unexpected import: ' + id); };
const mod = new Function('require', 'exports', out + '\nreturn exports.default;');
const MidweekCheckIn = mod(reqShim, {});

const history = [
  { id: 'a', createdAt: '2026-06-08T09:00:00.000Z', weekOf: '2026-06-08', score: 3, bodyArea: 'chest', microWin: 'Ten quiet minutes in the car before I went in', anchor: 'no phone at the table' },
  { id: 'b', createdAt: '2026-06-15T09:00:00.000Z', weekOf: '2026-06-15', score: 6, bodyArea: 'jaw', microWin: 'Slept through until six', anchor: '' },
  { id: 'c', createdAt: '2026-06-22T09:00:00.000Z', weekOf: '2026-06-22', score: 8, bodyArea: null, microWin: '', anchor: 'walk before work' },
];

const submitted = [];
const container = document.getElementById('root');
const root = createRoot(container);

function txt() { return container.textContent; }
function btn(label) {
  const b = [...container.querySelectorAll('button')].find((x) => x.textContent.trim() === label);
  if (!b) throw new Error('no button: ' + label + '\nseen: ' + [...container.querySelectorAll('button')].map((x) => x.textContent.trim()).join(' | '));
  return b;
}
async function click(label) {
  await act(async () => { btn(label).dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
}

await act(async () => {
  root.render(React.createElement(MidweekCheckIn, {
    scaleTopic: 'the knot in my chest before work',
    history,
    onSubmit: (d) => { submitted.push(d); return Promise.resolve(); },
  }));
});

/* evidence landing */
check('opens on evidence', /2 moments you noticed/.test(txt()), txt().slice(0, 120));
check('evidence derived, empty microWin excluded', !/walk before work/.test(txt()) || /Carried in: walk before work/.test(txt()) === false);
check('newest first', txt().indexOf('Slept through until six') < txt().indexOf('Ten quiet minutes'));
check('anchor shown as Carried in', /Carried in: no phone at the table/.test(txt()));
check('primary is check in for this week', !!btn('Check in for this week'));
check('footer on evidence', /Lifeline 0808 808 8000/.test(txt()) && /18 and over/.test(txt()));

/* trend */
await click('See your weeks');
check('trend strip reveals', /A season, not a score\./.test(txt()));
check('trend bar count', container.querySelectorAll('.bz-mwci-stripbar').length === 3);
check('only one sky layer active', container.querySelectorAll('.bz-mwci-sky-layer[data-on="true"]').length === 1);
check('trend heights from score', [...container.querySelectorAll('.bz-mwci-stripbar')].map((b) => b.style.height).join(',') === '30%,60%,80%');
check('no axis numbers', !/\bgridline\b/.test(container.innerHTML));

/* scale */
await click('Check in for this week');
check('scale screen', /Where are you today\?/.test(txt()));
check('scaleTopic shown', /the knot in my chest before work/.test(txt()));
check('next disabled without score', btn('Next').disabled);
check('10 score buttons', container.querySelectorAll('.bz-mwci-score').length === 10);
check('6 body areas', container.querySelectorAll('.bz-mwci-area').length === 6);
check('back available', !!btn('Back'));
check('footer on scale', /Samaritans 116 123/.test(txt()));

/* low score path */
await click('3');
check('score enables next', !btn('Next').disabled);
check('sky follows score, band 1-3 active', container.querySelector('.bz-mwci-sky-layer[data-on="true"]').getAttribute('style').includes('rgb(59, 76, 96)'));
await click('Jaw or face');
check('body area toggles on', btn('Jaw or face').getAttribute('aria-pressed') === 'true');
await click('Jaw or face');
check('body area toggles off', btn('Jaw or face').getAttribute('aria-pressed') === 'false');
await click('Next');
check('softened win copy at 3', /Was there a minute that was even slightly easier than the rest\?/.test(txt()));
check('softened placeholder', container.querySelector('textarea').placeholder === 'e.g. the first ten minutes after I got in the door');
await click('Nothing comes to mind, skip');
check('anchor screen', /What are you carrying into the rest of the week\?/.test(txt()));
await click('Leave it blank');
check('done screen, low score', /That was worth doing on a day like today\./.test(txt()));
check('done copy when skipped', /Nothing landed in the evidence bank this time, which is grand\./.test(txt()));
check('draft shape', JSON.stringify(submitted[0]) === JSON.stringify({ score: 3, bodyArea: null, microWin: '', anchor: '' }), JSON.stringify(submitted[0]));
check('no back on done', ![...container.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Back'));
check('footer on done', /Pieta 1800 247 247/.test(txt()));

/* back to evidence, high score path with a win */
await click('See your evidence');
check('returns to evidence', /2 moments you noticed/.test(txt()));
await click('Check in for this week');
await click('8');
check('sky band 8-10', container.querySelector('.bz-mwci-sky-layer[data-on="true"]').getAttribute('style').includes('rgb(143, 224, 232)'));
await click('Next');
check('upbeat win copy at 8', /Where did you feel five percent more here than usual\?/.test(txt()));
await act(async () => {
  const ta = container.querySelector('textarea');
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, 'shoulders dropped with the tea');
  ta.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
await click('Next');
await act(async () => {
  const ta = container.querySelector('textarea');
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, 'phone stays downstairs after nine');
  ta.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
await click('Done for this week');
check('done screen, high score', /That's it\. Sixty seconds well spent\./.test(txt()));
check('evidence count includes new entry', /Your evidence bank is up to 3 moments\./.test(txt()), txt().match(/up to [^.]*\./)?.[0]);
check('draft 2 shape', JSON.stringify(submitted[1]) === JSON.stringify({ score: 8, bodyArea: null, microWin: 'shoulders dropped with the tea', anchor: 'phone stays downstairs after nine' }), JSON.stringify(submitted[1]));
await click('See your evidence');
check('new entry visible in list before parent updates', /shoulders dropped with the tea/.test(txt()) && /3 moments you noticed/.test(txt()));

/* parent catches up: history now carries the entry, echo must not duplicate */
await act(async () => {
  root.render(React.createElement(MidweekCheckIn, {
    scaleTopic: null,
    history: [...history, { id: 'd', createdAt: '2026-07-29T09:00:00.000Z', weekOf: '2026-07-27', score: 8, bodyArea: null, microWin: 'shoulders dropped with the tea', anchor: 'phone stays downstairs after nine' }],
    onSubmit: (d) => { submitted.push(d); return Promise.resolve(); },
  }));
});
check('no duplicate after parent updates', (txt().match(/shoulders dropped with the tea/g) || []).length === 1, String((txt().match(/shoulders dropped with the tea/g) || []).length));

/* empty history */
const c2 = document.createElement('div');
document.body.appendChild(c2);
const r2 = createRoot(c2);
await act(async () => { r2.render(React.createElement(MidweekCheckIn, { history: [], onSubmit: () => Promise.resolve() })); });
check('empty state heading', /Nothing here yet/.test(c2.textContent));
check('empty state button', [...c2.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Start your first check-in'));
check('no trend link when empty', !/See your weeks/.test(c2.textContent));
check('footer on empty', /Text HELLO to 50808/.test(c2.textContent));

/* failing save */
const c3 = document.createElement('div');
document.body.appendChild(c3);
const r3 = createRoot(c3);
await act(async () => { r3.render(React.createElement(MidweekCheckIn, { history: [], onSubmit: () => Promise.reject(new Error('nope')) })); });
function click3(label) {
  const b = [...c3.querySelectorAll('button')].find((x) => x.textContent.trim() === label);
  return act(async () => { b.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
}
await click3('Start your first check-in');
await click3('5');
await click3('Next');
check('score 5 gets the upbeat copy', /Where did you feel five percent more here than usual\?/.test(c3.textContent));
await click3('Nothing comes to mind, skip');
await click3('Leave it blank');
check('failed save stays on anchor', /What are you carrying into the rest of the week\?/.test(c3.textContent));
check('failed save shows a quiet note', /That did not save\./.test(c3.textContent));

/* history but no micro-wins: bank is empty, but it is not their first check-in */
const c4 = document.createElement('div');
document.body.appendChild(c4);
const r4 = createRoot(c4);
await act(async () => { r4.render(React.createElement(MidweekCheckIn, {
  history: [{ id: 'x', createdAt: '2026-06-01T09:00:00.000Z', weekOf: '2026-06-01', score: 4, bodyArea: null, microWin: '', anchor: '' }],
  onSubmit: () => Promise.resolve(),
})); });
check('empty bank still says Nothing here yet', /Nothing here yet/.test(c4.textContent));
check('but does not call it their first check-in', [...c4.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Check in for this week'));
check('trend link still offered', /See your weeks/.test(c4.textContent));

console.log('PASS ' + ok.length);
if (fails.length) {
  console.log('\nFAIL ' + fails.length);
  for (const f of fails) console.log('  x ' + f);
  process.exit(1);
}
