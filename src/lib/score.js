/**
 * F5 — the risk model.  OWNER: L1 (Data & Model)
 *
 * ⚠️ THIS IS A MOCK. It returns plausible-looking values so L2, L3 and L4 can
 * build against the real contract from day one. L1 replaces the internals.
 * Do not change the SHAPE of the return value without telling the team —
 * three other lanes depend on it.
 */

import { WEIGHTS, BANDS } from './config.js'

/**
 * @typedef {Object} Factor
 * @property {number} value   0–1, this factor's contribution before weighting
 * @property {number} weight  from WEIGHTS
 * @property {string} note    plain-language explanation for the user
 *
 * @typedef {Object} RiskResult
 * @property {number} total                  0–100
 * @property {'low'|'moderate'|'high'} band
 * @property {{habitat: Factor, light: Factor, density: Factor}} factors
 * @property {boolean} isMock                remove once L1 lands the real model
 */

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {RiskResult}
 */
export function scoreLocation(lat, lng) {
  // TODO(L1): replace with real computation.
  //   habitat — distance to nearest green-space edge, peaking AT the boundary
  //             (see HABITAT in config.js)
  //   light   — VIIRS radiance at this point, raised by nearby cool-white lamps
  //   density — building count / footprint area in the surrounding cells
  const pseudo = Math.abs(Math.sin(lat * 137.5 + lng * 91.3))

  const factors = {
    habitat: {
      value: clamp01(pseudo),
      weight: WEIGHTS.habitat,
      note: 'Mock value — distance to the nearest green-space edge is not yet computed.',
    },
    light: {
      value: clamp01((pseudo * 1.7) % 1),
      weight: WEIGHTS.light,
      note: 'Mock value — VIIRS radiance is not yet loaded.',
    },
    density: {
      value: clamp01((pseudo * 2.3) % 1),
      weight: WEIGHTS.density,
      note: 'Mock value — building density is not yet computed.',
    },
  }

  const total = Math.round(
    Object.values(factors).reduce((sum, f) => sum + f.value * f.weight, 0) * 100
  )

  return { total, band: toBand(total), factors, isMock: true }
}

/** @returns {'low'|'moderate'|'high'} */
export function toBand(total) {
  if (total >= BANDS.high) return 'high'
  if (total >= BANDS.moderate) return 'moderate'
  return 'low'
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n))
}
