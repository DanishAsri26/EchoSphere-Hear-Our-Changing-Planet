#!/usr/bin/env python3
"""
NASA SVS 5024 AIRS CO2 monthly frames (720x480) -> CO2 (ppm) for the Borneo window,
plus the global monthly value straight from NASA's CO2_frames_dates_values.csv.

Frame layout (measured): title bar rows 0-42, global equirectangular map rows 43-402
(720x360), colorbar strip below. Legend: 365-435 ppm, light yellow -> dark red.
Hatched "low data quality" lines are dark and do not match the legend, so they drop out.
Usage: python3 co2_borneo.py
"""
import csv, json, glob, re
import numpy as np
from PIL import Image

MAP_TOP, MAP_BOTTOM = 43, 403
REGION = (-5.0, 8.0, 105.0, 120.0)

def lut(path="raw/greenhouse_gases/airsco2_colorbar_1000x200.png", row=110, x0=65, x1=895):
    a = np.asarray(Image.open(path).convert("RGB")).astype(float)[row, x0:x1 + 1]
    keep = a.sum(1) > 60                      # drop black border pixels
    xs = np.arange(x0, x1 + 1)[keep]
    first, last = xs.min(), xs.max()
    return a[keep], 365 + (xs - first) / (last - first) * (435 - 365)

def window(mapimg):
    h, w, _ = mapimg.shape
    lat0, lat1, lon0, lon1 = REGION
    return mapimg[int((90 - lat1) / 180 * h):int((90 - lat0) / 180 * h), int((lon0 + 180) / 360 * w):int((lon1 + 180) / 360 * w)]

def main():
    colours, values = lut()
    dates = {}
    with open("raw/greenhouse_gases/CO2_frames_dates_values.csv") as f:
        for row in csv.reader(f):
            if row and row[0].endswith(".png"):
                dates[row[0]] = (int(row[1]), int(row[2]), float(row[3]))
    rows = []
    for path in sorted(glob.glob("raw/greenhouse_gases/global_co2_airs_720x480.*.png")):
        name = path.split("/")[-1]
        y, m, glob_ppm = dates[name]
        img = np.asarray(Image.open(path).convert("RGB")).astype(float)[MAP_TOP:MAP_BOTTOM]
        px = window(img).reshape(-1, 3)
        d = np.linalg.norm(px[:, None] - colours[None], axis=2)
        best = d.argmin(1); ok = d[np.arange(len(px)), best] < 30
        rows.append({"frame": name, "month": f"{y}-{m:02d}", "global_ppm_nasa_csv": glob_ppm,
                     "borneo_ppm_decoded": round(float(values[best][ok].mean()), 1),
                     "valid_pct": round(100 * ok.mean(), 1)})
        print(rows[-1])
    with open("data/kuching_2015/co2.json", "w") as f:
        json.dump({"source": "NASA SVS 5024, AIRS Global CO2 (2002-Oct 2022), monthly frames + CO2_frames_dates_values.csv",
                   "url": "https://svs.gsfc.nasa.gov/5024", "units": "ppm", "region": "Borneo window lat -5..8, lon 105..120",
                   "months": rows}, f, indent=2)
    series = [{"month": f"{y}-{m:02d}", "ppm": v} for (y, m, v) in sorted(dates.values())]
    with open("data/planet_2015/co2_global_monthly.json", "w") as f:
        json.dump({"source": "NASA SVS 5024 CO2_frames_dates_values.csv", "url": "https://svs.gsfc.nasa.gov/5024",
                   "units": "ppm", "series": series}, f, indent=2)

if __name__ == "__main__":
    main()
