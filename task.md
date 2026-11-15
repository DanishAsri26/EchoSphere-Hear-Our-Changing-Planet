# EchoSphere: Task Tracker
Updated: 15 Nov 2026, 3:05 PM MYT · Owner key: 🛠 Hacker · 🎨 Hipster · 📣 Hustler · 👤 Conductor
Status: ✅ done · 🔄 in progress · ⬜ to do · ⛔ dropped

**Key times (MYT):** Feature freeze **Sun 1:30 PM** · Video uploaded **4:00 PM** · Video review done **5:00 PM** (Sarawak rule) · Submit target **7:30 PM** · Local deadline **8:59 PM**

---

## Phase 1: Data (Sat night) ✅
| # | Task | Owner | Status |
|---|---|---|---|
| 1.1 | Concept v2 "Relationship Jukebox" (Conductor's idea) | 👤 | ✅ |
| 1.2 | Pick timeframe (El Niño 2015) and Sarawak focus | 👤 | ✅ |
| 1.3 | Colour-inversion tool `invert.py`, tested on a synthetic map | 🛠 | ✅ |
| 1.4 | Download fire frames 2682/2694/2704, colorbar, dated video (SVS 5012) | 👤 | ✅ |
| 1.5 | Decode fires for Borneo; confirm dates from the video (Sep/Oct/Nov 2015) | 🛠 | ✅ |
| 1.6 | Weekly Borneo fire series Jun–Dec 2015 (`fires_weekly.json`) | 🛠 | ✅ |
| 1.7 | Kuching rain from NASA POWER (`rain.json`) | 👤🛠 | ✅ |
| 1.8 | CO₂ frames + dates CSV (SVS 5024); `co2.json`, `co2_global_monthly.json` | 👤🛠 | ✅ |
| 1.9 | Sea level spreadsheet → `sea_level_global_monthly.json` | 👤🛠 | ✅ |
| 1.10 | Global monthly fire series 2014–2016 (`fires_global_monthly.json`) | 🛠 | ✅ |
| 1.11 | Air quality 2015 map | 👤 | ⛔ dropped (none found) |
| 1.12 | Requirement.md, Design.md, task.md | 🛠🎨📣 | ✅ |

## Phase 2: Build (Sun morning) 🔄
| # | Task | Owner | Status |
|---|---|---|---|
| 2.1 | Save covers: SVS 4634 still → `web/assets/cover-kuching.jpg`; SVS 30975 still → `web/assets/cover-planet.jpg` | 👤 | ⬜ |
| 2.2 | `build_songs.py`: merge data into `web/data/songs.json` (steps, layers, units, sources, captions) | 🛠 | ✅ |
| 2.3 | `index.html` + `style.css`: jukebox home, player, drawers (Design §2–3) | 🎨🛠 | ✅ |
| 2.4 | `mapping.js`: value → pentatonic note, registers, brightness, rests, merge rule, raw/smoothed | 🛠 | ✅ |
| 2.5a | Download needed instrument samples (tonejs-instruments, FluidR3_GM) into `web/audio/` (65 notes, 8 MB); credits in `web/audio/CREDITS.md` | 🛠 | ✅ |
| 2.5 | `audio.js`: Tone.js samplers for both genres (synth fallback), mute/solo, play/pause/restart, genre switch | 🛠 | ✅ |
| 2.6 | `chart.js`: SVG timeline with layer lines and moving playhead | 🎨 | ✅ |
| 2.7 | `guide.js`: 15-s "How to listen" with reference tones + speech | 🛠 | ✅ |
| 2.8 | `export.js`: render to WAV and download | 🛠 | ✅ |
| 2.9 | Data & credits drawer, honesty labels, AI statement | 📣🎨 | ✅ |
| 2.10 | Keyboard shortcuts + ARIA live announcements | 🛠 | ✅ |
| 2.11 | SHOULD: speed control ✅, explore mode ✅, story captions ✅, instrument picker ✅ (in the Studio, genre-only lists, family rule enforced) | 🛠 | ✅ |
| 2.17 | Instrument families: no two layers in one song from the same family. New line-up: Orchestra Trumpet / Harp / Bassoon / Cello; Band Saxophone / E-piano / E-bass / Pad. Bassoon, harp, sax samples added; clash check in `audio.js` | 🛠 | ✅ |
| 2.12 | Headless browser test: both songs play, genre switch mid-play, mute/keyboard, WAV export (16.9 s, real audio) | 🛠 | ✅ |
| 2.14 | Map view: NASA fire map per step + pulsing hotspot rings + Kuching pin (`map_frames.py`, `maps.js`) | 🛠🎨 | ✅ |
| 2.15 | ⛔ dropped (Conductor, 10:03 AM). Sharper maps: download 4096×2048 no-overlay video from SVS 5012 and re-run `map_frames.py` | 👤🛠 | ⬜ |
| 2.16 | **Custom song ("Studio")**: go-ahead given 10:03 AM; building the cut-down version (layers + genre + family-safe instrument per layer → play → Save as WAV), timeboxed to 12:30 PM. Original full scope: user picks 2–4 layers from the available data (fire Borneo/global, rain Kuching, CO₂, sea level), a time range, a genre, an instrument per layer and a tempo → plays on the map view → Save as WAV. **Done (cut-down), `web/js/studio.js`:** Studio card on the jukebox → pick 2–3 layers (only layers with the same time steps; others greyed out with the reason), genre, instrument per layer (instruments from a family already used are disabled) → opens in the normal player (chart, mute/solo, speed, Save as WAV). Small hooks in `audio.js` (`layer.instrument` override), `app.js`, `guide.js`, `index.html`, `style.css`. Headless Chrome test passed: both songs × both genres, genre switch mid-play, Studio keyboard-only flow, Studio play + 21 s WAV export. Not included: time range, tempo picker (use Speed), map view for Studio songs. | 🛠🎨 | ✅ |
| 2.18 | **Live event songs (FR-19)**, `web/js/live.js` + Studio section: event type + year → NASA EONET event list (filter by name) → NASA POWER daily rain / temperature / humidity / wind at the event's place, 8 weeks before to 8 after, weekly means → 4 new layers in the Studio → normal player + WAV. Honest limits in the drawer; clear message when offline. Headless Chrome test passed (Reykjanes volcano 2023, Typhoon Nalgae 2022, EONET blocked → albums still play; album + Studio regression test passed). | 🛠 | ✅ |
| 2.19 | LLM: plain-language event request (FR-20). Only if extra time; needs API key + proxy (conflicts NFR-04) | 🛠👤 | ⬜ |
| 2.20 | **3 more jukebox albums** (Conductor's pick): Pacific Drought 2015 (EONET_212, Viti Levu, Fiji), South America Floods 2015 (EONET_259, Uruguay River), Black Summer 2019 (EONET_4542, northern NSW). `pipeline/build_event_songs.py` → `web/data/event_songs.json/.js` (bundled, offline); raw NASA responses in `raw/events/`. Weekly NASA POWER weather ±8 weeks around each event; honest limits in the drawer. GENRES now map temp/humidity/wind (family rule holds in both genres). Live Studio date-line fix. All tests passed (5 albums × 2 genres, Studio, live events) | 🛠 | ✅ |
| 2.21 | Save Studio songs: share link (`#song=`) + "My songs" in this browser. Songs are saved as a recipe (layers, genre, instruments), never as data: opening one rebuilds it from the NASA data (live-event songs re-fetch from EONET + POWER). "Copy link" in the Studio and the player; the address bar always holds the current song's link; My songs (max 10, localStorage) with Open / Copy link / Delete; Back from a Studio song returns to the Studio; broken links show a clear message; shared links open paused (no autoplay). EONET text cleaned before it reaches the page. Tested: copy, reload, fresh-browser link, live-event link, broken link, delete + all earlier suites | 🛠 | ✅ |
| 2.23 | Studio layer list: "Choose a source" picker (albums / your event / your snapshots), then only that source's layers; no more growing list or greyed rows. 1–4 layers everywhere (Conductor); mute/solo keys 1–4. Tested (test_source: 1, 3 and 4-layer songs, key 4, 1-layer WAV) + all suites | 🛠 | ✅ |
| 2.24 | Snapshot → music (`web/js/snapshot.js`): upload 1–4 pictures (e.g. EIC snapshots); for each, mark the colour legend (drag or type Left/Top/Width/Height %), type low/high values + units; every pixel is matched to the nearest legend colour and the map is read west→east in 32 slices (mean value per slice; non-matching pixels ignored). Each picture = 1 layer in a "Your snapshots" source; works with 1 picture = 1 instrument. Pictures never leave the device, so no share link / not in My songs (Save as WAV works). Refuses boxes that are not a colour bar. Labelled 🖼️ "decoded from your picture" + limits in drawer. Tested: synthetic rising/falling maps decode to 0.16→19.8 / 19.8→0.18 on a 0–20 legend; real NASA SVS 5012 frame (Sep 2014) peaks at S. America/Africa longitudes; play + WAV; all 7 suites pass (79 checks) | 🛠 | ✅ |
| 2.32 | Album 1 renamed "Kuching, 2015" → **"Borneo Haze, 2015"** (Conductor): the map window (5°S–8°N, 105°E–120°E) covers Borneo plus nearby Malaysia and Indonesia, not just Kuching; named after the main event, the 2015 Southeast Asian haze. Song id `kuching-2015` kept so saved links still work; the rain layer is still Kuching (NASA POWER point). Demo video still says "Kuching 2015" | 🛠 | ✅ |
| 2.31 | **Find legend automatically** in the picture tool (Conductor, option 3, after freeze, on branch `auto-legend`): button "🔎 Find legend automatically" (`web/js/legendfind.js`). (1) Colour-bar search in the browser: long thin strip whose colour changes along it, same across it (rows joined if ≥85% overlap, thin tick marks bridged, flat grey arrow tips trimmed, must change in ≥10 of 16 segments) → pink legend box + map-area guess that leaves out the legend, title and labels. (2) Tesseract.js 5.1.1 (Apache-2.0, vendored in `web/vendor/tesseract/`, loaded only on click; first use downloads ~7 MB: core 3.9 MB + English data 2.9 MB + scripts 0.2 MB; 11 MB in the repo with the non-SIMD core) reads tick numbers (all-text pass + digits-only passes, most confident reading per position) and title/units; low/high only if the numbers reach both bar ends and form an even linear or logarithmic scale, otherwise left empty and said so; unclear units left empty. (3) Pre-fills fields, announces what was found, focus to Add as layer; never saves by itself. (4) New "Logarithmic legend" tick: decode interpolates in log10; shown in note, method, list and drawer. Tested (test_autolegend, 20 checks): NASA SVS 5012 frame → box 3.8/90/21.4×2.2 %, 0–20 linear, units read; SVS 12009 diatom map + legend → 0.0001–1 logarithmic, "Diatom Concentration"; synthetic 0–20 rises 0 → 19.9; Worldview rain screenshot → "No colour legend found", no box; keyboard only; network log: no uploads, no other sites. Existing suites pass | 🛠 | ✅ |
| 2.30 | Live-event messages say what is missing is NASA's *records*, not the events (Conductor): "NASA's EONET list has no records of dust and haze for 2026. This does not mean none happened…" plus the years that do have records for sparse types (checked 15 Nov: dust and haze 2015–2017, drought 2015–2016, temperature extremes 2015–2017, floods 2015–2017 and 2025) | 🛠 | ✅ |
| 2.29 | How to listen is read aloud in full (Conductor): the button "▶ Read the guide aloud" reads every line of the box after the low/middle/high notes, in each layer line: name + instrument, then **one note** on that instrument, then the rest of the line (Conductor, 3:30 PM); speech no longer cut off on long lines; Close/Escape stops it. Tested (test_readguide: 3 albums, every line spoken) | 🛠 | ✅ |
| 2.28 | **Album 6 "The Ocean Breathes: Diatoms 1998–2012"** (1 solo layer) from NASA SVS 12009 (NASA Ocean Biogeochemical Model): `pipeline/diatoms.py` decodes all 630 frames of `raw/plaktons/diadifftimeseries1080p30.mp4` with the LOG legend `diatomcbar_print.jpg` (log10 = −4 + (x−128)/192), ocean pixels only, global mean of log10 per frame → `data/ocean/diatoms_1998_2012.json` (per-frame series kept) + `web/data/diatom_song.json/.js`. Verified: exactly 15 yearly peaks in frames 0–615 (spacing 38–44), frames 616–629 a still end hold (dropped); 60 quarterly steps Q1 1998–Q4 2012, 0.0137–0.0231 µg chl/l. Cello (Orchestra) / synth pad (Band); badge 🎨 decoded from a NASA visualization; own How to listen. Honesty: model output, colour-decoded, global average (seasonal bloom), NASA's >1%/yr decline (N. Pacific, Indian Ocean) NOT audible: our global average −0.1%/yr. **Dates labelled ±2 months, not ±1** (Conductor to confirm): in the 0–615 = 1998–2012 mapping the yearly peak drifts Nov → Aug, i.e. ~40.3 frames/year vs 41.1 assumed. App: quarter dates "Q3 2004 (approx.)", 4-decimal values, every-2nd-year chart axis. All 15 suites pass. **Map view added (Conductor, 3:10 PM):** one real SVS 12009 frame per quarter (middle frame; `web/maps/diatoms/`, 2.4 MB, loads only for this album) + NASA's diatom legend, cross-fading with the music; no Kuching pin | 🛠 | ✅ |
| 2.27 | How to listen per album (Conductor): each album card has its own "How to listen" button; the guide is built from that song's layers (place, what one note is, each layer's instrument + headphone side + meaning, mute/solo keys); H in the player opens the playing song's guide (also Studio, event and picture songs); spoken 15-s guide names that song's instruments and special sounds. Also: no default legend box in the picture tool; Studio intro link removed. Tested (test_guide) + suites | 🛠 | ✅ |
| 2.26 | Pictures without a legend (Conductor): choose "How should the colours be read?" - legend (mark it) or no legend: blue→green→yellow→red / darker / lighter = higher (relative 0–100; black/grey/white count as none, so sparse spots sound low). No legend box shown in no-legend mode. "What do the colours show?" gives a note (e.g. "redder colour = more rain") under the picture, in the list and drawer. Studio instrument list shows only the chosen genre's instruments (Orchestra: trumpet, tuba, bassoon, harp, cello, marimba; Band: sax, e-piano, e-guitar, e-bass, pad; 4 families each); player genre switch re-picks Studio instruments from the new genre. Tested on the Conductor's Worldview rain screenshot + all 11 suites (115 checks) | 🛠 | ✅ |
| 2.25 | Snapshot editor (Conductor, after 1:30 freeze, approved): ① Map area box (read and show only that part, e.g. Southeast Asia) + ② Legend box, drag or type; Edit a saved picture (area, legend, values, name) without uploading again; player shows the picture (cropped to the area) with a pink band on the playing slice; chart reads West → East (was wrongly showing months). Tested: area crop (east half → 10…20, west half → 0…10 on a 0–20 legend), edit replaces not duplicates, legend-mode drag, all 9 suites pass | 🛠 | ✅ |
| 2.22 | Studio always reachable: full-width card first on the jukebox + "Studio" link in the top bar (stops a playing song). Data-type labels (Conductor): each layer has `sourceKind` (🎨 decoded from a NASA visualization / 📄 NASA values behind a visualization / 📈 NASA data, no visualization), shown as album badge, chip icon + legend, in the Studio list and the drawer. Set in `build_songs.py` + `build_event_songs.py` (now rebuilds from saved `raw/events/`; `--refresh` to re-download). Only Wildfires are pixel-decoded; the 3 event albums are data-only, stated plainly | 🛠 | ✅ |
| 2.13 | Add cover images (fallback colour disc shows until then); Conductor will do this last | 👤 | ⬜ |

## Phase 3: Deploy and test (before 2:59 PM)
| # | Task | Owner | Status |
|---|---|---|---|
| 3.1 | Create public GitHub repo, push project (no `.exr`/`.mp4`): https://github.com/DanishAsri26/EchoSphere-Hear-Our-Changing-Planet (old prototype files at the top level kept out via `.gitignore`) | 👤🛠 | ✅ |
| 3.2 | Enable GitHub Pages; test public link in a private window. Live: https://danishasri26.github.io/EchoSphere-Hear-Our-Changing-Planet/ (Actions workflow publishes `web/` on every push to main). Full test passed on the live site in a fresh headless Chrome; Conductor to also check on own browser + phone | 👤 | ✅ |
| 3.3 | Test: 2 songs × 2 genres, mute/solo, WAV export, keyboard-only, NVDA, phone | 🛠👤 | ⬜ |
| 3.4 | Validity check: Song 1 fire peak Sep, rain silence Aug–Sep; Song 2 sea level rise through 2015 | 🎨 | ⬜ |
| 3.5 | README: what, how, data sources, method, limits, AI use (written; diatom dates corrected to about ±2 months, rebuild steps added) | 📣🛠 | ✅ |
| 3.6 | **FEATURE FREEZE 1:30 PM** (moved for the 5 PM video review) | All | ⬜ |

## Phase 4: Story and submission (1:30–8:59 PM; video live by 4:00 PM)
| # | Task | Owner | Status |
|---|---|---|---|
| 4.1 | Rewrite High-Level Summary for concept v2; resubmit | 📣👤 | ⬜ |
| 4.2 | 30-s video script with timestamps + English subtitles: draft v1 in `docs/video-script.md` | 📣 | ✅ |
| 4.3 | Record video, upload to YouTube (Unlisted or Public) | 👤 | ⬜ |
| 4.4 | Fill all project fields (Detailed Description, NASA Data, Other Data, Use of AI) | 📣👤 | ⬜ |
| 4.5 | Update AI usage log; final checklist; test all links in private window | 📣 | ⬜ |
| 4.6 | Submit for judging (target 7:30 PM) + team photo | 👤 | ⬜ |

---

## Known issues and decisions log
- Fire dates: frame-number estimate was 1 month early; corrected from the dated video.
- Borneo CO₂ decode ~11 ppm below NASA CSV value → use NASA CSV value; offset not explained.
- Fire video values calibrated to EXR frames (spread about ±10%); stated in data files.
- Fire values ≥ 20 gC/m²/week are clipped by the legend; shown as "20+".
- Fire weeks (from monthly labels) and rain weeks (calendar weeks) can differ by a few days.
- Air quality dropped; haze is told in the narration with sources.
- Each layer is scaled to its own range per song, so pitch shows relative change (stated in the app).
- Instruments switched from synthesized to recorded samples (Conductor, 1:10 AM); sources and licences listed.
- 15 Nov 10:03 AM: instrument family rule (Conductor). 4K maps dropped. Follow the 5 PM video-review rule → freeze moved to 1:30 PM.
- Conductor will also code (vibe coding, maybe Claude Code in VS Code); keep task.md as the shared source of truth.
- 15 Nov: Studio can only mix layers that share time steps. The data has two timelines (weekly Jun–Dec 2015: Borneo fire, Kuching rain, CO₂; monthly 2014–2016: global fire, CO₂, sea level), so a Studio song is a 2–3 layer remix of one of them with the user's own instruments. No resampling between weekly and monthly (it would invent values). In the player, genre changes tempo/reverb/drums; since 2.26 it also re-picks Studio instruments from that genre.
- 15 Nov ~11:00: Conductor: users should make music from any event without knowing how to get EIC snapshots. Chosen: NASA EONET (events) + NASA POWER (values), both keyless with browser CORS, so still a static site. LLM postponed to "if extra time" (API key would need a server; LLM must never supply values). Live songs are the weather at the event's place (strongest reported point / first report / area centre), not the event itself; stated in the drawer. The two albums stay offline.
