#!/usr/bin/env python3
"""
EchoSphere colour inversion: turn a colour-mapped NASA SVS map frame back into data values.

How it works
1. Build a colour -> value lookup table from the legend:
   - a colour-map CSV (best: exact), or
   - a colorbar PNG sampled along its long axis, with the min/max values printed on the legend.
2. For every map pixel inside the region window, find the nearest legend colour.
   Pixels too far from any legend colour (land, coastlines, text) become "no data".
3. Report the regional statistics (mean, median, max, % valid, % clipped).

Honesty rules built in
- Values at either end of the legend are flagged as CLIPPED: the true value may be beyond the legend.
- Legend-step merge rule: changes smaller than one legend step are merged (see merge_small_changes).

Usage (one frame):
  python3 invert.py frame.png --colorbar cbar.png --vmin 380 --vmax 410 \
      --region -5 8 105 120 --date 2015-09-15 --out result.json
  python3 invert.py frame.png --csv colormap.csv --vmin 380 --vmax 410 --region -5 8 105 120

Region = lat_min lat_max lon_min lon_max. The map is assumed to be a global
equirectangular (plate carree) frame unless --extent is given.
"""
import argparse
import csv
import json
import sys

import numpy as np
from PIL import Image


# ---------- legend -> lookup table ----------

def lut_from_colorbar(path, vmin, vmax, reverse=False, crop=None, samples=256):
    """Sample a colorbar image along its long axis. Assumes a LINEAR scale from vmin to vmax.
    crop = (left, top, right, bottom) in pixels to cut the bar out of a larger legend image."""
    img = Image.open(path).convert("RGB")
    if crop:
        img = img.crop(crop)
    a = np.asarray(img).astype(float)
    h, w, _ = a.shape
    if w >= h:  # horizontal bar: low -> high from left to right
        line = a[h // 2, :, :]
    else:       # vertical bar: low -> high from bottom to top
        line = a[::-1, w // 2, :]
    if reverse:
        line = line[::-1]
    idx = np.linspace(0, len(line) - 1, samples).round().astype(int)
    colours = line[idx]
    values = np.linspace(vmin, vmax, samples)
    return colours, values


def lut_from_csv(path, vmin=None, vmax=None):
    """Read a colour-map CSV. Accepts rows of r,g,b or value,r,g,b (0-1 or 0-255)."""
    rows = []
    with open(path, newline="") as f:
        for row in csv.reader(f):
            try:
                rows.append([float(x) for x in row if x.strip() != ""])
            except ValueError:
                continue  # header line
    arr = np.array([r for r in rows if len(r) in (3, 4)])
    if arr.shape[1] == 4:
        values, colours = arr[:, 0], arr[:, 1:]
        if vmin is not None and vmax is not None and values.max() <= 1.0:
            values = vmin + values * (vmax - vmin)  # stops given as 0-1 positions
    else:
        if vmin is None or vmax is None:
            sys.exit("CSV has only r,g,b columns: give --vmin and --vmax.")
        colours = arr
        values = np.linspace(vmin, vmax, len(arr))
    if colours.max() <= 1.0:
        colours = colours * 255.0
    return colours, values


# ---------- map -> values ----------

def region_pixels(img, region, extent=(-90, 90, -180, 180)):
    """Cut the region window out of an equirectangular frame.
    region/extent = (lat_min, lat_max, lon_min, lon_max)."""
    h, w, _ = img.shape
    lat0, lat1, lon0, lon1 = extent
    r_lat0, r_lat1, r_lon0, r_lon1 = region
    def col(lon): return int(round((lon - lon0) / (lon1 - lon0) * (w - 1)))
    def row(lat): return int(round((lat1 - lat) / (lat1 - lat0) * (h - 1)))
    top, bottom = row(r_lat1), row(r_lat0)
    left, right = col(r_lon0), col(r_lon1)
    return img[top:bottom + 1, left:right + 1, :]


def invert(pixels, colours, values, max_dist=40.0):
    """Nearest legend colour for each pixel. Returns values (NaN = no data) and distances."""
    flat = pixels.reshape(-1, 3).astype(float)
    out = np.full(len(flat), np.nan)
    dist = np.full(len(flat), np.inf)
    for start in range(0, len(flat), 200_000):  # chunk to keep memory low
        chunk = flat[start:start + 200_000]
        d = np.linalg.norm(chunk[:, None, :] - colours[None, :, :], axis=2)
        best = d.argmin(axis=1)
        best_d = d[np.arange(len(chunk)), best]
        ok = best_d <= max_dist
        out[start:start + len(chunk)][ok] = values[best][ok]
        dist[start:start + len(chunk)] = best_d
    return out.reshape(pixels.shape[:2]), dist.reshape(pixels.shape[:2])


def summarise(vals, vmin, vmax, step):
    valid = vals[~np.isnan(vals)]
    total = vals.size
    if valid.size == 0:
        return {"valid_pct": 0.0, "mean": None, "median": None, "max": None, "clipped_pct": None}
    tol = step / 2 if step else (vmax - vmin) / 200
    clipped = np.sum((valid <= vmin + tol) | (valid >= vmax - tol))
    return {
        "valid_pct": round(100 * valid.size / total, 1),
        "mean": round(float(valid.mean()), 4),
        "median": round(float(np.median(valid)), 4),
        "max": round(float(valid.max()), 4),
        "clipped_pct": round(100 * clipped / valid.size, 1),
    }


# ---------- legend-step merge rule ----------

def merge_small_changes(series, step):
    """Agreed rule: a change smaller than one legend step is merged with the previous value."""
    out, last = [], None
    for v in series:
        if v is None:
            out.append(None)
            continue
        if last is None or abs(v - last) >= step:
            last = v
        out.append(last)
    return out


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("frame")
    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument("--colorbar")
    src.add_argument("--csv")
    p.add_argument("--vmin", type=float, required=True)
    p.add_argument("--vmax", type=float, required=True)
    p.add_argument("--step", type=float, default=None, help="one legend step (for clipping tolerance and merging)")
    p.add_argument("--cbar-crop", type=int, nargs=4, metavar=("L", "T", "R", "B"))
    p.add_argument("--reverse", action="store_true", help="colorbar runs high->low")
    p.add_argument("--region", type=float, nargs=4, required=True, metavar=("LAT_MIN", "LAT_MAX", "LON_MIN", "LON_MAX"))
    p.add_argument("--extent", type=float, nargs=4, default=(-90, 90, -180, 180))
    p.add_argument("--max-dist", type=float, default=40.0, help="max RGB distance to accept a legend match")
    p.add_argument("--date", default=None)
    p.add_argument("--out", default=None)
    a = p.parse_args()

    if a.csv:
        colours, values = lut_from_csv(a.csv, a.vmin, a.vmax)
    else:
        colours, values = lut_from_colorbar(a.colorbar, a.vmin, a.vmax, a.reverse, a.cbar_crop)

    img = np.asarray(Image.open(a.frame).convert("RGB"))
    px = region_pixels(img, a.region, tuple(a.extent))
    vals, _ = invert(px, colours, values, a.max_dist)
    result = {"frame": a.frame, "date": a.date, "region": a.region,
              "legend": {"vmin": a.vmin, "vmax": a.vmax, "step": a.step},
              **summarise(vals, a.vmin, a.vmax, a.step)}
    print(json.dumps(result, indent=2))
    if a.out:
        with open(a.out, "w") as f:
            json.dump(result, f, indent=2)


if __name__ == "__main__":
    main()
