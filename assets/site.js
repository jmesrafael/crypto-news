// Pulse — shared shell + helpers for every page. Exposes window.CNP.
// Each page has <div id="site-header"></div> at the top and <div id="site-footer"></div> at the bottom.
(function () {
  const PAGES = [['/', 'Overview'], ['/markets', 'Markets'], ['/highlights', 'Weekly Highlights'], ['/news', 'News'], ['/calendar', 'Calendar']];
  const here = location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/') || '/';

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function ago(t) {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'now'; if (m < 60) return m + 'm';
    const h = Math.floor(m / 60); return h < 24 ? h + 'h' : Math.floor(h / 24) + 'd';
  }
  const fmtPrice = p => p == null ? '–' : p >= 1000 ? p.toLocaleString('en-US', { maximumFractionDigits: 0 }) : p >= 1 ? p.toFixed(2) : p >= 0.01 ? p.toFixed(4) : p.toPrecision(3);
  const fmtPct = (c, d = 2) => c == null || isNaN(c) ? '–' : (c >= 0 ? '+' : '') + c.toFixed(d) + '%';
  const fmtBig = n => n == null ? '–' : n >= 1e12 ? '$' + (n / 1e12).toFixed(2) + 'T' : n >= 1e9 ? '$' + (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : '$' + Math.round(n).toLocaleString();
  const cls = c => c == null ? '' : c >= 0 ? 'up' : 'dn';

  // SVG sparkline. opts: { w, h, color, fill (bool), stroke }
  function sparkline(values, opts = {}) {
    const v = (values || []).filter(x => x != null && !isNaN(x));
    const w = opts.w || 120, h = opts.h || 36;
    if (v.length < 2) return `<svg class="spark" width="${w}" height="${h}"></svg>`;
    const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
    const pts = v.map((y, i) => [(i / (v.length - 1)) * w, h - 2 - ((y - min) / span) * (h - 4)]);
    const color = opts.color || (v[v.length - 1] >= v[0] ? 'var(--long)' : 'var(--short)');
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
    const id = 'g' + Math.random().toString(36).slice(2, 8);
    const area = opts.fill === false ? '' : `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".22"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${d}L${w} ${h}L0 ${h}Z" fill="url(#${id})"/>`;
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${area}<path d="${d}" fill="none" stroke="${color}" stroke-width="${opts.stroke || 1.5}" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  }

  // localStorage helpers (always wrapped: storage can be unavailable)
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem('pulse:' + k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem('pulse:' + k, JSON.stringify(v)); } catch {} },
  };

  // Stale-while-revalidate fetch: calls onData immediately with the saved copy (if any), then again with fresh data.
  async function swr(url, onData, { key = url } = {}) {
    const cached = store.get('swr:' + key);
    if (cached) { try { onData(cached, { stale: true }); } catch (e) { console.error(e); } }
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const fresh = await res.json();
      store.set('swr:' + key, fresh);
      onData(fresh, { stale: false });
      return fresh;
    } catch (e) {
      if (!cached) onData(null, { error: e });
      return cached;
    }
  }

  // ---- news item renderers (shared by Overview / News / Highlights)
  const ARROW = { LONG: '▲', SHORT: '▼', NEUTRAL: '●' };
  const CAT_LABEL = { crypto: 'Crypto', markets: 'Markets', macro: 'Macro', tech: 'Tech', ai: 'AI', banking: 'Banking', world: 'World' };
  const biasBadge = i => `<span class="badge ${i.bias}">${ARROW[i.bias] || ''} ${i.bias}${i.bias !== 'NEUTRAL' && i.strength != null ? ' ' + i.strength + '%' : ''}</span>`;
  const impactBadge = i => i.impact ? '<span class="badge impact" title="Market-moving topic">⚡ IMPACT</span>' : '';
  const chips = i => (i.assets || []).slice(0, 4).map(a => `<span class="chip">${esc(a)}</span>`).join('');
  const catTag = i => `<span class="cat">${esc(CAT_LABEL[i.category] || i.category || '')}</span>`;
  const BIAS_COLOR = { LONG: 'var(--long)', SHORT: 'var(--short)', NEUTRAL: 'var(--neutral)' };

  function newsRow(i, { fresh } = {}) {
    return `<a class="news-row${fresh ? ' fresh' : ''}" href="${esc(i.link)}" target="_blank" rel="noopener" title="${esc((i.keywords || []).join(', '))}">
      <div class="time">${new Date(i.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<br>${ago(i.time)} ago</div>
      <div class="thumb"${i.image ? ` style="background-image:url('${esc(i.image)}')"` : ''}></div>
      <div><div class="title">${esc(i.title)}</div><div class="meta">${catTag(i)}<span class="dim">/</span>${esc(i.source)} ${chips(i)}</div></div>
      <div class="right"><div style="display:flex;gap:4px">${impactBadge(i)}${biasBadge(i)}</div><div class="str"><i style="width:${i.strength || 0}%;background:${BIAS_COLOR[i.bias]}"></i></div></div></a>`;
  }
  function newsCard(i, { big } = {}) {
    return `<a class="card${big ? ' big' : ''}" href="${esc(i.link)}" target="_blank" rel="noopener">
      <div class="tags">${biasBadge(i)}${impactBadge(i)}</div>
      <div class="img" style="${i.image ? `background-image:url('${esc(i.image)}')` : ''}"></div>
      <div class="body">${catTag(i)}<h3>${esc(i.title)}</h3>${i.summary && big ? `<p>${esc(i.summary.slice(0, 180))}${i.summary.length > 180 ? '…' : ''}</p>` : ''}
      <div class="meta">${esc(i.source)} · ${ago(i.time)} ago ${chips(i)}</div></div></a>`;
  }

  // ---- weekly highlight card (from data/highlights.json)
  function highlightCard(h, { big, rank, related } = {}) {
    const days = Math.max(1, Math.round((h.lastSeen - h.firstSeen) / 86400e3) + 1);
    const n = (h.sources || []).length;
    const withRel = related && h.related && h.related.length; // nested links aren't allowed, so cards with related links are <div>s
    const open = withRel ? '<div' : `<a href="${esc(h.link)}" target="_blank" rel="noopener"`;
    return `${open} class="hl${big ? ' big' : ''}" style="${h.image ? `background-image:url('${esc(h.image)}')` : 'background-image:linear-gradient(135deg,#101b33,#0a0c10)'}">
      <div class="hl-tags">${h.pinned ? '<span class="badge pin">📌 PINNED</span>' : ''}${biasBadge(h)}${impactBadge(h)}${n ? `<span class="badge NEUTRAL">${n} OUTLETS</span>` : ''}</div>
      <div class="hl-body">
        ${rank ? `<span class="rank">#${rank}</span>` : ''}${catTag(h)}
        <h3 class="hl-title">${withRel ? `<a href="${esc(h.link)}" target="_blank" rel="noopener">${esc(h.title)}</a>` : esc(h.title)}</h3>
        ${big && h.summary ? `<p>${esc(h.summary.slice(0, 220))}${h.summary.length > 220 ? '…' : ''}</p>` : ''}
        <div class="hl-meta">${n ? `<span class="src-dots">${'<i></i>'.repeat(Math.min(n, 12))}</span>` : ''}${esc(h.source || '')}${h.firstSeen ? ` · ${days}d running · ${h.count} reports` : h.date ? ' · ' + esc(h.date) : ''} ${chips(h)}</div>
        ${withRel ? `<div class="hl-related">${h.related.slice(0, 4).map(r => `<a href="${esc(r.link)}" target="_blank" rel="noopener"><span>${esc(r.source)}</span>${esc(r.title)}</a>`).join('')}</div>` : ''}
      </div>${withRel ? '</div>' : '</a>'}`;
  }

  // ---- countdowns: el gets cards for events [{title,type,time,note,estimated}], ticking every second
  const TYPE_ICON = { CPI: '◆', FOMC: '◉', NFP: '▣', PPI: '◇', GDP: '▤', PCE: '◈', Halving: '₿' };
  function countdown(el, events, { max = 4 } = {}) {
    if (!el) return;
    const list = (events || []).filter(e => e.time > Date.now() - 3600e3).slice(0, max);
    if (!list.length) { el.innerHTML = '<div class="empty">No scheduled events.</div>'; return; }
    el.innerHTML = list.map((e, k) => `<div class="cd${k === 0 ? ' next' : ''}">
        <div class="cd-top"><span class="cd-type">${TYPE_ICON[e.type] || '●'} ${esc(e.type || e.country || '')}</span><span class="label">${e.estimated ? 'EST.' : esc(e.country || '')}</span></div>
        <div class="cd-title">${esc(e.title)}</div>
        <div class="cd-clock mono" data-t="${e.time}"></div>
        <div class="cd-when">${new Date(e.time).toLocaleString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} PHT${e.note ? ' · ' + esc(e.note) : ''}</div>
      </div>`).join('');
    const tick = () => el.querySelectorAll('.cd-clock').forEach(c => {
      let s = Math.max(0, Math.floor((+c.dataset.t - Date.now()) / 1000));
      if (s === 0) { c.innerHTML = '<span class="warn">LIVE NOW</span>'; return; }
      const d = Math.floor(s / 86400); s %= 86400;
      const p = n => String(n).padStart(2, '0');
      c.innerHTML = `${d ? `<b>${d}</b><small>d</small> ` : ''}<b>${p(Math.floor(s / 3600))}</b><small>h</small> <b>${p(Math.floor(s % 3600 / 60))}</b><small>m</small> <b>${p(s % 60)}</b><small>s</small>`;
    });
    tick(); clearInterval(el._cd); el._cd = setInterval(tick, 1000);
  }

  // ---- shell
  const LOGO = `<svg viewBox="0 0 32 32" fill="none"><path d="M16 2 29 9.5v13L16 30 3 22.5v-13L16 2Z" stroke="var(--accent)" stroke-width="1.6"/><path d="M8 16h4l2-5 4 10 2-5h4" stroke="var(--accent2)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  function header() {
    const el = document.getElementById('site-header');
    if (!el) return;
    el.outerHTML = `<header class="site-header"><div class="container">
        <a class="brand" href="/">${LOGO}<div>PULSE<small>MARKET INTEL</small></div></a>
        <nav class="nav" id="nav">${PAGES.map(([href, label]) => `<a href="${href}" class="${here === href ? 'on' : ''}">${label}</a>`).join('')}</nav>
        <div class="header-right"><span id="clock"></span><span class="live" id="live-dot">LIVE</span></div>
        <button class="menu-btn" id="menu-btn" aria-label="Menu">☰</button>
      </div></header>
      <div class="tape" id="tape"><div class="tape-track" id="tape-track"></div></div>`;
    document.getElementById('menu-btn').onclick = () => document.getElementById('nav').classList.toggle('open');
    const tick = () => {
      const now = new Date();
      const t = tz => now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
      const c = document.getElementById('clock'); if (c) c.textContent = `PHT ${t('Asia/Manila')} · UTC ${t('UTC')}`;
    };
    tick(); setInterval(tick, 30000);
    tape();
  }

  // Ticker tape from /api/markets (coins[] + macro[]). Hidden if unavailable.
  function tape() {
    const render = d => {
      const tr = document.getElementById('tape-track');
      if (!tr || !d) return;
      const items = [...(d.coins || []).slice(0, 15).map(c => ({ s: c.symbol, p: c.price, c: c.change24h })), ...(d.macro || []).map(m => ({ s: m.sym, p: m.price, c: m.change }))];
      if (!items.length) { document.getElementById('tape').style.display = 'none'; return; }
      const html = items.map(x => `<span class="tape-item"><b>${esc(x.s)}</b>${fmtPrice(x.p)}<span class="${cls(x.c)}">${fmtPct(x.c)}</span></span>`).join('');
      tr.innerHTML = html + html; // doubled for seamless loop
    };
    swr('/api/markets', render);
    setInterval(() => swr('/api/markets', render), 120000);
  }

  function footer() {
    const el = document.getElementById('site-footer');
    if (!el) return;
    el.outerHTML = `<footer class="site-footer"><div class="container">
      <span>PULSE · market intel from public RSS feeds & free market APIs. LONG / SHORT reads are keyword heuristics, not trading advice.</span>
      <span>Weekly highlights publish daily at 07:00 PHT</span></div></footer>`;
  }

  function setLive(ok) { const d = document.getElementById('live-dot'); if (d) { d.classList.toggle('stale', !ok); d.textContent = ok ? 'LIVE' : 'CACHED'; } }

  window.CNP = { esc, ago, fmtPrice, fmtPct, fmtBig, cls, sparkline, store, swr, newsRow, newsCard, highlightCard, countdown, biasBadge, impactBadge, chips, catTag, CAT_LABEL, BIAS_COLOR, setLive };
  document.addEventListener('DOMContentLoaded', () => { header(); footer(); });
})();
