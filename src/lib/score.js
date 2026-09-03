/**
 * F5 — the risk model.  OWNER: L1 (Data & Model)
 *
 * `scoreLocation` is SYNCHRONOUS and must stay that way — three other lanes
 * call it directly. Datasets are fetched once by `initScoring()` at startup
 * and held in module state.
 *
 * The model, in one line:
 *
 *   habitat (are birds here?) x density (is there anything to hit?) x light
 *
 * We deliberately do NOT hard-code "risk peaks at the park edge". Habitat is
 * highest in and near green space; density is ~0 inside a reserve. Multiply
 * them and the peak falls on the edge by itself, because that is the only
 * place both are non-zero. The edge result is a prediction of the model, not
 * an assumption baked into it.
 */

import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import polygonToLine from '@turf/polygon-to-line'
import nearestPointOnLine from '@turf/nearest-point-on-line'
import distance from '@turf/distance'
import { point } from '@turf/helpers'

import {
  WEIGHTS,
  MODEL,
  HABITAT,
  SIZE_WEIGHT,
  BANDS,
  DENSITY_FALLBACK,
  DENSITY_RADIUS_M,
  DENSITY_PERCENTILE,
  LIGHT,
  LAMP_TYPES,
  DATA,
} from './config.js'

// --- module state, populated once by initScoring() --------------------------
let greenSpaces = null
let densityGrid = null
let lamps = null

export function getDataStatus() {
  return {
    greenSpaces: greenSpaces !== null,
    density: densityGrid !== null,
    light: Array.isArray(lamps) && lamps.length > 0,
  }
}

/**
 * Load every static dataset and precompute bounding boxes.
 * Call once, await it, then render. Safe to call twice.
 *
 * A missing dataset is not fatal: the matching factor falls back to a
 * placeholder and says so in its `note`, so the app still runs.
 */
export async function initScoring() {
  const [gs, grid, lampData] = await Promise.all([
    loadGeoJson(DATA.greenSpaces),
    loadJson(DATA.densityGrid),
    loadJson(DATA.lamps),
  ])
  greenSpaces = gs
  densityGrid = grid
  lamps = lampData?.lamps ?? null
  return getDataStatus()
}

async function loadJson(url) {
  try {
    const res = await fetch(url)
    return res.ok ? await res.json() : null
  } catch {
    return null // dataset not committed yet — caller degrades gracefully
  }
}

async function loadGeoJson(url) {
  const gj = await loadJson(url)
  if (!gj) return null
  for (const f of gj.features) f._bbox = bboxOf(f.geometry.coordinates)
  return gj.features
}

function bboxOf(coords) {
  let minX = 180, minY = 90, maxX = -180, maxY = -90
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < minX) minX = c[0]
      if (c[0] > maxX) maxX = c[0]
      if (c[1] < minY) minY = c[1]
      if (c[1] > maxY) maxY = c[1]
    } else c.forEach(walk)
  }
  walk(coords)
  return [minX, minY, maxX, maxY]
}

/** Cheap metres-to-bbox. 0 when inside. Used to skip expensive line maths. */
function bboxDistance(lng, lat, [minX, minY, maxX, maxY]) {
  const dx = Math.max(minX - lng, 0, lng - maxX)
  const dy = Math.max(minY - lat, 0, lat - maxY)
  return Math.hypot(dx * 111000 * Math.cos((lat * Math.PI) / 180), dy * 111000)
}

const clamp01 = (n) => Math.min(1, Math.max(0, n))

// ---------------------------------------------------------------------------
// HABITAT — are birds likely to be here?
// ---------------------------------------------------------------------------

/**
 * Nearest green space, with signed edge distance.
 * Naive scan of all 461 polygons is ~13.6 ms; the bbox prefilter makes it
 * ~0.3 ms. This runs on every map click, so keep the prefilter.
 */
