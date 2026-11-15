# EchoSphere: Requirements
**Project:** EchoSphere: Hear Our Changing Planet
**Event:** NASA Space Apps Challenge 2026 · Challenge: "The Earth Information Jukebox" · Local event: Sarawak Space Challenge
**Team:** EchoSphere (Conductor: Danish · AI team: Hacker, Hipster, Hustler)
**Version:** 1.0 · 15 Nov 2026, 1:05 AM MYT
**Deadlines:** Feature freeze Sun 15 Nov 2:59 PM · Local submission Sun 15 Nov 8:59 PM (global closes 11:59 PM)

---

## 1. Purpose
NASA's Earth Information Center (EIC) visualizations are silent, so blind and low-vision people, and anyone listening rather than looking, cannot experience how our planet is changing.

EchoSphere is a web-based jukebox that turns NASA Earth visualizations into music. Each picture is like a CD: its colour legend is used to turn the map's colours back into real numbers, and the numbers are played as notes, one instrument per Earth topic. Several related topics play together, so listeners hear how parts of the Earth system move together.

## 2. Story and scope
Story year: **the El Niño of 2015**.

| Song | Place | Time steps | Layers (topics) |
|---|---|---|---|
| **Song 1: "Kuching, 2015"** | Borneo window centred on Sarawak (lat −5° to 8°, lon 105° to 120°) | 31 weekly steps, Jun–Dec 2015 | Wildfires · Rain (water / drought) · Greenhouse gases (CO₂) |
| **Song 2: "The Whole Planet, 2015"** | Global | 36 monthly steps, Jan 2014–Dec 2016 | Wildfires · Greenhouse gases (CO₂) · Sea level change |

