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

export const HABITAT = {
  /** Metres outward from a green-space edge before bird presence reaches 0. */
  falloffOutward: 500,

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
  ['NATURE RESERVE', 0.0],
  ['PARK', 0.0],
  ['OPEN SPACE', 0.0],
  ['WATERBODY', 0.0],
  ['BEACH AREA', 0.0],
  ['AGRICULTURE', 0.05],
  ['CEMETERY', 0.05],
  ['ROAD', 0.1],
  ['RESERVE SITE', 0.1],
  ['SPECIAL USE', 0.2],
  ['UTILITY', 0.2],
  ['TRANSPORT FACILITIES', 0.3],
  ['PLACE OF WORSHIP', 0.4],
  ['EDUCATIONAL INSTITUTION', 0.5],
  ['CIVIC', 0.5],
  ['HEALTH', 0.6],
  ['SPORTS', 0.4],
  ['BUSINESS PARK', 0.8],
  ['BUSINESS', 0.8],
  ['LIGHT RAPID TRANSIT', 0.5],
  ['RESIDENTIAL', 0.7],
  ['HOTEL', 0.9],
  ['WHITE', 1.0],
  ['COMMERCIAL', 1.0],
]

/** Used when the zoning layer has not been loaded, or a point matches nothing. */
export const DENSITY_FALLBACK = 0.5

/** F10 — lamp classification buckets. Blue content, not brightness. */
export const LAMP_TYPES = [
  { id: 'sodium', label: 'Sodium ~2000K', appearance: 'Deep orange', risk: 'low' },
  { id: 'warm-led', label: 'Warm LED 2700-3000K', appearance: 'Yellowish white', risk: 'low' },
  { id: 'neutral-led', label: 'Neutral LED ~4000K', appearance: 'Plain white', risk: 'moderate' },
  { id: 'cool-led', label: 'Cool LED 5000-6500K', appearance: 'Blue-white glare', risk: 'high' },
]

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
  zoning: '/data/land-use.geojson',
}
