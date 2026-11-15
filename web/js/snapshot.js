/* EchoSphere snapshot → music (tasks 2.24, 2.25): the user uploads 1–4 pictures (e.g. NASA EIC snapshots).
   For each picture they mark ① the map area to listen to and ② the colour legend, and type the legend's
   low/high values. Every pixel inside the area is matched to the nearest legend colour, and the area is read
   west → east in 32 slices (one note per slice). Each picture becomes one layer of a "Your snapshots" source.
   Saved pictures can be edited (area, legend, values) without uploading them again.
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
  const sn = { img: null, src: null, file: "", editing: -1, mode: "area",
               area: Object.assign({}, WHOLE), legend: { x: 10, y: 88, w: 80, h: 6 }, layers: [] };

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
  function decode(img, area, legend, reverse, low, high) {
    const px = pixels(img), pal = palette(px, legend, reverse);
    // a colour bar changes colour along its length and holds many different colours;
    // a box on plain background or on text does not
    const spread = Math.max(...pal.map(p => Math.hypot(p[0] - pal[0][0], p[1] - pal[0][1], p[2] - pal[0][2])));
    const distinct = new Set(pal.map(p => p.map(c => Math.round(c / 24)).join(","))).size;
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
      let best = Infinity, bi = 0;
      for (let i = 0; i < PALETTE; i++) {
        const p = pal[i], dr = px.d[o] - p[0], dg = px.d[o + 1] - p[1], db = px.d[o + 2] - p[2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < best) { best = dist; bi = i; }
      }
      if (best <= MATCH) { sum[s] += bi / (PALETTE - 1); cnt[s]++; }
    }
    const values = [];
    for (let s = 0; s < SLICES; s++) values.push(cnt[s] >= 5 ? +(low + (sum[s] / cnt[s]) * (high - low)).toPrecision(4) : null); // sparse maps (e.g. fires) are fine
    const matched = cnt.reduce((a, b) => a + b, 0) / Math.max(1, seen.reduce((a, b) => a + b, 0));
    // the player shows only the map area
    const crop = document.createElement("canvas");
    crop.width = aw; crop.height = Math.max(1, ay1 - ay0);
    crop.getContext("2d").drawImage(px.canvas, ax0, ay0, crop.width, crop.height, 0, 0, crop.width, crop.height);
    return { values, matched, picture: { url: crop.toDataURL("image/jpeg", 0.9), aspect: crop.width / crop.height } };
  }

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
        "Values assume the legend is linear between the low and high values you typed. Logarithmic legends, compressed screenshots and map projections make values less exact.",
        "Your pictures never leave your device, so snapshot songs cannot be shared as a link. Use Save as WAV to keep the music.",
      ],
      layers: sn.layers.map((l, i) => ({
        id: `snap${i + 1}`, name: l.name, icon: "🖼️", color: COLORS[i], units: l.units || "legend units",
        values: l.values, legendStep: Math.abs(l.high - l.low) / 20, register: REGISTERS[i], pan: PANS[i],
        defaults: DEFAULTS[i], sourceKind: "upload", picture: l.picture,
        describe: `Decoded from your picture "${l.file}". Higher notes mean higher values on its legend (${l.low} to ${l.high} ${l.units}).`,
        source: { name: `Your picture: ${l.file}`, url: "#" },
        method: `Map area ${pct(l.area)}; legend ${pct(l.legend)}, read ${l.reverse ? "high → low" : "low → high"} as ${l.low} to ${l.high} ${l.units}. ${Math.round(l.matched * 100)}% of the area's pixels matched a legend colour.`,
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
        <p class="hint" id="snap-help">① Choose the <b>map area</b> you want to hear (start: the whole picture). ② Mark the <b>colour legend</b>: cover only its coloured part, not "no data" squares or arrows. Drag on the picture, or type the boxes below (in % of the picture).</p>
        <div class="toggle snap-mode" role="radiogroup" aria-label="What you draw on the picture">
          <label class="seg small"><input type="radio" name="snap-mode" value="area" checked> ① Map area</label>
          <label class="seg small"><input type="radio" name="snap-mode" value="legend"> ② Legend</label>
          <button type="button" class="ghost" id="snap-whole">Use whole picture as area</button>
        </div>
        <div class="snap-canvas-wrap"><canvas id="snap-canvas" role="img" aria-describedby="snap-help"></canvas></div>
        <div class="snap-grid">
          ${boxInputs("snap-a", "① Map area (cyan)")}
          ${boxInputs("snap", "② Colour legend (pink)")}
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
    ["x", "y", "w", "h"].forEach(k => {
      $(`#snap-a-${k}`).addEventListener("input", e => { sn.area[k] = +e.target.value || 0; draw(); });
      $(`#snap-${k}`).addEventListener("input", e => { sn.legend[k] = +e.target.value || 0; draw(); });
    });
    document.querySelectorAll('input[name="snap-mode"]').forEach(r => r.addEventListener("change", () => {
      sn.mode = r.value; draw();
      live(r.value === "area" ? "Dragging on the picture now sets the map area." : "Dragging on the picture now sets the colour legend.");
    }));
    $("#snap-whole").addEventListener("click", () => { sn.area = Object.assign({}, WHOLE); fillInputs(); draw(); live("Map area: the whole picture."); });
    $("#snap-add").addEventListener("click", saveLayer);
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
  const fillInputs = () => ["x", "y", "w", "h"].forEach(k => { $(`#snap-a-${k}`).value = sn.area[k]; $(`#snap-${k}`).value = sn.legend[k]; });

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
      sn.editing = -1; sn.area = Object.assign({}, WHOLE);
      $("#snap-name").value = `Picture ${sn.layers.length + 1}`;
      openEditor(img, src, clean(f.name, 60));
      setMode("area");
      status(`Loaded ${sn.file}. ① Drag over the area you want to hear, or keep the whole picture. ② Then switch to Legend and mark the colour bar, and type its low and high values.`);
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
      sn.editing = i; sn.area = Object.assign({}, l.area); sn.legend = Object.assign({}, l.legend);
      $("#snap-low").value = l.low; $("#snap-high").value = l.high; $("#snap-units").value = l.units;
      $("#snap-name").value = l.name; $("#snap-rev").checked = l.reverse;
      openEditor(img, l.src, l.file);
      setMode("area");
      status(`Editing ${l.name}. Change the map area, legend or values, then press Save changes.`);
      $("#snap-a-x").focus();
    };
    img.src = l.src;
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
    g.lineWidth = sn.mode === "legend" ? 4 : 2; g.strokeStyle = "#FF5EA8"; g.setLineDash([8, 5]);
    g.strokeRect(L.x / 100 * W, L.y / 100 * H, L.w / 100 * W, L.h / 100 * H);
    c.setAttribute("aria-label", `Your picture ${sn.file}. Map area: ${pct(a)}. Legend box: ${pct(L)}.`);
  }

  function pointer() {
    const c = $("#snap-canvas"); let start = null;
    const pos = e => { const r = c.getBoundingClientRect(); return { x: Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)), y: Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100)) }; };
    c.addEventListener("pointerdown", e => { start = pos(e); c.setPointerCapture(e.pointerId); });
    c.addEventListener("pointermove", e => {
      if (!start) return; const p = pos(e), r1 = v => Math.round(v * 2) / 2;
      const b = { x: r1(Math.min(start.x, p.x)), y: r1(Math.min(start.y, p.y)), w: Math.max(0.5, r1(Math.abs(p.x - start.x))), h: Math.max(0.5, r1(Math.abs(p.y - start.y))) };
      if (sn.mode === "area") sn.area = b; else sn.legend = b;
      fillInputs(); draw();
    });
    c.addEventListener("pointerup", () => { start = null; });
  }

  const outside = b => b.w <= 0 || b.h <= 0 || b.x < 0 || b.y < 0 || b.x + b.w > 100.5 || b.y + b.h > 100.5;

  function saveLayer() {
    if (!sn.img) return;
    const low = parseFloat($("#snap-low").value), high = parseFloat($("#snap-high").value);
    if (!isFinite(low) || !isFinite(high) || low === high) { status("Type the legend's low and high values (they must be different numbers)."); $("#snap-low").focus(); return; }
    const area = Object.assign({}, sn.area), legend = Object.assign({}, sn.legend);
    if (outside(area) || area.w < 3 || area.h < 3) { status("The map area is outside the picture or too small. Check its Left, Top, Width and Height."); $("#snap-a-x").focus(); return; }
    if (outside(legend)) { status("The legend box is outside the picture. Check its Left, Top, Width and Height."); $("#snap-x").focus(); return; }
    const reverse = $("#snap-rev").checked;
    const { values, matched, flat, picture } = decode(sn.img, area, legend, reverse, low, high);
    const n = values.filter(v => v !== null).length;
    if (flat) { status("The legend box does not look like a colour bar: its colour hardly changes. Switch to ② Legend and move the box onto the legend's colours."); $("#snap-x").focus(); return; }
    if (n < 2 || matched < 0.005) { status(`Only ${Math.round(matched * 100)}% of the map area matches the legend colours, too little to make music. Check that the legend box covers only the colour bar, and that the map area shows the map.`); $("#snap-x").focus(); return; }
    const name = clean($("#snap-name").value.trim() || `Picture ${sn.layers.length + 1}`, 40);
    const units = clean($("#snap-units").value.trim(), 20);
    const layer = { name, units, low, high, reverse, area, legend, values, matched, picture, file: sn.file, src: sn.src };
    const edited = sn.editing >= 0;
    if (edited) sn.layers[sn.editing] = layer; else sn.layers.push(layer);
    sn.src = null; // now owned by the layer
    closeEditor();
    publish();
    const vs = values.filter(v => v !== null);
    status(`${edited ? "Saved changes to" : "Added"} ${name}: ${n} of ${SLICES} slices have data, from ${Math.min(...vs)} to ${Math.max(...vs)} ${units}. ${Math.round(matched * 100)}% of the map area matched the legend. ` +
      `"Your snapshots" is the chosen source in step 1: pick its layers below.${!edited && sn.layers.length < MAX_PICS ? " You can also add another picture." : ""}`);
    const first = document.querySelector('.studio-opt[data-key^="snapshot:"] input'); if (first) first.focus();
  }

  function closeEditor() {
    $("#snap-edit").hidden = true;
    // a new upload that was not saved gives its memory back; a saved picture keeps its own copy
    if (sn.src && sn.editing < 0) URL.revokeObjectURL(sn.src);
    sn.img = null; sn.src = null; sn.editing = -1;
  }

  function renderList() {
    $("#snap-list").innerHTML = sn.layers.map((l, i) => `<li><span>🖼️ <b>${esc(l.name)}</b> <small class="muted">${esc(l.file)} · ${l.low} to ${l.high} ${esc(l.units)} · ${Math.round(l.matched * 100)}% matched${l.area.w < 100 || l.area.h < 100 ? " · part of the picture" : ""}</small></span>
      <span class="my-actions"><button type="button" class="ghost" data-act="edit" data-i="${i}" aria-label="Edit ${esc(l.name)}">Edit</button>
      <button type="button" class="ghost" data-act="remove" data-i="${i}" aria-label="Remove ${esc(l.name)}">Remove</button></span></li>`).join("");
    $("#snap-file").disabled = sn.layers.length >= MAX_PICS;
  }

  build();
  window.EchoSnapshot = { decode, state: sn };
})();
