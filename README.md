# Bluzen

The Bluzen website — static pages (`index.html`, `quiz.html` + `assets/`), no build step required.

## Before you go live

### 1. Formspree — waitlist & contact forms (`assets/app.js`)

**Done.** `FORMSPREE_ENDPOINT` is set. Both forms share it — a hidden `form_name` field
(`library_waitlist` or `contact`) tells them apart in your inbox.

### 2. MailerLite — sleep audio & quiz result emails (this is what actually sends them)

Per the Bluzen canon, MailerLite's own automations send both of these emails (locked copy, `{$name}`
and `{$carer_state_text}` merge tags) — the site's job is only to get each visitor into the right
group with the right fields.

**Done:** group renamed to `Quiz Completed`; custom fields `path`, `carer_state_text`, `hardest_part`
added; `carer_state` already existed. One naming note: the `profile` field's merge tag stayed
`{$quiz_result}` even after the display-name rename (MailerLite quirk) — the code below sends the
value under the key `quiz_result` to match, so use `{$quiz_result}` in the automation email, not
`{$profile}`. If you'd rather have a true `profile` key, delete and recreate that field with the
exact name, then change the one `quiz_result:` line each in `quiz.html` and note this changes.

**This MailerLite plan doesn't expose an embeddable form or POST endpoint** (checked thoroughly:
only a hosted "Share URL" per form, no raw embed code or action URL anywhere in the account).
Submitting into that isn't possible from client-side JS, so this goes through a tiny serverless
proxy instead — a [Cloudflare Worker](https://workers.cloudflare.com) (free tier) that holds your
MailerLite API token as a secret and forwards signups server-side.

**Done.** The proxy is written (`cloudflare-worker/mailerlite-proxy.js`, `GROUP_IDS` filled in),
deployed to Cloudflare with `MAILERLITE_API_TOKEN` set as an encrypted secret (never in the code),
and its live URL is wired into `MAILERLITE_WORKER_URL` in both `assets/app.js` and `quiz.html`.

If the Worker ever needs redeploying (e.g. updating `GROUP_IDS` or `ALLOWED_ORIGINS`), paste the
updated file into the Cloudflare dashboard's Worker editor and redeploy — the secret and the
`QUIZ_LOG` KV binding both persist across redeploys. The file uses `//` line comments only, because
block comments break the dashboard editor's auto-indent when pasting.

**Deployed and verified live** against the real Worker URL, not a mock: a POST carrying a valid body
from a disallowed origin returns 403, a POST with no `Origin` header returns 403, and a cross-origin
simple POST (`text/plain`, so no preflight, meaning the request genuinely reached the Worker) wrote
nothing to KV. A real Sensory Kitchens enquiry from the live site stored correctly under a
`programme:` key with every field present, and arrived as a Formspree row.

The 10-PDF-per-result and "which PDF goes with which profile" logic lives entirely in MailerLite's
email editor (conditional content keyed off the `quiz_result` field), not in this code — that's your
side to build once the PDFs exist.

### 3. Calendly

**Done.** Confirmed 15 minutes, matching canon. `BOOKING_URL` is set to
`https://calendly.com/darraghkearney123/30min` — the URL slug still says "30min" (an old path, left
as-is) but that event has been reconfigured to a genuine 15-minute consult, confirmed live.

## Where quiz submissions are stored

Every completion is written to **Cloudflare Workers KV**, which is the durable record. MailerLite
and Formspree are both delivery mechanisms, not storage:

| | Holds | Why it isn't the record |
|---|---|---|
| **Cloudflare KV** | The complete submission | — this *is* the record |
| MailerLite | Only the fields the result email merges in | Not a database; no per-question answers |
| Formspree | An instant notification email | Free plan caps at **50 submissions/month, shared** with the waitlist and contact forms |

**Namespace:** `bluzen-quiz-submissions`, bound to the `mailerlite-proxy` Worker as **`QUIZ_LOG`**
(Worker → Settings → Bindings).

**To read submissions:** Cloudflare dashboard → **Storage & Databases → KV** →
`bluzen-quiz-submissions` → your keys. Keys are prefixed by record type so the two kinds sit apart:

- `quiz:<ISO timestamp>:<short id>` — a quiz completion. The record holds the path taken, every
  question with the exact wording the visitor saw and the answer they picked (including the three
  carer questions), the free-text answer, the resulting profile, carer state, the nothing-works
  flag, plus name, email and `completed_at`.
- `programme:<ISO timestamp>:<short id>` — a Programmes enquiry. Holds the programme name, name,
  email, phone, and for Sensory Kitchens who they're enquiring as (organisation / someone they care
  for / themselves).

