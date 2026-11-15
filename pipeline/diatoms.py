#!/usr/bin/env python3
"""
Album 6 "The Ocean Breathes: Diatoms 1998-2012" (task 2.28), from NASA SVS 12009
"Earth's Oceans Show Decline In Microscopic Plant Life" (NASA Ocean Biogeochemical Model, NOBM).

Input  (raw/plaktons/):
  diadifftimeseries1080p30.mp4   630 frames, no date overlay (not committed: large; download from SVS 12009)
  diatomcbar_print.jpg           legend "Diatom Concentration (ug chl/l)", LOG scale 0.0001 (red) -> 1.0 (blue)
Method:
  1. Legend: the coloured bar runs from x=128 (0.0001) to x~893; ticks are 192 px apart, so
     log10(value) = -4 + (x - 128) / 192. Colours are sampled in the upper half of the bar (ticks are lower).
  2. Each frame (downscaled to 960x540) -> ocean pixels only: grey land / shelf / no-data, black background and
     other low-saturation pixels are skipped; the rest are matched to the nearest legend colour (k-d tree,
     max RGB distance 40). Global mean of log10(concentration) per frame (pixel mean on NASA's Robinson map).
  3. Timing: the series has 15 yearly bloom peaks about 40 frames apart over frames 0-615, so frames 0-615 =
     Jan 1998 - Dec 2012 (180 months). In this mapping the peak drifts ~3 months over the record, so dates are
     labelled approximate (about +-2 months). The last frames are an end hold and are dropped. Frames are averaged
     (in log10) into 60 quarterly steps, Q1 1998 ... Q4 2012, then converted back to ug chl/l.
Outputs:
  data/ocean/diatoms_1998_2012.json   per-frame series + quarterly values + method (traceability)
  web/data/diatom_song.json / .js     the album, same shape as songs.json; the .js adds it to window.ECHO_SONGS
                                      and its map frames to window.ECHO_EXTRA_MAPS
  web/maps/diatoms/00-59.jpg, legend.jpg   one real video frame per quarter (middle frame) + NASA's legend,
                                      shown in the player like the fire maps
Needs: numpy, pillow, scipy, and ffmpeg (on PATH, or the imageio-ffmpeg package).
Usage (from the project root): python -X utf8 pipeline/diatoms.py
Code written with AI assistance (Claude, Anthropic).
"""
import datetime as dt
import json
import os
import shutil
import subprocess

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

VID = "raw/plaktons/diadifftimeseries1080p30.mp4"
CBAR = "raw/plaktons/diatomcbar_print.jpg"
W, H = 960, 540
LAST_FRAME = 615          # frames 0..615 = Jan 1998 .. Dec 2012; the rest is an end hold
QUARTERS = 60
SVS = "https://svs.gsfc.nasa.gov/12009"
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    import imageio_ffmpeg  # bundled ffmpeg binary
    return imageio_ffmpeg.get_ffmpeg_exe()


def legend_lut():
    a = np.asarray(Image.open(CBAR).convert("RGB")).astype(float)
    xs = np.arange(131, 891)                       # inside the bar outline
    cols = a[66:85, xs].mean(axis=0)               # upper half: no tick marks there
    logv = -4 + (xs - 128) / 192.0
    return cols, logv


