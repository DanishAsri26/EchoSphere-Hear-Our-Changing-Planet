# EchoSphere: Design
**Version:** 1.0 · 15 Nov 2026, 1:10 AM MYT · Companion to `Requirement.md`, tracked in `task.md`

---

## 1. Design idea: "A jukebox under the night sky"
The app looks like a glowing jukebox floating over a dark Earth at night. Each NASA picture is an **album cover**; pressing Play spins it like a CD while the data plays as music. The feeling should be **beautiful first, scientific underneath**: a judge should want to press Play, and then discover that every note is real NASA data.

Design principles:
1. **Sound first.** Everything a sighted user sees is also available by sound and screen reader.
2. **One glance, one story.** Big date, big cover, one clear Play button.
3. **Honest by design.** Units, sources and limits are one click away, never hidden.
4. **Calm motion.** Gentle animation that switches off when the user prefers reduced motion.

---

## 2. Visual identity

### 2.1 Colours
| Role | Colour | Hex | Use |
|---|---|---|---|
| Background | Deep night | `#0B1020` | Page background |
| Surface | Midnight panel | `#141B33` | Cards, mixer, drawers |
| Surface raised | Indigo glass | `#1D2647` (80% opacity, blur) | Player stage |
| Text | Starlight | `#F2F4FF` | Main text (contrast 17:1) |
| Muted text | Moon grey | `#A9B0D0` | Labels (contrast 8:1) |
| Accent | Jukebox amber | `#FFB547` | Play button, focus ring, active genre |
| Accent 2 | Neon magenta | `#FF5EA8` | Highlights, "now playing" glow |

**Layer colours** (also used for the chart lines and mixer strips; each layer also has an icon and a name, so colour is never the only cue):

| Layer | Colour | Hex | Icon |
|---|---|---|---|
| 🔥 Wildfires | Ember orange | `#FF7A3D` | flame |
| 🌧️ Rain | Rain blue | `#4FC3F7` | raindrop |
| 🏭 CO₂ | Haze violet | `#B39DDB` | cloud |
| 🌊 Sea level | Tide teal | `#26C6DA` | wave |

### 2.2 Typography
- Headings: **Space Grotesk** (700), letter-spacing −0.5px. Big date display: Space Grotesk 64px.
- Body and UI: **Inter** (400/600), 16px base, 1.5 line height.
- Fallback: `system-ui, sans-serif`. Fonts loaded from Google Fonts with `display=swap`.

### 2.3 Visual details
- Soft starfield background (CSS radial gradients, no images) with a faint Earth-glow arc at the bottom.
- Cards: 20px radius, 1px border `rgba(255,255,255,0.08)`, soft shadow, amber glow on hover/focus.
- Cover art shown as a **CD**: circular mask with a centre hole; spins at 8 s per turn while playing (paused when `prefers-reduced-motion`).
- Equaliser bars next to each layer name pulse with that layer's current volume.
- No NASA logos, flags or mission insignia anywhere in our design.

---

## 3. Screens and layout

### 3.1 Home: "The Jukebox"
Updated 15 Nov: the **Studio** card comes first (full width) with *Build* and *Use picture/frame*; then six album cards, each with a data-type badge, layer chips with icons, *Listen* and its own *How to listen*. A legend line explains the badges. Original sketch:
```
┌──────────────────────────────────────────────────────────────────┐
│  EchoSphere                         How to listen ▸   Data & credits│
│                                                                  │
│        Hear Our Changing Planet                                  │
│        NASA Earth data, played as music. El Niño, 2015.          │
│                                                                  │
│   ┌───────────────────────┐      ┌───────────────────────┐       │
│   │   (( CD cover ))      │      │   (( CD cover ))      │       │
│   │  Kuching, 2015        │      │  The Whole Planet,2015│       │
│   │  Borneo · Jun–Dec 2015│      │  Global · 2014–2016   │       │
│   │  🔥 🌧️ 🏭              │      │  🔥 🏭 🌊              │       │
│   │  [ ▶ Play ]           │      │  [ ▶ Play ]           │       │
│   └───────────────────────┘      └───────────────────────┘       │
│                                                                  │
│   "What burns locally echoes globally."                          │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Player: "Now Playing"
```
┌──────────────────────────────────────────────────────────────────┐
│ ◂ Back to jukebox                 Genre: [Orchestra|Modern Band] │
│                                                                  │
│  ┌──────────────┐    SEPTEMBER 2015                              │
│  │  (( spinning │    Fires peak over Borneo                      │
│  │     CD ))    │                                                │
│  └──────────────┘    ┌──────────────────────────────────────┐    │
│                      │ 🔥 ────╱╲──────╲___                   │    │
│                      │ 🌧️ ─╲__ __╱‾‾╲_╱‾‾                    │    │
│                      │ 🏭 ─────────────────                  │    │
│                      │            ▲ playhead                 │    │
│                      └──────────────────────────────────────┘    │
│                      Jun   Jul   Aug   Sep   Oct   Nov   Dec     │
│                                                                  │
│      ⟲   [  ▶  ]   ⏹        Speed 1×   Raw ○ ● Smoothed           │
│                                                                  │
│  MIXER                                                           │
│  🔥 Wildfires  Trumpet ▾   ▮▮▮▯   [M] [S]   12.1 gC/m²/wk        │
│  🌧️ Rain       Marimba ▾   ▮▯▯▯   [M] [S]    1.9 mm/day          │
│  🏭 CO₂        Tuba    ▾   ▮▮▯▯   [M] [S]    401 ppm             │
│                                                                  │
│                         [ ⬇ Save as WAV ]                        │
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 "How to listen" (modal, 15 s), one per album
Opened from each album card's *How to listen* button, or `H` / the top-bar button in the player. The text is built from **that song's layers**: place and what one note is (a week, a month, a quarter, or a slice of a picture), then one line per layer (instrument, headphone side, what high and low mean), then Mute/Solo keys. *Read the guide aloud* plays low, middle and high on the song's first instrument, then reads **every line of the box**; in each layer line it says the name and instrument ("Wildfires: Trumpet"), plays **one note** on that instrument, then reads the rest. Closing the box (Close or Escape) stops the reading. On the home page, `H` shows the general rules.

