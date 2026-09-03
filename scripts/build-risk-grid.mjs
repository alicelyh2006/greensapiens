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

const data = new Array(cols * rows)
const t0 = Date.now()

for (let cy = 0; cy < rows; cy++) {
  for (let cx = 0; cx < cols; cx++) {
    const lng = minLng + (cx + 0.5) * CELL
    const lat = minLat + (cy + 0.5) * CELL
    data[cy * cols + cx] = scoreLocation(lat, lng).total
  }
  if (cy % 20 === 0) {
    const pct = (((cy + 1) / rows) * 100).toFixed(0)
    console.log(`  ${pct}%  (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
  }
}

const nonZero = data.filter((v) => v > 0).length
const max = Math.max(...data)
console.log(
  `done in ${((Date.now() - t0) / 1000).toFixed(0)}s — ${nonZero.toLocaleString()} cells above zero, peak ${max}`
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
