// Highlights pipeline (run by GitHub Actions, or by hand).
//   node scripts/pulse.js collect   -> pull all feeds and append to .cache/history.json (rolling 8 days)
//   node scripts/pulse.js publish   -> build data/highlights.json + data/briefs/<date>.json from history + data/pinned.json
//   node scripts/pulse.js all       -> both
const fs = require('fs');
const path = require('path');
const { getNews, analyze } = require('../lib/news');
const { buildHighlights } = require('../lib/highlights');
const { getRoundups } = require('../lib/roundups');
const { saveWeek } = require('../lib/calendar');

const ROOT = path.join(__dirname, '..');
const HISTORY = path.join(ROOT, '.cache', 'history.json');
const DATA = path.join(ROOT, 'data');
const KEEP_MS = 8 * 86400e3;

const readJSON = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
const writeJSON = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 1)); };
const phtDate = (t = Date.now()) => new Date(t + 8 * 3600e3).toISOString().slice(0, 10); // Asia/Manila is UTC+8, no DST

async function collect() {
  const history = readJSON(HISTORY, []);
  const { items, sources } = await getNews();
  const byLink = new Map(history.map(i => [i.link, i]));
  let added = 0;
  for (const { source, category, title, summary, link, image, time } of items) {
    if (!byLink.has(link)) added++;
    byLink.set(link, { source, category, title, summary, link, image, time: byLink.get(link)?.time ?? time });
  }
  const cutoff = Date.now() - KEEP_MS;
  const kept = [...byLink.values()].filter(i => i.time > cutoff).sort((a, b) => b.time - a.time);
  writeJSON(HISTORY, kept);
  const bad = sources.filter(s => !s.ok).map(s => s.name);
  console.log(`collect: +${added} new, ${kept.length} in history` + (bad.length ? ` | failed: ${bad.join(', ')}` : ''));
}

async function publish() {
  const history = readJSON(HISTORY, []).map(i => ({ ...i, ...analyze(i.title, i.summary || '') }));
  const now = Date.now();
  const highlights = buildHighlights(history, { days: 7, limit: 12, now });

  // Manual pins: data/pinned.json — shown for 7 days from their date unless "until" is set.
  const pinned = readJSON(path.join(DATA, 'pinned.json'), []).filter(p => {
    const until = p.until ? Date.parse(p.until) : Date.parse(p.date || 0) + 7 * 86400e3;
    return p.title && p.link && until > now;
  }).map(p => ({ ...analyze(p.title, p.summary || ''), ...p, pinned: true }));

  try { console.log(`calendar: saved ${await saveWeek()} events`); } catch (e) { console.error('calendar save failed (keeping old copy):', e.message); }

  let roundups = [];
  try { roundups = await getRoundups(); } catch (e) { console.error('roundups failed:', e.message); }

  const date = phtDate(now);
  const out = {
    generated: now, date, window: { from: now - 7 * 86400e3, to: now },
    stats: { stories: history.filter(i => i.time > now - 7 * 86400e3).length, sources: new Set(history.map(i => i.source)).size },
    pinned, highlights, roundups,
  };
  writeJSON(path.join(DATA, 'highlights.json'), out);
  writeJSON(path.join(DATA, 'briefs', date + '.json'), out);
  const index = new Set(readJSON(path.join(DATA, 'briefs', 'index.json'), []));
  index.add(date);
  writeJSON(path.join(DATA, 'briefs', 'index.json'), [...index].sort().reverse().slice(0, 60));
  console.log(`publish ${date}: ${highlights.length} highlights, ${pinned.length} pinned, ${roundups.length} roundups from ${out.stats.stories} stories`);
}

(async () => {
  const cmd = process.argv[2] || 'all';
  if (cmd === 'collect' || cmd === 'all') await collect();
  if (cmd === 'publish' || cmd === 'all') await publish();
})().catch(e => { console.error(e); process.exit(1); });
