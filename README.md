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
updated file into the Cloudflare dashboard's Worker editor and redeploy — the secret persists
across redeploys.

The 10-PDF-per-result and "which PDF goes with which profile" logic lives entirely in MailerLite's
email editor (conditional content keyed off the `quiz_result` field), not in this code — that's your
side to build once the PDFs exist.

### 3. Calendly

**Done.** Confirmed 15 minutes, matching canon. `BOOKING_URL` is set to
`https://calendly.com/darraghkearney123/30min` — the URL slug still says "30min" (an old path, left
as-is) but that event has been reconfigured to a genuine 15-minute consult, confirmed live.

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

- **Domain:** confirmed as `www.bluzenfocus.net` / `bluzenfocus.net` — the one live and
  DNS-configured since the start of the project. (An earlier message said `bluzen.net`; that was
  a mistake and has been reverted.) `CNAME` and the Worker's `ALLOWED_ORIGINS` both point at this.
  Still differs from the `bluzen.ie` domain locked in the canon docs — worth reconciling there at
  some point, not a website blocker.
- The 10 result PDFs and the sleep-audio file — you're creating these now, no action needed yet.
