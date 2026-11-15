/* EchoSphere "How to listen" guide: reference tones + spoken labels (Web Speech API).
   Code written with AI assistance (Claude, Anthropic). */
(function () {
  "use strict";
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function say(text, live) {
    if (live) live(text);
    return new Promise(resolve => {
      if (!("speechSynthesis" in window)) return setTimeout(resolve, 1600);
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US"; u.rate = 1.0;
      u.onend = resolve; u.onerror = resolve;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
      setTimeout(resolve, 6000); // safety
    });
  }

  /** Plays low / middle / high on the fire instrument, then explains the rules. ~15 s. */
  async function playGuide(engine, song, live) {
    const g = EchoAudio.GENRES[engine.genre];
    const first = song.layers[0].id;
    await say("This is low.", live);   engine.preview(first, "C3", "2n"); await wait(1100);
    await say("This is middle.", live); engine.preview(first, "C4", "2n"); await wait(1100);
    await say("This is high.", live);   engine.preview(first, "C5", "2n"); await wait(1100);
    await say("Higher notes mean more. More fire, more rain, more carbon dioxide, higher seas. Silence in the rain means drought.", live);
    const parts = song.layers.map(l => `${l.name}: ${engine.instrumentFor(l.id)}`).join(". ");
    await say(`In ${g.label}, ${parts}.`, live);
  }

  window.EchoGuide = { playGuide, say };
})();