There is deliberately **no read endpoint on the Worker**. Submissions contain names, email addresses
and personal free-text answers, so serving them over HTTP would publish respondents' data. The
Cloudflare dashboard is the only way in — please keep it that way.

The Worker also refuses writes from anywhere other than the two site origins, caps request bodies at
64KB and individual fields at 4,000 characters, and strips anything odd out of the KV key. Without
the origin check, CORS alone would not have stopped a script posting straight to the Worker and
filling the namespace or creating MailerLite subscribers, because CORS only decides whether a
browser may *read* the reply, not whether the request runs. A determined non-browser client can
still forge an Origin header, so this raises the cost rather than making it impossible.

### How a completion is delivered

The Worker performs the KV write and the MailerLite call **independently**: if one fails the other
still happens, and neither failure returns an error status, so a MailerLite outage can never cost
you the stored record. The Worker's reply reports each side separately (`kv` and `mailerlite`), and
the browser console prints both after a completion.

On the page, each send retries once after ~1.5s. If it still fails, the payload is parked in
`localStorage` and flushed automatically on the next page load, so a dropped connection or a phone
losing signal mid-submit doesn't lose the completion. Each submission carries a stable
`submission_id`, so a replay overwrites the same KV key rather than storing a duplicate. None of
this blocks the result screen — the visitor sees their result even if every send fails.

## The welcome overlay (physiological sigh)

`assets/sigh.js` plus the `#bz-sigh` block in `index.html`. Appears 1.5s after landing, guides one
physiological sigh (3.5s inhale, 1s top-up, 6s exhale), then offers a second breath and a
"Continue to Bluzen" button. Closes on the X, Escape, or a click on the backdrop.

Knobs are constants at the top of `sigh.js`:

| Constant | Does |
|---|---|
| `SHOW_AGAIN_AFTER_MS` | How long before it can show again. 24 hours. |
| `OPEN_DELAY_MS` | Delay before it appears. 1500. |
| `AUTO_RUN` | `true` starts the breath on open instead of waiting for the button. Currently `false`. |
| `MAX_CYCLES` | How many breaths before the "one more" option stops being offered. 2. |

Things worth knowing before changing it:

- **It coordinates with the sleep-audio popup.** That popup used to fire on a flat 3.5s timer, which
  would have put two interruptions inside four seconds of landing. `sigh.js` publishes
  `window.bluzenOverlay.willShow` synchronously, and `app.js` either waits for the
  `bluzen:overlay-closed` event or starts its own timer when the overlay isn't showing. The flag has
  to be synchronous: `sigh.js` runs first, so an event alone would fire before `app.js` had
  subscribed and the popup would never appear.
- **It does not show if the URL has a hash.** Someone following a link to `#programmes` came for
  something specific, so they are left alone.
- **Reduced motion is respected** by keeping the timings and the labels, which are the actual
  guidance, and shrinking the movement rather than removing the breath.
- **It is on `index.html` only.** The quiz is its own focused flow with its own calm opening, and
  `privacy.html` is a reference page.
- The copy stays a plain invitation with no claim about what the breath does, per `bluzen-scope`.

## The Programmes page

`programmes.html`, its own page rather than a homepage section, reached only through the Programmes
tab in the nav. Nothing about the programmes appears on the homepage. Two interest forms (name,
email, phone), each landing in KV as a durable record *and* emailing you via Formspree. They add
nobody to a MailerLite group and trigger no automated email, so the only thing an enquirer ever
receives is what you send them yourself.

Worth knowing: because it is off the homepage entirely, the only way anyone finds these offers is by
noticing the nav tab or being sent the link directly. That is deliberate, but if enquiries are quieter
than expected, that is the first thing to look at rather than the forms.

Two boundaries from the scope and groups docs are built into the copy, so please keep them if you
edit it:

- **Sensory Kitchens** is described as running *with a host organisation* (schools, day services,
  community groups) under their safeguarding and staffing. The groups doc allows children and young
  people in group settings only under a host organisation's framework, so the form deliberately
  can't read as a direct sign-up for a child. It asks who's enquiring instead, and tells a carer
  you'll let them know when a group runs near them.
- **1:1 hypnotherapy** is marked adults only, with hypnotherapy positioned alongside a GP or mental
  health team rather than in place of one, per the scope doc's bright line on paid 1:1 clients.

No prices appear here: group work is priced per contract or tender, and the 1:1 offer is discussed
on the call rather than advertised on the page.

## Privacy notice

