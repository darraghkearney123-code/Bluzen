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

**Done:** the proxy code is written and the three `GROUP_IDS` are filled in
(`cloudflare-worker/mailerlite-proxy.js`). **This part has to be done by you directly** — deploying
to Cloudflare means creating a third-party account, and an API token/secret shouldn't be handled by
anyone but you:

1. Create a free Cloudflare account, go to **Workers & Pages → Create → Create Worker**.
2. Paste the full contents of `cloudflare-worker/mailerlite-proxy.js` into the editor and deploy.
3. In MailerLite: **Integrations → API**, generate a token.
4. In the Worker's **Settings → Variables**, add an encrypted secret named `MAILERLITE_API_TOKEN`
   with that token. (Don't put it in the code itself, and don't send it to anyone else — keep it
   only in Cloudflare's secret store.)
5. Redeploy the Worker so the secret takes effect.
6. Copy the Worker's URL (looks like `https://mailerlite-proxy.<you>.workers.dev`) and send it over
   — it goes into `MAILERLITE_WORKER_URL` in both `assets/app.js` and `quiz.html`.

Until this is set up, sleep-audio signups show a clear "not connected yet" message, and quiz
completions log a console warning — neither silently loses data or crashes.

The 10-PDF-per-result and "which PDF goes with which profile" logic lives entirely in MailerLite's
email editor (conditional content keyed off the `quiz_result` field), not in this code — that's your
side to build once the PDFs exist.

### 3. Calendly

Confirmed: the call is 15 minutes, matching canon — button and result-screen copy in `quiz.html` say
"15 minute" again. `BOOKING_URL` is currently blank (so "Book a free 15 minute chat" shows a friendly
"booking link coming soon" message instead of a wrong link) — the link on file,
`.../darraghkearney123/30min`, is a 30-minute event and would be the wrong one. Send over the actual
15-minute Calendly event URL and I'll wire it in.

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
- `cloudflare-worker/mailerlite-proxy.js` — the small serverless proxy that gets signups into
  MailerLite (see setup above). Deployed separately from the site itself; not served by GitHub Pages.

Quiz scoring, copy, and result profiles live entirely inside `quiz.html`.

## Open items

- **Deploy the Cloudflare Worker** (see MailerLite section above) and send over its URL.
- **The 15-minute Calendly event URL** — `BOOKING_URL` is blank until this arrives.
- **Domain:** confirmed as `bluzen.net` — `CNAME` and the Worker's `ALLOWED_ORIGINS` are set to
  that. Note this still differs from the `bluzen.ie` domain locked in the canon docs, worth
  reconciling there at some point but not a website blocker.
- The 10 result PDFs and the sleep-audio file — you're creating these now, no action needed yet.
