# Bluzen

The Bluzen website — static pages (`index.html`, `quiz.html` + `assets/`), no build step required.

## Before you go live

### 1. Formspree — waitlist & contact forms (`assets/app.js`)

These two just need to land in your inbox.

1. Create a free account at [formspree.io](https://formspree.io) and a new form (this needs your
   account email verified before you can create a form).
2. Copy its endpoint (looks like `https://formspree.io/f/abcd1234`).
3. In `assets/app.js`, replace `FORMSPREE_ENDPOINT` with that URL. Both forms share it — a hidden
   `form_name` field (`library_waitlist` or `contact`) tells them apart in your inbox.

### 2. MailerLite — sleep audio & quiz result emails (this is what actually sends them)

Per the Bluzen canon, MailerLite's own automations send both of these emails (locked copy, `{$name}`
and `{$carer_state_text}` merge tags) — the site's job is only to get each visitor into the right
group with the right fields. **Groups created:** `Sleep Audio`, `Library Waitlist`, `Quiz Takers`.

Two things still need lining up against canon before this works:

- **Rename the `Quiz Takers` group to `Quiz Completed`** — that's the exact group name the locked
  result-email automation triggers on. (The group/form's internal ID doesn't change, so nothing else
  needs updating once it's renamed.)
- **Custom fields must be exactly:** `profile`, `path`, `carer_state`, `carer_state_text`,
  `hardest_part`. Currently `quiz_result` and `carer_state` exist — add the three missing ones and
  rename `quiz_result` → `profile` so the names match exactly (MailerLite segmentation/automations
  break silently on a mismatch, so this has to be exact).

Then, for each of the three groups, get the real **embed code** — MailerLite → Forms → Embedded →
(group) → the **"Embed"** tab, not "Share" (a share link is a hosted page, not something this code
can submit into). It's normally a `<div>` plus a `<script>` tag. Paste it in:

- **Sleep Audio** → into `#ml-embed-sleep` in `index.html`, then set `MAILERLITE_SLEEP_EMBEDDED = true` in `assets/app.js`.
- **Library Waitlist** (optional, just for building an audience ahead of launch) → into `#ml-embed-waitlist` in `index.html`, then set `MAILERLITE_WAITLIST_EMBEDDED = true` in `assets/app.js`.
- **Quiz Completed** → anywhere in the body of `quiz.html` (a placeholder comment marks a good spot), then set `MAILERLITE_EMBEDDED = true` near the top of its script.

Each embed renders invisibly — the site fills in the hidden fields and submits it automatically, the
visitor never sees a second form. Until each embed is pasted in, that flow shows/logs a clear
"not connected yet" message instead of silently losing signups.

The 10-PDF-per-result and "which PDF goes with which profile" logic lives entirely in MailerLite's
email editor (conditional content keyed off the `profile` field), not in this code — that's your
side to build once the PDFs exist.

### 3. Calendly

Wired in: `BOOKING_URL` in `quiz.html` points at `https://calendly.com/darraghkearney123/30min`, and
the button/result text now say "30 minute" to match. **Flag:** canon locks the discovery call at 15
minutes (it's part of the priced offer, and the locked result-email copy itself says "free 15 minute
call") — so there's now a real mismatch between the live Calendly event and the locked email
wording. Either create a matching 15-minute Calendly event and I'll point `BOOKING_URL` at that
instead, or treat 30 minutes as the new standard (which would mean revisiting the locked email copy
too, since that's a separate approval step, not something to change silently).

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

- `index.html` — the main site: nav, sleep-audio/waitlist/contact forms, library, about, footer.
- `quiz.html` — the standalone quiz (dual "for me" / "for someone I care for" paths, 5 result profiles
  each, plus a 3-state "how are you coping" read for carers). Linked from `index.html`'s quiz buttons
  and cards (`quiz.html?path=me` / `quiz.html?path=carer` preselects the path).
- `assets/styles.css` — shared styles, hover/focus states, and animations for `index.html`.
- `assets/app.js` — `index.html`'s interactivity: nav, forms, the sleep-audio popup.
- `assets/*.png` — logo assets.

Quiz scoring, copy, and result profiles live entirely inside `quiz.html` — no separate backend.
