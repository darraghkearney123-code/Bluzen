# Bluzen

The Bluzen website: plain static pages, no build step. Served by GitHub Pages at www.bluzenfocus.net.

## What's here

- `index.html`: the home page. The hero is a murmuration that gathers into the Bluzen head and gears, then the check-in, the privacy promise, how it works, adding it to your phone, and a short About. One self-contained file; it loads nothing from other companies.
- `check-in/`: the check-in, as an installable app that works offline.
  - `index.html` is the check-in itself.
  - `manifest.webmanifest` and the icons let people add it to their home screen.
  - `sw.js` keeps a copy of the check-in's own files on the phone so it opens with no signal. It never sends anything. **Bump `CACHE` in `sw.js` whenever anything in `check-in/` changes**, or phones keep the old copy.
- `direction/index.html`: Find your direction. Eight sliders point check-ins towards Settle, Unload, Refuel or Hold steady, with a murmuration that gathers into the head and gears. Shares the check-in's gear engine (`HG` block, copied unchanged) and support numbers. Stores and sends nothing. The wind-down audio email offer is built but off (`SETTINGS.email`). Its result links to `check-in/#dir=…`, and the check-in leans a few ideas that way.
- `how-it-works.html`, `support.html`, `privacy.html`, `accessibility.html`, `404.html` and the draft `sessions.html`: plain pages sharing `assets/site.css`. They allow no inline styles and no scripts, so all of their look lives in that one file.
- Light and dark: the home page and the plain pages follow the device's setting (`prefers-color-scheme`). The check-in and Find your direction keep their own switch.
- `quiz.html`: the old quiz is retired. This page just forwards old links to the check-in.
- `assets/`: logo, headshot, share image, and the shared stylesheet. `bluzen-mark.svg` and `bluzen-mark-light.svg` are the head and gears drawn as vectors from the check-in's own geometry, for dark and light pages.
- `cloudflare-worker/mailerlite-proxy.js`: the MailerLite proxy. Nothing on the site uses it now, but it's kept for the wind-down audio sign-up later. It's deployed separately in Cloudflare.

## Privacy, by design

- No cookies, analytics, trackers, fonts or scripts from anywhere else. Every page has a Content-Security-Policy that blocks outside requests.
- The check-in stores nothing and sends nothing. Its policy allows only its own manifest and offline helper, from its own folder.
- If you ever add analytics, a form or an embed, the policy will block it, and `privacy.html` has to change to match.

## Before going live (search the files for TODO and CONFIRM)

- **Contact (TODO CONTACT).** There's no working contact address yet. Set one up and add it to `index.html`, `privacy.html` and `accessibility.html`. A privacy notice needs a real way to reach you.
- **Prices (TODO PRICES).** Not set. `sessions.html` stays hidden and unlinked until they are.
- **CPHT and David Newton wording** in the About section of `index.html`. Confirm with CPHT Belfast.
- **Old quiz records** in Cloudflare KV and MailerLite. Decide what happens to them and by when, then fill in the gap in `privacy.html`.
- **Retention period** for client records, confirmed with your insurer and professional body.

## The name isn't final

Darragh is open to renaming Bluzen. If the name changes, update: the domain and `CNAME`, the wordmark text on every page, page titles and descriptions, the check-in's `manifest.webmanifest` name, the share image (`assets/og-image.png`), the logo files if the mark changes, the Cloudflare Worker's allowed origins, and the MailerLite sender name. Hold off on setting up a contact email until the name is settled.

## Retired in this version

The two-path quiz and its data storage, the Programmes page, the Library waitlist, the sleep audio sign-up (until the audio is recorded), the contact form, the welcome breath pop-up, and Google Fonts. They're all in the git history if needed.

## Running locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. The offline helper only switches on over https, so test installing on the live site.
