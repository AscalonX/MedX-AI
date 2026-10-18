/* MedX launch film: composition logic.
 * Contract: window.__duration = 60, window.__fps, async window.__ready(), window.__seek(t).
 * __seek(t) is pure: it seeks ONE paused GSAP master timeline to t and then runs a list of
 * procedural renderers that are functions of t only (seeded PRNG, no Date.now, no CSS
 * transitions, no real-time animation). Times below are absolute seconds (storyboard.json, fix round 4).
 */
(function () {
  'use strict';
  const A = window.ASSETS;
  const FPS = 60, DUR = 60;
  window.__duration = DUR;
  window.__fps = FPS;
  window.__posterTime = 59.6; // end card after the light sweep and Fin's breathing have settled
  // shot changes and exposure events: the renderer forces an encoder keyframe on each (no smeared first frames)
  window.__keyframes = [7.75, 7.85, 8.24, 12.0, 14.0, 17.96, 20.8, 22.64, 25.0, 26.15, 28.0, 32.0, 35.96, 38.85, 42.0, 45.9, 49.5, 49.95, 53.45, 54.0];
  window.__assetWarnings = [];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const easeCache = {};
  const E = (n) => easeCache[n] || (easeCache[n] = gsap.parseEase(n));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const IMG = {};
  const pathGet = (p) => p.split('.').reduce((o, k) => (o ? o[k] : undefined), A);
  const srcOf = (p) => { const v = pathGet(p); return typeof v === 'string' ? v : v.src; };

  /* ------------------------------------------------------------------ loading */
  const loadOne = (src) => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('image failed: ' + src));
    im.src = src;
  });
  async function loadImages() {
    const jobs = [];
    for (const k in A.ui) {
      const a = A.ui[k];
      jobs.push((async () => {
        let im = await loadOne(a.src);
        a.__src = a.src;
        // same layout = same aspect AND a clean device-pixel ratio (1x, 2x ...); a re-capture at another
        // viewport (for example 828 px instead of 1000 px) keeps the aspect but moves every component
        const r0 = a.native[0] / a.native[1], r1 = im.naturalWidth / im.naturalHeight, k = im.naturalWidth / a.native[0];
        const cleanK = [1, 1.25, 1.5, 2, 2.5, 3].some((v) => Math.abs(k - v) < 0.01);
        if (Math.abs(r0 - r1) / r0 > 0.01 || !cleanK) {
          if (a.verified) {
            window.__assetWarnings.push(`${a.src} is ${im.naturalWidth}x${im.naturalHeight}, not the ${a.native.join('x')} layout its component boxes were measured on: rendering the frozen copy ${a.verified}. Re-measure the boxes (tools/measure.py), update assets.js, then re-render.`);
            im = await loadOne(a.verified);
            a.__src = a.verified;
          } else window.__assetWarnings.push(`${a.src}: layout changed (${im.naturalWidth}x${im.naturalHeight}); re-check its boxes`);
        }
        IMG[a.__src] = im;
      })());
    }
    for (const k in A.brand) jobs.push(loadOne(A.brand[k].src).then((im) => { IMG[A.brand[k].src] = im; }));
    jobs.push(loadOne(A.data.qr).then((im) => { IMG[A.data.qr] = im; }));
    await Promise.all(jobs);
    await Promise.all(Object.values(IMG).map((im) => (im.decode ? im.decode().catch(() => {}) : 0)));
  }
  async function loadFonts() {
    const jobs = [];
    for (const w of [500, 600, 700, 800]) jobs.push(document.fonts.load(`${w} 40px "Plus Jakarta Sans"`, 'Aa0%·“”’È‑'));
    for (const w of [500, 600, 700]) jobs.push(document.fonts.load(`${w} 40px "Noto Sans Thai"`, 'แพ้เพนิซิลลินไทย'));
    await Promise.all(jobs);
    await document.fonts.ready;
  }

  /* ------------------------------------------------------------------ crops (component boxes in native px) */
  const sampler = document.createElement('canvas'); sampler.width = sampler.height = 1;
  const sctx = sampler.getContext('2d', { willReadFrequently: true });
  function samplePx(im, x, y) {
    sctx.clearRect(0, 0, 1, 1);
    sctx.drawImage(im, Math.round(x), Math.round(y), 1, 1, 0, 0, 1, 1);
    const d = sctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  }
  function mountCrop(box) {
    const a = A.ui[box.dataset.asset];
    const im = IMG[a.__src];
    const nw = im.naturalWidth, nh = im.naturalHeight;
    const k = nw / a.native[0]; // 1 for the verified still, 2 for a 2x capture of the same layout
    const c = a.crop[box.dataset.crop].map((v) => v * k);
    const W = parseFloat(box.dataset.w);
    const cw = c[2] - c[0], ch = c[3] - c[1];
    const s = W / cw, H = ch * s;
    if (s > 1.401) window.__assetWarnings.push(`${a.__src} crop ${box.dataset.crop}: on-screen scale ${s.toFixed(2)} > 1.4`);
    box.style.width = W + 'px';
    box.style.height = H + 'px';
    const crop = el('div', 'crop');
    crop.style.width = W + 'px';
    crop.style.height = H + 'px';
    const img = document.createElement('img');
    img.src = a.__src; img.alt = '';
    Object.assign(img.style, { width: nw * s + 'px', height: nh * s + 'px', left: -c[0] * s + 'px', top: -c[1] * s + 'px' });
    crop.appendChild(img);
    const map = (x, y) => [(x * k - c[0]) * s, (y * k - c[1]) * s];
    const rectDiv = (cls, r, extra = {}) => {
      const [x0, y0] = map(r[0], r[1]), [x1, y1] = map(r[2], r[3]);
      if (x1 < 0 || y1 < 0 || x0 > W || y0 > H) return null;
      const d = el('div', cls);
      Object.assign(d.style, { left: x0 + 'px', top: y0 + 'px', width: x1 - x0 + 'px', height: y1 - y0 + 'px' }, extra);
      crop.appendChild(d);
      return d;
    };
    for (const r of Object.values(a.blur || {})) rectDiv('blurregion', r);
    for (const r of Object.values(a.patch || {})) rectDiv('patch', r, { background: r[4] });
    box.insertBefore(crop, box.firstChild);
    box._map = map; box._W = W; box._H = H; box._s = s;
    for (const h of $$(':scope > [data-hot]', box)) {
      const r = a.hot[h.dataset.hot];
      const [x0, y0] = map(r[0], r[1]), [x1, y1] = map(r[2], r[3]);
      Object.assign(h.style, { left: x0 + 'px', top: y0 + 'px', width: x1 - x0 + 'px', height: y1 - y0 + 'px' });
    }
    // the card takes the colour of the component's own background, so the crop edge is invisible
    const card = box.closest('[data-autobg]');
    if (card && !card._bgDone) {
      const pts = [[c[0] + 2, c[1] + 2], [c[2] - 3, c[1] + 2], [c[0] + 2, c[3] - 3], [c[2] - 3, c[3] - 3]].map(([x, y]) => samplePx(im, x, y));
      const avg = [0, 1, 2].map((i) => Math.round(pts.reduce((sum, p) => sum + p[i], 0) / pts.length));
      card.style.backgroundColor = `rgb(${avg.join(',')})`;
      card._bgDone = true;
    }
  }
  // stage-space rect (layout coordinates, transforms ignored)
  function stageRect(e) {
    let x = 0, y = 0, n = e;
    while (n && n.id !== 'stage') { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x, y, w: e.offsetWidth, h: e.offsetHeight, cx: x + e.offsetWidth / 2, cy: y + e.offsetHeight / 2 };
  }

  /* ------------------------------------------------------------------ text */
  // Split on whitespace only: punctuation and contractions stay inside their word span ("lost.", "can’t",
  // "Red-flag"), including the kerned .pk spans that kernText() wrapped around them.
  function splitWords(e, free) {
    if (e._ws) return e._ws;
    const mk = () => { const w = el('span', 'w' + (free ? ' free' : '')); const wi = el('span', 'wi'); w.appendChild(wi); return [w, wi]; };
    const walk = (node) => {
      let cur = null; // .wi of the word being built (no whitespace seen since)
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const p of child.textContent.split(/(\s+)/)) {
            if (!p) continue;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); cur = null; continue; }
            if (cur) { cur.appendChild(document.createTextNode(p)); continue; }
            const [w, wi] = mk(); wi.textContent = p; frag.appendChild(w); cur = wi;
          }
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.classList.contains('pk')) {
          if (cur) cur.appendChild(child);
          else { const [w, wi] = mk(); child.replaceWith(w); wi.appendChild(child); cur = wi; }
        } else if (child.nodeType === 1 && child.tagName !== 'BR') { walk(child); cur = null; }
        else cur = null;
      }
    };
    walk(e);
    e._ws = $$('.wi', e);
    return e._ws;
  }

  // Punctuation kerning: Plus Jakarta Sans gives . , ’ ” - wide sidebearings (0.08-0.13em), which open a visible
  // gap at display sizes ("harm .", "word ,"). Each mark is wrapped in an inline .pk span with a negative em margin.
  const KERN_TARGETS = 'h1, h2, p, .gloss, .gloss-ink, .caption, .source, .claim, .state-chip, .lchip, .warn-chip, .ok-chip, .glass-tag, .trace-summary, .seal-cap, .av-label, .ck-label, .ck-title, .qr-cap, .cta-pill, .stat-label, .it-line, .listen-label, .pk-body, .l-row span, .nc-amber, .nc-line, .nc-ro, .ns-t, .nc-title, .nc-label, .op-title, .op-sub, .op-src, .ev-chip, .al-t, .ls-l, .ls-v, .ls-title, .a-msg, .a-act, .a-ctx-t';
  function kernText(root) {
    const isL = (c) => !!c && /[\p{L}\p{N}]/u.test(c);
    const tw_ = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = tw_.nextNode(); n; n = tw_.nextNode()) {
      const p = n.parentElement;
      if (!p || p.closest('.thai, .pk, #url, .statnum, svg, .ch')) continue;
      if (/[.,’'”“\-?!:;]/.test(n.textContent)) nodes.push(n);
    }
    for (const n of nodes) {
      const s = n.textContent, frag = document.createDocumentFragment();
      let buf = '';
      const flush = () => { if (buf) { frag.appendChild(document.createTextNode(buf)); buf = ''; } };
      for (let i = 0; i < s.length; i++) {
        const c = s[i], a = s[i - 1], b = s[i + 1];
        let k = null;
        if (c === '.' && isL(a) && !/\d/.test(b || '')) k = 'pk-dot';
        else if (c === ',' && isL(a)) k = 'pk-com';
        else if ((c === '’' || c === "'") && isL(a) && isL(b)) k = 'pk-apo';
        else if ((c === '’' || c === '”') && (isL(a) || a === '.')) k = 'pk-cq';
        else if (c === '“' && isL(b)) k = 'pk-oq';
        else if (c === '-' && isL(a) && isL(b)) k = 'pk-hy';
        else if (/[?!:;]/.test(c) && isL(a)) k = 'pk-q';
        if (!k) { buf += c; continue; }
        flush();
        const sp = el('span', 'pk ' + k); sp.textContent = c; frag.appendChild(sp);
      }
      flush();
      // inside a flex or grid chip every child becomes an item (and gets the gap), so keep the run in one inline span
      if (/flex|grid/.test(getComputedStyle(n.parentElement).display)) { const w = el('span', 'kt'); w.appendChild(frag); n.replaceWith(w); }
      else n.replaceWith(frag);
    }
  }
  const kernAll = () => { for (const e of $$(KERN_TARGETS, $('#stage'))) if (!e.closest('.thai')) kernText(e); };

  /* ------------------------------------------------------------------ timeline helpers */
  const M = gsap.timeline({ paused: true });
  // GSAP restores PRE-tween values when the playhead is before a tween with immediateRender:false,
  // so the base state of every element must equal the "from" of its earliest tween. BASE records
  // that per element and property; applyBase() writes it once before the timeline is first rendered.
  const BASE = new Map();
  function tw(target, from, to, t, dur = 0.6, ease = 'expo.out') {
    M.fromTo(target, from, Object.assign({ duration: dur, ease, immediateRender: false, lazy: false }, to), t);
    const stg = typeof to.stagger === 'number' ? to.stagger : 0;
    gsap.utils.toArray(target).forEach((e, i) => {
      const ts = t + stg * i;
      let rec = BASE.get(e);
      if (!rec) BASE.set(e, (rec = {}));
      for (const k in from) if (!rec[k] || ts < rec[k].t) rec[k] = { t: ts, v: from[k] };
    });
  }
  function applyBase() {
    for (const [e, rec] of BASE) {
      const o = {};
      for (const k in rec) o[k] = rec[k].v;
      gsap.set(e, o);
    }
  }
  // visibility window via autoAlpha. fin/fout = fade durations (0 = cut exactly on t0 / t1)
  function vis(e, t0, t1, fin = 0, fout = 0) {
    if (t0 <= 0) gsap.set(e, { autoAlpha: 1 });
    else if (fin > 0) tw(e, { autoAlpha: 0 }, { autoAlpha: 1 }, t0, fin, 'power1.inOut');
    else tw(e, { autoAlpha: 0 }, { autoAlpha: 1 }, t0 - 0.001, 0.001, 'none');
    if (t1 == null) return;
    if (fout > 0) tw(e, { autoAlpha: 1 }, { autoAlpha: 0 }, t1 - fout, fout, 'power1.inOut');
    else tw(e, { autoAlpha: 1 }, { autoAlpha: 0 }, t1 - 0.001, 0.001, 'none');
  }
  function wordsIn(e, t, o = {}) {
    const ws = splitWords(e, o.free);
    tw(ws, { y: o.y ?? 40, opacity: 0, filter: `blur(${o.blur ?? 8}px)`, scale: o.scale ?? 1 },
      { y: 0, opacity: 1, filter: 'blur(0px)', scale: 1, stagger: o.stagger ?? 0.06 }, t, o.dur ?? 0.6, o.ease ?? 'expo.out');
    // drop the no-op filter afterwards so text rasterises crisply
    const end = t + (o.dur ?? 0.6) + (ws.length - 1) * (o.stagger ?? 0.06);
    tw(ws, { filter: 'blur(0px)' }, { filter: 'none' }, end + 0.01, 0.001, 'none');
  }
  function textOut(e, t, dur = 0.3) {
    tw(e, { scale: 1, opacity: 1, filter: 'blur(0px)' }, { scale: 0.96, opacity: 0, filter: 'blur(6px)' }, t, dur, 'power2.in');
  }
  function sweep(e, t, dur = 0.8, from = '-200%', to = '700%') {
    tw(e, { '--sx': from }, { '--sx': to }, t, dur, 'power2.inOut');
  }
  // one 0.8 s specular pass across a device or card (its .spec child)
  function spec(sel, t, stagger = 0) {
    gsap.utils.toArray(sel).forEach((host, i) => {
      const s = host.querySelector(':scope > .spec');
      if (s) tw(s, { '--sx': '-160%' }, { '--sx': '560%' }, t + i * stagger, 0.8, 'power1.inOut');
    });
  }
  function pop(e, t, from = 0.6, dur = 0.4, ease = 'back.out(1.7)') {
    tw(e, { scale: from, opacity: 0 }, { scale: 1, opacity: 1 }, t, dur, ease);
  }

  /* ------------------------------------------------------------------ procedural layer */
  const PROCS = [];
  const proc = (fn) => PROCS.push(fn);
  const FLOATS = []; // [el, amp(px), period(s), phase, tOn, tOff, rot]
  const BLOBS = [];  // [el, ax, ay, speed, phase, tFreeze]
  // camera rig: per-shot linear drifts on CSS individual transforms (translate / scale), so they compose with the
  // GSAP transform of the same element and never stop moving inside their window. [el, t0, t1, {x, y, s}]
  const DRIFTS = [];
  function drift(sel, t0, t1, o) { for (const e of gsap.utils.toArray(sel)) DRIFTS.push([e, t0, t1, o]); }

  /* ------------------------------------------------------------------ static data */
  const ICONS = {
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    clip: '<rect x="5.5" y="4.5" width="13" height="16.5" rx="2.2"/><path d="M9 4.5h6v3H9zM9 11.5h6M9 15.5h4"/>',
    pen: '<path d="M4.5 19.5l1-4.2L16 4.8l3.2 3.2L8.7 18.5z"/><path d="M14 6.8l3.2 3.2"/>',
    pill: '<rect x="2.6" y="8.6" width="18.8" height="6.8" rx="3.4" transform="rotate(-45 12 12)"/><path d="M9.6 9.6l4.8 4.8"/>',
    dbl: '<path d="M2.5 12.5l4 4 8-9M11 15.5l1.6 1.6 8.4-9.6"/>',
    bell: '<path d="M6.2 16.2V11a5.8 5.8 0 0 1 11.6 0v5.2l1.6 2H4.6z"/><path d="M10 20.4a2 2 0 0 0 4 0"/>',
    check: '<path d="M6 12.5l4 4 8-9"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/>',
    activity: '<path d="M3 12h4l2.5-6 5 12 2.5-6h4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    checkCircle: '<circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.3l2.6 2.6 5-5.3"/>',
  };
  const ROLES = [['Patient', 'mic'], ['Nurse', 'clip'], ['Doctor', 'pen'], ['Pharmacist 1', 'pill'], ['Pharmacist 2', 'dbl'], ['Pickup', 'bell']];
  const TCUR = [14.1, 18.0, 23.0, 28.0, 32.0, 36.0]; // the docked rail takes over from the FLIP at 14.1
  const TDONE = [18.0, 23.0, 28.0, 32.0, 36.0, 38.45];
  const LEDGER = ['Patient turn', 'Red-flag rules', 'Verify against patient words', 'Triage confirmed by nurse', 'Note signed', 'Returned to prescriber', 'Final check: second pharmacist'];

  // S14 trace geometry (card-local, CSS recreation of the Case trace graph)
  const TR = (() => {
    const K = 1.1, M = 150 * K, HW = 80 * K;
    const cx = [130, 353.3, 576.7, 800, 1023.3, 1246.7, 1470].map((v) => v * K);
    const nodes = [[cx[0], M], [cx[1], M], [cx[2], M], [cx[3], 90 * K], [cx[3], 210 * K], [cx[4], M], [cx[5], M], [cx[6], M]];
    const R = (i) => nodes[i][0] + HW, L = (i) => nodes[i][0] - HW, Y = (i) => nodes[i][1];
    const a = 34 * K, c = 30 * K;
    const con = {
      c12: `M${R(0)} ${M} L${L(1)} ${M}`, c23: `M${R(1)} ${M} L${L(2)} ${M}`,
      c34: `M${R(2)} ${M} C ${R(2) + a} ${M}, ${L(3) - c} ${Y(3)}, ${L(3)} ${Y(3)}`,
      c35: `M${R(2)} ${M} C ${R(2) + a} ${M}, ${L(4) - c} ${Y(4)}, ${L(4)} ${Y(4)}`,
      c46: `M${R(3)} ${Y(3)} C ${R(3) + c} ${Y(3)}, ${L(5) - a} ${M}, ${L(5)} ${M}`,
      c56: `M${R(4)} ${Y(4)} C ${R(4) + c} ${Y(4)}, ${L(5) - a} ${M}, ${L(5)} ${M}`,
      c67: `M${R(5)} ${M} L${L(6)} ${M}`, c78: `M${R(6)} ${M} L${L(7)} ${M}`,
    };
    return { nodes, con, gateX: R(2) + 16.5, gateLen: 12 };
  })();
  const NODE_T = [39.0, 39.25, 39.5, 40.62, 40.75, 41.0, 41.25, 41.5];
  const PULSES = [ // [pulse, connector, from, to, t0, t1]  from/to: 0..1 of length or 'gate'
    ['tpA', 'c12', 0, 1, 39.02, 39.23], ['tpA', 'c23', 0, 1, 39.27, 39.48],
    ['tpA', 'c34', 0, 'gate', 39.52, 39.6], ['tpA', 'c34', 'gate', 'gate', 39.6, 40.45], ['tpA', 'c34', 'gate', 1, 40.45, 40.6],
    ['tpB', 'c35', 'gate', 1, 40.53, 40.73],
    ['tpA', 'c46', 0, 1, 40.66, 40.96], ['tpB', 'c56', 0, 1, 40.79, 40.97],
    ['tpA', 'c67', 0, 1, 41.04, 41.23], ['tpA', 'c78', 0, 1, 41.29, 41.48],
  ];

  /* ------------------------------------------------------------------ build DOM extras */
  function buildDom() {
    for (const e of $$('img.asset-img')) e.src = srcOf(e.dataset.src);
    $('#finL').style.setProperty('--finmask', `url(${A.brand.finListening.src})`);
    for (const box of $$('.cropbox[data-asset]')) mountCrop(box);
    // the app's white card continues below a phone crop
    for (const cc of $$('.card-cont[data-follow]')) {
      const box = $('#' + cc.dataset.follow), a = A.ui[box.dataset.asset];
      const [x0] = box._map(a.cardEdge[0], 0), [x1] = box._map(a.cardEdge[1], 0);
      Object.assign(cc.style, { left: box.offsetLeft + x0 + 'px', width: x1 - x0 + 'px', top: box.offsetTop + box._H - 1 + 'px' });
    }

    // Thai rack-focus wrappers: chunk 2+3 in one span so focus and reveal never fight
    for (const [line, c2, c3, fz] of [['#thai1', '#t1c2', '#t1c3', 't1fz'], ['#thai2', '#t2c2', '#t2c3', 't2fz']]) {
      const w = el('span', 'tc'); w.id = fz;
      const a = $(c2), b = $(c3); a.parentNode.insertBefore(w, a); w.appendChild(a); w.appendChild(b);
    }

    // big rail (S05)
    const br = $('#bigRail');
    ROLES.forEach(([label, icon], i) => {
      const x = 210 + i * 300;
      const n = el('div', 'br-node', `<svg viewBox="0 0 24 24">${ICONS[icon]}</svg>`); n.style.left = x + 'px'; n.style.top = '600px';
      const l = el('div', 'br-label'); l.style.left = x + 'px'; l.textContent = label;
      br.appendChild(n); br.appendChild(l);
    });

    // docked rail
    const rail = $('#rail');
    ROLES.forEach(([label], i) => {
      const x = 440 + i * 208;
      const n = el('div', 'r-node', `<div class="r-glow"></div><div class="r-up"></div><div class="r-cur"></div><div class="r-done"><svg viewBox="0 0 24 24">${ICONS.check}</svg></div>`);
      n.style.left = x + 'px';
      const l = el('div', 'r-label'); l.style.left = x + 'px'; l.textContent = label;
      rail.appendChild(n); rail.appendChild(l);
    });

    // transitions that sit above every scene (below the rail)
    const streak = el('div'); streak.id = 'streak';
    Object.assign(streak.style, { position: 'absolute', left: '0', top: '470px', width: '900px', height: '140px', borderRadius: '70px', background: 'linear-gradient(90deg, rgba(10,128,119,0), rgba(10,128,119,.55) 30%, rgba(255,255,255,.95) 55%, rgba(26,95,196,.5) 75%, rgba(26,95,196,0))', filter: 'blur(18px)', opacity: 0, visibility: 'hidden' });
    $('#stage').insertBefore(streak, $('#vig'));

    // micro-tag variant for S01
    const mt1 = el('div', 'microtag on-ink'); mt1.id = 'mt1'; mt1.textContent = 'Synthetic example';
    $('#stage').insertBefore(mt1, $('#microtag'));

    // Italian listening bars: the app's 7 level bars (apps/mobile mic.tsx BARS)
    const bars = $('#itBars');
    for (let i = 0; i < 7; i++) bars.appendChild(document.createElement('i'));
    // tab bars of the two recreated phones (labels from apps/mobile i18n; x positions measured on the 3x capture)
    const TABI = {
      home: '<path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5"/>', visit: '<path d="M6 3.5h8l4 4V20.5H6zM9 12h6M9 16h6"/>',
      help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.8"/><circle cx="12" cy="16.8" r=".9" fill="currentColor" stroke="none"/>',
      globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
    };
    for (const bar of $$('.ap-tabs')) {
      const labels = bar.dataset.tabs.split('|');
      [['home', '', 45], ['visit', 'on', 120], ['help', '', 270], ['globe', 'dis', 345]].forEach(([ic, cls, x], i) => {
        const d = el('div', 'ap-tab ' + cls, `<svg viewBox="0 0 24 24">${TABI[ic]}</svg>`);
        const sp = el('span'); sp.textContent = labels[i]; d.appendChild(sp);
        d.style.left = x + 'px'; bar.appendChild(d);
      });
      bar.appendChild(el('div', 'ap-plus', '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'));
    }
    // S03 gridlines on the shared 0-100% scale (inner track x 606-1770)
    const grid = $('#s3grid');
    [0, 25, 50, 75, 100].forEach((p) => {
      const x = 606 + 1164 * p / 100;
      for (const seg of ['a', 'b']) { const g = el('div', `gl ${seg}${p === 50 ? ' mid' : ''}`); g.style.left = x + 'px'; grid.appendChild(g); }
      const l = el('div', 'gl-l'); l.style.left = x + 'px'; l.textContent = p + '%'; grid.appendChild(l);
    });

    // S11 alert recreation
    const al = A.copy.alert;
    $('#aDrug').textContent = al.drug; $('#aDetail').textContent = al.detail;
    $('#aBadge').textContent = al.badge; $('#aTitle').textContent = al.title; $('#aRule').textContent = al.rule;
    $('#aMsg').textContent = al.message; $('#aAct').textContent = al.action;

    // S12 six-item checklist recreation (titles only)
    $('#ckTitle').textContent = A.copy.checklistTitle;
    A.copy.checks.forEach((label, i) => {
      const r = el('div', 'ck-row', `<span class="ck-box"><span class="ck-fill"><svg viewBox="0 0 24 24">${ICONS.check}</svg></span><span class="ck-ring"></span></span><span class="ck-label"></span>`);
      r.id = 'ck' + (i + 1); $('.ck-label', r).textContent = label;
      $('#ckRows').appendChild(r);
    });

    // S13 ghost type, pickup counter card, particle canvas
    const body2 = (code) => [`กรุณาไปที่ช่องรับยาหมายเลข 2 และแสดงรหัส ${code}`, `Vada allo sportello 2 della farmacia e mostri il codice ${code}.`];
    const [gth] = body2(A.data.pickupCode);
    $('#ghostTh').textContent = `${gth}          ${gth}`; // one ghost line only (the Italian one is retired)
    const c13 = document.createElement('canvas'); c13.id = 'dust13'; c13.width = 1920; c13.height = 1080;
    Object.assign(c13.style, { position: 'absolute', left: '0', top: '0', visibility: 'hidden' });
    $('#s13cam').appendChild(c13);
    $('#thai13').appendChild(el('span', 'baseline-probe'));
    $('#thai2').appendChild(el('span', 'baseline-probe'));

    // S14 trace recreation: connectors, nodes, gate
    const ns = 'http://www.w3.org/2000/svg', svg = $('#traceSvg');
    for (const [id, d] of Object.entries(TR.con)) {
      const p = document.createElementNS(ns, 'path'); p.setAttribute('id', id); p.setAttribute('d', d);
      p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#7D8C9E'); p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round');
      svg.appendChild(p);
      const L = p.getTotalLength(), e = p.getPointAtLength(L), b = p.getPointAtLength(L - 6);
      const ang = Math.atan2(e.y - b.y, e.x - b.x);
      const h = document.createElementNS(ns, 'path');
      const pt = (r, a) => `${(e.x + r * Math.cos(a)).toFixed(1)} ${(e.y + r * Math.sin(a)).toFixed(1)}`;
      h.setAttribute('d', `M${pt(8, ang + Math.PI - 0.55)} L${e.x.toFixed(1)} ${e.y.toFixed(1)} L${pt(8, ang + Math.PI + 0.55)}`);
      h.setAttribute('fill', 'none'); h.setAttribute('stroke', '#7D8C9E'); h.setAttribute('stroke-width', '2'); h.setAttribute('stroke-linecap', 'round'); h.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(h);
    }
    const typeIcon = { Human: 'user', Rule: 'clip', Model: 'activity', System: 'clock' };
    A.copy.trace.forEach(([kind, type, title], i) => {
      const [x, y] = TR.nodes[i];
      const n = el('div', `t-node k-${kind}`, `<div class="t-type"><svg viewBox="0 0 24 24">${ICONS[typeIcon[kind]]}</svg><span></span></div><div class="t-title"></div><div class="t-done"><svg viewBox="0 0 24 24">${ICONS.checkCircle}</svg>Done</div><div class="t-lit"></div>`);
      n.id = 'tn' + (i + 1);
      n.style.left = x + 'px'; n.style.top = y + 'px';
      $('.t-type span', n).textContent = type; $('.t-title', n).textContent = title;
      if (i === 2) n.appendChild(el('div', 't-lit t-ring'));
      $('#traceNodes').appendChild(n);
    });
    $('#tGate').style.left = TR.gateX + 'px';

    // S15 ledger
    const rows = $('#ledgerRows');
    LEDGER.forEach((label, i) => {
      const r = el('div', 'l-row', `<b>${String(i + 1).padStart(2, '0')}</b><i></i><span></span>`);
      $('span', r).textContent = label;
      rows.appendChild(r);
    });
    rows.appendChild(el('div', 'l-row lock', `<b>08</b><svg viewBox="0 0 24 24">${ICONS.lock}</svg><span>Append-only audit log</span>`));
    const sc2 = $('#sc2'), dr = $('#dashRect');
    dr.setAttribute('width', sc2.offsetWidth - 3); dr.setAttribute('height', sc2.offsetHeight - 3);
    dr.setAttribute('rx', (sc2.offsetHeight - 3) / 2); dr.setAttribute('ry', (sc2.offsetHeight - 3) / 2);

    // URL characters (typed on); the caret follows the typed width
    const url = $('#url');
    for (const ch of A.data.url) { const s = el('span', 'ch'); s.textContent = ch; url.appendChild(s); }
    url.appendChild(el('span', 'caret'));

    // grain tile (seeded), mounted only inside the dark and gradient plates (never over type, UI or the QR)
    const g = document.createElement('canvas'); g.width = g.height = 256;
    const gx = g.getContext('2d'), id = gx.createImageData(256, 256), R = rng(7);
    for (let i = 0; i < id.data.length; i += 4) { const v = (R() * 255) | 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    gx.putImageData(id, 0, 0);
    const tile = `url(${g.toDataURL('image/png')})`;
    for (const host of ['#bgInk', '#bgDip', '#bgGrad', '#band15', '#s16 .warm-bg']) {
      const gl = el('div', 'grainL'); gl.style.backgroundImage = tile;
      const h = $(host); h.insertBefore(gl, h.querySelector('.vignette') || null);
    }
    gsap.set('#gradSweep', { x: -1200, skewX: -18 });

    // typographic pass (before any word split)
    kernAll();
  }

  /* ------------------------------------------------------------------ particles: sample text */
  function offsetWithin(e, ancestor) {
    let x = 0, n = e;
    while (n && n !== ancestor) { x += n.offsetLeft; n = n.offsetParent; }
    return x;
  }
  function sampleThai(lineEl, chunks, font, n, seed, step = 2) {
    const probe = $('.baseline-probe', lineEl);
    const base = lineEl.offsetTop + probe.offsetTop;
    const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.font = font; cx.fillStyle = '#fff'; cx.textBaseline = 'alphabetic';
    for (const c of chunks) cx.fillText(c.textContent, lineEl.offsetLeft + offsetWithin(c, lineEl), base);
    const data = cx.getImageData(0, 0, 1920, 1080).data;
    const pts = [];
    for (let y = 0; y < 1080; y += step) for (let x = 0; x < 1920; x += step) if (data[(y * 1920 + x) * 4 + 3] > 140) pts.push([x, y]);
    const R = rng(seed), out = [];
    for (let i = 0; i < n && pts.length; i++) out.push(pts[(R() * pts.length) | 0]);
    return out;
  }
  function wrapText(e) {
    const s = el('span', 'tc'); s.textContent = e.firstChild.textContent;
    e.replaceChild(s, e.firstChild); return s;
  }
  let P1 = [], P13 = [], P15 = [];
  function buildParticles() {
    const t1 = $('#thai1');
    const pts = sampleThai(t1, [$('#t1c1'), $('#t1c2'), $('#t1c3')], '600 88px "Noto Sans Thai"', 450, 11);
    const xs = pts.map((p) => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
    const R = rng(23);
    P1 = pts.map(([x, y]) => ({ x, y, fx: (x - x0) / (x1 - x0 || 1), r: [R(), R(), R(), R(), R(), R()] }));

    const t13 = $('#thai13'); const copy = $('#s13copy');
    const pts13raw = sampleThai(t13, [t13.firstChild.nodeType === 3 ? wrapText(t13) : t13.firstChild], '700 88px "Noto Sans Thai"', 380, 31);
    const R2 = rng(41);
    const xs13 = pts13raw.map((p) => p[0]), a13 = Math.min(...xs13), b13 = Math.max(...xs13);
    P13 = pts13raw.map(([x, y]) => ({ x: x + copy.offsetLeft, y, fx: (x - a13) / (b13 - a13 || 1), r: [R2(), R2(), R2(), R2(), R2()] }));

    const rects = ['#sc1', '#sc2', '#sc3', '#ledger'].map((s) => stageRect($(s)));
    const R3 = rng(57), cols = ['#E5EEFB', '#FEF2D7', '#E1F4F1', '#FFFFFF'];
    for (let i = 0; i < 320; i++) {
      const k = i % 4, rc = rects[k];
      P15.push({ x: rc.x + R3() * rc.w, y: rc.y + R3() * rc.h, c: cols[k], r: [R3(), R3(), R3(), R3()] });
    }
  }

  /* ------------------------------------------------------------------ the film */
  // headline reveal (fix round 4 readability): every headline is fully in within about 0.6 s of its first word
  const head = (e, t, o = {}) => wordsIn(e, t, Object.assign({ stagger: 0.035, dur: 0.42 }, o));
  function buildTimeline() {
    const st = (id) => $(id);
    const G = {}; // geometry computed from layout

    /* ---------- backgrounds ---------- */
    vis('#bgInk', 0, 7.75);                               // black breath from 7.75; the light point opens at 7.85
    // the mist plate is cut on only under the bloom's opaque white (8.24), so it never fades in grey over black
    vis('#bgMist', 8.24, 42.0);
    vis('#bgMist', 49.45, 54.15);                          // under the S16 luminance-ramp dissolve
    vis('#vig', 8.0, 28.0); vis('#vig', 32.0, 42.0); vis('#vig', 49.95, 54.15);
    vis('#bgDip', 28.0, 32.0);                             // S11 safety dip: deep ink grade, key light on the card
    vis('#bgGrad', 53.45, null);                           // radial colour bloom out of the QR (procedural mask)
    BLOBS.push([st('#inkKey'), 60, 40, 0.35, 0, 99], [st('#inkFill'), 70, 50, 0.28, 2, 99],
      [st('#mistA'), 90, 60, 0.22, 1, 99], [st('#mistB'), 80, 70, 0.18, 3, 99],
      [st('#gradA'), 80, 50, 0.3, 0.5, 59.5], [st('#gradB'), 90, 60, 0.25, 2.5, 59.5],
      [st('#b15a'), 70, 50, 0.3, 1, 99], [st('#b15b'), 60, 60, 0.25, 4, 99],
      [st('#b16a'), 50, 30, 0.25, 2, 99], [st('#b16b'), 60, 40, 0.2, 5, 99],
      [st('#dipKey'), 30, 20, 0.3, 1.5, 99]);
    // the mist plate itself drifts slowly for the whole middle of the film (scale 1.06 hides its edges)
    drift('#bgMist', 8.0, 54.2, { x: [18, -18], s: [1.06, 1.06] });

    /* ---------- micro-tags ---------- */
    vis('#mt1', 0.4, 2.8, 0.3, 0.3);
    vis('#microtag', 14.1, 41.95, 0.3, 0.25);
    vis('#microtag', 46.3, 49.5, 0.3, 0.2);
    vis('#microtag', 50.1, 53.6, 0.3, 0.3);

    /* ---------- S01 cold open (0-3) ---------- */
    vis('#s01', 0, 3.0);
    tw('#s01glow', { opacity: 0.35, scale: 0.85 }, { opacity: 1, scale: 1 }, 0, 0.8, 'power2.out');
    tw('#s01glow', { opacity: 1 }, { opacity: 0.3 }, 2.2, 0.8, 'power2.in');
    const rev = [['#t1c1', 0.25, 0.45], ['#t1c2', 0.72, 0.40], ['#t1c3', 1.12, 0.40]];
    for (const [id, t, d] of rev) {
      tw(id, { clipPath: 'inset(-40% 100% -40% 0%)', filter: 'blur(8px)', opacity: 0 }, { clipPath: 'inset(-40% 0% -40% 0%)', filter: 'blur(0px)', opacity: 1 }, t, d, 'power2.out');
    }
    tw('#t1fz', { filter: 'blur(0px)', opacity: 1 }, { filter: 'blur(3px)', opacity: 0.72 }, 1.6, 0.4, 'power2.out');
    tw('#t1c1', { opacity: 1 }, { opacity: 0 }, 2.2, 0.14, 'power1.in');
    tw('#t1c2', { opacity: 1 }, { opacity: 0 }, 2.3, 0.14, 'power1.in');
    tw('#t1c3', { opacity: 1 }, { opacity: 0 }, 2.4, 0.14, 'power1.in');
    // English gloss: 34 px, legible 1.0-2.7
    tw('#gloss1', { y: 12, opacity: 0 }, { y: 0, opacity: 1 }, 0.9, 0.3, 'power2.out');
    tw('#gloss1', { filter: 'blur(0px)', opacity: 1 }, { filter: 'blur(6px)', opacity: 0 }, 2.7, 0.25, 'power2.in');

    /* ---------- S02 (3.0-4.5) ---------- */
    vis('#s02', 3.0, 4.5);
    // headline (low anchor) sits outside the push-through camera; fully in by 3.22, legible to 4.46 (1.24 s)
    wordsIn(st('#s02h'), 2.98, { y: 0, scale: 1.04, blur: 6, stagger: 0.015, dur: 0.18, free: true });
    tw('#s02h', { opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(6px)' }, 4.46, 0.04, 'power2.in');
    tw('#s02line', { clipPath: 'inset(0% 75.5% 0% 0%)' }, { clipPath: 'inset(0% 44% 0% 0%)' }, 3.1, 0.7, 'power2.inOut');
    tw('#s02line', { clipPath: 'inset(0% 44% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)' }, 3.82, 0.001, 'none');
    // the snap on the 4.0 beat: the line splits at the node and both ends recoil, leaving a clear gap
    tw('#dashA', { x: 0, y: 0, rotation: 0, opacity: 1 }, { x: -58, y: 16, rotation: -7, opacity: 0.8, transformOrigin: '0% 50%' }, 4.0, 0.5, 'expo.out');
    tw('#dashB', { x: 0, y: 0, rotation: 0, opacity: 1 }, { x: 66, y: -12, rotation: 7, opacity: 0.8, transformOrigin: '100% 50%' }, 4.0, 0.5, 'expo.out');
    tw('#snapNode', { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1.25 }, 3.9, 0.1, 'power2.out');
    tw('#snapNode', { opacity: 1, scale: 1.25 }, { opacity: 0, scale: 0.6 }, 4.02, 0.3, 'power2.out');
    tw('#thChip', { opacity: 0, x: -30 }, { opacity: 1, x: 0 }, 3.0, 0.5, 'power3.out');
    tw('#s02far', { opacity: 0 }, { opacity: 1 }, 3.0, 0.4, 'power2.out');

    /* ---------- S03 stat (4.5-7.75): true scale on one 0-100% track ---------- */
    vis('#s03', 4.5, 7.75);
    // the push is anchored on the type grid (x 144), so the headline's left edge never drifts; both bars scale together
    tw('#s03 .cam', { scale: 0.95, opacity: 0.55, transformOrigin: '144px 540px' }, { scale: 1, opacity: 1 }, 4.42, 0.4, 'expo.out');
    tw('#s03 .cam', { scale: 1 }, { scale: 1.025 }, 4.85, 2.9, 'none');
    tw('#s03h', { clipPath: 'inset(-25% 100% -45% 0%)' }, { clipPath: 'inset(-25% -2% -45% 0%)' }, 4.4, 0.42, 'power3.out');
    tw('#s03cap', { opacity: 0, y: 10 }, { opacity: 1, y: 0 }, 4.6, 0.4, 'power2.out');
    tw('#s03chart .track', { opacity: 0, y: 24 }, { opacity: 1, y: 0, stagger: 0.08 }, 4.45, 0.5, 'power3.out');
    tw('#s3grid', { opacity: 0 }, { opacity: 1 }, 4.55, 0.5, 'power1.out');
    tw('#labA, #labB', { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.06 }, 4.6, 0.4, 'power2.out');
    tw('#fillA, #fillB', { scaleX: 0 }, { scaleX: 1 }, 4.8, 0.8, 'expo.out');   // the counters use the same curve
    tw('#numA, #numB', { opacity: 0 }, { opacity: 1 }, 4.75, 0.15, 'none');
    tw('#barABloom', { opacity: 0, scale: 0.5 }, { opacity: 0.85, scale: 1.3 }, 5.6, 0.25, 'power2.out');
    tw('#barABloom', { opacity: 0.85, scale: 1.3 }, { opacity: 0.3, scale: 1.05 }, 5.85, 0.8, 'power2.out');
    tw('#s03src', { opacity: 0 }, { opacity: 1 }, 4.5, 0.3, 'power1.out');
    tw('#s03chart', { x: 0 }, { x: -10 }, 4.5, 3.25, 'none');

    /* ---------- S04 reveal (8.2-12.16) ---------- */
    // 7.85-8.5: brand-tinted light bloom (procedural #bloom): a white point with a mint, teal and ocean fringe opens
    // out to full white by 8.24, the mist plate is cut on under it, then the white lifts off the mist by 8.5
    vis('#s04', 8.2, 12.16);
    tw('#finL', { opacity: 0 }, { opacity: 1 }, 8.22, 0.28, 'power1.out');
    tw('#finL', { scale: 0.96, filter: 'blur(20px)', y: 12 }, { scale: 1, filter: 'blur(0px)', y: 0 }, 8.22, 0.6, 'power2.out');
    tw('#finL', { filter: 'blur(0px)' }, { filter: 'none' }, 8.83, 0.001, 'none');
    tw('#finHalo', { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1 }, 8.2, 0.8, 'power2.out');
    tw('#finShadow', { opacity: 0, scaleX: 0.6 }, { opacity: 1, scaleX: 1 }, 8.35, 0.6, 'power2.out');
    // 9.0: Fin glides left while its sound arcs fly into the wordmark X; the logo lands on the 9.5 beat
    tw('#finL', { x: 0, y: 0, scale: 1 }, { x: -400, y: -80, scale: 0.69 }, 9.0, 0.62, 'power3.inOut');
    tw('#finHalo', { x: 0, y: 0, scale: 1 }, { x: -400, y: -40, scale: 0.62 }, 9.0, 0.62, 'power3.inOut');
    tw('#finShadow', { opacity: 1 }, { opacity: 0 }, 9.0, 0.35, 'power2.out');
    tw('#lkTile', { scale: 0.55, opacity: 0, transformOrigin: '50% 50%' }, { scale: 1, opacity: 1 }, 9.5, 0.5, 'back.out(1.6)');
    tw('#lkMedRect', { attr: { width: 0 } }, { attr: { width: 2300 } }, 9.5, 0.45, 'power3.out');
    $$('.lkX').forEach((p) => { p.style.strokeDasharray = '25.5 60'; });
    tw('.lkX', { strokeDashoffset: 25.5, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, stagger: 0.06 }, 9.5, 0.3, 'power2.out');
    tw('.lkA', { opacity: 0 }, { opacity: 1 }, 9.6, 0.001, 'none');
    tw('#logoFlash', { opacity: 0, scale: 0.5 }, { opacity: 0.7, scale: 1.1 }, 9.55, 0.2, 'power2.out');
    tw('#logoFlash', { opacity: 0.7, scale: 1.1 }, { opacity: 0, scale: 1.5 }, 9.75, 0.6, 'power2.out');
    // tagline lands with the logo: the full lockup is complete at 9.98 and holds, untouched, until 12.0 (2.0 s)
    wordsIn(st('#s04tag'), 9.5, { stagger: 0.05, dur: 0.38 });
    // continuous 4% push from the logo landing to the end of the shot; one specular sweep at 10.9
    G.xC = [1431.46, 474.67];
    tw('#s04', { scale: 1, transformOrigin: `${G.xC[0]}px ${G.xC[1]}px` }, { scale: 1.04 }, 9.5, 2.66, 'none');
    sweep('#lockSweep', 10.9, 0.8, '-150%', '560%');
    sweep('#finSweep', 10.95, 0.8, '-150%', '560%');
    // clean exit on the 12.0 downbeat: the whole lockup lifts, softens and clears in 0.16 s (the arc match cut is retired)
    tw('#s04cam', { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transformOrigin: '960px 470px' }, { opacity: 0, y: -30, scale: 0.97, filter: 'blur(5px)' }, 12.0, 0.16, 'power2.in');

    /* ---------- S05 rail (12.04-14.14) ---------- */
    vis('#s05', 12.04, 14.14);
    tw('.br-fill', { scaleX: 0 }, { scaleX: 1 }, 12.06, 0.62, 'power2.inOut');   // the rail draws left to right under the pops
    head(st('#s05h'), 12.12, { stagger: 0.03, dur: 0.38 });                    // fully in 12.68, legible to 13.98
    $$('.br-node').forEach((n, i) => pop(n, 12.1 + i * 0.12, 0.6, 0.36, 'back.out(1.6)'));
    $$('.br-label').forEach((n, i) => tw(n, { opacity: 0, y: 10 }, { opacity: 1, y: 0 }, 12.16 + i * 0.12, 0.36, 'power2.out'));
    tw('#s05h', { opacity: 1, y: 0 }, { opacity: 0, y: -26 }, 13.96, 0.12, 'power2.in');   // gone by 14.08, before the phones rise
    drift('#s05h', 12.04, 14.12, { s: [1, 1.025] });
    drift('#bigRail', 12.04, 13.6, { x: [-14, 0] });       // the rail drifts until the FLIP takes over (offset 0 at 13.6)
    // 13.6-14.1: FLIP the same rail into its docked place (y 1004, 1040 px wide); the docked #rail takes over at 14.1
    const FL = 13.6, FD = 0.5, FE = 'power2.inOut', DY = 1004 - 600, DYL = 1022 - 662;
    $$('.br-node').forEach((n, i) => {
      tw(n, { x: 0, y: 0, scale: 1 }, { x: (440 + 208 * i) - (210 + 300 * i), y: DY, scale: 28 / 88 }, FL, FD, FE);
      tw($('svg', n), { opacity: 1 }, { opacity: 0 }, FL + 0.05, 0.3, 'power1.inOut');
    });
    $$('.br-label').forEach((n, i) => tw(n, { x: 0, y: 0, scale: 1 }, { x: (440 + 208 * i) - (210 + 300 * i), y: DYL, scale: 16 / 24 }, FL, FD, FE));
    tw('.br-line', { x: 0, y: 0, scaleX: 1 }, { x: 230, y: DY, scaleX: 1040 / 1500 }, FL, FD, FE);
    tw('.br-base', { opacity: 0 }, { opacity: 1 }, FL + 0.1, 0.35, 'power1.inOut');
    tw('.br-fill', { opacity: 1 }, { opacity: 0 }, FL + 0.1, 0.35, 'power1.inOut');

    /* ---------- docked rail (14.1-39) ---------- */
    vis('#rail', 14.099, 39.0, 0, 0.35);
    const rnodes = $$('.r-node');
    rnodes.forEach((n, i) => {
      const cur = $('.r-cur', n), done = $('.r-done', n);
      tw(cur, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1 }, TCUR[i], 0.35, 'back.out(1.8)');
      tw(cur, { opacity: 1 }, { opacity: 0 }, TDONE[i], 0.25, 'power1.out');
      tw(done, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1 }, TDONE[i], 0.35, 'back.out(1.8)');
    });
    for (let i = 1; i < 6; i++) tw('#railFill', { scaleX: (i - 1) / 5 }, { scaleX: i / 5 }, TCUR[i] - 0.1, 0.5, 'power2.inOut');
    tw('#railPulse', { x: 0, opacity: 0 }, { x: 1040, opacity: 1 }, 38.0, 0.6, 'power1.inOut');
    tw('#railPulse', { opacity: 1 }, { opacity: 0 }, 38.55, 0.2, 'power1.out');

    /* ---------- S06 patient (14.0-17.96): three full phone screens rise in behind the docking rail ---------- */
    vis('#s06', 14.0, 17.96);
    const phs = [['#phC', -4, 0], ['#phL', 15, -230], ['#phR', -15, -230]];
    phs.forEach(([id, ry, z], i) => {
      tw(id, { z: -600, rotationY: ry * 1.8, y: 60, opacity: 0 }, { z, rotationY: ry, y: 0, opacity: 1 }, 14.04 + i * 0.05, 0.9, 'expo.out');
    });
    tw('#shL, #shC, #shR', { opacity: 0, scaleX: 0.6 }, { opacity: 1, scaleX: 1 }, 14.3, 0.6, 'power2.out');
    head(st('#s06h1'), 14.12);                 // fully in 14.65
    head(st('#s06h2'), 15.3, { y: 24 });       // fully in 15.83, legible to 17.7
    tw('.lang-chips .lchip', { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: 0.08 }, 14.15, 0.5, 'power3.out');
    const lit = (chip, halo, t) => {
      tw(chip, { backgroundColor: 'rgba(255,255,255,.72)', color: '#45566A', borderColor: '#E3E9EF', scale: 1 },
        { backgroundColor: '#E1F4F1', color: '#08716A', borderColor: 'rgba(8,113,106,.45)', scale: 1.08 }, t, 0.2, 'power2.out');
      tw(chip, { scale: 1.08 }, { scale: 1 }, t + 0.2, 0.3, 'power2.out');
      tw(halo, { opacity: 0 }, { opacity: 1 }, t, 0.25, 'power2.out');
      tw(halo, { opacity: 1 }, { opacity: 0.35 }, t + 0.25, 0.6, 'power2.inOut');
    };
    lit('#lcTh', '#haloL', 14.5); lit('#lcIt', '#haloR', 15.0); lit('#lcEn', '#haloC', 15.5);
    // read-aloud rings stay clear of the question text
    $$('#spkRings i').forEach((r, i) => tw(r, { scale: 1, opacity: 0.85 }, { scale: 1.9, opacity: 0 }, 14.5 + i * 0.22, 0.7, 'power2.out'));
    spec('#phL, #phC, #phR', 15.5, 0.06);
    tw('#hlL1', { scaleX: 0 }, { scaleX: 1 }, 16.0, 0.28, 'power2.inOut');
    tw('#hlL2', { scaleX: 0 }, { scaleX: 1 }, 16.22, 0.28, 'power2.inOut');
    tw('#hotConfirm', { opacity: 0 }, { opacity: 1 }, 16.5, 0.2, 'power2.out');
    tw('#hotConfirm', { opacity: 1 }, { opacity: 0.25 }, 16.7, 0.5, 'power2.inOut');
    tw('#thSend', { scale: 1 }, { scale: 0.96 }, 17.0, 0.08, 'power2.out');
    tw('#thSend', { scale: 0.96 }, { scale: 1 }, 17.08, 0.25, 'back.out(2)');
    tw('#sendRipple', { scale: 0, opacity: 0.9 }, { scale: 9, opacity: 0 }, 17.0, 0.55, 'power2.out');
    // camera: the device layer pushes 3% and drifts right, the type layer drifts onto the x 144 grid
    drift('#s06phones', 14.0, 17.96, { x: [-10, 10], s: [1, 1.03] });
    drift('#s06 .lang-chips', 14.0, 17.96, { x: [-10, 10], s: [1, 1.03] });
    drift('#s06copy', 14.0, 17.7, { x: [6, 0] });
    // whip exit, finished (and the streak gone) by 17.96
    tw('#s06cam', { x: 0, filter: 'blur(0px)' }, { x: -480, filter: 'blur(12px)' }, 17.7, 0.26, 'power2.in');
    vis('#streak', 17.62, 17.96);
    tw('#streak', { x: 1900 }, { x: -900 }, 17.62, 0.34, 'power2.inOut');
    tw('#streak', { opacity: 0 }, { opacity: 1 }, 17.62, 0.12, 'power1.out');
    tw('#streak', { opacity: 1 }, { opacity: 0 }, 17.78, 0.17, 'power1.in');
    FLOATS.push([st('#phC'), 6, 6, 0, 14.0, 17.96], [st('#phL'), 6, 6, 2.1, 14.0, 17.96], [st('#phR'), 6, 6, 4.2, 14.0, 17.96]);

    /* ---------- S07 nurse (17.9-20.8): split screen, the patient's own phone | the nurse's fields ---------- */
    vis('#s07', 17.9, 20.8);
    tw('#s07cam', { x: 480 }, { x: 0 }, 17.9, 0.4, 'power2.out');           // lands out of the whip
    // one continuous push toward the nurse pane, which becomes the push-in that hands over to the S08 laptop
    tw('#s07cam', { scale: 1, transformOrigin: '1440px 470px' }, { scale: 1.035 }, 18.0, 2.55, 'none');
    tw('#s07cam', { scale: 1.035 }, { scale: 1.6 }, 20.55, 0.25, 'power2.in');
        tw('#paneL', { opacity: 0, x: -60 }, { opacity: 1, x: 0 }, 17.92, 0.5, 'power3.out');
    tw('#paneR', { opacity: 0, x: 60 }, { opacity: 1, x: 0 }, 17.92, 0.5, 'power3.out');
    tw('#paneDiv', { scaleY: 0 }, { scaleY: 1 }, 18.0, 0.5, 'power3.out');
    tw('#tagPat, #tagNur', { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.08 }, 18.1, 0.35, 'power2.out');
    tw('#ph7', { y: 60, opacity: 0 }, { y: 0, opacity: 1 }, 17.95, 0.55, 'expo.out');
    tw('#sh7', { opacity: 0, scaleX: 0.6 }, { opacity: 1, scaleX: 1 }, 18.1, 0.5, 'power2.out');
    tw('#lap7', { opacity: 0, filter: 'blur(10px)' }, { opacity: 1, filter: 'blur(0px)' }, 17.98, 0.6, 'expo.out');
    tw('#lap7', { filter: 'blur(0px)' }, { filter: 'none' }, 18.6, 0.001, 'none');
    tw('#cardCC, #cardAge', { scale: 0.9, y: 30, opacity: 0 }, { scale: 1, y: 0, opacity: 1, stagger: 0.08 }, 18.0, 0.55, 'expo.out');
    head(st('#s07h'), 18.0);                                                 // fully in 18.63
    // evidence threads cross the split: from the highlighted phrase on the phone to the start of the nurse's field
    const ccR = stageRect(st('#cardCC')), agR = stageRect(st('#cardAge'));
    const s1r = stageRect(st('#hlSore1')), a1r = stageRect(st('#hlAge1'));
    const g1 = stageRect(st('#glowSore')), g2 = stageRect(st('#glowAge'));
    const th = (pathEl, a, b) => {
      pathEl.setAttribute('d', `M${a[0]} ${a[1]} C ${a[0] + 170} ${a[1]}, ${b[0] - 170} ${b[1]}, ${b[0]} ${b[1]}`);
      const len = pathEl.getTotalLength(); pathEl.style.strokeDasharray = `${len} ${len + 10}`; return len;
    };
    const p1 = [s1r.x + s1r.w + 6, s1r.cy], p2 = [a1r.x + a1r.w + 6, a1r.cy];
    const l1 = th(st('#th1'), p1, [ccR.x - 10, g1.cy]);
    const l2 = th(st('#th2'), p2, [agR.x - 10, g2.cy]);
    st('#th1a').setAttribute('cx', p1[0]); st('#th1a').setAttribute('cy', p1[1]);
    st('#th2a').setAttribute('cx', p2[0]); st('#th2a').setAttribute('cy', p2[1]);
    tw('#hlSore1', { scaleX: 0 }, { scaleX: 1 }, 18.8, 0.2, 'power2.in');
    tw('#hlSore2', { scaleX: 0 }, { scaleX: 1 }, 18.98, 0.12, 'power2.out');
    tw('#th1a', { opacity: 0 }, { opacity: 1 }, 18.9, 0.1, 'none');
    tw('#th1', { strokeDashoffset: l1 }, { strokeDashoffset: 0 }, 18.92, 0.4, 'power2.inOut');
    tw('#glowSore', { opacity: 0 }, { opacity: 1 }, 19.28, 0.15, 'power2.out');
    tw('#glowSore', { opacity: 1 }, { opacity: 0.55 }, 19.43, 0.5, 'power2.inOut');
    spec('#cardCC', 19.3);
    tw('#hlAge1', { scaleX: 0 }, { scaleX: 1 }, 19.6, 0.15, 'power2.in');
    tw('#hlAge2', { scaleX: 0 }, { scaleX: 1 }, 19.74, 0.15, 'power2.out');
    tw('#th2a', { opacity: 0 }, { opacity: 1 }, 19.72, 0.1, 'none');
    tw('#th2', { strokeDashoffset: l2 }, { strokeDashoffset: 0 }, 19.75, 0.4, 'power2.inOut');
    tw('#glowAge', { opacity: 0 }, { opacity: 1 }, 20.12, 0.15, 'power2.out');
    tw('#glowAge', { opacity: 1 }, { opacity: 0.55 }, 20.27, 0.4, 'power2.inOut');
    spec('#cardAge', 20.1);

    /* ---------- S08 triage (20.75-22.82): over the shoulder on the nurse's laptop ---------- */
    vis('#s08', 20.8, 22.95);
    // the S07 push-in lands on the laptop (scale settles), then the camera dollies slowly around the screen
    tw('#rig8', { scale: 1.14, transformOrigin: '1300px 520px' }, { scale: 1 }, 20.8, 0.55, 'power3.out');   // punch-in cut lands and settles
    tw('#lap8', { rotationY: 22, transformPerspective: 2200, transformOrigin: '0% 50%' }, { rotationY: 15 }, 20.8, 0.6, 'power3.out');
    tw('#lap8', { rotationY: 15 }, { rotationY: 10 }, 21.35, 1.47, 'none');
    head(st('#s08h'), 20.82);                                                // fully in 21.38, legible to 22.6
    const full = st('#triCard').offsetHeight, confH = st('#confBox').offsetHeight + 14;
    tw('#triCard', { height: full - confH }, { height: full }, 22.0, 0.17, 'power2.out');
    tw('#confBox', { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)' }, 22.0, 0.17, 'power2.out');
    tw('#triCheck', { scale: 0.6, opacity: 0 }, { scale: 1.08, opacity: 1 }, 22.05, 0.16, 'power2.out');
    tw('#triCheck', { scale: 1.08, boxShadow: '0 0 0 0px rgba(10,128,119,.45)' }, { scale: 1, boxShadow: '0 0 0 18px rgba(10,128,119,0)' }, 22.21, 0.4, 'power2.out');
    spec('#triCard', 22.1);
    drift('#rig8', 20.8, 22.95, { x: [10, -10] });
    drift('#s08h', 20.8, 22.95, { x: [6, 0] });
    // push exit: the frame moves left as S09 pushes in from the right (no cross-fade in place)
    tw('#s08cam', { x: 0 }, { x: -1920 }, 22.64, 0.36, 'power3.inOut');

    /* ---------- S09 doctor (22.75-25.4): centred, push onto "Keep in note" ---------- */
    vis('#s09', 22.64, 25.4);
    tw('#s09cam', { x: 1920 }, { x: 0 }, 22.64, 0.36, 'power3.inOut');
    tw('#consCard', { rotationX: 10, y: 50, scale: 0.95, transformPerspective: 1400 }, { rotationX: 0, y: 0, scale: 1 }, 22.7, 0.7, 'expo.out');
    tw('#cbPlate9', { x: 70, opacity: 0.5 }, { x: 0, opacity: 0.5 }, 22.6, 0.8, 'power2.out');
    head(st('#s09h'), 22.85);                                                // fully in 23.38
    head(st('#s09s'), 23.2, { stagger: 0.03, dur: 0.38, y: 24 });             // fully in 23.73, legible to 25.0
    tw('#ulNotDx', { scaleX: 0 }, { scaleX: 1 }, 23.9, 0.4, 'power2.inOut');
    const cardR = stageRect(st('#consCard')), keep = stageRect(st('#pressKeep'));
    G.keepLocal = [keep.cx - cardR.x, keep.cy - cardR.y];
    tw('#consCard', { scale: 1, transformOrigin: `${G.keepLocal[0]}px ${G.keepLocal[1]}px` }, { scale: 1.12 }, 24.35, 0.42, 'power2.inOut');
    tw('#cbPlate9', { opacity: 0.5 }, { opacity: 0.3 }, 24.3, 0.4, 'power2.in');
    spec('#consCard', 24.5);
    tw('#pressKeep', { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1 }, 24.8, 0.12, 'power2.out');
    tw('#pressKeep', { opacity: 1 }, { opacity: 0 }, 25.0, 0.4, 'power2.in');
    tw('#pressKeep .ripple', { scale: 0, opacity: 0.9 }, { scale: 6, opacity: 0 }, 24.8, 0.5, 'power2.out');
    drift('#consCard', 22.78, 25.4, { x: [-8, 8], s: [1, 1.025] });
    drift('#cbPlate9', 22.8, 25.4, { x: [10, -16] });
    drift('#s09h, #s09s', 22.8, 25.0, { s: [1, 1.015] });
    // push transition: S09 leaves to the left while S10 enters from the right, frame against frame
    tw('#s09cam', { x: 0 }, { x: -1920 }, 25.0, 0.4, 'power3.inOut');

    /* ---------- S10 note (25.0-28.0): one card; the signed note replaces the draft through a masked wipe ---------- */
    vis('#s10', 25.0, 28.0);
    tw('#s10cam', { x: 1920 }, { x: 0 }, 25.0, 0.4, 'power3.inOut');
    head(st('#s10h1'), 25.22);                                               // fully in 25.75, leaves at 26.97 (macro push)
    spec('#draftCard', 25.6);
    const sH = st('#signedCard').offsetHeight;
    // 26.15-26.43: top-to-bottom wipe with a teal light edge; the draft is fully covered, never seen through the note
    tw('#signedCard', { clipPath: `inset(-80px -80px ${sH + 80}px -80px)` }, { clipPath: 'inset(-80px -80px -120px -80px)' }, 26.15, 0.28, 'power2.inOut');
    tw('#wipeEdge', { y: 0 }, { y: sH }, 26.15, 0.28, 'power2.inOut');
    tw('#wipeEdge', { opacity: 0 }, { opacity: 1 }, 26.15, 0.04, 'none');
    tw('#wipeEdge', { opacity: 1 }, { opacity: 0 }, 26.4, 0.12, 'power1.out');
    tw('#draftCard', { autoAlpha: 1 }, { autoAlpha: 0 }, 26.44, 0.001, 'none');
    head(st('#s10h2'), 26.2);                                                // fully in 26.73, legible to 27.95
    const stampEls = $$('#stamp svg circle, #stamp svg path');
    stampEls.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = `${L} ${L + 4}`; p._L = L; });
    tw('#stamp', { scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1 }, 26.5, 0.3, 'back.out(1.8)');
    stampEls.forEach((p, i) => tw(p, { strokeDashoffset: p._L }, { strokeDashoffset: 0 }, 26.58 + i * 0.12, 0.3, 'power2.out'));
    tw('#stamp', { boxShadow: '0 0 0 0px rgba(10,128,119,.45)' }, { boxShadow: '0 0 0 22px rgba(10,128,119,0)' }, 26.8, 0.5, 'power2.out');
    spec('#signedCard', 26.6);
    // camera (fix round 6): a slow MACRO PUSH onto the "Note signed" stamp. The rig turns toward the lens while the
    // draft is on screen; from 26.45, as the stamp lands, it pushes in around the stamp so the signed card fills about
    // 70% of the frame width by 27.4 (left edge x 580, top y 206, scale 1.62; the empty right end of its two teal boxes
    // runs off the frame edge, every text line stays inside), then keeps creeping 3% to the hard cut at 28.0.
    // "Drafted from their words." leaves 26.97-27.15 (readable 25.75-26.97), so the card never touches a headline:
    // "Signed by a clinician." ends at x 541 and keeps a 40 px gap to the card.
    const spR = stageRect(st('#stamp')), sgR = stageRect(st('#signedCard'));
    const MS = 1.62, M_L = 580, M_T = 206;
    const mtx = M_L - (spR.cx + (sgR.x - spR.cx) * MS), mty = M_T - (spR.cy + (sgR.y - spR.cy) * MS);
    G.macro10 = { scale: MS, x: mtx, y: mty, card: [sgR.x, sgR.y, sgR.w, sgR.h], stamp: [spR.cx, spR.cy] };
    tw('#noteRig', { rotationY: -7, transformPerspective: 1800, transformOrigin: `${spR.cx}px ${spR.cy}px` }, { rotationY: -1.5 }, 25.0, 3.0, 'none');
    tw('#noteRig', { scale: 1, x: 0, y: 0 }, { scale: MS, x: mtx, y: mty }, 26.45, 0.95, 'power2.inOut');
    tw('#noteRig', { scale: MS }, { scale: MS * 1.03 }, 27.4, 0.6, 'none');
    // macro depth of field: the focal plane is the stamp row; the card title and the lines below it soften
    tw('#signedCard .nc-title', { filter: 'blur(0px)' }, { filter: 'blur(1.2px)' }, 26.95, 0.45, 'power1.inOut');
    tw('#signedCard .nc-label, #signedCard > .nc-line', { filter: 'blur(0px)' }, { filter: 'blur(1.8px)' }, 26.95, 0.45, 'power1.inOut');
    // the laptop bokeh behind moves less than the card (parallax) and opens up
    tw('#bokeh10', { scale: 1, x: 0, y: 0 }, { scale: 1.3, x: -120, y: 30 }, 26.45, 1.55, 'power1.inOut');
    tw('#s10h1', { opacity: 1, y: 0 }, { opacity: 0, y: -30 }, 26.97, 0.18, 'none');   // leaves as the card arrives (readable 25.75-26.97)
    drift('#s10h1, #s10h2', 25.0, 28.0, { x: [6, 0] });

    /* ---------- S11 pharmacist 1: the only red (28-32) ---------- */
    vis('#s11', 28.0, 31.95);
    const hA = st('#plateA').offsetHeight, hB = st('#plateB').offsetHeight, PAD = 76, CY = 640;
    const topA = CY - (hA + PAD) / 2, topB = CY - (hB + PAD) / 2;
    gsap.set('#card11', { height: hA + PAD, top: topA });
    tw('#card11', { scale: 0.9, y: 40, opacity: 0 }, { scale: 1, y: 0, opacity: 1 }, 27.95, 0.38, 'power4.out');
    // fix round 6: a tilted plate seen from low and to the side (yaw 18 deg, camera below, 1.6 deg roll); the camera
    // orbits slowly toward the front through the whole shot and is still turned 8 deg when the options go back (31.75)
    tw('#card11', { rotationY: 18, rotationX: 7, rotationZ: -1.6, transformPerspective: 1500 }, { rotationY: 8, rotationX: 3, rotationZ: -0.5 }, 27.95, 3.97, 'sine.inOut');
    head(st('#s11h1'), 28.04, { stagger: 0.03, dur: 0.4 });                  // fully in 28.59, legible to 29.85
    tw('#rimRed', { opacity: 0 }, { opacity: 1 }, 28.6, 0.25, 'power2.out');
    tw('#rimRed', { opacity: 1 }, { opacity: 0 }, 28.85, 0.55, 'power2.in');
    // masked push inside one slot: the first line rises out as the second rises in (never two lines on top of each other)
    tw('#s11h1', { y: 0 }, { y: -110 }, 29.85, 0.32, 'power3.inOut');
    tw('#s11h2', { y: 110 }, { y: 0 }, 29.85, 0.32, 'power3.inOut');
    tw('#s11h1', { autoAlpha: 1 }, { autoAlpha: 0 }, 30.18, 0.001, 'none');         // in by 30.17, legible to 31.75
    tw('#s11s', { opacity: 0, y: 14 }, { opacity: 1, y: 0 }, 30.14, 0.3, 'power2.out');   // after the headline push; legible 30.44-31.75
    // the plates scroll inside a window with a 40 px feathered top and bottom edge
    tw('#win11', { '--fe': '0px' }, { '--fe': '40px' }, 29.68, 0.12, 'none');
    tw('#plateA', { y: 0, opacity: 1 }, { y: -(hA + PAD), opacity: 0 }, 29.8, 0.5, 'power2.inOut');
    tw('#plateB', { y: hA + PAD }, { y: 0 }, 29.8, 0.5, 'power2.inOut');
    tw('#plateB', { autoAlpha: 0 }, { autoAlpha: 1 }, 29.79, 0.001, 'none');      // hidden while parked below the window (still fully clipped at 29.79)
    tw('#card11', { height: hA + PAD, top: topA }, { height: hB + PAD, top: topB }, 29.8, 0.5, 'power2.inOut');
    tw('#win11', { '--fe': '40px' }, { '--fe': '0px' }, 30.3, 0.12, 'none');
    tw('#clarFill', { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1 }, 30.6, 0.16, 'back.out(2)');
    tw('#clarRing', { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1 }, 30.6, 0.18, 'power2.out');
    tw('#clarRing', { opacity: 1 }, { opacity: 0 }, 30.8, 0.4, 'power2.in');
    tw('#pressReturn', { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1 }, 31.0, 0.12, 'power2.out');
    tw('#pressReturn', { opacity: 1 }, { opacity: 0 }, 31.15, 0.3, 'power2.in');
    tw('#pressReturn .ripple', { scale: 0, opacity: 0.9 }, { scale: 6, opacity: 0 }, 31.0, 0.45, 'power2.out');
    tw('#returnedChip', { scale: 0.6, opacity: 0, transformOrigin: '100% 50%' }, { scale: 1, opacity: 1 }, 31.2, 0.3, 'back.out(1.8)');
    drift('#card11', 27.95, 31.92, { x: [-12, 12], s: [1, 1.035] });
    drift('#s11copy', 28.0, 31.92, { x: [6, 0] });
    // clean exit before S12 (no overlap)
    tw('#card11', { y: 0, opacity: 1 }, { y: -40, opacity: 0 }, 31.75, 0.17, 'power2.in');
    tw('#s11copy', { opacity: 1, y: 0 }, { opacity: 0, y: -30 }, 31.75, 0.17, 'power2.in');

    /* ---------- S12 pharmacist 2 (32-36): foreground rings, rack focus to the low-angle checklist ---------- */
    // fix round 6: the two pharmacist rings open the shot in the FOREGROUND, big (1.4x) and sharp, overlapping the
    // checklist, which sits out of focus behind them (blur 9 px). At 32.72 focus racks to the checklist while the rings
    // drift down-left into the left column (foreground parallax, 0.78 s), clear of every row before its tick
    // (row 1 at 33.0 is above them; rows 2-6 tick after they have left). At 34.6 focus racks back to the rings.
    vis('#s12', 32.0, 35.96, 0, 0.1);
    tw('#checkCard', { y: 60, opacity: 0 }, { y: 0, opacity: 1 }, 31.94, 0.55, 'expo.out');
    tw('#checkCard', { rotationX: 16, transformPerspective: 1300, transformOrigin: '50% 100%' }, { rotationX: 12 }, 31.94, 1.06, 'power2.out');
    tw('#checkCard', { rotationX: 12 }, { rotationX: 6 }, 33.0, 1.3, 'none');
    tw('#checkCard', { rotationX: 6 }, { rotationX: 0 }, 34.3, 1.2, 'power2.inOut');
    tw('#checkCard', { filter: 'blur(9px)' }, { filter: 'blur(0px)' }, 32.72, 0.3, 'power2.inOut');
    tw('#checkCard', { filter: 'blur(0px)' }, { filter: 'none' }, 33.03, 0.001, 'none');
    const SEAL_O = [173, 106];                                               // ring centre, seal-local
    const sealN = stageRect(st('#seal'));
    const FG12 = { s: 1.4, x: 1000 - (sealN.x + SEAL_O[0]), y: 600 - (sealN.y + SEAL_O[1]) };   // ring centre at (1000, 600)
    G.fg12 = FG12;
    tw('#seal', { x: FG12.x, y: FG12.y, scale: FG12.s, transformOrigin: `${SEAL_O[0]}px ${SEAL_O[1]}px` }, { x: 0, y: 0, scale: 1 }, 32.72, 0.78, 'power2.inOut');
    tw('#avLC', { x: -80, opacity: 0 }, { x: 0, opacity: 1 }, 31.98, 0.32, 'power3.out');
    tw('#avNW', { x: 80, opacity: 0 }, { x: 0, opacity: 1 }, 31.98, 0.32, 'power3.out');
    tw('#sealRing', { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1 }, 32.3, 0.4, 'back.out(1.8)');
    tw('#avLCl, #avNWl', { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.06 }, 32.34, 0.3, 'power2.out');
    tw('#sealCap', { opacity: 0, y: 10 }, { opacity: 1, y: 0 }, 32.42, 0.3, 'power2.out');
    tw('#seal', { filter: 'blur(0px)', opacity: 1 }, { filter: 'blur(5px)', opacity: 0.6 }, 32.72, 0.3, 'power2.inOut');
    head(st('#s12h1'), 32.0);                                                // fully in 32.6
    head(st('#s12h2'), 32.62, { y: 24, dur: 0.4 });                          // with the seal; fully in 33.13, legible to 35.7
    for (let k = 0; k < 6; k++) {
      const t = 33.0 + k * 0.25, row = '#ck' + (k + 1);
      tw(`${row} .ck-fill`, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1 }, t, 0.16, 'back.out(2)');
      tw(`${row} .ck-ring`, { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1 }, t, 0.14, 'power2.out');
      tw(`${row} .ck-ring`, { opacity: 1 }, { opacity: 0 }, t + 0.16, 0.35, 'power2.in');
    }
    spec('#checkCard', 34.3);
    pop('#sixChip', 34.5, 0.7, 0.35, 'back.out(1.8)');
    tw('#seal', { filter: 'blur(5px)', opacity: 0.6 }, { filter: 'blur(0px)', opacity: 1 }, 34.6, 0.3, 'power2.inOut'); // rack back: never the same person
    tw('#seal', { filter: 'blur(0px)' }, { filter: 'none' }, 34.92, 0.001, 'none');
    drift('#checkCard', 31.94, 35.7, { x: [-12, 12], s: [1, 1.045] });
    drift('#sixChip', 34.5, 35.7, { x: [-3, 3] });
    drift('#seal', 32.0, 35.7, { x: [10, -8] });
    drift('#s12copy', 32.0, 35.7, { x: [6, 0] });
    const c6 = stageRect($('#ck6 .ck-box'));
    tw('#s12', { scale: 1, transformOrigin: `${c6.cx}px ${c6.cy}px` }, { scale: 2.6 }, 35.7, 0.3, 'power3.in');

    /* ---------- S13 pickup (36-39): the real pickup screen; its counter number glows on the chime ---------- */
    vis('#s13', 35.96, 38.95, 0.1, 0.1);
    tw('#rays13', { opacity: 0 }, { opacity: 0.5 }, 36.0, 1.2, 'power1.out');
    tw('#ph13', { y: 70, rotation: 3, opacity: 0 }, { y: 0, rotation: 0, opacity: 1 }, 35.96, 0.6, 'back.out(1.4)');
    tw('#ph13', { rotationY: 8 }, { rotationY: 0 }, 35.96, 2.45, 'sine.out');
    tw('#sh13', { opacity: 0, scaleX: 0.6 }, { opacity: 1, scaleX: 1 }, 36.1, 0.5, 'power2.out');
    tw('#ghostTh', { opacity: 0 }, { opacity: 1 }, 36.1, 0.8, 'power1.out');
    tw('#thai13', { clipPath: 'inset(-40% 100% -40% 0%)', filter: 'blur(6px)' }, { clipPath: 'inset(-40% -2% -40% 0%)', filter: 'blur(0px)' }, 36.25, 0.6, 'power1.inOut');
    tw('#pkGlow', { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1 }, 36.6, 0.18, 'power2.out');
    tw('#pkGlow', { opacity: 1 }, { opacity: 0.35 }, 36.85, 0.6, 'power2.inOut');
    spec('#ph13', 36.6);
    tw('#gloss13', { y: 12, opacity: 0 }, { y: 0, opacity: 1 }, 36.6, 0.45, 'power2.out');
    head(st('#s13h'), 36.62);                                                // fully in 37.15, legible to 38.5
    drift('#orbit13', 35.96, 38.45, { x: [10, -10], s: [1, 1.035] });
    drift('#s13copy', 35.96, 38.5, { x: [8, 0] });
    // the phone flies down into the rail's Pickup node as the rail completes
    tw('#ph13', { x: 0, y: 0, scale: 1, opacity: 1 }, { x: 1480 - 1380, y: 1004 - 520, scale: 0.05, opacity: 0 }, 38.45, 0.45, 'power3.in');
    tw('#sh13, #s13copy, #ghostTh, #rays13', { opacity: 1 }, { opacity: 0 }, 38.5, 0.3, 'power2.in');
    FLOATS.push([st('#ph13'), 5, 5, 1, 36.6, 38.45]);

    /* ---------- S14 trace (38.85-42): the whole graph in frame, a slow push with the pulse; hard cut at 42.0 ---------- */
    vis('#s14', 38.85, 42.0, 0.15, 0);
    tw('#traceCard', { opacity: 0, y: 30 }, { opacity: 1, y: 0 }, 38.85, 0.45, 'power2.out');
    head(st('#s14h'), 38.95);
    tw('#trSum', { opacity: 0, y: 10 }, { opacity: 1, y: 0 }, 39.1, 0.4, 'power2.out');
    NODE_T.forEach((t, i) => tw(`#tn${i + 1} > .t-lit:not(.t-ring)`, { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1 }, t, 0.22, 'power2.out'));
    tw('#tn3 .t-ring', { opacity: 0.9, scale: 1 }, { opacity: 0, scale: 1.14 }, 39.75, 0.35, 'power2.out');
    tw('#tn3 .t-ring', { opacity: 0.9, scale: 1 }, { opacity: 0, scale: 1.14 }, 40.12, 0.35, 'power2.out');
    tw('#tGate .g-scan', { y: 0, opacity: 0 }, { y: 214, opacity: 1 }, 39.75, 0.7, 'power1.inOut');
    tw('#tGate .g-scan', { opacity: 1 }, { opacity: 0 }, 40.4, 0.1, 'none');
    tw('#tGate .g-pass', { opacity: 0 }, { opacity: 1 }, 40.45, 0.2, 'power2.out');
    spec('#traceCard', 40.5);
    tw('#auditTag', { y: 30, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1 }, 40.95, 0.4, 'back.out(1.7)');
    drift('#traceCard', 38.85, 42.0, { x: [12, -12], s: [1, 1.025] });   // max width 1804 px: always inside the frame
    drift('#s14h', 38.85, 42.0, { s: [1, 1.02] });

    /* ---------- S15 trust band (42-46) ---------- */
    vis('#s15', 42.0, 46.35, 0, 0.35);
    head(st('#s15h1'), 41.97, { stagger: 0.03, dur: 0.35 });                  // fully in 42.44, legible to 43.75
    // masked push inside one slot (no cross-fade): the first headline rises out, the second rises in
    tw('#s15h1', { y: 0 }, { y: -190 }, 43.75, 0.34, 'power3.inOut');
    tw('#s15h2', { y: 190 }, { y: 0 }, 43.75, 0.34, 'power3.inOut');
    tw('#s15h1', { autoAlpha: 1 }, { autoAlpha: 0 }, 44.1, 0.001, 'none');         // in by 44.09, legible to 45.85
    tw('#chips15 .state-chip', { z: -420, rotationY: -28, rotationX: 10, opacity: 0 }, { z: 0, rotationY: -14, rotationX: 4, opacity: 1, stagger: 0.12 }, 42.1, 0.7, 'expo.out');
    tw('#ledger', { y: 40, opacity: 0 }, { y: 0, opacity: 1 }, 42.6, 0.6, 'power3.out');
    const rowsEl = $$('#ledgerRows .l-row');
    const winH = 280, RH = 56;
    rowsEl.forEach((r, j) => { if (j >= 2) { const k = j - 2, t = 44.0 + k * 0.25; tw(r, { opacity: 0, x: -24 }, { opacity: 1, x: 0 }, t, 0.25, 'power2.out'); } });
    for (let j = 3; j <= 8; j++) tw('#ledgerRows', { y: winH - (j - 1) * RH }, { y: winH - j * RH }, 44.0 + (j - 3) * 0.25, 0.25, 'power2.out');
    gsap.set('#ledgerRows', { y: winH - 2 * RH });
    tw(rowsEl[7], { backgroundColor: 'rgba(43,179,166,0)' }, { backgroundColor: 'rgba(43,179,166,.22)' }, 45.3, 0.25, 'power2.out');
    tw('#warm15', { opacity: 0 }, { opacity: 1 }, 45.5, 0.5, 'power1.inOut');
    tw('#chips15, #ledger', { filter: 'blur(0px)' }, { filter: 'blur(6px)' }, 45.7, 0.4, 'power2.in');
    tw('#chips15', { opacity: 1 }, { opacity: 0 }, 45.7, 0.4, 'power2.in');
    tw('#ledger', { opacity: 1 }, { opacity: 0 }, 45.75, 0.4, 'power2.in');
    tw('#s15slot', { opacity: 1 }, { opacity: 0 }, 45.85, 0.27, 'power2.in'); // gone before the S16 line forms (46.2)
    drift('#chips15', 42.0, 46.1, { x: [-14, 14], s: [1, 1.03] });
    drift('#ledger', 42.6, 46.1, { x: [-10, 10], s: [1, 1.03] });
    drift('#s15slot', 42.0, 46.12, { x: [6, 0] });

    /* ---------- S16 callback (45.9-49.95): Thai line high, payoff low, then a 0.45 s luminance-ramp dissolve ---------- */
    vis('#s16', 45.9, 49.95, 0.4, 0.28);
    tw('#s16', { filter: 'brightness(1)' }, { filter: 'brightness(3.4)' }, 49.47, 0.46, 'power2.in');
    const rev2 = [['#t2c1', 46.2, 0.45], ['#t2c2', 46.67, 0.40], ['#t2c3', 47.07, 0.40]];
    for (const [id, t, d] of rev2) {
      tw(id, { clipPath: 'inset(-40% 100% -40% 0%)', filter: 'blur(8px)', opacity: 0 }, { clipPath: 'inset(-40% 0% -40% 0%)', filter: 'blur(0px)', opacity: 1 }, t, d, 'power2.out');
    }
    tw('#t2fz', { filter: 'blur(0px)', opacity: 1 }, { filter: 'blur(2px)', opacity: 0.8 }, 47.0, 0.4, 'power2.out');
    tw('#t2fz', { x: 0, y: 0 }, { x: 9, y: -4 }, 47.4, 0.22, 'power2.out');
    tw('#t2fz', { x: 9, y: -4, filter: 'blur(2px)', opacity: 0.8 }, { x: 0, y: 0, filter: 'blur(0px)', opacity: 1 }, 47.62, 0.3, 'back.out(2.2)');
    const c1 = stageRect(st('#t2c1')), card = stageRect(st('#allergyCard'));
    const probeB = st('#thai2').offsetTop + $('.baseline-probe', st('#thai2')).offsetTop;
    const uy = probeB + 22;
    const thd = st('#thread16');
    thd.setAttribute('d', `M${c1.cx} ${uy + 10} C ${c1.cx} ${uy + 40}, ${card.cx} ${card.y - 40}, ${card.cx} ${card.y - 4}`);
    const tl16 = thd.getTotalLength(); thd.style.strokeDasharray = `${tl16} ${tl16 + 10}`;
    const dl = st('#dotLine'); const ns = 'http://www.w3.org/2000/svg'; const dots = [];
    for (let x = c1.x + 8; x <= c1.x + c1.w - 8; x += 13) { const d = document.createElementNS(ns, 'circle'); d.setAttribute('cx', x); d.setAttribute('cy', uy); d.setAttribute('r', 2.6); d.setAttribute('fill', '#5B9BF0'); dl.parentNode.insertBefore(d, dl); dots.push(d); }
    dl.remove();
    tw(dots, { opacity: 0 }, { opacity: 1, stagger: 0.4 / dots.length }, 47.0, 0.06, 'none');
    tw('#thread16', { strokeDashoffset: tl16 }, { strokeDashoffset: 0 }, 47.5, 0.5, 'power2.inOut');
    tw('#allergyCard', { y: 30, opacity: 0, filter: 'blur(6px)' }, { y: 0, opacity: 0.55, filter: 'blur(3px)' }, 46.6, 0.6, 'power2.out');
    tw('#allergyCard', { y: 0, opacity: 0.55, filter: 'blur(3px)', scale: 1 }, { y: -10, opacity: 1, filter: 'blur(0px)', scale: 1.03 }, 47.85, 0.4, 'power3.out');
    tw('#allergyCard', { filter: 'blur(0px)' }, { filter: 'none' }, 48.27, 0.001, 'none');
    tw('#allergyCard', { scale: 1.03 }, { scale: 1.1 }, 48.3, 1.65, 'power1.in'); // carries the move through the dissolve
    head(st('#s16h'), 47.5, { stagger: 0.04, dur: 0.45 });                    // fully in 48.11, legible to 49.47
    tw('#s16cam', { scale: 1, transformOrigin: '960px 560px' }, { scale: 1.04 }, 46.0, 3.95, 'none');

    /* ---------- S17 CTA (49.92-54): devices, URL and QR; no Fin next to the clinical UI ---------- */
    vis('#s17', 49.92, 54.0, 0.1, 0);
    tw('#card17', { z: -480, rotationY: 22, opacity: 0, x: -40 }, { z: 0, rotationY: 8, opacity: 1, x: 0 }, 49.95, 0.8, 'expo.out');
    tw('#ph17', { z: -400, rotationY: 20, opacity: 0, x: 40 }, { z: 40, rotationY: 6, opacity: 1, x: 0 }, 50.1, 0.8, 'expo.out');
    head(st('#s17h'), 49.98, { dur: 0.45 });                                 // fully in 50.54
    vis('#url', 50.85, null);
    // 51.0: Send is tapped on the phone (the score's 51.0 pop)
    tw('#pressSend17', { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1 }, 51.0, 0.12, 'power2.out');
    tw('#pressSend17', { opacity: 1 }, { opacity: 0 }, 51.2, 0.35, 'power2.in');
    tw('#pressSend17 .ripple', { scale: 0, opacity: 0.9 }, { scale: 7, opacity: 0 }, 51.0, 0.5, 'power2.out');
    vis('#qrCard', 51.5, null);
    tw('#qrCard', { scale: 0.9 }, { scale: 1 }, 51.5, 0.5, 'expo.out');
    sweep('#qrGlint', 51.6, 0.7, '-200%', '500%');
    vis('#qrCap', 51.75, null, 0.4);
    spec('#card17, #ph17', 52.6, 0.08);
    drift('#dev17', 49.95, 53.85, { x: [-10, 10], s: [1, 1.03] });
    drift('#s17h', 49.95, 53.85, { s: [1, 1.015] });
    tw('#dev17', { filter: 'blur(0px)' }, { filter: 'blur(4px)' }, 53.0, 0.4, 'power1.inOut');
    tw('#dev17', { x: 0, opacity: 1 }, { x: -520, opacity: 0 }, 53.45, 0.4, 'power2.in');
    textOut(st('#s17h'), 53.5, 0.35);
    FLOATS.push([st('#card17'), 6, 6, 0.5, 50.0, 54.0], [st('#ph17'), 6, 6, 3.0, 50.0, 54.0]);
    // shared elements glide into the end card: the pill row is centred; Fin + QR are centred as ONE group on x 960
    const pill = st('#ctaPill'), url = st('#url');
    const urlScale = 0.909, gap = 28, pillW = pill.offsetWidth, urlW = url.offsetWidth * urlScale;
    const rowL = 960 - (pillW + gap + urlW) / 2, PILL_T = 459;
    pill.style.left = rowL + 'px';
    const URL0 = [url.offsetLeft, url.offsetTop], QR0 = [st('#qrCard').offsetLeft, st('#qrCard').offsetTop], CAP0 = st('#qrCap').offsetTop;
    const urlH = url.offsetHeight, urlMid = URL0[1] + urlH / 2;
    const finSz = 280, fp = A.brand.finPointing, tip = fp.tip, visL = fp.vis[0];
    const QR = { size: 300, top: 585 }, TIP_GAP = 50;
    const groupW = (tip[0] - visL) * finSz + TIP_GAP + QR.size;   // Fin's visible left edge to the QR's right edge
    const finL = 960 - groupW / 2 - visL * finSz;
    QR.cx = finL + tip[0] * finSz + TIP_GAP + QR.size / 2; QR.cy = QR.top + QR.size / 2;
    const finT = QR.cy - tip[1] * finSz;
    Object.assign(st('#finP').style, { left: finL.toFixed(1) + 'px', top: finT.toFixed(1) + 'px' }); // Fin's end-card place
    G.qr = QR; G.qrStart = [QR0[0] + 160, QR0[1] + 160];
    const gl = (sel, to, from) => tw(sel, from, to, 53.6, 1.0, 'power3.inOut');
    const urlTo = { x: rowL + pillW + gap - URL0[0], y: (PILL_T + 35) - urlMid };
    gl('#url', { x: urlTo.x, y: urlTo.y, scale: urlScale }, { x: 0, y: 0, scale: 1 });
    tw('#url', { color: '#0F1E2E' }, { color: '#FFFFFF' }, 53.7, 0.45, 'power1.inOut');
    // crisp type on the static card: once landed, the scaled URL becomes real 40 px type in exactly the same place
    const fs0 = parseFloat(getComputedStyle(url).fontSize), fs1 = +(fs0 * urlScale).toFixed(2);
    tw('#url', { scale: urlScale, fontSize: fs0 + 'px', y: urlTo.y }, { scale: 1, fontSize: fs1 + 'px', y: urlTo.y + (urlH - urlH * urlScale) / 2 }, 54.62, 0.001, 'none');
    gl('#qrCard', { x: QR.cx - (QR0[0] + 160), y: QR.cy - (QR0[1] + 160), scale: QR.size / 320 }, { x: 0, y: 0, scale: 1 });
    gl('#qrCap', { x: QR.cx - (QR0[0] + 160), y: (QR.cy + QR.size / 2 + 16) - CAP0 }, { x: 0, y: 0 });
    tw('#qrCap', { color: '#45566A' }, { color: 'rgba(255,255,255,.85)' }, 53.7, 0.45, 'power1.inOut');

    /* ---------- S18 end card (54-60): lockup, tagline, pill, then Fin on its light disc; QR pixel-static ---------- */
    vis('#s18', 53.95, null);
    tw('#lockW', { scale: 1.06, filter: 'blur(6px)', opacity: 0 }, { scale: 1, filter: 'blur(0px)', opacity: 1 }, 54.0, 0.6, 'expo.out');
    tw('#lockW', { filter: 'blur(0px)' }, { filter: 'none' }, 54.62, 0.001, 'none');
    wordsIn(st('#s18tag'), 54.3, { stagger: 0.06, dur: 0.5 });
    vis('#ctaPill', 54.5, null);
    tw('#ctaPill', { scale: 0.9, transformOrigin: '50% 50%' }, { scale: 1 }, 54.5, 0.45, 'back.out(1.6)');
    // Fin's only CTA moment: the clean brand card, beside the QR, on a soft light disc (never next to clinical UI)
    vis('#finP', 54.5, null, 0.2);
    tw('#finP', { y: 40, scale: 0.86 }, { y: 0, scale: 1 }, 54.5, 0.55, 'back.out(1.7)');
    tw('#finDisc', { scale: 0.7, opacity: 0, transformOrigin: '50% 50%' }, { scale: 1, opacity: 1 }, 54.45, 0.5, 'power3.out');
    FLOATS.push([st('#finP'), 3, 2.4, 0, 55.1, 59.5, 1.5]);
    tw('#claim', { opacity: 0 }, { opacity: 1 }, 55.0, 0.5, 'power1.out');
    sweep('#endSweep', 55.5, 0.8, '-150%', '560%');
    tw('#gradSweep', { x: -1200 }, { x: 2600 }, 55.5, 4.0, 'none');

    return G;
  }

  /* ------------------------------------------------------------------ procedural renderers */
  function buildProcs(G) {
    // Dither grain inside the dark / gradient plates is STATIC (seeded offsets, set once). Measured in fix round 2:
    // grain re-seeded at 30 Hz cost 35-65 Mb/s on those plates against 3-5 Mb/s elsewhere, which a 25 MB 2-pass encode
    // can only pay for by starving them into blocks. A fixed pattern still breaks up banding and predicts for free.
    $$('.grainL').forEach((g, i) => { const R = rng(1000 + i); g.style.backgroundPosition = `${(R() * 256) | 0}px ${(R() * 256) | 0}px`; });
    // camera rig: linear per-shot drifts (never stopping inside the window); identity outside every window
    const byEl = new Map();
    for (const d of DRIFTS) { if (!byEl.has(d[0])) byEl.set(d[0], []); byEl.get(d[0]).push(d); }
    proc((t) => {
      for (const [e, list] of byEl) {
        const d = list.find(([, a, b]) => t >= a && t <= b);
        if (!d) { e.style.translate = ''; e.style.scale = ''; continue; }
        const [, a, b, o] = d, p = prog(t, a, b);
        const x = o.x ? lerp(o.x[0], o.x[1], p) : 0, y = o.y ? lerp(o.y[0], o.y[1], p) : 0;
        e.style.translate = (o.x || o.y) ? `${x.toFixed(2)}px ${y.toFixed(2)}px` : '';
        e.style.scale = o.s ? lerp(o.s[0], o.s[1], p).toFixed(5) : '';
      }
    });
    // end card: Fin breathes 2% (never the QR) until 59.5
    const finP = $('#finP');
    proc((t) => {
      const env = Math.min(prog(t, 55.1, 55.7), 1 - prog(t, 58.9, 59.5));
      finP.style.scale = env > 0 ? (1 + 0.02 * env * Math.sin(TAU * (t - 55.1) / 3.2)).toFixed(5) : '';
    });
    proc((t) => {
      for (const [e, ax, ay, sp, ph, fr] of BLOBS) {
        const tt = Math.min(t, fr);
        e.style.translate = `${(ax * Math.sin(tt * sp + ph)).toFixed(2)}px ${(ay * Math.cos(tt * sp * 0.8 + ph)).toFixed(2)}px`;
      }
    });
    proc((t) => {
      for (const [e, amp, per, ph, t0, t1, rot] of FLOATS) {
        if (t < t0 - 0.05 || t > t1 + 0.05) { e.style.translate = '0px 0px'; if (rot) e.style.rotate = '0deg'; continue; }
        const env = Math.min(prog(t, t0, t0 + 0.4), 1 - prog(t, t1 - 0.5, t1));
        e.style.translate = `0px ${(amp * env * Math.sin(TAU * (t - t0) / per + ph)).toFixed(2)}px`;
        if (rot) e.style.rotate = `${(rot * env * Math.sin(TAU * (t - t0) / (per * 1.7) + ph + 1)).toFixed(3)}deg`;
      }
    });

    /* micro-tag and rail colour follow the plate (light on the ink grades) */
    const mt = $('#microtag'), rail = $('#rail');
    proc((t) => {
      const dark = (t >= 28 && t < 32) || (t >= 46 && t < 50);
      mt.style.color = dark ? 'rgba(255,255,255,.55)' : 'rgba(15,30,46,.55)';
      rail.classList.toggle('dark', t >= 28 && t < 32);
    });

    /* 7.85-8.5 light bloom (fix round 4): a clean, bright, brand-tinted light. Over the black breath a white point
     * opens with a mint (#E1F4F1), teal (#2BB3A6) and ocean (#1A5FC4) fringe, never a grey alpha veil: every ring
     * is a saturated brand hue or opaque white. Its white core passes the frame corners by 8.24, the mist plate is
     * cut on underneath (hidden), and the white lifts off the near-white mist by 8.5, so no frame reads muddy. */
    const bloom = $('#bloom');
    proc((t) => {
      if (t < 7.85 || t >= 8.5) { bloom.style.visibility = 'hidden'; return; }
      const C = '960px 540px';
      if (t < 8.24) {
        const p = prog(t, 7.85, 8.24), R = lerp(36, 4200, E('power2.in')(p) * 0.92 + p * 0.08);
        const k = (f) => `${(R * f).toFixed(1)}px`;
        bloom.style.background = `radial-gradient(circle at ${C}, #FFFFFF 0px, #FFFFFF ${k(0.26)}, #E1F4F1 ${k(0.4)}, rgba(43,179,166,.92) ${k(0.56)}, rgba(26,95,196,.62) ${k(0.76)}, rgba(26,95,196,.22) ${k(0.9)}, rgba(26,95,196,0) ${k(1)})`;
      } else {
        const a = 1 - E('power2.out')(prog(t, 8.24, 8.5));
        bloom.style.background = `rgba(255,255,255,${a.toFixed(4)})`;
      }
      bloom.style.visibility = 'visible';
    });
    /* 53.45-54.15 end-card plate: a soft radial colour bloom out of the QR (900 px feather, no hard edge) */
    const grad = $('#bgGrad');
    proc((t) => {
      let m = '';
      if (t < 54.15) {
        const p = E('power2.inOut')(prog(t, 53.5, 54.1)), R = lerp(0, 2900, p), F = 900;
        const [qx, qy] = G.qrStart;
        m = `radial-gradient(circle at ${qx}px ${qy}px, #000 ${Math.max(0, R - F).toFixed(1)}px, transparent ${R.toFixed(1)}px)`;
      }
      grad.style.webkitMaskImage = m; grad.style.maskImage = m;
    });

    /* S01/S02 cameras (procedural so the dust shares them exactly) */
    const cam1 = $('#s01 .cam'), cam2 = $('#s02 .cam');
    const near = $('#s02near'), far = $('#s02far'), line = $('#s02line'), head2 = $('#s02h');
    const s2scale = (t) => 1.05 + 0.03 * prog(t, 3, 4.25) + 2.2 * E('power3.in')(prog(t, 4.25, 4.5));
    const O2 = [770, 390];
    proc((t) => {
      cam1.style.transform = `scale(${(1 + 0.05 * prog(t, 0, 3)).toFixed(5)})`;
      if (t >= 2.9 && t <= 4.6) {
        cam2.style.transformOrigin = `${O2[0]}px ${O2[1]}px`;
        cam2.style.transform = `scale(${s2scale(t).toFixed(5)})`;
        const p = prog(t, 3, 4.5);
        near.style.translate = `${lerp(45, -45, p).toFixed(2)}px 0px`;
        far.style.translate = `${lerp(15, -15, p).toFixed(2)}px 0px`;
        line.style.translate = `${lerp(30, -30, p).toFixed(2)}px 0px`;
        head2.style.translate = `${lerp(14, -14, p).toFixed(2)}px 0px`;
        cam2.style.opacity = (1 - E('power2.in')(prog(t, 4.3, 4.5))).toFixed(4);
      }
    });

    /* waveform S01 / S16 (already faintly visible on frame 0) */
    const w1 = $('#wave1').getContext('2d'), w2 = $('#wave2').getContext('2d');
    const drawWave = (ctx, t, peaks, alpha) => {
      ctx.clearRect(0, 0, 1920, 220);
      if (alpha <= 0.001) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      const g = ctx.createLinearGradient(520, 0, 1400, 0);
      g.addColorStop(0, 'rgba(10,128,119,0)'); g.addColorStop(0.18, '#0A8077'); g.addColorStop(0.82, '#1A5FC4'); g.addColorStop(1, 'rgba(26,95,196,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(43,179,166,.85)'; ctx.shadowBlur = 16;
      let amp = 5;
      for (const p of peaks) amp += 58 * Math.exp(-(((t - p) / 0.13) ** 2));
      ctx.beginPath();
      for (let x = 520; x <= 1400; x += 3) {
        const u = (x - 960) / 440, win = Math.exp(-u * u * 2.4);
        const y = 110 + win * amp * (0.62 * Math.sin(x * 0.043 - t * 9.0) + 0.38 * Math.sin(x * 0.107 + t * 13.0 + 1.3));
        if (x === 520) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    };
    proc((t) => {
      if (t < 3.05) drawWave(w1, t, [0.5, 1.0, 1.5, 2.0], Math.min(0.32 + 0.68 * prog(t, 0, 0.5), 1 - prog(t, 2.3, 2.9)));
      if (t > 45.9 && t < 50.05) drawWave(w2, t, [46.5, 47.0, 47.5, 48.0], Math.min(prog(t, 46.0, 46.4), 1 - prog(t, 48.8, 49.6)));
    });

    /* dust: S01 scatter, cleared by 3.2; S15 dissolve -> S16 */
    const dust = $('#dust'), dc = dust.getContext('2d');
    proc((t) => {
      const on1 = t >= 2.15 && t < 3.2, on2 = t >= 45.65 && t < 46.8;
      dust.style.visibility = on1 || on2 ? 'visible' : 'hidden';
      if (!on1 && !on2) return;
      dc.clearRect(0, 0, 1920, 1080);
      if (on1) {
        let s, ox, oy, dx = 0;
        if (t < 3) { s = 1 + 0.05 * prog(t, 0, 3); ox = 960; oy = 540; }
        else { s = s2scale(t); ox = O2[0]; oy = O2[1]; dx = lerp(30, -30, prog(t, 3, 4.5)); }
        const clear = 1 - E('power1.in')(prog(t, 2.8, 3.2));
        for (const p of P1) {
          const ts = 2.2 + 0.32 * p.fx;
          if (t < ts) continue;
          const u = t - ts, tau = 0.7, D = tau * (1 - Math.exp(-u / tau)), m = Math.min(1, u * 2);
          const x = p.x + (90 + 150 * p.r[0]) * D + 16 * u + 14 * Math.sin(2.1 * u + TAU * p.r[1]) * m + 10 * Math.sin(p.y * 0.03 + u * 1.9) * m;
          const y = p.y - (30 + 95 * p.r[2]) * D - 7 * u + 12 * Math.cos(1.7 * u + TAU * p.r[3]) * m + 8 * Math.cos(p.x * 0.025 + u * 1.5) * m;
          const a = (0.35 + 0.65 * Math.exp(-u / 0.35)) * clear * Math.min(1, u / 0.04 + 0.3);
          if (a <= 0.004) continue;
          const X = ox + (x - ox) * s + dx, Y = oy + (y - oy) * s;
          const sz = (1.3 + 1.9 * p.r[4]) * Math.min(s, 2);
          dc.fillStyle = p.r[5] > 0.65 ? `rgba(159,216,207,${a.toFixed(3)})` : `rgba(255,255,255,${a.toFixed(3)})`;
          dc.beginPath(); dc.arc(X, Y, sz, 0, TAU); dc.fill();
        }
      } else {
        for (const p of P15) {
          const ts = 45.7 + 0.3 * p.r[0], te = ts + 0.8;
          if (t < ts) continue;
          const q = E('power2.inOut')(prog(t, ts, te));
          const tx = 960 + (p.r[1] - 0.5) * 520, ty = 560 + (p.r[2] - 0.5) * 120;
          const sw = (1 - q) * 30 * Math.sin(TAU * p.r[3] + t * 4);
          const x = lerp(p.x, tx, q) + sw, y = lerp(p.y, ty, q) + sw * 0.5;
          const a = Math.min(1, (t - ts) / 0.08) * (1 - prog(t, te - 0.3, te));
          if (a <= 0) continue;
          dc.globalAlpha = a; dc.fillStyle = p.c;
          dc.beginPath(); dc.arc(x, y, 1.8 + 2.0 * p.r[2], 0, TAU); dc.fill();
        }
        dc.globalAlpha = 1;
      }
    });

    /* S03 counters (tabular, snap 0.1) */
    const nA = $('#numA'), nB = $('#numB');
    proc((t) => {
      if (t < 4.4 || t > 7.8) return;
      const q = E('expo.out')(prog(t, 4.8, 5.6));   // the same curve as the fills, so number and bar always agree
      nA.textContent = (Math.round(491 * q) / 10).toFixed(1) + '%';
      nB.textContent = (Math.round(295 * q) / 10).toFixed(1) + '%';
    });

    /* S04 sound arcs: pulse over Fin's own arcs, then fly into the wordmark X */
    const fa = [$('#fa1'), $('#fa2')];
    const FS = 400 / A.brand.finListening.native[0];   // #finL is 400 px at (760, 330)
    const FIN = { cx: 760 + 230 * FS, cy: 330 + 102 * FS, r: [63 * FS, 83 * FS], a0: [-85.5, -84.8], a1: [-24.3, -27.7], w: 8.6 };
    const K = 14.359 * 760 / 4330.1;
    const LOGO = { cx: G.xC[0], cy: G.xC[1], r: [13.5 * K, 24.5 * K], a0: [-79, -75], a1: [-11, -15], w: 7 * K };
    const arcD = (cx, cy, r, a0, a1) => {
      const x0 = cx + r * Math.cos(a0 * D2R), y0 = cy + r * Math.sin(a0 * D2R), x1 = cx + r * Math.cos(a1 * D2R), y1 = cy + r * Math.sin(a1 * D2R);
      return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
    };
    const finBob = (t) => 6 * prog(t, 8.7, 9.0) * Math.sin(TAU * (t - 8.7) / 2);
    const finEl = $('#finL');
    proc((t) => {
      finEl.style.translate = (t > 8.65 && t < 12.0) ? `0px ${finBob(t).toFixed(2)}px` : '0px 0px';
      finEl.style.rotate = (t > 8.65 && t < 12.0) ? `${(1.6 * prog(t, 9.6, 10.0) * Math.sin(TAU * (t - 9.6) / 3.4)).toFixed(3)}deg` : '0deg';
      if (t < 8.6 || t >= 9.6) { fa.forEach((p) => p.setAttribute('opacity', 0)); return; }
      if (t < 9.0) {
        const pl = (tp) => (t < tp - 0.06 ? 0 : t < tp ? (t - tp + 0.06) / 0.06 : Math.exp(-(t - tp) / 0.22));
        const env = Math.max(pl(8.75), pl(9.0));
        const by = finBob(t);
        fa.forEach((p, i) => {
          const r = FIN.r[i] * (1 + 0.07 * env);
          p.setAttribute('d', arcD(FIN.cx, FIN.cy + by, r, FIN.a0[i], FIN.a1[i]));
          p.setAttribute('stroke-width', FIN.w);
          p.setAttribute('opacity', (0.95 * env).toFixed(3));
        });
        return;
      }
      const q = E('power3.inOut')(prog(t, 9.0, 9.6));
      const lift = -70 * Math.sin(Math.PI * q);
      const by = finBob(9.0) * (1 - q);
      fa.forEach((p, i) => {
        const cx = lerp(FIN.cx, LOGO.cx, q), cy = lerp(FIN.cy + by, LOGO.cy, q) + lift;
        p.setAttribute('d', arcD(cx, cy, lerp(FIN.r[i], LOGO.r[i], q), lerp(FIN.a0[i], LOGO.a0[i], q), lerp(FIN.a1[i], LOGO.a1[i], q)));
        p.setAttribute('stroke-width', lerp(FIN.w, LOGO.w, q).toFixed(2));
        p.setAttribute('opacity', 1);
      });
    });

    /* S06 Italian listening bars */
    const bars = $$('#itBars i'), BW = [0.5, 0.8, 1, 0.7, 0.9, 0.6, 0.4];
    proc((t) => {
      if (t < 13.8 || t > 18.1) return;
      const env = Math.max(0.15, Math.min(prog(t, 14.85, 15.15), 1 - prog(t, 16.6, 17.1)));
      const lv = env * (0.55 + 0.45 * Math.abs(Math.sin(t * 7.1) * 0.6 + Math.sin(t * 12.3 + 1.1) * 0.4));
      bars.forEach((b, i) => { b.style.height = (4 + lv * 24 * BW[i]).toFixed(1) + 'px'; });
    });

    /* rail: current node glows on every bar line */
    const glows = $$('#rail .r-glow');
    proc((t) => {
      const cur = TCUR.findIndex((tc, i) => t >= tc && t < TDONE[i]);
      glows.forEach((g, i) => {
        g.style.opacity = i === cur ? (0.3 + 0.7 * Math.exp(-((t - 14) % 2) / 0.45)).toFixed(3) : '0';
      });
    });

    /* S13 particles converge into the Thai line; rays turn; ghost type drifts */
    const c13 = $('#dust13'), x13 = c13.getContext('2d');
    const rays = $('#rays13'), gTh = $('#ghostTh');
    proc((t) => {
      if (t > 35.8 && t < 39.1) {
        rays.style.rotate = `${((t - 36) * 3).toFixed(3)}deg`;
        gTh.style.translate = `${(-40 * (t - 36) - 200).toFixed(2)}px 0px`;
      }
      const on = t >= 35.95 && t < 37.2;
      c13.style.visibility = on ? 'visible' : 'hidden';
      if (!on) return;
      x13.clearRect(0, 0, 1920, 1080);
      for (const p of P13) {
        const ts = 36.05 + 0.42 * p.fx, te = ts + 0.42;
        const a = Math.min(prog(t, ts - 0.15, ts), 1 - prog(t, te, te + 0.25));
        if (a <= 0) continue;
        const q = E('power3.out')(prog(t, ts, te));
        const sx = p.x + (p.r[0] - 0.5) * 760, sy = p.y + (p.r[1] - 0.5) * 420 - 40;
        const sw = (1 - q) * 24 * Math.sin(TAU * p.r[2] + t * 5);
        const x = lerp(sx, p.x, q) + sw, y = lerp(sy, p.y, q) - sw * 0.6;
        x13.fillStyle = p.r[3] > 0.5 ? `rgba(10,128,119,${(0.9 * a).toFixed(3)})` : `rgba(26,95,196,${(0.9 * a).toFixed(3)})`;
        x13.beginPath(); x13.arc(x, y, 1.4 + 1.5 * p.r[4], 0, TAU); x13.fill();
      }
    });

    /* S14 pulses: they travel only along connectors and wait at the light gate */
    const paths = {};
    for (const id of Object.keys(TR.con)) { const p = $('#' + id); paths[id] = { p, L: p.getTotalLength() }; }
    const pulseEls = { tpA: $('#tpA'), tpB: $('#tpB') };
    const lenOf = (c, v) => (v === 'gate' ? TR.gateLen : v * paths[c].L);
    proc((t) => {
      const shown = {};
      if (t > 38.8 && t < 42.05) {
        for (const [pid, c, a, b, t0, t1] of PULSES) {
          if (t < t0 || t > t1 || shown[pid]) continue;
          const q = a === b ? 0 : E('power1.inOut')(prog(t, t0, t1));
          const pt = paths[c].p.getPointAtLength(lerp(lenOf(c, a), lenOf(c, b), q));
          const hold = a === 'gate' && b === 'gate';
          const sc = hold ? 1 + 0.18 * Math.sin(TAU * (t - t0) * 2.4) : 1;
          shown[pid] = `translate(${pt.x.toFixed(2)}px, ${pt.y.toFixed(2)}px) scale(${sc.toFixed(3)})`;
        }
      }
      for (const pid in pulseEls) {
        const e = pulseEls[pid];
        if (shown[pid]) { e.style.transform = shown[pid]; e.style.opacity = '1'; } else e.style.opacity = '0';
      }
    });

    /* S15 dashed "Needs check" outline marches */
    const dr = $('#dashRect');
    proc((t) => { if (t > 41.5 && t < 46.5) dr.style.strokeDashoffset = (-t * 32).toFixed(2); });

    /* S16 tremble (tension, then lock) */
    const t2a = $('#t2c2'), t2b = $('#t2c3');
    proc((t) => {
      const env = t > 47.4 && t < 47.9 ? Math.sin(Math.PI * prog(t, 47.4, 47.9)) : 0;
      const j = (k) => `${(2 * env * Math.sin(t * 95 + k)).toFixed(2)}px ${(2 * env * Math.cos(t * 83 + k)).toFixed(2)}px`;
      t2a.style.translate = j(0); t2b.style.translate = j(1.7);
    });

    /* S17 URL types on; the caret sits at the measured width of the typed text */
    const chars = $$('#url .ch'), caret = $('#url .caret');
    const ends = chars.map((c) => c.offsetLeft + c.offsetWidth);
    proc((t) => {
      const n = Math.floor(prog(t, 50.9, 51.7) * chars.length + 1e-6);
      chars.forEach((c, i) => { c.style.opacity = i < n ? '1' : '0'; });
      caret.style.left = (n > 0 ? ends[n - 1] + 4 : 0) + 'px';
      const on = t >= 50.85 && t < 53.5 && (t < 51.8 || Math.floor((t - 51.8) * 2.4) % 2 === 0);
      caret.style.opacity = on ? '1' : '0';
    });
  }

  /* ------------------------------------------------------------------ boot */
  // Order-independent: GSAP renders crossed tweens in reverse order on a backward jump, so a finished
  // earlier tween could overwrite an active later one on the same property. Any backward jump therefore
  // replays forward from 0, which gives exactly the state a forward render reaches.
  let lastT = 0;
  function seek(t) {
    const tt = clamp(+t || 0, 0, DUR);
    if (tt < lastT) M.seek(0, true);
    M.seek(tt, true);
    lastT = tt;
    for (const p of PROCS) p(tt);
    return tt;
  }
  const ready = (async () => {
    await loadFonts();
    await loadImages();
    buildDom();
    await Promise.all($$('#stage img').map((im) => (im.decode ? im.decode().catch(() => {}) : 0)));
    await document.fonts.ready;
    buildParticles();
    const G = buildTimeline();
    buildProcs(G);
    // base state = earliest "from" of every animated property; then initialise every tween once
    applyBase();
    M.seek(DUR, true); M.seek(0, true);
    seek(0);
    window.__seek = seek;
    window.__timeline = M;
    if (window.__assetWarnings.length) console.warn('[promo] asset warnings:\n' + window.__assetWarnings.join('\n'));
    return true;
  })();
  ready.catch((e) => { console.error('[promo] init failed', e); window.__initError = String(e && e.stack || e); });
  window.__ready = () => ready;
  window.__seek = (t) => { console.warn('__seek called before __ready resolved'); return t; };
})();
