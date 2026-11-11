// Shared news logic: feeds, RSS/Atom parsing, keyword sentiment, optional persistent store.
const { kvGet, kvSet, hasKV } = require('./store');
const { buildHighlights } = require('./highlights');

// [source, url, category]
const FEEDS = [
  // crypto
  ['Cointelegraph', 'https://cointelegraph.com/rss', 'crypto'],
  ['CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/', 'crypto'],
  ['Decrypt', 'https://decrypt.co/feed', 'crypto'],
  ['The Block', 'https://www.theblock.co/rss.xml', 'crypto'],
  ['CryptoSlate', 'https://cryptoslate.com/feed/', 'crypto'],
  ['Cryptonews', 'https://cryptonews.com/news/feed/', 'crypto'],
  ['Bitcoin.com', 'https://news.bitcoin.com/feed/', 'crypto'],
  ['NewsBTC', 'https://www.newsbtc.com/feed/', 'crypto'],
  ['U.Today', 'https://u.today/rss', 'crypto'],
  ['BeInCrypto', 'https://beincrypto.com/feed/', 'crypto'],
  ['CryptoPotato', 'https://cryptopotato.com/feed/', 'crypto'],
  // markets
  ['CNBC', 'https://www.cnbc.com/id/100003114/device/rss/rss.html', 'markets'],
  ['MarketWatch', 'https://feeds.content.dowjones.io/public/rss/mw_topstories', 'markets'],
  ['MarketWatch Pulse', 'https://feeds.content.dowjones.io/public/rss/mw_marketpulse', 'markets'],
  ['WSJ Markets', 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', 'markets'],
  ['Investing.com', 'https://www.investing.com/rss/news.rss', 'markets'],
  ['FXStreet', 'https://www.fxstreet.com/rss/news', 'markets'],
  ['BBC Business', 'https://feeds.bbci.co.uk/news/business/rss.xml', 'markets'],
  // macro / central banks
  ['Federal Reserve', 'https://www.federalreserve.gov/feeds/press_all.xml', 'macro'],
  ['ECB', 'https://www.ecb.europa.eu/rss/press.html', 'macro'],
  ['CNBC Economy', 'https://www.cnbc.com/id/20910258/device/rss/rss.html', 'macro'],
  // tech
  ['TechCrunch', 'https://techcrunch.com/feed/', 'tech'],
  ['The Verge', 'https://www.theverge.com/rss/index.xml', 'tech'],
  ['Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index', 'tech'],
  ['CNBC Tech', 'https://www.cnbc.com/id/19854910/device/rss/rss.html', 'tech'],
  // ai
  ['TechCrunch AI', 'https://techcrunch.com/category/artificial-intelligence/feed/', 'ai'],
  ['The Verge AI', 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 'ai'],
  // banking / finance
  ['Finextra', 'https://www.finextra.com/rss/headlines.aspx', 'banking'],
  ['Banking Dive', 'https://www.bankingdive.com/feeds/news/', 'banking'],
  ['Payments Dive', 'https://www.paymentsdive.com/feeds/news/', 'banking'],
  ['CNBC Finance', 'https://www.cnbc.com/id/10000664/device/rss/rss.html', 'banking'],
  // world / geopolitics
  ['BBC World', 'https://feeds.bbci.co.uk/news/world/rss.xml', 'world'],
  ['Al Jazeera', 'https://www.aljazeera.com/xml/rss/all.xml', 'world'],
  // ai — labs & research (Anthropic has no RSS, so a Google News search covers it)
  ['OpenAI', 'https://openai.com/news/rss.xml', 'ai'],
  ['Google AI', 'https://blog.google/technology/ai/rss/', 'ai'],
  ['NVIDIA Blog', 'https://blogs.nvidia.com/feed/', 'ai'],
  ['Hugging Face', 'https://huggingface.co/blog/feed.xml', 'ai'],
  ['Wired AI', 'https://www.wired.com/feed/tag/ai/latest/rss', 'ai'],
  ['Google News', 'https://news.google.com/rss/search?q=Anthropic+OR+Claude+OR+OpenAI+OR+%22Google+DeepMind%22+OR+xAI+when:2d&hl=en-US&gl=US&ceid=US:en', 'ai'],
  // tech extras
  ['Engadget', 'https://www.engadget.com/rss.xml', 'tech'],
  ['Google News', 'https://news.google.com/rss/search?q=IPO+(AI+OR+tech+OR+crypto+OR+Anthropic+OR+OpenAI+OR+SpaceX)+when:3d&hl=en-US&gl=US&ceid=US:en', 'tech'],
  // security / hacks
  ['The Hacker News', 'https://feeds.feedburner.com/TheHackersNews', 'security'],
  ['BleepingComputer', 'https://www.bleepingcomputer.com/feed/', 'security'],
  ['Krebs on Security', 'https://krebsonsecurity.com/feed/', 'security'],
  ['SecurityWeek', 'https://www.securityweek.com/feed/', 'security'],
  ['The Record', 'https://therecord.media/feed', 'security'],
  ['Dark Reading', 'https://www.darkreading.com/rss.xml', 'security'],
  ['Wired Security', 'https://www.wired.com/feed/category/security/latest/rss', 'security'],
];

const RETAIN_MS = 3 * 86400_000; // keep stories for 3 days
const PER_CATEGORY = { crypto: 300, default: 150 }; // newest N per category kept in the store / payload

// ---------- sentiment lexicon (regex, weight). LONG/SHORT = implied bias for crypto & risk assets.
const BULL = [
  [/all[- ]time high|\bath\b|record high/, 3], [/etf (approv|inflow)|approves? .*etf/, 3],
  [/\binflows?\b/, 2], [/rate cuts?|cuts? rates|dovish/, 2], [/short squeeze/, 2],
  [/inflation (cool|eas|slow|soft)\w*|(cooler|softer)[- ]than[- ]expected/, 3],
  [/\b(yields?|dollar) (fall|falls|fell|drop\w*|slide\w*|slip\w*|ease\w*|retreat\w*)\b/, 3],
  [/\b(risk-on|risk appetite (returns|improves))\b|(lower|cooler|softer) than expected/, 2],
  [/\b(ceasefire|truce|peace (deal|talks)|de-?escalat\w*)\b/, 2],
  [/\b(stimulus|quantitative easing|qe|liquidity injection|soft landing)\b/, 2],
  [/\bbeats? (estimates|expectations|forecasts)|tops? (estimates|expectations)|record (revenue|profit|earnings)/, 2],
  [/\b(surg|soar|rall|skyrocket|spik)(e|es|ed|ing|ies|ied|y)\b/, 2], [/\bbreak(s|ing)? out\b|breakout/, 2],
  [/\bbullish\b/, 2], [/\b(explod\w*|moon\w*|parabolic)\b/, 2],
  [/\b(jump|climb|gain|rebound|recover|rise|rises|rose|rising|up)(s|ed|ing)?\b/, 1],
  [/\b(buy|buys|bought|accumulat\w*|adds? \d|purchases?)\b/, 1], [/\b(adopt\w*|partnership|partners with|integrat\w*)\b/, 1],
  [/\b(launch\w*|upgrade\w*|mainnet|listing|lists)\b/, 1], [/\b(approv\w*|greenlight\w*|legaliz\w*|clarity)\b/, 1],
  [/\b(resume[sd]?|restore[sd]?|reopen\w*)\b/, 1], [/\b(dismiss\w*|drops? (the )?(case|lawsuit|charges)|wins?)\b/, 2],
  [/\b(strategic reserve|treasury)\b/, 1], [/\binstitutional\b/, 1], [/\bcommit\w* \$/, 1],
];
const BEAR = [
  [/\b(hack\w*|exploit\w*|drain\w*|stolen|theft|thefts|breach\w*|hijack\w*|attack\w*)\b/, 3],
  [/\b(crash\w*|plung\w*|plummet\w*|collaps\w*|tank\w*|capitulat\w*)\b/, 3],
  [/\b(yields?|dollar|dxy) (rise|rises|rose|surg\w*|jump\w*|climb\w*|spik\w*|soar\w*|rall\w*)\b/, 4],
  [/\b(consumer prices|producer prices|prices|cpi|ppi|pce|inflation|wages?) (rose|rise|rises|rising|jump\w*|climb\w*|accelerat\w*|heat\w*|surg\w*|spik\w*|tops?)\b|inflation (re-?accelerat|stays? (hot|sticky|high))\w*/, 5],
  [/\b(more|higher|hotter) than expected\b/, 2], [/\b(risk-off|defensive (stocks|names|sectors)|state of alert|flight to safety)\b/, 2],
  [/\boil (surg|soar|jump|spik)\w*/, 2], [/\bbank (run|failure|collapse)/, 3],
  [/\b(recession|stagflation|default\w*|downgrad\w*|layoffs?|job cuts)\b/, 2], [/\btariffs?\b/, 2],
  [/\b(war|missiles?|airstrikes?|invasion|sanction\w*|strikes on)\b|(?<!de-?)escalat\w*/, 2],
  [/\bmiss(es|ed)? (estimates|expectations|forecasts)|(hotter|stronger)[- ]than[- ]expected/, 2],
  [/\b(liquidat\w*|sell-?off|dump\w*|outflows?)\b/, 2], [/rate hikes?|hikes? rates|hawkish|hot (us )?inflation/, 2],
  [/\b(bankrupt\w*|insolven\w*|depeg\w*|rug ?pull|ponzi|fraud\w*|scam\w*)\b/, 3],
  [/\b(sue[sd]?|lawsuit|charges?|charged|indict\w*|arrest\w*|crackdown|ban|bans|banned|fine[sd]?|penalt\w*|probe)\b/, 2],
  [/\b(halt\w*|suspend\w*|freez\w*|delist\w*|outage|bug|vulnerab\w*|emergency)\b/, 2],
  [/\bhik(e|es|ed|ing)\b/, 2], [/\b(bleed\w*|sell(s|ing)?|sale|sold|unlock\w*|selling pressure)\b/, 1],
  [/\bbearish\b/, 2], [/\b(drop|fall|falls|fell|slump|slide|slid|decline|dip|loss|losses|down|lower|sink|sank)(s|ed|ing)?\b/, 1],
  [/\b(warn\w*|fear\w*|risk\w*|concern\w*|pressure)\b/, 1],
];
// Stories that tend to move the whole market.
const IMPACT = /\b(fed|fomc|powell|federal reserve|ecb|lagarde|boj|bank of japan|cpi|pce|inflation|jobs report|payrolls|nonfarm|unemployment|gdp|rate (hike|cut|decision)|interest rates?|tariffs?|sec|cftc|etf|treasur(y|ies)|yields?|recession|war|sanctions?|bankrupt\w*|blackrock|nvidia|opec|white house|trump|stablecoin (bill|law)|clarity act|genius act|strategic (bitcoin )?reserve)\b/;
const ASSETS = [
  ['BTC', /\b(bitcoin|btc)\b/], ['ETH', /\b(ethereum|ether|eth)\b/], ['SOL', /\b(solana|sol)\b/],
  ['XRP', /\b(xrp|ripple)\b/], ['BNB', /\b(bnb|binance coin)\b/], ['DOGE', /\b(dogecoin|doge)\b/],
  ['ADA', /\b(cardano|ada)\b/], ['AVAX', /\b(avalanche|avax)\b/], ['LINK', /\b(chainlink|link token)\b/],
  ['TON', /\b(toncoin|ton)\b/], ['SUI', /\bsui\b/], ['HYPE', /\b(hyperliquid|hype)\b/],
  ['ZEC', /\b(zcash|zec)\b/], ['NEAR', /\b(near protocol|near ai|near foundation|near token|near price)\b|\$near\b/], ['GALA', /\b(gala games|gala)\b/],
  ['USDT/USDC', /\b(stablecoins?|tether|usdt|usdc)\b/],
  ['STOCKS', /\b(s&p|nasdaq|dow jones|stocks?|equities|wall street)\b/], ['USD', /\b(dollar|dxy)\b/],
  ['GOLD', /\bgold\b/], ['OIL', /\b(oil|crude|brent|opec)\b/], ['RATES', /\b(yields?|treasur(y|ies)|bonds?|rates?)\b/],
];

function score(text, weight) {
  let bull = 0, bear = 0;
  const hits = [];
  for (const [re, w] of BULL) { const m = text.match(re); if (m) { bull += w * weight; hits.push('+' + m[0]); } }
  for (const [re, w] of BEAR) { const m = text.match(re); if (m) { bear += w * weight; hits.push('-' + m[0]); } }
  return { bull, bear, hits };
}

function analyze(title, summary) {
  const tl = title.toLowerCase(), sl = summary.toLowerCase().slice(0, 400);
  const t = score(tl, 2), s = score(sl, 1);
  const net = t.bull + s.bull - (t.bear + s.bear);
  const total = t.bull + s.bull + t.bear + s.bear;
  const bias = net >= 2 ? 'LONG' : net <= -2 ? 'SHORT' : 'NEUTRAL';
  const strength = total ? Math.min(100, Math.round((Math.abs(net) / total) * 60 + Math.min(Math.abs(net), 10) * 4)) : 0;
  const all = tl + ' ' + sl;
  const assets = ASSETS.filter(([, re]) => re.test(all)).map(([a]) => a);
  const impact = IMPACT.test(tl) || Math.abs(net) >= 10;
  const launch = LAUNCH_VERB.test(tl) && LAUNCH_THING.test(tl);
  return { bias, score: net, strength, impact, launch, keywords: [...new Set(t.hits)].slice(0, 6), assets };
}
// "🚀 launch" tag for AI / tech: a launch verb plus a product noun in the headline.
const LAUNCH_VERB = /\b(launch(es|ed)?|releas(e|es|ed)|introduc\w+|unveil\w*|debut\w*|rolls? out|rolled out|now available|ships?|announc(es|ed)|open-?sources?)\b/;
const LAUNCH_THING = /\b(model|models|gpt[-\w.]*|claude|opus|sonnet|haiku|gemini|llama|grok|mistral|deepseek|qwen|sora|veo|agent|agents|chip|chips|gpu|api|app|copilot|assistant|iphone|pixel|update|feature|version|v\d)\b/;

// ---------- RSS / Atom parsing
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
const decode = s => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const cdata = s => (s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
const tag = (x, t) => cdata((x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, 'i')) || [])[1]).trim();
const strip = s => decode(decode(s).replace(/<[^>]+>/g, ' ')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function image(x) {
  const raw = cdata(x);
  const m = raw.match(/<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i)
    || raw.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/i)
    || raw.match(/<enclosure[^>]*type="image[^"]*"[^>]*url="([^"]+)"/i)
    || decode(raw).match(/<img[^>]*src="([^"]+)"/i);
  return m ? decode(m[1]) : null;
}

