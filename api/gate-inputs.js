// Vercel serverless function: GET /api/gate-inputs
// Everything needed to re-run the news gate at any past moment of the last ~90 days (dashboard shadow test):
// USD high-impact events, daily Fear & Greed, hourly BTC closes, hacks.
const fs = require('fs');
const path = require('path');
const { DEFAULTS } = require('../lib/news-gate');

const UA = { 'User-Agent': 'Mozilla/5.0 (news-reader)' };
const getJSON = async (url, ms = 10000) => {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
};
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8')); } catch { return d; } };

let last = null;
module.exports = async (req, res) => {
  const since = Date.now() / 1000 - 120 * 86400;
  const [fng, btc, hk] = await Promise.allSettled([
    getJSON('https://api.alternative.me/fng/?limit=150'),
    getJSON('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=90'),
    getJSON('https://api.llama.fi/hacks', 12000),
  ]);
  // events: permanent history saved by the daily job + this week's calendar copy
  const week = readJSON('calendar-week.json', []).filter((e) => e.country === 'USD' && e.impact === 'High')
    .map((e) => ({ name: e.title, t: Math.round(Date.parse(e.date) / 1000) }));
  const ev = new Map([...readJSON('events-history.json', []), ...week].map((e) => [e.name + '|' + e.t, e]));
  const out = {
    updated: Date.now(), cfg: DEFAULTS,
    events: [...ev.values()].filter((e) => e.t > since).sort((a, b) => a.t - b.t),
    fng: fng.status === 'fulfilled' ? fng.value.data.map((r) => [+r.timestamp, +r.value]).sort((a, b) => a[0] - b[0]) : last?.fng || [],
    btc: btc.status === 'fulfilled' ? btc.value.prices.map(([ms, p]) => [Math.round(ms / 1000), +p.toFixed(2)]) : last?.btc || [],
    hacks: hk.status === 'fulfilled' ? hk.value.filter((h) => h.date > since).map((h) => ({ t: h.date + 86400, amount: h.amount || 0, chains: h.chain || [], name: h.name })).sort((a, b) => a.t - b.t) : last?.hacks || [],
  };
  last = out;
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
  res.setHeader('Access-Control-Allow-Origin', '*'); // the bot dashboard (another domain) reads this
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(JSON.stringify(out));
};
