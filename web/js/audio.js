/* EchoSphere audio engine (Design.md §6.2): recorded-sample instruments via Tone.js Sampler,
   one channel per data layer, mute/solo, genre switching. Synth fallback if samples fail.
   Code written with AI assistance (Claude, Anthropic). */
(function () {
  "use strict";
  const BASE = "audio/";

  // Recorded samples in web/audio/ (see audio/CREDITS.md). Keys = note names Tone understands.
  // family = instrument family. Rule (Conductor, 15 Nov): within one song, no two data layers
  // may use instruments from the same family, so every layer stays easy to tell apart.
  const SAMPLES = {
    "trumpet":          { label: "Trumpet",         family: "brass",      urls: { A3: "A3", C4: "C4", "D#4": "Ds4", F4: "F4", G4: "G4", "A#4": "As4", D5: "D5", F5: "F5", A5: "A5", C6: "C6" } },
    "tuba":             { label: "Tuba",            family: "brass",      urls: { F1: "F1", "A#1": "As1", "D#2": "Ds2", F2: "F2", "A#2": "As2", D3: "D3", F3: "F3" } },
    "bassoon":          { label: "Bassoon",         family: "woodwind",   urls: { G2: "G2", A2: "A2", C3: "C3", G3: "G3", C4: "C4" } },
    "saxophone":        { label: "Saxophone",       family: "woodwind",   urls: { C4: "C4", "D#4": "Ds4", "F#4": "Fs4", A4: "A4", C5: "C5", "D#5": "Ds5", "F#5": "Fs5", A5: "A5" } },
    "cello":            { label: "Cello",           family: "strings",    urls: { C2: "C2", E2: "E2", G2: "G2", C3: "C3", E3: "E3", G3: "G3", C4: "C4", E4: "E4", G4: "G4" } },
    "harp":             { label: "Harp",            family: "strings",    urls: { C3: "C3", E3: "E3", G3: "G3", B3: "B3", D4: "D4", F4: "F4", A4: "A4", C5: "C5" } },
    "marimba":          { label: "Marimba",         family: "percussion", urls: { C3: "C3", "F#3": "Gb3", C4: "C4", "F#4": "Gb4", C5: "C5", "F#5": "Gb5" } },
    "guitar-electric":  { label: "Electric guitar", family: "guitar",     urls: { A3: "A3", C4: "C4", "F#4": "Fs4", A4: "A4", C5: "C5", "D#5": "Ds5", "F#5": "Fs5", A5: "A5", C6: "C6" } },
    "bass-electric":    { label: "Electric bass",   family: "guitar",     urls: { E1: "E1", G1: "G1", "A#1": "As1", "C#2": "Cs2", E2: "E2", G2: "G2", "A#2": "As2", "C#3": "Cs3", E3: "E3" } },
    "electric_piano_1": { label: "Electric piano",  family: "keyboard",   urls: { C3: "C3", "F#3": "Gb3", C4: "C4", "F#4": "Gb4", C5: "C5", "F#5": "Gb5" } },
    "pad_2_warm":       { label: "Synth pad",       family: "synth",      urls: { C2: "C2", "F#2": "Gb2", C3: "C3", "F#3": "Gb3", C4: "C4", "F#4": "Gb4" } },
    "timpani":          { label: "Timpani",         family: "percussion", urls: { C2: "C2", G2: "G2", C3: "C3" } },
  };

  // Each song uses 3 of these layers; every pair has a different family in both genres.
  // Orchestra: Song 1 brass / strings (harp) / woodwind, Song 2 brass / woodwind / strings (cello) (+ timpani accent, the only percussion).
  // Modern Band: woodwind / keyboard / guitar / synth (+ drum bed).
  const GENRES = {
    orchestra: { label: "Orchestra", bpm: 100, reverb: 3.2, wet: 0.35, bed: false,
                 layers: { fire: "trumpet", rain: "harp", co2: "bassoon", sea: "cello" }, accent: "timpani" },
    band:      { label: "Modern Band", bpm: 120, reverb: 1.4, wet: 0.18, bed: true,
                 layers: { fire: "saxophone", rain: "electric_piano_1", co2: "bass-electric", sea: "pad_2_warm" }, accent: "timpani" },
  };

  /** Instrument key for a layer: a Studio layer may carry its own `instrument`, otherwise the genre's choice. */
  function instrumentKey(layer, layerMap) {
    return (typeof layer === "object" && layer.instrument) || layerMap[typeof layer === "object" ? layer.id : layer];
  }

  /** Returns a list of clashes (same family twice) for a song's layers (ids or layer objects) under a genre map. */
  function familyClashes(layers, layerMap) {
    const seen = {}, clashes = [];
    for (const layer of layers) {
      const id = typeof layer === "object" ? layer.id : layer;
      const fam = SAMPLES[instrumentKey(layer, layerMap)].family;
      if (seen[fam]) clashes.push(`${seen[fam]} and ${id} are both ${fam}`); else seen[fam] = id;
    }
    return clashes;
  }

  function makeSampler(key) {
    const s = SAMPLES[key];
    const urls = {};
    for (const [note, file] of Object.entries(s.urls)) urls[note] = `${key}/${file}.mp3`;
    return new Promise(resolve => {
      let done = false;
      const finish = inst => { if (!done) { done = true; resolve(inst); } };
      try {
        const sampler = new Tone.Sampler({ urls, baseUrl: BASE, release: 1.2,
          onload: () => finish({ inst: sampler, fallback: false }),
          onerror: () => finish({ inst: new Tone.PolySynth(Tone.Synth), fallback: true }) });
        setTimeout(() => finish(sampler.loaded ? { inst: sampler, fallback: false } : { inst: new Tone.PolySynth(Tone.Synth), fallback: true }), 15000);
      } catch (e) { finish({ inst: new Tone.PolySynth(Tone.Synth), fallback: true }); }
    });
  }

  class Engine {
    constructor() {
      this.song = null; this.genre = "orchestra"; this.smoothed = true; this.speed = 1;
      this.events = {}; this.chains = {}; this.idx = 0; this.playing = false;
      this.onStep = () => {}; this.onEnd = () => {}; this.repeatId = null;
      this.master = null; this.cache = {}; this.fallbacks = [];
    }

    instrumentFor(layerId) {
      const layer = this.song && this.song.layers.find(l => l.id === layerId);
      return SAMPLES[instrumentKey(layer || layerId, GENRES[this.genre].layers)].label;
    }

    async ensureMaster() {
      if (this.master) return;
      this.limiter = new Tone.Limiter(-1).toDestination();
      this.reverb = new Tone.Reverb({ decay: 3, wet: 0.3 }).connect(this.limiter);
      this.master = new Tone.Gain(0.9).connect(this.reverb);
    }

    /** Load (or reuse) the samplers for the current genre and song, and wire one channel per layer. */
    async prepare(song, genre) {
      await this.ensureMaster();
      this.song = song; this.genre = genre;
      const g = GENRES[genre];
      const clash = familyClashes(song.layers, g.layers);
      if (clash.length) console.warn("EchoSphere instrument family clash:", clash.join("; "));
      this.reverb.decay = g.reverb; this.reverb.wet.value = g.wet;
      Object.values(this.chains).forEach(c => { c.inst.disconnect(); c.filter.dispose(); c.channel.dispose(); });
      this.chains = {}; this.fallbacks = [];

      const keys = song.layers.map(l => instrumentKey(l, g.layers)).concat([g.accent]);
      for (const k of keys) if (!this.cache[k]) this.cache[k] = await makeSampler(k);

      for (const layer of song.layers) {
        const k = instrumentKey(layer, g.layers);
        const { inst, fallback } = this.cache[k];
        if (fallback) this.fallbacks.push(SAMPLES[k].label);
        const filter = new Tone.Filter(6000, "lowpass");
        const channel = new Tone.Channel({ pan: layer.pan || 0, volume: layer.id === "co2" ? -6 : -2 }).connect(this.master);
        inst.disconnect(); inst.chain(filter, channel);
        this.chains[layer.id] = { inst, filter, channel };
      }
      const acc = this.cache[g.accent].inst;
      acc.disconnect();
      this.accentCh = this.accentCh || new Tone.Channel({ volume: -8, pan: 0.3 }).connect(this.master);
      acc.connect(this.accentCh);
      this.accent = acc;

      this.setupBed(g.bed);
      this.recompute();
      Tone.Transport.bpm.value = g.bpm * this.speed;
    }

    setupBed(on) {
      if (this.bed) { this.bed.kick.dispose(); this.bed.hat.dispose(); this.bed.ch.dispose(); this.bed = null; }
      if (!on) return;
      const ch = new Tone.Channel({ volume: -20 }).connect(this.master);
      const kick = new Tone.MembraneSynth({ octaves: 4, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } }).connect(ch);
      const hat = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } }).connect(ch);
      hat.volume.value = -12;
      this.bed = { ch, kick, hat };
    }

    recompute() {
      this.events = {};
      for (const layer of this.song.layers) this.events[layer.id] = EchoMapping.layerNotes(layer, { smoothed: this.smoothed });
    }

    setSmoothed(on) { this.smoothed = on; if (this.song) this.recompute(); }
    setSpeed(x) { this.speed = x; Tone.Transport.bpm.value = GENRES[this.genre].bpm * x; }
    setMute(id, on) { if (this.chains[id]) this.chains[id].channel.mute = on; }
    setSolo(id) { for (const [k, c] of Object.entries(this.chains)) c.channel.solo = (k === id); }

    playStep(i, time) {
      const beat = Tone.Time("4n").toSeconds();
      for (const layer of this.song.layers) {
        const e = this.events[layer.id][i];
        const c = this.chains[layer.id];
        if (!e || e.midi === null || e.hold) continue;
        c.filter.frequency.setValueAtTime(e.cutoff, time);
        const dur = layer.sustain ? beat * e.durSteps * 0.98 : layer.legato ? beat * 1.1 : beat * 0.7;
        c.inst.triggerAttackRelease(e.note, dur, time, e.vel);
        if (e.accent && !c.channel.mute && (!this.anySolo() || c.channel.solo)) this.accent.triggerAttackRelease("C2", beat, time, 0.7);
      }
      if (this.bed) {
        this.bed.kick.triggerAttackRelease("C1", "8n", time, 0.6);
        this.bed.hat.triggerAttackRelease("16n", time + beat / 2, 0.4);
      }
    }
    anySolo() { return Object.values(this.chains).some(c => c.channel.solo); }

    async play(fromIdx) {
      await Tone.start();
      this.stopTransport();
      this.idx = fromIdx ?? this.idx;
      if (this.idx >= this.song.steps.length) this.idx = 0;
      this.playing = true;
      this.repeatId = Tone.Transport.scheduleRepeat(time => {
        const i = this.idx;
        if (i >= this.song.steps.length) {
          Tone.Draw.schedule(() => { this.pause(); this.idx = 0; this.onEnd(); }, time);
          return;
        }
        this.playStep(i, time);
        Tone.Draw.schedule(() => this.onStep(i), time);
        this.idx = i + 1;
      }, "4n", "+0.05");
      Tone.Transport.start();
    }

    stopTransport() {
      if (this.repeatId !== null) { Tone.Transport.clear(this.repeatId); this.repeatId = null; }
      Tone.Transport.stop(); Tone.Transport.cancel();
      Object.values(this.chains).forEach(c => c.inst.releaseAll && c.inst.releaseAll());
    }
    pause() { this.playing = false; this.stopTransport(); }
    stop() { this.pause(); this.idx = 0; }

    /** Play one note on a layer's instrument (used by the guide and explore mode). */
    preview(layerId, note, dur) {
      const c = this.chains[layerId] || Object.values(this.chains)[0];
      if (c) { c.filter.frequency.value = 6000; c.inst.triggerAttackRelease(note, dur || "2n", undefined, 0.8); }
    }
  }

  window.EchoAudio = { Engine, GENRES, SAMPLES, familyClashes, instrumentKey };
})();