export function nearestGreenSpace(lat, lng) {
  if (!greenSpaces) return null
  const pt = point([lng, lat])

  const candidates = greenSpaces
    .map((f) => ({ f, d: bboxDistance(lng, lat, f._bbox) }))
    .sort((a, b) => a.d - b.d)

  let best = null
  for (const { f, d } of candidates) {
    if (best && d > best.metres) continue // cannot beat current best

    const asLine = polygonToLine(f)
    const lines = asLine.type === 'FeatureCollection' ? asLine.features : [asLine]
    for (const line of lines) {
      const m = distance(pt, nearestPointOnLine(line, pt), { units: 'meters' })
      if (!best || m < best.metres) {
        best = {
          metres: m,
          inside: booleanPointInPolygon(pt, f),
          name: f.properties.NAME,
          hectares: (f.properties['SHAPE_1.AREA'] ?? 0) / 10000,
          isReserve:
            f.properties.N_RESERVE === 1 || f.properties.N_RESERVE === '1',
        }
      }
    }
  }
  return best
}

/** Log-scaled habitat value of a park by area, plus a reserve uplift. */
function sizeWeight({ hectares, isReserve }) {
  const { minHa, maxHa, reserveBonus } = SIZE_WEIGHT
  const base = clamp01(
    Math.log10(Math.max(hectares, 1e-6) / minHa) / Math.log10(maxHa / minHa)
  )
  return clamp01(base + (isReserve ? reserveBonus : 0))
}

export function habitatAt(lat, lng) {
  const near = nearestGreenSpace(lat, lng)
  if (!near) {
    return {
      value: 0,
      weight: WEIGHTS.habitat,
      note: 'Green-space data unavailable.',
    }
  }

  // Bird presence is highest in and beside green space, fading outward.
  let proximity = near.inside
    ? 1
    : clamp01(1 - near.metres / HABITAT.falloffOutward)

  // Fallback only — normally density handles the reserve interior.
  if (near.inside && HABITAT.useInwardFalloff) {
    proximity = clamp01(1 - near.metres / HABITAT.falloffInward)
  }

  const value = clamp01(
    HABITAT.floor + (1 - HABITAT.floor) * proximity * sizeWeight(near)
  )
  const where = near.inside
    ? `inside ${titleCase(near.name)}`
    : `${Math.round(near.metres)}m from ${titleCase(near.name)}`

  return {
    value,
    weight: WEIGHTS.habitat,
    note: `${where} (${near.hectares.toFixed(1)} ha${near.isReserve ? ', nature reserve' : ''}).`,
    detail: near,
  }
}

// ---------------------------------------------------------------------------
// DENSITY — is there anything here to collide with?
// ---------------------------------------------------------------------------

/**
 * Land-use zoning as a proxy for built density.
 *
 * TODO(L1 · path B): swap the internals for a precomputed OpenStreetMap
 * building-count grid. Nothing outside this function needs to change — that
 * is the point of keeping the interface this narrow.
 *
 * Known weakness to state on the methodology page: zoning is what is
 * PERMITTED, not what is BUILT. A vacant plot zoned Commercial reads dense.
 */
const DENSITY_WORDS = [
  [0.05, 'Effectively nothing built here'],
  [0.25, 'Very lightly built'],
  [0.5, 'Moderately built'],
  [0.75, 'Densely built'],
  [1.01, 'Very densely built'],
]

export function densityAt(lat, lng) {
  if (!densityGrid) {
    return {
      value: DENSITY_FALLBACK,
      weight: WEIGHTS.density,
      note: 'Density data not loaded — using a placeholder value.',
      placeholder: true,
    }
  }

  const { bbox, cell, cols, rows, data } = densityGrid
  const cx = Math.floor((lng - bbox[0]) / cell)
  const cy = Math.floor((lat - bbox[1]) / cell)

  if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) {
    return {
      value: 0,
      weight: WEIGHTS.density,
      note: 'Outside the Master Plan area — water or beyond Singapore.',
    }
  }

  // Average over a disc, not a single cell. See DENSITY_RADIUS_M in config.
  const metresPerCell = cell * 111000
  const r = Math.max(1, Math.round(DENSITY_RADIUS_M / metresPerCell))

  const samples = []
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue // keep it circular
      const x = cx + dx
      const y = cy + dy
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue
      const v = data[y * cols + x]
      if (v < 0) continue // sea or beyond the plan — nothing built there
      samples.push(v)
    }
  }

  if (samples.length === 0) {
    return {
      value: 0,
      weight: WEIGHTS.density,
      note: `Nothing built within ${DENSITY_RADIUS_M}m.`,
    }
  }

  // 80th percentile, not the mean — see DENSITY_PERCENTILE in config.js
  samples.sort((a, b) => a - b)
  const idx = Math.min(
    samples.length - 1,
    Math.floor(samples.length * DENSITY_PERCENTILE)
  )
  const value = samples[idx] / 100
  return {
    value,
    weight: WEIGHTS.density,
    note: `${DENSITY_WORDS.find(([t]) => value < t)[1]} within 300m (land-use zoning).`,
  }
}

