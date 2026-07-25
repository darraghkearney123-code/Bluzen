// Bluzen — MailerLite proxy + durable quiz log.
// Deploy as a Cloudflare Worker (Workers & Pages > Create > paste this in > Deploy).
//
// Worker bindings and secrets (Worker > Settings):
//   MAILERLITE_API_TOKEN  Encrypted secret. Never hard-coded here, never logged.
//   QUIZ_LOG              KV binding -> namespace "bluzen-quiz-submissions".
//
// Every quiz completion is written to KV, which is the durable record. MailerLite
// only ever holds the few fields its result automation needs, and Formspree is just
// an instant notification email with a 50/month shared cap, so neither of those can
// be trusted as the store.
//
// There is deliberately NO read endpoint. Submissions contain names, email addresses
// and free-text answers, so exposing them over HTTP would publish respondents' data.
// Read them in the Cloudflare dashboard KV browser instead.

const GROUP_IDS = {
  sleep_audio: "193902288441443604",
  library_waitlist: "193902319779185980",
  quiz_completed: "193902340490659106",
};

// Only these origins are served, so the Worker (and the MailerLite quota behind it)
// can't be driven by a third party who finds the URL.
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

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function shortId() {
  return Math.random().toString(36).slice(2, 10);
}

// Writes the whole submission to KV. Never throws, so a storage problem can't take
// the MailerLite send down with it.
async function storeSubmission(env, submission) {
  if (!submission) return "no-submission";
  if (!env || !env.QUIZ_LOG) return "unavailable";
  try {
    const ts = submission.completed_at || new Date().toISOString();
    // The client sends a stable submission_id, so a retry overwrites the same key
    // rather than storing the same completion twice.
    const id = submission.submission_id || shortId();
    await env.QUIZ_LOG.put("quiz:" + ts + ":" + id, JSON.stringify(submission));
    return "stored";
  } catch (err) {
    console.error("KV write failed:", err && err.message);
    return "error";
  }
}

// Adds or updates the subscriber and fires the group's automation. Never throws.
async function sendToMailerLite(env, group, email, fields) {
  const groupId = GROUP_IDS[group];
  if (!groupId || !email) return { ok: false, status: 400, detail: "unknown group or missing email" };
  try {
    const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + env.MAILERLITE_API_TOKEN,
      },
      body: JSON.stringify({ email: email, fields: fields || {}, groups: [groupId] }),
    });
    // Passed back to the caller so a rejected custom field surfaces instead of
    // silently looking like "only the group saved".
    const detail = await res.text();
    return { ok: res.ok, status: res.status, detail: detail };
  } catch (err) {
    console.error("MailerLite request failed:", err && err.message);
    return { ok: false, status: 0, detail: String(err && err.message) };
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    // POST only. No GET/list route by design, see the privacy note at the top.
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch (err) {
      return json({ error: "Invalid JSON" }, 400, origin);
    }

    const group = body && body.group;
    const email = body && body.email;
    const fields = body && body.fields;
    const submission = body && body.submission;

    if (!group && !submission) {
      return json({ error: "Nothing to do" }, 400, origin);
    }

    // Deliberately independent and run together: the durable log must survive a
    // MailerLite outage, and a KV problem must not stop the result email going out.
    const results = await Promise.all([
      storeSubmission(env, submission),
      group
        ? sendToMailerLite(env, group, email, fields)
        : Promise.resolve({ ok: false, status: 0, detail: "no group supplied" }),
    ]);

    const kv = results[0];
    const ml = results[1];

    // Always 200 when the request itself was well formed, so one failing side never
    // fails the whole call. The client retries on transport errors only, and reads
    // these flags to report what actually happened.
    return json({
      ok: true,
      kv: kv,
      mailerlite: { ok: ml.ok, status: ml.status, detail: ml.detail },
    }, 200, origin);
  },
};
