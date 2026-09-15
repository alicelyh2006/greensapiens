/**
 * Offline data prep — the priority list.
 *
 *   npm run data:hotspots
 *
 * The map answers "how risky is this spot". It does not answer the question
 * anyone with a budget actually asks, which is "which places should I look at
 * first". That needs a ranked list, not a surface you click one point at a
 * time.
 *
 * Takes the high band from the risk grid, drops cells within MIN_SPACING of a
 * higher-scoring one so a single hotspot does not fill the list with its own
 * neighbours, and records for each survivor what it is next to and what is
 * built there. The agency is left to the app: lampContext already decides
 * ownership and there should be one place that does.
 *
 * Source: derived from public/data/risk-grid.json.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { BANDS } from '../src/lib/config.js'

globalThis.fetch = async (u) => {
  try { return { ok: true, json: async () => JSON.parse(readFileSync('./public' + u, 'utf8')) } }
  catch { return { ok: false, json: async () => null } }
}
const { initScoring, scoreLocation, nearestGreenSpace } = await import('../src/lib/score.js')
await initScoring()

const OUT = './public/data/hotspots.json'
const MIN_SPACING_KM = 1.2
const LIMIT = 20

const km = (a, b, c, d) =>
  Math.hypot((c - a) * 111, (d - b) * 111 * Math.cos((a * Math.PI) / 180))

const grid = JSON.parse(readFileSync('./public/data/risk-grid.json', 'utf8'))
const [minLng, minLat] = grid.bbox

const candidates = []
for (let r = 0; r < grid.rows; r++) {
  for (let c = 0; c < grid.cols; c++) {
    const v = grid.data[r * grid.cols + c]
    if (v < BANDS.high) continue
    candidates.push({
      score: v,
      lat: minLat + (r + 0.5) * grid.cell,
      lng: minLng + (c + 0.5) * grid.cell,
    })
  }
}
candidates.sort((a, b) => b.score - a.score)
console.log(`${candidates.length} cells in the high band (>= ${BANDS.high})`)

const picked = []
for (const cand of candidates) {
  if (picked.some((p) => km(p.lat, p.lng, cand.lat, cand.lng) < MIN_SPACING_KM)) continue
  picked.push(cand)
  if (picked.length === LIMIT) break
}
console.log(`${picked.length} distinct sites at ${MIN_SPACING_KM} km spacing`)

/** 'JLN LEBAN PG' -> 'Jalan Leban Playground'. Mirrors lampContext's formatter. */
const ABBR = {
  PK: 'Park', PG: 'Playground', OS: 'Open Space', RD: 'Road', JLN: 'Jalan',
  AVE: 'Avenue', DR: 'Drive', ST: 'Street', CRES: 'Crescent', TCE: 'Terrace',
  NR: 'Nature Reserve', PC: 'Park Connector', GDNS: 'Gardens', CL: 'Close',
  LOR: 'Lorong', BLK: 'Block', HTS: 'Heights', CTR: 'Centre', EST: 'Estate',
}
const titleCase = (raw) =>
  String(raw ?? '').split(/\s+/).filter(Boolean)
    .map((t) => ABBR[t] ?? (t.startsWith('(') ? t : t.charAt(0) + t.slice(1).toLowerCase()))
    .join(' ')

const sites = picked.map((p, i) => {
  const s = scoreLocation(p.lat, p.lng)
  const near = nearestGreenSpace(p.lat, p.lng)
  return {
    rank: i + 1,
    lat: +p.lat.toFixed(5),
    lng: +p.lng.toFixed(5),
    score: s.total,
    band: s.band,
    place: near ? titleCase(near.name) : null,
    metres: near ? Math.round(near.metres) : null,
    inside: near ? near.inside : false,
    isReserve: near ? near.isReserve : false,
    habitat: Math.round(s.factors.habitat.value * 100),
    density: Math.round(s.factors.density.value * 100),
    light: Math.round(s.factors.light.value * 100),
    lightConfidence: s.factors.light.confidence,
  }
})

for (const s of sites) {
  console.log(
    `  ${String(s.rank).padStart(2)}. ${String(s.score).padStart(3)}  ` +
    `${(s.inside ? 'in ' : s.metres + 'm from ')}${s.place}`.padEnd(46) +
    `light ${s.lightConfidence}`
  )
}

writeFileSync(OUT, JSON.stringify({
  note: 'Priority sites: the highest-scoring cells in the risk grid, thinned so each entry is a distinct place rather than a neighbour of the one above it. Derived from risk-grid.json by scripts/build-hotspots.mjs — no new modelling.',
  generated: new Date().toISOString().slice(0, 10),
  threshold: BANDS.high,
  spacingKm: MIN_SPACING_KM,
  sites,
}, null, 1))
console.log(`wrote ${OUT}`)
