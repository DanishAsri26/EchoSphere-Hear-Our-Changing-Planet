/* EchoSphere live event data (task 2.18): find a real event in NASA EONET, then fetch NASA POWER
   daily weather at that place for 8 weeks before to 8 weeks after, as weekly means.
   Only real NASA values are used; every layer keeps its exact request URL as its source.
   Needs internet (the two albums stay fully offline).
   Code written with AI assistance (Claude, Anthropic). */
(function () {
  "use strict";
  const EONET = "https://eonet.gsfc.nasa.gov/api/v3/events";
  const POWER = "https://power.larc.nasa.gov/api/temporal/daily/point";
  const WEEKS_BEFORE = 8, WEEKS_AFTER = 8, DAY = 86400000;

  // EONET categories that make sense to "listen around" (id → label).
  const CATEGORIES = {
    wildfires: "Wildfires", severeStorms: "Severe storms", volcanoes: "Volcanoes", floods: "Floods",
    drought: "Drought", dustHaze: "Dust and haze", tempExtremes: "Temperature extremes",
  };

  // POWER parameters played as layers. legendStep = smallest change that counts (clean-up rule);
  // defaults = starting instrument per genre for ids not in GENRES. Rain uses GENRES (harp / e-piano), so the
  // four layers start in four different families in both genres: strings/brass/woodwind/percussion and
  // keyboard/guitar/synth/woodwind (the Studio still re-checks families).
  const PARAMS = [
    { param: "PRECTOTCORR", id: "rain", name: "Rain", icon: "🌧️", color: "#4FC3F7", units: "mm per day",
      register: "mid", pan: -0.3, legendStep: 1.0, restBelow: 1.0,
      describe: "Daily rain, averaged per week. Higher notes mean more rain; silence means almost none (below 1 mm per day)." },
    { param: "T2M", id: "temp", name: "Temperature", icon: "🌡️", color: "#FF8A65", units: "°C at 2 m",
      register: "high", pan: 0.3, legendStep: 0.5, defaults: { orchestra: "trumpet", band: "guitar-electric" },
      describe: "Air temperature 2 m above the ground, averaged per week. Higher notes mean warmer." },
    { param: "RH2M", id: "humidity", name: "Humidity", icon: "💧", color: "#80CBC4", units: "% relative humidity",
      register: "lowmid", pan: -0.15, legendStep: 2.0, legato: true, defaults: { orchestra: "bassoon", band: "pad_2_warm" },
      describe: "How moist the air is, averaged per week. Higher notes mean more humid; dry air gives low notes." },
    { param: "WS10M", id: "wind", name: "Wind", icon: "🌬️", color: "#E6EE9C", units: "m/s at 10 m",
      register: "low", pan: 0.15, legendStep: 0.5, defaults: { orchestra: "marimba", band: "saxophone" },
      describe: "Wind speed 10 m above the ground, averaged per week. Higher notes mean stronger wind." },
  ];

  const cache = new Map();
  async function getJson(url, what) {
    if (cache.has(url)) return cache.get(url);
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 45000);
    let res;
    try { res = await fetch(url, { signal: ctl.signal }); }
    catch (e) { throw new Error(`Could not reach ${what}. Check your internet connection. The albums still work offline.`); }
    finally { clearTimeout(timer); }
    if (!res.ok) throw new Error(`${what} answered with an error (${res.status}). Try another event or try again later.`);
    const data = await res.json();
    cache.set(url, data);
    return data;
  }

  const iso = d => d.toISOString().slice(0, 10);
  const ymd = d => iso(d).replace(/-/g, "");

  /** Events of one category in one year, newest first: [{id, title, date, lat, lon, where, link, sources, closed}] */
  async function findEvents(category, year) {
    const url = `${EONET}?status=all&category=${category}&start=${year}-01-01&end=${year}-12-31`;
    const data = await getJson(url, "NASA EONET");
    return data.events.map(e => {
      const geo = e.geometry.slice().sort((a, b) => a.date.localeCompare(b.date));
      const start = geo[0];
      // place: strongest reported point if magnitudes exist, else the first report; areas use their centre
      const withMag = geo.filter(g => g.magnitudeValue != null);
      const pick = withMag.length ? withMag.reduce((a, b) => (b.magnitudeValue > a.magnitudeValue ? b : a)) : start;
      let lon, lat;
      if (pick.type === "Point") [lon, lat] = pick.coordinates;
      else { const ring = pick.coordinates[0]; lon = ring.reduce((s, p) => s + p[0], 0) / ring.length; lat = ring.reduce((s, p) => s + p[1], 0) / ring.length; }
      return {
        id: e.id, title: e.title, date: start.date.slice(0, 10), closed: e.closed ? e.closed.slice(0, 10) : null,
        lat: +lat.toFixed(2), lon: +lon.toFixed(2), link: e.link, sources: e.sources || [],
        where: withMag.length ? `where it was strongest (${pick.magnitudeValue} ${pick.magnitudeUnit || ""}`.trim() + `, ${pick.date.slice(0, 10)})`
             : pick.type === "Point" ? "where it was first reported" : "centre of the reported area",
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }

  /** Build a song-shaped object (same fields as songs.json) for one event. */
  async function eventSong(ev) {
    const center = new Date(ev.date + "T00:00:00Z");
    const first = new Date(center.getTime() - WEEKS_BEFORE * 7 * DAY);
    const nWeeks = WEEKS_BEFORE + WEEKS_AFTER + 1;
    const last = new Date(Math.min(first.getTime() + nWeeks * 7 * DAY - DAY, Date.now() - 3 * DAY));
    if (last <= first) throw new Error("This event is too recent: NASA POWER has no data for it yet.");
    const url = `${POWER}?parameters=${PARAMS.map(p => p.param).join(",")}&community=AG&longitude=${ev.lon}&latitude=${ev.lat}&start=${ymd(first)}&end=${ymd(last)}&format=JSON`;
    const data = await getJson(url, "NASA POWER");
    const P = data.properties && data.properties.parameter;
    if (!P) throw new Error("NASA POWER returned no data for this place and time.");
    const fill = data.header && data.header.fill_value !== undefined ? data.header.fill_value : -999;

    const steps = [];
    for (let w = 0; w < nWeeks; w++) steps.push(iso(new Date(first.getTime() + w * 7 * DAY)));
    const weekly = param => steps.map(s => {
      const xs = [];
      for (let d = 0; d < 7; d++) {
        const v = P[param] && P[param][ymd(new Date(new Date(s + "T00:00:00Z").getTime() + d * DAY))];
        if (v !== undefined && v !== null && v !== fill) xs.push(v);
      }
      return xs.length >= 4 ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : null; // need most of the week
    });

    const evStep = steps.findIndex((s, i) => ev.date >= s && (i === steps.length - 1 || ev.date < steps[i + 1]));
    const captions = { [steps[0]]: `Eight weeks before ${ev.title}.` };
    if (evStep >= 0) captions[steps[evStep]] = `${ev.date}: ${ev.title} begins (NASA EONET).`;
    if (ev.closed) { const ci = steps.findIndex((s, i) => ev.closed >= s && (i === steps.length - 1 || ev.closed < steps[i + 1])); if (ci > evStep) captions[steps[ci]] = `${ev.closed}: ${ev.title} ends.`; }

    const fmt = d => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    const layers = PARAMS.map(p => {
      const values = weekly(p.param);
      if (values.every(v => v === null)) return null;
      return Object.assign({}, p, {
        values,
        source: { name: `NASA POWER daily API (${p.param}), ${ev.lat}°, ${ev.lon}°`, url },
        method: `Daily ${p.param} values from NASA POWER (satellite and MERRA-2 model estimates on a grid of about 50 km) at ${ev.lat}°, ${ev.lon}°, ${ev.where}. Averaged per week (at least 4 days needed). Event date and place from NASA EONET (${ev.id}).`,
        live: true,
      });
    }).filter(Boolean);
    if (layers.length < 2) throw new Error("NASA POWER has too little data for this place and time.");

    return {
      id: `live-${ev.id}`,
      live: true,
      title: ev.title,
      studioTitle: `${ev.title}, in sound`,
      subtitle: "Weather around a real event, from NASA POWER",
      place: `${ev.title} · ${ev.lat}°, ${ev.lon}°`,
      period: `${fmt(steps[0])} – ${fmt(steps[steps.length - 1])} · weekly`,
      cover: "",
      stepUnit: "week",
      steps, captions,
      event: ev,
      limits: [
        `Live data: fetched just now from NASA POWER (satellite and MERRA-2 model estimates on a grid of about 50 km), not from a weather station.`,
        `You hear the weather at ${ev.lat}°, ${ev.lon}° (${ev.where}), from 8 weeks before to 8 weeks after the event started. EONET gives the event's place and date only, so the event itself (fire, smoke, eruption) is not measured here.`,
        `Weekly means of daily values; a week with fewer than 4 days of data is left silent.`,
        `Each line is scaled to its own range, so pitch shows relative change. Exact values are in the mixer and the data table.`,
        `Event from <a href="${ev.link}" target="_blank" rel="noopener">NASA EONET ${ev.id}</a>${ev.sources.length ? ` (sources: ${ev.sources.map(s => `<a href="${s.url}" target="_blank" rel="noopener">${s.id}</a>`).join(", ")})` : ""}.`,
      ],
      layers,
    };
  }

  window.EchoLive = { CATEGORIES, findEvents, eventSong };
})();
