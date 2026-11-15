#!/usr/bin/env python3
"""
Build extra jukebox albums from real NASA events (task 2.20).

For each event: read its date and place from NASA EONET, then fetch NASA POWER daily
weather at that place from 8 weeks before to 8 weeks after the event start, and average
it per week. Same method as the live Studio (web/js/live.js), but run once offline so the
albums are bundled and play without internet.

Outputs:
  web/data/event_songs.json   songs in the same shape as songs.json
  web/data/event_songs.js     same content; adds the songs to window.ECHO_SONGS
  raw/events/<id>_eonet.json, raw/events/<id>_power.json   the exact NASA responses

Usage (from the project root): python -X utf8 pipeline/build_event_songs.py
  Rebuilds from the saved NASA responses in raw/events/; add --refresh to download them again (needs internet).
Code written with AI assistance (Claude, Anthropic).
"""
import datetime as dt
import json
import os
import sys
import urllib.request

EONET = "https://eonet.gsfc.nasa.gov/api/v3/events/"
POWER = "https://power.larc.nasa.gov/api/temporal/daily/point"
WEEKS_BEFORE, WEEKS_AFTER = 8, 8
RAW, OUT = "raw/events", "web/data"

# Layer definitions: keep in step with PARAMS in web/js/live.js.
PARAMS = {
    "rain": dict(param="PRECTOTCORR", name="Rain", icon="🌧️", color="#4FC3F7", units="mm per day",
                 register="mid", pan=-0.3, legendStep=1.0, restBelow=1.0,
                 describe="Daily rain, averaged per week. Higher notes mean more rain; silence means almost none (below 1 mm per day)."),
    "temp": dict(param="T2M", name="Temperature", icon="🌡️", color="#FF8A65", units="°C at 2 m",
                 register="high", pan=0.3, legendStep=0.5,
                 describe="Air temperature 2 m above the ground, averaged per week. Higher notes mean warmer."),
    "humidity": dict(param="RH2M", name="Humidity", icon="💧", color="#80CBC4", units="% relative humidity",
                     register="lowmid", pan=-0.15, legendStep=2.0, legato=True,
                     describe="How moist the air is, averaged per week. Higher notes mean more humid; dry air gives low notes."),
    "wind": dict(param="WS10M", name="Wind", icon="🌬️", color="#E6EE9C", units="m/s at 10 m",
                 register="low", pan=0.15, legendStep=0.5,
                 describe="Wind speed 10 m above the ground, averaged per week. Higher notes mean stronger wind."),
}

# The albums (Conductor's choice, 15 Nov). place=None → use EONET's own point / area centre.
EVENTS = [
    dict(id="EONET_212", song_id="pacific-drought-2015", title="Pacific Drought, 2015",
         subtitle="El Niño's dry side, in Fiji", layers=["rain", "humidity", "temp"], place_name="Viti Levu, Fiji",
         place=dict(lat=-17.8, lon=178.0,
                    why="Viti Levu, Fiji. EONET's area covers the whole western Pacific (mostly ocean); its only source is the ReliefWeb Fiji drought report, so we listen in Fiji")),
    dict(id="EONET_259", song_id="south-america-floods-2015", title="South America Floods, 2015",
         subtitle="El Niño's wet side: too much rain", layers=["rain", "humidity", "temp"], place=None,
         place_name="Uruguay River, Uruguay–Argentina border"),
    dict(id="EONET_4542", song_id="nsw-fires-2019", title="Black Summer, 2019",
         subtitle="Fire weather in New South Wales, Australia", layers=["temp", "humidity", "wind"], place=None,
         place_name="Northern New South Wales, Australia"),
]


REFRESH = "--refresh" in sys.argv  # default: rebuild from the saved NASA responses in raw/events/


