/* EchoSphere "Save as WAV": records the track in real time, then converts it to a 16-bit WAV.
   Code written with AI assistance (Claude, Anthropic). */
(function () {
  "use strict";

  function encodeWav(buffer) {
    const ch = Math.min(2, buffer.numberOfChannels), rate = buffer.sampleRate, len = buffer.length;
    const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); data.setUint32(4, 36 + len * ch * 2, true); w(8, "WAVE"); w(12, "fmt ");
    data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
    data.setUint32(24, rate, true); data.setUint32(28, rate * ch * 2, true); data.setUint16(32, ch * 2, true);
    data.setUint16(34, 16, true); w(36, "data"); data.setUint32(40, len * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
    let o = 44;
    for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      data.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
    }
    return new Blob([data], { type: "audio/wav" });
  }

  /** Plays the song from the start while recording; resolves when the WAV has downloaded. */
  async function saveWav(engine, filename, onStatus) {
    if (!window.MediaRecorder) throw new Error("This browser cannot record audio.");
    const rec = new Tone.Recorder();
    Tone.Destination.connect(rec);
    rec.start();
    const prevEnd = engine.onEnd;
    await new Promise(resolve => {
      engine.onEnd = () => { prevEnd(); resolve(); };
      engine.play(0);
      onStatus && onStatus("Recording… the track is playing.");
    });
    engine.onEnd = prevEnd;
    await new Promise(r => setTimeout(r, 2500)); // let the reverb tail ring out
    const blob = await rec.stop();
    Tone.Destination.disconnect(rec); rec.dispose();
    onStatus && onStatus("Converting to WAV…");
    const audio = await Tone.getContext().rawContext.decodeAudioData(await blob.arrayBuffer());
    const wav = encodeWav(audio);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(wav); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    onStatus && onStatus(`Saved ${filename}`);
  }

  window.EchoExport = { saveWav, encodeWav };
})();