### 3.4 "Data & credits" (side drawer)
Per layer: what it measures, units, NASA source with link, method (e.g. "colours decoded from the legend, calibrated to exact frames"), and limits (clipped at 20+, CO₂ uses NASA's monthly value, air quality not included). Then the AI-usage statement and open-source credits.

### 3.5 Map view (added 15 Nov, 1:45 AM, Conductor's request)
Inspired by NASA's Caldwell 73 sonification (SVS 13786), where the picture stays on screen and the parts being sounded light up:
- The player shows the **real NASA fire map** (SVS 5012) for the current step, cropped to the song's region (Borneo window for Song 1, the world for Song 2), cross-fading every step.
- **Pulsing magenta rings** mark the strongest fire areas (≥ 8 g C/m²/week clusters, found in `pipeline/map_frames.py`) on every beat. Rings disappear when the fire layer is muted.
- A **Kuching pin** shows home on both maps. Song 1 shows NASA's colour legend; Song 2's frames already include it.
- The line graph becomes a slim **timeline strip** under the map.

### 3.7 Studio (added 15 Nov)
- **Source picker** first (albums · your event · your snapshots), then only that source's layers: pick 1–4, a genre, and an instrument per layer (only the chosen genre's instruments; families must differ).
- **Start from a real event:** event type + year → NASA EONET list (filter by name) → NASA POWER weather becomes a new source.
- **My songs** (this browser) and **Copy link** (`#song=` recipe: layers, genre, instruments; never data).
- Back from a Studio song returns to the Studio.

### 3.8 Picture tool "Use picture/frame" (added 15 Nov)
- Upload 1–4 pictures; each becomes one layer of the "Your snapshots" source.
- Step 1 *How should the colours be read?*: the picture's colour legend (then mark it, pink box, and type low/high values and units) or a no-legend rule (blue → green → yellow → red, darker, or lighter = higher; relative 0–100, black/grey/white = none). No legend box is shown until one is marked.
- **Map area** (cyan box): only that part is read and shown in the player; everything outside is dimmed. *What do the colours show?* gives the pitch note ("redder colour = more rain").
- In the player the picture (cropped to the area) replaces the map, with a **pink band** on the slice being played; the chart reads West → East. Saved pictures can be **edited** without uploading again.
- **🔎 Find legend automatically** (task 2.31): finds the colour bar (pink box) and sets a map area without the legend; then reads the numbers, units and title with Tesseract.js in the browser (downloads ~7 MB once; the picture is not uploaded). Fills low/high, units, *What do the colours show?* and the new **Logarithmic legend** tick; the status line (and screen reader) says what was found, what was unclear (left empty) and to check before *Add as layer*. Nothing is saved automatically.

### 3.9 Data-type labels (added 15 Nov)
Each layer has `sourceKind`: 🎨 decoded from a NASA visualization · 📄 NASA values behind a visualization · 📈 NASA data, no visualization · 🖼️ decoded from your picture. Shown as an album badge, chip icons, in the Studio list and in the drawer.

### 3.6 Responsive
- ≥ 1024 px: layout above.
- < 1024 px: cover on top, chart below, mixer as a stacked list; genre toggle becomes a full-width segmented control.

---