def frames():
    """All frames as 960x540 RGB arrays, in one ffmpeg pass."""
    cmd = [ffmpeg(), "-loglevel", "error", "-i", VID, "-vf", f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    n = W * H * 3
    while True:
        buf = p.stdout.read(n)
        if len(buf) < n:
            break
        yield np.frombuffer(buf, np.uint8).reshape(H, W, 3)
    p.wait()


def export_frames(edges):
    """One real frame per quarter (the middle frame of its range) + the legend, for the player's map view."""
    out = "web/maps/diatoms"
    os.makedirs(out, exist_ok=True)
    mids = [int((edges[q] + edges[q + 1]) // 2) for q in range(QUARTERS)]
    sel = "+".join(f"eq(n\\,{m})" for m in mids)
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-i", VID, "-vf", f"select={sel},scale=800:450",
                    "-fps_mode", "passthrough", "-q:v", "6", f"{out}/%02d.jpg"], check=True)
    # ffmpeg numbers from 1; rename to 00..59 so names match the quarter index
    for k in range(QUARTERS):
        os.replace(f"{out}/{k + 1:02d}.jpg" if k + 1 < 100 else f"{out}/{k + 1}.jpg", f"{out}/q{k:02d}.jpg")
    for k in range(QUARTERS):
        os.replace(f"{out}/q{k:02d}.jpg", f"{out}/{k:02d}.jpg")
    leg = Image.open(CBAR).convert("RGB")
    leg.resize((512, round(512 * leg.height / leg.width))).save(f"{out}/legend.jpg", quality=88)
    return mids


def main():
    cols, logv = legend_lut()
    tree = cKDTree(cols)
    series, shares = [], []
    for img in frames():
        px = img.reshape(-1, 3).astype(float)
        mx, mn = px.max(1), px.min(1)
        sat = (mx - mn) / np.maximum(mx, 1)
        ocean = sat > 0.12                          # skip grey land/shelf, black background, white
        d, i = tree.query(px[ocean], distance_upper_bound=40)
        ok = np.isfinite(d)
        vals = logv[i[ok]]
        series.append(float(vals.mean()) if len(vals) else float("nan"))
        shares.append(float(ok.sum() / len(px)))
    series = np.array(series)
    n_frames = len(series)

    # yearly peaks over the dated part (a peak = highest point within +-15 frames)
    s = np.convolve(series, np.ones(5) / 5, mode="same")
    peaks = [k for k in range(15, LAST_FRAME + 1) if k + 15 < n_frames and s[k] == s[k - 15:k + 16].max()]
    hold = float(np.abs(np.diff(series[LAST_FRAME + 1:])).max()) if n_frames > LAST_FRAME + 2 else 0.0

    # 60 quarterly steps over frames 0..615
    edges = np.linspace(0, LAST_FRAME + 1, QUARTERS + 1)
    q_log = [float(series[int(round(edges[q])):int(round(edges[q + 1]))].mean()) for q in range(QUARTERS)]
    q_val = [round(10 ** v, 5) for v in q_log]
    steps = [dt.date(1998 + q // 4, 3 * (q % 4) + 1, 1).isoformat() for q in range(QUARTERS)]
    fpm = (LAST_FRAME + 1) / 180                               # frames per month in the mapping
    peak_months = [int(p / fpm) % 12 for p in peaks]
    trend = 100 * (10 ** np.polyfit(np.arange(QUARTERS) / 4, q_log, 1)[0] - 1)   # % per year, global average

    os.makedirs("data/ocean", exist_ok=True)
    with open("data/ocean/diatoms_1998_2012.json", "w", encoding="utf-8") as f:
        json.dump({
            "source": {"name": "NASA SVS 12009, Earth's Oceans Show Decline In Microscopic Plant Life (NASA Ocean Biogeochemical Model)", "url": SVS,
                       "files": [VID, CBAR]},
            "units": "ug chl/l (diatom concentration, global ocean mean)",
            "method": __doc__.split("Method:")[1].split("Outputs:")[0].strip(),
            "frames": n_frames, "dated_frames": LAST_FRAME + 1, "yearly_peaks_at_frames": peaks,
            "end_hold_max_change_log10": round(hold, 5),
            "global_trend_percent_per_year": round(float(trend), 2), "peak_months_in_mapping": [MONTHS[m] for m in peak_months],
            "per_frame_log10_mean": [round(v, 5) for v in series.tolist()],
            "per_frame_ocean_share": [round(v, 4) for v in shares],
            "quarterly": [{"quarter": f"Q{q % 4 + 1} {1998 + q // 4}", "start": steps[q], "ug_chl_per_l": q_val[q]} for q in range(QUARTERS)],
        }, f, ensure_ascii=False, indent=1)

    peak_q = int(np.argmax(q_val))
    song = {
        "id": "ocean-diatoms-1998-2012",
        "title": "The Ocean Breathes: Diatoms 1998–2012",
        "subtitle": "Microscopic ocean plants, one solo instrument",
        "place": "Global ocean (NASA Ocean Biogeochemical Model)",
        "period": "1998 – 2012 · quarterly (approximate dates, about ±2 months)",
        "cover": "", "stepUnit": "quarter", "steps": steps,
        "captions": {
            steps[0]: "1998. Diatoms, microscopic ocean plants, bloom and fade with the seasons.",
            steps[peak_q]: f"Q{peak_q % 4 + 1} {1998 + peak_q // 4}: the highest quarter in this global average.",
            steps[-1]: "2012. NASA's study found diatoms declining in some regions; a global average mostly keeps the seasonal rhythm.",
        },
        "intro": "This album was decoded from the colours of NASA SVS 12009 (NASA Ocean Biogeochemical Model) using its logarithmic legend (pipeline/diatoms.py).",
        "limits": [
            "Model output: the NASA Ocean Biogeochemical Model (NOBM), not direct measurements.",
            "Values are read from the video's colours with its logarithmic legend (0.0001 to 1 µg chl/l), averaged over all ocean pixels of each frame (in log scale), then per quarter.",
            f"Dates are approximate (about ±2 months), derived from the yearly bloom cycle: the video has no dates. We found 15 yearly blooms over frames 0–615 and mapped them to January 1998 – December 2012; the last frames are an end hold and are dropped. With that mapping the yearly peak drifts from {MONTHS[peak_months[0]]} to {MONTHS[peak_months[-1]]}, so near the start and end the dates may be off by up to about 2 months.",
            f"Because this is a global average, you mainly hear the seasonal bloom. NASA's study reports diatoms declining by more than 1% per year from 1998 to 2012, strongest in the North Pacific and Indian Ocean; our global average changes by only about {trend:+.1f}% per year, so that decline is not something you can hear here.",
            f'Source: <a href="{SVS}" target="_blank" rel="noopener">NASA SVS 12009</a>.',
        ],
        "layers": [{
            "id": "diatoms", "name": "Diatoms", "icon": "🌿", "color": "#9CCC65",
            "units": "µg chl/l (global ocean average)", "digits": 4,
            "values": q_val, "legendStep": 0.0005,
            "register": "lowmid", "pan": 0.0, "legato": True, "sourceKind": "visual",
            "describe": "Diatoms are microscopic plants that float in the ocean. Higher note = more diatoms, averaged over the world's oceans each quarter. The rise and fall you hear is the yearly bloom.",
            "source": {"name": "NASA SVS 12009, NASA Ocean Biogeochemical Model", "url": SVS},
            "method": "Decoded from the colours of the SVS 12009 video with its logarithmic legend; ocean pixels only; global mean of log10 concentration per frame; 15 yearly blooms over frames 0–615 mapped to 1998–2012 (approximate, about ±2 months); averaged per quarter. Built by pipeline/diatoms.py.",
        }],
    }
    mids = export_frames(edges)
    song_map = {"aspect": round(16 / 9, 4), "noPin": True, "credit": "NASA SVS 12009 · diatom concentration (NOBM model)",
                "label": "NASA diatom map (SVS 12009)", "legend": "maps/diatoms/legend.jpg",
                "frames": [{"img": f"maps/diatoms/{k:02d}.jpg", "video_frame": mids[k], "hotspots": []} for k in range(QUARTERS)]}
    data = {"version": 1, "built": dt.date.today().isoformat(), "songs": [song]}
    with open("web/data/diatom_song.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    with open("web/data/diatom_song.js", "w", encoding="utf-8") as f:
        f.write("/* Generated by pipeline/diatoms.py: album 6 from NASA SVS 12009. */\n")
        f.write("window.ECHO_SONGS.songs.push(...(" + json.dumps(data, ensure_ascii=False) + ").songs);\n")
        f.write("window.ECHO_EXTRA_MAPS = Object.assign(window.ECHO_EXTRA_MAPS || {}, " + json.dumps({song["id"]: song_map}) + ");\n")

    print(f"frames {n_frames}, ocean share {min(shares):.2f}-{max(shares):.2f}")
    print(f"yearly peaks in frames 0-{LAST_FRAME}: {len(peaks)} at {peaks}")
    print(f"peak spacing: {np.diff(peaks).tolist()}")
    print(f"end hold (frames {LAST_FRAME + 1}+): max change {hold:.5f} log10")
    print(f"quarterly ug chl/l: min {min(q_val)} max {max(q_val)}; first year {q_val[:4]} last year {q_val[-4:]}")


if __name__ == "__main__":
    main()
