/* EchoSphere snapshot → music (tasks 2.24, 2.25): the user uploads 1–4 pictures (e.g. NASA EIC snapshots).
   For each picture they mark ① the map area to listen to and ② the colour legend, and type the legend's
   low/high values. Every pixel inside the area is matched to the nearest legend colour, and the area is read
   west → east in 32 slices (one note per slice). Each picture becomes one layer of a "Your snapshots" source.
   Saved pictures can be edited (area, legend, values) without uploading them again.
   "Find legend automatically" (task 2.31, js/legendfind.js) proposes the legend box, map area, values, units and
   linear/logarithmic scale; the user checks them before saving. Logarithmic legends are read in log10.
   Pictures never leave the browser. Pixels that match no legend colour (text, borders, background) are silent.
   Code written with AI assistance (Claude, Anthropic). */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const STUDIO = window.EchoStudio, live = window.EchoApp.live;
  const SLICES = 32, PALETTE = 64, MAX_PICS = 4, MAX_W = 900;
  const MATCH = 3 * 38 * 38; // max squared RGB distance to count as a legend colour
  const COLORS = ["#FFB547", "#4FC3F7", "#FF5EA8", "#9CCC65"];
  const REGISTERS = ["high", "mid", "lowmid", "low"], PANS = [0.3, -0.3, 0.15, -0.15];
  const DEFAULTS = [
    { orchestra: "trumpet", band: "saxophone" }, { orchestra: "harp", band: "electric_piano_1" },
    { orchestra: "bassoon", band: "guitar-electric" }, { orchestra: "marimba", band: "pad_2_warm" },
  ];
  const WHOLE = { x: 0, y: 0, w: 100, h: 100 };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clean = (s, n) => String(s).replace(/[<>"&]/g, "").slice(0, n);

  // img/src/file: the picture in the editor; editing: index of the saved picture being edited (-1 = new upload)
  // scale: how colours become numbers. "legend" = the picture's colour bar (marked by the user);
  // without a legend: "rainbow" (blue → green → yellow → red = low → high), "dark" or "light" (relative 0–100)
  const SCALES = {
    legend:  { label: "The picture has a colour legend (colour bar): I will mark it" },
    rainbow: { label: "No legend: blue → green → yellow → red means low → high", hint: w => `redder colour = more ${w}`,
               note: w => `Higher notes = colours further along blue → green → yellow → red, which on this picture means more ${w}. Black, grey and white count as none, so a slice with only a few coloured spots sounds low.` },
    dark:    { label: "No legend: darker means higher", hint: w => `darker = more ${w}`,
               note: w => `Higher notes = darker colours, which on this picture means more ${w}.` },
    light:   { label: "No legend: lighter means higher", hint: w => `lighter = more ${w}`,
               note: w => `Higher notes = lighter colours, which on this picture means more ${w}.` },
  };
  const lum = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  /** 0–1 position on a no-legend scale, or null for pixels that carry no value. */
  const T_OF = {
    rainbow: (r, g, b) => {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      if (!mx || d / mx < 0.3 || mx < 64) return null; // grey, black, white: nothing
      let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
      if (h > 300) return 1;    // magenta just past red
      if (h > 240) return null; // purple: not on the scale
      return (240 - h) / 240;   // blue 0 · cyan .25 · green .5 · yellow .75 · red 1
    },
    dark: (r, g, b) => 1 - lum(r, g, b),
    light: (r, g, b) => lum(r, g, b),
  };

  const sn = { img: null, src: null, file: "", editing: -1, mode: "area", scale: "legend",
               area: Object.assign({}, WHOLE), legend: { x: 0, y: 0, w: 0, h: 0 }, legendSet: false, layers: [] };

  /* ---------- decoding ---------- */
  function pixels(img) {
    const c = document.createElement("canvas");
    const scale = Math.min(1, MAX_W / img.naturalWidth);
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, c.width, c.height);
    return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data, canvas: c };
  }

  /** Legend colours, low → high, sampled along the long side of the marked box. */
  function palette(px, box, reverse) {
    const x0 = Math.round(box.x / 100 * px.w), y0 = Math.round(box.y / 100 * px.h);
    const bw = Math.max(1, Math.round(box.w / 100 * px.w)), bh = Math.max(1, Math.round(box.h / 100 * px.h));
    const horizontal = bw >= bh, out = [];
    for (let i = 0; i < PALETTE; i++) {
      const t = (i + 0.5) / PALETTE;
      let r = 0, g = 0, b = 0, n = 0;
      for (let k = 0.3; k <= 0.7; k += 0.1) { // middle of the short side, away from borders
        const x = horizontal ? x0 + t * bw : x0 + k * bw;
        const y = horizontal ? y0 + k * bh : y0 + (1 - t) * bh; // vertical legends: low at the bottom
        const o = (Math.min(px.h - 1, Math.max(0, Math.round(y))) * px.w + Math.min(px.w - 1, Math.max(0, Math.round(x)))) * 4;
        r += px.d[o]; g += px.d[o + 1]; b += px.d[o + 2]; n++;
      }
      out.push([r / n, g / n, b / n]);
    }
    return reverse ? out.reverse() : out;
  }

  /** Values per slice of the map area (west → east): mean legend value of matching pixels, null if too few match. */
  function decode(img, area, legend, reverse, low, high, scale, log) {
    const px = pixels(img), tOf = T_OF[scale];
    if (tOf) legend = { x: -1, y: -1, w: 0, h: 0 }; // no legend to skip
    const pal = tOf ? [] : palette(px, legend, reverse);
    // a colour bar changes colour along its length and holds many different colours;
    // a box on plain background or on text does not
    const spread = tOf ? 999 : Math.max(...pal.map(p => Math.hypot(p[0] - pal[0][0], p[1] - pal[0][1], p[2] - pal[0][2])));
    const distinct = tOf ? 99 : new Set(pal.map(p => p.map(c => Math.round(c / 24)).join(","))).size;
    if (spread < 60 || distinct < 8) return { values: Array(SLICES).fill(null), matched: 0, flat: true };
    const lx0 = legend.x / 100 * px.w, lx1 = (legend.x + legend.w) / 100 * px.w, ly0 = legend.y / 100 * px.h, ly1 = (legend.y + legend.h) / 100 * px.h;
    const ax0 = Math.max(0, Math.floor(area.x / 100 * px.w)), ax1 = Math.min(px.w, Math.ceil((area.x + area.w) / 100 * px.w));
    const ay0 = Math.max(0, Math.floor(area.y / 100 * px.h)), ay1 = Math.min(px.h, Math.ceil((area.y + area.h) / 100 * px.h));
    const aw = Math.max(1, ax1 - ax0);
    const sum = new Float64Array(SLICES), cnt = new Uint32Array(SLICES), seen = new Uint32Array(SLICES);
    for (let y = ay0; y < ay1; y += 2) for (let x = ax0; x < ax1; x += 2) {
      if (x >= lx0 && x <= lx1 && y >= ly0 && y <= ly1) continue; // skip the legend itself
      const o = (y * px.w + x) * 4, s = Math.min(SLICES - 1, Math.floor((x - ax0) / aw * SLICES));
      seen[s]++;
      if (px.d[o + 3] < 128) continue;
      if (tOf) { const t = tOf(px.d[o], px.d[o + 1], px.d[o + 2]); if (t !== null) { sum[s] += t; cnt[s]++; } continue; }
      let best = Infinity, bi = 0;
      for (let i = 0; i < PALETTE; i++) {
        const p = pal[i], dr = px.d[o] - p[0], dg = px.d[o + 1] - p[1], db = px.d[o + 2] - p[2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < best) { best = dist; bi = i; }
      }
      if (best <= MATCH) { sum[s] += bi / (PALETTE - 1); cnt[s]++; }
    }
    const values = [];
    // with a legend: mean value of the matching pixels (the legend has its own colour for "none").
    // without a legend: black/grey/white mean "none" and count as 0, so a slice with a few spots sounds low.
    for (let s = 0; s < SLICES; s++) {
      const mean = tOf ? sum[s] / Math.max(1, seen[s]) : sum[s] / Math.max(1, cnt[s]);
      // logarithmic legends: equal steps along the bar are equal ratios (e.g. 0.001 → 0.01 → 0.1)
      const v = log ? Math.pow(10, Math.log10(low) + mean * (Math.log10(high) - Math.log10(low))) : low + mean * (high - low);
      values.push(cnt[s] >= 5 ? +v.toPrecision(4) : null); // sparse maps (e.g. fires) are fine
    }
    const matched = cnt.reduce((a, b) => a + b, 0) / Math.max(1, seen.reduce((a, b) => a + b, 0));
    // the player shows only the map area
    const crop = document.createElement("canvas");
    crop.width = aw; crop.height = Math.max(1, ay1 - ay0);
    crop.getContext("2d").drawImage(px.canvas, ax0, ay0, crop.width, crop.height, 0, 0, crop.width, crop.height);
    return { values, matched, picture: { url: crop.toDataURL("image/jpeg", 0.9), aspect: crop.width / crop.height } };
  }

  const whatOf = l => l.what || "of what the map shows";
  const noteFor = l => (l.scale || "legend") === "legend"
    ? `Higher notes = higher values on the picture's legend (${l.low} to ${l.high} ${l.units}${l.log ? ", logarithmic scale" : ""})${l.what ? `, which means more ${l.what}` : ""}.`
    : SCALES[l.scale].note(whatOf(l)) + " Levels are relative (0–100) because the picture has no legend.";
  const hintFor = l => (l.scale || "legend") === "legend" ? `higher legend value = higher note${l.what ? ` (more ${l.what})` : ""}` : SCALES[l.scale].hint(l.what || "of it");

  /* ---------- song ---------- */
  const pct = b => `left ${b.x}%, top ${b.y}%, ${b.w}% × ${b.h}%`;
  function song() {
    const steps = Array.from({ length: SLICES }, (_, i) => `Slice ${i + 1} of ${SLICES}${i === 0 ? " (west)" : i === SLICES - 1 ? " (east)" : ""}`);
    return {
      id: "snapshot", snapshot: true, studio: true,
      title: "Your snapshots", studioTitle: "Your snapshot song",
      subtitle: "Pictures you uploaded, turned into music",
      place: sn.layers.map(l => l.file).join(", "),
      period: `${SLICES} slices, west → east`,
      cover: "", stepUnit: "slice", steps, captions: {},
      intro: "This song was decoded in your browser from pictures you uploaded, using the map areas and colour legends you marked.",
      limits: [
        "EchoSphere cannot check where an uploaded picture comes from. Use NASA visualizations (for example EIC snapshots) for real data.",
        "Each picture's map area is read west → east in 32 slices; a note is the average legend value of the pixels in that slice. Pixels that match no legend colour (text, borders, background) are ignored, and a slice with almost no matches is silent.",
        "Pictures without a legend give relative levels (0–100) from their colours, not real units.",
        "Values assume the legend is linear between the low and high values, unless \"Logarithmic legend\" is ticked (then equal steps along the bar are equal ratios). Compressed screenshots and map projections make values less exact.",
        ...(sn.layers.some(l => l.auto) ? ["The legend of at least one picture was found automatically in your browser (colour-bar search + Tesseract.js text reading, Apache-2.0 licence) and checked by you before saving."] : []),
        "Your pictures never leave your device, so snapshot songs cannot be shared as a link. Use Save as WAV to keep the music.",
      ],
      layers: sn.layers.map((l, i) => ({
        id: `snap${i + 1}`, name: l.name, icon: "🖼️", color: COLORS[i], units: l.units || "legend units",
        values: l.values, legendStep: Math.abs(l.high - l.low) / 20, register: REGISTERS[i], pan: PANS[i],
        defaults: DEFAULTS[i], sourceKind: "upload", picture: l.picture, hint: hintFor(l),
        describe: `Decoded from your picture "${l.file}". ${noteFor(l)}`,
        source: { name: `Your picture: ${l.file}`, url: "#" },
        method: l.scale !== "legend" ? `Map area ${pct(l.area)}; no legend: ${SCALES[l.scale].label.replace("No legend: ", "")} (relative 0–100). ${Math.round(l.matched * 100)}% of the area's pixels had a colour on this scale.` :
          `Map area ${pct(l.area)}; legend ${pct(l.legend)}, read ${l.reverse ? "high → low" : "low → high"} as ${l.low} to ${l.high} ${l.units}${l.log ? " on a logarithmic scale" : ""}.${l.auto ? " Legend found automatically, then checked by the user." : ""} ${Math.round(l.matched * 100)}% of the area's pixels matched a legend colour.`,
      })),
    };
  }

  function publish() {
    if (sn.layers.length) STUDIO.addSource(song());
    else STUDIO.removeSource("snapshot");
    renderList();
  }

  /* ---------- UI ---------- */
  const boxInputs = (pre, title) => `
    <fieldset class="snap-boxset" id="${pre}-set"><legend>${title}</legend>
      <label class="ctl">Left % <input type="number" id="${pre}-x" min="0" max="100" step="0.5"></label>
      <label class="ctl">Top % <input type="number" id="${pre}-y" min="0" max="100" step="0.5"></label>
      <label class="ctl">Width % <input type="number" id="${pre}-w" min="0.5" max="100" step="0.5"></label>
      <label class="ctl">Height % <input type="number" id="${pre}-h" min="0.5" max="100" step="0.5"></label>
    </fieldset>`;

  function build() {
    const box = $("#snap-box");
    box.innerHTML = `
      <legend>Make music from your pictures (optional)</legend>
      <p class="hint">Upload 1 to ${MAX_PICS} pictures, for example NASA Earth Information Center snapshots that have a colour legend. Each picture becomes one instrument. Pictures stay on your device.</p>
      <label class="ctl" for="snap-file">Add a picture</label>
      <input type="file" id="snap-file" accept="image/png,image/jpeg,image/webp,image/gif">
      <div id="snap-edit" hidden>
        <p class="hint" id="snap-help">① Choose the <b>map area</b> you want to hear (start: the whole picture). ② If the picture has a colour legend, choose <b>② Legend</b> and drag over its coloured part (not "no data" squares or arrows); the pink box appears only once you mark it. You can also type the boxes below (in % of the picture).</p>
        <fieldset class="snap-boxset snap-scale" id="snap-scale-set"><legend>How should the colours be read?</legend>
          ${Object.entries(SCALES).map(([k, v]) => `<label class="ctl"><input type="radio" name="snap-scale" value="${k}"${k === "legend" ? " checked" : ""}> ${v.label}</label>`).join("")}
          <label class="ctl">What do the colours show? <input type="text" id="snap-what" maxlength="30" placeholder="e.g. rain, fire, heat"></label>
        </fieldset>
        <div class="studio-row snap-auto"><button type="button" class="ghost" id="snap-find" aria-describedby="snap-find-hint">🔎 Find legend automatically</button>
          <small class="muted" id="snap-find-hint">Looks for a colour bar and reads its numbers, in your browser (downloads a 7 MB text reader the first time; your picture is not uploaded). Check the result before adding.</small></div>
        <div class="toggle snap-mode" role="radiogroup" aria-label="What you draw on the picture">
          <label class="seg small"><input type="radio" name="snap-mode" value="area" checked> ① Map area</label>
          <label class="seg small legend-only"><input type="radio" name="snap-mode" value="legend"> ② Legend</label>
          <button type="button" class="ghost" id="snap-whole">Use whole picture as area</button>
        </div>
        <div class="snap-canvas-wrap"><canvas id="snap-canvas" role="img" aria-describedby="snap-help"></canvas></div>
        <div class="snap-grid">
          ${boxInputs("snap-a", "① Map area (cyan)")}
          ${boxInputs("snap", "② Colour legend (pink)")}
          <label class="ctl legend-only">Legend low value <input type="number" id="snap-low" value="0" step="any"></label>
          <label class="ctl legend-only">Legend high value <input type="number" id="snap-high" value="100" step="any"></label>
          <label class="ctl legend-only">Units <input type="text" id="snap-units" placeholder="e.g. °C, ppm, mm"></label>
          <label class="ctl">Layer name <input type="text" id="snap-name" maxlength="40"></label>
        </div>
        <label class="ctl legend-only"><input type="checkbox" id="snap-rev"> The legend's high end is on the left (or top)</label>
        <label class="ctl legend-only"><input type="checkbox" id="snap-log"> Logarithmic legend (numbers grow by the same factor, e.g. 0.001, 0.01, 0.1, 1)</label>
        <div class="studio-row"><button type="button" class="ghost" id="snap-add">Add as layer</button><button type="button" class="ghost" id="snap-cancel">Cancel</button></div>
      </div>
      <ul id="snap-list" class="snap-list"></ul>
      <p id="snap-status" class="muted"></p>`;
    $("#snap-file").addEventListener("change", onFile);
    ["x", "y", "w", "h"].forEach(k => {
      $(`#snap-a-${k}`).addEventListener("input", e => { sn.area[k] = +e.target.value || 0; draw(); });
      $(`#snap-${k}`).addEventListener("input", e => { sn.legend[k] = +e.target.value || 0; sn.legendSet = true; draw(); });
    });
    document.querySelectorAll('input[name="snap-mode"]').forEach(r => r.addEventListener("change", () => {
      sn.mode = r.value; draw();
      live(r.value === "area" ? "Dragging on the picture now sets the map area." : "Dragging on the picture now sets the colour legend.");
    }));
    document.querySelectorAll('input[name="snap-scale"]').forEach(r => r.addEventListener("change", () => {
      setScale(r.value);
      live(r.value === "legend" ? "Mark the colour legend in step ②." : `${SCALES[r.value].label}. No legend box is used; levels are relative.`);
    }));
    $("#snap-whole").addEventListener("click", () => { sn.area = Object.assign({}, WHOLE); fillInputs(); draw(); live("Map area: the whole picture."); });
    $("#snap-add").addEventListener("click", saveLayer);
    $("#snap-find").addEventListener("click", autoFind);
    $("#snap-cancel").addEventListener("click", () => { const was = sn.editing; closeEditor(); status(was >= 0 ? "No changes saved." : "Picture discarded."); $("#snap-file").focus(); });
    $("#snap-list").addEventListener("click", e => {
      const b = e.target.closest("button[data-i]"); if (!b) return;
      const i = +b.dataset.i, l = sn.layers[i]; if (!l) return;
      if (b.dataset.act === "edit") return editLayer(i);
      if (sn.editing === i) closeEditor();
      sn.layers.splice(i, 1); URL.revokeObjectURL(l.src); publish();
      status(`Removed ${l.name}. ${sn.layers.length} of ${MAX_PICS} pictures.`);
      $("#snap-file").focus();
    });
    pointer();
    renderList();
  }

  const status = msg => { $("#snap-status").textContent = msg; live(msg); };
  const fillInputs = () => ["x", "y", "w", "h"].forEach(k => { $(`#snap-a-${k}`).value = sn.area[k]; $(`#snap-${k}`).value = sn.legendSet ? sn.legend[k] : ""; });

  function openEditor(img, src, file) {
    sn.img = img; sn.src = src; sn.file = file;
    $("#snap-edit").hidden = false;
    $("#snap-add").textContent = sn.editing >= 0 ? "Save changes" : "Add as layer";
    fillInputs(); draw();
  }

  function onFile(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    e.target.value = "";
    if (sn.layers.length >= MAX_PICS) { status(`You already have ${MAX_PICS} pictures. Remove one first.`); return; }
    if (!/^image\//.test(f.type)) { status("That file is not a picture. Use PNG or JPG."); return; }
    closeEditor();
    const src = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      sn.editing = -1; sn.area = Object.assign({}, WHOLE); sn.legend = { x: 0, y: 0, w: 0, h: 0 }; sn.legendSet = false;
      $("#snap-name").value = `Picture ${sn.layers.length + 1}`; $("#snap-what").value = ""; $("#snap-log").checked = false; sn.auto = false;
      openEditor(img, src, clean(f.name, 60));
      setMode("area"); setScale("legend");
      status(`Loaded ${sn.file}. First choose how its colours should be read: with its colour legend, or without one (or press "Find legend automatically"). Then drag over the map area you want to hear.`);
      $("#snap-a-x").focus();
    };
    img.onerror = () => { URL.revokeObjectURL(src); status("This picture could not be opened. Try a PNG or JPG."); };
    img.src = src;
  }

  /** Reopen a saved picture with its boxes and values, without uploading it again. */
  function editLayer(i) {
    const l = sn.layers[i];
    closeEditor();
    const img = new Image();
    img.onload = () => {
      sn.editing = i; sn.area = Object.assign({}, l.area); sn.legend = Object.assign({}, l.legend); sn.legendSet = (l.scale || "legend") === "legend";
      $("#snap-low").value = l.low; $("#snap-high").value = l.high; $("#snap-units").value = l.units;
      $("#snap-name").value = l.name; $("#snap-rev").checked = l.reverse; $("#snap-what").value = l.what || ""; $("#snap-log").checked = !!l.log; sn.auto = !!l.auto;
      openEditor(img, l.src, l.file);
      setMode("area"); setScale(l.scale || "legend");
      status(`Editing ${l.name}. Change the map area, legend or values, then press Save changes.`);
      $("#snap-a-x").focus();
    };
    img.src = l.src;
  }

  /** Legend vs no-legend: hide the legend box and its fields when the picture has no legend. */
  function setScale(k) {
    sn.scale = k;
    document.querySelectorAll('input[name="snap-scale"]').forEach(r => { r.checked = r.value === k; });
    const noLegend = k !== "legend";
    document.querySelectorAll("#snap-edit .legend-only, #snap-set").forEach(el => { el.hidden = noLegend; });
    if (noLegend && sn.mode === "legend") setMode("area"); else draw();
  }

  function setMode(m) { sn.mode = m; document.querySelectorAll('input[name="snap-mode"]').forEach(r => { r.checked = r.value === m; }); draw(); }

  function draw() {
    const c = $("#snap-canvas"); if (!sn.img) return;
    const scale = Math.min(1, MAX_W / sn.img.naturalWidth);
    c.width = Math.round(sn.img.naturalWidth * scale); c.height = Math.round(sn.img.naturalHeight * scale);
    const g = c.getContext("2d"), W = c.width, H = c.height, a = sn.area, L = sn.legend;
    g.drawImage(sn.img, 0, 0, W, H);
    // dim everything outside the map area
    g.fillStyle = "rgba(0,0,0,.55)";
    g.beginPath(); g.rect(0, 0, W, H); g.rect(a.x / 100 * W, a.y / 100 * H, a.w / 100 * W, a.h / 100 * H); g.fill("evenodd");
    g.lineWidth = sn.mode === "area" ? 4 : 2; g.strokeStyle = "#4FC3F7"; g.setLineDash([]);
    g.strokeRect(a.x / 100 * W, a.y / 100 * H, a.w / 100 * W, a.h / 100 * H);
    if (sn.scale === "legend" && sn.legendSet) {
      g.lineWidth = sn.mode === "legend" ? 4 : 2; g.strokeStyle = "#FF5EA8"; g.setLineDash([8, 5]);
      g.strokeRect(L.x / 100 * W, L.y / 100 * H, L.w / 100 * W, L.h / 100 * H);
    }
    c.setAttribute("aria-label", `Your picture ${sn.file}. Map area: ${pct(a)}.${sn.scale !== "legend" ? " No legend box." : sn.legendSet ? ` Legend box: ${pct(L)}.` : " No legend marked yet."}`);
  }

  function pointer() {
    const c = $("#snap-canvas"); let start = null;
    const pos = e => { const r = c.getBoundingClientRect(); return { x: Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)), y: Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100)) }; };
    c.addEventListener("pointerdown", e => { start = pos(e); c.setPointerCapture(e.pointerId); });
    c.addEventListener("pointermove", e => {
      if (!start) return; const p = pos(e), r1 = v => Math.round(v * 2) / 2;
      const b = { x: r1(Math.min(start.x, p.x)), y: r1(Math.min(start.y, p.y)), w: Math.max(0.5, r1(Math.abs(p.x - start.x))), h: Math.max(0.5, r1(Math.abs(p.y - start.y))) };
      if (sn.mode === "area" || sn.scale !== "legend") sn.area = b; else { sn.legend = b; sn.legendSet = true; }
      fillInputs(); draw();
    });
    c.addEventListener("pointerup", () => { start = null; });
  }

  const outside = b => b.w <= 0 || b.h <= 0 || b.x < 0 || b.y < 0 || b.x + b.w > 100.5 || b.y + b.h > 100.5;

  function saveLayer() {
    if (!sn.img) return;
    const scale = sn.scale, noLegend = scale !== "legend";
    const low = noLegend ? 0 : parseFloat($("#snap-low").value), high = noLegend ? 100 : parseFloat($("#snap-high").value);
    if (!isFinite(low) || !isFinite(high) || low === high) { status("Type the legend's low and high values (they must be different numbers)."); $("#snap-low").focus(); return; }
    const area = Object.assign({}, sn.area), legend = Object.assign({}, sn.legend);
    if (outside(area) || area.w < 3 || area.h < 3) { status("The map area is outside the picture or too small. Check its Left, Top, Width and Height."); $("#snap-a-x").focus(); return; }
    if (!noLegend && !sn.legendSet) { status('This picture is set to "has a colour legend", but no legend is marked yet. Choose ② Legend and drag over the colour bar, or pick a "No legend" option if the picture has none.'); const r = document.querySelector('input[name="snap-mode"][value="legend"]'); if (r) r.focus(); return; }
    if (!noLegend && outside(legend)) { status("The legend box is outside the picture. Check its Left, Top, Width and Height."); $("#snap-x").focus(); return; }
    const reverse = $("#snap-rev").checked, log = !noLegend && $("#snap-log").checked;
    if (log && (low <= 0 || high <= 0)) { status("A logarithmic legend needs low and high values above 0. Check the values, or untick Logarithmic legend."); $("#snap-low").focus(); return; }
    const { values, matched, flat, picture } = decode(sn.img, area, legend, reverse, low, high, scale, log);
    const n = values.filter(v => v !== null).length;
    if (flat) { status("The legend box does not look like a colour bar: its colour hardly changes. Switch to ② Legend and move the box onto the legend's colours."); $("#snap-x").focus(); return; }
    if (n < 2 || matched < 0.005) { status(noLegend ? `Only ${Math.round(matched * 100)}% of the map area has colours on this scale, too little to make music. Try another "How should the colours be read?" option, or a bigger map area.` : `Only ${Math.round(matched * 100)}% of the map area matches the legend colours, too little to make music. Check that the legend box covers only the colour bar, and that the map area shows the map.`); $("#snap-x").focus(); return; }
    const name = clean($("#snap-name").value.trim() || `Picture ${sn.layers.length + 1}`, 40);
    const what = clean($("#snap-what").value.trim(), 30);
    const units = noLegend ? `relative ${what ? what + " " : ""}level (0–100)` : clean($("#snap-units").value.trim(), 50);
    const layer = { name, units, low, high, reverse, log, auto: !noLegend && !!sn.auto, area, legend, values, matched, picture, file: sn.file, src: sn.src, scale, what };
    const edited = sn.editing >= 0;
    if (edited) sn.layers[sn.editing] = layer; else sn.layers.push(layer);
    sn.src = null; // now owned by the layer
    closeEditor();
    publish();
    const vs = values.filter(v => v !== null);
    status(`${edited ? "Saved changes to" : "Added"} ${name}: ${n} of ${SLICES} slices have data, from ${Math.min(...vs)} to ${Math.max(...vs)} ${units}. ${Math.round(matched * 100)}% of the map area ${noLegend ? "had colours on the scale" : "matched the legend"}. ${noteFor(layer)} ` +
      `"Your snapshots" is the chosen source in step 1: pick its layers below.${!edited && sn.layers.length < MAX_PICS ? " You can also add another picture." : ""}`);
    const first = document.querySelector('.studio-opt[data-key^="snapshot:"] input'); if (first) first.focus();
  }

  /** "Find legend automatically": propose legend box, map area and values; the user checks, then saves. */
  async function autoFind() {
    const L = window.EchoLegend, btn = $("#snap-find"), img = sn.img;
    if (!img || !L || btn.disabled) return;
    btn.disabled = true;
    try {
      const bar = L.findBar(img);
      if (!bar) { status('No colour legend found in this picture. If it has none, choose a "No legend" option under "How should the colours be read?". If it has one, mark it yourself with ② Legend.'); return; }
      sn.legend = Object.assign({}, bar.box); sn.legendSet = true; sn.auto = true;
      sn.area = L.guessArea(bar, img.naturalWidth / img.naturalHeight);
      setScale("legend"); fillInputs(); draw();
      status(`Found a ${bar.horizontal ? "horizontal" : "vertical"} colour bar (pink box, ${pct(sn.legend)}). Map area set to ${pct(sn.area)}. Now reading its numbers…`);
      let r;
      try { r = await L.readLabels(img, bar, m => { $("#snap-status").textContent = m; }); }
      catch (e) { if (sn.img === img) status("Found the colour bar, but the text reader could not load, so please type the low and high values and units yourself."); return; }
      if (sn.img !== img) return; // the user closed or changed the picture meanwhile
      $("#snap-low").value = r.low === null ? "" : r.low; $("#snap-high").value = r.high === null ? "" : r.high;
      $("#snap-rev").checked = r.reverse; $("#snap-log").checked = r.log;
      $("#snap-units").value = r.units ? r.units.slice(0, 50) : "";
      if (r.what && !$("#snap-what").value) $("#snap-what").value = r.what.toLowerCase().slice(0, 30);
      const parts = [`Found a ${bar.horizontal ? "horizontal" : "vertical"} colour bar.`];
      if (r.low !== null) parts.push(`Read it as ${r.low} to ${r.high}, ${r.log ? "logarithmic" : "linear"}${r.reverse ? ", high end first" : ""} (numbers seen: ${r.labels.join(", ")}). ${r.sure === "yes" ? "These numbers look consistent" : "I read only two numbers, so please check them"}.`);
      else parts.push(`${r.note} I left Legend low and high empty: please type them.`);
      parts.push(r.units ? `Units: ${r.units}.` : r.unclear.includes("units") ? "There is a units line, but I could not read it clearly: please type the units." : "No units found: please type them.");
      if (r.what) parts.push(`Title: ${r.what}.`);
      parts.push(`Map area: ${pct(sn.area)}. Check everything, then press ${sn.editing >= 0 ? "Save changes" : "Add as layer"}.`);
      status(parts.join(" "));
      $(r.low === null ? "#snap-low" : "#snap-add").focus();
    } finally { btn.disabled = false; }
  }

  function closeEditor() {
    $("#snap-edit").hidden = true;
    // a new upload that was not saved gives its memory back; a saved picture keeps its own copy
    if (sn.src && sn.editing < 0) URL.revokeObjectURL(sn.src);
    sn.img = null; sn.src = null; sn.editing = -1;
  }

  function renderList() {
    $("#snap-list").innerHTML = sn.layers.map((l, i) => `<li><span>🖼️ <b>${esc(l.name)}</b> <small class="muted">${esc(noteFor(l))}</small><small class="muted">${esc(l.file)} · ${l.scale === "legend" ? `${l.low} to ${l.high} ${esc(l.units)}${l.log ? " (log)" : ""}` : "no legend, relative levels"} · ${Math.round(l.matched * 100)}% matched${l.area.w < 100 || l.area.h < 100 ? " · part of the picture" : ""}</small></span>
      <span class="my-actions"><button type="button" class="ghost" data-act="edit" data-i="${i}" aria-label="Edit ${esc(l.name)}">Edit</button>
      <button type="button" class="ghost" data-act="remove" data-i="${i}" aria-label="Remove ${esc(l.name)}">Remove</button></span></li>`).join("");
    $("#snap-file").disabled = sn.layers.length >= MAX_PICS;
  }

  build();
  window.EchoSnapshot = { decode, state: sn };
})();