`privacy.html` covers all five forms, linked from the site footer, under both programme forms and
under the quiz's start button. It follows the data rules in `bluzen-admin`: minimum collection,
consent as the basis, marketing consent kept separate, and it names the three processors honestly
(MailerLite, Formspree, Cloudflare).

**Two things need your confirmation before you rely on it**, both marked in a comment at the top of
the file:

1. **Retention period.** It currently says records tied to client work are kept for as long as your
   insurer and professional body require, without naming a number. Confirm the actual figure with
   Holistic Insurance Services and the NCH, then state it plainly.
2. **Contact address**, if you want a postal one shown. Only the email is there now.

This is a working draft in your voice, not legal advice. Update the "Last updated" date whenever you
change it.

## The headshot

`assets/darragh-headshot.jpg` (688x977, ~90KB) renders in the About section at 110x130, cropped with
`object-fit: cover` and `object-position: center 20%` so the face sits in frame rather than being
centred on the chest. It is lazy-loaded, and an `onerror` handler hides the slot if the file is ever
missing, so a bad path degrades to no photo instead of a broken image.

The source is already well past 2x for the size it renders at, so a retina variant would add nothing.
If you ever want the page lighter, a WebP at around 400px wide would cut most of the 90KB, but at one
lazy-loaded image it is not worth the extra file to maintain.

### Known limitations

- **Formspree: 50 submissions/month on the free plan, shared** across quiz completions, programme
  enquiries, the library waitlist and the contact form. Past that, Formspree stops accepting and the
  notification emails stop arriving. Quiz and programme records are unaffected because KV is the
  store, but the notification emails are how you actually hear about a new enquiry, so this is the
  thing to upgrade first if the programmes get busy.
- KV reads in the dashboard are per-key; there's no built-in search. For any real analysis, export
  the keys with `wrangler kv key list` / `wrangler kv key get`.

## Running locally

No build step — just serve the folder:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploying to GitHub Pages

1. Push this repo to GitHub (branch `main` or whichever you prefer).
2. In the repo's **Settings → Pages**, set the source to that branch, root folder.
3. The site will be published at `https://<your-username>.github.io/<repo-name>/`.

## What's here

- `index.html` — the main site: nav, sleep-audio/waitlist/contact forms, library, about, footer, and
  the welcome overlay.
- `programmes.html` — Sensory Kitchens and 1:1 hypnotherapy, with their interest forms. Linked only
  from the nav; deliberately not surfaced on the homepage.
- `privacy.html` — the privacy notice, linked from the footers and the forms.
- `quiz.html` — the standalone quiz (dual "for me" / "for someone I care for" paths, 5 result profiles
  each, plus a 3-state "how are you coping" read for carers). Linked from `index.html`'s quiz buttons
  and cards (`quiz.html?path=me` / `quiz.html?path=carer` preselects the path).
- `assets/styles.css` — shared styles, hover/focus states, responsive rules and animations, used by
  every page including the quiz's own overrides.
- `assets/app.js` — form handling and the resilient send queue, shared by `index.html` and
  `programmes.html`. Anything homepage-only (the sleep popup) is guarded so it no-ops elsewhere.
- `assets/sigh.js` — the welcome overlay. `index.html` only.
- `assets/*.png`, `assets/darragh-headshot.jpg` — logo and portrait.
- `cloudflare-worker/mailerlite-proxy.js` — the small serverless proxy that gets signups into
  MailerLite (see setup above). Deployed separately from the site itself; not served by GitHub Pages.
- `checkin.html`: the unlisted between-session check-in page (see above). Not in the nav, not
  linked from anywhere, `noindex`.
- `checkin.test.mjs`: browser tests for that page.
- `assets/checkin-app.js`: the host that wires the component to the store and asks for the topic.
- `assets/checkin-store.js`: the storage seam. The only file that knows about `localStorage`.
- `assets/checkin-fonts.css`, `assets/fonts/`: self-hosted Lora and Nunito, so the check-in page
  needs no CDN. Only the check-in page uses these; the rest of the site still loads Google Fonts.
- `assets/vendor/`: React 18.3.1, vendored for the same reason.
- `components/`: the check-in component, its generated build, its build script and its tests.

Quiz scoring, copy, and result profiles live entirely inside `quiz.html`.

## Helpline numbers: verified 31 July 2026

Every number in the check-in footer was checked against the organisation's own page on
**31 July 2026**. Sources, in the order the numbers appear:

