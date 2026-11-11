// Optional persistent store: Upstash Redis over its REST API (free tier, no npm package needed).
// Add the Upstash Redis integration on Vercel (Storage tab) and it sets these env vars for you.
// Without them everything still works; stories are just not kept between cold starts.
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const hasKV = () => Boolean(URL_ && TOKEN);

async function cmd(args) {
  const res = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error('KV HTTP ' + res.status);
  return (await res.json()).result;
}

async function kvGet(key) {
  if (!hasKV()) return null;
  try { const v = await cmd(['GET', key]); return v ? JSON.parse(v) : null; }
  catch (e) { console.error('kvGet', e.message); return null; }
}

async function kvSet(key, value) {
  if (!hasKV()) return;
  try { await cmd(['SET', key, JSON.stringify(value), 'EX', 7 * 86400]); }
  catch (e) { console.error('kvSet', e.message); }
}

module.exports = { kvGet, kvSet, hasKV };
