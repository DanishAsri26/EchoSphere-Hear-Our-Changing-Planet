# EchoSphere: Hear Our Changing Planet

NASA Space Apps Challenge 2026, challenge "The Earth Information Jukebox". Local event: Sarawak Space Challenge.
A static web jukebox that turns NASA Earth data (El Niño 2015) into music, built for blind and low-vision listeners first.

## Read first
- `task.md`: shared to-do list and decisions log (source of truth; update it when you finish a task)
- `Requirement.md`: what the app must do (FR/NFR IDs)
- `Design.md`: layout, sound mapping, visual style

## Deadlines (MYT, Sun 15 Nov 2026)
Feature freeze 1:30 PM · video uploaded 4:00 PM · submit 7:30 PM · hard deadline 8:59 PM.
Prefer small, safe changes. Never break a working feature close to freeze.

## Structure
- `web/` is the app (deployed to GitHub Pages). Plain HTML/CSS/JS, no build step, Tone.js in `web/vendor/`.
  - `js/app.js` UI, state, keyboard, ARIA live announcements
  - `js/audio.js` Tone.js samplers, genres, instrument families, mute/solo
  - `js/mapping.js` value → pentatonic note, loudness, rests, smoothing
  - `js/chart.js` timeline, `js/guide.js` how-to-listen, `js/export.js` WAV export
  - `js/studio.js` Studio (source picker, layers, instruments, save/share), `js/live.js` NASA EONET + POWER live events, `js/snapshot.js` picture tool
  - `data/songs.json` (+ `songs.js` wrapper) albums 1–2; `data/event_songs.*` albums 3–5; `data/diatom_song.*` album 6; `data/maps.js` + `maps/` map frames
  - `audio/` recorded samples; credits in `audio/CREDITS.md`
- `pipeline/` Python scripts that decode NASA images/files into JSON (run offline; on Windows use `python -X utf8`)
- `raw/` original downloads (large `.exr`/`.mp4` are not committed)
- Run locally: `run.bat` (local server; opening index.html directly breaks sample loading)

## Rules
- No invented data. Every value must trace to a NASA file; keep source, units and method in the JSON.
- Instrument family rule: within one song, no two data layers use instruments from the same family (`SAMPLES[...].family` in `audio.js`; `familyClashes()` checks it).
- Accessibility: keyboard for everything, labelled controls, announce state changes, no autoplay, WCAG AA contrast, respect reduced motion.
- No NASA logos, flags or mission insignia. No AI-generated images.
- AI use must be disclosed: code files written with AI keep the "Code written with AI assistance" header comment.
- Another AI session (Claude in the claude.ai app) also edits this folder. Don't rewrite files wholesale without need; re-read a file before editing it.
