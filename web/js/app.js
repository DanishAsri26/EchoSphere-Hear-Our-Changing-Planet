/* EchoSphere app: views, controls, keyboard, screen-reader announcements.
   Code written with AI assistance (Claude, Anthropic). */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const DATA = window.ECHO_SONGS;
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Where a layer's numbers come from (layer.sourceKind, set by the pipeline). The challenge is about
  // sonifying NASA visualizations, so every album and layer says which kind it is.
  const KINDS = {
    visual:  { icon: "🎨", short: "decoded from a NASA visualization", badge: "Sonifies a NASA visualization",
               long: "Decoded from the colours of a NASA visualization (map or video) using its colour legend." },
    vizdata: { icon: "📄", short: "NASA values behind a visualization", badge: "From the data behind a NASA visualization",
               long: "NASA's own numbers, published together with the visualization (not read from its pixels)." },
    data:    { icon: "📈", short: "NASA data, no visualization", badge: "From NASA data, no visualization",
               long: "Taken directly from a NASA data service or file, not from a visualization." },
    upload:  { icon: "🖼️", short: "decoded from your picture", badge: "From your picture",
               long: "Decoded in your browser from the colours of a picture you uploaded, using the legend you marked. EchoSphere cannot check where the picture comes from." },
  };
  const kindOf = l => KINDS[l.sourceKind] || KINDS.data;
  const albumKind = s => ["visual", "vizdata", "data"].map(k => KINDS[k]).find(k => s.layers.some(l => kindOf(l) === k));
  const kindChip = l => `${l.icon} ${l.name} <span class="kind" title="${kindOf(l).long}" aria-hidden="true">${kindOf(l).icon}</span><span class="sr-only">, ${kindOf(l).short}</span>`;

  const engine = new EchoAudio.Engine();
  const chart = new EchoChart($("#chart"));
  const state = { song: null, genre: "orchestra", muted: new Set(), solo: null, idx: 0, ready: false, lastMonth: null };

  const live = msg => { const el = $("#live"); el.textContent = ""; setTimeout(() => { el.textContent = msg; }, 30); };

  function fmtDate(song, d) {
    if (song.stepUnit === "slice") return d; // snapshot songs: "Slice 3 of 32"
    if (song.stepUnit === "quarter") return `Q${Math.floor((parseInt(d.slice(5, 7), 10) - 1) / 3) + 1} ${d.slice(0, 4)} (approx.)`; // album 6
    const m = MONTHS[parseInt(d.slice(5, 7), 10) - 1], y = d.slice(0, 4);
    if (song.stepUnit === "week") return `${parseInt(d.slice(8, 10), 10)} ${m.slice(0, 3)} ${y}`;
    return `${m} ${y}`;
  }
  const fmtNum = (v, digits) => v === null || v === undefined ? "—" : digits ? v.toFixed(digits) : (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));

  /* ---------- Map view ---------- */
  const MAPS = Object.assign({}, window.ECHO_MAPS || {}, window.ECHO_EXTRA_MAPS || {}); // extra: e.g. album 6 frames
  const KUCHING = { lat: 1.55, lon: 110.35 };
  const map = { front: "a", cache: [] };
  /** Map frames for a song: NASA frames for the albums; the uploaded picture for a snapshot song. */
  function mapFor(song) {
    if (!song) return null;
    if (!song.snapshot) return MAPS[song.id];
    const pic = song.layers[0] && song.layers[0].picture;
    if (!pic) return null;
    return song._map || (song._map = { aspect: pic.aspect, snapshot: true, frames: [{ img: pic.url, hotspots: [] }] });
  }

  function fitMap() {
    const song = state.song, m = mapFor(song), box = $("#map");
    if (!m || $("#view-player").hidden) return;
    const col = $("#readout");
    if (window.innerWidth <= 1000) { box.style.width = "100%"; box.style.height = (col.clientWidth / m.aspect) + "px"; return; }
    const used = [...col.children].filter(c => c !== box).reduce((h, c) => h + c.offsetHeight, 0) + 30;
    const availH = Math.max(220, col.clientHeight - used);
    const w = Math.min(col.clientWidth, availH * m.aspect);
    box.style.width = w + "px"; box.style.height = (w / m.aspect) + "px";
  }
  window.addEventListener("resize", () => fitMap());

  function setupMap(song) {
    const m = mapFor(song), box = $("#map");
    box.hidden = !m;
    if (!m) return;
    requestAnimationFrame(fitMap);
    map.cache = m.frames.map(f => { const im = new Image(); im.src = f.img; return im; }); // preload
    $("#map-a").src = m.frames[0].img; $("#map-a").classList.add("show"); $("#map-b").classList.remove("show"); map.front = "a";
    // a map may bring its own legend (album 6); the global fire frames already show NASA's legend
    const legend = m.legend || (song.id === "kuching-2015" ? "assets/fire-legend.png" : null);
    $("#map-legend").hidden = !legend; if (legend) $("#map-legend").src = legend;
    $(".map-credit").textContent = m.snapshot ? `Your picture: ${song.layers[0].name}${song.layers[0].hint ? ` · ${song.layers[0].hint}` : ""} · pink band = slice being played` : (m.credit || "NASA SVS 5012 · fire carbon emissions");
    drawOverlay(song, 0, false);
  }

  function pinPos(m, p) {
    const [lat0, lat1, lon0, lon1] = m.extent;
    return { x: (p.lon - lon0) / (lon1 - lon0) * 100, y: (lat1 - p.lat) / (lat1 - lat0) * 100 };
  }

  function drawOverlay(song, i, pulse) {
    const m = mapFor(song); if (!m) return;
    if (m.snapshot) { // highlight the slice of the picture that is playing now
      const n = song.steps.length, name = song.layers[0].name;
      $("#map-overlay").innerHTML = `<span class="slice-band" style="left:${(i / n * 100).toFixed(3)}%;width:${(100 / n).toFixed(3)}%"></span>` +
        `<span class="map-badge">${fmtDate(song, song.steps[i])}</span>`;
      $("#map").setAttribute("aria-label", `Your picture ${name}, read from west to east. Now playing ${fmtDate(song, song.steps[i])}.`);
      return;
    }
    const f = m.frames[i] || m.frames[0];
    const fireOn = !effectiveMuted().has("fire");
    const k = m.noPin ? null : pinPos(m, KUCHING); // world-ocean maps have no Kuching pin
    const rings = fireOn ? f.hotspots.map(h => `<span class="ring${pulse && !reduceMotion ? " pulse" : ""}" style="left:${(h.x * 100).toFixed(2)}%;top:${(h.y * 100).toFixed(2)}%"></span>`).join("") : "";
    $("#map-overlay").innerHTML = rings + (k ? `<span class="pin" style="left:${k.x.toFixed(2)}%;top:${k.y.toFixed(2)}%"><b>Kuching</b><i></i></span>` : "") +
      `<span class="map-badge">${fmtDate(song, song.steps[i])}</span>`;
    $("#map").setAttribute("aria-label", m.label ? `${m.label}, ${fmtDate(song, song.steps[i])}.` : `NASA fire map, ${fmtDate(song, song.steps[i])}: ${f.hotspots.length} strong fire areas highlighted.`);
  }

  function showFrame(song, i, pulse) {
    const m = mapFor(song); if (!m) return;
    const fr = m.frames[i] || m.frames[0];
    const back = map.front === "a" ? "b" : "a";
    const imgBack = $("#map-" + back), imgFront = $("#map-" + map.front);
    if (imgFront.getAttribute("src") !== fr.img) {
      imgBack.src = fr.img;
      imgBack.classList.add("show"); imgFront.classList.remove("show"); map.front = back;
    }
    drawOverlay(song, i, pulse);
  }

  /* ---------- Home ---------- */
  function coverImg(song, cls) {
    return `<div class="disc ${cls || ""}"><img src="${song.cover}" alt="" onerror="this.remove()"><div class="disc-fallback"></div><span class="disc-hole"></span></div>`;
  }
  function renderHome() {
    $("#albums").innerHTML = DATA.songs.map((s, i) => `
      <article class="album" role="listitem">
        ${coverImg(s)}
        <div>
          <h2>${s.title}</h2>
          <p>${s.subtitle}</p>
          <p>${s.place} · ${s.period}</p>
          <p class="kind-badge kind-${s.layers.some(l => l.sourceKind === "visual") ? "visual" : "other"}"><span aria-hidden="true">${albumKind(s).icon}</span> ${albumKind(s).badge}</p>
          <div class="chips">${s.layers.map(l => `<span class="chip">${kindChip(l)}</span>`).join("")}</div>
          <div class="card-actions">
            <button type="button" class="play small" data-song="${i}" aria-label="Open ${s.title}"><span aria-hidden="true">▶</span> Listen</button>
            <button type="button" class="ghost" data-guide="${i}" aria-label="How to listen to ${s.title}">How to listen</button>
          </div>
        </div>
      </article>`).join("");
    // move the fallback behind the image (image loads on top when present)
    document.querySelectorAll(".album .disc").forEach(d => d.prepend(d.querySelector(".disc-fallback")));
    $("#albums").querySelectorAll("button[data-song]").forEach(b => b.addEventListener("click", () => openSong(+b.dataset.song)));
    $("#albums").querySelectorAll("button[data-guide]").forEach(b => b.addEventListener("click", () => openGuide(DATA.songs[+b.dataset.guide])));
  }

  /* ---------- Player ---------- */
  async function openSong(i) {
    const song = typeof i === "object" ? i : DATA.songs[i]; // a song object comes from the Studio
    $("#view-studio").hidden = true;
    $("#btn-share").hidden = !song.studio || !!song.snapshot; $("#save-status").textContent = "";
    $("#btn-back").textContent = song.studio ? "◂ Back to the Studio" : "◂ Back to the jukebox";
    state.song = song; state.idx = 0; state.muted.clear(); state.solo = null; state.lastMonth = null;
    $("#view-home").hidden = true; $("#view-player").hidden = false; document.body.classList.add("in-player");
    $("#song-title").textContent = song.title;
    $("#song-meta").textContent = `${song.place} · ${song.period}`;
    const img = $("#cover"); img.style.display = ""; img.src = song.cover; img.onerror = () => { img.style.display = "none"; };
    $("#date").textContent = fmtDate(song, song.steps[0]);
    $("#caption").textContent = "Press play to start.";
    setupMap(song);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    await loadGenre(state.genre);
    live(`${song.title}. ${song.layers.length} layers: ${song.layers.map(l => l.name).join(", ")}. Press space to play.`);
    $("#btn-play").focus();
  }

  async function loadGenre(genre) {
    const wasPlaying = engine.playing, at = engine.idx;
    if (wasPlaying) engine.pause();
    state.genre = genre; state.ready = false; setPlayUI();
    document.querySelectorAll(".genre .seg").forEach(b => b.setAttribute("aria-checked", b.dataset.genre === genre));
    if (state.song.studio && window.EchoStudio) EchoStudio.retune(state.song, genre); // instruments of this genre only
    await engine.prepare(state.song, genre);
    applyMix();
    renderStrips(); redrawChart(); renderDrawer();
    state.ready = true; setPlayUI(); fitMap();
    if (engine.fallbacks.length) live(`Note: ${engine.fallbacks.join(", ")} could not load, a synth plays instead.`);
    if (wasPlaying) { await engine.play(at); setPlayUI(); }
  }

  function setPlayUI() {
    const b = $("#btn-play");
    b.disabled = !state.ready;
    b.querySelector(".play-text").textContent = !state.ready ? "Tuning instruments…" : engine.playing ? "Pause" : "Play";
    b.querySelector(".play-icon").textContent = engine.playing ? "❚❚" : "▶";
    b.setAttribute("aria-label", engine.playing ? "Pause (Space)" : "Play (Space)");
    $("#disc").classList.toggle("spinning", engine.playing && !reduceMotion);
    $("#disc").classList.toggle("playing", engine.playing);
  }

  function redrawChart() { chart.draw(state.song, engine.events, effectiveMuted()); chart.move(Math.max(0, state.idx)); }

  function effectiveMuted() {
    if (state.solo) return new Set(state.song.layers.map(l => l.id).filter(id => id !== state.solo));
    return state.muted;
  }

  function renderStrips() {
    const song = state.song;
    $("#strips").innerHTML = song.layers.map((l, k) => `
      <div class="strip" data-layer="${l.id}">
        <div class="strip-name"><span class="swatch" style="background:${l.color}"></span><span>${l.icon} ${l.name}<br><small class="muted">${l.units}</small></span></div>
        <div class="instr">${engine.instrumentFor(l.id)}</div>
        <div class="meter" style="color:${l.color}" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="ms">
          <button type="button" class="mute" aria-pressed="${state.muted.has(l.id)}" aria-label="Mute ${l.name} (${k + 1})">M</button>
          <button type="button" class="solo" aria-pressed="${state.solo === l.id}" aria-label="Solo ${l.name} (Shift ${k + 1})">S</button>
        </div>
        <div class="value" id="val-${l.id}">—</div>
      </div>`).join("");
    $("#strips").querySelectorAll(".strip").forEach(strip => {
      const id = strip.dataset.layer;
      strip.querySelector(".mute").addEventListener("click", () => toggleMute(id));
      strip.querySelector(".solo").addEventListener("click", () => toggleSolo(id));
    });
    updateValues(Math.max(0, state.idx));
  }

  function applyMix() {
    for (const l of state.song.layers) engine.setMute(l.id, state.muted.has(l.id));
    engine.setSolo(state.solo);
  }
  function refreshMixUI() {
    document.querySelectorAll(".strip").forEach(s => {
      const id = s.dataset.layer;
      s.querySelector(".mute").setAttribute("aria-pressed", state.muted.has(id));
      s.querySelector(".solo").setAttribute("aria-pressed", state.solo === id);
      s.classList.toggle("dimmed", effectiveMuted().has(id));
    });
    redrawChart(); drawOverlay(state.song, Math.max(0, state.idx), false);
  }
  function toggleMute(id) {
    state.muted.has(id) ? state.muted.delete(id) : state.muted.add(id);
    applyMix(); refreshMixUI();
    const l = state.song.layers.find(x => x.id === id);
    live(`${l.name} ${state.muted.has(id) ? "muted" : "on"}.`);
  }
  function toggleSolo(id) {
    state.solo = state.solo === id ? null : id;
    applyMix(); refreshMixUI();
    const l = state.song.layers.find(x => x.id === id);
    live(state.solo ? `Solo: ${l.name}.` : "Solo off. All layers playing.");
  }

  function updateValues(i) {
    for (const l of state.song.layers) {
      const e = engine.events[l.id][i], box = document.getElementById(`val-${l.id}`);
      if (!box || !e) continue;
      box.innerHTML = `${fmtNum(e.value, l.digits)} <small>${l.units.split(" (")[0]}</small>`;
      const bars = document.querySelectorAll(`.strip[data-layer="${l.id}"] .meter i`);
      const lvl = e.midi === null ? 0 : Math.round((e.n ?? 0) * 4) + 1;
      bars.forEach((b, k) => { b.classList.toggle("on", k < lvl); b.style.height = (30 + k * 17) + "%"; });
    }
  }

  function onStep(i) {
    state.idx = i;
    const song = state.song, d = song.steps[i];
    $("#date").textContent = fmtDate(song, d);
    if (song.captions && song.captions[d]) { $("#caption").textContent = song.captions[d]; state.capAt = i; live(`${fmtDate(song, d)}. ${song.captions[d]}`); }
    else if (state.capAt !== undefined && (i - state.capAt > 4 || i < state.capAt)) { $("#caption").textContent = ""; state.capAt = undefined; }
    else {
      const month = d.slice(0, 7);
      if (month !== state.lastMonth && (song.stepUnit === "week" || d.slice(5, 7) === "01")) live(fmtDate(song, d).replace(/^\d+ /, ""));
    }
    state.lastMonth = d.slice(0, 7);
    chart.move(i); updateValues(i); showFrame(song, i, engine.playing);
  }
  engine.onStep = onStep;
  engine.onEnd = () => { setPlayUI(); $("#caption").textContent = "The end. Press play to hear it again."; live("End of track."); };

  async function togglePlay() {
    if (!state.ready) return;
    if (engine.playing) { engine.pause(); state.idx = engine.idx; live(`Paused at ${fmtDate(state.song, state.song.steps[Math.max(0, engine.idx - 1)])}. Use left and right arrows to explore.`); }
    else { await engine.play(engine.idx); live(`Playing ${state.song.title}, ${EchoAudio.GENRES[state.genre].label}.`); }
    setPlayUI();
  }
  function restart() { engine.stop(); state.idx = 0; onStep(0); if (state.ready) togglePlay(); }
  function stop() { engine.stop(); state.idx = 0; setPlayUI(); onStep(0); $("#caption").textContent = "Stopped."; }

  function explore(delta) {
    if (engine.playing || !state.song) return;
    const n = state.song.steps.length;
    const i = Math.min(n - 1, Math.max(0, (engine.idx || 0) + delta));
    engine.idx = i; onStep(i);
    const parts = state.song.layers.map(l => {
      const e = engine.events[l.id][i];
      if (e && e.midi !== null) engine.preview(l.id, e.note, "8n");
      return `${l.name} ${fmtNum(e.value, l.digits)} ${l.units.split(" (")[0]}`;
    });
    live(`${fmtDate(state.song, state.song.steps[i])}. ${parts.join(". ")}.`);
  }

  /* ---------- Drawer: data & credits ---------- */
  function renderDrawer() {
    const s = state.song || DATA.songs[0];
    const layers = s.layers.map(l => `
      <h3>${l.icon} ${l.name}</h3>
      <p>${l.describe}</p>
      <p><b>Data type:</b> <span aria-hidden="true">${kindOf(l).icon}</span> ${kindOf(l).long}<br><b>Units:</b> ${l.units}. <b>Source:</b> <a href="${l.source.url}" target="_blank" rel="noopener">${l.source.name}</a>.<br><b>Method:</b> ${l.method}</p>`).join("");
    const rows = s.steps.map((d, i) => `<tr><td>${fmtDate(s, d)}</td>${s.layers.map(l => `<td>${fmtNum(l.values[i], l.digits)}</td>`).join("")}</tr>`).join("");
    $("#drawer-body").innerHTML = `
      <p>Every note comes from NASA data. ${s.intro ? s.intro : s.live ? "This song was fetched live from NASA's EONET and POWER services." : "Map colours were turned back into numbers using each map's colour legend, and checked against exact frames."}</p>
      <h3>Now showing: ${s.title}</h3>${layers}
      <details><summary>Data table (${s.steps.length} steps)</summary>
        <table><thead><tr><th>Date</th>${s.layers.map(l => `<th>${l.name}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></details>
      <h3>Limits we want you to know</h3>
      <ul>${s.limits ? s.limits.map(t => `<li>${t}</li>`).join("") + `
        <li>The design follows published research on how people hear data, but it has not yet been tested with blind and low-vision listeners.</li>
      </ul>` : `
        <li>Fire values of 20+ g of carbon per m² per week share the top colour of NASA's legend, so the biggest fires are "off the scale".</li>
        <li>Fire values come from a dated NASA video, calibrated to exact frames (about ±10%).</li>
        <li>Each line is scaled to its own range within the song, so pitch shows <i>relative</i> change. Small changes, such as carbon dioxide rising by 2 ppm in 2015, can sound bigger than they are. Exact values are in the mixer and the data table.</li>
        <li>Air quality is not included: we could not find a 2015 Southeast Asia map with a readable legend. The haze is told in the captions, based on the ASEAN Specialised Meteorological Centre's August 2015 review.</li>
        <li>The design follows published research on how people hear data, but it has not yet been tested with blind and low-vision listeners.</li>
      </ul>`}
      <h3>Instrument sounds</h3>
      <p>Recorded samples from <a href="https://github.com/nbrosowsky/tonejs-instruments" target="_blank" rel="noopener">tonejs-instruments</a> (CC BY 3.0; originally VSCO 2, Karoryfer and Freesound) and the <a href="https://github.com/gleitz/midi-js-soundfonts" target="_blank" rel="noopener">FluidR3 GM soundfont</a> (Frank Wen, MIT; pre-rendered by Benjamin Gleitzman). Played with <a href="https://tonejs.github.io/" target="_blank" rel="noopener">Tone.js</a> (MIT).</p>
      <h3>Use of AI</h3>
      <p>EchoSphere's concept is the team's own. Claude (Anthropic) helped with research, the data pipeline code, this web app's code and draft text. All sounds are generated live in your browser from NASA data; no AI audio or images are used.</p>`;
  }
  function openDrawer(open) {
    $("#drawer").hidden = !open; $("#btn-credits").setAttribute("aria-expanded", open);
    if (open) { renderDrawer(); $("#drawer-close").focus(); } else $("#btn-credits").focus();
  }

  /* ---------- Guide ---------- */
  /* How to listen: built from the song's own layers (each album card has its own guide button). */
  let guideSong = null;
  const escH = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const STEP_WORDS = { week: "one week", month: "one month", quarter: "three months (one quarter; dates are approximate)", slice: "one slice of the picture, read from west to east" };
  const side = p => (p > 0.1 ? "on the right" : p < -0.1 ? "on the left" : "in the centre");
  function guideInstrument(s, l) {
    if (s === state.song && state.ready) return engine.instrumentFor(l.id);
    return EchoAudio.SAMPLES[EchoAudio.instrumentKey(l, EchoAudio.GENRES[state.genre].layers)].label;
  }
  function guideItems(s) {
    if (!s) return [
      "<b>Low, middle, high.</b> Higher notes mean <i>more</i> of what a layer measures; lower notes mean less.",
      "<b>Each topic has its own instrument</b> and its own place in your headphones. Use Mute and Solo to hear one at a time.",
      "<b>Silence</b> means no data, or for rain, almost no rain (drought).",
      "Each album has its <b>own guide</b>: press <b>How to listen</b> on its card, or <kbd>H</kbd> while it plays.",
    ];
    const n = s.layers.length;
    return [
      `<b>${escH(s.title)}</b>${s.place ? `: ${escH(s.place)}` : ""}. Each note is ${STEP_WORDS[s.stepUnit] || "one step"} (${escH(s.period)}). <b>Higher notes mean more</b>, lower notes mean less.`,
      ...s.layers.map(l => `<b>${l.icon} ${escH(l.name)}</b>: <b>${escH(guideInstrument(s, l))}</b>, ${side(l.pan || 0)} of your headphones. ${escH(l.describe || "")}`),
      `<b>Hear one at a time</b> with Mute and Solo: keys <kbd>1</kbd>–<kbd>${n}</kbd>, and <kbd>Shift</kbd>+number for solo. When paused, <kbd>←</kbd> <kbd>→</kbd> step through and read each value.`,
    ];
  }
  /** Open the guide for a song (an album card's button), the playing song, or the general rules. */
  function openGuide(song) {
    const s = song && song.layers ? song : (!$("#view-player").hidden ? state.song : null);
    guideSong = s;
    $("#guide-title").textContent = s ? `How to listen: ${s.title}` : "How to listen";
    $("#guide-list").innerHTML = guideItems(s).map(t => `<li>${t}</li>`).join("");
    $("#guide-instruments").textContent = s ? `${EchoAudio.GENRES[state.genre].label}: ` + s.layers.map(l => `${l.icon} ${l.name} = ${guideInstrument(s, l)}`).join(" · ") : "";
    $("#guide-play").textContent = `▶ Read the guide aloud${s ? "" : ` (${DATA.songs[0].title})`}`;
    if (!$("#guide").open) $("#guide").showModal();
  }
  async function playGuide() {
    if (!guideSong) openGuide(DATA.songs[0]); // the general guide reads the first album's guide
    const target = guideSong;
    if (state.song !== target || $("#view-player").hidden) { await openSong(target); }
    if (!state.ready) return;
    if (engine.playing) { engine.pause(); setPlayUI(); }
    await Tone.start();
    $("#guide-play").disabled = true;
    // read exactly what the box shows, line by line
    const items = [...document.querySelectorAll("#guide-list li")].map(li => li.textContent.replace(/\s+/g, " ").trim());
    await EchoGuide.playGuide(engine, state.song, live, items);
    $("#guide-play").focus();
    $("#guide-play").disabled = false;
  }

  /* ---------- Wire up ---------- */
  function bind() {
    $("#brand").addEventListener("click", e => { e.preventDefault(); goHome(); });
    $("#btn-back").addEventListener("click", () => {
      const fromStudio = state.song && state.song.studio;
      goHome();
      if (fromStudio && window.EchoStudio) EchoStudio.showStudio();
    });
    $("#btn-play").addEventListener("click", togglePlay);
    $("#btn-restart").addEventListener("click", restart);
    $("#btn-stop").addEventListener("click", stop);
    $("#speed").addEventListener("change", e => { engine.setSpeed(parseFloat(e.target.value)); live(`Speed ${e.target.value} times.`); });
    document.querySelectorAll(".genre .seg").forEach(b => b.addEventListener("click", () => { if (b.dataset.genre !== state.genre) loadGenre(b.dataset.genre).then(() => live(`Genre: ${EchoAudio.GENRES[state.genre].label}.`)); }));
    const setMode = smooth => {
      engine.setSmoothed(smooth);
      $("#mode-smooth").setAttribute("aria-pressed", smooth); $("#mode-raw").setAttribute("aria-pressed", !smooth);
      redrawChart(); updateValues(Math.max(0, state.idx)); live(smooth ? "Smoothed: changes smaller than one legend step are merged." : "Raw: every value is played.");
    };
    $("#mode-smooth").addEventListener("click", () => setMode(true));
    $("#mode-raw").addEventListener("click", () => setMode(false));
    $("#btn-save").addEventListener("click", async () => {
      if (!state.ready) return;
      const b = $("#btn-save"); b.disabled = true;
      try {
        engine.stop(); setPlayUI();
        const name = `echosphere-${state.song.id}-${state.genre}.wav`;
        const p = EchoExport.saveWav(engine, name, t => { $("#save-status").textContent = t; });
        setTimeout(setPlayUI, 200);
        await p;
      } catch (err) { $("#save-status").textContent = "Saving failed: " + err.message; }
      b.disabled = false; setPlayUI();
    });
    $("#btn-guide").addEventListener("click", () => openGuide());
    $("#guide-close").addEventListener("click", () => $("#guide").close());
    $("#guide").addEventListener("close", () => EchoGuide.stop()); // Close button or Escape: stop reading
    $("#guide-play").addEventListener("click", playGuide);
    $("#btn-credits").addEventListener("click", () => openDrawer($("#drawer").hidden));
    $("#drawer-close").addEventListener("click", () => openDrawer(false));

    document.addEventListener("keydown", e => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (["input", "select", "textarea"].includes(tag)) return;
      if (e.key === "Escape" && !$("#drawer").hidden) return openDrawer(false);
      if (e.key.toLowerCase() === "h" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); return openGuide(); }
      if ($("#view-player").hidden) return;
      if (e.code === "Space" && tag !== "button") { e.preventDefault(); togglePlay(); }
      else if (e.key.toLowerCase() === "r") restart();
      else if (e.key.toLowerCase() === "g") { const next = state.genre === "orchestra" ? "band" : "orchestra"; loadGenre(next).then(() => live(`Genre: ${EchoAudio.GENRES[next].label}.`)); }
      else if (e.key === "ArrowRight") { e.preventDefault(); explore(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); explore(-1); }
      else if (/^Digit[1-4]$/.test(e.code)) {
        const l = state.song.layers[parseInt(e.code.slice(5), 10) - 1];
        if (l) e.shiftKey ? toggleSolo(l.id) : toggleMute(l.id);
      }
    });
  }

  function goHome() {
    engine.stop(); setPlayUI();
    $("#view-player").hidden = true; $("#view-studio").hidden = true; $("#view-home").hidden = false; document.body.classList.remove("in-player");
    if (location.hash) try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ }
    live("Back to the jukebox.");
  }

  $("#kinds-legend").innerHTML = "Where each album's numbers come from: " +
    [KINDS.visual, KINDS.vizdata, KINDS.data].map(k => `<span><span aria-hidden="true">${k.icon}</span> ${k.short}</span>`).join(" · ");
  renderHome(); renderDrawer(); bind();
  window.EchoApp = { openSong, goHome, live, state, KINDS, kindOf };
})();
