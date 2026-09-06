/**
 * Offline data prep — precomputes the risk surface so the map can paint it
 * instantly instead of scoring thousands of points in the browser.
 *
 *   npm run data:risk
 */
import { readFileSync, writeFileSync } from 'node:fs'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'

globalThis.fetch = async (url) => {
  try {
    return {
      ok: true,
      json: async () => JSON.parse(readFileSync('./public' + url, 'utf8')),
    }
  } catch {
    return { ok: false, json: async () => null }
  }
}

const { initScoring, scoreLocation } = await import('../src/lib/score.js')
console.log('datasets:', await initScoring())

const BBOX = [103.6, 1.15, 104.1, 1.48]
const CELL = 0.003

const [minLng, minLat, maxLng, maxLat] = BBOX
const cols = Math.ceil((maxLng - minLng) / CELL)
const rows = Math.ceil((maxLat - minLat) / CELL)

console.log(`grid ${cols} x ${rows} = ${(cols * rows).toLocaleString()} cells`)

function addBboxes(features) {
  for (const f of features) {
    let x0 = 180
    let y0 = 90
    let x1 = -180
    let y1 = -90

    const walk = (c) => {
      if (typeof c[0] === 'number') {
        x0 = Math.min(x0, c[0])
        x1 = Math.max(x1, c[0])
        y0 = Math.min(y0, c[1])
        y1 = Math.max(y1, c[1])
      } else {
        c.forEach(walk)
      }
    }

    walk(f.geometry.coordinates)
    f._bbox = [x0, y0, x1, y1]
  }

  return features
}

/*
 * First mask the sea/outside area using the existing simplified planning-area
 * land mask.
 */
const landFeatures = addBboxes(
  JSON.parse(readFileSync('./scripts/data/land-mask.geojson', 'utf8')).features
)

function onLand(lat, lng) {
  const pt = point([lng, lat])

  for (const f of landFeatures) {
    const [x0, y0, x1, y1] = f._bbox
    if (lng < x0 || lng > x1 || lat < y0 || lat > y1) continue
    if (booleanPointInPolygon(pt, f)) return true
  }

  return false
}

/*
 * Planning-area polygons can contain inland water. Apply a second mask using
 * the official/simplified waterbody polygons. Only the CELL CENTRE is tested,
 * matching the existing land-mask convention.
 */
const waterFeatures = addBboxes(
  JSON.parse(readFileSync('./scripts/data/waterbodies.geojson', 'utf8')).features
)

console.log(`land mask: ${landFeatures.length} planning areas`)
console.log(`waterbody mask: ${waterFeatures.length} polygons`)

function inWaterbody(lat, lng) {
  const pt = point([lng, lat])

  for (const f of waterFeatures) {
    const [x0, y0, x1, y1] = f._bbox
    if (lng < x0 || lng > x1 || lat < y0 || lat > y1) continue
    if (booleanPointInPolygon(pt, f)) return true
  }

  return false
}

const data = new Array(cols * rows).fill(-1)
const t0 = Date.now()
let masked = 0
let waterMasked = 0

for (let cy = 0; cy < rows; cy++) {
  for (let cx = 0; cx < cols; cx++) {
    const lng = minLng + (cx + 0.5) * CELL
    const lat = minLat + (cy + 0.5) * CELL

    if (!onLand(lat, lng)) {
      masked++
      continue
    }

    if (inWaterbody(lat, lng)) {
      masked++
      waterMasked++
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
    `${masked.toLocaleString()} cells masked, ` +
    `${waterMasked.toLocaleString()} water cells, ` +
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
