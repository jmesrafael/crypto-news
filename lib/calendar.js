// Economic calendar + countdown events.
//  - This week's events: ForexFactory's free weekly JSON (authoritative times, forecast/previous/actual).
//  - Further-out key dates: data/events.json (hand-maintained; edit freely).
//  - Bitcoin halving: estimated live from block height (mempool.space).
const fs = require('fs');
const path = require('path');

const KEY_TYPES = [
  ['CPI', /\bcpi\b/i], ['FOMC', /fomc|federal funds rate|fed (interest )?rate decision/i], ['NFP', /non-farm|nonfarm/i],
  ['PPI', /\bppi\b/i], ['GDP', /\bgdp\b/i], ['PCE', /\bpce\b/i], ['Jobless Claims', /jobless claims/i], ['Retail Sales', /retail sales/i],
  ['Fed Speak', /powell|fomc member|fed chair/i], ['Unemployment', /unemployment rate/i],
];
const typeOf = title => (KEY_TYPES.find(([, re]) => re.test(title)) || [null])[0];

let last = null;

async function getJSON(url, ms = 8000) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (news-reader)' }, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

const WEEK_FILE = path.join(__dirname, '..', 'data', 'calendar-week.json');

// Raw ForexFactory week; falls back to the copy saved by the daily job (FF rate-limits hard: HTTP 429).
async function rawWeek() {
  try { return await getJSON('https://nfs.faireconomy.media/ff_calendar_thisweek.json'); }
  catch (e) {
    try { return JSON.parse(fs.readFileSync(WEEK_FILE, 'utf8')); } catch { throw e; }
  }
}

async function week() {
  const d = await rawWeek();
  return d.map(e => ({
    title: e.title, country: e.country, impact: e.impact, time: Date.parse(e.date),
    forecast: e.forecast || null, previous: e.previous || null, actual: e.actual || null, type: typeOf(e.title),
  })).filter(e => !isNaN(e.time)).sort((a, b) => a.time - b.time);
}

async function halving() {
  const NEXT = 1_050_000; // 5th halving block height
  const [height, adj] = await Promise.all([
    getJSON('https://mempool.space/api/blocks/tip/height'),
    getJSON('https://mempool.space/api/v1/difficulty-adjustment').catch(() => ({ timeAvg: 600_000 })),
  ]);
  const blocksLeft = NEXT - height;
  return {
    title: 'Bitcoin Halving', type: 'Halving', country: 'BTC', impact: 'High', estimated: true,
    time: Date.now() + blocksLeft * (adj.timeAvg || 600_000), note: `${blocksLeft.toLocaleString('en-US')} blocks left (height ${height.toLocaleString('en-US')})`,
  };
}

function curated() {
  try {
    const list = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'events.json'), 'utf8'));
    return list.map(e => ({ impact: 'High', country: 'USD', ...e, time: Date.parse(e.date), curated: true })).filter(e => !isNaN(e.time));
  } catch { return []; }
}

async function getCalendar() {
  const [w, h] = await Promise.allSettled([week(), halving()]);
  const events = w.status === 'fulfilled' ? w.value : (last?.week || []);
  const halv = h.status === 'fulfilled' ? h.value : (last?.upcoming || []).find(e => e.type === 'Halving');
  const now = Date.now();

  // Countdowns: high-impact key releases from this week + curated future dates + halving. One entry per type+day.
  const fromWeek = events.filter(e => e.impact === 'High' && e.type && (e.country === 'USD' || e.type === 'FOMC'));
  const seen = new Set();
  const upcoming = [...fromWeek, ...curated(), ...(halv ? [halv] : [])]
    .filter(e => e.time > now - 2 * 3600e3)
    .sort((a, b) => a.time - b.time)
    .filter(e => { const k = e.type + new Date(e.time).toISOString().slice(0, 10); if (seen.has(k)) return false; seen.add(k); return true; });

  last = { updated: now, week: events, upcoming };
  return last;
}

// Used by scripts/pulse.js to refresh the saved copy.
async function saveWeek() {
  const d = await getJSON('https://nfs.faireconomy.media/ff_calendar_thisweek.json', 15000);
  fs.writeFileSync(WEEK_FILE, JSON.stringify(d));
  // Permanent record of USD high-impact events (name + unix seconds) for the news-gate shadow test.
  const HIST = path.join(__dirname, '..', 'data', 'events-history.json');
  let hist = [];
  try { hist = JSON.parse(fs.readFileSync(HIST, 'utf8')); } catch {}
  const key = (e) => e.name + '|' + e.t;
  const have = new Set(hist.map(key));
  for (const e of d) {
    const t = Math.round(Date.parse(e.date) / 1000);
    if (e.country === 'USD' && e.impact === 'High' && !isNaN(t) && !have.has(key({ name: e.title, t }))) hist.push({ name: e.title, t });
  }
  hist.sort((a, b) => a.t - b.t);
  fs.writeFileSync(HIST, JSON.stringify(hist));
  return d.length;
}

module.exports = { getCalendar, saveWeek };
