/**
 * Offline data prep — builds the density grid from real OpenStreetMap
 * building footprints instead of URA land-use zoning.
 *
 *   npm run data:density:osm
 *
 * Why this is better than zoning: zoning describes what is PERMITTED, not what
 * is BUILT. A vacant plot zoned Commercial read as dense. These are actual
 * buildings — 184,823 of them, near-complete coverage for Singapore.
 *
 * Why not simply count them: a 40-storey glass tower and forty shophouses are
 * not the same hazard. What kills birds is glass, and glass area scales with
 * height and with how much of the facade is glazed. So each building gets a
 * hazard weight rather than counting as 1.
 *
 * Output is byte-identical in shape to the zoning version, so densityAt() in
 * score.js needs no change. That was the point of keeping that interface narrow.
 *
 * Source: OpenStreetMap via Overpass API, ODbL.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'

const SRC = './data-raw/osm-buildings.json'
const OUT = './public/data/density-grid.json'

// Must match the zoning grid exactly — densityAt() samples a fixed radius in
// cells, so changing the geometry would silently change the model.
const BBOX = [103.6, 1.15, 104.1, 1.48]
const CELL = 0.0015

/**
 * How glazed is this building type, roughly. Offices are glass walls; HDB
 * blocks are concrete with punched windows; warehouses are metal sheds.
 */
const GLASS = {
  office: 1.0,
  commercial: 1.0,
  retail: 0.95,
  hotel: 0.9,
  civic: 0.8,
  public: 0.8,
  university: 0.75,
  hospital: 0.75,
  school: 0.6,
  apartments: 0.45,
  residential: 0.4,
  dormitory: 0.4,
  terrace: 0.35,
  house: 0.3,
  detached: 0.3,
  semidetached_house: 0.3,
  bungalow: 0.3,
  industrial: 0.3,
  warehouse: 0.25,
  church: 0.4,
  mosque: 0.4,
  temple: 0.4,
  roof: 0.1,
  shed: 0.1,
  garage: 0.1,
  garages: 0.1,
  hut: 0.1,
  construction: 0.3,
  yes: 0.5, // untyped — the largest group, so keep it mid-scale
}

/** Storeys assumed when building:levels is absent (75% of the data). */
const DEFAULT_LEVELS = {
  office: 12,
  commercial: 6,
  retail: 3,
  hotel: 12,
  apartments: 12, // HDB blocks dominate this tag in Singapore
  residential: 8,
  dormitory: 8,
  house: 2,
  detached: 2,
  semidetached_house: 2,
  bungalow: 2,
  terrace: 3,
  industrial: 2,
  warehouse: 1,
  school: 4,
  university: 6,
  hospital: 8,
  civic: 4,
  public: 4,
  roof: 1,
  shed: 1,
  garage: 1,
  garages: 1,
  hut: 1,
  yes: 4,
}

console.log('reading OSM buildings…')
const raw = JSON.parse(readFileSync(SRC, 'utf8'))
const buildings = raw.elements.filter((e) => e.center || (e.lat && e.lon))
console.log(`  ${buildings.length.toLocaleString()} buildings`)

const landFeatures = JSON.parse(
  readFileSync('./scripts/data/land-mask.geojson', 'utf8')
).features
for (const f of landFeatures) {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < x0) x0 = c[0]
      if (c[0] > x1) x1 = c[0]
      if (c[1] < y0) y0 = c[1]
      if (c[1] > y1) y1 = c[1]
    } else c.forEach(walk)
  }
  walk(f.geometry.coordinates)
  f._bbox = [x0, y0, x1, y1]
}
function onLand(lat, lng) {
  const pt = point([lng, lat])
  for (const f of landFeatures) {
    const [x0, y0, x1, y1] = f._bbox
    if (lng < x0 || lng > x1 || lat < y0 || lat > y1) continue
    if (booleanPointInPolygon(pt, f)) return true
  }
  return false
}

