#!/usr/bin/env python3
"""
Merge the pipeline outputs in data/ into ONE file the web app plays:
  web/data/songs.json  and  web/data/songs.js  (same content; the .js copy lets the
  page work even when opened straight from disk).

Song 1 "Kuching, 2015": 31 weekly steps, Jun-Dec 2015, Borneo window.
Song 2 "The Whole Planet, 2015": 36 monthly steps, Jan 2014-Dec 2016, global.
Usage (from the project root): python3 pipeline/build_songs.py
"""
import json
import os

D = "data"
OUT = "web/data"


def load(p):
    with open(os.path.join(D, p)) as f:
        return json.load(f)


def month_lookup(series, key):
    return {x["month"]: x[key] for x in series}


def song_kuching():
    rain = load("kuching_2015/rain.json")
    fire = load("kuching_2015/fires_weekly.json")
    co2m = month_lookup(load("planet_2015/co2_global_monthly.json")["series"], "ppm")
    weeks = rain["weeks"]
    steps = [w["week_start"] for w in weeks]
    n = min(len(steps), len(fire["steps"]))
    steps = steps[:n]
    fire_area = [s["burning_area_pct"] for s in fire["steps"][:n]]
    fire_int = [s["mean_emission_gC_m2_week"] for s in fire["steps"][:n]]
    rain_mm = [w["rain_mm_per_day"] for w in weeks[:n]]
    co2 = [co2m[d[:7]] for d in steps]
    peak = max(range(n), key=lambda i: fire_area[i])
    driest = min(range(n), key=lambda i: rain_mm[i])
    wettest_late = max(range(n // 2, n), key=lambda i: rain_mm[i])
    rains_back = next(i for i in range(peak, n) if rain_mm[i] >= 12)
    haze = next(i for i, d in enumerate(steps) if d >= "2015-08-24")
    captions = {
        steps[0]: "June 2015. A strong El Niño is building in the Pacific.",
        steps[driest]: "The driest week in Kuching: almost no rain.",
        steps[haze]: "24 August: haze reaches Kuching. Air quality turns unhealthy.",
        steps[peak]: "Fires peak over Borneo: about one fifth of the region is burning.",
        steps[rains_back]: "The monsoon rains return.",
        steps[wettest_late]: "Heavy rain. The fires are almost gone.",
    }
    return {
        "id": "kuching-2015",
        "title": "Kuching, 2015",
        "subtitle": "Fire, rain and carbon over Borneo",
        "place": "Borneo window centred on Sarawak (5°S–8°N, 105°E–120°E)",
        "period": "June – December 2015 · weekly",
        "cover": "assets/cover-kuching.jpg",
        "stepUnit": "week",
        "steps": steps,
        "captions": captions,
        "layers": [
            {
                "id": "fire", "name": "Wildfires", "icon": "🔥", "color": "#FF7A3D",
                "units": "% of the region burning", "values": fire_area, "legendStep": 2.5,
                "intensity": fire_int, "intensityUnits": "g of carbon per m² per week",
                "register": "high", "pan": 0.3,
                "describe": "How much of the Borneo window is burning. Higher note = more fire. A drum hit marks very intense burning (10+ g of carbon per m² per week).",
                "source": {"name": "NASA SVS 5012, Weekly carbon emissions from fires", "url": "https://svs.gsfc.nasa.gov/5012"},
                "sourceKind": "visual",  # numbers decoded from the visualization's colours
                "method": fire["method"],
            },
            {
                "id": "rain", "name": "Rain", "icon": "🌧️", "color": "#4FC3F7",
                "units": "mm per day (Kuching)", "values": rain_mm, "legendStep": 1.0,
                "restBelow": 1.0, "register": "mid", "pan": -0.3,
                "describe": "Average daily rain in Kuching each week. Higher note = more rain. Silence = almost no rain (drought).",
                "source": {"name": "NASA POWER daily point data", "url": rain["url"]},
                "sourceKind": "data",  # NASA data API, no visualization
                "method": "Weekly means of daily NASA POWER values (PRECTOTCORR).",
            },
            {
                "id": "co2", "name": "Carbon dioxide", "icon": "🏭", "color": "#B39DDB",
                "units": "ppm (global monthly)", "values": co2, "legendStep": 1.0,
                "register": "low", "pan": 0.0, "sustain": True,
                "describe": "Carbon dioxide in the air. A slow low drone that steps up when CO₂ rises.",
                "source": {"name": "NASA SVS 5024, AIRS CO₂ (CO2_frames_dates_values.csv)", "url": "https://svs.gsfc.nasa.gov/5024"},
                "sourceKind": "vizdata",  # NASA's own values published with the visualization
                "method": "NASA's own monthly value from the dates CSV, repeated for each week of that month.",
            },
        ],
    }


def song_planet():
    fire = load("planet_2015/fires_global_monthly.json")["months"]
    co2m = month_lookup(load("planet_2015/co2_global_monthly.json")["series"], "ppm")
    sea = month_lookup(load("planet_2015/sea_level_global_monthly.json")["series"], "gmsl_mm")
    steps = [m["month"] for m in fire]
    fire_area = [m["burning_area_pct"] for m in fire]
    fire_int = [m["mean_emission_gC_m2_week"] for m in fire]
    co2 = [co2m[s] for s in steps]
    sl = [sea[s] for s in steps]
    n = len(steps)
    sea_peak = max(range(n), key=lambda i: sl[i])
    fire_peak = max(range(n), key=lambda i: fire_area[i])
    co2_cross = next((i for i in range(n) if co2[i] >= 400), None)
    captions = {
        steps[0]: "January 2014. The whole planet, month by month.",
        steps[fire_peak]: f"{steps[fire_peak][:4]}: the yearly fire season peaks, a little higher than other years.",
        steps[sea_peak]: f"Sea level peaks: +{sl[sea_peak]:.0f} mm compared with 1993.",
        "2016-06": "El Niño fades. Sea level dips back, but CO₂ keeps climbing.",
    }
    if co2_cross is not None:
        captions[steps[co2_cross]] = "Carbon dioxide reaches 400 ppm in NASA's record."
    return {
        "id": "planet-2015",
        "title": "The Whole Planet, 2015",
        "subtitle": "What burns locally echoes globally",
        "place": "Global",
        "period": "January 2014 – December 2016 · monthly",
        "cover": "assets/cover-planet.jpg",
        "stepUnit": "month",
        "steps": steps,
        "captions": captions,
        "layers": [
            {
                "id": "fire", "name": "Wildfires", "icon": "🔥", "color": "#FF7A3D",
                "units": "% of the world's land burning", "values": fire_area, "legendStep": 0.1,
                "intensity": fire_int, "intensityUnits": "g of carbon per m² per week",
                "register": "high", "pan": 0.3,
                "describe": "How much of the world's land (90°N–60°S) is burning each month. Higher note = more fire.",
                "source": {"name": "NASA SVS 5012, Weekly carbon emissions from fires", "url": "https://svs.gsfc.nasa.gov/5012"},
                "sourceKind": "visual",  # numbers decoded from the visualization's colours
                "method": "One mid-month frame of the dated video per month, calibrated to exact EXR frames.",
            },
            {
                "id": "co2", "name": "Carbon dioxide", "icon": "🏭", "color": "#B39DDB",
                "units": "ppm (global monthly)", "values": co2, "legendStep": 1.0,
                "register": "low", "pan": 0.0, "sustain": True,
                "describe": "Carbon dioxide in the air. A slow low drone that steps up as CO₂ rises.",
                "source": {"name": "NASA SVS 5024, AIRS CO₂ (CO2_frames_dates_values.csv)", "url": "https://svs.gsfc.nasa.gov/5024"},
                "sourceKind": "vizdata",  # NASA's own values published with the visualization
                "method": "NASA's own monthly value from the dates CSV.",
            },
            {
                "id": "sea", "name": "Sea level", "icon": "🌊", "color": "#26C6DA",
                "units": "mm above 1993", "values": sl, "legendStep": 1.0,
                "register": "lowmid", "pan": -0.15, "legato": True,
                "describe": "Global mean sea level. Higher note = higher seas.",
                "source": {"name": "NASA GSFC Global Mean Sea Level v5.1 (NASA STEM spreadsheet)", "url": "https://www.nasa.gov/stem-content/sea-level-height-data-set/"},
                "sourceKind": "data",  # NASA data file, no visualization
                "method": "Monthly means of ~10-day satellite values.",
            },
        ],
    }


def main():
    os.makedirs(OUT, exist_ok=True)
    data = {"version": 1, "songs": [song_kuching(), song_planet()]}
    with open(os.path.join(OUT, "songs.json"), "w") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
    with open(os.path.join(OUT, "songs.js"), "w") as f:
        f.write("window.ECHO_SONGS = ")
        json.dump(data, f, ensure_ascii=False)
        f.write(";\n")
    for s in data["songs"]:
        print(s["id"], len(s["steps"]), "steps;", [l["id"] for l in s["layers"]])
        for d, c in sorted(s["captions"].items()):
            print("   ", d, c)


if __name__ == "__main__":
    main()