function parse(source, category, xml) {
  const atom = !/<item[\s>]/.test(xml) && /<entry[\s>]/.test(xml);
  const blocks = [...xml.matchAll(atom ? /<entry[\s>]([\s\S]*?)<\/entry>/g : /<item[\s>]([\s\S]*?)<\/item>/g)].map(m => m[1]);
  return blocks.map(x => {
    const title = strip(tag(x, 'title'));
    const summary = strip(tag(x, 'description') || tag(x, 'summary') || tag(x, 'content')).slice(0, 220);
    const link = decode(atom
      ? ((x.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/) || x.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '')
      : (tag(x, 'link') || (x.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '')).split('?utm_')[0];
    const date = new Date(tag(x, 'pubDate') || tag(x, 'published') || tag(x, 'updated') || tag(x, 'dc:date') || Date.now());
    const t = isNaN(date) ? Date.now() : date.getTime();
    if (source === 'Google News') { // "Headline - Outlet": credit the real outlet, drop the link-list summary
      const m = title.match(/^(.*\S)\s+-\s+([^-]{2,40})$/);
      return { source: m ? m[2].trim() : 'Google News', category, title: m ? m[1] : title, summary: '', link, image: null, time: t };
    }
    return { source, category, title, summary, link, image: image(x), time: t };
  }).filter(i => i.title && i.link);
}

// ---------- fetch + merge
async function fetchFeed([name, url, category]) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8_000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (news-reader)' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const items = parse(name, category, await res.text());
    return { name, category, ok: true, count: items.length, items };
  } catch (e) {
    return { name, category, ok: false, error: e.name === 'AbortError' ? 'timeout' : e.message, items: [] };
  } finally { clearTimeout(timer); }
}

