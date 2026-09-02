# Static geodata

**Committed on purpose.** N1 requires no runtime dependency that can fail during
judging, so every dataset the app reads lives here as a static file rather than
being fetched from an API at load time.

OWNER: L1 (Data & Model)

## Expected files

| File | Contents | Source |
|---|---|---|
| `green-spaces.geojson` | Parks, reserves, park connectors — **simplified** | data.gov.sg (NParks) |
| `light.json` | VIIRS radiance on a coarse grid over Singapore | VIIRS Day/Night Band |
| `density.json` | Building density per cell | OneMap SG |
| `lamps.json` | Our own field survey classifications | This team |

## Before committing geometry

N2 requires the app to load in under 3 seconds on a phone. Raw NParks boundary
files will be far too large for that.

Simplify first — [mapshaper](https://mapshaper.org) will do it in a browser:

```
mapshaper raw.geojson -simplify 5% keep-shapes -o green-spaces.geojson
```

Check the output size before committing. If it is over a couple of MB, simplify
harder. Nobody can see 1-metre boundary precision at zoom 12.

Keep raw downloads out of the repo — `data-raw/` is gitignored.
