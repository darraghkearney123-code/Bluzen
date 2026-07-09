# Bluzen

The Bluzen website — static pages (`index.html`, `quiz.html` + `assets/`), no build step required.

## Before you go live

Three services need connecting. Until each is set up, that piece shows a friendly inline message
instead of failing silently or crashing.

### 1. Formspree — waitlist & contact forms (`assets/app.js`)

These two forms just need to land in your inbox.

1. Create a free account at [formspree.io](https://formspree.io) and a new form.
2. Copy its endpoint (looks like `https://formspree.io/f/abcd1234`).
3. In `assets/app.js`, replace `FORMSPREE_ENDPOINT` with that URL. Both forms share it — a hidden
   `form_name` field (`library_waitlist` or `contact`) tells them apart in your inbox.

### 2. EmailJS — sleep audio & quiz result emails (`assets/app.js` and `quiz.html`)

These need to send a personalised email straight to the visitor, so they use
[EmailJS](https://emailjs.com) instead of Formspree.

1. Create a free EmailJS account.
2. Under **Email Services**, connect the inbox you want emails to send *from*.
3. Under **Email Templates**, create three templates with these exact variable names:
   - **Sleep audio** — `{{to_email}}`, `{{to_name}}`, `{{audio_link}}`
   - **Quiz result (me path)** — `{{to_email}}`, `{{to_name}}`, `{{result_name}}`, `{{result_copy}}`, `{{pdf_link}}`
   - **Quiz result (carer path)** — same as above, plus `{{carer_state_name}}`, `{{carer_state_copy}}`
4. Wire up the keys:
   - In `assets/app.js`: `EMAILJS_PUBLIC_KEY`, `EMAILJS_SERVICE_ID`, `EMAILJS_SLEEP_TEMPLATE_ID`, and
     `SLEEP_AUDIO_LINK` (the actual link to the audio file).
   - In `quiz.html`: the same `EMAILJS_PUBLIC_KEY`/`EMAILJS_SERVICE_ID`, plus `EMAILJS_TEMPLATE_ME`,
     `EMAILJS_TEMPLATE_CARER`, and `PDF_LINKS` (one URL per result — there are 10 placeholders to fill in,
     one for each of the five "for me" and five "for someone I care for" outcomes).

Free tier covers 200 emails/month.

### 3. MailerLite — building your subscriber lists (optional, list-building only)

Sleep-audio signups and quiz-takers can also be added to MailerLite groups, purely so you have an
audience to email later (e.g. when the Library launches). This is separate from the actual sending
above — MailerLite doesn't send anything here, EmailJS does.

1. In MailerLite, create groups (e.g. `Sleep Audio`, `Quiz Takers`).
2. For each, go to **Forms → Embedded**, create a basic form, and copy its submit/action URL.
3. Paste that URL into `MAILERLITE_SLEEP_ENDPOINT` in `assets/app.js`, and `MAILERLITE_ENDPOINT` in `quiz.html`.

Leave these blank to skip MailerLite entirely — everything else still works.

### The Calendly (or similar) booking link

In `quiz.html`, set `BOOKING_URL` so "Book a free 15 minute chat" on the result screen opens your
real booking page. Until then it shows a placeholder message instead of a dead link.

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
