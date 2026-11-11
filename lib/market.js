// Market strip: crypto prices (CoinGecko), macro tickers (Yahoo chart API), Fear & Greed (alternative.me).
// All free and keyless. Each source fails independently.
const COINS = [['BTC', 'bitcoin'], ['ETH', 'ethereum'], ['SOL', 'solana'], ['XRP', 'ripple'], ['BNB', 'binancecoin'], ['DOGE', 'dogecoin']];
const MACRO = [['S&P 500', '^GSPC'], ['Nasdaq', '^IXIC'], ['DXY', 'DX-Y.NYB'], ['US 10Y', '^TNX'], ['Gold', 'GC=F'], ['Oil', 'CL=F']];

const get = async url => {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (news-reader)' }, signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
};

async function crypto() {
  const ids = COINS.map(c => c[1]).join(',');
  const d = await get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
  return COINS.filter(([, id]) => d[id]).map(([sym, id]) => ({ sym, price: d[id].usd, change: d[id].usd_24h_change }));
}

async function macro() {
  const out = await Promise.all(MACRO.map(async ([sym, ticker]) => {
    try {
      const d = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d`);
      const m = d.chart.result[0].meta;
      const prev = m.chartPreviousClose ?? m.previousClose;
      const closes = (d.chart.result[0].indicators.quote[0].close || []).filter(x => x != null);
      const prior = closes.length > 1 ? closes[closes.length - 2] : prev;
      return { sym, price: m.regularMarketPrice, change: prior ? (m.regularMarketPrice / prior - 1) * 100 : null };
    } catch { return null; }
  }));
  return out.filter(Boolean);
}

async function fearGreed() {
  const d = await get('https://api.alternative.me/fng/?limit=2');
  const [now, prev] = d.data;
  return { value: +now.value, label: now.value_classification, prev: prev ? +prev.value : null };
}

async function getMarket() {
  const [c, m, f] = await Promise.allSettled([crypto(), macro(), fearGreed()]);
  return {
    updated: Date.now(),
    crypto: c.status === 'fulfilled' ? c.value : [],
    macro: m.status === 'fulfilled' ? m.value : [],
    fearGreed: f.status === 'fulfilled' ? f.value : null,
  };
}

module.exports = { getMarket };