Each song plays in **2 genres**: Orchestra and Modern Band → **4 tracks** in total (Conductor's target).

Message: *"What burns locally echoes globally."*

## 3. Users
| User | Need |
|---|---|
| **Primary:** blind or low-vision learner with headphones and a screen reader | Hear the data, understand what each sound means, control playback by keyboard |
| Curious public, students, teachers, museum visitors | A beautiful, quick way to "feel" climate data |
| Space Apps judges | Understand the idea within 30 seconds; see that the data is real and the method is honest |

## 4. Functional requirements

### 4.1 Must have (MVP)
| ID | Requirement |
|---|---|
| FR-01 | The home screen shows the **jukebox**: one "album" card per song, each with its NASA cover image, title, place, years and layer list. |
| FR-02 | The user can **select a song** and **choose a genre** (Orchestra / Modern Band) before or during playback. |
| FR-03 | **Play / Pause / Restart** the selected track. |
| FR-04 | Each data layer is played by **its own instrument**, in its own pitch register and stereo position, so layers can be told apart. |
| FR-05 | **Mute and Solo** per layer. |
| FR-06 | **Value → note mapping:** higher value = higher pitch, snapped to a musical scale. Brightness/loudness rises with the value. Missing data = silence. |
| FR-07 | **Clean-up rule (agreed):** changes smaller than one legend step are merged with the previous value. A **Raw / Smoothed** toggle lets users hear both. |
| FR-08 | A visible **timeline** shows the current date and moves with the music; each layer's line is drawn so sighted users can follow along. |
| FR-09 | A **15-second "How to listen" guide** plays low, middle and high reference tones and says what they mean. |
| FR-10 | **Save the music:** export the current track (song + genre + mute settings) as an audio file (WAV). |
| FR-11 | **Data and credits panel:** NASA sources with links, units, what each layer means, and the AI-usage statement. |
| FR-12 | **Honesty labels:** clipped values ("20+"), estimated or calibrated values, and dropped layers (air quality) are stated in the app. |

### 4.2 Should have (if time allows before feature freeze)
| ID | Requirement |
|---|---|
| FR-13 | **Instrument picker** per layer within the chosen genre (e.g. Fire: Trumpet or Violin). |
| FR-14 | **Speed control** (0.5×, 1×, 1.5×) and **pitch range control**. |
| FR-15 | **Keyboard explore mode:** arrow keys step through time; the screen reader speaks the date and each layer's value. |
| FR-16 | Short **spoken narration** at key moments (e.g. "September 2015: the fires peak"). |
| FR-17 | **Map view**: the NASA frame for the current step, with the strongest fire areas glowing on the beat (done). |
| FR-18 | **Custom song ("Studio")**: users build their own song by choosing layers, time range, genre, instrument per layer and tempo, then play and save it (Conductor's request, scope to confirm). |
| FR-19 | **Song from a real event (live)**: in the Studio, the user picks an event type and year, finds an event in NASA EONET, and the app fetches NASA POWER daily weather (rain, temperature, humidity, wind) at the event's location, 8 weeks before to 8 weeks after, as weekly means. Keyless APIs called from the browser; the request URL is kept as each layer's source. Added 15 Nov (Conductor). |
| FR-20 | **Plain-language event request (LLM)**: user describes the event in words; an LLM only turns it into an event type, place and dates (never data values). Only if time allows: needs an API key, so a small server or proxy, which conflicts with NFR-04. |

### 4.3 Won't have (this hackathon)
- Live colour decoding in the browser (decoding runs offline in Python).
- Air quality layer (no 2015 Southeast Asia map with a readable legend was found).
- Live API fetching for the two albums (they stay bundled; only FR-19 fetches live), user accounts, a mobile app, testing with blind and low-vision users (stated honestly as future work).

## 5. Data requirements
| Layer | Source | File in app | Notes |
|---|---|---|---|
| Wildfires (Borneo, weekly) | NASA SVS 5012, *Weekly carbon emissions from fires* | `data/kuching_2015/fires_weekly.json` | Dates read from the video's printed month label; video values calibrated to exact EXR frames (Sep, Oct, Nov 2015). Values ≥20 gC/m²/week are clipped. |
| Wildfires (global, monthly) | NASA SVS 5012 | `data/planet_2015/fires_global_monthly.json` | Same method, whole map 90°N–60°S |
| Rain, temperature, humidity (Kuching) | NASA POWER daily point API | `data/kuching_2015/rain.json` | Weekly means of daily values |
| CO₂ | NASA SVS 5024, AIRS CO₂ + `CO2_frames_dates_values.csv` | `data/planet_2015/co2_global_monthly.json`, `data/kuching_2015/co2.json` | NASA's monthly value is used; the decoded Borneo value has an unexplained ~11 ppm offset and is not played |
| Sea level | NASA GSFC Global Mean Sea Level v5.1 (via NASA STEM spreadsheet) | `data/planet_2015/sea_level_global_monthly.json` | Monthly means; +13.5 mm Jun 2014–May 2016 |
| Covers | SVS 4634 (Indonesia fires 2015), SVS 30975 (sea surface height) | `web/assets/` | Pictures only |

Every file must keep its **source URL, units and method** inside the JSON.

## 6. Non-functional requirements
| ID | Requirement |
|---|---|
| NFR-01 **Accessibility** | Fully usable by keyboard; all controls have labels; status changes are announced (ARIA live region); WCAG AA colour contrast; respects "reduce motion". |
| NFR-02 **Validity** | No invented numbers. Every value traces back to a NASA file; mappings are documented; limitations are shown. |
| NFR-03 **Performance** | Loads in under 3 s on a normal connection; total page under 5 MB; audio starts within 1 s of pressing Play. |
| NFR-04 **Hosting** | Static site on GitHub Pages; public, no login, no server, no API keys. |
| NFR-05 **Offline-safe** | All data is bundled as JSON, so the demo never depends on NASA servers being reachable. Exception: the optional live-event Studio (FR-19) needs internet and shows a clear message when NASA EONET/POWER cannot be reached; everything else keeps working. |
| NFR-06 **Browsers** | Latest Chrome, Edge and Firefox on desktop; works on phones (responsive). |
| NFR-07 **Licensing** | Only our own code, open-source libraries and freely licensed recorded instrument samples (CC BY 3.0, MIT, CC0). Every source is credited in the app, README and project form. |

## 7. Space Apps compliance
- Answers the official challenge "The Earth Information Jukebox" and uses NASA data.
- Everything in English; demo video ≤ 30 s with English subtitles.
- No NASA logos, flags or mission insignia in our own designs or generated content.
- AI use disclosed in the app, README and project form (see `docs/ai-usage-log.md`); no AI-generated images.
- All links (app, repo, video) public and tested in a private browser window.

## 8. Acceptance criteria
1. A judge can open the public link, pick a song and a genre, and hear all layers within 10 seconds.
2. Muting one layer clearly removes its instrument.
3. In Song 1, the fire layer clearly rises from June to a peak in September and falls in November; the rain layer is sparse in Aug–Sep and dense in Nov–Dec.
4. In Song 2, sea level clearly climbs through 2015 and dips after early 2016.
5. The saved WAV plays the same music as the screen.
6. The app can be used with keyboard only, and a screen reader announces the song, date and play state.
