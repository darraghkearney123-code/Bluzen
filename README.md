# Bluzen

The Bluzen website — a single static page (`index.html` + `assets/`), no build step required.

## Before you go live

The sleep-audio, waitlist, and contact forms post to [Formspree](https://formspree.io). To connect them:

1. Create a free Formspree account and a new form.
2. Copy the form's endpoint (looks like `https://formspree.io/f/abcd1234`).
3. Open `assets/app.js` and replace the `FORMSPREE_ENDPOINT` placeholder near the top of the file with that URL.
4. Commit and push — no other code changes are needed. All three forms share the one endpoint; each submission includes a `form_name` field (`sleep_audio`, `library_waitlist`, or `contact`) so you can tell them apart in your Formspree/email inbox.

Until you do this, submitting any form shows a friendly inline message telling the visitor it isn't connected yet — it won't silently fail or crash.

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

- `index.html` — all page content and structure.
- `assets/styles.css` — shared styles, hover/focus states, and animations.
- `assets/app.js` — all interactivity: nav, forms, the sleep-audio popup, and the quiz "coming soon" modal.
- `assets/*.png` — logo assets.

## The quiz

The "Take the quiz" flow currently opens a short "being finalised" message — the actual scoring quiz (six library areas, personalised PDF result) hasn't been built yet. Everything else on the site is fully wired up.