## 4. Accessibility design
| Feature | Design |
|---|---|
| Keyboard | `Space` play/pause · `R` restart · `G` switch genre · `1`–`4` mute layer · `Shift+1`–`4` solo · `H` how to listen · `←/→` step in explore mode |
| Screen reader | Real `<button>` elements with labels; an `aria-live="polite"` region announces "Playing Kuching 2015, Orchestra", the month at each new month, and "Paused at October 2015". |
| Chart | Decorative for screen readers (`aria-hidden`), with a data table alternative in the Data drawer. |
| Focus | 3px amber focus ring on every control. |
| Motion | CD spin and equaliser animations stop under `prefers-reduced-motion`. |
| Contrast | All text ≥ 4.5:1 on its background. |

---

## 5. Sound design

### 5.1 Two layers of sound
- **Data layer** (carries meaning): one instrument per Earth layer. Pitch, loudness and brightness come from the data.
- **Music layer** (aesthetic only, declared in the app): key, tempo, reverb and, in Modern Band, a soft drum groove. It carries **no data**.

### 5.2 Mapping rules
| Rule | Detail |
|---|---|
| Value → pitch | Each layer's values are scaled from the song's min to max and snapped to the **C major pentatonic** scale within that layer's register. Higher value = higher note. |
| Brightness | A low-pass filter opens as the value rises (brighter = more). |
| Silence | Missing data = rest. Rain below 1 mm/day = rest, so drought is heard as silence. |
| Clean-up | Smoothed mode merges changes smaller than one legend step: fires 2.5 gC/m²/week (colorbar tick), rain 1 mm/day, CO₂ 1 ppm, sea level 1 mm. Raw mode plays every value. |
| Clipping | Fire values at 20+ trigger a percussion accent ("off the scale"). |
| Time | One data step per beat. Song 1: 31 weekly steps; Song 2: 36 monthly; albums 3–5: 17 weekly; album 6: 60 quarterly; pictures: 32 slices west → east. About 10–36 s per track at 1× speed. |

### 5.3 Instruments per layer (recorded samples)
Instruments use **recorded samples** played with Tone.js `Sampler` (it re-pitches a few recorded notes to cover the range). Only the notes we need are copied into `web/audio/`, so the app stays small and works without outside servers.

As built (15 Nov; `GENRES` in `audio.js`). Within one song no two layers share an instrument family.

| Layer | Register | Pan | Orchestra | Modern Band |
|---|---|---|---|---|
| 🔥 Wildfires | High (C4–C6) | Right 30% | Trumpet (+ timpani accent at 10+ gC/m²/week) | Saxophone (+ timpani accent) |
| 🌧️ Rain | Middle (C3–C5) | Left 30% | Harp | Electric piano |
| 🏭 CO₂ | Low (C2–C3), sustained | Centre | Bassoon | Electric bass |
| 🌊 Sea level | Low-mid (G2–G4), legato | Left 15% | Cello | Synth pad |
| 🌡️ Temperature | High | Right 30% | Trumpet | Electric guitar |
| 💧 Humidity | Low-mid, legato | Left 15% | Bassoon | Synth pad |
| 🌬️ Wind | Low | Right 15% | Marimba | Saxophone |
| 🌿 Diatoms | Low-mid, legato | Centre | Cello | Synth pad |

Studio instrument lists per genre: Orchestra = trumpet, tuba, bassoon, harp, cello, marimba; Modern Band = saxophone, electric piano, electric guitar, electric bass, synth pad (four families each).

**Sample sources (all free, credited in the app and README):**
| Source | Licence | Used for |
|---|---|---|
| tonejs-instruments (nbrosowsky), samples from public-domain sources | Samples CC BY 3.0, code MIT | Trumpet, tuba, cello, xylophone, electric guitar, electric bass, piano |
| FluidR3_GM soundfont, pre-rendered by gleitz/midi-js-soundfonts | Fluid R3 released under MIT by its author; the pre-rendered set is listed as CC BY 3.0 | Marimba, electric piano, synth pad, percussion accents |
| VSCO 2 Community Edition (Versilian Studios), backup | CC0 (public domain) | Any orchestral instrument missing above |

If a sample fails to load, the layer falls back to a built-in Tone.js synth voice, so playback never breaks.

Genre extras (music layer): Orchestra, 100 BPM with hall reverb; Modern Band, 120 BPM with a quiet kick + hi-hat bed.

---

## 6. Architecture (frontend to backend)
There is **no server**. The "backend" is an offline Python pipeline that turns NASA files into small JSON files, which the static website plays.

