/* EchoSphere Studio (task 2.16, cut-down; live events 2.18): build your own song from the layers in
   songs.json, or from a real NASA event (EONET + POWER, see live.js).
   Choose a source, pick 1–4 of its layers, a genre and an instrument per layer
   (no two layers from the same instrument family), then play and save it in the normal player.
   Code written with AI assistance (Claude, Anthropic). */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const { GENRES, SAMPLES } = EchoAudio;
  const APP = window.EchoApp;
  const LIVE = window.EchoLive;
  const live = APP.live;
  const MIN = 1, MAX = 4;
  const ACCENTS = new Set(Object.values(GENRES).map(g => g.accent)); // timpani is kept for the fire accent

  // Every layer of every song, tagged with its song's timeline. Live event layers are added later.
  const CATALOG = [];
  const addToCatalog = song => song.layers.forEach(layer => CATALOG.push({
    key: `${song.id}:${layer.id}`, song, layer, timeline: JSON.stringify(song.steps),
  }));
  window.ECHO_SONGS.songs.forEach(addToCatalog);
  const byKey = k => CATALOG.find(e => e.key === k);

  const st = { selected: [], genre: "orchestra", instr: {}, events: [], busy: false, source: window.ECHO_SONGS.songs[0].id };
  const plural = n => `${n} layer${n === 1 ? "" : "s"}`;
  /** Sources = songs whose layers can be mixed (one timeline each): albums, a loaded event, a snapshot. */
  const sources = () => [...new Map(CATALOG.map(e => [e.song.id, e.song])).values()];
  const chosen = () => CATALOG.filter(e => st.selected.includes(e.key));
  const famOf = k => SAMPLES[k].family;
  const genreInstruments = g => GENRES[g].instruments; // only the chosen genre's instruments are offered

  /** Why a layer cannot be picked right now ("" = it can). */
  function blockReason(e) {
    if (st.selected.includes(e.key)) return "";
    const first = chosen()[0];
    if (first && first.timeline !== e.timeline)
      return `Different time steps (${e.song.period}). Your song uses ${first.song.period}.`;
    if (st.selected.length >= MAX) return `Maximum ${MAX} layers. Remove one first.`;
    return "";
  }

  /** Family already used by another chosen layer → name of that layer, else "". */
  function familyUsedBy(instrument, exceptKey) {
    const other = chosen().find(e => e.key !== exceptKey && famOf(st.instr[e.key]) === famOf(instrument));
    return other ? other.layer.name : "";
  }

  /** Give every chosen layer an instrument, keeping families unique. Returns the list of changes. */
  function resolveInstruments(reset) {
    const changes = [], used = new Set();
    for (const e of chosen()) {
      const pref = GENRES[st.genre].layers[e.layer.id] || (e.layer.defaults || {})[st.genre];
      const list = genreInstruments(st.genre);
      const wanted = reset || !st.instr[e.key] || !list.includes(st.instr[e.key]) ? pref : st.instr[e.key];
      let k = wanted;
      if (!k || !list.includes(k) || used.has(famOf(k))) {
        k = [pref, ...list].find(x => x && list.includes(x) && !used.has(famOf(x)));
        if (wanted) changes.push(`${e.layer.name} changed to ${SAMPLES[k].label}`);
      }
      st.instr[e.key] = k; used.add(famOf(k));
    }
    for (const key of Object.keys(st.instr)) if (!st.selected.includes(key)) delete st.instr[key];
    return changes;
  }

  /* ---------- View ---------- */
  function build() {
    const view = $("#view-studio");
    const thisYear = new Date().getUTCFullYear();
    const years = []; for (let y = thisYear; y >= 2000; y--) years.push(y);
    view.innerHTML = `
      <div class="player-top"><button class="link-btn" id="studio-back" type="button">◂ Back to the jukebox</button></div>
      <h1 id="studio-title" tabindex="-1">Studio</h1>
      <p class="lede">Make your own song from real NASA data. Use our album layers, start from a real event, or <a href="#snap-box" id="studio-jump-snap">use your own picture</a>. Then choose a source, pick 1 to ${MAX} of its layers, a genre, and an instrument for each layer.</p>
      <section id="my-songs" class="studio-mine" hidden aria-labelledby="my-songs-title">
        <h2 id="my-songs-title">My songs</h2>
        <p class="hint">Saved in this browser only. Use Copy link to keep a song on another device or share it.</p>
        <ul id="my-songs-list"></ul>
      </section>
      <form id="studio-form" class="studio" novalidate>
        <fieldset id="live-box">
          <legend>Start from a real event (optional, needs internet)</legend>
          <p class="hint">Find an event in NASA's EONET event list. We then fetch NASA POWER weather at its location, from 8 weeks before to 8 weeks after, and add it to the layers below.</p>
          <div class="studio-row">
            <label class="ctl">Event type <select id="live-cat">${Object.entries(LIVE.CATEGORIES).map(([id, t]) => `<option value="${id}">${t}</option>`).join("")}</select></label>
            <label class="ctl">Year <select id="live-year">${years.map(y => `<option${y === thisYear - 1 ? " selected" : ""}>${y}</option>`).join("")}</select></label>
            <button type="button" class="ghost" id="live-find">Find events</button>
          </div>
          <div id="live-results" class="studio-live-results" hidden>
            <label class="ctl" for="live-filter">Filter by name</label>
            <input id="live-filter" type="search" autocomplete="off" placeholder="e.g. Kilauea, Hurricane">
            <label class="ctl" for="live-list">Events</label>
            <select id="live-list" size="7"></select>
            <div><button type="button" class="ghost" id="live-use">Use this event</button></div>
          </div>
          <p id="live-status" class="muted"></p>
        </fieldset>
        <fieldset id="snap-box" class="snap-box"></fieldset>
        <fieldset>
          <legend>1. Choose a source, then pick 1 to ${MAX} layers</legend>
          <label class="ctl studio-source">Source <select id="studio-source"></select></label>
          <div class="studio-opts" id="studio-opts" role="group" aria-label="Layers of the chosen source"></div>
        </fieldset>
        <fieldset>
          <legend>2. Genre</legend>
          <div class="studio-genres">${Object.entries(GENRES).map(([id, g]) => `
            <label class="studio-opt"><input type="radio" name="studio-genre" value="${id}"${id === st.genre ? " checked" : ""}> ${g.label}
              <small class="muted">${g.bpm} beats per minute${g.bed ? ", drum groove" : ""}</small></label>`).join("")}
          </div>
        </fieldset>
        <fieldset>
          <legend>3. Instrument for each layer</legend>
          <p class="hint">Each layer needs an instrument from a different family (brass, strings, woodwind…), so you can tell them apart.</p>
          <div id="studio-instr"></div>
        </fieldset>
        <div class="studio-actions">
          <button type="submit" class="play" id="studio-open" aria-describedby="studio-status"><span aria-hidden="true">▶</span> Open in player</button>
          <button type="button" class="ghost" id="studio-link" aria-describedby="studio-status">Copy link</button>
          <span id="studio-status" class="muted"></span>
        </div>
      </form>`;

    $("#studio-back").addEventListener("click", APP.goHome);
    $("#studio-jump-snap").addEventListener("click", ev => { ev.preventDefault(); showPictures(); });
    view.querySelectorAll('input[name="studio-genre"]').forEach(r => r.addEventListener("change", () => setGenre(r.value)));
    $("#studio-form").addEventListener("submit", ev => { ev.preventDefault(); openInPlayer(); });
    $("#live-find").addEventListener("click", findEvents);
    $("#live-use").addEventListener("click", useEvent);
    $("#live-filter").addEventListener("input", renderEventList);
    $("#live-filter").addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); $("#live-list").focus(); } });
    $("#live-list").addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); useEvent(); } });
    $("#my-songs-list").addEventListener("click", onMine);
    $("#studio-source").addEventListener("change", ev => setSource(ev.target.value, true));
    $("#studio-link").addEventListener("click", () => {
      const n = st.selected.length;
      if (n < MIN || n > MAX) { live($("#studio-status").textContent); return; }
      if (isSnapshot()) { $("#studio-status").textContent = NO_LINK; live(NO_LINK); return; }
      copyLink(recipe(), $("#studio-status"));
    });
    renderOpts();
    renderMine();
  }

  function renderOpts() {
    const host = $("#studio-opts");
    renderSources();
    host.innerHTML = CATALOG.map((e, i) => e.song.id !== st.source ? "" : `
      <label class="studio-opt${e.song.live ? " live" : ""}" data-key="${e.key}">
        <input type="checkbox" value="${e.key}" aria-describedby="studio-why-${i}">
        <span><span style="color:${e.layer.color}" aria-hidden="true">●</span> ${e.layer.icon} <b>${esc(e.layer.name)}</b>
          <small class="muted">${esc(e.layer.units)} · <span aria-hidden="true">${APP.kindOf(e.layer).icon}</span> ${APP.kindOf(e.layer).short}</small>
          <small class="studio-why" id="studio-why-${i}"></small></span>
      </label>`).join("");
    host.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener("click", ev => {
        const e = byKey(cb.value), why = blockReason(e);
        if (why) { ev.preventDefault(); live(`${e.layer.name} not available. ${why}`); }
      });
      cb.addEventListener("change", () => toggleLayer(cb.value, cb.checked));
    });
    refresh();
  }

  function refresh() {
    // layer checkboxes: blocked ones stay focusable (aria-disabled) so screen-reader users hear the reason
    CATALOG.forEach((e, i) => {
      const why = blockReason(e), box = document.querySelector(`.studio-opt[data-key="${e.key}"]`);
      if (!box) return; // layer of another source
      const cb = box.querySelector("input");
      cb.checked = st.selected.includes(e.key);
      cb.setAttribute("aria-disabled", why ? "true" : "false");
      box.classList.toggle("blocked", !!why);
      document.getElementById(`studio-why-${i}`).textContent = why;
    });
    renderInstruments();
    const n = st.selected.length, ok = n >= MIN && n <= MAX;
    $("#studio-open").setAttribute("aria-disabled", ok ? "false" : "true");
    $("#studio-link").setAttribute("aria-disabled", ok ? "false" : "true");
    $("#studio-status").textContent = ok
      ? `${plural(n)} ready: ${chosen().map(e => `${e.layer.name} on ${SAMPLES[st.instr[e.key]].label}`).join(", ")}.`
      : `Pick 1 to ${MAX} layers to open your song.`;
  }

  function renderInstruments() {
    const host = $("#studio-instr");
    if (!st.selected.length) { host.innerHTML = `<p class="muted">Pick a layer first.</p>`; return; }
    host.innerHTML = chosen().map((e, i) => `
      <label class="studio-instr">${e.layer.icon} ${e.layer.name}
        <select data-key="${e.key}" id="studio-sel-${i}">${genreInstruments(st.genre).map(k => {
          const by = familyUsedBy(k, e.key);
          return `<option value="${k}"${k === st.instr[e.key] ? " selected" : ""}${by ? " disabled" : ""}>${SAMPLES[k].label} (${SAMPLES[k].family}${by ? `, used by ${by}` : ""})</option>`;
        }).join("")}</select>
      </label>`).join("");
    host.querySelectorAll("select").forEach(sel => sel.addEventListener("change", () => setInstrument(sel.dataset.key, sel.value, sel.id)));
  }

  /* ---------- Live events (NASA EONET + POWER) ---------- */
  const setLiveStatus = (msg, announce) => { $("#live-status").textContent = msg; if (announce !== false) live(msg); };

  async function findEvents() {
    if (st.busy) return;
    const cat = $("#live-cat").value, year = $("#live-year").value, label = LIVE.CATEGORIES[cat].toLowerCase();
    st.busy = true; $("#live-box").setAttribute("aria-busy", "true");
    st.events = []; $("#live-results").hidden = true; // don't act on the previous list while searching
    setLiveStatus(`Searching NASA EONET for ${label} in ${year}…`);
    try {
      st.events = await LIVE.findEvents(cat, year);
      $("#live-filter").value = "";
      renderEventList();
      $("#live-results").hidden = !st.events.length;
      setLiveStatus(st.events.length
        ? `Found ${st.events.length} ${label} in ${year}. Choose one from the Events list, then press Use this event.`
        : `No ${label} found in ${year}. Try another year or event type.`);
      if (st.events.length) $("#live-list").focus();
    } catch (err) { setLiveStatus(err.message); }
    st.busy = false; $("#live-box").removeAttribute("aria-busy");
  }

  function renderEventList() {
    const q = $("#live-filter").value.trim().toLowerCase();
    const list = st.events.filter(e => !q || e.title.toLowerCase().includes(q));
    $("#live-list").innerHTML = list.map(e => `<option value="${e.id}">${e.title} · ${e.date}</option>`).join("");
    if (list.length) $("#live-list").selectedIndex = 0;
    if (q) $("#live-status").textContent = `${list.length} of ${st.events.length} events match “${q}”.`;
  }

  async function useEvent() {
    if (st.busy) return;
    const ev = st.events.find(e => e.id === $("#live-list").value);
    if (!ev) { setLiveStatus("Choose an event from the Events list first."); return; }
    st.busy = true; $("#live-box").setAttribute("aria-busy", "true");
    setLiveStatus(`Fetching NASA POWER weather for ${ev.title} (${ev.lat}°, ${ev.lon}°)…`);
    try {
      const song = await LIVE.eventSong(ev);
      const hadPicks = st.selected.length > 0;
      addEventSong(song);
      setLiveStatus(`Added ${song.layers.length} layers for ${ev.title}: ${song.layers.map(l => l.name).join(", ")}. ` +
        `${hadPicks ? "Your earlier picks were cleared. " : ""}It is now the chosen source in step 1: pick 1 to ${MAX} of its layers.`);
      const firstNew = document.querySelector(".studio-opt.live input"); if (firstNew) firstNew.focus();
    } catch (err) { setLiveStatus(err.message); }
    st.busy = false; $("#live-box").removeAttribute("aria-busy");
  }

  /** Put one event's layers in the catalog (one live event at a time) and clear the picks. */
  function addEventSong(song) {
    for (let i = CATALOG.length - 1; i >= 0; i--) if (CATALOG[i].song.live) CATALOG.splice(i, 1);
    st.selected = []; st.instr = {};
    addToCatalog(song);
    st.source = song.id;
    renderOpts();
  }

  /** Add (or replace) a whole source, e.g. the snapshot song, and make it the chosen source. */
  function addSource(song) {
    for (let i = CATALOG.length - 1; i >= 0; i--) if (CATALOG[i].song.id === song.id) CATALOG.splice(i, 1);
    addToCatalog(song);
    st.source = song.id; st.selected = []; st.instr = {};
    renderOpts();
  }
  function removeSource(id) {
    for (let i = CATALOG.length - 1; i >= 0; i--) if (CATALOG[i].song.id === id) CATALOG.splice(i, 1);
    if (st.source === id) { st.source = sources()[0].id; st.selected = []; st.instr = {}; }
    renderOpts();
  }
  const isSnapshot = () => { const s = sources().find(x => x.id === st.source); return !!(s && s.snapshot); };
  const NO_LINK = "Snapshot songs cannot be shared as a link, because your pictures stay on your device. Use Save as WAV in the player to keep the music.";

  function renderSources() {
    const groups = [["Albums", s => !s.live && !s.snapshot], ["Your event (live)", s => s.live], ["Your snapshots", s => s.snapshot]];
    $("#studio-source").innerHTML = groups.map(([label, test]) => {
      const list = sources().filter(test);
      return list.length ? `<optgroup label="${label}">${list.map(s => `<option value="${s.id}"${s.id === st.source ? " selected" : ""}>${esc(s.title)} · ${esc(s.period)} (${plural(s.layers.length)})</option>`).join("")}</optgroup>` : "";
    }).join("");
  }

  /** Switch source: only its layers are shown; picks from another source are cleared. */
  function setSource(id, announce) {
    const song = sources().find(s => s.id === id); if (!song) return;
    const hadPicks = st.selected.length > 0;
    st.source = id; st.selected = []; st.instr = {};
    renderOpts();
    if (announce) live(`Source: ${song.title}, ${song.period}. ${plural(song.layers.length)}: ${song.layers.map(l => l.name).join(", ")}.${hadPicks ? " Your earlier picks were cleared." : ""}`);
  }

  /* ---------- Save & share (task 2.21) ----------
     A song is saved as a small recipe (layer keys, genre, instruments), never as data or sound:
     opening it rebuilds the music from the NASA data (live-event songs re-fetch it). */
  const enc = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const dec = s => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/")))));
  const recipe = () => ({ v: 1, g: st.genre, l: chosen().map(e => [e.key, st.instr[e.key]]) });
  const songLink = r => `${location.origin}${location.pathname}#song=${enc(r)}`;
  const STORE = "echosphere.mySongs.v1";
  const loadMine = () => { try { const x = JSON.parse(localStorage.getItem(STORE)); return Array.isArray(x) ? x : []; } catch (e) { return []; } };
  const saveMine = list => { try { localStorage.setItem(STORE, JSON.stringify(list.slice(0, 10))); return true; } catch (e) { return false; } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  async function applyRecipe(r) {
    if (!r || r.v !== 1 || !Array.isArray(r.l) || !GENRES[r.g]) throw new Error("This song link is broken.");
    const keys = r.l.map(x => String(x[0]));
    if (keys.some(k => k.startsWith("snapshot:"))) throw new Error("This song was made from pictures on another device, so it cannot be opened from a link.");
    const liveKey = keys.find(k => k.startsWith("live-"));
    if (liveKey) {
      const id = liveKey.slice(5).split(":")[0];
      if (!CATALOG.some(e => e.song.id === `live-${id}`)) {
        setLiveStatus("Loading this song's event from NASA EONET and POWER…");
        const song = await LIVE.eventSong(await LIVE.getEvent(id));
        addEventSong(song);
        setLiveStatus(`Loaded ${song.title} from NASA.`, false);
      }
    }
    const entries = keys.map(byKey);
    if (entries.some(e => !e) || entries.length < MIN || entries.length > MAX || new Set(entries.map(e => e.timeline)).size !== 1)
      throw new Error("This song link does not match the data in this version of EchoSphere.");
    st.genre = r.g; st.source = entries[0].song.id; renderOpts(); st.selected = keys; st.instr = {};
    r.l.forEach(([k, inst]) => { if (SAMPLES[inst] && !ACCENTS.has(inst)) st.instr[k] = inst; });
    resolveInstruments(false); // re-checks the family rule
    document.querySelectorAll('input[name="studio-genre"]').forEach(x => { x.checked = x.value === st.genre; });
    refresh();
  }

  function rememberSong() {
    const r = recipe(), id = enc(r), list = chosen();
    const name = `${list.map(e => e.layer.name).join(" + ")} · ${list[0].song.title}`;
    const mine = loadMine().filter(x => x.id !== id);
    mine.unshift({ id, name, genre: GENRES[st.genre].label, saved: new Date().toISOString().slice(0, 10), r });
    saveMine(mine); renderMine();
  }

  function renderMine() {
    const mine = loadMine();
    $("#my-songs").hidden = !mine.length;
    $("#my-songs-list").innerHTML = mine.map((x, i) => `
      <li><span>${esc(x.name)} <small class="muted">${esc(x.genre)} · saved ${esc(x.saved)}</small></span>
        <span class="my-actions">
          <button type="button" class="ghost" data-act="open" data-i="${i}" aria-label="Open ${esc(x.name)}">Open</button>
          <button type="button" class="ghost" data-act="link" data-i="${i}" aria-label="Copy link to ${esc(x.name)}">Copy link</button>
          <button type="button" class="ghost" data-act="del" data-i="${i}" aria-label="Delete ${esc(x.name)}">Delete</button>
        </span></li>`).join("");
  }

  async function onMine(ev) {
    const b = ev.target.closest("button[data-act]"); if (!b) return;
    const mine = loadMine(), x = mine[+b.dataset.i]; if (!x) return;
    if (b.dataset.act === "open") {
      try { await applyRecipe(x.r); openInPlayer(); } catch (err) { live(err.message); $("#studio-status").textContent = err.message; }
    } else if (b.dataset.act === "link") {
      copyLink(x.r, $("#studio-status"));
    } else {
      mine.splice(+b.dataset.i, 1); saveMine(mine); renderMine();
      live(`Deleted ${x.name}. ${mine.length} saved songs left.`);
      $(mine.length ? "#my-songs-list button" : "#studio-title").focus();
    }
  }

  async function copyLink(r, statusEl) {
    const url = songLink(r);
    let ok = false;
    try { await navigator.clipboard.writeText(url); ok = true; } catch (e) { /* no clipboard permission */ }
    statusEl.textContent = ok ? "Link copied. Anyone who opens it hears this song." : `Copy this link: ${url}`;
    live(ok ? "Link copied. Anyone who opens it hears this song." : "Could not copy automatically. The link is shown on screen.");
  }

  async function openFromHash() {
    const m = location.hash.match(/^#song=([A-Za-z0-9_-]+)$/);
    if (!m) return;
    showStudio();
    try { await applyRecipe(dec(m[1])); openInPlayer(); }
    catch (err) { const msg = err.message.startsWith("This") || err.message.startsWith("Could") ? err.message : "This song link is broken."; $("#studio-status").textContent = msg; live(msg); }
  }

  /* ---------- Actions ---------- */
  function toggleLayer(key, on) {
    if (on && !st.selected.includes(key)) st.selected.push(key);
    if (!on) st.selected = st.selected.filter(k => k !== key);
    const changes = resolveInstruments(false);
    refresh();
    const e = byKey(key), n = st.selected.length;
    let msg = `${e.layer.name} ${on ? `added, played by ${SAMPLES[st.instr[key]].label}` : "removed"}. ${n} of up to ${MAX} layers.`;
    if (changes.length) msg += ` ${changes.join(". ")}, to keep instrument families different.`;
    live(msg);
  }

  function setGenre(genre) {
    st.genre = genre;
    resolveInstruments(true);
    refresh();
    const list = chosen().map(e => `${e.layer.name} ${SAMPLES[st.instr[e.key]].label}`).join(", ");
    live(`Genre: ${GENRES[genre].label}.${list ? ` Instruments reset to: ${list}.` : ""}`);
  }

  function setInstrument(key, k, selId) {
    st.instr[key] = k;
    refresh();
    const sel = document.getElementById(selId); if (sel) sel.focus(); // the list was re-drawn
    live(`${byKey(key).layer.name}: ${SAMPLES[k].label}.`);
  }

  function makeSong() {
    const list = chosen(), base = list[0].song;
    return {
      id: base.snapshot ? "snapshot" : base.live ? base.id : "studio",
      title: base.studioTitle || "My Studio song",
      subtitle: "Built in the Studio from NASA data",
      place: base.place,
      period: base.period,
      cover: base.cover,
      stepUnit: base.stepUnit,
      steps: base.steps,
      captions: base.captions,
      studio: true,
      live: !!base.live,
      snapshot: !!base.snapshot,
      intro: base.intro,
      limits: base.limits,
      layers: list.map(e => Object.assign({}, e.layer, { instrument: st.instr[e.key] })),
    };
  }

  function openInPlayer() {
    const n = st.selected.length;
    if (n < MIN || n > MAX) { live($("#studio-status").textContent); return; }
    APP.state.genre = st.genre;
    if (!isSnapshot()) { // snapshot songs live only on this device: no link, not in My songs
      rememberSong();
      try { history.replaceState(null, "", `#song=${enc(recipe())}`); } catch (e) { /* address bar not updatable */ }
    }
    APP.openSong(makeSong());
  }

  function showStudio() {
    $("#view-home").hidden = true; $("#view-player").hidden = true; $("#view-studio").hidden = false;
    document.body.classList.remove("in-player");
    window.scrollTo({ top: 0 });
    $("#studio-title").focus();
    live(`Studio. Choose a source and pick 1 to ${MAX} of its layers, a genre and an instrument for each layer. You can also start from a real NASA event.`);
  }

  /** Player genre switch for a Studio song: re-pick instruments from the new genre, families kept unique. */
  function retune(song, genre) {
    const list = genreInstruments(genre), used = new Set();
    for (const l of song.layers) {
      const pref = GENRES[genre].layers[l.id] || (l.defaults || {})[genre];
      let k = list.includes(l.instrument) && !used.has(famOf(l.instrument)) ? l.instrument : pref;
      if (!k || !list.includes(k) || used.has(famOf(k))) k = list.find(x => !used.has(famOf(x)));
      l.instrument = k; used.add(famOf(k));
    }
  }

  /** Open the Studio straight at the picture tool. */
  function showPictures() {
    showStudio();
    const box = $("#snap-box"); if (!box) return;
    box.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    const f = $("#snap-file"); if (f && !f.disabled) f.focus();
    live("Make music from your pictures. Add a picture with a colour legend, then mark the legend.");
  }

  /* ---------- Jukebox card ---------- */
  function addCard() {
    const card = document.createElement("article");
    card.className = "album album-studio"; card.setAttribute("role", "listitem");
    card.innerHTML = `
      <div class="disc"><div class="disc-fallback"></div><span class="disc-hole"></span></div>
      <div>
        <h2>Studio</h2>
        <p>Build your own song</p>
        <p>From our layers, a real event in NASA's records, or your own picture (snapshot)</p>
        <div class="chips">${[...new Set(CATALOG.map(e => `${e.layer.icon} ${e.layer.name}`))].map(c => `<span class="chip">${c}</span>`).join("")}<span class="chip">🌍 Any event</span><span class="chip">🖼️ Your pictures</span></div>
        <div class="studio-row">
          <button type="button" class="play small" id="btn-studio" aria-label="Open the Studio"><span aria-hidden="true">▶</span> Build</button>
          <button type="button" class="ghost" id="btn-studio-pic">🖼️ Use a picture</button>
        </div>
      </div>`;
    $("#albums").prepend(card); // first, so everyone finds it
    $("#btn-studio").addEventListener("click", showStudio);
    $("#btn-studio-pic").addEventListener("click", showPictures);
    // top-bar link: reachable from every page; stops a playing song first
    $("#btn-studio-nav").addEventListener("click", () => { if (!$("#view-player").hidden) APP.goHome(); showStudio(); });
  }

  build();
  addCard();
  // player "Copy link" button (shown for Studio songs only)
  $("#btn-share").addEventListener("click", () => copyLink(recipe(), $("#save-status")));
  window.addEventListener("hashchange", openFromHash);
  window.EchoStudio = { showStudio, showPictures, retune, makeSong, state: st, catalog: CATALOG, recipe, songLink, addSource, removeSource };
  openFromHash();
})();
