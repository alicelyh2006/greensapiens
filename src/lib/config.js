/**
 * N8 — every weight and threshold lives here. No magic numbers in components.
 *
 * These values are OUR JUDGEMENT, informed by the published study but not
 * derived from it. The methodology page (F8) must say so.
 *
 * Source: Disentangling the biotic and abiotic drivers of bird-building
 * collisions in a tropical Asian city with ecological niche modeling.
 * Conservation Biology 38, e14255 (2024).
 */

/**
 * How the three factors combine.
 *
 * The model is deliberately NOT "risk peaks at the park edge". Instead:
 *   habitat = are birds here?      (highest in/near green space)
 *   density = is there anything to hit?  (~0 inside a reserve)
 * Multiply them and the peak lands at the edge on its own, because that is
 * the only place both are non-zero. We don't assume the answer; it emerges.
 */
export const WEIGHTS = {
  habitat: 0.4,
  light: 0.35,
  density: 0.25,
}

/**
 * How the factors combine. NOT a weighted sum — a sum would let habitat alone
 * produce a high score in the middle of a forest, where there is nothing to
 * collide with.
 *
 *   risk = sqrt(habitat x density) x (lightFloor + (1 - lightFloor) x light)
 *
 * habitat and density are both REQUIRED: either at zero means zero risk.
 * Light MODULATES rather than creates — an unlit building beside a reserve
 * still kills birds by daylight reflection, so light never zeroes the result.
 * `lightFloor` is the multiplier when light is 0.
 *
 * The square root is a geometric mean. A plain product of two sub-1 values
 * rarely exceeds 0.3, so scores would never reach the risk bands and the tool
 * would look broken. The geometric mean keeps the "both required" property
 * while restoring a usable 0-100 range.
 */
export const MODEL = {
  lightFloor: 0.45,
}

export const HABITAT = {
  /** Metres outward from a green-space edge before bird presence reaches 0. */
  falloffOutward: 500,

  /**
   * Birds are not literally absent from the CBD — migrants get pulled in by
   * light. A small floor keeps built-up areas scoreable rather than exactly
   * zero, so the light factor can still lift them.
   */
  floor: 0.08,

  /**
   * FALLBACK ONLY. With the two-factor model above, points deep inside a
   * reserve are handled by density being ~0 — no inward decay needed.
   * Switch this on only if density data turns out to be too crude to read
   * near-zero inside reserves. Verify before flipping it.
   */
  useInwardFalloff: false,
  falloffInward: 150,
}

/**
 * Not all green space is habitat. 323 of the 461 NParks polygons are under
 * 1 ha — estate playgrounds and ornamental plazas, not bird habitat.
 * Area spans 0 to 3,039 ha, so we scale on a log curve:
 *
 *   weight = clamp01( log10(ha / minHa) / log10(maxHa / minHa) )
 *
 *   0.8 ha  (Raffles Place Park)      -> 0.00
 *   12.8 ha (Bedok Town Park)         -> 0.55
 *   32.7 ha (East Coast Park Area C)  -> 0.76
 *   131+ ha (the nature reserves)     -> 1.00
 */
export const SIZE_WEIGHT = {
  minHa: 1,
  maxHa: 100,
  /** Small uplift for the 7 NParks-gazetted nature reserves. */
  reserveBonus: 0.15,
}

export const BANDS = {
  moderate: 34,
  high: 67,
}

/**
 * Land-use zone -> how much there is to collide with, 0-1.
 * Keys are matched case-insensitively as substrings, so "RESIDENTIAL" also
 * catches "RESIDENTIAL WITH COMMERCIAL AT 1ST STOREY".
 * Order matters: the first match wins, so put specific terms before generic.
 *
 * Source: URA Master Plan Land Use layer, data.gov.sg
 */
