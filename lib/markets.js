// Market data for Pulse: CoinGecko (coins + global), alternative.me (Fear & Greed), Yahoo chart API (macro).
// All free and keyless. Each source fails independently; the last good copy of each part is kept in memory.
// Personal watchlist: CoinGecko ids, shown in this order. Edit freely.
const WATCHLIST = ['solana', 'zcash', 'cardano', 'near', 'gala', 'ethereum', 'sui', 'arbitrum'];

const UA = { 'User-Agent': 'Mozilla/5.0 (pulse-markets)' };
const MACRO = [
  ['S&P 500', '^GSPC', 'S&P 500 Index'], ['Nasdaq', '^IXIC', 'Nasdaq Composite'], ['DXY', 'DX-Y.NYB', 'US Dollar Index'],
  ['US 10Y', '^TNX', '10-Year Treasury Yield'], ['Gold', 'GC=F', 'Gold Futures'], ['Oil', 'CL=F', 'WTI Crude Futures'],
];

async function get(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url.split('?')[0]);
  return res.json();
}

function downsample(arr, n = 60) {
  const v = (arr || []).filter(x => x != null && !isNaN(x));
  if (v.length <= n) return v.map(round);
  const out = [];
  for (let i = 0; i < n; i++) out.push(round(v[Math.round((i / (n - 1)) * (v.length - 1))]));
  return out;
}
function round(x) { const a = Math.abs(x); return a >= 100 ? +x.toFixed(2) : a >= 1 ? +x.toFixed(4) : +x.toPrecision(5); }

const MARKETS_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&sparkline=true&price_change_percentage=1h,24h,7d';

async function coins() {
  return (await get(MARKETS_URL + '&order=market_cap_desc&per_page=100&page=1')).map(shape);
}

// Watchlist coins in WATCHLIST order. Reuses top-100 rows when present; fetches the rest explicitly.
async function watchlist(top) {
  const byId = new Map((top || []).map(c => [c.id, c]));
  const missing = WATCHLIST.filter(id => !byId.has(id));
  if (missing.length) (await get(MARKETS_URL + '&ids=' + missing.join(','))).map(shape).forEach(c => byId.set(c.id, c));
  return WATCHLIST.map(id => byId.get(id)).filter(Boolean).map(c => ({ ...c, trend: trendOf(c.change1h, c.change24h), bias: biasOf(c) }));
}

function trendOf(h1, h24) {
  if (h1 == null || h24 == null) return 'Flat';
  if (h1 <= -1.5 || h24 <= -6) return 'Falling fast';
  if (h1 >= 1.5 || h24 >= 6) return 'Rising fast';
  if (h24 <= -1.5 || h1 <= -0.6) return 'Falling';
  if (h24 >= 1.5 || h1 >= 0.6) return 'Rising';
  return 'Flat';
}
function biasOf(c) {
  const s = (c.change1h ?? 0) * 0.5 + (c.change24h ?? 0) * 0.6 + (c.change7d ?? 0) * 0.3;
  return s >= 1.5 ? 'LONG' : s <= -1.5 ? 'SHORT' : 'NEUTRAL';
}

function shape(c) {
  return ({
    id: c.id, symbol: String(c.symbol || '').toUpperCase(), name: c.name, image: c.image, rank: c.market_cap_rank,
    price: c.current_price,
    change1h: c.price_change_percentage_1h_in_currency ?? null,
    change24h: c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h ?? null,
    change7d: c.price_change_percentage_7d_in_currency ?? null,
    marketCap: c.market_cap, volume: c.total_volume,
    spark: downsample(c.sparkline_in_7d && c.sparkline_in_7d.price),
  });
}

async function global() {
  const g = (await get('https://api.coingecko.com/api/v3/global')).data;
  return {
    totalMarketCap: g.total_market_cap && g.total_market_cap.usd,
    totalVolume: g.total_volume && g.total_volume.usd,
    marketCapChange24h: g.market_cap_change_percentage_24h_usd,
    btcDominance: g.market_cap_percentage && g.market_cap_percentage.btc,
    ethDominance: g.market_cap_percentage && g.market_cap_percentage.eth,
  };
}

async function fearGreed() {
  const d = (await get('https://api.alternative.me/fng/?limit=30')).data;
  const [now, prev] = d;
  return {
    value: +now.value, label: now.value_classification, prev: prev ? +prev.value : null,
    history: d.slice().reverse().map(x => ({ t: +x.timestamp * 1000, value: +x.value })),
  };
}

