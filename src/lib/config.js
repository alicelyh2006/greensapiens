/**
 * N8 — every weight and threshold lives here. No magic numbers in components.
 *
 * These weights are OUR JUDGEMENT, informed by the published study but not
 * derived from it. The methodology page (F8) must say so.
 *
 * Source: Disentangling the biotic and abiotic drivers of bird-building
 * collisions in a tropical Asian city with ecological niche modeling.
 * Conservation Biology 38, e14255 (2024).
 */

export const WEIGHTS = {
  habitat: 0.4,
  light: 0.4,
  density: 0.2,
}

/**
 * Habitat risk peaks AT the boundary — not inside a reserve (no buildings to
 * strike) and not far from one (no birds). Distances in metres.
 */
export const HABITAT = {
  peakDistance: 0, // the edge itself
  falloffOutward: 500, // risk decays to ~0 this far from the edge
  falloffInward: 300, // and this far inside the reserve
}

export const BANDS = {
  moderate: 34, // >= this is moderate
  high: 67, // >= this is high
}

/**
 * F10 — lamp classification buckets.
 * Blue content, not brightness, is what predicts migrant collisions.
 */
export const LAMP_TYPES = [
  { id: 'sodium', label: 'Sodium ~2000K', appearance: 'Deep orange', risk: 'low' },
  { id: 'warm-led', label: 'Warm LED 2700–3000K', appearance: 'Yellowish white', risk: 'low' },
  { id: 'neutral-led', label: 'Neutral LED ~4000K', appearance: 'Plain white', risk: 'moderate' },
  { id: 'cool-led', label: 'Cool LED 5000–6500K', appearance: 'Blue-white glare', risk: 'high' },
]

/** Peak collision months (1-indexed). */
export const PEAK_MONTHS = [10, 11]

/**
 * F6 — who owns which lights. Singapore has no single agency for light
 * pollution; this fragmentation is why the advisory names an owner.
 */
export const AGENCIES = {
  signage: 'URA',
  streetlight: 'LTA',
  estate: 'Town Council / HDB',
  park: 'NParks',
  condo: 'MCST',
}

/** Singapore, roughly centred, for the initial map view. */
export const MAP_DEFAULT = {
  center: [1.3521, 103.8198],
  zoom: 12,
  minZoom: 11,
  maxZoom: 18,
}
