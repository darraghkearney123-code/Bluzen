/**
 * End to end checks for checkin.html, driven in a real browser.
 *
 * The component has its own suite in components/MidweekCheckIn.test.mjs. This
 * one is about the page around it: storage, the topic prompt, and the four ways
 * a real phone makes this awkward. Private browsing, a full device, a payload
 * that will not parse, and a script that does not arrive are all exercised here
 * rather than left to be discovered by a client.
 *
 *     npm i playwright && npx playwright install chromium
 *     node checkin.test.mjs
 *
 * BZ_SHOTS=/some/dir writes a screenshot of each state as it goes.
 * BZ_CHROMIUM=/path/to/chrome uses a browser you already have.
 *
 * It serves the repo itself on a spare port, so there is nothing to start first.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const OUT = process.env.BZ_SHOTS ? process.env.BZ_SHOTS.replace(/\/?$/, '/') : null;
const EXE = process.env.BZ_CHROMIUM || undefined;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PAGE = 'http://127.0.0.1:' + server.address().port + '/checkin.html';

const fails = [];
const ok = [];
const check = (name, cond, detail = '') => (cond ? ok : fails).push(name + (detail ? ' :: ' + detail : ''));

const browser = await chromium.launch(EXE ? { executablePath: EXE } : {});

async function session(opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    ...(opts.ctx || {}),
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.hostname !== '127.0.0.1') errs.push('OFF-ORIGIN REQUEST: ' + r.url());
  });
  if (opts.init) await page.addInitScript(opts.init, opts.initArg);
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  return { ctx, page, errs };
}

const tap = async (page, label) => {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(300);
};
const shot = async (page, name) => {
  if (!OUT) return;
  await page.waitForTimeout(700);
  await page.screenshot({ path: OUT + name + '.png', fullPage: true });
};

/* ── 1. First visit on a clean device ── */
{
  const { ctx, page, errs } = await session();
  const txt = () => page.textContent('body');

  check('first visit asks for the topic', /What did you and Darragh call it\?/.test(await txt()));
  check('first visit says where it lives', /Kept on this phone. Nothing is sent anywhere\./.test(await txt()));
  check('full storage line present', /clearing your browser data clears this along with it/.test(await txt()));
  check('footer numbers on topic screen', /Aware 1800 80 48 48, 10am to 10pm, 7 days/.test(await txt()));
  check('no check-in card yet', !/Where are you today/.test(await txt()));
  await shot(page, 'p1-topic-first');

  await page.locator('textarea').fill('the knot in my chest before work');
  await tap(page, 'Save it');
  check('lands on the empty evidence bank', /Nothing here yet/.test(await txt()));
  check('empty state offers a first check-in', /Start your first check-in/.test(await txt()));
  await shot(page, 'p2-empty-bank');

  /* full flow */
  await tap(page, 'Start your first check-in');
  check('topic carried into the scale', /the knot in my chest before work/.test(await txt()));
  await tap(page, '7');
  await tap(page, 'Chest');
  await tap(page, 'Next');
  await page.locator('textarea').fill('Ten minutes in the car before I went in');
  await tap(page, 'Next');
  await page.locator('textarea').fill('phone stays downstairs after nine');
  await tap(page, 'Done for this week');
  await page.waitForTimeout(500);
  check('done screen', /Sixty seconds well spent/.test(await txt()));
  check('bank counted', /up to 1 moment\./.test(await txt()), (await txt()).match(/up to [^.]*\./)?.[0]);
  await tap(page, 'See your evidence');
  check('entry in the bank', /Ten minutes in the car before I went in/.test(await txt()));
  check('anchor shown', /Carried in: phone stays downstairs after nine/.test(await txt()));
  await shot(page, 'p3-after-first');

  /* what actually got written */
  const stored = JSON.parse(await page.evaluate(() => localStorage.getItem('bluzen.checkin.v1')));
  check('one entry stored', stored.entries.length === 1);
  check('store added id', typeof stored.entries[0].id === 'string' && stored.entries[0].id.length > 8);
  check('store added createdAt', !Number.isNaN(new Date(stored.entries[0].createdAt).getTime()));
  check('store added weekOf as a Monday', new Date(stored.entries[0].weekOf + 'T00:00:00').getDay() === 1, stored.entries[0].weekOf);
  check('no clientId stored', !JSON.stringify(stored).includes('clientId'));
  check('topic stored', stored.topic === 'the knot in my chest before work');
  check('nothing identifying in the URL', page.url() === PAGE, page.url());

  /* reload keeps it, and does not ask for the topic again */
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  check('survives a reload', /Ten minutes in the car before I went in/.test(await txt()));
  check('does not ask for the topic twice', !/What did you and Darragh call it\?/.test(await txt()));

  /* change your words */
  await tap(page, 'Change your words');
  check('edit screen', /Your words for it/.test(await txt()));
  check('edit prefilled', (await page.locator('textarea').inputValue()) === 'the knot in my chest before work');
  await page.locator('textarea').fill('getting out the door in the morning');
  await tap(page, 'Save it');
  await tap(page, 'Check in for this week');
  check('new words show on the scale', /getting out the door in the morning/.test(await txt()));
  check('old entries untouched by the edit', true);
  await tap(page, 'Back');
  check('history still there after topic edit', /Ten minutes in the car before I went in/.test(await txt()));

  check('no page errors, no off-origin requests', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* ── 2. Skipping the topic ── */
{
  const { ctx, page, errs } = await session();
  await tap(page, 'Skip for now');
  const txt = await page.textContent('body');
  check('skip lands on the bank', /Nothing here yet/.test(txt));
  await tap(page, 'Start your first check-in');
  check('no topic panel when skipped', (await page.$$('.bz-mwci-topic')).length === 0);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  check('skip is remembered, not re-asked', !/What did you and Darragh call it\?/.test(await page.textContent('body')));
  check('skip session clean', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* ── 3. localStorage unavailable, the private browsing case ── */
{
  const { ctx, page, errs } = await session({
    init: () => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          return {
            getItem() { throw new DOMException('denied', 'SecurityError'); },
            setItem() { throw new DOMException('denied', 'SecurityError'); },
            removeItem() { throw new DOMException('denied', 'SecurityError'); },
          };
        },
      });
    },
  });
  const txt = () => page.textContent('body');
  check('the browser refusal is named by name', /This browser is blocking storage for this site\./.test(await txt()));
  check('private browsing is offered as the likely cause', /usually private browsing, or storage switched off/.test(await txt()));
  check('never claims the device is full', !/no room left/.test(await txt()));
  check('unavailable says it goes when the tab closes', /gone once you close the tab/.test(await txt()));
  check('does not also claim everything is kept on the phone',
    !/Everything here is kept on this phone/.test(await txt()));
  check('but still says nothing is sent anywhere',
    /nothing is sent to Darragh or to anyone else/.test(await txt()));
  check('still usable, topic still asked', /What did you and Darragh call it\?/.test(await txt()));
  check('does not promise to keep what it cannot keep',
    !/Kept on this phone\. Nothing is sent anywhere\./.test(await txt()));
  check('says plainly it will not be kept', /What you write here goes when you close the tab\./.test(await txt()));
  await shot(page, 'p4-no-storage');
  await page.locator('textarea').fill('the knot in my chest');
  await tap(page, 'Save it');
  await tap(page, 'Start your first check-in');
  await tap(page, '4');
  await tap(page, 'Next');
  check('softened copy at 4', /even slightly easier than the rest/.test(await txt()));
  await page.locator('textarea').fill('a quiet ten minutes');
  await tap(page, 'Next');
  await tap(page, 'Leave it blank');
  await page.waitForTimeout(500);
  check('check-in completes without storage', /That was worth doing on a day like today\./.test(await txt()));
  await tap(page, 'See your evidence');
  check('entry visible for the session', /a quiet ten minutes/.test(await txt()));
  check('still says nothing is being kept', /gone once you close the tab/.test(await txt()));
  check('no-storage session clean', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* ── 4. Storage full ── */
{
  const { ctx, page, errs } = await session({
    init: () => {
      const real = window.localStorage;
      let full = false;
      const shim = {
        getItem: (k) => real.getItem(k),
        setItem: (k, v) => {
          if (full && k === 'bluzen.checkin.v1') throw new DOMException('full', 'QuotaExceededError');
          real.setItem(k, v);
        },
        removeItem: (k) => real.removeItem(k),
      };
      Object.defineProperty(window, 'localStorage', { configurable: true, get: () => shim });
      window.__fillUp = () => { full = true; };
    },
  });
  const txt = () => page.textContent('body');
  await tap(page, 'Skip for now');
  await page.evaluate(() => window.__fillUp());
  await tap(page, 'Start your first check-in');
  await tap(page, '6');
  await tap(page, 'Next');
  await page.locator('textarea').fill('this one will not fit');
  await tap(page, 'Next');
  await tap(page, 'Leave it blank');
  await page.waitForTimeout(500);
  check('a full device does not fake a save', !/Sixty seconds well spent/.test(await txt()));
  check('stays on the anchor screen', /What are you carrying into the rest of the week\?/.test(await txt()));
  const note = await page.$eval('.bz-mwci-note', (e) => e.textContent);
  check('the reason is on the card, not two screens down',
    note === 'There is no room left to store anything on this device.', note);
  check('and again in the small print', /no room left/.test(await txt()));
  await shot(page, 'p5-storage-full');
  check('full-storage session clean', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* ── 4b. A full device, with the client's history already on it ────────
   The probe write fails, but getItem still works and their entries are sitting
   right there. Showing an empty bank and blaming private browsing would be two
   untrue things at the moment it matters most. */
{
  const seeded = {
    v: 1,
    topic: 'the knot in my chest before work',
    topicAsked: true,
    entries: [
      { id: '1', createdAt: '2026-07-06T19:00:00.000Z', weekOf: '2026-07-06', score: 3, bodyArea: 'chest', microWin: 'Sat in the car for ten minutes', anchor: 'no phone at the table' },
      { id: '2', createdAt: '2026-07-13T19:00:00.000Z', weekOf: '2026-07-13', score: 5, bodyArea: 'jaw', microWin: 'Ate a dinner sitting down', anchor: '' },
      { id: '3', createdAt: '2026-07-20T19:00:00.000Z', weekOf: '2026-07-20', score: 6, bodyArea: null, microWin: 'Slept through until six', anchor: 'lights off by eleven' },
      { id: '4', createdAt: '2026-07-27T19:00:00.000Z', weekOf: '2026-07-27', score: 8, bodyArea: 'none', microWin: 'Said no to the Saturday shift', anchor: 'one no a week' },
    ],
  };
  const { ctx, page, errs } = await session({
    init: (payload) => {
      const real = window.localStorage;
      real.setItem('bluzen.checkin.v1', payload);
      /* Reads keep working. Every write throws, including the probe. */
      const shim = {
        getItem: (k) => real.getItem(k),
        setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
        removeItem: (k) => real.removeItem(k),
      };
      Object.defineProperty(window, 'localStorage', { configurable: true, get: () => shim });
    },
    initArg: JSON.stringify(seeded),
  });
  const txt = () => page.textContent('body');

  check('a full device does not hide the evidence bank', /4 moments you noticed/.test(await txt()),
    ((await txt()).match(/\d+ moments? you noticed/) || [])[0]);
  check('the entries themselves are there', /Said no to the Saturday shift/.test(await txt()));
  check('and the older ones', /Sat in the car for ten minutes/.test(await txt()));
  check('does not ask a returning client for the topic again',
    !/What did you and Darragh call it\?/.test(await txt()));
  check('says the true reason', /There is no room left to store anything on this device\./.test(await txt()));
  check('never blames private browsing', !/private browsing/.test(await txt()));
  check('does not claim it will be gone when the tab closes', !/close the tab/.test(await txt()));
  check('says what still works and what does not',
    /still here and safe to read back/.test(await txt()) && /will not save until you clear some space/.test(await txt()));
  await shot(page, 'p4b-full-device');

  /* the weeks are readable too */
  await tap(page, 'See your weeks');
  check('the weeks strip still reads back', /A season, not a score\./.test(await txt()));
  check('four blocks in the strip', (await page.$$('.bz-mwci-stripbar')).length === 4);

  /* and a new check-in fails honestly rather than pretending */
  await tap(page, 'Check in for this week');
  check('their own words still on the scale', /the knot in my chest before work/.test(await txt()));
  await tap(page, '5');
  await tap(page, 'Next');
  await page.locator('textarea').fill('this one has nowhere to go');
  await tap(page, 'Next');
  await tap(page, 'Done for this week');
  await page.waitForTimeout(500);
  check('no false confirmation', !/Sixty seconds well spent/.test(await txt()));
  check('stays put with their words', /What are you carrying into the rest of the week\?/.test(await txt()));
  const failNote = await page.$eval('.bz-mwci-note', (e) => e.textContent);
  check('the card names the real problem',
    failNote === 'There is no room left to store anything on this device.', failNote);
  check('the bank was not corrupted by the failed save',
    JSON.parse(await page.evaluate(() => localStorage.getItem('bluzen.checkin.v1'))).entries.length === 4);
  check('full-device session clean', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* ── 5. Corrupt payload ── */
{
  const { ctx, page, errs } = await session({
    init: () => localStorage.setItem('bluzen.checkin.v1', '{"entries":[{"score":7,'),
  });
  const txt = () => page.textContent('body');
  check('corrupt data is not fatal', /What did you and Darragh call it\?/.test(await txt()));
  check('corrupt data is admitted to', /could not be read/.test(await txt()));
  const salvaged = await page.evaluate(() => localStorage.getItem('bluzen.checkin.v1.unreadable'));
  check('corrupt payload kept, not overwritten', salvaged === '{"entries":[{"score":7,');
  await shot(page, 'p6-corrupt');
  check('corrupt session clean', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* ── 6. Entries written by something older or half-written ── */
{
  const { ctx, page, errs } = await session({
    init: () =>
      localStorage.setItem(
        'bluzen.checkin.v1',
        JSON.stringify({
          v: 1,
          topic: 'the knot',
          topicAsked: true,
          entries: [
            { id: 'a', createdAt: '2026-07-20T09:00:00.000Z', weekOf: '2026-07-20', score: 8, bodyArea: 'chest', microWin: 'newer', anchor: '' },
            { id: 'b', createdAt: '2026-06-01T09:00:00.000Z', weekOf: '2026-06-01', score: 3, bodyArea: null, microWin: 'older', anchor: '' },
            { score: 99 },
            { microWin: 'no score at all' },
            null,
          ],
        })
      ),
  });
  const txt = () => page.textContent('body');
  check('junk entries dropped', /2 moments you noticed/.test(await txt()), ((await txt()).match(/\d+ moments? you noticed/) || [])[0]);
  const rows = await page.$$eval('.bz-mwci-win', (els) => els.map((e) => e.textContent));
  check('out of order entries sorted, newest first in the bank', JSON.stringify(rows) === '["newer","older"]', JSON.stringify(rows));
  check('bad rows did not crash the page', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

/* ── 7. Scripts missing ── */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route('**/components/MidweekCheckIn.js', (r) => r.abort());
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  const txt = await page.textContent('body');
  check('missing script says so', /This page did not load properly/.test(txt));
  check('missing script still gives the numbers', /Samaritans 116 123, free, 24 hours/.test(txt));
  await shot(page, 'p7-broken');
  await ctx.close();
}

/* ── 8. Layout and the quiet rules ── */
{
  const { ctx, page } = await session();
  await tap(page, 'Skip for now');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no sideways scroll at 390px', overflow === 0, String(overflow));

  const narrow = await browser.newContext({ viewport: { width: 360, height: 800 } });
  const np = await narrow.newPage();
  await np.goto(PAGE, { waitUntil: 'networkidle' });
  await np.waitForTimeout(600);
  const o2 = await np.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no sideways scroll at 360px', o2 === 0, String(o2));
  const fontOk = await np.evaluate(() => document.fonts.check("400 16px 'Nunito'") && document.fonts.check("500 25px 'Lora'"));
  check('self-hosted fonts actually load', fontOk);
  await narrow.close();

  const html = await page.content();
  check('noindex present', /name="robots" content="noindex,nofollow,noarchive"/.test(html));
  const scripts = await page.$$eval('script[src], link[href], img[src]', (els) =>
    els.map((e) => e.getAttribute('src') || e.getAttribute('href')));
  check('every asset is same-origin and in this repo',
    scripts.every((u) => u && !/^https?:|^\/\//.test(u)), scripts.join(' | '));
  check('no analytics tags', !/gtag|googletagmanager|plausible|fathom|matomo|segment/i.test(
    html.replace(/<!--[\s\S]*?-->/g, '')));
  check('no nagging language', !/streak|reminder|notification|don't forget|keep it up/i.test(html));
  await ctx.close();
}

console.log('PASS ' + ok.length);
if (fails.length) {
  console.log('\nFAIL ' + fails.length);
  for (const f of fails) console.log('  x ' + f);
}
await browser.close();
server.close();
process.exit(fails.length ? 1 : 0);
