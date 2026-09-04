# Field survey — how to collect the light data

`lamps.json` is **empty on purpose.** It is the one dataset nobody else has,
and inventing entries would destroy the only claim that makes this project
worth submitting. Real readings only.

## Why we survey at all

VIIRS — the satellite behind essentially every light-pollution map — records
roughly 500–900 nm and is **blind below 500 nm**. That is exactly where white
LEDs emit most strongly, and exactly the band that predicts migrant collisions.
The standard data cannot see the variable that matters.

LTA already handles street lighting responsibly: 3000K on minor residential
roads, 4000K on arterial roads, nothing above 5000K. The uncontrolled blue
light is everything the government does not own — carpark decks, condo
floodlights, shop facades, signage, sports and construction lighting — **and
none of it is inventoried anywhere.**

That gap is the survey.

## What to photograph

**Skip street lamps.** They will all come back warm and prove nothing.

Target, in a band along one green-space edge:

- Multi-storey carpark decks
- Condo and MCST perimeter floodlights
- Shop facades and illuminated signage
- Sports facilities and courts
- Construction site lighting

## Method

1. Pick **one** reserve or park boundary. Depth beats breadth — a complete
   picture of 300 m of edge is worth more than scattered dots island-wide.
2. Daylight recce: walk it once, note where the lights are.
3. After dark, four people, about two hours. Aim for 30–50 readings.
4. Photograph with your **normal camera app** — it writes GPS into EXIF, so no
   form-filling per lamp.
5. Film some of it. That footage is the strongest 90 seconds of the video.

Go as a group, stay on public paths, and check park closing hours.

## Classifying

Judge by colour, not brightness:

| Looks like | `type` | Bird risk |
|---|---|---|
| Deep orange | `sodium` | Low |
| Yellowish white | `warm-led` | Low |
| Plain white | `neutral-led` | Medium |
| Blue-white glare | `cool-led` | **High** |

## Getting it into the app

Once F9/F10 exist (L4), upload the folder and export. Until then, add entries
to the `lamps` array in `lamps.json` by hand:

```json
{ "lat": 1.3487, "lng": 103.7815, "type": "cool-led", "kind": "carpark", "surveyed": "2026-09-06" }
```

`lightAt()` picks them up with no code change. Locations within 250 m of two or
more surveyed lamps report `confidence: 'measured'`; everywhere else honestly
reports `'estimated'`.
