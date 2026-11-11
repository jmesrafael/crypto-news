// Shared news logic: feeds, RSS parsing, keyword sentiment.


const FEEDS = [
  ['Cointelegraph', 'https://cointelegraph.com/rss'],
  ['CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'],
  ['Decrypt', 'https://decrypt.co/feed'],
  ['The Block', 'https://www.theblock.co/rss.xml'],
  ['CryptoSlate', 'https://cryptoslate.com/feed/'],
  ['Cryptonews', 'https://cryptonews.com/news/feed/'],
  ['Bitcoin.com', 'https://news.bitcoin.com/feed/'],
  ['NewsBTC', 'https://www.newsbtc.com/feed/'],
  ['U.Today', 'https://u.today/rss'],
  ['BeInCrypto', 'https://beincrypto.com/feed/'],
  ['CryptoPotato', 'https://cryptopotato.com/feed/'],
];

// ---------- sentiment lexicon (regex, weight). Phrases are checked before single words.
const BULL = [
  [/all[- ]time high|\bath\b|record high/, 3], [/etf (approv|inflow)|approves? .*etf/, 3],
  [/\binflows?\b/, 2], [/rate cuts?|cuts? rates|dovish/, 2], [/short squeeze/, 2],
  [/\b(surg|soar|rall|skyrocket|spik)(e|es|ed|ing|ies|ied|y)\b/, 2], [/\bbreak(s|ing)? out\b|breakout/, 2],
  [/\bbullish\b/, 2], [/\b(explod\w*|moon\w*|parabolic)\b/, 2], [/\b(jump|climb|gain|rebound|recover|rise|rises|rose|rising|up)(s|ed|ing)?\b/, 1],
  [/\b(buy|buys|bought|accumulat\w*|adds? \d|purchases?)\b/, 1], [/\b(adopt\w*|partnership|partners with|integrat\w*)\b/, 1],
  [/\b(launch\w*|upgrade\w*|mainnet|listing|lists)\b/, 1], [/\b(approv\w*|greenlight\w*|legaliz\w*|clarity)\b/, 1],
  [/\b(resume[sd]?|restore[sd]?|reopen\w*)\b/, 1], [/\b(dismiss\w*|drops? (the )?(case|lawsuit|charges)|wins?)\b/, 2],
  [/\b(strategic reserve|treasury)\b/, 1], [/\binstitutional\b/, 1], [/\bcommit\w* \$/, 1],
];
const BEAR = [
  [/\b(hack\w*|exploit\w*|drain\w*|stolen|theft|thefts|breach\w*|hijack\w*|attack\w*)\b/, 3],
  [/\b(crash\w*|plung\w*|plummet\w*|collaps\w*|tank\w*|capitulat\w*)\b/, 3],
  [/\b(liquidat\w*|sell-?off|dump\w*|outflows?)\b/, 2], [/rate hikes?|hikes? rates|hawkish|hot (us )?inflation/, 2],
  [/\b(bankrupt\w*|insolven\w*|depeg\w*|rug ?pull|ponzi|fraud\w*|scam\w*)\b/, 3],
  [/\b(sue[sd]?|lawsuit|charges?|charged|indict\w*|arrest\w*|crackdown|ban|bans|banned|fine[sd]?|penalt\w*|probe)\b/, 2],
  [/\b(halt\w*|suspend\w*|freez\w*|delist\w*|outage|bug|vulnerab\w*|emergency)\b/, 2],
  [/\bhik(e|es|ed|ing)\b/, 2], [/\b(bleed\w*|sell(s|ing)?|sale|sold|unlock\w*|selling pressure)\b/, 1],
  [/\bbearish\b/, 2], [/\b(drop|fall|falls|fell|slump|slide|slid|decline|dip|loss|losses|down|lower|sink|sank)(s|ed|ing)?\b/, 1],
  [/\b(warn\w*|fear\w*|risk\w*|concern\w*|pressure)\b/, 1],
];
const ASSETS = [
  ['BTC', /\b(bitcoin|btc)\b/], ['ETH', /\b(ethereum|ether|eth)\b/], ['SOL', /\b(solana|sol)\b/],
  ['XRP', /\b(xrp|ripple)\b/], ['BNB', /\b(bnb|binance coin)\b/], ['DOGE', /\b(dogecoin|doge)\b/],
  ['ADA', /\b(cardano|ada)\b/], ['AVAX', /\b(avalanche|avax)\b/], ['LINK', /\b(chainlink|link token)\b/],
  ['TON', /\b(toncoin|ton)\b/], ['SUI', /\bsui\b/], ['HYPE', /\b(hyperliquid|hype)\b/],
  ['USDT/USDC', /\b(stablecoins?|tether|usdt|usdc)\b/],
];