async function macro() {
  const out = await Promise.all(MACRO.map(async ([sym, ticker, name]) => {
    try {
      const d = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1h`);
      const r = d.chart.result[0];
      const closes = (r.indicators.quote[0].close || []).filter(x => x != null);
      const price = r.meta.regularMarketPrice ?? closes[closes.length - 1];
      // Previous session close: last close of the prior trading day in the 5d series.
      const ts = r.timestamp || [];
      const day = t => new Date(t * 1000 + (r.meta.gmtoffset || 0) * 1000).toISOString().slice(0, 10);
      let prior = null;
      if (ts.length) {
        const lastDay = day(ts[ts.length - 1]);
        const q = r.indicators.quote[0].close;
        for (let i = ts.length - 1; i >= 0; i--) if (day(ts[i]) !== lastDay && q[i] != null) { prior = q[i]; break; }
      }
      prior = prior ?? r.meta.chartPreviousClose ?? r.meta.previousClose;
      return { sym, name, price, change: prior ? (price / prior - 1) * 100 : null, spark: downsample(closes) };
    } catch { return null; }
  }));
  return out.filter(Boolean);
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function mood(coinList, fg, glob) {
  const cs = (coinList || []).filter(c => c.marketCap);
  const cap = cs.reduce((s, c) => s + c.marketCap, 0) || 1;
  const w = k => cs.reduce((s, c) => s + (c[k] ?? 0) * c.marketCap, 0) / cap;
  const avg1h = cs.length ? w('change1h') : null, avg24h = cs.length ? w('change24h') : null, avg7d = cs.length ? w('change7d') : null;
  const up = cs.filter(c => (c.change24h ?? 0) > 0).length;
  const breadth24h = cs.length ? Math.round((up / cs.length) * 100) : null;

  // Components each scaled 0-100, blended with weights; missing parts are skipped.
  const parts = [];
  if (fg) parts.push([fg.value, 0.30]);
  if (breadth24h != null) parts.push([breadth24h, 0.25]);
  if (avg24h != null) parts.push([clamp(50 + avg24h * 10, 0, 100), 0.25]);
  if (avg7d != null) parts.push([clamp(50 + avg7d * 4, 0, 100), 0.20]);
  const wsum = parts.reduce((s, p) => s + p[1], 0);
  const score = wsum ? Math.round(parts.reduce((s, p) => s + p[0] * p[1], 0) / wsum) : 50;
  const label = score >= 75 ? 'Strong Bullish' : score >= 58 ? 'Bullish' : score > 42 ? 'Neutral' : score > 25 ? 'Bearish' : 'Strong Bearish';

  let momentum = 'Flat';
  if (avg1h != null && avg24h != null) {
    if (avg1h <= -1 || avg24h <= -4) momentum = 'Falling fast';
    else if (avg1h >= 1 || avg24h >= 4) momentum = 'Rising fast';
    else if (avg24h <= -1 || avg1h <= -0.4) momentum = 'Falling';
    else if (avg24h >= 1 || avg1h >= 0.4) momentum = 'Rising';
  }

  const pct = x => (x >= 0 ? '+' : '') + x.toFixed(1) + '%';
  const notes = [];
  const btc = cs.find(c => c.symbol === 'BTC');
  if (btc && btc.change24h != null) notes.push(`BTC ${pct(btc.change24h)} 24h${btc.change7d != null ? `, ${pct(btc.change7d)} 7d` : ''}`);
  if (fg) notes.push(`Fear & Greed ${fg.value} (${fg.label})${fg.prev != null ? `, ${fg.value >= fg.prev ? 'up' : 'down'} from ${fg.prev}` : ''}`);
  if (breadth24h != null) notes.push(`${up}/${cs.length} top coins up today`);
  if (avg1h != null) notes.push(`Last hour ${pct(avg1h)} (cap-weighted)`);
  if (glob && glob.btcDominance != null) notes.push(`BTC dominance ${glob.btcDominance.toFixed(1)}%`);

  const r2 = x => x == null ? null : +x.toFixed(2);
  return { score, label, momentum, breadth24h, avg1h: r2(avg1h), avg24h: r2(avg24h), avg7d: r2(avg7d), notes };
}

let last = { coins: [], global: null, fearGreed: null, macro: [], watchlist: [] };

async function getMarkets() {
  const coinsP = coins();
  const [c, g, f, m, w] = await Promise.allSettled([coinsP, global(), fearGreed(), macro(), coinsP.catch(() => last.coins).then(watchlist)]);
  const pick = (r, key, ok = v => v) => (r.status === 'fulfilled' && ok(r.value) ? (last[key] = r.value) : last[key]);
  const data = {
    updated: Date.now(),
    global: pick(g, 'global'),
    coins: pick(c, 'coins', v => v.length) || [],
    fearGreed: pick(f, 'fearGreed'),
    macro: pick(m, 'macro', v => v.length) || [],
    watchlist: pick(w, 'watchlist', v => v.length) || [],
    errors: [c, g, f, m, w].filter(r => r.status === 'rejected').map(r => r.reason && r.reason.message),
  };
  data.mood = mood(data.coins, data.fearGreed, data.global);
  return data;
}

module.exports = { getMarkets, WATCHLIST };
