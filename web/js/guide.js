/* EchoSphere "How to listen" guide: reference tones + the whole guide read aloud (Web Speech API).
   Code written with AI assistance (Claude, Anthropic). */
(function () {
  "use strict";
  const wait = ms => new Promise(r => setTimeout(r, ms));

  let stopped = false;
  function say(text, live) {
    if (live) live(text);
    return new Promise(resolve => {
      if (!("speechSynthesis" in window)) return setTimeout(resolve, 1600 + text.length * 40);
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US"; u.rate = 1.0;
      u.onend = resolve; u.onerror = resolve;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
      setTimeout(resolve, 3000 + text.length * 90); // safety, long enough for long sentences
    });
  }

  /**
   * Reads the whole How to listen box aloud. items = the box's lines as plain text:
   * [album line, one line per layer..., keys line]. In each layer line, after the instrument's name is said, that instrument plays one note.
   */
  async function playGuide(engine, song, live, items) {
    stopped = false;
    const first = song.layers[0].id;
    await say("This is low.", live);   engine.preview(first, "C3", "2n"); await wait(1100);
    if (stopped) return;
    await say("This is middle.", live); engine.preview(first, "C4", "2n"); await wait(1100);
    if (stopped) return;
    await say("This is high.", live);   engine.preview(first, "C5", "2n"); await wait(1100);
    const lines = items && items.length ? items : [`Higher notes mean more. ${song.title}.`];
    for (let k = 0; k < lines.length; k++) {
      if (stopped) return;
      const layer = k >= 1 && k <= song.layers.length ? song.layers[k - 1] : null; // lines 1..n describe the layers
      if (!layer) { await say(lines[k], live); continue; }
      // say "Wildfires: Trumpet", play one note on that instrument, then read the rest of the line
      const head = `${layer.name}: ${engine.instrumentFor(layer.id)}`, at = lines[k].indexOf(head);
      const rest = at >= 0 ? lines[k].slice(at + head.length).replace(/^[\s,.;:]+/, "") : lines[k];
      await say(at >= 0 ? head : lines[k], live);
      if (stopped) return;
      engine.preview(layer.id, "C4", "2n"); await wait(1100);
      if (rest && at >= 0) await say(rest, live);
    }
  }
  function stop() { stopped = true; if ("speechSynthesis" in window) speechSynthesis.cancel(); }

  window.EchoGuide = { playGuide, say, stop };
})();
