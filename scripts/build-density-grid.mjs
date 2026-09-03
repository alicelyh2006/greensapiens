/**
 * Offline data prep — turns URA Master Plan land-use parcels into a compact
 * density grid the browser can use with an O(1) lookup.
 *
 *   node --max-old-space-size=8192 scripts/build-density-grid.mjs \
 *     data-raw/landuse-raw.geojson public/data/density-grid.json
 *
 * Why a grid: the source is 180 MB / 113,394 parcels. Dissolved by zone it is
 * still 15 MB, because residential zoning is thousands of scattered islands.
 * A grid drops it to a few hundred KB and makes lookups constant-time.
 *
 * TODO(path B): rebuild this same grid from OpenStreetMap building counts
 * instead of zoning. Nothing in the app changes — only this script and the
 * file it writes.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'

import { ZONE_DENSITY, DENSITY_FALLBACK } from '../src/lib/config.js'

const [, , SRC, OUT] = process.argv
if (!SRC || !OUT) {
  console.error('usage: build-density-grid.mjs <source.geojson> <out.json>')
  process.exit(1)
}

// Singapore, generously bounded. ~0.0015 deg is about 165 m here.
const BBOX = [103.6, 1.15, 104.1, 1.48]
const CELL = 0.0015

const [minLng, minLat, maxLng, maxLat] = BBOX
const cols = Math.ceil((maxLng - minLng) / CELL)
const rows = Math.ceil((maxLat - minLat) / CELL)
console.log(`grid ${cols} x ${rows} = ${(cols * rows).toLocaleString()} cells`)

console.log('reading source…')
const gj = JSON.parse(readFileSync(SRC, 'utf8'))
console.log(`parcels: ${gj.features.length.toLocaleString()}`)

/** Resolve a zone name to its density weight, first substring match wins. */
function zoneWeight(desc) {
  if (!desc) return null
  const upper = String(desc).toUpperCase()
  const hit = ZONE_DENSITY.find(([term]) => upper.includes(term))
  return hit ? hit[1] : null
}

// --- pass 1: spatial hash. Which parcels could cover which cells? -----------
console.log('pass 1 — bucketing parcels by cell…')
const buckets = new Map() // cellIndex -> [parcelIndex, …]
const parcels = []

for (const f of gj.features) {
  const w = zoneWeight(f.properties.LU_DESC)
  if (w === null) continue

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
  if (x1 < minLng || x0 > maxLng || y1 < minLat || y0 > maxLat) continue

  const idx = parcels.length
  parcels.push({ geom: f, weight: w })

  const cx0 = Math.max(0, Math.floor((x0 - minLng) / CELL))
  const cx1 = Math.min(cols - 1, Math.floor((x1 - minLng) / CELL))
  const cy0 = Math.max(0, Math.floor((y0 - minLat) / CELL))
  const cy1 = Math.min(rows - 1, Math.floor((y1 - minLat) / CELL))
  for (let cy = cy0; cy <= cy1; cy++) {
    for (let cx = cx0; cx <= cx1; cx++) {
      const key = cy * cols + cx
      const b = buckets.get(key)
      if (b) b.push(idx)
      else buckets.set(key, [idx])
    }
  }
}
console.log(`  ${parcels.length.toLocaleString()} parcels kept, ${buckets.size.toLocaleString()} cells touched`)

// --- pass 2: exact point-in-polygon at each cell centre ---------------------
console.log('pass 2 — testing cell centres…')
const data = new Array(cols * rows).fill(-1) // -1 = no data (sea, out of plan)
let done = 0

for (const [key, candidates] of buckets) {
  const cx = key % cols
  const cy = Math.floor(key / cols)
  const pt = point([minLng + (cx + 0.5) * CELL, minLat + (cy + 0.5) * CELL])

  // highest-density match wins, so a dense parcel is not masked by a road
  let best = -1
  for (const i of candidates) {
    const p = parcels[i]
    if (p.weight * 100 <= best) continue
    if (booleanPointInPolygon(pt, p.geom)) best = Math.round(p.weight * 100)
  }
  if (best >= 0) data[key] = best

  if (++done % 20000 === 0) console.log(`  ${done.toLocaleString()} / ${buckets.size.toLocaleString()}`)
}

const covered = data.filter((v) => v >= 0).length
console.log(`covered ${covered.toLocaleString()} cells (${((covered / data.length) * 100).toFixed(1)}%)`)

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(
  OUT,
  JSON.stringify({
    note: 'Density 0-100 per cell, -1 = no data. Built by scripts/build-density-grid.mjs from URA Master Plan land use.',
    bbox: BBOX,
    cell: CELL,
    cols,
    rows,
    fallback: DENSITY_FALLBACK,
    data,
  })
)
console.log(`wrote ${OUT}`)
