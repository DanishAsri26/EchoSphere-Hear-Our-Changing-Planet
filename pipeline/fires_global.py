#!/usr/bin/env python3
"""
Monthly GLOBAL fire series (Jan 2014 - Dec 2016) for Song 2, from the dated SVS 5012 video.
Frames are downscaled to 960x540 to keep memory low; the legend corner and Antarctica are masked.
Video values are calibrated to the exact EXR frames 2682 (Sep 2015), 2694 (Oct), 2704 (Nov).
Usage: python3 fires_global.py
"""
import json, subprocess, sys
import numpy as np
from PIL import Image
sys.path.insert(0, "pipeline")
import fires_borneo as fb

VID = "raw/wildfires/Carbon_emissions_with_overlay_1080p60.mp4"
W, H = 960, 540
C, V = fb.colorbar_lut("raw/wildfires/Colorbar.png")

from scipy.spatial import cKDTree
TREE = cKDTree(C)

def decode(img):
    """Nearest legend colour via a k-d tree (fast); far matches = no data."""
    flat = img.reshape(-1, 3)
    d, i = TREE.query(flat, distance_upper_bound=30)
    out = np.full(len(flat), np.nan); ok = np.isfinite(d); out[ok] = V[i[ok]]
    return out.reshape(img.shape[:2])

def stats(img):
    img = img[: int(H * 150 / 180)]                      # keep 90N-60S
    val = decode(img); val[fb.border_mask(img)] = np.nan
    val[int(H * 730 / 1080):, : int(W * 560 / 1920)] = np.nan   # legend corner
    b = ~np.isnan(val)
    return 100 * b.mean(), float(np.nanmean(val)) if b.any() else 0.0

MONTH_FRAMES = [int(round(3364 + 22.17 * k + 11)) for k in range(-20, 16)]
ANCHORS = [3365, 3389, 3409]
CACHE = "/tmp/gm"

def extract_all():
    """One ffmpeg pass (seeking frame by frame is far too slow)."""
    import os, shutil
    shutil.rmtree(CACHE, ignore_errors=True); os.makedirs(CACHE)
    sel = "+".join(f"eq(n\\,{n})" for n in MONTH_FRAMES + ANCHORS)
    subprocess.run(["ffmpeg", "-v", "error", "-i", VID, "-vf", f"select='{sel}',scale={W}:{H}", "-vsync", "0", f"{CACHE}/%03d.png"], check=True)
    return {n: f"{CACHE}/{i + 1:03d}.png" for i, n in enumerate(sorted(set(MONTH_FRAMES + ANCHORS)))}

FILES = {}
def vframe(n):
    return np.asarray(Image.open(FILES[n]).convert("RGB")).astype(float)

def main():
    FILES.update(extract_all())
    ra, rm = [], []
    for n, vf in [(2682, 3365), (2694, 3389), (2704, 3409)]:
        e = fb.load_exr_srgb(f"raw/wildfires/Carbon_emissions_no_overlay.{n}.exr")
        e = np.asarray(Image.fromarray(e.astype(np.uint8)).resize((W, H), Image.BILINEAR)).astype(float)
        A, M = stats(e); a, m = stats(vframe(vf)); ra.append(A / a); rm.append(M / m)
        print(n, "exr", round(A, 2), round(M, 2), "video", round(a, 2), round(m, 2))
    ka, km = float(np.mean(ra)), float(np.mean(rm)); print("factors", round(ka, 3), round(km, 3))
    rows = []
    for k in range(-20, 16):                     # Jan 2014 .. Dec 2016 relative to Sep 2015
        y = 2015 + (8 + k) // 12; mo = (8 + k) % 12 + 1
        f = int(round(3364 + 22.17 * k + 11))   # mid-month frame (labels: Sep 2015 starts at 3364)
        a, m = stats(vframe(f))
        rows.append({"month": f"{y}-{mo:02d}", "video_frame": f, "burning_area_pct": round(a * ka, 3), "mean_emission_gC_m2_week": round(m * km, 2)})
        print(rows[-1])
    json.dump({"source": "NASA SVS 5012 'Weekly carbon emissions from fires' video with date overlay, calibrated to EXR frames",
               "url": "https://svs.gsfc.nasa.gov/5012", "units": "grams of carbon per square metre per week",
               "region": "global, 90N-60S, legend corner masked",
               "method": "One mid-month frame per month; month positions fitted to the printed month labels (~22.17 video frames per month).",
               "calibration": {"area_factor": round(ka, 3), "emission_factor": round(km, 3), "area_spread": [round(min(ra), 3), round(max(ra), 3)]},
               "months": rows}, open("data/planet_2015/fires_global_monthly.json", "w"), indent=2)

if __name__ == "__main__":
    main()
