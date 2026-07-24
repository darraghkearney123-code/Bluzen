/**
 * MailerLite proxy — deploy this as a Cloudflare Worker.
 *
 * The Bluzen site (index.html, quiz.html) has no backend of its own — it's static pages on
 * GitHub Pages. MailerLite's plan doesn't expose an embeddable form or POST endpoint the site
 * could submit to directly, and its API token must never be shipped to the browser (anyone
 * could read it and abuse the account). This Worker is the one small trusted server in between:
 * the site calls it with plain JSON, it holds the real API token as a secret, and it calls
 * MailerLite's API on the site's behalf.
 *
 * Setup (see README.md in the repo root for the full walkthrough):
 *   1. Fill in GROUP_IDS below with your real MailerLite group IDs.
 *   2. Fill in ALLOWED_ORIGINS with your site's real domain(s).
 *   3. Deploy this file as a Worker (Cloudflare dashboard -> Workers & Pages -> Create -> paste
 *      this code in the editor -> Deploy).
 *   4. In the Worker's Settings -> Variables, add an encrypted secret named
 *      MAILERLITE_API_TOKEN with your MailerLite API token (MailerLite -> Integrations -> API).
 *   5. Copy the Worker's URL (looks like https://mailerlite-proxy.YOUR-SUBDOMAIN.workers.dev)
 *      into MAILERLITE_WORKER_URL in assets/app.js and quiz.html.
 */

const GROUP_IDS = {
  sleep_audio: "193902288441443604",
  library_waitlist: "193902319779185980",
  quiz_completed: "193902340490659106",
};

// Only requests from these origins are served — keeps random third parties from using your
// Worker (and your MailerLite API quota) even if they find its URL. Include every real origin
// the site is served from (custom domain, GitHub Pages subdomain, localhost while testing, etc).
const ALLOWED_ORIGINS = [
  "https://www.bluzenfocus.net",
  "https://bluzenfocus.net",
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders(origin) });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400, headers: corsHeaders(origin) });
    }

    const { group, email, fields } = body || {};
    const groupId = GROUP_IDS[group];

    if (!groupId || !email) {
      return new Response("Missing or unknown group, or missing email", { status: 400, headers: corsHeaders(origin) });
    }

    const mlRes = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.MAILERLITE_API_TOKEN}`,
      },
      body: JSON.stringify({
        email,
        fields: fields || {},
        groups: [groupId],
      }),
    });

    if (!mlRes.ok) {
      const errText = await mlRes.text();
      return new Response(errText, { status: mlRes.status, headers: corsHeaders(origin) });
    }

    return new Response("OK", { status: 200, headers: corsHeaders(origin) });
  },
};