const [minLng, minLat, maxLng, maxLat] = BBOX
const cols = Math.ceil((maxLng - minLng) / CELL)
const rows = Math.ceil((maxLat - minLat) / CELL)
console.log(`grid ${cols} x ${rows} = ${(cols * rows).toLocaleString()} cells`)

// --- accumulate hazard per cell ---------------------------------------------
const hazard = new Float64Array(cols * rows)
let placed = 0

for (const b of buildings) {
  const lat = b.center?.lat ?? b.lat
  const lng = b.center?.lon ?? b.lon
  if (lat == null || lng == null) continue

  const cx = Math.floor((lng - minLng) / CELL)
  const cy = Math.floor((lat - minLat) / CELL)
  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue

  const type = b.tags?.building || 'yes'
  const glass = GLASS[type] ?? GLASS.yes

  const tagged = parseFloat(b.tags?.['building:levels'])
  const levels =
    Number.isFinite(tagged) && tagged > 0 && tagged < 200
      ? tagged
      : (DEFAULT_LEVELS[type] ?? DEFAULT_LEVELS.yes)

  hazard[cy * cols + cx] += levels * glass
  placed++
}
console.log(`  ${placed.toLocaleString()} buildings placed into cells`)

// --- normalise ---------------------------------------------------------------
// Against a high percentile, not the maximum. A single dense CBD cell would
// otherwise flatten the rest of the island to nothing — the same mistake the
// risk surface made before it was calibrated against the band threshold.
const occupied = Array.from(hazard).filter((v) => v > 0).sort((a, b) => a - b)
const p = (q) => occupied[Math.floor((occupied.length - 1) * q)]
console.log(
  `hazard per occupied cell — p50 ${p(0.5).toFixed(0)}  p90 ${p(0.9).toFixed(0)}` +
    `  p99 ${p(0.99).toFixed(0)}  max ${occupied[occupied.length - 1].toFixed(0)}`
)
// Square-root transform, not linear. Building hazard is spiky and long-tailed
// — p50 is 11 and the max is 480 — so a linear scale against any high
// percentile crushes ordinary urban cells to near zero. sqrt compresses the
// tail while keeping the ordering, which is the standard fix for this shape.
const ceiling = p(0.99)

// Deadband. sqrt lifts the low end usefully for ordinary streets, but it also
// amplifies trace hazard — a visitor centre inside Bukit Timah was scoring the
// middle of a nature reserve at 23/100. Below roughly one small building's
// worth of storey-equivalents in a cell, there is nothing meaningful to hit.
const DEADBAND = 4

console.log(`sqrt-normalising against p99 = ${ceiling.toFixed(0)}, deadband ${DEADBAND}`)

const data = new Array(cols * rows).fill(-1)
let masked = 0
let built = 0

for (let cy = 0; cy < rows; cy++) {
  for (let cx = 0; cx < cols; cx++) {
    const i = cy * cols + cx
    const lat = minLat + (cy + 0.5) * CELL
    const lng = minLng + (cx + 0.5) * CELL
    if (!onLand(lat, lng)) {
      masked++
      continue
    }
    const v =
      hazard[i] < DEADBAND ? 0 : Math.min(1, Math.sqrt(hazard[i] / ceiling))
    data[i] = Math.round(v * 100)
    if (data[i] > 0) built++
  }
}

console.log(
  `${masked.toLocaleString()} cells masked as sea, ${built.toLocaleString()} with buildings`
)

writeFileSync(
  OUT,
  JSON.stringify({
    note: 'Density 0-100 per cell, -1 = no data. Built by scripts/build-density-grid-osm.mjs from OpenStreetMap building footprints (ODbL). Weighted by storeys x facade glazing, not raw building count.',
    source: 'OpenStreetMap via Overpass API',
    licence: 'ODbL',
    bbox: BBOX,
    cell: CELL,
    cols,
    rows,
    data,
  })
)
console.log(`wrote ${OUT}`)