| Entry | Hours | Checked against |
| --- | --- | --- |
| Emergency 999 or 112 | 24 hours | standing |
| Samaritans 116 123, free, same number North and South | 24 hours | samaritans.org/ireland |
| Lifeline (NI) 0808 808 8000 | 24 hours | lifelinehelpline.info |
| Pieta 1800 247 247, or text HELP to 51444 | 24 hours, both | pieta.ie |
| Aware 1800 80 48 48 | 10am to 10pm, 7 days | aware.ie |
| Text HELLO to 50808, fallback 086 1800 280 on An Post and 48 | 24 hours | Text About It SMS FAQ |

Hours are written on **every** entry rather than only the ones that differ. In a flat run of
numbers, one labelled entry makes the rest read as though they are all answerable at 3am. Aware is
not, and someone ringing a closed line at their lowest would take the silence as an answer. There is
a test that fails if Aware is ever labelled 24 hours.

Pieta's own page carries both: "24-Hour Crisis Helpline: 1800 247 247" alongside "Talk to a
therapist any time, day or night, 24/7", and for the text line, "Our qualified and professional
therapists are available 24 hours a day". Phone and text are labelled together as `both 24 hours`.

A test walks the rendered footer and fails if **any** entry in it is missing an hours label, so a
number added later cannot quietly join the list unlabelled.

**These numbers rot silently.** Nothing breaks, no test goes red, and the first sign of trouble is a
client ringing a number that has changed. **Recheck every six months**, and note the date here when
you do. Next due: **31 January 2027**.

## The Midweek Check-In component

`components/MidweekCheckIn.jsx` is a React component for the client portal, not part of the static
site. It is the between-session check-in: one score, one micro-win, one anchor, and an evidence list
built from past entries. It is pure. No fetch, no storage, no `clientId`, no login. The parent passes
`scaleTopic`, `history` and `onSubmit`, and adds `id`, `clientId`, `createdAt` and `weekOf` itself
before persisting whatever `onSubmit` hands it. Nothing needs rewriting when it moves into the portal.

Evidence and the trend strip are both derived from `history` on every render, so there is no second
list to keep in step, and no evidence table to build.

`components/preview.html` is a dev harness for working on the component itself: it compiles the
`.jsx` in the browser so you can edit and refresh, seeds a four-week history, and saves with a
deliberate delay so the pending state is visible. It pulls React and Babel from a CDN, so it needs
to be online. To see the real thing instead, open `checkin.html` (below), which needs nothing.

The acceptance checklist from the build spec is runnable:

```
npm i react react-dom jsdom @babel/core @babel/preset-react @babel/plugin-transform-modules-commonjs
node components/MidweekCheckIn.test.mjs
```

78 checks: both score paths through all five screens, the helpline hours, and the hard rules (no em
dashes, no emoji, no exclamation marks, no streaks, no copy about missed weeks, no storage, no
`clientId`).

### Rebuilding after you edit the component

`components/MidweekCheckIn.jsx` is the source of truth. `components/MidweekCheckIn.js` is generated
from it and committed, because `checkin.html` loads it directly and a client on rural broadband
should not be waiting on a compiler. **Edit the `.jsx`, then run:**

```
node components/build.mjs
```

`node components/build.mjs --check` fails if the two have drifted, and the test suite runs it, so a
forgotten rebuild shows up as a failing test rather than as a stale page.

## checkin.html

The page a client actually opens. Unlisted: not in the nav, not linked from anywhere, `noindex,
nofollow, noarchive`. Darragh gives out the address directly.

It is deliberately not in a `robots.txt`, because that file is public and listing the path there
would advertise the one thing being kept quiet. The meta tag is what keeps it out of search.

**Nothing is fetched from another origin and there is no build step.** React 18.3.1 is vendored in
`assets/vendor/`, Lora and Nunito are in `assets/fonts/`, and the component is precompiled. A test
fails if any asset on the page ever points at an off-origin URL.

**Nothing leaves the phone.** No server, no account, no login, no `clientId`, no analytics, and
nothing identifying in the URL. Everything lives in `localStorage` under `bluzen.checkin.v1`.

The page says so, in the interface and not just here: a short line inside the card the first time,
and a standing line at the foot of every screen that clearing browser data clears the evidence bank
with it. That line changes when it would otherwise be a lie, so a browser that refuses storage is
told about instead of quietly promised to.

### The storage seam

`assets/checkin-store.js` is the only file that knows what storage is. Everything else talks to
`checkinStore`:

```
mode()             -> 'store' | 'readonly' | 'memory'
available()        -> boolean, true only in 'store'
load()             -> { status, topic, topicAsked, entries, detail }
saveTopic(topic)   -> { ok, error }          topic may be null for a skip
append(draft)      -> { ok, entry, error }   adds id, createdAt, weekOf
forget()           -> { ok, error }
```

