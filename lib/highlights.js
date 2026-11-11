// Weekly highlights without AI: group a week of headlines into stories by shared rare words,
// then rank stories by how many different outlets covered them, impact topics and staying power.
const STOP = new Set(`the a an and or but of to in on at for from by with as is are was were be been has have had it its this that these those
into over after before amid about up down out new says said say will would could should may might can than then not no just more most
what why how who when where which while week today year years day days report reports reported per via also first last next amid
price prices market markets crypto cryptocurrency news update live analysis here heres why price prediction according could
million billion trillion percent says amid against under near just still back like gets set sees seen hits hit makes make big top`.split(/\s+/));

const PREFERRED = ['CoinDesk', 'Cointelegraph', 'The Block', 'Decrypt', 'CNBC', 'BBC World', 'BBC Business', 'WSJ Markets', 'MarketWatch', 'TechCrunch', 'The Verge', 'Al Jazeera'];

function tokens(title) {
  const out = new Set();
  for (let w of title.toLowerCase().replace(/[’']s\b/g, '').replace(/[^a-z0-9$.%\- ]/g, ' ').split(/\s+/)) {
    w = w.replace(/^[-.]+|[-.]+$/g, '');
    if (!w || STOP.has(w)) continue;
    if (w.length < 3 && !/^\$?\d/.test(w)) continue;
    if (w.length > 4 && /[^s]s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1); // crude plural strip
    out.add(w);
  }
  return out;
}

function buildHighlights(items, { days = 7, limit = 12, minSources = 3, now = Date.now() } = {}) {
  const pool = items.filter(i => i.time > now - days * 86400e3 && i.time <= now + 3600e3)
    .map(i => ({ ...i, tok: tokens(i.title) })).filter(i => i.tok.size >= 2)
    .sort((a, b) => a.time - b.time);
  const N = pool.length || 1;
  const df = new Map();
  for (const i of pool) for (const t of i.tok) df.set(t, (df.get(t) || 0) + 1);
  const idf = t => Math.log(N / (df.get(t) || 1));
  const MAX_DF = Math.max(8, N * 0.06); // words in >6% of headlines are too generic to link stories

  const clusters = [];
  for (const it of pool) {
    const strong = [...it.tok].filter(t => (df.get(t) || 0) >= 2 && df.get(t) <= MAX_DF);
    const itemW = strong.reduce((s, t) => s + idf(t), 0);
    if (!strong.length) continue;
    let best = null, bestSim = 0;
    for (const c of clusters) {
      if (it.time - c.last > 4 * 86400e3) continue; // story went cold
      const core = c.core();
      const shared = strong.filter(t => core.has(t));
      if (shared.length < 2) continue;
      const sim = shared.reduce((s, t) => s + idf(t), 0) / itemW;
      if (sim > bestSim) { bestSim = sim; best = c; }
    }
    if (best && bestSim >= 0.45) best.add(it, strong);
    else clusters.push(newCluster(it, strong));
  }

  // Merge pass: two groups whose core words overlap strongly are the same story told differently.
  const coreW = s => [...s].reduce((a, t) => a + idf(t), 0);
  for (let merged = true; merged;) {
    merged = false;
    outer: for (let a = 0; a < clusters.length; a++) for (let b = a + 1; b < clusters.length; b++) {
      const A = clusters[a].core(), B = clusters[b].core();
      const shared = [...A].filter(t => B.has(t));
      if (shared.length < 2) continue;
      if (coreW(shared) / Math.min(coreW(A), coreW(B)) >= 0.5) {
        for (const it of clusters[b].items) clusters[a].add(it, [...it.tok].filter(t => (df.get(t) || 0) >= 2 && df.get(t) <= MAX_DF));
        clusters.splice(b, 1); merged = true; break outer;
      }
    }
  }

  const scored = clusters.map(c => {
    const sources = [...new Set(c.items.map(i => i.source))];
    const spanDays = (c.last - c.first) / 86400e3;
    const impact = c.items.some(i => i.impact);
    const net = c.items.reduce((s, i) => s + (i.score || 0), 0);
    const score = sources.length * 3 + c.items.length + (impact ? 4 : 0) + Math.min(spanDays, 4) * 1.5 + Math.min(Math.abs(net) / 6, 4);
    return { c, sources, spanDays, impact, net, score };
  }).filter(x => x.sources.length >= minSources).sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ c, sources, impact, net, score }) => {
    const core = c.core();
    const rep = c.items.slice().sort((a, b) =>
      overlap(b, core) - overlap(a, core) || rank(b.source) - rank(a.source) || a.time - b.time)[0];
    const image = (rep.image ? rep : c.items.find(i => i.image) || rep).image || null;
    const counts = { LONG: 0, SHORT: 0, NEUTRAL: 0 };
    c.items.forEach(i => counts[i.bias || 'NEUTRAL']++);
    const bias = net >= 4 && counts.LONG >= counts.SHORT ? 'LONG' : net <= -4 && counts.SHORT >= counts.LONG ? 'SHORT' : 'NEUTRAL';
    const cats = {};
    c.items.forEach(i => cats[i.category] = (cats[i.category] || 0) + 1);
    return {
      id: slug(rep.title),
      title: rep.title, summary: rep.summary || '', link: rep.link, source: rep.source, image,
      category: Object.entries(cats).sort((a, b) => b[1] - a[1])[0][0],
      firstSeen: c.first, lastSeen: c.last, sources, count: c.items.length,
      bias, strength: Math.min(100, Math.round(Math.abs(net) * 3)), sentimentCounts: counts, impact, score: Math.round(score * 10) / 10,
      assets: [...new Set(c.items.flatMap(i => i.assets || []))].slice(0, 5),
      keywords: [...core].sort((a, b) => idf(b) - idf(a)).slice(0, 6),
      related: c.items.filter(i => i !== rep).sort((a, b) => b.time - a.time).slice(0, 6)
        .map(({ title, link, source, time, bias, image }) => ({ title, link, source, time, bias, image })),
    };
  });
}

function newCluster(it, strong) {
  const c = {
    items: [it], counts: new Map(strong.map(t => [t, 1])), first: it.time, last: it.time,
    add(i, s) { this.items.push(i); for (const t of s) this.counts.set(t, (this.counts.get(t) || 0) + 1); this.last = Math.max(this.last, i.time); this._core = null; },
    core() { // words shared by at least ~35% of the story's headlines (all words while the story is small)
      if (this._core) return this._core;
      const n = this.items.length, min = n <= 2 ? 1 : Math.ceil(n * 0.35);
      return (this._core = new Set([...this.counts].filter(([, k]) => k >= min).map(([t]) => t)));
    },
  };
  return c;
}
const overlap = (i, core) => [...i.tok].filter(t => core.has(t)).length;
const rank = s => { const k = PREFERRED.indexOf(s); return k < 0 ? 0 : PREFERRED.length - k; };
const slug = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60).replace(/-$/, '');

module.exports = { buildHighlights, tokens };
