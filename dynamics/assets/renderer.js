// dynamics: interactive stock-and-flow renderer.
// Reads window.MODEL, window.POS (node centres), window.LOOP_POS, window.BEND, window.FLOW_LABEL.
// Every model string reaches the page through textContent or esc(); this file is ASCII only.
(function () {
  var M = window.MODEL;
  function own(o, k) { return o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined; }
  function dict(o) { var d = Object.create(null); for (var k in (o || {})) if (own(o, k) !== undefined) d[k] = o[k]; return d; }
  var POS = dict(window.POS), BEND = dict(window.BEND), LOOP_POS = dict(window.LOOP_POS), FLOW_LABEL = dict(window.FLOW_LABEL);
  var NS = 'http://www.w3.org/2000/svg';
  var MINUS = String.fromCharCode(0x2212), ARROW = String.fromCharCode(0x2192), CYCLE = String.fromCharCode(0x21ba), DOT = String.fromCharCode(0xb7);
  var svg = document.getElementById('sd');
  var layers = {};
  ['grid', 'links', 'flows', 'nodes', 'loops'].forEach(function (k) { var g = el('g', { 'class': 'layer-' + k }); svg.appendChild(g); layers[k] = g; });
  var vb = svg.viewBox.baseVal;
  for (var gx = 0; gx <= vb.width; gx += 40) layers.grid.appendChild(el('line', { x1: gx, y1: 0, x2: gx, y2: vb.height, 'class': gx % 200 ? 'gridline' : 'gridline major' }));
  for (var gy = 0; gy <= vb.height; gy += 40) layers.grid.appendChild(el('line', { x1: 0, y1: gy, x2: vb.width, y2: gy, 'class': gy % 200 ? 'gridline' : 'gridline major' }));

  var stages = (M.stages && M.stages.length) ? M.stages : [{ id: '__all', label: 'Model', summary: '' }];
  var hasStages = !!(M.stages && M.stages.length);
  var stageOrder = stages.map(function (s) { return s.id; });
  function sIdx(s) { if (s == null || !hasStages) return 0; var i = stageOrder.indexOf(s); return i < 0 ? 0 : i; }
  var byId = Object.create(null);
  M.nodes.forEach(function (n) { byId[n.id] = n; });
  var state = { stage: stageOrder[stageOrder.length - 1], ghost: true, loop: null, node: null }; // opens on the whole model

  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in (attrs || {})) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function wrap(s, max) {
    var words = String(s || '').split(' '), out = [], cur = '';
    words.forEach(function (w) { if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
    if (cur) out.push(cur);
    return out.length ? out : [''];
  }

  // ---------- geometry
  var CHAR = 6.4;
  function boxOf(n) {
    var p = POS[n.id]; if (!p) return null;
    if (n.kind === 'stock') return { x: p.x, y: p.y, hw: 66, hh: 25 };
    if (n.kind === 'cloud') return { x: p.x, y: p.y, hw: 18, hh: 12 };
    if (n.kind === 'flow') return { x: p.x, y: p.y, hw: 9, hh: 9 };
    var lines = wrap(n.name, 18);
    var w = Math.max.apply(null, lines.map(function (l) { return l.length; })) * CHAR + 14;
    return { x: p.x, y: p.y, hw: w / 2, hh: lines.length * 8 + 5 };
  }
  function clip(from, to, b) {
    var dx = to.x - from.x, dy = to.y - from.y;
    if (!dx && !dy) return { x: from.x, y: from.y };
    var t = Math.min(b.hw / Math.abs(dx || 1e-9), b.hh / Math.abs(dy || 1e-9));
    return { x: from.x + dx * t, y: from.y + dy * t };
  }
  function multiline(textEl, lines, x, dx) {
    lines.forEach(function (l, i) { textEl.appendChild(el('tspan', { x: x, dx: dx || 0, dy: i ? 13 : 0 }, l)); });
  }

  // ---------- flows (pipes with valves)
  var flowEls = {};
  M.nodes.filter(function (n) { return n.kind === 'flow'; }).forEach(function (f) {
    var a = byId[f.flow_from], b = byId[f.flow_to];
    if (!a || !b || !POS[a.id] || !POS[b.id]) return;
    var pa = clip(POS[a.id], POS[b.id], boxOf(a)), pb = clip(POS[b.id], POS[a.id], boxOf(b));
    var mid = POS[f.id] || { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
    POS[f.id] = mid;
    var g = el('g', { 'class': 'flow', 'data-id': f.id, tabindex: '0', role: 'button', 'aria-label': 'Flow: ' + f.name });
    var ang = Math.atan2(pb.y - pa.y, pb.x - pa.x), nx = -Math.sin(ang) * 3, ny = Math.cos(ang) * 3;
    var hx = Math.cos(ang), hy = Math.sin(ang);
    var end = { x: pb.x - hx * 9, y: pb.y - hy * 9 };
    g.appendChild(el('line', { x1: pa.x + nx, y1: pa.y + ny, x2: end.x + nx, y2: end.y + ny, 'class': 'pipe' }));
    g.appendChild(el('line', { x1: pa.x - nx, y1: pa.y - ny, x2: end.x - nx, y2: end.y - ny, 'class': 'pipe' }));
    g.appendChild(el('polygon', { 'class': 'pipe-head', points: pb.x + ',' + pb.y + ' ' + (end.x - hy * 7) + ',' + (end.y + hx * 7) + ' ' + (end.x + hy * 7) + ',' + (end.y - hx * 7) }));
    var vx = -hy * 8, vy = hx * 8, ux = hx * 6, uy = hy * 6;
    g.appendChild(el('polygon', { 'class': 'valve', points: (mid.x - ux + vx) + ',' + (mid.y - uy + vy) + ' ' + (mid.x + ux + vx) + ',' + (mid.y + uy + vy) + ' ' + (mid.x - ux - vx) + ',' + (mid.y - uy - vy) + ' ' + (mid.x + ux - vx) + ',' + (mid.y + uy - vy) }));
    var vertical = Math.abs(hy) > 0.7, left = FLOW_LABEL[f.id] === 'left';
    var ldx = vertical ? (left ? -14 : 14) : 0;
    var lab = el('text', { 'class': 'flow-label', x: mid.x, y: mid.y + (vertical ? 4 : 22), 'text-anchor': vertical ? (left ? 'end' : 'start') : 'middle' });
    multiline(lab, wrap(f.name, 16), mid.x, ldx);
    g.appendChild(lab);
    layers.flows.appendChild(g); flowEls[f.id] = g;
  });

  // ---------- nodes
  var nodeEls = {};
  M.nodes.filter(function (n) { return n.kind !== 'flow'; }).forEach(function (n) {
    var p = POS[n.id]; if (!p) return;
    var g = el('g', { 'class': 'node kind-' + n.kind, 'data-id': n.id, tabindex: '0', role: 'button', 'aria-label': n.kind + ': ' + n.name });
    var lines, t;
    if (n.kind === 'stock') {
      g.appendChild(el('rect', { x: p.x - 66, y: p.y - 25, width: 132, height: 50, rx: 2, 'class': 'stock-box' }));
      lines = wrap(n.name, 17);
      t = el('text', { x: p.x, y: p.y - (lines.length - 1) * 7 + 4, 'text-anchor': 'middle', 'class': 'stock-label' });
      multiline(t, lines, p.x); g.appendChild(t);
    } else if (n.kind === 'cloud') {
      [[-9, 2, 8], [0, -3, 10], [10, 2, 8]].forEach(function (c) { g.appendChild(el('circle', { cx: p.x + c[0], cy: p.y + c[1], r: c[2], 'class': 'cloud' })); });
      g.appendChild(el('rect', { x: p.x - 17, y: p.y + 1, width: 34, height: 9, 'class': 'cloud-base' }));
    } else {
      lines = wrap(n.name, 18);
      var b = boxOf(n);
      if (n.kind === 'exogenous') g.appendChild(el('rect', { x: p.x - b.hw, y: p.y - b.hh, width: b.hw * 2, height: b.hh * 2, rx: b.hh, 'class': 'exo-pill' }));
      if (n.kind === 'decision') g.appendChild(el('rect', { x: p.x - b.hw, y: p.y - b.hh, width: b.hw * 2, height: b.hh * 2, rx: 3, 'class': 'decision-box' }));
      t = el('text', { x: p.x, y: p.y - (lines.length - 1) * 7 + 4, 'text-anchor': 'middle', 'class': 'var-label ' + n.kind });
      multiline(t, lines, p.x); g.appendChild(t);
    }
    layers.nodes.appendChild(g); nodeEls[n.id] = g;
  });

  // ---------- causal links
  var linkEls = [];
  M.links.forEach(function (L, i) {
    var a = byId[L.from], b = byId[L.to];
    if (!a || !b || !POS[a.id] || !POS[b.id]) return;
    if (a.kind === 'flow' && (a.flow_to === b.id || a.flow_from === b.id)) { linkEls.push({ L: L, pipe: true }); return; } // drawn by the pipe
    var pa0 = POS[a.id], pb0 = POS[b.id];
    var bend = own(BEND, L.from + '>' + L.to) != null ? BEND[L.from + '>' + L.to] : 0.2;
    var mx = (pa0.x + pb0.x) / 2, my = (pa0.y + pb0.y) / 2, dx = pb0.x - pa0.x, dy = pb0.y - pa0.y;
    var c = { x: mx - dy * bend, y: my + dx * bend };
    var pa = clip(pa0, c, boxOf(a)), pb = clip(pb0, c, boxOf(b));
    var dl = Math.hypot(pb.x - c.x, pb.y - c.y) || 1;
    var pe = { x: pb.x - (pb.x - c.x) / dl * 3, y: pb.y - (pb.y - c.y) / dl * 3 };
    var hypo = L.evidence === 'hypothesis';
    var g = el('g', { 'class': 'link' + (hypo ? ' hypothesis' : ''), 'data-i': i });
    var path = el('path', { d: 'M' + pa.x + ',' + pa.y + ' Q' + c.x + ',' + c.y + ' ' + pe.x + ',' + pe.y, 'class': 'link-path', 'marker-end': 'url(#arrow)' });
    g.appendChild(path);
    var t = 0.84, qx = (1 - t) * (1 - t) * pa.x + 2 * (1 - t) * t * c.x + t * t * pe.x, qy = (1 - t) * (1 - t) * pa.y + 2 * (1 - t) * t * c.y + t * t * pe.y;
    var tx = 2 * (1 - t) * (c.x - pa.x) + 2 * t * (pe.x - c.x), ty = 2 * (1 - t) * (c.y - pa.y) + 2 * t * (pe.y - c.y), tl = Math.hypot(tx, ty) || 1;
    var side = bend >= 0 ? 1 : -1, sx = qx + (-ty / tl) * 10 * side, sy = qy + (tx / tl) * 10 * side;
    g.appendChild(el('circle', { cx: sx, cy: sy, r: 6.5, 'class': 'pol-bg' }));
    g.appendChild(el('text', { x: sx, y: sy + 4, 'text-anchor': 'middle', 'class': 'pol' }, L.polarity === '+' ? '+' : MINUS));
    if (L.delay) {
      var t2 = 0.5, dx2 = 2 * (1 - t2) * (c.x - pa.x) + 2 * t2 * (pe.x - c.x), dy2 = 2 * (1 - t2) * (c.y - pa.y) + 2 * t2 * (pe.y - c.y), d2 = Math.hypot(dx2, dy2) || 1;
      var px = 0.25 * pa.x + 0.5 * c.x + 0.25 * pe.x, py = 0.25 * pa.y + 0.5 * c.y + 0.25 * pe.y;
      var ux = dx2 / d2, uy = dy2 / d2, nx2 = -uy * 6, ny2 = ux * 6;
      [-2.5, 2.5].forEach(function (o) { g.appendChild(el('line', { x1: px + ux * o - nx2, y1: py + uy * o - ny2, x2: px + ux * o + nx2, y2: py + uy * o + ny2, 'class': 'delay' })); });
    }
    layers.links.appendChild(g);
    linkEls.push({ L: L, g: g, path: path });
  });

  // ---------- loop markers
  var loopEls = {};
  M.loops.forEach(function (lp) {
    var p = own(LOOP_POS, lp.id);
    if (!p) {
      var pts = lp.path.map(function (id) { return POS[id]; }).filter(Boolean);
      if (!pts.length) return;
      p = { x: pts.reduce(function (s, q) { return s + q.x; }, 0) / pts.length, y: pts.reduce(function (s, q) { return s + q.y; }, 0) / pts.length };
    }
    var g = el('g', { 'class': 'loop-mark type-' + lp.type, 'data-id': lp.id, tabindex: '0', role: 'button', 'aria-label': (lp.type === 'R' ? 'Reinforcing' : 'Balancing') + ' loop ' + lp.id + ': ' + lp.name });
    var r = 15;
    g.appendChild(el('path', { d: 'M' + (p.x + r) + ',' + p.y + ' A' + r + ',' + r + ' 0 1 1 ' + (p.x + r * Math.cos(-0.9)) + ',' + (p.y + r * Math.sin(-0.9)), 'class': 'loop-arc', 'marker-end': 'url(#arrow-' + lp.type + ')' }));
    g.appendChild(el('text', { x: p.x, y: p.y + 4.5, 'text-anchor': 'middle', 'class': 'loop-id' }, lp.id));
    g.appendChild(el('text', { x: p.x, y: p.y + r + 14, 'text-anchor': 'middle', 'class': 'loop-name' }, lp.name));
    layers.loops.appendChild(g); loopEls[lp.id] = g;
  });

  // ---------- interaction
  var panel = document.getElementById('detail');
  var stageNote = document.getElementById('stage-note');
  function future(stage) { return sIdx(stage) > sIdx(state.stage); }
  function loopEdges(lp) { var s = Object.create(null); for (var i = 0; i < lp.path.length; i++) s[lp.path[i] + '>' + lp.path[(i + 1) % lp.path.length]] = true; return s; }
  function cls(e, fut, hot, dim) {
    if (!e) return;
    e.classList.toggle('is-future', !!fut); e.classList.toggle('is-hidden', !!fut && !state.ghost);
    e.classList.toggle('is-hot', !!hot); e.classList.toggle('is-dim', !!dim);
  }
  function update() {
    var lp = null;
    M.loops.forEach(function (l) { if (l.id === state.loop) lp = l; });
    var lpNodes = Object.create(null), lpEdges = lp ? loopEdges(lp) : Object.create(null);
    if (lp) lp.path.forEach(function (id) { lpNodes[id] = true; });
    var focusN = state.node, nbr = Object.create(null);
    if (focusN) M.links.forEach(function (L) { if (L.from === focusN || L.to === focusN) { nbr[L.from] = true; nbr[L.to] = true; } });
    M.nodes.forEach(function (n) {
      var e = nodeEls[n.id] || flowEls[n.id];
      var hot = lp ? !!lpNodes[n.id] : focusN ? (n.id === focusN || !!nbr[n.id]) : false;
      cls(e, future(n.stage), hot, (lp || focusN) && !hot);
      if (e) { e.classList.remove('loop-R', 'loop-B'); if (lp && hot) e.classList.add('loop-' + lp.type); }
    });
    linkEls.forEach(function (x) {
      if (!x.g) return;
      var L = x.L, k = L.from + '>' + L.to;
      var hot = lp ? !!lpEdges[k] : focusN ? (L.from === focusN || L.to === focusN) : false;
      var fut = future(L.stage) || future(byId[L.from] && byId[L.from].stage) || future(byId[L.to] && byId[L.to].stage);
      cls(x.g, fut, hot, (lp || focusN) && !hot);
      x.g.classList.remove('loop-R', 'loop-B'); if (lp && hot) x.g.classList.add('loop-' + lp.type);
      x.path.setAttribute('marker-end', hot ? (lp ? 'url(#arrow-' + lp.type + ')' : 'url(#arrow-focus)') : 'url(#arrow)');
    });
    M.loops.forEach(function (l) { cls(loopEls[l.id], future(l.stage), lp && l.id === lp.id, lp && l.id !== lp.id); });
    Array.prototype.forEach.call(document.querySelectorAll('.chip'), function (c) {
      c.setAttribute('aria-pressed', String(c.getAttribute('data-id') === state.loop));
      var l = null; M.loops.forEach(function (x) { if (x.id === c.getAttribute('data-id')) l = x; });
      c.classList.toggle('is-future', !!(l && future(l.stage)));
    });
    Array.prototype.forEach.call(document.querySelectorAll('.stage-btn'), function (b) { b.setAttribute('aria-checked', String(b.getAttribute('data-id') === state.stage)); });
    var st = stages[sIdx(state.stage)];
    var live = M.loops.filter(function (l) { return !future(l.stage); });
    var nb = live.filter(function (l) { return l.type === 'B'; }).length, nr = live.length - nb;
    stageNote.innerHTML = (hasStages ? '<strong>' + esc(st.label || st.id) + '.</strong> ' + esc(st.summary || '') + ' ' : '') +
      '<span class="count">' + nb + ' balancing ' + DOT + ' ' + nr + ' reinforcing ' + (nb + nr === 1 ? 'loop' : 'loops') + (hasStages ? ' live' : '') + '</span>';
    renderPanel(lp, focusN);
  }
  function stageTag(s) { return hasStages && s != null ? '<span class="tag' + (future(s) ? ' tag-future' : '') + '">' + esc(s) + '</span>' : ''; }
  function refsLine(refs) { return refs && refs.length ? '<p class="meta"><span>Sources</span>' + refs.map(esc).join(', ') + '</p>' : ''; }
  var EVIDENCE = { documented: 'documented', inferred: 'inferred', hypothesis: 'hypothesis' };
  function count(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function renderPanel(lp, nid) {
    if (lp) {
      var chain = lp.path.map(function (id) { return esc(byId[id] ? byId[id].name : id); }).join(' <span class="arr">' + ARROW + '</span> ') + ' <span class="arr">' + CYCLE + '</span>';
      panel.innerHTML = '<p class="eyebrow">' + (lp.type === 'R' ? 'Reinforcing' : 'Balancing') + ' loop ' + esc(lp.id) + ' ' + stageTag(lp.stage) + '</p>' +
        '<h2 class="' + (lp.type === 'R' ? 'c-r' : 'c-b') + '">' + esc(lp.name) + '</h2>' +
        (lp.story ? '<p>' + esc(lp.story) + '</p>' : '') + '<p class="chain">' + chain + '</p>' + refsLine(lp.refs);
      return;
    }
    if (nid) {
      var n = byId[nid];
      var ins = M.links.filter(function (L) { return L.to === nid; }), outs = M.links.filter(function (L) { return L.from === nid; });
      var li = function (L) {
        var other = byId[L.from === nid ? L.to : L.from];
        var ev = L.evidence === 'documented' ? '' : ' <em>(' + esc(L.evidence ? (EVIDENCE[L.evidence] || L.evidence) : 'untagged') + ')</em>';
        return '<li><span class="pol-chip">' + (L.polarity === '+' ? '+' : MINUS) + '</span> ' + esc(other ? other.name : '') + (L.delay ? ' <em>(delayed)</em>' : '') + ev +
          (L.mechanism ? '<br><small>' + esc(L.mechanism) + '</small>' : '') + '</li>';
      };
      var kinds = { stock: 'Stock', flow: 'Flow', auxiliary: 'Variable', parameter: 'Setting', exogenous: 'Outside driver', decision: 'Human decision', cloud: 'Outside the system' };
      panel.innerHTML = '<p class="eyebrow">' + esc(kinds[n.kind] || n.kind) + ' ' + stageTag(n.stage) + '</p><h2>' + esc(n.name) + '</h2>' +
        (n.meaning ? '<p>' + esc(n.meaning) + '</p>' : '') +
        (n.unit ? '<p class="meta"><span>Measured in</span>' + esc(n.unit) + '</p>' : '') +
        (n.kind === 'flow' ? '<p class="meta"><span>Moves</span>' + esc(byId[n.flow_from] ? byId[n.flow_from].name : n.flow_from) + ' ' + ARROW + ' ' + esc(byId[n.flow_to] ? byId[n.flow_to].name : n.flow_to) + '</p>' : '') +
        (ins.length ? '<h3>Driven by</h3><ul class="links">' + ins.map(li).join('') + '</ul>' : '') +
        (outs.length ? '<h3>Drives</h3><ul class="links">' + outs.map(li).join('') + '</ul>' : '') + refsLine(n.refs);
      return;
    }
    var item = function (l) { return '<li><b class="' + (l.type === 'R' ? 'c-r' : 'c-b') + '">' + esc(l.id) + '</b> ' + esc(l.name) + (hasStages && l.stage != null ? ' <span class="tag' + (future(l.stage) ? ' tag-future' : '') + '">' + esc(l.stage) + '</span>' : '') + '</li>'; };
    panel.innerHTML = '<p class="eyebrow">How to read it</p><h2>' + esc(count(M.loops.length, 'feedback loop')) + '</h2>' +
      (M.meta && M.meta.overview ? '<p>' + esc(M.meta.overview) + '</p>' : '') +
      '<p>Boxes accumulate; pipes fill and drain them. <b class="c-r">R</b> loops amplify change, <b class="c-b">B</b> loops hold it in check.' + (hasStages ? ' Step back through the stages to watch the system grow.' : '') + ' Select any loop, box or variable to trace it.</p>' +
      (M.loops.length ? '<ul class="plain">' + M.loops.map(item).join('') + '</ul>' : '');
  }

  // ---------- controls
  var stageBar = document.getElementById('stages');
  if (!hasStages) { var ctl = document.getElementById('stage-controls'); if (ctl) ctl.hidden = true; }
  stages.forEach(function (s) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'stage-btn'; b.setAttribute('data-id', s.id); b.setAttribute('role', 'radio');
    b.textContent = s.label && s.label.length <= 16 ? s.label : s.id; b.title = (s.label || s.id) + (s.summary ? ': ' + s.summary : '');
    b.addEventListener('click', function () { state.stage = s.id; update(); });
    stageBar.appendChild(b);
  });
  stageBar.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var i = sIdx(state.stage) + (e.key === 'ArrowRight' ? 1 : -1);
    if (i >= 0 && i < stageOrder.length) { state.stage = stageOrder[i]; update(); var nb = stageBar.querySelector('[data-id="' + CSS.escape(state.stage) + '"]'); if (nb) nb.focus(); }
    e.preventDefault();
  });
  var chips = document.getElementById('chips');
  M.loops.forEach(function (l) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip chip-' + l.type; b.setAttribute('data-id', l.id);
    var idSpan = document.createElement('span'); idSpan.className = 'chip-id'; idSpan.textContent = l.id;
    b.appendChild(idSpan); b.appendChild(document.createTextNode(l.name));
    b.addEventListener('click', function () { state.loop = state.loop === l.id ? null : l.id; state.node = null; update(); });
    chips.appendChild(b);
  });
  document.getElementById('ghost').addEventListener('change', function (e) { state.ghost = e.target.checked; update(); });
  document.getElementById('clear').addEventListener('click', function () { state.loop = null; state.node = null; update(); });
  function pick(target) {
    var n = target.closest('[data-id]'); if (!n || !svg.contains(n)) return false;
    var id = n.getAttribute('data-id');
    if (n.classList.contains('loop-mark')) { state.loop = state.loop === id ? null : id; state.node = null; }
    else { state.node = state.node === id ? null : id; state.loop = null; }
    update(); return true;
  }
  svg.addEventListener('click', function (e) { if (!pick(e.target)) { state.loop = null; state.node = null; update(); } });
  svg.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && pick(e.target)) e.preventDefault(); });
  update();
})();
