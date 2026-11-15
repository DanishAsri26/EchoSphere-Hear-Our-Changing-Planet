/* EchoSphere mapping: data value -> musical note (Design.md §5.2).
   Code written with AI assistance (Claude, Anthropic). */
(function () {
  "use strict";

  // Pitch ranges (MIDI note numbers) for each register.
  const REGISTERS = {
    high:   [60, 84], // C4–C6
    mid:    [48, 72], // C3–C5
    lowmid: [43, 67], // G2–G4
    low:    [36, 48], // C2–C3
  };
  const PENTATONIC = [0, 2, 4, 7, 9]; // C major pentatonic
  const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  function midiToName(m) { return NAMES[m % 12] + (Math.floor(m / 12) - 1); }

  function scaleNotes(lo, hi) {
    const out = [];
    for (let m = lo; m <= hi; m++) if (PENTATONIC.includes(m % 12)) out.push(m);
    return out;
  }

  /** Agreed clean-up rule: a change smaller than one legend step is merged with the previous value. */
  function smooth(values, step) {
    let last = null;
    return values.map(v => {
      if (v === null || v === undefined) return null;
      if (last === null || Math.abs(v - last) >= step) last = v;
      return last;
    });
  }

  function norm(values) {
    const xs = values.filter(v => v !== null && v !== undefined);
    const lo = Math.min(...xs), hi = Math.max(...xs);
    return v => (v === null || v === undefined) ? null : (hi === lo ? 0.5 : (v - lo) / (hi - lo));
  }

  /**
   * Turn one layer into a list of note events, one per step.
   * Each event: {value, n (0-1), midi|null, note|null, vel, cutoff, accent, hold, durSteps}
   */
  function layerNotes(layer, opts) {
    const smoothed = opts && opts.smoothed !== false;
    const values = smoothed ? smooth(layer.values, layer.legendStep || 0) : layer.values.slice();
    const toN = norm(values);
    const [lo, hi] = REGISTERS[layer.register] || REGISTERS.mid;
    const scale = scaleNotes(lo, hi);
    const intN = layer.intensity ? norm(layer.intensity) : null;

    const ev = values.map((v, i) => {
      const n = toN(v);
      let midi = n === null ? null : scale[Math.round(n * (scale.length - 1))];
      if (layer.restBelow !== undefined && v !== null && v < layer.restBelow) midi = null; // drought = silence
      const loud = intN ? intN(layer.intensity[i]) : n;
      return {
        value: layer.values[i],
        played: v,
        n: n,
        midi: midi,
        note: midi === null ? null : midiToName(midi),
        vel: midi === null ? 0 : 0.35 + 0.6 * (loud ?? 0.5),
        cutoff: 500 + 6000 * (loud ?? 0.5),
        accent: !!(layer.intensity && layer.intensity[i] >= 10), // very intense burning
        hold: false,
        durSteps: 1,
      };
    });

    // Sustained layers (CO2 drone): only re-trigger when the note changes; hold until the next change.
    if (layer.sustain) {
      for (let i = 0; i < ev.length; i++) {
        if (i > 0 && ev[i].midi === ev[i - 1].midi) { ev[i].hold = true; continue; }
        let j = i + 1;
        while (j < ev.length && ev[j].midi === ev[i].midi) j++;
        ev[i].durSteps = j - i;
      }
    }
    return ev;
  }

  window.EchoMapping = { layerNotes, smooth, midiToName, REGISTERS };
})();