function score(text, weight) {
  let bull = 0, bear = 0;
  const hits = [];
  for (const [re, w] of BULL) { const m = text.match(re); if (m) { bull += w * weight; hits.push('+' + m[0]); } }
  for (const [re, w] of BEAR) { const m = text.match(re); if (m) { bear += w * weight; hits.push('-' + m[0]); } }
  return { bull, bear, hits };
}

function analyze(title, summary) {
  const t = score(title.toLowerCase(), 2);
  const s = score(summary.toLowerCase().slice(0, 400), 1);
  const net = t.bull + s.bull - (t.bear + s.bear);
  const total = t.bull + s.bull + t.bear + s.bear;
  const bias = net >= 2 ? 'LONG' : net <= -2 ? 'SHORT' : 'NEUTRAL';
  const strength = total ? Math.min(100, Math.round((Math.abs(net) / total) * 60 + Math.min(Math.abs(net), 10) * 4)) : 0;
  const all = (title + ' ' + summary).toLowerCase();
  const assets = ASSETS.filter(([, re]) => re.test(all)).map(([a]) => a);
  return { bias, score: net, strength, keywords: [...new Set(t.hits)].slice(0, 6), assets };
}

// ---------- RSS parsing
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
const decode = s => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const cdata = s => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
const tag = (x, t) => cdata((x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, 'i')) || [])[1]).trim();
const strip = s => decode(decode(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function image(x) {
  const raw = cdata(x);
  const m = raw.match(/<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i)
    || raw.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/i)
    || raw.match(/<enclosure[^>]*type="image[^"]*"[^>]*url="([^"]+)"/i)
    || decode(raw).match(/<img[^>]*src="([^"]+)"/i);
  return m ? decode(m[1]) : null;
}

function parse(source, xml) {
  return [...xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/g)].map(([, x]) => {
    const title = strip(tag(x, 'title'));
    const summary = strip(tag(x, 'description')).slice(0, 300);
    const link = decode(tag(x, 'link') || (x.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '').split('?utm_')[0];
    const date = new Date(tag(x, 'pubDate') || tag(x, 'dc:date') || Date.now());
    return { source, title, summary, link, image: image(x), time: isNaN(date) ? Date.now() : date.getTime(), ...analyze(title, summary) };
  }).filter(i => i.title && i.link);
}

// ---------- fetch + merge
async function fetchFeed([name, url]) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8_000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (news-reader)' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const items = parse(name, await res.text());
    return { name, ok: true, count: items.length, items };
  } catch (e) {
    return { name, ok: false, error: e.name === 'AbortError' ? 'timeout' : e.message, items: [] };
  } finally { clearTimeout(timer); }
}

const norm = t => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 3).slice(0, 8).join(' ');

async function getNews() {
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const seen = new Map();
  for (const r of results) for (const it of r.items) {
    const k = norm(it.title);
    if (!seen.has(k) || seen.get(k).time > it.time) seen.set(k, it); // keep earliest report
  }
  const cutoff = Date.now() - 3 * 86400_000;
  const items = [...seen.values()].filter(i => i.time > cutoff && i.time <= Date.now() + 600_000).sort((a, b) => b.time - a.time);
  return { updated: Date.now(), items, sources: results.map(({ name, ok, count, error }) => ({ name, ok, count, error })) };
}

module.exports = { getNews, analyze, FEEDS };
