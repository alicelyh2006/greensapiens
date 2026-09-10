/**
 * F5 — the risk model. OWNER: L1 (Data & Model)
 *
 * scoreLocation() is the single scoring API used by the app, and is
 * SYNCHRONOUS — other lanes call it directly during render. Datasets are
 * fetched once by initScoring() and held in module state.
 *
 * The model, in one line:
 *
 *   habitat (are birds here?) x density (is there anything to hit?) x light
 *
 * We deliberately do NOT hard-code "risk peaks at the park edge". Habitat is
 * highest in and near green space; density is ~0 inside a reserve. Multiply
 * them and the peak falls on the edge by itself, because that is the only
 * place both are non-zero. The edge result is a prediction of the model, not
 * an assumption baked into it — see combineFactors() below.
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

let greenSpaces = null
let densityGrid = null
let lamps = null
let singaporeBoundary = null

export function getDataStatus() {
  return {
    greenSpaces: greenSpaces !== null,
    density: densityGrid !== null,
    light: Array.isArray(lamps) && lamps.length > 0,
  }
}

export async function initScoring() {
  const [gs, grid, lampData, boundaryData] = await Promise.all([
    loadGeoJson(DATA.greenSpaces),
    loadJson(DATA.densityGrid),
    loadJson(DATA.lamps),
    loadJson(DATA.boundary),
  ])
  greenSpaces = gs
  densityGrid = grid
  lamps = lampData?.lamps ?? null
  singaporeBoundary = boundaryData?.features ?? null
  return getDataStatus()
}

async function loadJson(url) {
  try {
    const res = await fetch(url)
    return res.ok ? await res.json() : null
  } catch {
    return null
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

function bboxDistance(lng, lat, [minX, minY, maxX, maxY]) {
  const dx = Math.max(minX - lng, 0, lng - maxX)
  const dy = Math.max(minY - lat, 0, lat - maxY)
  return Math.hypot(dx * 111000 * Math.cos((lat * Math.PI) / 180), dy * 111000)
}

const clamp01 = (n) => Math.min(1, Math.max(0, n))

export function nearestGreenSpace(lat, lng) {
  if (!greenSpaces) return null
  const pt = point([lng, lat])
  const candidates = greenSpaces
    .map((f) => ({ f, d: bboxDistance(lng, lat, f._bbox) }))
    .sort((a, b) => a.d - b.d)

  let best = null
  for (const { f, d } of candidates) {
    if (best && d > best.metres) continue
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
          isReserve: f.properties.N_RESERVE === 1 || f.properties.N_RESERVE === '1',
        }
      }
    }
  }
  return best
}

function sizeWeight({ hectares, isReserve }) {
  const { minHa, maxHa, reserveBonus } = SIZE_WEIGHT
  const base = clamp01(
    Math.log10(Math.max(hectares, 1e-6) / minHa) / Math.log10(maxHa / minHa)
  )
  return clamp01(base + (isReserve ? reserveBonus : 0))
}

/**
 * The strongest habitat signal near a point, not the closest patch of grass.
 *
 * This used to read whichever green space was NEAREST, which is a different
 * question and gives the wrong answer wherever a small park sits in front of a
 * large one. At our own survey site on Old Upper Thomson Road the nearest
 * polygon is Leban Park — 0.3 ha, and the point is inside it. A 0.3 ha estate
 * playground scores zero on the size curve, so habitat collapsed to the floor
 * and the location read 25/100, "low". Central Catchment Nature Reserve, 3,040
 * ha, sits 152 m away, comfortably inside the 500 m falloff, and would have
 * given 0.72 — a total of 76 and the "high" band. It was never considered,
 * because it was not the closest thing.
 *
 * 323 of the 461 NParks polygons are under 1 ha, so pocket parks masking real
 * habitat is not an edge case; those small polygons are scattered through every
 * housing estate in Singapore, including the ones on reserve edges.
 *
 * Cost is contained by skipping any polygon whose bounding box is already
 * further away than the falloff distance, since those contribute nothing.
 */
function bestHabitat(lat, lng) {
  if (!greenSpaces) return null
  const pt = point([lng, lat])
  let best = null

  for (const f of greenSpaces) {
    if (bboxDistance(lng, lat, f._bbox) > HABITAT.falloffOutward) continue

    const asLine = polygonToLine(f)
    const lines = asLine.type === 'FeatureCollection' ? asLine.features : [asLine]
    let metres = Infinity
    for (const line of lines) {
      const m = distance(pt, nearestPointOnLine(line, pt), { units: 'meters' })
      if (m < metres) metres = m
    }

    const candidate = {
      metres,
      inside: booleanPointInPolygon(pt, f),
      name: f.properties.NAME,
      hectares: (f.properties['SHAPE_1.AREA'] ?? 0) / 10000,
      isReserve: f.properties.N_RESERVE === 1 || f.properties.N_RESERVE === '1',
    }

    const proximity = candidate.inside
      ? 1
      : clamp01(1 - candidate.metres / HABITAT.falloffOutward)
    if (proximity <= 0) continue

    candidate.value = clamp01(
      HABITAT.floor + (1 - HABITAT.floor) * proximity * sizeWeight(candidate)
    )
    if (!best || candidate.value > best.value) best = candidate
  }

  // Nothing within the falloff — fall back to the nearest, so the note can say
  // how far away the closest green space actually is.
  return best ?? nearestGreenSpace(lat, lng)
}