`detail` is a finished sentence written for a client to read, not a log line. The page puts it on
screen, so a full device and a blocked browser have to produce different words. The three modes are
decided on what the device can actually do rather than on the name of the error thrown, because a
full phone and Safari in private browsing both raise `QuotaExceededError`. What separates them is
whether real data reads back.

`append` is the piece playing the parent from the component's contract: the component hands over
`{ score, bodyArea, microWin, anchor }` and the store adds `id`, `createdAt` and `weekOf`. A
`clientId` would be added there too, the day there is one. **When the portal arrives, replace that
one file.** The component and `assets/checkin-app.js` do not change, and the component still never
learns what storage is.

`forget()` is part of the contract but nothing calls it. There is no delete button on the page: a
one-tap way to wipe the evidence bank felt like the wrong thing to put beside it, and clearing
browser data does the same job. Wire it up if you disagree.

### What happens when it goes wrong

Each of these is exercised by a test, because a client is the worst person to discover them.

- **Nothing stored yet.** The topic prompt, then the component's own empty state.
- **Private browsing, or storage switched off.** Says so plainly, still lets the client check in and
  read it back for the visit, and does not claim anything is being kept.
- **Device full, with entries already on it.** This is the case worth understanding. Writing fails
  but reading still works, so the client's evidence bank is right there. The store goes read-only
  rather than falling back to memory: the real history is loaded and shown, and the page says there
  is no room left rather than blaming private browsing. Treating a full device as "storage
  unavailable" would show a returning client an empty bank and the wrong reason for it, which is the
  same failure as an unlabelled helpline, an interface stating something untrue at the moment it
  matters. If space is freed, the next save succeeds and the page goes back to normal on its own.
- **Device fills up mid-visit.** The save does not silently fail. The client stays on the anchor
  screen with their words still in the box, and reads the actual reason rather than "have another
  go".
- **Unreadable stored data.** Starts fresh, says so, and moves the old payload aside under
  `bluzen.checkin.v1.unreadable` rather than writing over it. It is the client's own words.
- **A script does not arrive, or JavaScript is off.** Says so, and still prints the helpline numbers.
  That part has to work when the rest does not.
- **Junk or half-written entries.** Coerced into shape or dropped, never crashed on.

### Testing the page

```
npm i playwright && npx playwright install chromium
node checkin.test.mjs
```

82 checks in a real browser at 390px and 360px, covering the full flow, what actually lands in
`localStorage`, and each failure mode above. It serves the repo itself, so there is nothing to start
first. `BZ_SHOTS=/tmp/shots` writes a screenshot of each state.

## Open items

- **The contact address may be a dead one. Needs Darragh to confirm before anything else here.**
  `index.html` and `privacy.html` both give the contact address as `info@bluzenfocus.com`, but the
  domain the site runs on is `bluzenfocus.net`. If the `.com` isn't also owned, then the address on
  the privacy notice does not exist, which is worse than a normal broken link: it is the route
  someone has to use to request their data or ask for it to be deleted. Left as-is deliberately
  rather than guessed at. It appears in **four** places, so change them together:
  `index.html` (footer contact line), `privacy.html` (intro paragraph), and `assets/app.js` **twice**,
  in the messages shown when a form fails to send. That last pair matters most: it is the fallback
  someone is given at the exact moment the form did not work.
- **Retention period and postal address in `privacy.html`** — see the comment at the top of that
  file. Retention needs confirming with Holistic Insurance Services and the NCH.
- The 10 result PDFs and the sleep-audio file, then the MailerLite result automation that pairs a
  PDF to each `{$quiz_result}` value.
- One live end-to-end test each of the **sleep-audio** and **library waitlist** forms. Both route
  through the same Worker as the quiz but have only ever been exercised against a mock.
- **Domain:** confirmed as `www.bluzenfocus.net` / `bluzenfocus.net` — the one live and
  DNS-configured since the start of the project. (An earlier message said `bluzen.net`; that was
  a mistake and has been reverted.) `CNAME` and the Worker's `ALLOWED_ORIGINS` both point at this.
  Still differs from the `bluzen.ie` domain locked in the canon docs — worth reconciling there at
  some point, not a website blocker.
- The `bluzen-brand` doc still specifies the light Mist palette, `#2BB3C0` cyan and Lora headings.
  The site and quiz are both dark navy with Bricolage Grotesque headings, by decision. Worth
  updating the doc so future PDFs and social posts aren't generated against the old spec.
