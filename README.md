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
`bluzen-quiz-submissions` → your keys. Each key is `quiz:<ISO timestamp>:<short id>` so they sort
newest-last by time, and each value is one JSON record containing the path taken, every question
with the exact wording the visitor saw and the answer they picked (including the three carer
questions), the free-text answer, the resulting profile, carer state, the nothing-works flag, plus
name, email and `completed_at`.

There is deliberately **no read endpoint on the Worker**. Submissions contain names, email addresses
and personal free-text answers, so serving them over HTTP would publish respondents' data. The
Cloudflare dashboard is the only way in — please keep it that way.

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

### Known limitations

- **Formspree: 50 submissions/month on the free plan, shared** across quiz completions, the library
  waitlist and the contact form. Past that, Formspree stops accepting and the notification emails
  stop arriving. Quiz records are unaffected because KV is the store — but if the notifications
  matter at volume, that's the thing to upgrade.
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

- **Redeploy the Worker** with the current `cloudflare-worker/mailerlite-proxy.js` — the KV logging
  is in that file, so submissions aren't being stored until it's deployed.
- **Domain:** confirmed as `www.bluzenfocus.net` / `bluzenfocus.net` — the one live and
  DNS-configured since the start of the project. (An earlier message said `bluzen.net`; that was
  a mistake and has been reverted.) `CNAME` and the Worker's `ALLOWED_ORIGINS` both point at this.
  Still differs from the `bluzen.ie` domain locked in the canon docs — worth reconciling there at
  some point, not a website blocker.
- The 10 result PDFs and the sleep-audio file — you're creating these now, no action needed yet.