const norm = t => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 3).slice(0, 8).join(' ');

function merge(...lists) {
  const seen = new Map();
  for (const list of lists) for (const it of list) {
    const k = norm(it.title);
    if (!seen.has(k) || seen.get(k).time > it.time) seen.set(k, it); // keep earliest report
  }
  const now = Date.now();
  const sorted = [...seen.values()].filter(i => i.time > now - RETAIN_MS && i.time <= now + 600_000).sort((a, b) => b.time - a.time);
  const perCat = {};
  return sorted.filter(i => (perCat[i.category] = (perCat[i.category] || 0) + 1) <= (PER_CATEGORY[i.category] || PER_CATEGORY.default));
}

// Warm serverless instances (and the local server) keep the last pull in memory as a second safety net.
let memory = [];

async function getNews() {
  const [results, stored] = await Promise.all([Promise.all(FEEDS.map(fetchFeed)), kvGet('cnp:items')]);
  const fresh = results.flatMap(r => r.items);
  const items = merge(fresh, Array.isArray(stored) ? stored : [], memory)
    .map(i => ({ ...i, ...analyze(i.title, i.summary) })); // re-score so lexicon edits apply to old stories too
  memory = items;
  if (fresh.length) await kvSet('cnp:items', items.map(({ source, category, title, summary, link, image, time }) => ({ source, category, title, summary, link, image, time })));
  // Trending: stories covered by 2+ outlets in the last 48h, per section page.
  const trending = {};
  for (const cats of [['ai'], ['tech'], ['ai', 'tech'], ['security'], ['crypto']]) {
    trending[cats.join('+')] = buildHighlights(items.filter(i => cats.includes(i.category)), { days: 2, minSources: 2, limit: 8 })
      .map(({ keywords, ...h }) => h);
  }
  return {
    updated: Date.now(),
    persistent: hasKV(),
    trending,
    items,
    sources: results.map(({ name, category, ok, count, error }) => ({ name, category, ok, count, error })),
  };
}

module.exports = { getNews, analyze, FEEDS, parseFeed: parse };
