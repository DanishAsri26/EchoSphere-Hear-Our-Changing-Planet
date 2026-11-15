# EchoSphere: Hear Our Changing Planet

**NASA Space Apps Challenge 2026 · Challenge: "The Earth Information Jukebox" · Local event: Sarawak Space Challenge**
Team **EchoSphere**: Danish (solo human member) working with AI assistants (see [Use of AI](#use-of-ai)).

▶ **Try it:** https://danishasri26.github.io/EchoSphere-Hear-Our-Changing-Planet/
(No login. Headphones recommended. Sound starts only when you press Play.)

---

## What it is
NASA's Earth Information Center (EIC) visualizations are silent pictures. People who are blind or have low vision, and anyone listening rather than looking, miss what they show.

EchoSphere is a web jukebox that turns NASA Earth data and visualizations into music. Every album is a story about our planet. Each Earth topic (fire, rain, CO₂, sea level, plankton…) is played by its own instrument, so you can hear how parts of the Earth system move together.

> *"What burns locally echoes globally."*

## What you can do
| Feature | What it does |
|---|---|
| **Albums** | Ready-made songs from NASA data: *Kuching 2015* (Borneo fires, rain, CO₂ during El Niño), *The Whole Planet 2015* (global fires, CO₂, sea level), three event albums (*Pacific Drought 2015*, *South America Floods 2015*, *Black Summer 2019*) and *The Ocean Breathes: Diatoms 1998–2012* (solo layer) |
| **Two genres** | Orchestra or Modern Band, switchable while playing |
| **Mixer** | Mute or solo each layer to hear one topic at a time |
| **How to listen** | A short guide per album: low, middle and high reference tones, what each instrument means, which ear it plays in |
| **Studio** | Build your own song: choose 1–4 layers, a genre and an instrument per layer |
| **Live events** | Pick a NASA EONET natural event (wildfire, storm, volcano…) and hear the NASA POWER weather at that place, 8 weeks before and after |
| **Use picture/frame** | Upload any EIC snapshot or map, mark its colour legend (or use a simple colour rule), and hear it from west to east |
| **Save and share** | Save any song as a WAV file; share Studio songs as a link; *My songs* keeps your Studio songs in this browser |
| **Explore mode** | Step through time with the arrow keys; the screen reader speaks the date and every value |

## How it works
1. **Get the numbers behind the picture.** Where NASA publishes the values (NASA POWER, the CO₂ table, the sea level record) we use them directly. Where only a visualization exists (wildfire emissions, diatoms), we read its **colour legend** and turn each pixel's colour back into a value (`pipeline/invert.py`). We never turn raw colour straight into sound.
2. **Clean up.** A change smaller than one legend step is merged with the previous value, so compression noise is not played as music. A *Raw / Smoothed* switch lets you hear both.
3. **Values become notes.** Higher value = higher pitch, snapped to a pentatonic scale so it stays pleasant. Louder and brighter = more intense. Missing data = silence (for example, no rain in a drought week).
4. **One instrument per topic.** Each layer has its own instrument, pitch range and ear (stereo position). Within one song, no two layers use the same instrument family, so they are easy to tell apart.

## Accessibility
- Every control works by keyboard; all buttons have text labels.
- Changes are announced to screen readers (ARIA live region).
- No autoplay: sound never talks over a screen reader until you press Play.
- High-contrast colours (WCAG AA) and support for "reduce motion".

## Honest limits
- Each layer is scaled to its own range within a song, so pitch shows **relative** change, not absolute size.
- Values decoded from pictures are approximate (colour compression, legend steps). Wildfire values of 20+ gC/m²/week are clipped by NASA's legend and shown as "20+".
- The diatom video has no dates; months were assigned from its 15 yearly bloom cycles (approximate, about ±2 months: in that mapping the yearly peak drifts from November to August). Our global average mainly shows the seasonal bloom; NASA's reported long-term decline (>1 %/yr, strongest regionally) is cited, not claimed as audible.
- Event songs play the **weather at the event's place**, not the event itself.
- Not yet tested with blind or low-vision listeners. That is our next step.

## NASA data used
| Data | Used for |
|---|---|
| NASA SVS 5012, *Weekly carbon emissions from fires* (decoded from frames + colour bar) | Wildfire layers |
| NASA SVS 5024, AIRS CO₂ visualization + NASA's frame/date/value table | CO₂ layers |
| NASA GSFC Global Mean Sea Level v5.1 (via NASA STEM spreadsheet) | Sea level layer |
| NASA POWER daily point API | Kuching rain; weather for event albums and live events |
| NASA EONET (Earth Observatory Natural Event Tracker) | Event albums and live events |
| NASA SVS 12009, *Earth's Oceans Show Decline In Microscopic Plant Life* (NASA Ocean Biogeochemical Model; decoded from video + colour bar) | Diatom album |
| NASA Earth Information Center visualizations | Inspiration, picture tool |

## Other tools and resources
- [Tone.js](https://tonejs.github.io/) (MIT): audio engine in the browser
- [Tesseract.js](https://github.com/naptha/tesseract.js) 5.1.1 with English data (Apache-2.0): reads legend numbers in the picture tool, in the browser. Files and licence: `web/vendor/tesseract/`
- Instrument samples: [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) (CC BY 3.0) and FluidR3_GM via [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) (MIT / CC BY 3.0). Full list: `web/audio/CREDITS.md`
- Python, NumPy, Pillow, FFmpeg (data pipeline); GitHub Pages (hosting)
- Research on sonification and accessibility (e.g. Walker & Mauney 2010 on pitch polarity; WebAIM screen reader and low-vision surveys)

## Run it yourself
- Online: the link at the top.
- Locally (Windows): double-click `run.bat`, which starts a small local server and opens the app. Opening `index.html` directly won't load the instrument samples.
- Rebuild data (Windows: add `-X utf8`): `python pipeline/build_songs.py`, `python pipeline/build_event_songs.py` (`--refresh` to re-download from NASA) and `python pipeline/diatoms.py` (needs the SVS 12009 video in `raw/plaktons/`; numpy, Pillow, SciPy, FFmpeg).

## Project structure
```
web/            the app (published to GitHub Pages)
  js/           app, audio engine, mapping, chart, studio, live events, picture tool, export
  data/         song data (JSON, with source URL, units and method in each file)
  audio/        recorded instrument samples + CREDITS.md
pipeline/       Python scripts that turn NASA files into song data
raw/            original NASA downloads (large videos not committed)
```

## Use of AI
EchoSphere was built by one human team member working with **Claude (Anthropic)** as an AI assistant, in the Claude app and in Claude Code.
- **The idea is the team member's own:** a jukebox where linked Earth topics play together, colour legends turned back into values, a choice of genre and instruments, then play and save.
- **AI helped with:** literature research, finding data sources, writing code (Python data pipeline; HTML/CSS/JavaScript app), and drafting text (this README, project descriptions). Code files written with AI carry the header comment *"Code written with AI assistance (Claude, Anthropic)."*
- **Not AI-generated:** all data values come from NASA files. All music is generated live in your browser by our code from that data, using recorded instrument samples; **no AI audio model** is used. No images inside the app are AI-generated. No NASA logos or insignia are used in our designs.
- **Demo video (AI-generated, watermarked):** the 30-second demo's animation was made with code written by Claude, and its voice-over is AI-generated with Kokoro TTS (open-source text-to-speech). The video carries a visible "AI-GENERATED" label, and this is also stated in its credits line, YouTube description and file metadata. Its soundtrack is EchoSphere's own Kuching 2015 song, made from NASA data; the map is a NASA SVS frame.