// ---------------------------------------------------------------------------
// LIGHT — placeholder until the lamp survey or VIIRS lands
// ---------------------------------------------------------------------------

/**
 * Blue-light exposure from our own field survey.
 *
 * The survey is sparse by nature — a few hundred classified lamps, not
 * island-wide coverage. So this reports its own confidence rather than
 * pretending to know everywhere. `confidence: 'measured'` means real lamps
 * were found nearby; 'estimated' means we are falling back and saying so.
 *
 * Nearby lamps are combined by inverse-distance weighting: a cool-white
 * floodlight 20 m away matters far more than one 200 m away.
 */
export function lightAt(lat, lng) {
  const nearby = lampsWithin(lat, lng, LIGHT.radiusM)

  if (nearby.length === 0) {
    return {
      value: LIGHT.fallback,
      weight: WEIGHTS.light,
      confidence: 'estimated',
      sampleCount: 0,
      note: lamps
        ? 'No surveyed lamps within 250m — light is estimated, not measured.'
        : 'Lamp survey not loaded — light is estimated, not measured.',
      placeholder: true,
    }
  }

  // inverse-distance weighting, +1 m so a lamp underfoot cannot divide by zero
  let num = 0
  let den = 0
  for (const { blue, metres } of nearby) {
    const w = 1 / (metres + 1)
    num += blue * w
    den += w
  }
  const value = clamp01(num / den)

  const measured = nearby.length >= LIGHT.minSamplesForConfidence
  const worst = nearby.reduce((a, b) => (b.blue > a.blue ? b : a))

  return {
    value,
    weight: WEIGHTS.light,
    confidence: measured ? 'measured' : 'estimated',
    sampleCount: nearby.length,
    note: `${nearby.length} surveyed lamp${nearby.length === 1 ? '' : 's'} within 250m; ` +
      `nearest problem light is ${worst.label.toLowerCase()}.`,
    placeholder: !measured,
  }
}

/** Surveyed lamps within `radiusM`, each with its blue value and distance. */
function lampsWithin(lat, lng, radiusM) {
  if (!lamps || lamps.length === 0) return []
  const out = []
  const latDeg = radiusM / 111000
  const lngDeg = latDeg / Math.cos((lat * Math.PI) / 180)

  for (const lamp of lamps) {
    // cheap rectangular reject before the real distance calculation
    if (Math.abs(lamp.lat - lat) > latDeg) continue
    if (Math.abs(lamp.lng - lng) > lngDeg) continue

    const metres = distance(point([lng, lat]), point([lamp.lng, lamp.lat]), {
      units: 'meters',
    })
    if (metres > radiusM) continue

    const type = LAMP_TYPES.find((t) => t.id === lamp.type)
    if (!type) continue // unknown classification — ignore rather than guess
    out.push({ ...lamp, blue: type.blue, label: type.label, metres })
  }
  return out
}

// ---------------------------------------------------------------------------

/**
 * @returns {{
 *   total: number, band: 'low'|'moderate'|'high',
 *   factors: { habitat: object, light: object, density: object },
 *   isMock: boolean
 * }}
 */
export function scoreLocation(lat, lng) {
  const factors = {
    habitat: habitatAt(lat, lng),
    light: lightAt(lat, lng),
    density: densityAt(lat, lng),
  }

  // Multiplicative, not a sum. Birds AND buildings are both required — either
  // at zero means no collisions. Light modulates but never zeroes, because an
  // unlit facade still kills by daylight reflection. See MODEL in config.js.
  const lightMultiplier =
    MODEL.lightFloor + (1 - MODEL.lightFloor) * factors.light.value

  const total = Math.round(
    Math.sqrt(factors.habitat.value * factors.density.value) *
      lightMultiplier *
      100
  )

  return {
    total,
    band: toBand(total),
    factors,
    // still incomplete while any factor is a stand-in
    isMock: Object.values(factors).some((f) => f.placeholder),
  }
}

export function toBand(total) {
  if (total >= BANDS.high) return 'high'
  if (total >= BANDS.moderate) return 'moderate'
  return 'low'
}

function titleCase(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