```
 NASA files (raw/)                 Offline pipeline (Python)            Static web app (GitHub Pages)
 ───────────────────               ─────────────────────────            ─────────────────────────────
 SVS 5012 EXR + video   ──►  fires_borneo.py / fires_global.py ──┐
 SVS 5024 PNG + CSV     ──►  co2_borneo.py                        ├─►  build_songs.py ──► web/data/songs.json
 NASA POWER JSON        ──►  (weekly means)                       │                         │
 NASA GMSL spreadsheet  ──►  (monthly means)                     ─┘                         ▼
                                                                         index.html + style.css + js/
                                                                         ├─ app.js       (UI, state, routing)
                                                                         ├─ audio.js     (Tone.js engine)
                                                                         ├─ mapping.js   (value → note rules)
                                                                         ├─ chart.js     (SVG timeline)
                                                                         ├─ guide.js     (How to listen, speech)
                                                                         └─ export.js    (record → WAV)
 NASA EONET + POWER     ──►  build_event_songs.py ──► web/data/event_songs.json (albums 3–5)
 SVS 12009 video + bar  ──►  diatoms.py           ──► web/data/diatom_song.json (album 6)
 In the browser: studio.js (Studio, save/share), live.js (EONET + POWER live), snapshot.js (picture tool)
```

### 6.1 Song data format (`web/data/songs.json`)
```json
{
  "songs": [{
    "id": "kuching-2015",
    "title": "Kuching, 2015",
    "place": "Borneo window centred on Sarawak",
    "cover": "assets/cover-kuching.jpg",
    "steps": ["2015-06-01", "2015-06-08", "..."],
    "captions": {"2015-09-07": "Fires peak over Borneo"},
    "layers": [{
      "id": "fire",
      "name": "Wildfires",
      "units": "% of window burning",
      "values": [0.99, 1.02, "..."],
      "extra": {"intensity": [0.98, 0.92, "..."], "clipped": [false, "..."]},
      "legendStep": 2.5,
      "register": "high",
      "source": {"name": "NASA SVS 5012", "url": "https://svs.gsfc.nasa.gov/5012"},
      "notes": "Dates from the video's month labels; calibrated to EXR frames."
    }]
  }]
}
```
`build_songs.py` reads the files in `data/` and writes this single file, so the app needs one fetch.
Added later: `event_songs.js` and `diatom_song.js` push more songs into the same list. Extra fields: `sourceKind` (data-type label), `digits` (decimals to show), `stepUnit` (`week`, `month`, `quarter`, `slice`), song-level `intro` and `limits` (drawer honesty text), and `instrument` on Studio layers.

### 6.2 Audio engine (`audio.js`)
- Tone.js (MIT licence, bundled in `web/vendor/`, no CDN) for `Sampler` instruments, filters, panners, reverb and the Transport clock.
- On Play: build one instrument chain per layer (`Sampler → Filter → Panner → Volume → Reverb → Destination`), schedule each step with `Tone.Transport.scheduleRepeat`, and fire UI callbacks (playhead, live region, meters) through `Tone.Draw`.
- Mute/Solo: set each layer's `Volume.mute`.
- Genre switch: swap samplers and tempo; keep the playback position.
- Loading: samplers load before Play is enabled; a short "Tuning instruments…" state is shown.

### 6.3 Export (`export.js`)
As built: the track is played once in real time while `Tone.Recorder` records it, then decoded and encoded as a 16-bit WAV in the browser and downloaded as `echosphere-<song>-<genre>.wav` (the first design used `Tone.Offline`).

### 6.4 Speech (`guide.js`)
The Web Speech API (`speechSynthesis`) speaks the "How to listen" guide and optional captions. If speech is unavailable, captions are shown on screen and announced via the live region.

---

## 7. Folder structure
```
echosphere/
├── Requirement.md · Design.md · task.md · README.md
├── raw/                 original NASA files + SOURCES.md
├── data/                pipeline outputs (kuching_2015/, planet_2015/, ocean/)
├── pipeline/            Python: invert.py, fires_borneo.py, fires_global.py, co2_borneo.py, map_frames.py, build_songs.py, build_event_songs.py, diatoms.py
├── web/                 the app (deployed to GitHub Pages by .github/workflows/pages.yml)
│   ├── index.html · style.css
│   ├── js/ app.js · audio.js · mapping.js · chart.js · guide.js · export.js · studio.js · live.js · snapshot.js
│   ├── data/songs.json · event_songs.json · diatom_song.json (+ .js wrappers) · maps.js
│   └── assets/ covers
├── docs/                ai-usage-log.md, sources
└── test/                pipeline tests and previews
```
Large raw files (`*.exr`, `*.mp4`) are excluded from Git via `.gitignore`.

---

## 8. Deployment and testing
- **Deploy:** GitHub repo (public) → GitHub Pages serving `web/`. Conductor creates the repo; links tested in a private window.
- **Test checklist:** each song × genre plays; mute/solo work; WAV export matches; keyboard-only run; screen reader (NVDA on Windows) announces play state and month; reduced-motion respected; loads on a phone.
