// The page: one HTML file, ASCII only, whose window.DATA renderPage fills. A port of the reference repository's
// page template. It sits in String.raw, so its script uses no backtick (regexes write it \x60) and no dollar-brace.
export const TEMPLATE = String.raw`<title>Route Map</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600&family=Barlow+Semi+Condensed:wght@600;800&display=swap">
<!--
  The page's template. renderPage (hooks/core/page.ts) fills window.DATA from the backlog, the playbook and the
  commit they were read at, and nothing else: every row below is a row of those files. Keep this file ASCII
  (characters outside it are written as \u escapes or entities), so the page reads the same however a browser
  guesses its encoding. The page reads no clock and no network: the same data gives the same page.
-->
<style>
/* hallmark: wayfinding board, one colour per line, labels in the body face, lanes first */
/* A wayfinding board: each user path is a metro line, its milestones are stations, and rows are stops. */
:root {
  --bg: #f2f3f1;
  --panel: #ffffff;
  --ink: #1d2321;
  --muted: #5d6662;
  --rule: #d6dad6;
  --accent: #7a4a26;
  --accent-ink: #ffffff;
  --ok: #2f7a4d;            /* can land now */
  --stop: #b23b2a;          /* waits on another row */
  --wait: #9a6a0c;          /* needs something not there today */
  --ask: #2c5aa0;           /* a small choice of the owner's */
  --done: #8a918d;
  --chip: #e7eae7;
  --focus: #2c5aa0;
  --l1: #c0392b; --l2: #1f6fb2; --l3: #2f8f4e; --l4: #8e44ad; --l5: #c27a0e; --l6: #00838f;
  --display: "Barlow Semi Condensed", "Trebuchet MS", system-ui, sans-serif;
  --body: "Barlow", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: ui-monospace, "Cascadia Mono", Consolas, monospace;
  --s-1: 0.8125rem; --s0: 0.9375rem; --s1: 1.0625rem; --s2: 1.3rem; --s3: 1.75rem; --s4: 2.4rem;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #141716; --panel: #1c201e; --ink: #e7e9e6; --muted: #a2aaa5; --rule: #323835;
    --accent: #c98c5a; --accent-ink: #1a120c; --ok: #5fbf86; --stop: #ec7e6a; --wait: #e2b24e; --ask: #84aaf0; --done: #7c8480;
    --chip: #262b29; --focus: #84aaf0; color-scheme: dark;
    --l1: #ee7a6b; --l2: #6fb0ec; --l3: #66c487; --l4: #c58ce0; --l5: #e8b04e; --l6: #4fc3cf;
  }
}
:root[data-theme="dark"] {
  --bg: #141716; --panel: #1c201e; --ink: #e7e9e6; --muted: #a2aaa5; --rule: #323835;
  --accent: #c98c5a; --accent-ink: #1a120c; --ok: #5fbf86; --stop: #ec7e6a; --wait: #e2b24e; --ask: #84aaf0; --done: #7c8480;
  --chip: #262b29; --focus: #84aaf0; color-scheme: dark;
  --l1: #ee7a6b; --l2: #6fb0ec; --l3: #66c487; --l4: #c58ce0; --l5: #e8b04e; --l6: #4fc3cf;
}
* { box-sizing: border-box; }
html, body { overflow-x: clip; }
body { background: var(--bg); color: var(--ink); font-family: var(--body); font-size: var(--s0); line-height: 1.5; margin: 0; }
.wrap { max-width: 1240px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 20px 56px; }
h1, h2, h3 { font-family: var(--display); text-wrap: balance; margin: 0; letter-spacing: -0.01em; }
h1 { font-size: var(--s4); font-weight: 800; line-height: 1.05; }
h3 { font-size: var(--s1); font-weight: 700; line-height: 1.25; }
p { margin: 0; }
a { color: var(--accent); }
button, select { font: inherit; color: inherit; }
code { font-family: var(--mono); font-size: 0.88em; background: var(--chip); padding: 0 4px; border-radius: 3px; overflow-wrap: anywhere; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.mono { font-family: var(--mono); font-size: var(--s-1); }
.muted { color: var(--muted); }
.label { font-weight: 600; font-size: var(--s-1); color: var(--muted); }

/* Theme switch: System / Light / Dark. */
.theme { display: inline-flex; border: 1px solid var(--rule); border-radius: 999px; overflow: hidden; justify-self: start; }
.theme button { background: none; border: 0; padding: 3px 12px 2px; font-size: var(--s-1); cursor: pointer; }
.theme button[aria-pressed="true"] { background: var(--ink); color: var(--bg); }

/* Header: a guide sign. */
.sign { display: grid; gap: 14px; grid-template-columns: 1fr; align-items: end; padding-block: 8px 18px; border-bottom: 3px solid var(--ink); }
.sign .plate { display: inline-flex; align-items: center; gap: 10px; background: var(--accent); color: var(--accent-ink); font-family: var(--display); font-weight: 800; font-size: var(--s0); padding: 5px 10px 3px; border-radius: 4px; max-width: 100%; overflow-wrap: anywhere; }
.sign .plate .shield { width: 14px; height: 16px; flex: none; background: var(--accent-ink); clip-path: polygon(50% 0, 100% 18%, 92% 72%, 50% 100%, 8% 72%, 0 18%); }
.sign .lede { max-width: 68ch; color: var(--muted); font-size: var(--s1); }
.asof { font-family: var(--mono); font-size: var(--s-1); color: var(--muted); overflow-wrap: anywhere; }
/* The counts line: each number a way into its view. */
.counts { display: flex; flex-wrap: wrap; gap: 4px 18px; align-items: baseline; }
.count { border: 0; background: none; padding: 0; cursor: pointer; color: var(--muted); text-align: left; }
.count b { font-family: var(--display); font-weight: 800; font-size: var(--s2); color: var(--ink); font-variant-numeric: tabular-nums; text-decoration: underline; text-decoration-color: var(--rule); text-underline-offset: 4px; }
.count:hover b { text-decoration-color: currentColor; }
/* "and N more" and "more": the rest of a long list or text, on request. */
button.more { justify-self: start; border: 1px solid var(--rule); background: var(--bg); border-radius: 999px; padding: 3px 12px 2px; font-size: var(--s-1); cursor: pointer; }
button.more:hover { border-color: var(--ink); }
.stops + .stops { margin-top: 8px; }

/* Mile markers: the numbers, as sums that add up. */
.strips { display: grid; gap: 14px; margin-block: 14px 6px; }
.trust { margin-top: 44px; padding-top: 18px; border-top: 3px solid var(--ink); }
.trust h2 { font-size: var(--s3); font-weight: 800; }
.trust .lede { color: var(--muted); }
.strip { display: grid; gap: 6px; min-width: 0; }
.eq { display: flex; flex-wrap: wrap; gap: 8px; align-items: stretch; }
.op { align-self: center; font-family: var(--display); font-weight: 800; font-size: var(--s2); color: var(--muted); flex: none; }
.marker { flex: 1 1 96px; min-width: 0; background: var(--panel); border: 1px solid var(--rule); border-radius: 6px; padding: 10px 12px; display: grid; gap: 2px; text-align: left; cursor: pointer; align-content: start; }
.marker:hover { border-color: var(--ink); }
.marker.static { cursor: default; }
.marker.static:hover { border-color: var(--rule); }
.marker b { font-family: var(--display); font-size: var(--s3); font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; }
.marker span { color: var(--muted); font-size: var(--s-1); }

/* Tabs. */
.tabs { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg); display: flex; gap: 4px; overflow-x: auto; padding-block: 10px; border-bottom: 1px solid var(--rule); margin-bottom: 18px; scrollbar-width: thin; }
.tab { flex: none; border: 1px solid transparent; background: transparent; border-radius: 999px; padding: 6px 14px 4px; font-family: var(--display); font-weight: 700; cursor: pointer; color: var(--muted); }
.tab[aria-selected="true"] { background: var(--ink); color: var(--bg); }
.tab:hover:not([aria-selected="true"]) { border-color: var(--rule); color: var(--ink); }

.legend { display: flex; flex-wrap: wrap; gap: 14px; font-size: var(--s-1); color: var(--muted); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }

/* Stops: a row's shape and colour say its state. */
.stop { width: 14px; height: 14px; flex: none; display: inline-block; }
.st-ready { background: var(--ok); border-radius: 50%; }
.st-blocked { background: var(--stop); border-radius: 2px; }
.st-waiting { border: 3px solid var(--wait); border-radius: 50%; background: var(--panel); }
.st-choice { background: var(--ask); transform: rotate(45deg) scale(0.85); border-radius: 2px; }

/* Lanes: one metro line per user path, its milestones as stations. */
.lanes { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 16px; align-items: start; }
.lane:nth-child(6n+1) { --line: var(--l1); } .lane:nth-child(6n+2) { --line: var(--l2); } .lane:nth-child(6n+3) { --line: var(--l3); }
.lane:nth-child(6n+4) { --line: var(--l4); } .lane:nth-child(6n+5) { --line: var(--l5); } .lane:nth-child(6n) { --line: var(--l6); }
.lane { --line: var(--accent); background: var(--panel); border: 1px solid var(--rule); border-radius: 8px; overflow: hidden; min-width: 0; border-top: 6px solid var(--line); }
.lane > header { padding: 14px 16px 12px; display: grid; gap: 6px; border-bottom: 1px solid var(--rule); }
.lane .when { font-size: var(--s-1); font-weight: 600; color: var(--ink); }
.lane h3 { font-size: var(--s2); }
.lane .none { padding: 12px 16px 14px; color: var(--muted); font-size: var(--s-1); }
.status { color: var(--muted); font-size: var(--s-1); overflow-wrap: anywhere; }
.metro { list-style: none; margin: 0; padding: 12px 16px 14px; }
.station { position: relative; display: grid; grid-template-columns: 22px 1fr; gap: 10px; padding-block: 8px; }
.station::before { content: ""; position: absolute; left: 9px; top: 0; bottom: 0; width: 6px; margin-left: -1px; background: var(--line); }
.station:first-child::before { top: 18px; }
.station:last-child::before { bottom: calc(100% - 18px); }
.station:only-child::before { display: none; }
.station .dot { position: relative; z-index: 1; width: 22px; height: 22px; border-radius: 50%; border: 4px solid var(--line); background: var(--panel); margin-top: 2px; }
.station.reached .dot { background: var(--line); }
.station.next .dot { box-shadow: 0 0 0 4px color-mix(in srgb, var(--line) 30%, transparent); }
.station.reached .sname { color: var(--muted); }
.sbody { display: grid; gap: 6px; min-width: 0; }
.sname { font-family: var(--display); font-weight: 800; font-size: var(--s1); display: flex; flex-wrap: wrap; gap: 6px; align-items: center; overflow-wrap: anywhere; }
.stops, .items { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.stops li, .items li { display: grid; grid-template-columns: 16px 1fr; gap: 8px; align-items: start; }
.stops li .stop, .items li .stop { margin-top: 4px; }
.items li { background: var(--panel); border: 1px solid var(--rule); border-radius: 8px; padding: 10px 12px; }
button.go { text-align: left; background: none; border: 0; padding: 0; cursor: pointer; display: grid; gap: 2px; min-width: 0; }
button.go:hover .t { text-decoration: underline; text-underline-offset: 3px; }
.t { font-size: var(--s0); line-height: 1.35; overflow-wrap: anywhere; }
.who { font-family: var(--mono); font-size: 0.72rem; color: var(--muted); overflow-wrap: anywhere; }
/* Which file holds a row. */
.src { display: inline-block; font-family: var(--mono); font-size: 0.66rem; font-weight: 600; line-height: 1.35; padding: 0 5px; border-radius: 3px; margin-right: 6px; vertical-align: 1px; color: var(--ink); }
.src-b { background: var(--chip); border: 1px solid var(--rule); }
.src-p { background: color-mix(in srgb, var(--accent) 24%, var(--panel)); border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--panel)); }
.trig { font-size: var(--s-1); color: var(--muted); line-height: 1.35; overflow-wrap: anywhere; }

/* Cards, pills and chips. */
.card { background: var(--panel); border: 1px solid var(--rule); border-radius: 8px; padding: 16px; display: grid; gap: 10px; min-width: 0; align-content: start; overflow-wrap: anywhere; }
.card .meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.where p + p { margin-top: 4px; }
.pill { display: inline-flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 0.72rem; padding: 2px 8px 1px; border-radius: 999px; background: var(--chip); color: var(--ink); white-space: nowrap; }
.pill.ok { background: color-mix(in srgb, var(--ok) 18%, var(--panel)); }
.pill.stop { background: color-mix(in srgb, var(--stop) 18%, var(--panel)); }
.pill.wait { background: color-mix(in srgb, var(--wait) 22%, var(--panel)); }
.pill.ask { background: color-mix(in srgb, var(--ask) 18%, var(--panel)); }
.pill.accent { background: var(--accent); color: var(--accent-ink); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { border: 1px solid var(--rule); background: var(--bg); border-radius: 4px; padding: 3px 8px 2px; font-size: var(--s-1); cursor: pointer; text-align: left; max-width: 100%; overflow-wrap: anywhere; }
.chip:hover { border-color: var(--ink); }
.chip .cid { font-family: var(--mono); font-size: 0.72rem; color: var(--muted); margin-right: 6px; }
span.chip { cursor: default; }
span.chip:hover { border-color: var(--rule); }
.chip.isdone { color: var(--muted); }
.chip.isdone::before { content: "\2713\00a0"; color: var(--ok); font-weight: 700; }
.chip.missing { color: var(--stop); border-style: dashed; }
.prio { display: inline-block; font-family: var(--mono); font-size: 0.68rem; font-weight: 600; line-height: 1.35; padding: 0 5px; border-radius: 3px; border: 1px solid var(--muted); color: var(--ink); white-space: nowrap; vertical-align: 1px; margin-right: 6px; }
.queue { display: grid; gap: 10px; }
.qrow { background: var(--panel); border: 1px solid var(--rule); border-radius: 8px; padding: 12px 14px; display: grid; grid-template-columns: 2.2rem 1fr; gap: 10px; align-items: start; }
.qrow .n { font-family: var(--display); font-weight: 800; font-size: var(--s2); color: var(--accent); font-variant-numeric: tabular-nums; }
.body { display: grid; gap: 6px; min-width: 0; }
.qrow .go .t { font-weight: 700; }
.bar { height: 6px; border-radius: 3px; background: var(--chip); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--ask); }
.delta { display: grid; gap: 4px; }

/* Checklists. */
.checks { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.checks li { background: var(--panel); border: 1px solid var(--rule); border-radius: 8px; padding: 10px 12px; display: grid; grid-template-columns: 1.4rem 1fr; gap: 8px; align-items: start; }
.checks .txt { display: grid; gap: 8px; min-width: 0; overflow-wrap: anywhere; }
.box { width: 16px; height: 16px; border: 2px solid var(--muted); border-radius: 3px; margin-top: 3px; }

/* Choosers and tables. */
.filters { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.filters select { font-size: var(--s-1); padding: 6px 10px; border: 1px solid var(--rule); border-radius: 6px; background: var(--panel); color: var(--ink); min-width: 0; max-width: 100%; }
.tablewrap { overflow-x: auto; border: 1px solid var(--rule); border-radius: 8px; background: var(--panel); }
table { border-collapse: collapse; width: 100%; font-size: var(--s-1); }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--rule); vertical-align: top; }
th { font-weight: 600; font-size: var(--s-1); color: var(--muted); position: sticky; top: 0; background: var(--panel); }
td.wide { min-width: 16rem; }

/* Row detail. */
.scrim { position: fixed; inset: 0; background: color-mix(in srgb, var(--ink) 35%, transparent); z-index: 20; }
.drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(560px, 100%); background: var(--panel); z-index: 21; border-left: 1px solid var(--rule); display: grid; grid-template-rows: auto 1fr; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); padding-right: env(safe-area-inset-right, 0px); }
.drawer header { display: flex; justify-content: space-between; gap: 12px; align-items: start; padding: 16px 18px 12px; border-bottom: 1px solid var(--rule); }
.drawer header > div { min-width: 0; overflow-wrap: anywhere; }
.drawer .body { overflow-y: auto; padding: 16px 18px 28px; display: grid; gap: 14px; align-content: start; }
.drawer dl { display: grid; grid-template-columns: 8.5rem 1fr; gap: 6px 12px; margin: 0; }
.drawer dt { color: var(--muted); font-size: var(--s-1); }
.drawer dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.close { border: 1px solid var(--rule); background: var(--bg); border-radius: 6px; padding: 4px 10px 2px; cursor: pointer; }
[hidden] { display: none !important; }
.section { display: grid; gap: 14px; }
.section + .section { margin-top: 28px; }
.intro { max-width: 72ch; color: var(--muted); }
ul.plain { margin: 0; padding-left: 1.1rem; display: grid; gap: 4px; overflow-wrap: anywhere; }
.empty { padding: 18px; border: 1px dashed var(--rule); border-radius: 8px; color: var(--muted); }
@media (max-width: 640px) {
  h1 { font-size: var(--s3); }
  .drawer dl { grid-template-columns: 1fr; }
  .marker b { font-size: var(--s2); }
}
@media (prefers-reduced-motion: no-preference) {
  .drawer { animation: slide 160ms ease-out; }
  @keyframes slide { from { transform: translateX(24px); opacity: 0.6; } }
}
</style>

<script>
// Apply the viewer's stored theme before the first paint; a convenience only, so a failing store changes nothing.
try { const t = localStorage.getItem('housekeeping.theme'); if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); } catch (e) { /* follow the system */ }
</script>
<div class="wrap">
  <header class="sign">
    <span class="plate"><i class="shield"></i><span id="plate">route map</span></span>
    <h1 id="heading">Route Map</h1>
    <p class="counts" id="counts"></p>
    <p class="lede" id="lede"></p>
    <p class="asof" id="asof"></p>
    <div class="theme" role="group" aria-label="Theme">
      <button type="button" id="theme-system" aria-pressed="true">System</button>
      <button type="button" id="theme-light" aria-pressed="false">Light</button>
      <button type="button" id="theme-dark" aria-pressed="false">Dark</button>
    </div>
  </header>

  <nav class="tabs" role="tablist" aria-label="Views" id="tabs"></nav>

  <main id="views"></main>

  <section class="trust" aria-labelledby="trusth">
    <h2 id="trusth">Can I trust it?</h2>
    <p class="lede">Every number is computed from the open rows, and each sum adds up.</p>
    <div class="strips" id="markers"></div>
  </section>
</div>

<div class="scrim" id="scrim" hidden></div>
<aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="dtitle" hidden>
  <header><div><p class="label" id="dkind"></p><h3 id="dtitle"></h3></div><button class="close" id="dclose" type="button">Close</button></header>
  <div class="body" id="dbody"></div>
</aside>

<script>
window.DATA = /*DATA*/null;
</script>
<script>
(() => {
  'use strict';
  // DOM use is kept to: createElement, createTextNode, querySelector('#id'), append, replaceChildren,
  // setAttribute, removeAttribute, documentElement, addEventListener, textContent, children, hidden and focus (the tests' stub DOM has only these).
  const D = window.DATA;
  const $ = (id) => document.querySelector('#' + id);
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(typeof k === 'object' ? k : document.createTextNode(String(k)));
    return el;
  };
  const SEP = ', ';
  const DOT = ' \u00b7 '; // only the drawer's kind line: the tests' stub DOM splits on it
  const n = (k, one, many) => k + ' ' + (k === 1 ? one : many);
  const rows = new Map(D.rows.map((r) => [r.id, r]));
  const closed = new Map();
  for (const e of D.done) for (const id of e.ids) closed.set(id, e);
  const FILES = { backlog: ['src-b', 'Backlog'], playbook: ['src-p', 'Playbook'] };

  /** A cell's inline Markdown as nodes: bold, emphasis, code, links and line breaks; never as HTML. */
  function md(text) {
    const s = String(text == null ? '' : text);
    const out = [];
    const re = /\*\*([^*]+)\*\*|\x60([^\x60]+)\x60|\[([^\]]+)\]\(([^)\s]+)\)|(<br\s*\/?>)|\*([^*\s][^*]*)\*/gi;
    let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push(s.slice(last, m.index));
      if (m[1] !== undefined) out.push(h('strong', {}, m[1]));
      else if (m[2] !== undefined) out.push(h('code', {}, m[2]));
      else if (m[3] !== undefined) out.push(/^https?:\/\//i.test(m[4]) ? h('a', { href: m[4], target: '_blank', rel: 'noopener noreferrer' }, m[3]) : h('span', { title: m[4] }, m[3]));
      else if (m[5] !== undefined) out.push(h('br'));
      else out.push(h('em', {}, m[6]));
      last = re.lastIndex;
    }
    if (last < s.length) out.push(s.slice(last));
    return out;
  }
  const plain = (s) => String(s == null ? '' : s).replace(/\*\*|\x60/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/<br\s*\/?>/gi, ' ');

  const STATE = { ready: ['st-ready', 'Can land now'], choice: ['st-choice', "Waits on a small choice of the owner's"], blocked: ['st-blocked', 'Waits on another open row'], waiting: ['st-waiting', 'Needs something not there today'] };
  const stateOf = (r) => r.landNow === 'yes' ? 'ready' : r.landNow === 'choice' ? 'choice' : r.waitsOn.some((w) => rows.has(w)) ? 'blocked' : 'waiting';
  const stop = (s) => h('i', { class: 'stop ' + STATE[s][0], 'aria-hidden': 'true' });
  const LAND = { yes: ['ok', 'yes'], choice: ['ask', 'small choice'], no: ['', 'no'] };
  const landPill = (r) => h('span', { class: 'pill ' + LAND[r.landNow][0] }, 'Land now: ' + LAND[r.landNow][1]);
  const prio = (r) => r.priority ? h('span', { class: 'prio', title: 'Priority: ' + r.priority }, r.priority) : null;
  const fileTag = (r) => h('span', { class: 'src ' + FILES[r.file][0] }, FILES[r.file][1]);

  // A button that opens a row; it is given the focus back when the row's detail closes.
  const opener = (id, attrs, ...kids) => {
    const b = h('button', Object.assign({ type: 'button' }, attrs), ...kids);
    b.addEventListener('click', () => openRow(id, b));
    return b;
  };
  /** A row's chip: opens the row; a closed row (in a Done table) or an ID no row has is shown as such. */
  function chipFor(id) {
    const r = rows.get(id);
    if (r) return opener(id, { class: 'chip', 'aria-label': id + ': ' + plain(r.item) }, h('span', { class: 'cid' }, id), plain(r.item));
    const c = closed.get(id);
    if (c) return h('span', { class: 'chip isdone', title: 'Closed' + (c.landed ? ': ' + plain(c.landed) : '') }, id + ' (closed)');
    return h('span', { class: 'chip missing', title: 'No row has this ID' }, id + ' (no such row)');
  }
  const chips = (ids) => h('div', { class: 'chips' }, ids.map(chipFor));
  const section = (...kids) => h('div', { class: 'section' }, kids);
  const intro = (text) => h('p', { class: 'intro' }, text);
  const empty = (text) => h('p', { class: 'empty' }, text);

  // The header.
  $('plate').textContent = D.project + SEP + 'route map';
  $('heading').textContent = 'Where ' + D.project + ' stands, and where it goes next';
  $('lede').textContent = 'Every row here is an open row of the backlog or the playbook, and every number is computed from them.';
  $('asof').textContent = 'Built from commit ' + D.commit + ' (' + D.date + ').';

  // Mile markers: sums that add up, then subsets of the open rows, then what the format check found.
  const C = D.counts;
  // The counts line under the title: each number opens its view; "Can I trust it?" below shows how they add up.
  const count = (k, text, tab) => h('button', { class: 'count', type: 'button', onclick: () => show(tab) }, h('b', {}, String(k)), ' ' + text);
  $('counts').replaceChildren(count(C.open, 'open', 'lanes'), count(C.yes, 'land now', 'land'), count(C.choice, 'small choice', 'queue'),
    count(C.needYou, 'need you', 'queue'), count(D.doors.length, 'doors just opened', 'doors'));
  const marker = (k, text, tab) => tab
    ? h('button', { class: 'marker', type: 'button', onclick: () => show(tab) }, h('b', {}, String(k)), h('span', {}, text))
    : h('div', { class: 'marker static' }, h('b', {}, String(k)), h('span', {}, text));
  const op = (s) => h('span', { class: 'op', 'aria-hidden': 'true' }, s);
  const strip = (title, ...kids) => h('section', { class: 'strip', 'aria-label': title }, h('p', { class: 'label' }, title), h('div', { class: 'eq' }, kids));
  const level = (l) => D.findings.filter((f) => f.level === l).length;
  const strips = [
    strip('Rows in all = closed + open (' + C.all + ' = ' + C.closed + ' + ' + C.open + ')',
      marker(C.all, 'rows in all'), op('='), marker(C.closed, 'closed (the Done tables)', 'done'), op('+'), marker(C.open, 'open')),
    strip('The open rows by Land now (' + C.open + ' = ' + C.yes + ' + ' + C.choice + ' + ' + C.no + ')',
      marker(C.open, 'open'), op('='), marker(C.yes, 'yes: an agent can land it now', 'land'), op('+'),
      marker(C.choice, "small choice: after one choice of the owner's", 'queue'), op('+'), marker(C.no, 'no: needs something not there today', 'doors')),
    strip('The open rows by file (' + C.open + ' = ' + C.perFile.backlog.open + ' + ' + C.perFile.playbook.open + ')',
      marker(C.open, 'open'), op('='), marker(C.perFile.backlog.open, 'in the backlog'), op('+'), marker(C.perFile.playbook.open, 'in the playbook')),
    strip('Subsets of the open rows (they overlap)',
      marker(C.needYou, 'need the owner (Who is owner or both)', 'queue'), marker(C.waitsOnRow, 'wait on another open row', 'doors'), marker(C.noMilestone, 'no milestone: they wait for their trigger')),
  ];
  if (D.findings.length) strips.push(strip('What the format check found',
    marker(level('error'), 'errors', 'warnings'), marker(level('warning'), 'warnings', 'warnings'), marker(level('recommendation'), 'recommendations', 'warnings')));
  $('markers').replaceChildren(...strips);

  // Tabs; Not doing and Warnings only when they have something.
  const TABS = [['lanes', 'Lanes'], ['since', 'Changed since'], ['land', 'Land now'], ['queue', 'Your queue'], ['doors', 'Doors'], ['checklists', 'Checklists'], ['done', 'Done']];
  if (D.notDoing.length) TABS.push(['notdoing', 'Not doing']);
  if (D.findings.length) TABS.push(['warnings', 'Warnings']);
  const tabEls = {};
  $('tabs').replaceChildren(...TABS.map(([id, name]) => (tabEls[id] = h('button', { class: 'tab', role: 'tab', id: 'tab-' + id, 'aria-selected': 'false', 'aria-controls': 'views', type: 'button', onclick: () => show(id) }, name))));
  const views = $('views');
  function show(id) {
    for (const k in tabEls) tabEls[k].setAttribute('aria-selected', String(k === id));
    views.replaceChildren(RENDER[id]());
  }

  // Row detail.
  const drawer = $('drawer'), scrim = $('scrim');
  let back = null;
  function openRow(id, from) {
    const r = rows.get(id);
    if (!r) return;
    back = from || null;
    $('dkind').textContent = r.id + DOT + FILES[r.file][1] + DOT + r.section;
    $('dtitle').replaceChildren(...md(r.item));
    const dl = h('dl');
    const item = (k, ...v) => dl.append(h('dt', {}, k), h('dd', {}, v));
    item('Land now', landPill(r), r.landNowWhy ? [' ', md(r.landNowWhy)] : null);
    item('Who', r.who);
    item('Milestone', r.milestones.length ? r.milestones.map((m, k) => m + (k === 0 && r.milestones.length > 1 ? ' (main)' : '')).join('; ') : 'none');
    if (r.priority) item('Priority', r.priority);
    item('Trigger', md(r.trigger));
    if (r.defaultUntilDecided !== null) item('Default until decided', md(r.defaultUntilDecided));
    item('Filed', r.filed || 'not given');
    item('First seen', r.firstSeen ? r.firstSeen.date + SEP + r.firstSeen.sha + SEP + r.firstSeen.subject : 'not in the history read');
    item('Where', FILES[r.file][1] + ', line ' + r.line);
    item('Opens', n(r.opens, 'row', 'rows') + ' in all');
    const body = $('dbody');
    body.replaceChildren(dl, h('div', { class: 'section' }, h('p', { class: 'label' }, 'Details'), h('p', {}, r.details ? md(r.details) : 'None given.')));
    const links = (title, ids) => { if (ids.length) body.append(h('div', { class: 'section' }, h('p', { class: 'label' }, title), chips(ids))); };
    links('Waits on', r.waitsOn);
    links('Rows that wait on this one', r.unlocks);
    const named = D.checklists.filter((l) => l.ids.indexOf(id) >= 0);
    if (named.length) body.append(h('div', { class: 'section' }, h('p', { class: 'label' }, 'Named by checklist lines'),
      h('ul', { class: 'plain' }, named.map((l) => h('li', {}, (l.ticked ? '[x] ' : '[ ] ') + l.heading + (l.group ? ', ' + l.group : '') + ': ', md(l.text))))));
    drawer.hidden = false; scrim.hidden = false;
    $('dclose').focus();
  }
  function closeRow() { drawer.hidden = true; scrim.hidden = true; if (back) back.focus(); back = null; }
  $('dclose').addEventListener('click', closeRow);
  scrim.addEventListener('click', closeRow);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) closeRow(); });

  // A button that shows "more" (hidden until then) and, while it shows, hides "less"; and back again.
  const fold = (label, more, less) => {
    more.hidden = true;
    const b = h('button', { class: 'more', type: 'button', 'aria-expanded': 'false' }, label);
    b.addEventListener('click', () => {
      const open = more.hidden;
      more.hidden = !open;
      if (less) less.hidden = open;
      b.setAttribute('aria-expanded', String(open));
      b.textContent = open ? 'show less' : label;
    });
    return b;
  };
  // A station's first stops, and the rest behind "and N more".
  const STOPS = 5;
  const stopList = (ids) => {
    const first = h('ul', { class: 'stops' }, ids.slice(0, STOPS).map(stopItem));
    if (ids.length <= STOPS) return first;
    const rest = h('ul', { class: 'stops' }, ids.slice(STOPS).map(stopItem));
    return [first, rest, fold('and ' + (ids.length - STOPS) + ' more', rest)];
  };
  // Where we are, cut at the last space inside 600 characters as the short view is, the rest behind "more".
  const whereCard = (w) => {
    const paras = (t) => t.split('\n').map((l) => h('p', {}, md(l)));
    const card = h('section', { class: 'card where' }, h('p', { class: 'label' }, 'Where we are' + (w.date ? ', ' + w.date : '')));
    if (w.text.length <= 600) { card.append(...paras(w.text)); return card; }
    const cut = w.text.slice(0, 600).replace(/\s+\S*$/, '') || w.text.slice(0, 600);
    const short = h('div', {}, paras(cut + ' \u2026')), full = h('div', {}, paras(w.text));
    card.append(short, full, fold('more', full, short));
    return card;
  };

  const legend = () => h('div', { class: 'legend' }, Object.keys(STATE).map((k) => h('span', {}, stop(k), STATE[k][1])));
  const stopItem = (id) => {
    const r = rows.get(id);
    if (!r) return h('li', {}, h('span'), chipFor(id));
    const s = stateOf(r);
    return h('li', {}, stop(s), opener(id, { class: 'go', 'aria-label': id + ': ' + plain(r.item) + '. ' + STATE[s][1] + '. When: ' + plain(r.trigger) },
      h('span', { class: 't' }, plain(r.item)),
      h('span', { class: 'who' }, fileTag(r), prio(r), id + SEP + r.who + SEP + STATE[s][1].toLowerCase()),
      h('span', { class: 'trig' }, 'When: ' + plain(r.trigger))));
  };
  const station = (st, next) => h('li', { class: 'station' + (st.reached ? ' reached' : st.milestone === next ? ' next' : '') },
    h('i', { class: 'dot', 'aria-hidden': 'true' }),
    h('div', { class: 'sbody' },
      h('p', { class: 'sname' }, st.milestone, st.shared ? h('span', { class: 'pill' }, 'shared') : null,
        st.reached ? h('span', { class: 'pill ok' }, 'reached') : st.milestone === next ? h('span', { class: 'pill accent' }, 'next') : null),
      st.doneWhen ? h('p', { class: 'trig' }, 'Done when: ', md(st.doneWhen)) : null,
      h('p', { class: 'status' }, st.stops.length ? n(st.stops.length, 'open row', 'open rows') + ' before it' : 'No open row before it.'),
      st.gate ? h('p', { class: 'status' }, 'Longest chain of waits: ' + n(st.chain, 'row', 'rows') + ', from the gate ', chipFor(st.gate)) : null,
      st.stops.length ? stopList(st.stops) : null));

  // A numbered row with what it opens up, for Land now and the owner's queue.
  const qrow = (id, k, max, extra) => {
    const r = rows.get(id);
    return h('div', { class: 'qrow' }, h('span', { class: 'n' }, String(k + 1)), h('div', { class: 'body' },
      opener(id, { class: 'go' }, h('span', { class: 't' }, plain(r.item)), h('span', { class: 'who' }, fileTag(r), prio(r), id + SEP + 'who: ' + r.who + SEP + (r.milestones.join(', ') || 'no milestone'))),
      extra(r),
      r.opens ? [h('div', { class: 'bar', role: 'img', 'aria-label': 'opens ' + n(r.opens, 'row', 'rows') }, h('i', { style: 'width:' + Math.round((r.opens / max) * 100) + '%' })),
        h('p', { class: 'trig' }, 'Opens ' + n(r.opens, 'row', 'rows') + ' in all. Waiting on it directly:'), chips(r.unlocks)] : null));
  };
  const maxOpens = (ids) => Math.max(1, ...ids.map((id) => rows.get(id).opens));

  // Changed since: by default the last commit this viewer saw, kept in this browser as a convenience (the page
  // works without it), and then the newest is stored as seen. With none stored, ten commits back.
  const KEY = 'housekeeping.since.' + D.project;
  let sinceSha = null;
  try {
    sinceSha = localStorage.getItem(KEY);
    if (D.history.length) localStorage.setItem(KEY, D.history[0].sha);
  } catch (e) { /* a convenience only */ }

  // The Light / Dark / System switch: the choice is data-theme on the root (none = follow the system), kept per viewer.
  const THEME_KEY = 'housekeeping.theme';
  const root = document.documentElement;
  const setTheme = (t, save) => {
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
    for (const m of ['system', 'light', 'dark']) $('theme-' + m).setAttribute('aria-pressed', String(m === t || (m === 'system' && t !== 'light' && t !== 'dark')));
    if (save) { try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* a convenience only */ } }
  };
  let storedTheme = null;
  try { storedTheme = localStorage.getItem(THEME_KEY); } catch (e) { /* a convenience only */ }
  for (const m of ['system', 'light', 'dark']) $('theme-' + m).addEventListener('click', () => setTheme(m, true));
  setTheme(storedTheme, false);

  const RENDER = {
    lanes() {
      const w = D.whereWeAre;
      return section(
        w ? whereCard(w)
          : empty('No "where we are" was found: the settings name none, or its section is empty.'),
        intro("One lane per user path, drawn like a metro line: its stations are the path's milestones in order, the shared ones first. Each station lists the open rows before it (duties left out), each after the rows it waits on, the ones that can land first. The longest chain of waits is counted in rows, and the gate is the row it starts from. Select a row to see it."),
        legend(),
        h('div', { class: 'lanes' }, D.lanes.map((l) => {
          const nx = l.stations.find((st) => st.milestone === l.next);
          return h('section', { class: 'lane', 'aria-label': 'Path ' + l.path },
            h('header', {}, h('p', { class: 'when' }, nx ? 'next: ' + nx.milestone : 'all reached'), h('h3', {}, l.path),
              h('p', { class: 'status' }, nx ? n(nx.stops.length, 'open row', 'open rows') + ' before ' + nx.milestone + (nx.chain ? SEP + 'longest chain ' + n(nx.chain, 'row', 'rows') : '') : 'Every milestone on this path is reached.'),
              nx && nx.doneWhen ? h('p', { class: 'trig' }, 'Done when: ', md(nx.doneWhen)) : null),
            l.stations.length ? h('ol', { class: 'metro' }, l.stations.map((st) => station(st, l.next))) : h('p', { class: 'none' }, 'This path names no milestone.'));
        })));
    },
    since() {
      const H = D.history;
      if (!H.length) return section(empty('No history of the two files was read.'));
      let k = H.findIndex((e) => e.sha === sinceSha);
      if (k < 0) k = Math.min(10, H.length - 1);
      // a pick changes only this view; what is stored as seen stays the newest
      const sel = h('select', { 'aria-label': 'Changed since commit', onchange: (e) => { sinceSha = e.target.value; show('since'); } },
        H.map((e, i) => h('option', { value: e.sha, selected: i === k }, e.sha + SEP + e.date + SEP + e.subject)));
      const after = H.slice(0, k);
      const sum = (f) => after.reduce((t, e) => t + e[f].length, 0);
      const o = sum('opened'), c = sum('closed');
      const delta = (label, ids) => ids.length ? h('div', { class: 'delta' }, h('p', { class: 'label' }, label), chips(ids)) : null;
      return section(
        h('div', { class: 'filters' }, h('label', { class: 'label' }, 'Changed since ', sel)),
        intro('The commits that changed the backlog or the playbook after the chosen one, newest first: the rows each opened, closed or moved, and whether it rewrote "where we are". Opened against closed shows whether the work is converging.'),
        after.length ? h('p', {}, 'In the ' + n(after.length, 'commit', 'commits') + ' after ' + H[k].sha + ': ' + n(o, 'row', 'rows') + ' opened and ' + c + ' closed, so the open rows are ' + (c > o ? 'converging' : c < o ? 'growing' : 'level') + '.')
          : empty('Nothing changed after this commit.'),
        after.map((e) => h('section', { class: 'card' },
          h('div', { class: 'meta' }, h('span', { class: 'pill accent' }, e.sha), h('span', { class: 'pill' }, e.date)),
          h('h3', {}, e.subject),
          delta('Opened', e.opened), delta('Closed', e.closed), delta('Moved to the other file', e.moved), delta('Gone with no Done entry', e.gone),
          e.whereWeAre ? h('p', { class: 'muted' }, 'Rewrote "where we are".') : null,
          e.opened.length + e.closed.length + e.moved.length + e.gone.length === 0 && !e.whereWeAre ? h('p', { class: 'muted' }, 'No row changed.') : null)));
    },
    land() {
      const max = maxOpens(D.landNow);
      return section(intro('What an agent can do without the owner: the rows whose Land now is yes, duties left out. The ones that open up the most rows come first, then the higher priority. ' + n(D.landNow.length, 'row', 'rows') + '.'),
        D.landNow.length ? h('div', { class: 'queue' }, D.landNow.map((id, k) => qrow(id, k, max, (r) => h('p', { class: 'trig' }, 'When: ', md(r.trigger))))) : empty('No open row can land now.'));
    },
    queue() {
      const max = maxOpens(D.queue.map((q) => q.id));
      return section(intro("What needs the owner's decision or act: the rows whose Land now is a small choice, and those whose Who is owner or both. The ones that hold up the most rows come first, then the earlier milestone, then the higher priority. Triggers are steps, not dates, so when is told as the milestone a row comes before, and on which paths."),
        D.queue.length ? h('div', { class: 'queue' }, D.queue.map((q, k) => qrow(q.id, k, max, (r) => [
          h('p', {}, h('strong', {}, 'Before: '), q.before === null ? 'no milestone; it waits for its trigger' : q.before + (q.paths.length ? ' (on ' + q.paths.join(', ') + ')' : ' (on no path)'), SEP + 'holds up ' + n(q.holdsUp, 'row', 'rows')),
          h('p', {}, landPill(r), r.landNowWhy ? [' ', md(r.landNowWhy)] : null),
          r.defaultUntilDecided === null ? null : h('p', {}, h('strong', {}, 'Default until decided: '), md(r.defaultUntilDecided))]))) : empty('Nothing waits on the owner.'));
    },
    doors() {
      const entry = (id, extra) => {
        const r = rows.get(id);
        return h('li', {}, stop(stateOf(r)), h('div', { class: 'body' },
          opener(id, { class: 'go' }, h('span', { class: 't' }, plain(r.item)), h('span', { class: 'who' }, fileTag(r), prio(r), id + SEP + r.who)), extra(r)));
      };
      const part = (title, text, ids, extra) => h('div', { class: 'section' }, h('h3', {}, title + ' (' + ids.length + ')'), intro(text),
        ids.length ? h('ul', { class: 'items' }, ids.map((id) => entry(id, extra))) : empty('None.'));
      const needs = (r) => r.landNowWhy ? h('p', { class: 'trig' }, 'Needs: ', md(r.landNowWhy)) : null;
      // The page reads no clock, so it cannot say which duty is due: the longest since last done come first.
      const duty = new Map(D.duties.map((x) => [x.id, x]));
      const duties = D.duties.slice().sort((a, b) => a.lastDone === b.lastDone ? 0 : a.lastDone === null ? 1 : b.lastDone === null ? -1 : a.lastDone < b.lastDone ? -1 : 1);
      return section(
        part('Doors just opened', 'Rows whose Land now still says no, though every row they wait on has closed. Read each: it may land now.', D.doors, (r) => [h('p', { class: 'trig' }, 'Waited on:'), chips(r.waitsOn), needs(r)]),
        part('Waiting on other rows', 'Rows that wait on open rows; they come back when those close.', D.waitingOnRows, (r) => [h('p', { class: 'trig' }, 'Waits on:'), chips(r.waitsOn), needs(r)]),
        part('Triggers read by hand', 'Rows that wait on something outside the files: a reader checks each trigger.', D.byHand, (r) => [h('p', { class: 'trig' }, 'When: ', md(r.trigger)), needs(r)]),
        part('Duties', 'Standing duties recur and never close. The ones done longest ago come first, then those with no "Last done" date.', duties.map((x) => x.id),
          (r) => h('p', { class: 'trig' }, md(r.trigger), SEP + (duty.get(r.id).lastDone ? 'last done ' + duty.get(r.id).lastDone : 'no "Last done" date'))));
    },
    checklists() {
      if (!D.checklists.length) return section(empty('The settings name no checklist, or the checklists have no lines.'));
      const heads = [];
      for (const l of D.checklists) if (heads.indexOf(l.heading) < 0) heads.push(l.heading);
      return section(intro('The open lines of each checklist, with the rows each settles.'), heads.map((hd) => {
        const lines = D.checklists.filter((l) => l.heading === hd);
        const open = lines.filter((l) => !l.ticked);
        const ms = lines[0].milestone;
        return h('div', { class: 'section' },
          h('h3', {}, hd, ' ', h('span', { class: 'pill' }, (lines.length - open.length) + ' of ' + lines.length + ' ticked'), ms ? [' ', h('span', { class: 'pill accent' }, 'gates ' + ms)] : null),
          open.length ? h('ul', { class: 'checks' }, open.map((l) => h('li', {}, h('span', { class: 'box', role: 'img', 'aria-label': 'open' }),
            h('div', { class: 'txt' }, l.group ? h('p', { class: 'label' }, l.group) : null, h('p', {}, md(l.text)), l.ids.length ? chips(l.ids) : h('p', { class: 'muted' }, 'Names no row.'))))) : empty('Every line is ticked.'));
      }));
    },
    done() {
      return section(intro('The entries of the Done tables: ' + D.done.length + '. Each names the rows it closed and where it landed; closed rows keep no details here.'),
        D.done.length ? h('div', { class: 'tablewrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['Rows', 'Item', 'Milestone', 'Landed', 'File'].map((c) => h('th', { scope: 'col' }, c)))),
          h('tbody', {}, D.done.map((e) => h('tr', {}, h('td', { class: 'mono' }, e.ids.join(', ')), h('td', { class: 'wide' }, md(e.item)), h('td', { class: 'mono' }, e.milestone || ''), h('td', {}, md(e.landed)), h('td', {}, FILES[e.file][1])))))) : empty('No Done table has an entry.'));
    },
    notdoing() {
      return section(intro('What was decided against, so it is not filed again: why not, and what would reopen it.'),
        h('div', { class: 'tablewrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['Item', 'Why not', 'What would reopen it'].map((c) => h('th', { scope: 'col' }, c)))),
          h('tbody', {}, D.notDoing.map((x) => h('tr', {}, h('td', { class: 'wide' }, md(x.item)), h('td', {}, md(x.why)), h('td', {}, md(x.reopen))))))));
    },
    warnings() {
      const LEVELS = [['error', 'Errors', 'stop'], ['warning', 'Warnings', 'wait'], ['recommendation', 'Recommendations', 'ask']];
      return section(intro('What the format check found. Errors break the map; warnings and recommendations only limit it.'),
        LEVELS.map(([lv, title, cls]) => {
          const fs = D.findings.filter((f) => f.level === lv);
          return fs.length ? h('div', { class: 'section' }, h('h3', {}, title + ' (' + fs.length + ')'),
            h('ul', { class: 'plain' }, fs.map((f) => h('li', {}, h('span', { class: 'pill ' + cls }, f.rule), ' ', f.file ? FILES[f.file][1] + (f.line ? ', line ' + f.line : '') + ': ' : '', f.message)))) : null;
        }));
    },
  };

  show('lanes');
})();
</script>
`.replace(/\r/g, '') // a CRLF checkout must give the same page