def get_json(url, save_as):
    if not REFRESH and os.path.exists(save_as):
        with open(save_as, encoding="utf-8") as f:
            return json.load(f)
    with urllib.request.urlopen(url, timeout=90) as r:
        data = json.load(r)
    with open(save_as, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    return data


def area_centre(ring):
    lons = [p[0] for p in ring]
    if max(lons) - min(lons) > 180:  # crosses the date line
        lons = [x + 360 if x < 0 else x for x in lons]
    lon = sum(lons) / len(lons)
    lon = lon - 360 if lon > 180 else lon
    return sum(p[1] for p in ring) / len(ring), lon


def latlon(lat, lon):
    return f"{abs(lat)}°{'S' if lat < 0 else 'N'}, {abs(lon)}°{'W' if lon < 0 else 'E'}"


def fmt(d):
    return f"{d.day} {d.strftime('%b %Y')}"


def build(spec):
    ev = get_json(EONET + spec["id"], os.path.join(RAW, f"{spec['id']}_eonet.json"))
    geo = sorted(ev["geometry"], key=lambda g: g["date"])
    start = dt.date.fromisoformat(geo[0]["date"][:10])
    closed = dt.date.fromisoformat(ev["closed"][:10]) if ev.get("closed") else None
    if spec["place"]:
        lat, lon, where = spec["place"]["lat"], spec["place"]["lon"], spec["place"]["why"]
    elif geo[0]["type"] == "Point":
        lon, lat = geo[0]["coordinates"]
        where = "the point where EONET reports the event"
    else:
        lat, lon = area_centre(geo[0]["coordinates"][0])
        where = "the centre of the area EONET reports"
    lat, lon = round(lat, 2), round(lon, 2)

    first = start - dt.timedelta(weeks=WEEKS_BEFORE)
    n = WEEKS_BEFORE + WEEKS_AFTER + 1
    last = first + dt.timedelta(days=7 * n - 1)
    params = ",".join(PARAMS[k]["param"] for k in spec["layers"])
    url = (f"{POWER}?parameters={params}&community=AG&longitude={lon}&latitude={lat}"
           f"&start={first:%Y%m%d}&end={last:%Y%m%d}&format=JSON")
    pw = get_json(url, os.path.join(RAW, f"{spec['id']}_power.json"))
    P, fill = pw["properties"]["parameter"], pw["header"].get("fill_value", -999)

    steps = [first + dt.timedelta(weeks=w) for w in range(n)]

    def weekly(param):
        out = []
        for s in steps:
            xs = [P[param].get(f"{s + dt.timedelta(days=d):%Y%m%d}") for d in range(7)]
            xs = [x for x in xs if x is not None and x != fill]
            out.append(round(sum(xs) / len(xs), 2) if len(xs) >= 4 else None)
        return out

    def step_of(d):
        return max(i for i, s in enumerate(steps) if s <= d) if d >= steps[0] else None

    title = ev["title"]
    captions = {steps[0].isoformat(): f"Eight weeks before: {title}."}
    captions[steps[step_of(start)].isoformat()] = f"{fmt(start)}: {title} begins (NASA EONET)."
    if closed and closed <= steps[-1] + dt.timedelta(days=6) and step_of(closed) > step_of(start):
        captions[steps[step_of(closed)].isoformat()] = f"{fmt(closed)}: EONET closes the event."

    layers = []
    for k in spec["layers"]:
        p = dict(PARAMS[k])
        param = p.pop("param")
        layers.append(dict(id=k, **p, values=weekly(param),
                           source=dict(name=f"NASA POWER daily API ({param}), {lat}°, {lon}°", url=url),
                           sourceKind="data",  # NASA data API, no visualization
                           method=(f"Daily {param} from NASA POWER (satellite and MERRA-2 model estimates on a grid of about 50 km) "
                                   f"at {lat}°, {lon}°: {where}. Averaged per week (at least 4 days needed). "
                                   f"Event date and place from NASA EONET {spec['id']}. Built by pipeline/build_event_songs.py.")))
    srcs = ", ".join(f'<a href="{s["url"]}" target="_blank" rel="noopener">{s["id"]}</a>' for s in ev.get("sources", []))
    return dict(
        id=spec["song_id"], title=spec["title"], subtitle=spec["subtitle"],
        place=f"{spec['place_name']} ({latlon(lat, lon)})", period=f"{fmt(steps[0])} – {fmt(steps[-1])} · weekly",
        cover="", stepUnit="week", steps=[s.isoformat() for s in steps], captions=captions,
        event=dict(id=spec["id"], title=title, date=start.isoformat(), link=ev["link"],
                   description=ev.get("description")),
        intro="This album was built from NASA's EONET event list and NASA POWER weather data (pipeline/build_event_songs.py).",
        limits=[
            "NASA POWER values are satellite and MERRA-2 model estimates on a grid of about 50 km, not weather-station readings.",
            f"You hear the weather at {lat}°, {lon}° ({where}), from 8 weeks before to 8 weeks after the event started. "
            "EONET gives the event's place and date only, so the event itself (fire, flood water, crop loss) is not measured here.",
            "Weekly means of daily values; a week with fewer than 4 days of data is left silent.",
            "Each line is scaled to its own range, so pitch shows relative change. Exact values are in the mixer and the data table.",
            f'Event from <a href="{ev["link"]}" target="_blank" rel="noopener">NASA EONET {spec["id"]}</a>' + (f" (sources: {srcs})." if srcs else "."),
        ],
        layers=layers,
    )


def main():
    os.makedirs(RAW, exist_ok=True)
    songs = [build(s) for s in EVENTS]
    data = {"version": 1, "built": dt.date.today().isoformat(), "songs": songs}
    with open(os.path.join(OUT, "event_songs.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, "event_songs.js"), "w", encoding="utf-8") as f:
        f.write("/* Generated by pipeline/build_event_songs.py: extra albums from NASA EONET + POWER. */\n")
        f.write("window.ECHO_SONGS.songs.push(...(" + json.dumps(data, ensure_ascii=False) + ").songs);\n")
    for s in songs:
        print(s["id"], s["period"], s["place"])
        for l in s["layers"]:
            v = [x for x in l["values"] if x is not None]
            print(f"   {l['id']:9s} min {min(v):7.2f} max {max(v):7.2f}  nulls {l['values'].count(None)}")


if __name__ == "__main__":
    main()
