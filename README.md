# EchoSphere: Hear Our Changing Planet
NASA Space Apps Challenge 2026 · Challenge: "The Earth Information Jukebox"

EchoSphere turns NASA Earth visualizations into music. Each map's colours are turned
back into numbers using its legend, and the numbers are played as notes, one
instrument per Earth topic. Story year: the El Niño of 2015.

- Song 1: "Kuching, 2015" (Borneo window centred on Sarawak)
- Song 2: "The whole planet, 2015"
- Each song in two genres: Orchestra and Modern Band

## Folders
| Folder | What goes in it |
|---|---|
| `raw/` | Original NASA files, untouched (frames, colorbars, CSVs). One subfolder per topic. |
| `data/` | Numbers made by the pipeline (JSON), one subfolder per song. |
| `pipeline/` | Python scripts that turn pictures into numbers (`invert.py`). |
| `web/` | The web app (HTML, CSS, JS). `audio/` = sound samples, `assets/` = images. |
| `docs/` | Notes, sources, AI usage log. |
| `test/` | Synthetic test files for the pipeline. |

## Data sources
See `raw/SOURCES.md`.

## Use of AI
Built with help from Claude (Anthropic). See `docs/ai-usage-log.md`.
