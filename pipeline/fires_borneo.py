#!/usr/bin/env python3
"""
Turn NASA SVS 5012 "Weekly carbon emissions from fires" frames (EXR) into numbers
for the Borneo window centred on Sarawak.

Legend (raw/wildfires/Colorbar.png): Carbon Emissions, 0-20 grams of carbon per
square metre per week; the arrow means values of 20 or more share the top colour.

Steps
1. EXR (linear float) -> sRGB 0-255, so map colours match the PNG colorbar.
2. Lookup table from the colorbar's middle row (x=165..993 -> about 0.5..20 gC/m2/week).
   The first ~0.5 units are drawn semi-transparent over the land, so they can't be read
   reliably: anything below 0.5 counts as "no fire".
3. Remove thin light-grey country border lines (they look like the top "20+" colour).
4. Nearest legend colour per pixel; pixels far from every legend colour = no data.

Output per frame: burning area %, mean emission over burning pixels, % at 20+ (clipped).

Usage: python3 fires_borneo.py raw/wildfires/*.exr --out data/kuching_2015/fires.json
"""
import argparse
import json
import re

import numpy as np
import OpenEXR
from PIL import Image
from scipy import ndimage

REGION = (-5.0, 8.0, 105.0, 120.0)  # lat_min, lat_max, lon_min, lon_max
FRAME_FIRST, FRAME_LAST = 1000, 3533  # SVS 5012 frame range
DATE_FIRST, DATE_LAST = np.datetime64("2003-01-01"), np.datetime64("2022-01-01")  # assumed span


def frame_date(n):
    """Estimated date: assumes frames are spread evenly from Jan 2003 to Jan 2022."""
    days = (DATE_LAST - DATE_FIRST).astype(int)
    return str(DATE_FIRST + np.timedelta64(int(round((n - FRAME_FIRST) / (FRAME_LAST - FRAME_FIRST) * days)), "D"))


def load_exr_srgb(path):
    rgb = OpenEXR.File(path).channels()["RGBA"].pixels.astype(np.float32)[..., :3]
    x = np.clip(rgb, 0, 1)
    s = np.where(x <= 0.0031308, 12.92 * x, 1.055 * x ** (1 / 2.4) - 0.055)
    return s * 255.0


def colorbar_lut(path, row=105, x0=165, x_zero=142, x_twenty=993):
    a = np.asarray(Image.open(path).convert("RGB")).astype(float)
    xs = np.arange(x0, x_twenty + 1)
    colours = a[row, xs]
    values = (xs - x_zero) / (x_twenty - x_zero) * 20.0
    return colours, values


def window(img, region=REGION):
    h, w, _ = img.shape
    lat0, lat1, lon0, lon1 = region
    top, bottom = int((90 - lat1) / 180 * h), int((90 - lat0) / 180 * h)
    left, right = int((lon0 + 180) / 360 * w), int((lon1 + 180) / 360 * w)
    return img[top:bottom, left:right]


def border_mask(px):
    """Thin, bright, grey lines = borders/coastlines. Real 20+ fire forms solid blobs."""
    chroma = px.max(2) - px.min(2)
    bright_grey = (px.mean(2) > 150) & (chroma < 25)
    solid = ndimage.binary_opening(bright_grey, structure=np.ones((3, 3)))
    return bright_grey & ~solid


def decode(px, colours, values, max_dist=30.0):
    flat = px.reshape(-1, 3)
    d = np.linalg.norm(flat[:, None, :] - colours[None, :, :], axis=2)
    best = d.argmin(1)
    v = values[best].astype(float)
    v[d[np.arange(len(flat)), best] > max_dist] = np.nan
    return v.reshape(px.shape[:2])


def main():
    p = argparse.ArgumentParser()
    p.add_argument("frames", nargs="+")
    p.add_argument("--colorbar", default="raw/wildfires/Colorbar.png")
    p.add_argument("--out", default="data/kuching_2015/fires.json")
    a = p.parse_args()
    colours, values = colorbar_lut(a.colorbar)
    rows = []
    for f in sorted(a.frames):
        n = int(re.search(r"\.(\d+)\.exr$", f).group(1))
        px = window(load_exr_srgb(f))
        v = decode(px, colours, values)
        v[border_mask(px)] = np.nan
        burning = ~np.isnan(v)
        total = v.size
        rows.append({
            "frame": n,
            "date_estimated": frame_date(n),
            "burning_area_pct": round(100 * burning.sum() / total, 2),
            "mean_emission_gC_m2_week": round(float(np.nanmean(v)), 2) if burning.any() else 0.0,
            "clipped_20plus_pct_of_burning": round(100 * float((v[burning] >= 19.5).sum()) / max(burning.sum(), 1), 1),
        })
        print(rows[-1])
    out = {
        "source": "NASA SVS 5012, Weekly carbon emissions from fires (frames, EXR)",
        "url": "https://svs.gsfc.nasa.gov/5012",
        "units": "grams of carbon per square metre per week",
        "region": {"lat": [REGION[0], REGION[1]], "lon": [REGION[2], REGION[3]], "name": "Borneo window centred on Sarawak"},
        "notes": [
            "Dates are estimated from frame numbers (frames assumed evenly spread Jan 2003 - Jan 2022).",
            "Values of 20 or more share the legend's top colour (clipped).",
            "Values below 0.5 are drawn semi-transparent and are treated as no fire.",
        ],
        "frames": rows,
    }
    with open(a.out, "w") as fh:
        json.dump(out, fh, indent=2)


if __name__ == "__main__":
    main()
