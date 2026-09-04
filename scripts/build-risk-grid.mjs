/**
 * Offline data prep — precomputes the risk surface so the map can paint it
 * instantly instead of scoring thousands of points in the browser.
 *
 *   npm run data:risk
 *
 * scoreLocation() costs ~2 ms, so a grid this size would take ~40 s live.
 * Offline it is a one-off. Rerun whenever the model or lamps.json changes.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'

// stub fetch so src/lib/score.js can load its datasets off disk
globalThis.fetch = async (url) => {
  try {
    return { ok: true, json: async () => JSON.parse(readFileSync('./public' + url, 'utf8')) }
  } catch {
    return { ok: false, json: async () => null }
  }
}

const { initScoring, scoreLocation } = await import('../src/lib/score.js')
console.log('datasets:', await initScoring())

// Coarser than the density grid — the risk field varies smoothly, and this
// keeps both the build time and the payload reasonable.
const BBOX = [103.6, 1.15, 104.1, 1.48]
const CELL = 0.003 // ~330 m

const [minLng, minLat, maxLng, maxLat] = BBOX
const cols = Math.ceil((maxLng - minLng) / CELL)
const rows = Math.ceil((maxLat - minLat) / CELL)
console.log(`grid ${cols} x ${rows} = ${(cols * rows).toLocaleString()} cells`)

/**
 * Land mask — URA planning areas, build-time only so the 2 MB never ships.
 * Without it the surface bleeds into the sea: a 330 m cell whose centre sits
 * just offshore still picks up development from its 300 m density disc, so
 * the coastline ends up smeared. Credit to L2 for the idea.
 *
 * We mask on the cell CENTRE, not "the whole cell must be on land" — the
 * stricter test erases the coastal band, and coastal buildings beside water
 * are exactly where some real collision risk sits.
 */
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
console.log(`land mask: ${landFeatures.length} planning areas`)

function onLand(lat, lng) {
  const pt = point([lng, lat])
  for (const f of landFeatures) {
    const [x0, y0, x1, y1] = f._bbox
    if (lng < x0 || lng > x1 || lat < y0 || lat > y1) continue
    if (booleanPointInPolygon(pt, f)) return true
  }
  return false
}

const data = new Array(cols * rows).fill(-1) // -1 = sea / outside Singapore
const t0 = Date.now()
let masked = 0

for (let cy = 0; cy < rows; cy++) {
  for (let cx = 0; cx < cols; cx++) {
    const lng = minLng + (cx + 0.5) * CELL
    const lat = minLat + (cy + 0.5) * CELL
    if (!onLand(lat, lng)) {
      masked++
      continue
    }
    data[cy * cols + cx] = scoreLocation(lat, lng).total
  }
  if (cy % 20 === 0) {
    const pct = (((cy + 1) / rows) * 100).toFixed(0)
    console.log(`  ${pct}%  (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
  }
}

const nonZero = data.filter((v) => v > 0).length
const max = data.reduce((m, v) => (v > m ? v : m), 0)
console.log(
  `done in ${((Date.now() - t0) / 1000).toFixed(0)}s — ` +
    `${masked.toLocaleString()} cells masked as sea, ` +
    `${nonZero.toLocaleString()} above zero, peak ${max}`
)

writeFileSync(
  './public/data/risk-grid.json',
  JSON.stringify({
    note: 'Risk 0-100 per cell. Built by scripts/build-risk-grid.mjs. Rerun after any model or lamps.json change.',
    bbox: BBOX,
    cell: CELL,
    cols,
    rows,
    max,
    data,
  })
)
console.log('wrote public/data/risk-grid.json')
