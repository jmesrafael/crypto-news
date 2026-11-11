// Weekly roundup articles published by the outlets themselves ("week in review", "weekly recap" ...).
// Filled in from verified feeds; each entry: [source, url, category, titleFilter or null (= whole feed is roundups)]
// Verified 2026-11-11. Most hold ~10 items, so the daily publish run is frequent enough to catch each one.
const ROUNDUP_FEEDS = [
  ['Bitcoin.com', 'https://news.bitcoin.com/opinion-and-analysis/feed/', 'crypto', /week in review/i],
  ['Bitcoin.com', 'https://news.bitcoin.com/market-updates/feed/', 'crypto', /^weekly report/i],
  ['Cointelegraph', 'https://cointelegraph.com/rss/tag/bitcoin', 'crypto', /things to know in bitcoin this week/i],
  ['Bitfinex Alpha', 'https://blog.bitfinex.com/category/bitfinex-alpha/feed/', 'crypto', null],
  ['Seeking Alpha', 'https://seekingalpha.com/tag/wall-st-breakfast.xml', 'markets', /week ahead|moved markets this week/i],
  ['FXStreet', 'https://www.fxstreet.com/rss/analysis', 'markets', /weekly forecast|upcoming week/i],
  ['The Verge Installer', 'https://www.theverge.com/rss/installer-newsletter/index.xml', 'tech', null],
  ["O'Reilly Radar", 'https://www.oreilly.com/radar/feed/', 'ai', /^this week in ai/i],
  ['TheSequence', 'https://thesequence.substack.com/feed', 'ai', /(last|this) week in ai/i],
];

async function getRoundups() {
  if (!ROUNDUP_FEEDS.length) return [];
  const { parseFeed } = require('./news');
  const cutoff = Date.now() - 10 * 86400e3;
  const lists = await Promise.all(ROUNDUP_FEEDS.map(async ([source, url, category, re]) => {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (news-reader)' }, signal: AbortSignal.timeout(10000) });
      if (!res.ok) return [];
      return parseFeed(source, category, await res.text()).filter(i => (!re || re.test(i.title)) && i.time > cutoff).slice(0, 2);
    } catch { return []; }
  }));
  return lists.flat().sort((a, b) => b.time - a.time)
    .map(({ source, category, title, summary, link, image, time }) => ({ source, category, title, summary, link, image, time }));
}

module.exports = { getRoundups, ROUNDUP_FEEDS };
