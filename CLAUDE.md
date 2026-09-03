# Nightjar — notes for AI assistants

Bird-collision risk map for Singapore. NextStep Hacks 2026, theme *Earth Forward*.
Team of four undergraduates. **Submitting Sat 12 Sep** (deadline is the 13th; we
ship a day early). Feature freeze **Wed 9 Sep**.

Read `docs/PROJECT_SCOPE.md` for the plan and `docs/BIRD_LIGHT_REFERENCE.md` for
the facts and sources behind the model.

---

## First thing, every time

**Run `npm install` after pulling.** Dependencies change often right now and a
stale `node_modules` produces confusing missing-module errors.

Requires Node 18+ (built on 24.19.0). On Windows, `&&` does not work in
PowerShell 5.1 — run commands separately or chain with `;`.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # must stay green
```

---

## The contract — do not change without telling the team

`scoreLocation(lat, lng)` in `src/lib/score.js` is consumed by three separate
lanes working in parallel. Changing its **shape** breaks all of them.

```js
{
  total: 0-100,
  band: 'low' | 'moderate' | 'high',
  factors: {
    habitat: { value, weight, note },   // value 0-1
    light:   { value, weight, note },
    density: { value, weight, note },
  },
  isMock: true    // remove when the real model lands
}
```

It is **synchronous** and must stay synchronous. Load GeoJSON once at app start
into a module-level variable; do not make this function async.

---

## House rules

1. **No component defines its own colour.** Everything comes from
   `src/styles/tokens.css`. Need a new hue? Add a token, tell the team. Never a
   hex code in a component.
2. **No magic numbers.** All weights and thresholds live in `src/lib/config.js`.
3. **Risk is never colour alone.** `RiskPill` always carries a text label —
   colourblind users must be able to read severity.
4. **Nothing leaves the device.** Photos and reports go to `localStorage` only,
   wrapped in try/catch (private windows throw). The UI says so.
5. **No runtime dependency that can fail during judging.** Geodata is committed
   as static files. OneMap geocoding is the sole live call and must degrade to
   map-click if unreachable.
6. **Commit simplified geodata, never raw downloads.** `data-raw/` is gitignored.

---

## Lanes

| Lane | Owns | Files |
|---|---|---|
| **L1** Data & Model | scoring, geodata, config | `src/lib/`, `public/data/` |
| **L2** Map | Leaflet, risk layer, click, search | `src/features/map/` |
| **L3** Result & Guidance | panel, recommendations, methodology | `src/features/result/` |
| **L4** Capture | EXIF, lamp classifier, reporting | `src/features/capture/` |

Stay in your lane's directory. `src/lib/config.js` and `score.js` are L1's — flag
changes at standup rather than editing quietly.

---

## Current state (3 Sep)

**Real and working — two of three factors:**

- `public/data/green-spaces.geojson` — 461 NParks polygons, all 7 nature
  reserves. Simplified 2.9 MB → 419 KB. Rebuild: `npm run data:simplify`.
- `public/data/density-grid.json` — 334×221 grid at ~165 m, built from the
  180 MB URA Master Plan land-use layer. 210 KB, O(1) lookup.
  Rebuild: `npm run data:density`.
- `scoreLocation` computes real habitat and density. ~2.5 ms per call.

- `lightAt()` reads `public/data/lamps.json` — inverse-distance weighted over
  lamps within 250 m, and it reports its own `confidence`: `'measured'` when
  two or more surveyed lamps are nearby, `'estimated'` otherwise.

**Waiting on data, not code:** `lamps.json` is **empty on purpose** until the
field survey. Do NOT seed it with invented entries — the survey is the only
dataset nobody else has, and fabricating it would destroy the project's central
claim. See `public/data/SURVEY.md` for how to collect it. Until then every
score carries `isMock: true` and the UI must say the light value is estimated.

**The model** — see MODEL in `config.js`:

```
risk = sqrt(habitat x density) x (lightFloor + (1 - lightFloor) x light)
```

Multiplicative, not a weighted sum. Both habitat and density are required —
either at zero means zero risk. The square root is a geometric mean, needed
because a plain product of two sub-1 values never reaches the risk bands.

Sanity check (`node spike-score.mjs`): Botanic Gardens edge 55 (big green
space ringed by dense development), Bukit Timah interior 0 (nothing to hit),
Sungei Buloh 0 (remote), CBD 21 (dense but little habitat).

**Not started:** everything in `src/features/` is an empty shell. Every stub
carries `TODO(lane · requirement)` comments.

---

## Gotchas that have already bitten us

- **GeoJSON is `[lng, lat]`, not `[lat, lng]`.** Every turf call takes
  `point([lng, lat])`. This will catch you at least once.
- **Browser can't `readFileSync`.** The spikes are Node scripts. In the app,
  `fetch('/data/green-spaces.geojson')` — and that's async, so load it once at
  startup rather than per click.
- **Naive polygon scan is too slow.** Checking all 461 polygons per click is
  ~13.6 ms. Precompute a bounding box per polygon at load, sort candidates by
  cheap bbox distance, skip any whose bbox already exceeds the best real distance
  found → **0.3 ms**. Keep this optimisation.
- **Habitat risk peaks AT the boundary**, decaying both inward and outward. Deep
  inside a reserve there are no buildings to strike; far outside there are no
  birds. This is the core modelling idea — don't "fix" it into a simple
  distance-from-park.
- **Not all green space is habitat.** A CBD ornamental plaza currently scores as
  highly as a reserve edge. Use `SHAPE_1.AREA` and `N_RESERVE` from the polygon
  properties to weight this. Unresolved as of 3 Sep.

---

## Out of scope — do not build these

Considered and rejected as research projects, not eight-day projects:
migration forecasting · acoustic monitoring · audio ML · satellite imagery
processing · camera photometry or spectrometry · training any model · backend or
database · user accounts · native app.

If a change needs one of these, it is out of scope. Say so.

---

## Honesty requirements

These are load-bearing for judging and must not be softened:

- We did **not** discover the collision drivers. A peer-reviewed study did
  (Conservation Biology 38, e14255, 2024). We operationalise it, and cite it.
- The risk score is a **weighted heuristic**, not a validated model. The UI must
  never present it as a prediction.
- We hold **no collision data of our own**. The reporting feature demonstrates
  the concept.
- Everything was built during the hackathon; the repo was empty before 21 Aug.

Do not write marketing copy that overstates any of this.
