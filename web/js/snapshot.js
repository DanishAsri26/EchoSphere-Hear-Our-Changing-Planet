/* EchoSphere snapshot → music (task 2.24): the user uploads 1–4 pictures (e.g. NASA EIC snapshots).
   For each picture they mark the colour legend and type its low/high values; every map pixel is matched
   to the nearest legend colour, and the map is read west → east in 32 slices (one note per slice).
   Each picture becomes one layer of a "Your snapshots" source in the Studio.
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
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const sn = { img: null, file: "", canvas: null, box: { x: 10, y: 88, w: 80, h: 6 }, layers: [] };

  /* ---------- decoding ---------- */
  function pixels() {
    const c = document.createElement("canvas");
    const scale = Math.min(1, MAX_W / sn.img.naturalWidth);
    c.width = Math.round(sn.img.naturalWidth * scale); c.height = Math.round(sn.img.naturalHeight * scale);
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(sn.img, 0, 0, c.width, c.height);
    return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data };
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

  /** Values per slice (west → east): mean legend value of matching pixels, null if almost none match. */
  function decode(box, reverse, low, high) {
    const px = pixels(), pal = palette(px, box, reverse);
    // a colour bar changes colour along its length; a box on plain background does not
    const spread = Math.max(...pal.map(p => Math.hypot(p[0] - pal[0][0], p[1] - pal[0][1], p[2] - pal[0][2])));
    // ...and holds many different colours (text on a plain strip has only two or three)
    const distinct = new Set(pal.map(p => p.map(c => Math.round(c / 24)).join(","))).size;
    if (spread < 60 || distinct < 8) return { values: Array(SLICES).fill(null), matched: 0, pal, flat: true };
    const bx0 = box.x / 100 * px.w, bx1 = (box.x + box.w) / 100 * px.w, by0 = box.y / 100 * px.h, by1 = (box.y + box.h) / 100 * px.h;
    const sum = new Float64Array(SLICES), cnt = new Uint32Array(SLICES), seen = new Uint32Array(SLICES);
    for (let y = 0; y < px.h; y += 2) for (let x = 0; x < px.w; x += 2) {
      if (x >= bx0 && x <= bx1 && y >= by0 && y <= by1) continue; // skip the legend itself
      const o = (y * px.w + x) * 4, s = Math.min(SLICES - 1, Math.floor(x / px.w * SLICES));
      seen[s]++;
      if (px.d[o + 3] < 128) continue;
      let best = Infinity, bi = 0;
      for (let i = 0; i < PALETTE; i++) {
        const p = pal[i], dr = px.d[o] - p[0], dg = px.d[o + 1] - p[1], db = px.d[o + 2] - p[2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < best) { best = dist; bi = i; }
      }
      if (best <= MATCH) { sum[s] += bi / (PALETTE - 1); cnt[s]++; }
    }
    const values = [], shares = [];
    for (let s = 0; s < SLICES; s++) {
      shares.push(seen[s] ? cnt[s] / seen[s] : 0);
      values.push(cnt[s] >= 5 ? +(low + (sum[s] / cnt[s]) * (high - low)).toPrecision(4) : null); // sparse maps (e.g. fires) are fine
    }
    const matched = cnt.reduce((a, b) => a + b, 0) / Math.max(1, seen.reduce((a, b) => a + b, 0));
    return { values, matched, pal };
  }

  /* ---------- song ---------- */
  function song() {
    const steps = Array.from({ length: SLICES }, (_, i) => `Slice ${i + 1} of ${SLICES}${i === 0 ? " (west)" : i === SLICES - 1 ? " (east)" : ""}`);
    return {
      id: "snapshot", snapshot: true, studio: true,
      title: "Your snapshots", studioTitle: "Your snapshot song",
      subtitle: "Pictures you uploaded, turned into music",
      place: sn.layers.map(l => l.file).join(", "),
      period: `${SLICES} slices, west → east`,
      cover: "", stepUnit: "slice", steps, captions: {},
      intro: "This song was decoded in your browser from pictures you uploaded, using the colour legends you marked.",
      limits: [
        "EchoSphere cannot check where an uploaded picture comes from. Use NASA visualizations (for example EIC snapshots) for real data.",
        "Each picture is read west → east in 32 slices; a note is the average legend value of the pixels in that slice. Pixels that match no legend colour (text, borders, background) are ignored, and a slice with almost no matches is silent.",
        "Values assume the legend is linear between the low and high values you typed. Logarithmic legends, compressed screenshots and map projections make values less exact.",
        "Your pictures never leave your device, so snapshot songs cannot be shared as a link. Use Save as WAV to keep the music.",
      ],
      layers: sn.layers.map((l, i) => ({
        id: `snap${i + 1}`, name: l.name, icon: "🖼️", color: COLORS[i], units: l.units || "legend units",
        values: l.values, legendStep: Math.abs(l.high - l.low) / 20, register: REGISTERS[i], pan: PANS[i],
        defaults: DEFAULTS[i], sourceKind: "upload",
        describe: `Decoded from your picture "${l.file}". Higher notes mean higher values on its legend (${l.low} to ${l.high} ${l.units}).`,
        source: { name: `Your picture: ${l.file}`, url: "#" },
        method: `Legend marked at ${l.box.x}% / ${l.box.y}% (size ${l.box.w}% × ${l.box.h}%), read ${l.reverse ? "high → low" : "low → high"} as ${l.low} to ${l.high} ${l.units}. ${Math.round(l.matched * 100)}% of map pixels matched a legend colour.`,
      })),
    };
  }

  function publish() {
    if (sn.layers.length) STUDIO.addSource(song());
    else STUDIO.removeSource("snapshot");
    renderList();
  }

  /* ---------- UI ---------- */
  function build() {
    const box = $("#snap-box");
    box.innerHTML = `
      <legend>Make music from your pictures (optional)</legend>
      <p class="hint">Upload 1 to ${MAX_PICS} pictures, for example NASA Earth Information Center snapshots that have a colour legend. Each picture becomes one instrument. Pictures stay on your device.</p>
      <label class="ctl" for="snap-file">Add a picture</label>
      <input type="file" id="snap-file" accept="image/png,image/jpeg,image/webp,image/gif">
      <div id="snap-edit" hidden>
        <p class="hint" id="snap-help">Mark the colour legend: drag a box over the colour bar on the picture, or type its position below (in % of the picture). Cover only the coloured part, not "no data" squares or arrows.</p>
        <div class="snap-canvas-wrap"><canvas id="snap-canvas" role="img" aria-describedby="snap-help"></canvas></div>
        <div class="snap-grid">
          <label class="ctl">Left % <input type="number" id="snap-x" min="0" max="100" step="0.5"></label>
          <label class="ctl">Top % <input type="number" id="snap-y" min="0" max="100" step="0.5"></label>
          <label class="ctl">Width % <input type="number" id="snap-w" min="0.5" max="100" step="0.5"></label>
          <label class="ctl">Height % <input type="number" id="snap-h" min="0.5" max="100" step="0.5"></label>
          <label class="ctl">Legend low value <input type="number" id="snap-low" value="0" step="any"></label>
          <label class="ctl">Legend high value <input type="number" id="snap-high" value="100" step="any"></label>
          <label class="ctl">Units <input type="text" id="snap-units" placeholder="e.g. °C, ppm, mm"></label>
          <label class="ctl">Layer name <input type="text" id="snap-name" maxlength="40"></label>
        </div>
        <label class="ctl"><input type="checkbox" id="snap-rev"> The legend's high end is on the left (or top)</label>
        <div class="studio-row"><button type="button" class="ghost" id="snap-add">Add as layer</button><button type="button" class="ghost" id="snap-cancel">Cancel</button></div>
      </div>
      <ul id="snap-list" class="snap-list"></ul>
      <p id="snap-status" class="muted"></p>`;
    $("#snap-file").addEventListener("change", onFile);
    ["x", "y", "w", "h"].forEach(k => $(`#snap-${k}`).addEventListener("input", e => { sn.box[k] = +e.target.value || 0; draw(); }));
    $("#snap-add").addEventListener("click", addLayer);
    $("#snap-cancel").addEventListener("click", () => { closeEditor(); status("Picture discarded."); $("#snap-file").focus(); });
    $("#snap-list").addEventListener("click", e => {
      const b = e.target.closest("button[data-i]"); if (!b) return;
      const [gone] = sn.layers.splice(+b.dataset.i, 1); publish();
      status(`Removed ${gone.name}. ${sn.layers.length} of ${MAX_PICS} pictures.`);
      $("#snap-file").focus();
    });
    pointer();
    renderList();
  }

  const status = msg => { $("#snap-status").textContent = msg; live(msg); };

  function onFile(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    if (sn.layers.length >= MAX_PICS) { status(`You already have ${MAX_PICS} pictures. Remove one first.`); e.target.value = ""; return; }
    if (!/^image\//.test(f.type)) { status("That file is not a picture. Use PNG or JPG."); e.target.value = ""; return; }
    const img = new Image();
    img.onload = () => {
      sn.img = img; sn.file = f.name.replace(/[<>"&]/g, "").slice(0, 60);
      $("#snap-edit").hidden = false;
      $("#snap-name").value = `Picture ${sn.layers.length + 1}`;
      ["x", "y", "w", "h"].forEach(k => { $(`#snap-${k}`).value = sn.box[k]; });
      draw();
      status(`Loaded ${sn.file}. Now mark its colour legend and type the legend's low and high values.`);
      $("#snap-x").focus();
    };
    img.onerror = () => status("This picture could not be opened. Try a PNG or JPG.");
    img.src = URL.createObjectURL(f);
    e.target.value = "";
  }

  function draw() {
    const c = $("#snap-canvas"); if (!sn.img) return;
    const scale = Math.min(1, MAX_W / sn.img.naturalWidth);
    c.width = Math.round(sn.img.naturalWidth * scale); c.height = Math.round(sn.img.naturalHeight * scale);
    const g = c.getContext("2d");
    g.drawImage(sn.img, 0, 0, c.width, c.height);
    const b = sn.box;
    g.lineWidth = 3; g.strokeStyle = "#FF5EA8"; g.setLineDash([8, 5]);
    g.strokeRect(b.x / 100 * c.width, b.y / 100 * c.height, b.w / 100 * c.width, b.h / 100 * c.height);
    c.setAttribute("aria-label", `Your picture ${sn.file}. Legend box at ${b.x}% from the left, ${b.y}% from the top, ${b.w}% wide, ${b.h}% high.`);
  }

  function pointer() {
    const c = $("#snap-canvas"); let start = null;
    const pos = e => { const r = c.getBoundingClientRect(); return { x: Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)), y: Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100)) }; };
    c.addEventListener("pointerdown", e => { start = pos(e); c.setPointerCapture(e.pointerId); });
    c.addEventListener("pointermove", e => {
      if (!start) return; const p = pos(e), r1 = v => Math.round(v * 2) / 2;
      sn.box = { x: r1(Math.min(start.x, p.x)), y: r1(Math.min(start.y, p.y)), w: Math.max(0.5, r1(Math.abs(p.x - start.x))), h: Math.max(0.5, r1(Math.abs(p.y - start.y))) };
      ["x", "y", "w", "h"].forEach(k => { $(`#snap-${k}`).value = sn.box[k]; }); draw();
    });
    c.addEventListener("pointerup", () => { start = null; });
  }

  function addLayer() {
    if (!sn.img) return;
    const low = parseFloat($("#snap-low").value), high = parseFloat($("#snap-high").value);
    if (!isFinite(low) || !isFinite(high) || low === high) { status("Type the legend's low and high values (they must be different numbers)."); $("#snap-low").focus(); return; }
    const box = Object.assign({}, sn.box);
    if (box.w <= 0 || box.h <= 0 || box.x + box.w > 100.5 || box.y + box.h > 100.5) { status("The legend box is outside the picture. Check Left, Top, Width and Height."); $("#snap-x").focus(); return; }
    const reverse = $("#snap-rev").checked;
    const { values, matched, flat } = decode(box, reverse, low, high);
    const n = values.filter(v => v !== null).length;
    if (flat) { status("The legend box does not look like a colour bar: its colour hardly changes. Move the box onto the legend's colours."); $("#snap-x").focus(); return; }
    if (n < 2 || matched < 0.005) { status(`Only ${Math.round(matched * 100)}% of the picture matches the legend colours, too little to make music. Check that the box covers only the colour bar.`); $("#snap-x").focus(); return; }
    const name = ($("#snap-name").value.trim() || `Picture ${sn.layers.length + 1}`).replace(/[<>"&]/g, "").slice(0, 40);
    const units = $("#snap-units").value.trim().replace(/[<>"&]/g, "").slice(0, 20);
    sn.layers.push({ name, units, low, high, reverse, box, values, matched, file: sn.file });
    closeEditor();
    publish();
    const vs = values.filter(v => v !== null);
    status(`Added ${name}: ${n} of ${SLICES} slices have data, from ${Math.min(...vs)} to ${Math.max(...vs)} ${units}. ${Math.round(matched * 100)}% of the picture matched the legend. ` +
      `"Your snapshots" is now the chosen source in step 1. ${sn.layers.length < MAX_PICS ? "Add another picture or pick its layers below." : `That is the maximum of ${MAX_PICS} pictures.`}`);
    const first = document.querySelector('.studio-opt[data-key^="snapshot:"] input'); if (first) first.focus();
  }

  function closeEditor() { $("#snap-edit").hidden = true; sn.img = null; }

  function renderList() {
    $("#snap-list").innerHTML = sn.layers.map((l, i) => `<li><span>🖼️ <b>${esc(l.name)}</b> <small class="muted">${esc(l.file)} · ${l.low} to ${l.high} ${esc(l.units)} · ${Math.round(l.matched * 100)}% matched</small></span>
      <button type="button" class="ghost" data-i="${i}" aria-label="Remove ${esc(l.name)}">Remove</button></li>`).join("");
    $("#snap-file").disabled = sn.layers.length >= MAX_PICS;
  }

  build();
  window.EchoSnapshot = { decode, state: sn };
})();
