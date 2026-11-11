// AI / tech / security side data (all free, keyless):
//  - Hacker News front page (viral signal: points + comments)
//  - DeFiLlama hacks (crypto exploits with $ amounts)
//  - CISA Known Exploited Vulnerabilities (actively exploited CVEs)
//  - Nasdaq IPO calendar + earnings calendar (reminders)
const UA = { 'User-Agent': 'Mozilla/5.0 (news-reader)', Accept: 'application/json' };
// Earnings worth a reminder even below the mega-cap cut-off (crypto-linked / AI bellwethers).
const EARNINGS_WATCH = new Set(['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'META', 'TSLA', 'AVGO', 'AMD', 'ORCL', 'CRM', 'PLTR', 'ARM', 'SMCI', 'MU', 'TSM', 'ADBE', 'SNOW', 'NFLX',
  'COIN', 'MSTR', 'HOOD', 'CRCL', 'MARA', 'RIOT', 'IREN', 'CLSK', 'GLXY', 'BLSH', 'SQ', 'XYZ', 'PYPL']);
const MEGA_CAP = 150e9;

const getJSON = async (url, ms = 9000) => {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
};
const money = s => { const n = parseFloat(String(s || '').replace(/[$,]/g, '')); return isNaN(n) ? null : n; };
const usDate = s => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? Date.UTC(+m[3], m[1] - 1, +m[2], 14, 30) : null; }; // 9:30 ET

async function hn() {
  const d = await getJSON('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=40');
  return d.hits.map(h => ({
    title: h.title, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    hnUrl: `https://news.ycombinator.com/item?id=${h.objectID}`, domain: h.url ? new URL(h.url).hostname.replace(/^www\./, '') : 'news.ycombinator.com',
    points: h.points || 0, comments: h.num_comments || 0, time: (h.created_at_i || 0) * 1000,
  })).sort((a, b) => b.points - a.points);
}

async function hacks() {
  const d = await getJSON('https://api.llama.fi/hacks', 12000);
  const since = Date.now() - 30 * 86400e3;
  const recent = d.filter(h => h.date * 1000 > since).sort((a, b) => b.date - a.date);
  return {
    total30d: recent.reduce((s, h) => s + (h.amount || 0), 0),
    count30d: recent.length,
    items: recent.slice(0, 25).map(h => ({
      name: h.name, amount: h.amount, chains: h.chain || [], technique: h.technique, classification: h.classification,
      time: h.date * 1000, bridge: !!h.bridgeHack, returned: h.returnedFunds || null, source: h.source || null,
    })),
  };
}

async function kev() {
  const d = await getJSON('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', 15000);
  return d.vulnerabilities.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)).slice(0, 15).map(v => ({
    cve: v.cveID, vendor: v.vendorProject, product: v.product, name: v.vulnerabilityName, description: v.shortDescription,
    added: Date.parse(v.dateAdded), due: Date.parse(v.dueDate), ransomware: v.knownRansomwareCampaignUse === 'Known',
    link: `https://nvd.nist.gov/vuln/detail/${v.cveID}`,
  }));
}

async function ipos() {
  const now = new Date();
  const months = [0, 1].map(k => { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + k, 1)); return d.toISOString().slice(0, 7); });
  const out = [];
  for (const m of months) {
    const d = (await getJSON(`https://api.nasdaq.com/api/ipo/calendar?date=${m}`)).data || {};
    for (const r of d.upcoming?.upcomingTable?.rows || []) out.push({
      symbol: r.proposedTickerSymbol, company: r.companyName, exchange: r.proposedExchange, price: r.proposedSharePrice,
      shares: r.sharesOffered, value: money(r.dollarValueOfSharesOffered), time: usDate(r.expectedPriceDate), status: 'Upcoming',
    });
    for (const r of d.priced?.rows || []) out.push({
      symbol: r.proposedTickerSymbol, company: r.companyName, exchange: r.proposedExchange, price: r.proposedSharePrice,
      shares: r.sharesOffered, value: money(r.dollarValueOfSharesOffered), time: usDate(r.pricedDate), status: 'Priced',
    });
  }
  const seen = new Set();
  return out.filter(i => i.time && i.time > Date.now() - 7 * 86400e3 && !seen.has(i.symbol + i.status) && seen.add(i.symbol + i.status))
    .sort((a, b) => a.time - b.time);
}

async function earnings() {
  const days = [];
  for (let k = 0; days.length < 10 && k < 16; k++) {
    const d = new Date(Date.now() + k * 86400e3);
    if (d.getUTCDay() % 6) days.push(d.toISOString().slice(0, 10)); // weekdays only
  }
  const lists = await Promise.all(days.map(async day => {
    try {
      const d = await getJSON(`https://api.nasdaq.com/api/calendar/earnings?date=${day}`);
      return (d.data?.rows || []).map(r => ({ day, ...r }));
    } catch { return []; }
  }));
  return lists.flat().map(r => ({
    symbol: r.symbol, name: r.name, marketCap: money(r.marketCap), epsForecast: r.epsForecast || null,
    session: /pre/.test(r.time) ? 'pre-market' : /after/.test(r.time) ? 'after-hours' : 'time TBA',
    // pre-market ≈ 8:00 ET, after-hours ≈ 16:05 ET (EST = UTC-5 in Nov–Mar)
    time: Date.parse(r.day + (/pre/.test(r.time) ? 'T13:00:00Z' : /after/.test(r.time) ? 'T21:05:00Z' : 'T14:30:00Z')),
  })).filter(r => r.marketCap >= MEGA_CAP || EARNINGS_WATCH.has(r.symbol)).sort((a, b) => a.time - b.time);
}

let last = {};
async function getTech() {
  const parts = { hn, hacks, kev, ipos, earnings };
  const keys = Object.keys(parts);
  const res = await Promise.allSettled(keys.map(k => parts[k]()));
  const out = { updated: Date.now(), errors: [] };
  res.forEach((r, i) => {
    const k = keys[i];
    if (r.status === 'fulfilled') out[k] = r.value;
    else { out[k] = last[k] ?? null; out.errors.push(`${k}: ${r.reason && r.reason.message}`); }
  });
  last = out;
  return out;
}

module.exports = { getTech };
