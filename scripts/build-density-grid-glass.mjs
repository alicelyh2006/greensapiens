/**
 * Offline data prep — build the density grid from GLASS AREA rather than a
 * per-building constant.
 *
 *   node scripts/build-density-grid-glass.mjs
 *
 * Why. The collision literature is consistent that glass area is the single
 * strongest predictor of bird-window collisions: a 10% increase in glass tracks
 * roughly a 19% increase in collisions, and it is the only factor that stays
 * significant across seasons. The previous build had no size information at
 * all — hazard was min(storeys, 6) x glazing, so a five-storey shophouse and a
 * five-storey shopping mall scored identically. Footprint area was simply
 * absent from the model.
 *
 * With footprint geometry we can approximate the real quantity:
 *
 *   glass area = perimeter x facade height x glazing fraction
 *
 * Facade height stays capped at COLLISION_HEIGHT_LEVELS storeys, for the same
 * reason as before: birds near forest edges fly low, and the study this project
 * is built on recommends prioritising buildings under 20 m.
 *
 * Source: OpenStreetMap via Overpass API, ODbL.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'

const SRC = './data-raw/osm-buildings-geom.json'
const OUT = './public/data/density-grid.json'

const BBOX = [103.6, 1.15, 104.1, 1.48]
const CELL = 0.0015

/** Storeys above which extra height stops adding collision hazard (~20 m). */
const COLLISION_HEIGHT_LEVELS = 6
const METRES_PER_LEVEL = 3.2

/** How glazed each building type's facade typically is. */
const GLASS = {
  office: 1.0, commercial: 1.0, retail: 0.95, hotel: 0.9, civic: 0.8,
  public: 0.8, university: 0.75, hospital: 0.75, school: 0.6,
  apartments: 0.45, residential: 0.4, dormitory: 0.4, terrace: 0.35,
  house: 0.3, detached: 0.3, semidetached_house: 0.3, bungalow: 0.3,
  industrial: 0.3, warehouse: 0.25, church: 0.4, mosque: 0.4, temple: 0.4,
  roof: 0.1, shed: 0.1, garage: 0.1, garages: 0.1, hut: 0.1,
  construction: 0.3, yes: 0.5,
  // A ruin has no glass. Bukit Timah's interior was scoring 21/100 partly off
  // a ruin, two forest huts and a VHF station.
  ruins: 0.0, tower: 0.1, service: 0.1, toilets: 0.1, kiosk: 0.3,
}

/** Storeys assumed when building:levels is absent. */
const DEFAULT_LEVELS = {
  office: 12, commercial: 6, retail: 3, hotel: 12, apartments: 12,
  residential: 8, dormitory: 8, house: 2, detached: 2,
  semidetached_house: 2, bungalow: 2, terrace: 3, industrial: 2,
  warehouse: 1, school: 4, university: 6, hospital: 8, civic: 4,
  public: 4, roof: 1, shed: 1, garage: 1, garages: 1, hut: 1, yes: 4,
}

console.log('reading OSM buildings with geometry…')
const raw = JSON.parse(readFileSync(SRC, 'utf8'))
const buildings = raw.elements.filter((e) => e.geometry?.length >= 3)
console.log(`  ${buildings.length.toLocaleString()} buildings with footprints`)

/** Perimeter of a ring in metres, using a local equirectangular approximation. */
function perimetreM(geom) {
  let p = 0
  for (let i = 1; i < geom.length; i++) {
    const a = geom[i - 1], b = geom[i]
    const dLat = (b.lat - a.lat) * 111320
    const dLng = (b.lon - a.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180)
    p += Math.hypot(dLat, dLng)
  }
  return p
}

function centroid(geom) {
  let lat = 0, lon = 0
  for (const g of geom) { lat += g.lat; lon += g.lon }
  return { lat: lat / geom.length, lon: lon / geom.length }
}

const landFeatures = JSON.parse(
  readFileSync('./scripts/data/land-mask.geojson', 'utf8')
).features
for (const f of landFeatures) {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]
      if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1]
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

