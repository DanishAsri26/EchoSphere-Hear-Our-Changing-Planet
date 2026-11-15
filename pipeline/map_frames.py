#!/usr/bin/env python3
"""
Map frames for the player's map view: one picture per musical step, cut from NASA SVS 5012
(the same frames the fire numbers come from), plus the brightest fire hotspots per frame
so the app can make them glow on the beat (inspired by NASA's Caldwell 73 sonification).

Outputs:
  web/maps/kuching/NN.jpg, web/maps/planet/NN.jpg
  web/data/maps.js   (window.ECHO_MAPS = {song_id: {extent, frames:[{img, hotspots:[{x,y,v}]}]}})

Source video: raw/wildfires/Carbon_emissions_with_overlay_1080p60.mp4 (map covers the full frame, 90N-90S).
If a 4096x2048 no-overlay video is added later, pass --video and --fps30 to use it instead.
Usage: python3 pipeline/map_frames.py
"""
import argparse, json, os, subprocess, sys, shutil
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.spatial import cKDTree
sys.path.insert(0, "pipeline")
import fires_borneo as fb

C, V = fb.colorbar_lut("raw/wildfires/Colorbar.png")
TREE = cKDTree(C)

SONGS = {
    # extent = lat_min, lat_max, lon_min, lon_max (wider than the data window, for context)
    "kuching-2015": {"extent": (-9.0, 11.0, 96.0, 124.0), "data": "data/kuching_2015/fires_weekly.json", "key": "steps", "out_w": 960, "spots": 5},
    "planet-2015": {"extent": (-68.0, 80.0, -180.0, 180.0), "data": "data/planet_2015/fires_global_monthly.json", "key": "months", "out_w": 1280, "spots": 8},
}


def crop(img, ext):
    h, w, _ = img.shape
    lat0, lat1, lon0, lon1 = ext
    t, b = int((90 - lat1) / 180 * h), int((90 - lat0) / 180 * h)
    l, r = int((lon0 + 180) / 360 * w), int((lon1 + 180) / 360 * w)
    return img[t:b, l:r]


def hotspots(px, n):
    flat = px.reshape(-1, 3).astype(float)
    d, i = TREE.query(flat, distance_upper_bound=30)
    val = np.full(len(flat), np.nan); ok = np.isfinite(d); val[ok] = V[i[ok]]
    val = val.reshape(px.shape[:2]); val[fb.border_mask(px.astype(float))] = np.nan
    strong = np.nan_to_num(val) >= 8
    lab, k = ndimage.label(strong)
    spots = []
    for j in range(1, k + 1):
        m = lab == j
        size = int(m.sum())
        if size < 3: continue
        ys, xs = np.nonzero(m)
        w = np.nan_to_num(val[m])
        spots.append({"x": round(float((xs * w).sum() / w.sum()) / px.shape[1], 4),
                      "y": round(float((ys * w).sum() / w.sum()) / px.shape[0], 4),
                      "v": round(float(w.mean()), 1), "size": size})
    spots.sort(key=lambda s: -s["size"] * s["v"])
    for s in spots: s.pop("size")
    return spots[:n]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", default="raw/wildfires/Carbon_emissions_with_overlay_1080p60.mp4")
    a = ap.parse_args()
    out = {}
    for sid, cfg in SONGS.items():
        rows = json.load(open(cfg["data"]))[cfg["key"]]
        frames = [r["video_frame"] for r in rows]
        tmp = f"/tmp/mapf_{sid}"; shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
        sel = "+".join(f"eq(n\\,{f})" for f in sorted(set(frames)))
        subprocess.run(["ffmpeg", "-v", "error", "-i", a.video, "-vf", f"select='{sel}'", "-vsync", "0", f"{tmp}/%03d.png"], check=True)
        files = {f: f"{tmp}/{k + 1:03d}.png" for k, f in enumerate(sorted(set(frames)))}
        dest = f"web/maps/{sid.split('-')[0]}"; os.makedirs(dest, exist_ok=True)
        entries = []
        for idx, f in enumerate(frames):
            img = np.asarray(Image.open(files[f]).convert("RGB"))
            px = crop(img, cfg["extent"])
            probe = img.copy()
            if sid.startswith("planet"):  # keep NASA's legend visible, but never treat it as a fire
                h, w, _ = img.shape
                probe[int(h * 730 / 1080):, : int(w * 560 / 1920)] = 0
            spots = hotspots(crop(probe, cfg["extent"]), cfg["spots"])
            pic = Image.fromarray(px)
            lat0, lat1, lon0, lon1 = cfg["extent"]
            W = cfg["out_w"]; H = round(W * (lat1 - lat0) / (lon1 - lon0))  # true equirectangular shape
            pic.resize((W, H), Image.LANCZOS).save(f"{dest}/{idx:02d}.jpg", quality=82)
            entries.append({"img": f"maps/{sid.split('-')[0]}/{idx:02d}.jpg", "hotspots": spots})
        out[sid] = {"extent": cfg["extent"], "aspect": round(W / H, 4), "frames": entries,
                    "source": "NASA SVS 5012, Weekly carbon emissions from fires (video frames)"}
        print(sid, len(entries), "frames; hotspots per frame:", [len(e["hotspots"]) for e in entries])
    with open("web/data/maps.js", "w") as fh:
        fh.write("window.ECHO_MAPS = "); json.dump(out, fh); fh.write(";\n")


if __name__ == "__main__":
    main()
