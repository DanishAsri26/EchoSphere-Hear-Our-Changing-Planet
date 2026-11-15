/* EchoSphere Studio (task 2.16, cut-down; live events 2.18): build your own song from the layers in
   songs.json, or from a real NASA event (EONET + POWER, see live.js).
   Pick 2–3 layers that share the same time steps, a genre and an instrument per layer
   (no two layers from the same instrument family), then play and save it in the normal player.
   Code written with AI assistance (Claude, Anthropic). */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const { GENRES, SAMPLES } = EchoAudio;
  const APP = window.EchoApp;
  const LIVE = window.EchoLive;
  const live = APP.live;
  const MIN = 2, MAX = 3;
  const ACCENTS = new Set(Object.values(GENRES).map(g => g.accent)); // timpani is kept for the fire accent

  // Every layer of every song, tagged with its song's timeline. Live event layers are added later.
  const CATALOG = [];
  const addToCatalog = song => song.layers.forEach(layer => CATALOG.push({
    key: `${song.id}:${layer.id}`, song, layer, timeline: JSON.stringify(song.steps),
  }));
  window.ECHO_SONGS.songs.forEach(addToCatalog);
  const byKey = k => CATALOG.find(e => e.key === k);

  const st = { selected: [], genre: "orchestra", instr: {}, events: [], busy: false };
  const chosen = () => CATALOG.filter(e => st.selected.includes(e.key));
  const famOf = k => SAMPLES[k].family;
  const instrumentKeys = Object.keys(SAMPLES).filter(k => !ACCENTS.has(k));

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
      const wanted = reset || !st.instr[e.key] ? pref : st.instr[e.key];
      let k = wanted;
      if (!k || used.has(famOf(k))) {
        k = [pref, ...instrumentKeys].find(x => x && !used.has(famOf(x)));
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
      <p class="lede">Make your own song from real NASA data. Use our album layers, or start from a real event. Then pick ${MIN} or ${MAX} layers, a genre, and an instrument for each layer.</p>
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
        <fieldset>
          <legend>1. Pick ${MIN} or ${MAX} data layers</legend>
          <p class="hint">Layers must share the same time steps, so only matching layers can be mixed.</p>
          <div class="studio-opts" id="studio-opts"></div>
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
          <span id="studio-status" class="muted"></span>
        </div>
      </form>`;

    $("#studio-back").addEventListener("click", APP.goHome);
    view.querySelectorAll('input[name="studio-genre"]').forEach(r => r.addEventListener("change", () => setGenre(r.value)));
    $("#studio-form").addEventListener("submit", ev => { ev.preventDefault(); openInPlayer(); });
    $("#live-find").addEventListener("click", findEvents);
    $("#live-use").addEventListener("click", useEvent);
    $("#live-filter").addEventListener("input", renderEventList);
    $("#live-filter").addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); $("#live-list").focus(); } });
    $("#live-list").addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); useEvent(); } });
    renderOpts();
  }

  function renderOpts() {
    const host = $("#studio-opts");
    host.innerHTML = CATALOG.map((e, i) => `
      <label class="studio-opt${e.song.live ? " live" : ""}" data-key="${e.key}">
        <input type="checkbox" value="${e.key}" aria-describedby="studio-why-${i}">
        <span><span style="color:${e.layer.color}" aria-hidden="true">●</span> ${e.layer.icon} <b>${e.layer.name}</b>, from “${e.song.title}”
          <small class="muted">${e.layer.units} · ${e.song.period}</small>
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
      const cb = box.querySelector("input");
      cb.checked = st.selected.includes(e.key);
      cb.setAttribute("aria-disabled", why ? "true" : "false");
      box.classList.toggle("blocked", !!why);
      document.getElementById(`studio-why-${i}`).textContent = why;
    });
    renderInstruments();
    const n = st.selected.length, ok = n >= MIN && n <= MAX;
    $("#studio-open").setAttribute("aria-disabled", ok ? "false" : "true");
    $("#studio-status").textContent = ok
      ? `${n} layers ready: ${chosen().map(e => `${e.layer.name} on ${SAMPLES[st.instr[e.key]].label}`).join(", ")}.`
      : `Pick ${n === 0 ? `${MIN} or ${MAX} layers` : "at least one more layer"} to open your song.`;
  }

  function renderInstruments() {
    const host = $("#studio-instr");
    if (!st.selected.length) { host.innerHTML = `<p class="muted">Pick a layer first.</p>`; return; }
    host.innerHTML = chosen().map((e, i) => `
      <label class="studio-instr">${e.layer.icon} ${e.layer.name}
        <select data-key="${e.key}" id="studio-sel-${i}">${instrumentKeys.map(k => {
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
      // one live event at a time: drop the previous one
      for (let i = CATALOG.length - 1; i >= 0; i--) if (CATALOG[i].song.live) CATALOG.splice(i, 1);
      const hadPicks = st.selected.length > 0;
      st.selected = []; st.instr = {};
      addToCatalog(song);
      renderOpts();
      setLiveStatus(`Added ${song.layers.length} layers for ${ev.title}: ${song.layers.map(l => l.name).join(", ")}. ` +
        `${hadPicks ? "Your earlier picks were cleared. " : ""}Now pick ${MIN} or ${MAX} of them in step 1.`);
      const firstNew = document.querySelector(".studio-opt.live input"); if (firstNew) firstNew.focus();
    } catch (err) { setLiveStatus(err.message); }
    st.busy = false; $("#live-box").removeAttribute("aria-busy");
  }

  /* ---------- Actions ---------- */
  function toggleLayer(key, on) {
    if (on && !st.selected.includes(key)) st.selected.push(key);
    if (!on) st.selected = st.selected.filter(k => k !== key);
    const changes = resolveInstruments(false);
    refresh();
    const e = byKey(key), n = st.selected.length;
    let msg = `${e.layer.name} ${on ? `added, played by ${SAMPLES[st.instr[key]].label}` : "removed"}. ${n} of ${MAX} layers.`;
    if (changes.length) msg += ` ${changes.join(". ")}, to keep instrument families different.`;
    if (n === 1) msg += " Layers with different time steps are now unavailable.";
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
      id: base.live ? base.id : "studio",
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
      limits: base.limits,
      layers: list.map(e => Object.assign({}, e.layer, { instrument: st.instr[e.key] })),
    };
  }

  function openInPlayer() {
    const n = st.selected.length;
    if (n < MIN || n > MAX) { live($("#studio-status").textContent); return; }
    APP.state.genre = st.genre;
    APP.openSong(makeSong());
  }

  function showStudio() {
    $("#view-home").hidden = true; $("#view-player").hidden = true; $("#view-studio").hidden = false;
    document.body.classList.remove("in-player");
    window.scrollTo({ top: 0 });
    $("#studio-title").focus();
    live(`Studio. Pick ${MIN} or ${MAX} data layers, a genre and an instrument for each layer, or start from a real NASA event.`);
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
        <p>From our layers, or from a real event in NASA's records</p>
        <div class="chips">${[...new Set(CATALOG.map(e => `${e.layer.icon} ${e.layer.name}`))].map(c => `<span class="chip">${c}</span>`).join("")}<span class="chip">🌍 Any event</span></div>
        <button type="button" class="play small" id="btn-studio" aria-label="Open the Studio"><span aria-hidden="true">▶</span> Build</button>
      </div>`;
    $("#albums").appendChild(card);
    $("#btn-studio").addEventListener("click", showStudio);
  }

  build();
  addCard();
  window.EchoStudio = { showStudio, makeSong, state: st, catalog: CATALOG };
})();
