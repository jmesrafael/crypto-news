// /api/signal: the news gate evaluated "now" for every coin and direction, for the news paper bots and the
// dashboard shadow. Lean on purpose (4 small requests); every input fails independently, and a missing input
// simply means that rule can't fire (the gate fails OPEN — it never blocks trades because data is missing).
const { gate, DEFAULTS } = require('./news-gate');

const COINS = ['SOL', 'ZEC', 'NEAR', 'ADA', 'GALA', 'BTC', 'ETH'];
const UA = { 'User-Agent': 'Mozilla/5.0 (news-reader)' };
const getJSON = async (url, ms = 8000) => {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
};

async function inputs() {
  const { getCalendar } = require('./calendar');
  const [cal, fng, btc, hk] = await Promise.allSettled([
    getCalendar(),
    getJSON('https://api.alternative.me/fng/?limit=1'),
    getJSON('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true'),
    getJSON('https://api.llama.fi/hacks', 12000),
  ]);
  const now = Date.now() / 1000;
  return {
    events: cal.status === 'fulfilled' ? (cal.value.week || []).map((e) => ({ name: e.title, t: Math.round(e.time / 1000), country: e.country }))
      .filter((e) => e.country === 'USD').sort((a, b) => a.t - b.t) : null,
    fng: fng.status === 'fulfilled' ? +fng.value.data[0].value : null,
    btcChange24h: btc.status === 'fulfilled' ? btc.value.bitcoin.usd_24h_change : null,
    hacks: hk.status === 'fulfilled' ? hk.value.filter((h) => h.date > now - 5 * 86400)
      .map((h) => ({ t: h.date + 86400, amount: h.amount || 0, chains: h.chain || [], name: h.name })).sort((a, b) => a.t - b.t) : null,
    errors: [cal, fng, btc, hk].map((r, i) => r.status === 'rejected' ? ['calendar', 'fng', 'btc', 'hacks'][i] + ': ' + r.reason.message : null).filter(Boolean),
  };
}

let last = null;
async function getSignal() {
  const inp = await inputs();
  const t = Math.floor(Date.now() / 1000);
  const ctx = { t, events: inp.events, fngAt: () => inp.fng, btcChange24h: inp.btcChange24h, hacks: inp.hacks };
  const coins = {};
  for (const coin of COINS) coins[coin] = { long: gate({ ...ctx, coin, dir: 1 }), short: gate({ ...ctx, coin, dir: -1 }) };
  const upcoming = (inp.events || []).filter((e) => e.t > t).slice(0, 5);
  last = {
    version: 1, updated: Date.now(), cfg: DEFAULTS, coins,
    blackout: Object.values(coins).some((c) => c.long.reasons.some((r) => r.startsWith('blackout'))),
    inputs: { fng: inp.fng, btcChange24h: inp.btcChange24h, nextEvents: upcoming, recentHacks: (inp.hacks || []).slice(-5), errors: inp.errors },
  };
  return last;
}

module.exports = { getSignal };
