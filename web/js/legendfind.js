/* EchoSphere picture tool: find a picture's colour legend automatically (task 2.31).
   1. findBar(img): looks for a long, thin strip whose colour changes along its length but stays the same across
      it (a colour bar). Returns its box in % of the picture, or null.
   2. readLabels(img, bar): reads the numbers and text around the bar with Tesseract.js (Apache-2.0), vendored in
      vendor/tesseract/ and loaded only when asked. Works out low/high, linear vs logarithmic, units and title.
   3. guessArea(bar): a map area that leaves out the legend and its labels.
   Everything runs in the browser: the picture is never sent anywhere. Detection only proposes what is visible in
   the picture; anything unclear is left empty for the user.
   Code written with AI assistance (Claude, Anthropic). */
(function () {
  "use strict";
  const MAX_W = 900;
  const ALONG = 80;   // max colour step between neighbours along the bar (allows stepped legends)
  const ACROSS = 30;  // max colour change across the bar's short side
  const d1 = (d, a, b) => Math.abs(d[a] - d[b]) + Math.abs(d[a + 1] - d[b + 1]) + Math.abs(d[a + 2] - d[b + 2]);

  function pixels(img) {
    const c = document.createElement("canvas");
    const s = Math.min(1, MAX_W / img.naturalWidth);
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, c.width, c.height);
    return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data };
  }

  /** Best bar for one orientation. u = along the bar, v = across it. */
  function scan(px, horizontal) {
    const U = horizontal ? px.w : px.h, V = horizontal ? px.h : px.w, d = px.d;
    const at = horizontal ? (u, v) => (v * px.w + u) * 4 : (u, v) => (u * px.w + v) * 4;
    const minLen = Math.max(40, Math.round(0.12 * U)), tol = Math.max(3, Math.round(0.006 * U)), gap = Math.max(2, Math.round(0.004 * U));
    const quant = (o) => `${d[o] >> 4},${d[o + 1] >> 4},${d[o + 2] >> 4}`;
    let open = [], best = null;
    const close = b => {
      const t = b.v1 - b.v0 + 2, len = b.u1 - b.u0 + 1;
      if (t < 4 || len < minLen || len / t < 4) return;
      // the same colours along the top and bottom edge of the band
      let diff = 0; const N = 24;
      for (let k = 0; k < N; k++) { const u = Math.round(b.u0 + (k + 0.5) / N * (len - 1)); diff += d1(d, at(u, b.v0), at(u, b.v1 + 1)); }
      if (diff / N > 40) return;
      const vm = Math.round((b.v0 + b.v1 + 1) / 2), seen = new Set();
      let spread = 0; const o0 = at(b.u0, vm);
      for (let u = b.u0; u <= b.u1; u++) { const o = at(u, vm); seen.add(quant(o)); spread = Math.max(spread, d1(d, o, o0)); }
      if (seen.size < 12 || spread < 90) return;
      // a colour bar keeps changing along its length; a strip of map is mostly flat (ocean, land)
      const SEG = 16, seg = [];
      for (let k = 0; k < SEG; k++) {
        const a = Math.round(b.u0 + k / SEG * len), z = Math.max(a + 1, Math.round(b.u0 + (k + 1) / SEG * len));
        const m = [0, 0, 0];
        for (let u = a; u < z; u++) { const o = at(u, vm); m[0] += d[o]; m[1] += d[o + 1]; m[2] += d[o + 2]; }
        seg.push(m.map(c => c / (z - a)));
      }
      let changed = 0;
      for (let k = 1; k < SEG; k++) if (Math.abs(seg[k][0] - seg[k - 1][0]) + Math.abs(seg[k][1] - seg[k - 1][1]) + Math.abs(seg[k][2] - seg[k - 1][2]) > 8) changed++;
      if (changed < 10) return;
      const score = len * Math.min(seen.size, 24) * Math.min(t, 12);
      if (!best || score > best.score) best = { u0: b.u0, u1: b.u1, v0: b.v0, v1: b.v1 + 1, distinct: seen.size, score };
    };
    for (let v = 0; v < V - 1; v++) {
      const runs = [];
      let s = -1, last = -1;
      const push = () => { if (s >= 0 && last + 1 - s + 1 >= minLen) runs.push([s, last + 1]); s = -1; };
      for (let u = 0; u < U - 1; u++) {
        const o = at(u, v), good = d1(d, o, at(u + 1, v)) <= ALONG && d1(d, o, at(u, v + 1)) <= ACROSS;
        if (good) {
          if (s >= 0 && u - last > 1 && d1(d, at(last, v), o) > ALONG) push(); // a real edge, not a thin tick
          if (s < 0) s = u; last = u;
        }
        else if (s >= 0 && u - last > gap) push(); // thin tick marks across the bar are bridged
      }
      push();
      const next = [];
      for (const [r0, r1] of runs) {
        // rows of one bar overlap almost fully (they may differ at the ends: "no data" squares, arrow tips);
        // the bar is the part shared by all its rows
        const i = open.findIndex(b => Math.min(b.l1, r1) - Math.max(b.l0, r0) >= 0.85 * Math.max(r1 - r0, b.l1 - b.l0) - tol);
        if (i >= 0) { const b = open.splice(i, 1)[0]; b.v1 = v; b.l0 = r0; b.l1 = r1; b.u0 = Math.max(b.u0, r0); b.u1 = Math.min(b.u1, r1); next.push(b); }
        else next.push({ v0: v, v1: v, u0: r0, u1: r1, l0: r0, l1: r1 });
      }
      open.forEach(close);
      open = next;
    }
    open.forEach(close);
    if (!best) return null;
    // the colours must really change: trim flat grey/white/black ends (e.g. an arrow tip beyond the scale)
    const vm = Math.round((best.v0 + best.v1) / 2), len = best.u1 - best.u0 + 1, flatMax = Math.round(0.03 * len);
    const grey = o => { const mx = Math.max(d[o], d[o + 1], d[o + 2]), mn = Math.min(d[o], d[o + 1], d[o + 2]); return mx - mn < 25; };
    const trim = (from, step) => { let u = from; while (Math.abs(u - from) < flatMax && d1(d, at(u + step, vm), at(from, vm)) <= 12) u += step; return grey(at(from, vm)) && Math.abs(u - from) >= 2 ? u : from; };
    best.u1 = trim(best.u1, -1); best.u0 = trim(best.u0, 1);
    best.horizontal = horizontal;
    return best;
  }

  const r1 = v => Math.round(v * 10) / 10;

  /** The picture's colour bar as {x, y, w, h} in %, plus its orientation, or null. */
  function findBar(img) {
    const px = pixels(img);
    const h = scan(px, true), v = scan(px, false);
    const b = h && (!v || h.score >= v.score) ? h : v;
    if (!b) return null;
    const box = b.horizontal
      ? { x: b.u0 / px.w * 100, y: b.v0 / px.h * 100, w: (b.u1 - b.u0 + 1) / px.w * 100, h: (b.v1 - b.v0 + 1) / px.h * 100 }
      : { x: b.v0 / px.w * 100, y: b.u0 / px.h * 100, w: (b.v1 - b.v0 + 1) / px.w * 100, h: (b.u1 - b.u0 + 1) / px.h * 100 };
    return { box: { x: r1(box.x), y: r1(box.y), w: r1(box.w), h: r1(box.h) }, horizontal: b.horizontal, distinct: b.distinct };
  }

  /** Region around the bar where its labels and title are (in %), clipped to the picture. */
  function labelRegion(bar, aspect) {
    const b = bar.box;
    // margin: 1.5× the bar's thickness or 14% of its length, whichever is bigger (in % of the width)
    const len = bar.horizontal ? b.w : b.h * (1 / aspect), thick = bar.horizontal ? b.h / aspect : b.w; // both in % of width
    const m = Math.max(1.5 * thick, 0.14 * len);
    const mx = m, my = m * aspect;
    const x0 = Math.max(0, b.x - mx), y0 = Math.max(0, b.y - my), x1 = Math.min(100, b.x + b.w + mx), y1 = Math.min(100, b.y + b.h + my);
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /** The biggest part of the picture beside the legend region: above, below, left or right of it. */
  function guessArea(bar, aspect) {
    const L = labelRegion(bar, aspect);
    const opts = [
      { x: 0, y: 0, w: 100, h: L.y },
      { x: 0, y: L.y + L.h, w: 100, h: 100 - L.y - L.h },
      { x: 0, y: 0, w: L.x, h: 100 },
      { x: L.x + L.w, y: 0, w: 100 - L.x - L.w, h: 100 },
    ].map(o => ({ x: r1(o.x), y: r1(o.y), w: Math.floor(o.w * 10) / 10, h: Math.floor(o.h * 10) / 10 }));
    return opts.sort((a, b) => b.w * b.h - a.w * a.h)[0];
  }

  /* ---------- OCR ---------- */
  let workerP = null;
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("load " + src)); document.head.appendChild(s); });
  }
  function worker() {
    if (!workerP) {
      const base = new URL("vendor/tesseract/", location.href).href;
      workerP = (window.Tesseract ? Promise.resolve() : loadScript(base + "tesseract.min.js"))
        .then(() => window.Tesseract.createWorker("eng", 1, { workerPath: base + "worker.min.js", corePath: base, langPath: base.replace(/\/$/, ""), workerBlobURL: false }))
        .then(async w => { await w.setParameters({ tessedit_pageseg_mode: "11", preserve_interword_spaces: "1" }); return w; })
        .catch(e => { workerP = null; throw e; });
    }
    return workerP;
  }

  /** Crop the label region at full resolution, hide the bar, dark text on white, scaled up for OCR. */
  function ocrCanvas(img, bar, R) {
    const W = img.naturalWidth, H = img.naturalHeight;
    const sx = Math.round(R.x / 100 * W), sy = Math.round(R.y / 100 * H), sw = Math.max(1, Math.round(R.w / 100 * W)), sh = Math.max(1, Math.round(R.h / 100 * H));
    const f = Math.max(1, Math.min(4, Math.floor(2400 / sw)));
    const c = document.createElement("canvas"); c.width = sw * f; c.height = sh * f;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.imageSmoothingQuality = "high";
    g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const id = g.getImageData(0, 0, c.width, c.height), d = id.data, n = c.width * c.height;
    const L = new Float32Array(n);
    for (let i = 0; i < n; i++) L[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
    // background = median brightness of the crop; text is whichever side is rarer
    const sorted = Array.from(L.filter((_, i) => i % 7 === 0)).sort((a, b) => a - b), med = sorted[sorted.length >> 1];
    const dark = med < 128;
    // hide the bar with its outline, end squares and arrow tips: a little wider across, 7% longer at each end
    const b = bar.box, ax = bar.horizontal ? 0.07 * b.w : Math.max(0.2 * b.w, 0.7), ay = bar.horizontal ? Math.max(0.2 * b.h, 0.7) : 0.07 * b.h;
    const bx0 = (b.x - ax - R.x) / R.w * c.width - 2 * f, bx1 = (b.x + b.w + ax - R.x) / R.w * c.width + 2 * f;
    const by0 = (b.y - ay - R.y) / R.h * c.height - 2 * f, by1 = (b.y + b.h + ay - R.y) / R.h * c.height + 2 * f;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const i = y * c.width + x;
      let v = Math.abs(L[i] - med) > 60 ? 0 : 255;            // text far from the background → black
      if (x >= bx0 && x <= bx1 && y >= by0 && y <= by1) v = 255; // the bar itself is not text
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    return { canvas: c, f, sx, sy, dark };
  }

  const NUM = /^[-−]?\d+(?:[.,]\d+)?$/;
  const toNum = t => parseFloat(t.replace("−", "-").replace(",", "."));
  const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b));

  /**
   * Turn OCR words (positions in % of the picture) into legend values.
   * Returns {low, high, reverse, log, units, what, labels, sure, note} with nulls/"" for anything unclear.
   */
  function parseLabels(words, bar) {
    const b = bar.box, cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const along = w => bar.horizontal ? w.cx : -w.cy;                        // vertical bars: bottom = low
    const inSpan = w => bar.horizontal ? w.cx >= b.x - 0.15 * b.w && w.cx <= b.x + 1.15 * b.w : w.cy >= b.y - 0.15 * b.h && w.cy <= b.y + 1.15 * b.h;
    const side = w => bar.horizontal ? (w.cy > cy ? 1 : -1) : (w.cx > cx ? 1 : -1);
    const nums = words.filter(w => NUM.test(w.text) && w.conf >= 40 && inSpan(w));
    // labels sit on one side of the bar: take the side with more numbers
    const sides = [1, -1].map(s => nums.filter(w => side(w) === s));
    const labels = (sides[0].length >= sides[1].length ? sides[0] : sides[1]).sort((p, q) => along(p) - along(q));
    const vals = labels.map(w => toNum(w.text));
    const out = { low: null, high: null, reverse: false, log: false, units: "", what: "", labels: vals, sure: "no", note: "", labelWords: labels };
    // the outer numbers must sit at the two ends of the bar, or they are not the bar's low and high
    const len = bar.horizontal ? b.w : b.h, pos = w => bar.horizontal ? (w.cx - b.x) / len : (b.y + b.h - w.cy) / len;
    const covers = labels.length >= 2 && Math.min(pos(labels[0]), 1 - pos(labels[0])) <= 0.12 && Math.min(pos(labels[labels.length - 1]), 1 - pos(labels[labels.length - 1])) <= 0.12;
    if (vals.length < 2) out.note = vals.length ? `I could read only one number (${vals[0]}).` : "I could not read any numbers next to the legend.";
    else if (!covers) out.note = `I read the numbers ${vals.join(", ")}, but they do not reach both ends of the colour bar.`;
    else {
      const inc = vals.every((v, i) => !i || v > vals[i - 1]), dec = vals.every((v, i) => !i || v < vals[i - 1]);
      const asc = inc ? vals : vals.slice().reverse();
      const diffs = asc.slice(1).map((v, i) => v - asc[i]);
      const ratios = asc.every(v => v > 0) ? asc.slice(1).map((v, i) => v / asc[i]) : null;
      const linear = diffs.every(x => near(x, diffs[0], 0.12));
      const log = !!ratios && ratios.length >= 2 && ratios.every(r => r >= 2 && near(r, ratios[0], 0.12));
      if ((inc || dec) && (vals.length === 2 || linear || log)) {
        out.low = asc[0]; out.high = asc[asc.length - 1]; out.reverse = dec; out.log = log && !linear;
        out.sure = vals.length >= 3 ? "yes" : "fairly";
      } else out.note = `I read the numbers ${vals.join(", ")}, but they do not form an even scale, so some may be misread.`;
    }
    // text lines (no digits) near the bar: the nearest one before it = what it shows, after it = units.
    // A line is used only if every word in it was read clearly.
    const text = words.filter(w => !/\d/.test(w.text) && /[A-Za-zµμ]/.test(w.text));
    const lines = [];
    text.forEach(w => { const l = lines.find(l => Math.abs(l.cy - w.cy) < w.h * 0.6); if (l) { l.words.push(w); l.cy = (l.cy + w.cy) / 2; } else lines.push({ cy: w.cy, words: [w] }); });
    lines.forEach(l => { l.words.sort((p, q) => p.cx - q.cx); l.text = l.words.map(w => w.text).join(" ").replace(/\s+/g, " ").trim(); l.conf = Math.min(...l.words.map(w => w.conf)); });
    const usable = lines.filter(l => l.text.replace(/[^A-Za-zµμ]/g, "").length >= 3);
    const above = usable.filter(l => l.cy < b.y).sort((p, q) => q.cy - p.cy)[0], below = usable.filter(l => l.cy > b.y + b.h).sort((p, q) => p.cy - q.cy)[0];
    const ok = l => l && l.conf >= 70;
    if (ok(above)) out.what = above.text;
    if (ok(below)) out.units = below.text;
    out.unclear = [above && !ok(above) ? "title" : "", below && !ok(below) ? "units" : ""].filter(Boolean);
    return out;
  }

  /** Words read more than once (overlapping boxes) become one: the most confident reading wins. */
  function merge(ws) {
    const out = [];
    ws.slice().sort((a, b) => b.conf - a.conf).forEach(w => {
      if (!out.some(o => Math.min(o.x1, w.x1) > Math.max(o.x0, w.x0) && Math.min(o.y1, w.y1) > Math.max(o.y0, w.y0))) out.push(w);
    });
    return out;
  }

  /** OCR one region; returns words with positions in % of the picture. */
  async function ocr(w, img, bar, R, params) {
    const { canvas, f, sx, sy } = ocrCanvas(img, bar, R);
    await w.setParameters(params);
    const { data } = await w.recognize(canvas);
    const W = img.naturalWidth, H = img.naturalHeight;
    return (data.words || []).map(x => {
      const b = x.bbox, X0 = sx + b.x0 / f, X1 = sx + b.x1 / f, Y0 = sy + b.y0 / f, Y1 = sy + b.y1 / f;
      return { text: x.text.trim().replace(/^[^\w(µμ−-]+|[^\w)/.µμ]+$/g, ""), conf: x.confidence, cx: (X0 + X1) / 2 / W * 100, cy: (Y0 + Y1) / 2 / H * 100, h: (Y1 - Y0) / H * 100, y0: Y0 / H * 100, y1: Y1 / H * 100, x0: X0 / W * 100, x1: X1 / W * 100 };
    }).filter(x => x.text);
  }

  /** OCR around the bar. progress(msg) gets short status messages. */
  async function readLabels(img, bar, progress) {
    const aspect = img.naturalWidth / img.naturalHeight, b = bar.box, R = labelRegion(bar, aspect);
    progress && progress("Loading the text reader (about 7 MB, only the first time)…");
    const w = await worker();
    progress && progress("Reading the legend's numbers and labels…");
    // pass 1: all text around the bar (sparse text)
    let words = await ocr(w, img, bar, R, { tessedit_pageseg_mode: "11", tessedit_char_whitelist: "" });
    // pass 2: only digits, on the line of numbers (short labels such as "0" or "5" are often missed in pass 1)
    const pre = parseLabels(words, bar);
    const numW = pre.labelWords;
    const strips = [];
    if (bar.horizontal) {
      const xs = { x: Math.max(0, b.x - 0.12 * b.w), w: Math.min(100, b.x + 1.12 * b.w) - Math.max(0, b.x - 0.12 * b.w) };
      const th = Math.max(b.h, 3);
      if (numW.length) { const y0 = Math.min(...numW.map(x => x.y0)), y1 = Math.max(...numW.map(x => x.y1)), pad = (y1 - y0) * 0.4; strips.push(Object.assign({ y: Math.max(0, y0 - pad), h: Math.min(100, y1 + pad) - Math.max(0, y0 - pad) }, xs)); }
      strips.push(Object.assign({ y: b.y + b.h, h: Math.min(th * 2, 100 - b.y - b.h) }, xs), Object.assign({ y: Math.max(0, b.y - th * 2), h: Math.min(th * 2, b.y) }, xs));
    } else {
      const ys = { y: Math.max(0, b.y - 0.08 * b.h), h: Math.min(100, b.y + 1.08 * b.h) - Math.max(0, b.y - 0.08 * b.h) };
      const tw = Math.max(b.w * 3, 8);
      strips.push(Object.assign({ x: b.x + b.w, w: Math.min(tw, 100 - b.x - b.w) }, ys), Object.assign({ x: Math.max(0, b.x - tw), w: Math.min(tw, b.x) }, ys));
    }
    // several readings of the same labels: keep, at each position, the reading the OCR is surest of
    const cands = numW.slice();
    for (let k = 0; k < strips.length; k++) {
      const S = strips[k];
      if (S.w < 0.5 || S.h < 0.5) continue;
      if (k === strips.length - 1 && bar.horizontal && merge(cands).length >= 2) break; // labels above: only if none below
      for (const psm of bar.horizontal ? ["7", "11"] : ["6", "11"])
        cands.push(...(await ocr(w, img, bar, S, { tessedit_pageseg_mode: psm, tessedit_char_whitelist: "0123456789.-" })).filter(x => NUM.test(x.text) && x.conf >= 40));
    }
    await w.setParameters({ tessedit_char_whitelist: "" });
    words = words.filter(x => !NUM.test(x.text)).concat(merge(cands));
    const res = parseLabels(words, bar);
    res.words = words.map(x => x.text);
    return res;
  }

  window.EchoLegend = { findBar, guessArea, readLabels, parseLabels, labelRegion };
})();
