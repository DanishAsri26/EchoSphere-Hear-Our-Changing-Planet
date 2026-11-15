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

  /** Plays low / middle / high on the song's first instrument, then explains this song's layers. ~15 s. */
  async function playGuide(engine, song, live) {
    const g = EchoAudio.GENRES[engine.genre];
    const first = song.layers[0].id;
    await say("This is low.", live);   engine.preview(first, "C3", "2n"); await wait(1100);
    await say("This is middle.", live); engine.preview(first, "C4", "2n"); await wait(1100);
    await say("This is high.", live);   engine.preview(first, "C5", "2n"); await wait(1100);
    const unit = { week: "one week", month: "one month", slice: "one slice of the picture, from west to east" }[song.stepUnit] || "one step";
    await say(`Higher notes mean more. In ${song.title}, each note is ${unit}.`, live);
    // per layer: its instrument, plus the special sounds this song uses
    const parts = song.layers.map(l => `${l.name}: ${engine.instrumentFor(l.id)}` +
      (l.restBelow !== undefined ? ", silence means almost none" : "") + (l.intensity ? ", a drum hit means very intense" : "")).join(". ");
    await say(`In ${g.label}, ${parts}.`, live);
  }

  window.EchoGuide = { playGuide, say };
})();