export const ZONE_DENSITY = [
  // --- MUST come first: these contain words that appear below ---
  ['BUSINESS PARK', 0.7], // before PARK, or it would score 0
  ['COMMERCIAL & RESIDENTIAL', 0.9],
  ['RESIDENTIAL WITH COMMERCIAL', 0.8],
  ['COMMERCIAL / INSTITUTION', 0.9],
  ['RESIDENTIAL / INSTITUTION', 0.7],

  // --- nothing to collide with ---
  ['WATERBODY', 0.0],
  ['BEACH AREA', 0.0],
  ['OPEN SPACE', 0.0],
  ['PARK', 0.0],
  ['CEMETERY', 0.02],
  ['AGRICULTURE', 0.05],
  ['RESERVE SITE', 0.1],
  ['ROAD', 0.1],

  // --- sparse / low-rise ---
  ['SPECIAL USE', 0.2],
  ['UTILITY', 0.2],
  ['PORT / AIRPORT', 0.3],
  ['MASS RAPID TRANSIT', 0.3],
  ['LIGHT RAPID TRANSIT', 0.3],
  ['TRANSPORT FACILITIES', 0.3],
  ['SPORTS & RECREATION', 0.3],

  // --- institutional ---
  ['PLACE OF WORSHIP', 0.4],
  ['EDUCATIONAL INSTITUTION', 0.5],
  ['CIVIC & COMMUNITY INSTITUTION', 0.5],
  ['HEALTH & MEDICAL CARE', 0.6],

  // --- built-up ---
  ['RESIDENTIAL', 0.7],
  ['BUSINESS 1', 0.8],
  ['BUSINESS 2', 0.8],
  ['HOTEL', 0.9],
  ['WHITE', 1.0],
  ['COMMERCIAL', 1.0],
]

/** Used when the zoning layer has not been loaded, or a point matches nothing. */
export const DENSITY_FALLBACK = 0.5

/**
 * Density is sampled over a NEIGHBOURHOOD, not at a single point.
 *
 * A bird at a reserve edge does not collide with whatever is directly beneath
 * it — it collides with the buildings across the road. Point-sampling put
 * edge-adjacent locations inside the park's own grid cell and scored them 0,
 * which erased exactly the band the model exists to find.
 *
 * 300 m is roughly the scale over which a disoriented bird encounters glass.
 *
 * We take the 80th PERCENTILE of the disc, not the mean. At a reserve edge
 * most of the disc is still park, so a mean dilutes away the very development
 * that creates the hazard. What matters is whether significant building exists
 * nearby at all — one glass tower kills birds regardless of the average.
 */
export const DENSITY_RADIUS_M = 300
export const DENSITY_PERCENTILE = 0.8

/**
 * F10 — lamp classification buckets. Blue content, not brightness, is what
 * predicts migrant collisions. `blue` is the 0-1 value fed into the model.
 */
export const LAMP_TYPES = [
  { id: 'sodium', label: 'Sodium ~2000K', appearance: 'Deep orange', risk: 'low', blue: 0.05 },
  { id: 'warm-led', label: 'Warm LED 2700-3000K', appearance: 'Yellowish white', risk: 'low', blue: 0.2 },
  { id: 'neutral-led', label: 'Neutral LED ~4000K', appearance: 'Plain white', risk: 'moderate', blue: 0.6 },
  { id: 'cool-led', label: 'Cool LED 5000-6500K', appearance: 'Blue-white glare', risk: 'high', blue: 1.0 },
]

/**
 * Light comes from our own field survey — a sparse set of classified lamps,
 * not island-wide coverage. So the factor reports whether it actually KNOWS.
 *
 * Why measure at all when VIIRS exists: VIIRS DNB records ~500-900 nm and is
 * blind below 500 nm, exactly where white LEDs emit and exactly the band that
 * predicts migrant collisions. The satellite cannot see the variable that
 * matters. See docs/BIRD_LIGHT_REFERENCE.md §4.
 */
export const LIGHT = {
  /** Lamps within this distance inform a location's light value. */
  radiusM: 250,
  /** Below this many nearby lamps the reading is labelled an estimate. */
  minSamplesForConfidence: 2,
  /** Used where we have no survey coverage. Deliberately mid-scale. */
  fallback: 0.5,
}

/** Peak collision months (1-indexed). */
export const PEAK_MONTHS = [10, 11]

/** F6 — Singapore has no single agency for light pollution. */
export const AGENCIES = {
  signage: 'URA',
  streetlight: 'LTA',
  estate: 'Town Council / HDB',
  park: 'NParks',
  condo: 'MCST',
}

export const MAP_DEFAULT = {
  center: [1.3521, 103.8198],
  zoom: 12,
  minZoom: 11,
  maxZoom: 18,
}

/** Where the committed static datasets live. */
export const DATA = {
  greenSpaces: '/data/green-spaces.geojson',
  /** Built by scripts/build-density-grid.mjs. See npm run data:density. */
  densityGrid: '/data/density-grid.json',
  /** Our own field survey. See public/data/lamps.json for the schema. */
  lamps: '/data/lamps.json',
  /** Precomputed risk surface. Built by scripts/build-risk-grid.mjs. */
  riskGrid: '/data/risk-grid.json',
}
