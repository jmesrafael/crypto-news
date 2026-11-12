// Pulse — market widgets. Requires assets/site.js (window.CNP). Exposes window.CNPWidgets.
// All render functions take (el, data) where data is the /api/markets payload (or null while loading).
(function () {
  const C = () => window.CNP;

  // ---------- scoped styles (kept here so site.css stays generic)
  const CSS = `
  .w-row1 { display: grid; grid-template-columns: 1.25fr 1fr .9fr; gap: 14px; }
  .w-kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
  .w-kpis .panel { padding: 12px 14px; }
  .w-mood { padding: 16px 18px; display: grid; grid-template-columns: 170px 1fr; gap: 18px; align-items: center; overflow: hidden; }
  .w-mood::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(420px 180px at 0% 0%, var(--mood-glow, rgba(255,255,255,.05)), transparent 70%); }
  .w-mood .big { font: 700 26px/1.1 var(--mono); letter-spacing: .02em; margin: 6px 0 2px; }
  .w-mood .mom { font: 600 13px var(--mono); display: inline-flex; align-items: center; gap: 6px; }
  .w-mood ul { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 5px; }
  .w-mood li { font: 12px var(--mono); color: var(--muted); display: flex; gap: 8px; }
  .w-mood li::before { content: '›'; color: var(--accent); }
  .w-gauge { position: relative; width: 170px; }
  .w-gauge .gv { position: absolute; left: 0; right: 0; bottom: 4px; text-align: center; font: 700 30px/1 var(--mono); }
  .w-gauge .gl { position: absolute; left: 0; right: 0; bottom: -14px; text-align: center; font: 600 9.5px var(--mono); letter-spacing: .1em; color: var(--dim); }

  .w-wl .panel-b { padding: 4px 0; }
  .w-wl-row { display: grid; grid-template-columns: 30px minmax(0, 1fr) 96px 92px; gap: 10px; align-items: center; padding: 9px 14px; border-top: 1px solid var(--line); transition: background .12s; }
  .w-wl-row:first-child { border-top: 0; }
  .w-wl-row:hover { background: var(--panel2); }
  .w-logo { width: 26px; height: 26px; border-radius: 50%; background: var(--panel3); object-fit: cover; }
  .w-name { font-weight: 600; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .w-sym { font: 11px var(--mono); color: var(--muted); display: flex; gap: 6px; align-items: center; }
  .w-px { text-align: right; font: 600 13px var(--mono); }
  .w-ch { text-align: right; font: 12px var(--mono); }
  .w-tag { font: 700 9px var(--mono); letter-spacing: .05em; padding: 2px 5px; border-radius: 3px; border: 1px solid transparent; white-space: nowrap; }

  .w-fg { padding: 14px 16px; display: grid; gap: 10px; }
  .w-fg .top { display: flex; align-items: center; gap: 14px; }
  .w-fg .val { font: 700 30px/1 var(--mono); }
  .w-fg .lbl { font: 600 12px var(--mono); }
  .w-fg .scale { display: flex; justify-content: space-between; font: 10px var(--mono); color: var(--dim); }

  .w-coins { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0; }
  .w-coin { display: grid; grid-template-columns: 30px minmax(0, 1fr) 84px 88px; gap: 10px; align-items: center; padding: 11px 14px; border-top: 1px solid var(--line); border-left: 1px solid var(--line); transition: background .12s; }
  .w-coin:hover { background: var(--panel2); }
  .w-coins .w-coin:nth-child(-n+4) { border-top: 0; }
  .w-coins .w-coin:nth-child(4n+1) { border-left: 0; }

  .w-movers .w-mv { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto auto; gap: 10px; align-items: center; padding: 8px 14px; border-top: 1px solid var(--line); font-size: 13px; }
  .w-movers .w-mv:first-child { border-top: 0; }
  .w-movers .w-logo { width: 20px; height: 20px; }
  .w-macro { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .w-mc { padding: 11px 14px; border-top: 1px solid var(--line); border-left: 1px solid var(--line); display: grid; gap: 2px; }
  .w-macro .w-mc:nth-child(-n+3) { border-top: 0; }
  .w-macro .w-mc:nth-child(3n+1) { border-left: 0; }
  .w-mc .p { font: 600 14px var(--mono); }
  .w-row3 { display: grid; grid-template-columns: 1fr 1fr 1.4fr; gap: 14px; margin-top: 14px; }

  .w-heat { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); grid-auto-rows: 54px; grid-auto-flow: dense; gap: 3px; padding: 3px; }
  .w-tile { border-radius: 4px; padding: 7px 8px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; overflow: hidden; min-width: 0; transition: filter .12s; border: 1px solid rgba(255,255,255,.04); }
  .w-tile:hover { filter: brightness(1.25); }
  .w-tile b { font: 700 12px var(--mono); }
  .w-tile span { font: 11px var(--mono); opacity: .9; }
  .w-tile.t1 { grid-column: span 4; grid-row: span 3; } .w-tile.t1 b { font-size: 22px; } .w-tile.t1 span { font-size: 15px; }
  .w-tile.t2 { grid-column: span 3; grid-row: span 2; } .w-tile.t2 b { font-size: 17px; } .w-tile.t2 span { font-size: 13px; }
  .w-tile.t3 { grid-column: span 2; grid-row: span 2; } .w-tile.t3 b { font-size: 14px; }
  .w-tile.t4 { grid-column: span 2; }
  .w-tile .tl { width: 20px; height: 20px; border-radius: 50%; margin-bottom: 3px; }
  .w-tile.t1 .tl { width: 34px; height: 34px; } .w-tile.t2 .tl { width: 26px; height: 26px; }

  .w-table-wrap { overflow-x: auto; }
  .w-table th.sortable { cursor: pointer; user-select: none; }
  .w-table th.sortable:hover { color: var(--text); }
  .w-table th.sorted { color: var(--accent); }
  .w-table .coin { display: flex; align-items: center; gap: 10px; }
  .w-table .coin .w-logo { width: 22px; height: 22px; }

  .w-fgchart svg { display: block; width: 100%; height: auto; }
  .w-sk { display: grid; gap: 8px; padding: 14px; }

  @media (max-width: 1180px) { .w-row1 { grid-template-columns: 1fr 1fr; } .w-row1 > :first-child { grid-column: 1 / -1; } .w-coins { grid-template-columns: repeat(2, minmax(0, 1fr)); } .w-coins .w-coin:nth-child(-n+4) { border-top: 1px solid var(--line); } .w-coins .w-coin:nth-child(-n+2) { border-top: 0; } .w-coins .w-coin:nth-child(4n+1) { border-left: 1px solid var(--line); } .w-coins .w-coin:nth-child(2n+1) { border-left: 0; } .w-row3 { grid-template-columns: 1fr 1fr; } .w-row3 > :last-child { grid-column: 1 / -1; } .w-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 760px) {
    .w-row1, .w-row3 { grid-template-columns: 1fr; } .w-row3 > :last-child, .w-row1 > :first-child { grid-column: auto; }
    .w-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .w-mood { grid-template-columns: 1fr; justify-items: center; text-align: center; } .w-mood li { justify-content: center; }
    .w-coins { grid-template-columns: 1fr; } .w-coins .w-coin { border-left: 0 !important; border-top: 1px solid var(--line) !important; } .w-coins .w-coin:first-child { border-top: 0 !important; }
    .w-macro { grid-template-columns: repeat(2, minmax(0, 1fr)); } .w-macro .w-mc { border-left: 1px solid var(--line); border-top: 1px solid var(--line); } .w-macro .w-mc:nth-child(-n+2) { border-top: 0; } .w-macro .w-mc:nth-child(2n+1) { border-left: 0; }
    .w-heat { grid-template-columns: repeat(6, minmax(0, 1fr)); } .w-tile.t1 { grid-column: span 6; grid-row: span 2; } .w-tile.t2 { grid-column: span 3; } .w-tile.t3, .w-tile.t4 { grid-column: span 2; grid-row: span 1; }
    .w-wl-row, .w-coin { grid-template-columns: 28px minmax(0, 1fr) 70px 84px; }
  }`;
  function injectCss() {
    if (document.getElementById('cnpw-style')) return;
    const s = document.createElement('style'); s.id = 'cnpw-style'; s.textContent = CSS; document.head.appendChild(s);
  }

  // ---------- helpers
  const MOOD_COLOR = { 'Strong Bullish': 'var(--long)', Bullish: 'var(--long)', Neutral: 'var(--neutral)', Bearish: 'var(--short)', 'Strong Bearish': 'var(--short)' };
  const MOOD_GLOW = { 'Strong Bullish': 'rgba(22,199,132,.18)', Bullish: 'rgba(22,199,132,.12)', Neutral: 'rgba(139,149,165,.10)', Bearish: 'rgba(240,65,76,.12)', 'Strong Bearish': 'rgba(240,65,76,.18)' };
  const MOM_ICON = { 'Rising fast': '⇈', Rising: '↗', Flat: '→', Falling: '↘', 'Falling fast': '⇊' };
  const TREND_COLOR = t => /Rising/.test(t) ? 'var(--long)' : /Falling/.test(t) ? 'var(--short)' : 'var(--neutral)';
  const fgColor = v => v == null ? 'var(--neutral)' : v < 25 ? 'var(--short)' : v < 45 ? '#f0794c' : v <= 55 ? 'var(--warn)' : v < 75 ? '#7fd36b' : 'var(--long)';
  const logo = (c, cls = 'w-logo') => c && c.image ? `<img class="${cls}" src="${C().esc(c.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="${cls}"></span>`;
  const sk = (n = 4, h = 16) => `<div class="w-sk">${Array.from({ length: n }, () => `<div class="skeleton" style="height:${h}px"></div>`).join('')}</div>`;
  const cgLink = c => `https://www.coingecko.com/en/coins/${encodeURIComponent(c.id)}`;

  // Semicircle gauge 0-100 with red→green track and a needle.
  function gauge(score, { size = 170, label = '' } = {}) {
    const w = size, h = size * 0.58, cx = w / 2, cy = h - 6, r = w / 2 - 12;
    const pt = (v, rr = r) => { const a = Math.PI * (1 - v / 100); return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; };
    const arc = (a, b, rr = r) => { const [x1, y1] = pt(a, rr), [x2, y2] = pt(b, rr); return `M${x1.toFixed(1)} ${y1.toFixed(1)}A${rr} ${rr} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
    const segs = [[0, 25, 'var(--short)'], [25, 45, '#f0794c'], [45, 55, 'var(--warn)'], [55, 75, '#7fd36b'], [75, 100, 'var(--long)']];
    const v = score == null ? null : Math.max(0, Math.min(100, score));
    const [nx, ny] = v == null ? [cx, cy] : pt(v, r - 16);
    return `<div class="w-gauge" style="width:${w}px"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      ${segs.map(([a, b, col]) => `<path d="${arc(a + 0.6, b - 0.6)}" stroke="${col}" stroke-width="9" fill="none" stroke-linecap="butt" opacity=".9"/>`).join('')}
      ${[0, 25, 50, 75, 100].map(t => { const [x1, y1] = pt(t, r + 7), [x2, y2] = pt(t, r + 11); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--dim)" stroke-width="1"/>`; }).join('')}
      ${v == null ? '' : `<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="var(--text)" stroke-width="2" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="4" fill="var(--text)"/>`}
      </svg>${label ? `<div class="gl">${label}</div>` : ''}</div>`;
  }

  // ---------- pieces
  function moodPanel(d) {
    const m = d && d.mood;
    if (!m) return `<div class="panel w-mood">${sk(5)}</div>`;
    const col = MOOD_COLOR[m.label];
    return `<div class="panel glow w-mood" style="--mood-glow:${MOOD_GLOW[m.label]}">
      <div style="display:grid;justify-items:center;gap:2px">${gauge(m.score)}<div class="num" style="font-size:22px;font-weight:700;margin-top:2px;color:${col}">${m.score}<span class="dim" style="font-size:12px;font-weight:500">/100</span></div><div class="label" style="color:var(--dim)">Mood score</div></div>
      <div style="position:relative"><div class="label">Market mood · now</div>
        <div class="big" style="color:${col}">${m.label.toUpperCase()}</div>
        <div class="mom" style="color:${TREND_COLOR(m.momentum)}">${MOM_ICON[m.momentum] || ''} ${m.momentum}
          <span class="dim" style="font-weight:400">· 1h ${C().fmtPct(m.avg1h)} · 24h ${C().fmtPct(m.avg24h)} · 7d ${C().fmtPct(m.avg7d)}</span></div>
        <ul>${(m.notes || []).slice(0, 5).map(n => `<li>${C().esc(n)}</li>`).join('')}</ul></div></div>`;
  }

  function fearGreedPanel(d) {
    const f = d && d.fearGreed;
    if (!f) return `<div class="panel"><div class="panel-h"><span class="label">Fear & Greed</span></div>${sk(4)}</div>`;
    const col = fgColor(f.value), hist = (f.history || []).map(x => x.value);
    const delta = f.prev != null ? f.value - f.prev : null;
    return `<div class="panel"><div class="panel-h"><span class="label">Fear & Greed</span><span class="meta">alternative.me</span></div>
      <div class="w-fg"><div class="top">${gauge(f.value, { size: 120 })}
        <div><div class="val" style="color:${col}">${f.value}</div><div class="lbl" style="color:${col}">${C().esc(f.label).toUpperCase()}</div>
        ${delta != null ? `<div class="num muted" style="font-size:11px;margin-top:3px">${delta >= 0 ? '+' : ''}${delta} vs yesterday</div>` : ''}</div></div>
        <div><div class="label" style="margin-bottom:4px">30 days</div>${C().sparkline(hist, { w: 260, h: 44, color: col })}
        <div class="scale"><span>${hist.length ? Math.min(...hist) + ' low' : ''}</span><span>${hist.length ? Math.max(...hist) + ' high' : ''}</span></div></div></div></div>`;
  }

  function kpis(d) {
    const g = d && d.global, m = d && d.mood;
    const k = (label, v, sub = '', subCls = '') => `<div class="panel kpi"><div class="label">${label}</div><div class="v">${v}</div><div class="s ${subCls}">${sub}</div></div>`;
    if (!g) return `<div class="w-kpis">${Array.from({ length: 5 }, () => `<div class="panel" style="padding:14px">${sk(2)}</div>`).join('')}</div>`;
    const br = m && m.breadth24h;
    return `<div class="w-kpis">
      ${k('Total market cap', C().fmtBig(g.totalMarketCap), C().fmtPct(g.marketCapChange24h) + ' 24h', C().cls(g.marketCapChange24h))}
      ${k('24h volume', C().fmtBig(g.totalVolume), g.totalMarketCap ? (g.totalVolume / g.totalMarketCap * 100).toFixed(1) + '% of mcap' : '', 'muted')}
      ${k('BTC dominance', g.btcDominance != null ? g.btcDominance.toFixed(1) + '%' : '–', 'ETH ' + (g.ethDominance != null ? g.ethDominance.toFixed(1) + '%' : '–'), 'muted')}
      ${k('Breadth (24h)', br != null ? br + '%' : '–', `<div class="bar" style="margin-top:6px"><i style="width:${br || 0}%;background:var(--long)"></i><i style="width:${100 - (br || 0)}%;background:var(--short)"></i></div>`)}
      ${k('Momentum', `<span style="color:${TREND_COLOR(m && m.momentum)}">${MOM_ICON[m && m.momentum] || ''} ${m ? m.momentum : '–'}</span>`, m ? '1h ' + C().fmtPct(m.avg1h) : '', m ? C().cls(m.avg1h) : '')}
    </div>`;
  }

  function coinRow(c, cls, extra = '') {
    return `<a class="${cls}" href="${cgLink(c)}" target="_blank" rel="noopener">${logo(c)}
      <div style="min-width:0"><div class="w-name">${C().esc(c.name)}</div><div class="w-sym">${C().esc(c.symbol)}${extra}</div></div>
      <div>${C().sparkline(c.spark, { w: 90, h: 32, color: (c.change7d ?? 0) >= 0 ? 'var(--long)' : 'var(--short)' })}</div>
      <div><div class="w-px">${C().fmtPrice(c.price)}</div><div class="w-ch ${C().cls(c.change24h)}">${C().fmtPct(c.change24h)}</div></div></a>`;
  }

  function trendTag(c) {
    const col = TREND_COLOR(c.trend);
    return `<span class="w-tag" style="color:${col};border-color:color-mix(in srgb, ${col} 35%, transparent)">${MOM_ICON[c.trend] || ''} ${C().esc(c.trend || '')}</span>`
      + (c.bias ? `<span class="w-tag ${c.bias}">${c.bias}</span>` : '');
  }

  function watchlistPanel(d) {
    const wl = d && d.watchlist;
    const head = `<div class="panel-h"><span class="label">★ My watchlist</span><span class="meta">7d · 24h</span></div>`;
    if (!wl) return `<div class="panel w-wl">${head}${sk(5, 26)}</div>`;
    if (!wl.length) return `<div class="panel w-wl">${head}<div class="empty">Watchlist unavailable right now.</div></div>`;
    return `<div class="panel w-wl">${head}<div class="panel-b">${wl.map(c => coinRow(c, 'w-wl-row', trendTag(c))).join('')}</div></div>`;
  }

  function topCoins(d, n = 12) {
    const cs = d && d.coins;
    const head = `<div class="panel-h"><span class="label">Top coins</span><span class="meta">7d chart · 24h change</span><a class="meta acc" href="/markets" style="margin-left:12px">All 100 →</a></div>`;
    if (!cs || !cs.length) return `<div class="panel" style="margin-top:14px">${head}${sk(6, 28)}</div>`;
    return `<div class="panel" style="margin-top:14px">${head}<div class="w-coins">${cs.slice(0, n).map(c => coinRow(c, 'w-coin')).join('')}</div></div>`;
  }

  function movers(d, dir) {
    const cs = (d && d.coins || []).filter(c => c.change24h != null);
    const title = dir > 0 ? '▲ Top gainers 24h' : '▼ Top losers 24h';
    const head = `<div class="panel-h"><span class="label">${title}</span><span class="meta">top 100</span></div>`;
    if (!cs.length) return `<div class="panel w-movers">${head}${sk(5)}</div>`;
    const list = cs.slice().sort((a, b) => dir * (b.change24h - a.change24h)).slice(0, 5);
    return `<div class="panel w-movers">${head}${list.map(c => `<a class="w-mv" href="${cgLink(c)}" target="_blank" rel="noopener">${logo(c)}
      <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>${C().esc(c.symbol)}</b> <span class="muted" style="font-size:12px">${C().esc(c.name)}</span></span>
      <span class="num">${C().fmtPrice(c.price)}</span><span class="num ${C().cls(c.change24h)}" style="min-width:64px;text-align:right">${C().fmtPct(c.change24h)}</span></a>`).join('')}</div>`;
  }

  function macroPanel(d) {
    const ms = d && d.macro;
    const head = `<div class="panel-h"><span class="label">Macro</span><span class="meta">5d · vs prior close</span></div>`;
    if (!ms) return `<div class="panel">${head}${sk(4)}</div>`;
    if (!ms.length) return `<div class="panel">${head}<div class="empty">Macro data unavailable.</div></div>`;
    return `<div class="panel">${head}<div class="w-macro">${ms.map(m => `<div class="w-mc" title="${C().esc(m.name)}">
      <div class="label">${C().esc(m.sym)}</div><div class="p">${m.sym === 'US 10Y' ? (m.price != null ? m.price.toFixed(2) + '%' : '–') : C().fmtPrice(m.price)}</div>
      <div class="num ${C().cls(m.change)}" style="font-size:11.5px">${C().fmtPct(m.change)}</div>${C().sparkline(m.spark, { w: 150, h: 26, color: (m.change ?? 0) >= 0 ? 'var(--long)' : 'var(--short)' })}</div>`).join('')}</div></div>`;
  }

  // ---------- public renderers
  function renderOverview(el, data) {
    injectCss();
    el.innerHTML = `<div class="w-row1">${moodPanel(data)}${watchlistPanel(data)}${fearGreedPanel(data)}</div>
      ${kpis(data)}${topCoins(data)}
      <div class="w-row3">${movers(data, 1)}${movers(data, -1)}${macroPanel(data)}</div>`;
  }

  function renderWatchlist(el, data) { injectCss(); el.innerHTML = watchlistPanel(data); }
  function renderMood(el, data) { injectCss(); el.innerHTML = moodPanel(data); }
  function renderFearGreed(el, data) { injectCss(); el.innerHTML = fearGreedPanel(data); }
  function renderKpis(el, data) { injectCss(); el.innerHTML = kpis(data); }
  function renderMacro(el, data) { injectCss(); el.innerHTML = macroPanel(data); }

  function heatColor(ch) {
    if (ch == null) return 'var(--panel3)';
    const a = Math.min(Math.abs(ch) / 8, 1) * 0.75 + 0.12;
    return ch >= 0 ? `rgba(22,199,132,${a.toFixed(2)})` : `rgba(240,65,76,${a.toFixed(2)})`;
  }
  function renderHeatmap(el, data, n = 50) {
    injectCss();
    const cs = data && data.coins;
    if (!cs || !cs.length) { el.innerHTML = sk(6, 40); return; }
    const tier = i => i === 0 ? 't1' : i === 1 ? 't2' : i < 5 ? 't3' : i < 15 ? 't4' : '';
    el.innerHTML = `<div class="w-heat">${cs.slice(0, n).map((c, i) => `<a class="w-tile ${tier(i)}" href="${cgLink(c)}" target="_blank" rel="noopener" style="background:${heatColor(c.change24h)}" title="${C().esc(c.name)} · ${C().fmtPrice(c.price)} · ${C().fmtPct(c.change24h)} 24h">
      ${i < 5 ? logo(c, 'tl') : ''}<b>${C().esc(c.symbol)}</b><span>${C().fmtPct(c.change24h, 1)}</span></a>`).join('')}</div>`;
  }

  // Sortable top-100 table. Sort state lives on the element so re-renders keep it.
  const COLS = [['rank', '#', 1], ['name', 'Coin', 1], ['price', 'Price', -1], ['change1h', '1h', -1], ['change24h', '24h', -1], ['change7d', '7d', -1], ['marketCap', 'Market cap', -1], ['volume', 'Volume 24h', -1]];
  function renderCoinTable(el, data) {
    injectCss();
    const cs = data && data.coins;
    if (!cs || !cs.length) { el.innerHTML = sk(10, 22); return; }
    const st = el._sort || (el._sort = { key: 'rank', dir: 1 });
    const rows = cs.slice().sort((a, b) => {
      const x = a[st.key], y = b[st.key];
      if (x == null) return 1; if (y == null) return -1;
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * st.dir;
    });
    const pc = v => `<td class="r num ${C().cls(v)}">${C().fmtPct(v)}</td>`;
    el.innerHTML = `<div class="w-table-wrap"><table class="table w-table"><thead><tr>
      ${COLS.map(([k, l]) => `<th class="sortable${k === st.key ? ' sorted' : ''}${k === 'name' || k === 'rank' ? '' : ' r'}" data-k="${k}">${l}${k === st.key ? (st.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}<th class="r">Last 7 days</th></tr></thead>
      <tbody>${rows.map(c => `<tr><td class="num muted">${c.rank ?? ''}</td>
        <td><a class="coin" href="${cgLink(c)}" target="_blank" rel="noopener">${logo(c)}<b>${C().esc(c.name)}</b><span class="muted num" style="font-size:11px">${C().esc(c.symbol)}</span></a></td>
        <td class="r num">$${C().fmtPrice(c.price)}</td>${pc(c.change1h)}${pc(c.change24h)}${pc(c.change7d)}
        <td class="r num">${C().fmtBig(c.marketCap)}</td><td class="r num muted">${C().fmtBig(c.volume)}</td>
        <td class="r">${C().sparkline(c.spark, { w: 120, h: 32, color: (c.change7d ?? 0) >= 0 ? 'var(--long)' : 'var(--short)' })}</td></tr>`).join('')}</tbody></table></div>`;
    el.querySelectorAll('th.sortable').forEach(th => th.onclick = () => {
      const k = th.dataset.k, def = COLS.find(c => c[0] === k)[2];
      el._sort = st.key === k ? { key: k, dir: -st.dir } : { key: k, dir: def };
      renderCoinTable(el, data);
    });
  }

  // 30-day Fear & Greed line chart with zones and axis labels.
  function renderFearGreedChart(el, data) {
    injectCss();
    const h = data && data.fearGreed && data.fearGreed.history;
    if (!h || h.length < 2) { el.innerHTML = sk(5, 24); return; }
    const W = 640, H = 220, L = 34, R = 10, T = 10, B = 24, iw = W - L - R, ih = H - T - B;
    const x = i => L + (i / (h.length - 1)) * iw, y = v => T + ih - (v / 100) * ih;
    const zones = [[0, 25, 'rgba(240,65,76,.08)', 'Extreme fear'], [25, 45, 'rgba(240,121,76,.05)', 'Fear'], [45, 55, 'rgba(245,165,36,.05)', 'Neutral'], [55, 75, 'rgba(127,211,107,.05)', 'Greed'], [75, 100, 'rgba(22,199,132,.08)', 'Extreme greed']];
    const d = h.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.value).toFixed(1)).join('');
    const lastV = h[h.length - 1].value, col = fgColor(lastV);
    const fmtD = t => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
    el.innerHTML = `<div class="w-fgchart"><svg viewBox="0 0 ${W} ${H}">
      ${zones.map(([a, b, f, n]) => `<rect x="${L}" y="${y(b)}" width="${iw}" height="${y(a) - y(b)}" fill="${f}"/><text x="${W - R - 4}" y="${y(b) + 12}" text-anchor="end" fill="var(--dim)" font-size="9" font-family="var(--mono)">${n}</text>`).join('')}
      ${[0, 25, 50, 75, 100].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 6}" y="${y(v) + 3}" text-anchor="end" fill="var(--muted)" font-size="10" font-family="var(--mono)">${v}</text>`).join('')}
      <path d="${d}L${x(h.length - 1)} ${y(0)}L${x(0)} ${y(0)}Z" fill="${col}" opacity=".08"/>
      <path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="${x(h.length - 1)}" cy="${y(lastV)}" r="4" fill="${col}"/>
      ${[0, Math.floor((h.length - 1) / 2), h.length - 1].map(i => `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === h.length - 1 ? 'end' : 'middle'}" fill="var(--muted)" font-size="10" font-family="var(--mono)">${fmtD(h[i].t)}</text>`).join('')}
    </svg></div>`;
  }

  window.CNPWidgets = { renderOverview, renderWatchlist, renderMood, renderFearGreed, renderKpis, renderMacro, renderHeatmap, renderCoinTable, renderFearGreedChart, gauge };
})();
