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
  // TODO(L3): build the real rule set. Rough shape:
  //   high light + close to habitat  -> warm or shield the lighting (now)
  //   any elevated risk              -> dim through Oct–Nov (seasonal)
  //   high density + close to habitat-> bird-safe glass treatment (permanent)
  //
  // NParks already deploys glass treatments at Sungei Buloh, HortPark and the
  // Botanic Gardens — cite that precedent in the copy.
  return [
    {
      action: 'Not implemented yet',
      why: 'The recommendation rules have not been written.',
      owner: AGENCIES.estate,
      horizon: 'now',
    },
  ]
}

/** F7 — is today inside the peak collision window? */
export function isPeakSeason(date = new Date()) {
  return PEAK_MONTHS.includes(date.getMonth() + 1)
}
