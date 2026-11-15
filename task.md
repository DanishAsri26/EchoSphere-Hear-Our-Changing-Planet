# EchoSphere: Task Tracker
Updated: 15 Nov 2026, 10:30 AM MYT · Owner key: 🛠 Hacker · 🎨 Hipster · 📣 Hustler · 👤 Conductor
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
| 2.11 | SHOULD: speed control ✅, explore mode ✅, story captions ✅, instrument picker ⬜ (must respect the family rule) | 🛠 | 🔄 |
| 2.17 | Instrument families: no two layers in one song from the same family. New line-up: Orchestra Trumpet / Harp / Bassoon / Cello; Band Saxophone / E-piano / E-bass / Pad. Bassoon, harp, sax samples added; clash check in `audio.js` | 🛠 | ✅ |
| 2.12 | Headless browser test: both songs play, genre switch mid-play, mute/keyboard, WAV export (16.9 s, real audio) | 🛠 | ✅ |
| 2.14 | Map view: NASA fire map per step + pulsing hotspot rings + Kuching pin (`map_frames.py`, `maps.js`) | 🛠🎨 | ✅ |
| 2.15 | ⛔ dropped (Conductor, 10:03 AM). Sharper maps: download 4096×2048 no-overlay video from SVS 5012 and re-run `map_frames.py` | 👤🛠 | ⬜ |
| 2.16 | **Custom song ("Studio")**: go-ahead given 10:03 AM; building the cut-down version (layers + genre + family-safe instrument per layer → play → Save as WAV), timeboxed to 12:30 PM. Original full scope: user picks 2–4 layers from the available data (fire Borneo/global, rain Kuching, CO₂, sea level), a time range, a genre, an instrument per layer and a tempo → plays on the map view → Save as WAV. **Done (cut-down), `web/js/studio.js`:** Studio card on the jukebox → pick 2–3 layers (only layers with the same time steps; others greyed out with the reason), genre, instrument per layer (instruments from a family already used are disabled) → opens in the normal player (chart, mute/solo, speed, Save as WAV). Small hooks in `audio.js` (`layer.instrument` override), `app.js`, `guide.js`, `index.html`, `style.css`. Headless Chrome test passed: both songs × both genres, genre switch mid-play, Studio keyboard-only flow, Studio play + 21 s WAV export. Not included: time range, tempo picker (use Speed), map view for Studio songs. | 🛠🎨 | ✅ |
| 2.18 | **Live event songs (FR-19)**, `web/js/live.js` + Studio section: event type + year → NASA EONET event list (filter by name) → NASA POWER daily rain / temperature / humidity / wind at the event's place, 8 weeks before to 8 after, weekly means → 4 new layers in the Studio → normal player + WAV. Honest limits in the drawer; clear message when offline. Headless Chrome test passed (Reykjanes volcano 2023, Typhoon Nalgae 2022, EONET blocked → albums still play; album + Studio regression test passed). | 🛠 | ✅ |
| 2.19 | LLM: plain-language event request (FR-20). Only if extra time; needs API key + proxy (conflicts NFR-04) | 🛠👤 | ⬜ |
| 2.20 | **3 more jukebox albums** (Conductor's pick): Pacific Drought 2015 (EONET_212, Viti Levu, Fiji), South America Floods 2015 (EONET_259, Uruguay River), Black Summer 2019 (EONET_4542, northern NSW). `pipeline/build_event_songs.py` → `web/data/event_songs.json/.js` (bundled, offline); raw NASA responses in `raw/events/`. Weekly NASA POWER weather ±8 weeks around each event; honest limits in the drawer. GENRES now map temp/humidity/wind (family rule holds in both genres). Live Studio date-line fix. All tests passed (5 albums × 2 genres, Studio, live events) | 🛠 | ✅ |
| 2.21 | Save Studio songs: share link (`#song=`) + "My songs" in this browser. Songs are saved as a recipe (layers, genre, instruments), never as data: opening one rebuilds it from the NASA data (live-event songs re-fetch from EONET + POWER). "Copy link" in the Studio and the player; the address bar always holds the current song's link; My songs (max 10, localStorage) with Open / Copy link / Delete; Back from a Studio song returns to the Studio; broken links show a clear message; shared links open paused (no autoplay). EONET text cleaned before it reaches the page. Tested: copy, reload, fresh-browser link, live-event link, broken link, delete + all earlier suites | 🛠 | ✅ |
| 2.22 | Studio always reachable: full-width card first on the jukebox + "Studio" link in the top bar (stops a playing song). Data-type labels (Conductor): each layer has `sourceKind` (🎨 decoded from a NASA visualization / 📄 NASA values behind a visualization / 📈 NASA data, no visualization), shown as album badge, chip icon + legend, in the Studio list and the drawer. Set in `build_songs.py` + `build_event_songs.py` (now rebuilds from saved `raw/events/`; `--refresh` to re-download). Only Wildfires are pixel-decoded; the 3 event albums are data-only, stated plainly | 🛠 | ✅ |
| 2.13 | Add cover images (fallback colour disc shows until then); Conductor will do this last | 👤 | ⬜ |

## Phase 3: Deploy and test (before 2:59 PM)
| # | Task | Owner | Status |
|---|---|---|---|
| 3.1 | Create public GitHub repo, push project (no `.exr`/`.mp4`): https://github.com/DanishAsri26/EchoSphere-Hear-Our-Changing-Planet (old prototype files at the top level kept out via `.gitignore`) | 👤🛠 | ✅ |
| 3.2 | Enable GitHub Pages; test public link in a private window. Live: https://danishasri26.github.io/EchoSphere-Hear-Our-Changing-Planet/ (Actions workflow publishes `web/` on every push to main). Full test passed on the live site in a fresh headless Chrome; Conductor to also check on own browser + phone | 👤 | ✅ |
| 3.3 | Test: 2 songs × 2 genres, mute/solo, WAV export, keyboard-only, NVDA, phone | 🛠👤 | ⬜ |
| 3.4 | Validity check: Song 1 fire peak Sep, rain silence Aug–Sep; Song 2 sea level rise through 2015 | 🎨 | ⬜ |
| 3.5 | README: what, how, data sources, method, limits, AI use | 📣🛠 | ⬜ |
| 3.6 | **FEATURE FREEZE 1:30 PM** (moved for the 5 PM video review) | All | ⬜ |

## Phase 4: Story and submission (1:30–8:59 PM; video live by 4:00 PM)
| # | Task | Owner | Status |
|---|---|---|---|
| 4.1 | Rewrite High-Level Summary for concept v2; resubmit | 📣👤 | ⬜ |
| 4.2 | 30-s video script with timestamps + English subtitles | 📣 | ⬜ |
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
- 15 Nov: Studio can only mix layers that share time steps. The data has two timelines (weekly Jun–Dec 2015: Borneo fire, Kuching rain, CO₂; monthly 2014–2016: global fire, CO₂, sea level), so a Studio song is a 2–3 layer remix of one of them with the user's own instruments. No resampling between weekly and monthly (it would invent values). In the player, genre changes tempo/reverb/drums but keeps Studio instruments.
- 15 Nov ~11:00: Conductor: users should make music from any event without knowing how to get EIC snapshots. Chosen: NASA EONET (events) + NASA POWER (values), both keyless with browser CORS, so still a static site. LLM postponed to "if extra time" (API key would need a server; LLM must never supply values). Live songs are the weather at the event's place (strongest reported point / first report / area centre), not the event itself; stated in the drawer. The two albums stay offline.