const hazard = new Float64Array(cols * rows)
let placed = 0, totalGlass = 0

for (const b of buildings) {
  const c = centroid(b.geometry)
  const cx = Math.floor((c.lon - minLng) / CELL)
  const cy = Math.floor((c.lat - minLat) / CELL)
  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue

  const type = b.tags?.building || 'yes'
  const glazing = GLASS[type] ?? GLASS.yes

  const taggedH = parseFloat(b.tags?.height)
  const taggedL = parseFloat(b.tags?.['building:levels'])
  const perimetre = perimetreM(b.geometry)
  // An untagged `building=yes` defaults to 4 storeys, which is reasonable for a
  // shophouse and absurd for a forest shelter. Below roughly a 12 x 12 m
  // footprint, treat an untyped building as single-storey: at that size it is a
  // hut, a substation or a pump house, not a block.
  const smallUntyped = type === 'yes' && perimetre < 50
  const levels =
    Number.isFinite(taggedL) && taggedL > 0 && taggedL < 200
      ? taggedL
      : smallUntyped
        ? 1
        : (DEFAULT_LEVELS[type] ?? DEFAULT_LEVELS.yes)
  // A tagged height wins where present, but is still capped at the flight path.
  const metres = Number.isFinite(taggedH) && taggedH > 0 && taggedH < 600
    ? Math.min(taggedH, COLLISION_HEIGHT_LEVELS * METRES_PER_LEVEL)
    : Math.min(levels, COLLISION_HEIGHT_LEVELS) * METRES_PER_LEVEL

  const glassArea = perimetre * metres * glazing
  hazard[cy * cols + cx] += glassArea
  totalGlass += glassArea
  placed++
}
console.log(`  ${placed.toLocaleString()} buildings placed`)
console.log(`  ${(totalGlass / 1e6).toFixed(1)} million m2 of modelled glass facade`)

const occupied = Array.from(hazard).filter((v) => v > 0).sort((a, b) => a - b)
const p = (q) => occupied[Math.floor((occupied.length - 1) * q)]
console.log(
  `glass m2 per occupied cell — p50 ${p(0.5).toFixed(0)}  p90 ${p(0.9).toFixed(0)}` +
    `  p99 ${p(0.99).toFixed(0)}  max ${occupied[occupied.length - 1].toFixed(0)}`
)

const ceiling = p(0.99)
// Deadband in square metres of glass rather than storey-equivalents. One small
// shophouse frontage is on the order of 100 m2; below that there is nothing
// meaningful in the cell to hit.
const DEADBAND = 150
console.log(`sqrt-normalising against p99 = ${ceiling.toFixed(0)} m2, deadband ${DEADBAND} m2`)

const data = new Array(cols * rows).fill(-1)
let masked = 0, built = 0
for (let cy = 0; cy < rows; cy++) {
  for (let cx = 0; cx < cols; cx++) {
    const i = cy * cols + cx
    const lat = minLat + (cy + 0.5) * CELL
    const lng = minLng + (cx + 0.5) * CELL
    if (!onLand(lat, lng)) { masked++; continue }
    const v = hazard[i] < DEADBAND ? 0 : Math.min(1, Math.sqrt(hazard[i] / ceiling))
    data[i] = Math.round(v * 100)
    if (data[i] > 0) built++
  }
}
console.log(`${masked.toLocaleString()} cells masked as sea, ${built.toLocaleString()} with buildings`)

writeFileSync(OUT, JSON.stringify({
  note: 'Density 0-100 per cell = modelled GLASS AREA, the strongest predictor of bird-window collisions in the literature. Built by scripts/build-density-grid-glass.mjs from OpenStreetMap footprints (ODbL): perimeter x facade height x glazing fraction, with height capped at the bird flight path.',
  source: 'OpenStreetMap via Overpass API',
  licence: 'ODbL',
  bbox: BBOX, cell: CELL, cols, rows, data,
}))
console.log(`wrote ${OUT}`)