export function habitatAt(lat, lng) {
  const near = bestHabitat(lat, lng)
  if (!near) {
    return {
      value: 0,
      weight: WEIGHTS.habitat,
      note: 'Green-space data unavailable.',
    }
  }

  let proximity = near.inside
    ? 1
    : clamp01(1 - near.metres / HABITAT.falloffOutward)

  if (proximity <= 0) {
    return {
      value: 0,
      weight: WEIGHTS.habitat,
      note: `More than ${HABITAT.falloffOutward}m from mapped green space.`,
      detail: near,
    }
  }

  if (near.inside && HABITAT.useInwardFalloff) {
    proximity = clamp01(1 - near.metres / HABITAT.falloffInward)
  }

  const value = near.value ?? clamp01(
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
      note: 'Outside the mapped assessment area.',
      unavailable: true,
    }
  }

  if (data[cy * cols + cx] < 0) {
    return {
      value: 0,
      weight: WEIGHTS.density,
      note: 'No usable land-use data at this location.',
      unavailable: true,
    }
  }

  const metresPerCell = cell * 111000
  const r = Math.max(1, Math.round(DENSITY_RADIUS_M / metresPerCell))
  const samples = []

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue
      const x = cx + dx
      const y = cy + dy
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue
      const v = data[y * cols + x]
      if (v < 0) continue
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

  samples.sort((a, b) => a - b)
  const idx = Math.min(
    samples.length - 1,
    Math.floor(samples.length * DENSITY_PERCENTILE)
  )
  const value = samples[idx] / 100

  return {
    value,
    weight: WEIGHTS.density,
    note: `${DENSITY_WORDS.find(([t]) => value < t)[1]} within 300m (OpenStreetMap buildings).`,
  }
}

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

function lampsWithin(lat, lng, radiusM) {
  if (!lamps || lamps.length === 0) return []
  const out = []
  const latDeg = radiusM / 111000
  const lngDeg = latDeg / Math.cos((lat * Math.PI) / 180)

  for (const lamp of lamps) {
    if (Math.abs(lamp.lat - lat) > latDeg) continue
    if (Math.abs(lamp.lng - lng) > lngDeg) continue

    const metres = distance(point([lng, lat]), point([lamp.lng, lamp.lat]), {
      units: 'meters',
    })
    if (metres > radiusM) continue

    const type = LAMP_TYPES.find((t) => t.id === lamp.type)
    if (!type) continue
    out.push({ ...lamp, blue: type.blue, label: type.label, metres })
  }

  return out
}

function isLand(lat, lng) {
  if (!singaporeBoundary?.length) return true
  const pt = point([lng, lat])
  return singaporeBoundary.some((feature) => booleanPointInPolygon(pt, feature))
}

/**
 * The one place the three factors are combined. Everything that produces a
 * 0-100 risk number goes through here — scoreLocation, the light simulator,
 * and the offline grid builder — so the model cannot drift between them.
 *
 * NOT a weighted sum. A sum lets one factor carry the score on its own, which
 * puts the interior of a nature reserve — habitat 1.0, density 0.0, nothing
 * present to collide with — at 75/100 and recommends the Town Council urgently
 * reshield lighting in a forest. Multiplying makes habitat and density both
 * REQUIRED: either at zero means zero risk.
 *
 * The square root is a geometric mean. A plain product of two sub-1 values
 * rarely clears 0.3, so scores would never reach the bands and the tool would
 * look broken; the geometric mean keeps "both required" while restoring a
 * usable range.
 *
 * Light modulates rather than creates. It is floored at MODEL.lightFloor
 * because an unlit facade beside a reserve still kills birds by daylight
 * reflection, so light must never zero the result.
 *
 * WEIGHTS is intentionally not used here. It survives only to label the
 * factor bars in the UI, and those labels are misleading while the model is
 * multiplicative — see the note in config.js.
 */
export function combineFactors(habitat, density, light) {
  const lightMultiplier = MODEL.lightFloor + (1 - MODEL.lightFloor) * light
  return Math.round(Math.sqrt(habitat * density) * lightMultiplier * 100)
}

export function scoreLocation(lat, lng) {
  if (!isLand(lat, lng)) {
    return {
      total: 0,
      band: 'low',
      factors: {
        habitat: { value: 0, weight: WEIGHTS.habitat, note: 'Outside Singapore land boundary.' },
        light: { value: 0, weight: WEIGHTS.light, note: 'Not assessed outside Singapore.' },
        density: { value: 0, weight: WEIGHTS.density, note: 'Not assessed outside Singapore.' },
      },
      isMock: false,
      unavailable: true,
      reason: 'outside-singapore',
    }
  }

  const factors = {
    habitat: habitatAt(lat, lng),
    light: lightAt(lat, lng),
    density: densityAt(lat, lng),
  }

  const total = combineFactors(factors.habitat.value, factors.density.value, factors.light.value)

  return {
    total,
    band: toBand(total),
    factors,
    isMock: Object.values(factors).some((f) => f.placeholder),
  }
}

export function toBand(total) {
  if (total >= BANDS.high) return 'high'
  if (total >= BANDS.moderate) return 'moderate'
  return 'low'
}

/**
 * UI simulation only: keep the authoritative location score unchanged while
 * recalculating the selected location as if its light exposure were reduced.
 * The same L1-owned weights and thresholds are used; no new scoring model is introduced.
 */
export function simulateLightExposure(risk, lightExposure) {
  if (!risk?.factors) return null

  const light = clamp01(Number(lightExposure) / 100)
  const total = combineFactors(risk.factors.habitat.value, risk.factors.density.value, light)

  return {
    ...risk,
    total,
    band: toBand(total),
    factors: {
      ...risk.factors,
      light: {
        ...risk.factors.light,
        value: light,
        note: `Simulated light exposure: ${Math.round(light * 100)}/100.`,
      },
    },
    isSimulation: light !== clamp01(risk.factors.light.value),
  }
}

function titleCase(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
