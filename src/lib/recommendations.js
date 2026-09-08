/**
 * F6 — turn a risk result into something a person can act on.
 * OWNER: L3 (Result & Guidance)
 *
 * The output is the product. A map of brightness is not useful; "this lamp is
 * blue-white, 40m from a reserve edge, and it belongs to your Town Council" is.
 */

import { AGENCIES, PEAK_MONTHS } from './config.js'

/**
 * @typedef {Object} Recommendation
 * @property {string} action     what to do
 * @property {string} why        which factor triggered it
 * @property {string} owner      who is responsible (see AGENCIES)
 * @property {'now'|'seasonal'|'permanent'} horizon
 */

/**
 * @param {import('./score.js').RiskResult} risk
 * @returns {Recommendation[]}
 */
export function getRecommendations(risk) {
  const { factors, band } = risk
  const recs = []

  // Rule 1 — high light near habitat: warm or shield the light source.
  // Colour temperature, not brightness, is the strongest predictor of migrant
  // collisions. Switching to ≤3000K or fitting a shield costs little.
  if (factors.light.value >= 0.6 && factors.habitat.value >= 0.5) {
    recs.push({
      action: 'Warm or shield this lighting',
      why: 'Blue-rich light near a green-space edge is the strongest predictor of migrant collisions. Switching to ≤3000K or fitting a shield costs little and acts immediately.',
      // Default to estate owner — L4 lamp data will narrow this to the real agency.
      owner: AGENCIES.estate,
      horizon: 'now',
    })
  }

  // Rule 2 — any elevated risk: dim during peak migration window.
  // Free and reversible. Even partial dimming during Oct–Nov reduces exposure.
  if (band === 'moderate' || band === 'high') {
    recs.push({
      action: 'Dim lighting during October – November',
      why: 'Migratory bird collisions peak in October and November as species travel along the East Asian–Australasian Flyway. Seasonal dimming is the lowest-cost intervention.',
      owner: AGENCIES.estate,
      horizon: 'seasonal',
    })
  }

  // Rule 3 — dense buildings close to habitat: bird-safe glass.
  // NParks already runs this at Sungei Buloh, HortPark and the Botanic Gardens.
  if (factors.density.value >= 0.5 && factors.habitat.value >= 0.5) {
    recs.push({
      action: 'Apply bird-safe glass treatment',
      why: 'High building density near a reserve edge creates a collision corridor. Fritted or UV-patterned glass is already deployed by NParks at Sungei Buloh, HortPark and the Botanic Gardens.',
      owner: AGENCIES.condo,
      horizon: 'permanent',
    })
  }

  // Fallback — always return at least one actionable item.
  if (recs.length === 0) {
    recs.push({
      action: 'Monitor and report any bird strikes',
      why: 'Risk is currently assessed as low at this location. Reporting strikes helps build the evidence base for Singapore-wide intervention.',
      owner: AGENCIES.park,
      horizon: 'seasonal',
    })
  }

  return recs
}

/** F7 — is today inside the peak collision window? */
export function isPeakSeason(date = new Date()) {
  return PEAK_MONTHS.includes(date.getMonth() + 1)
}
