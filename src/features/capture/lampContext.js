/**
 * F11 — where a photographed lamp is, and who to ask about it.  OWNER: L4
 *
 * Nothing here looks at the image. The photo's EXIF GPS (F9) already gives an
 * exact position, and every dataset needed to place it is committed and
 * synchronous in L1's score.js. So this runs on-device, with no live call,
 * and stays inside "nothing leaves the device".
 *
 * Ownership is the honest part. Geodata cannot distinguish an LTA street lamp
 * from a Town Council void-deck light 5 m away, so the only confident answer
 * is "inside an NParks-managed space". Everything else is a guess from
 * building density until the photographer says what kind of light it is.
 */
import { nearestGreenSpace, scoreLocation, densityAt } from '../../lib/score.js'
import { AGENCIES, LAMP_OWNER } from '../../lib/config.js'

/** What the photographer can tell us. Keys are AGENCIES keys. */
export const LIGHT_SOURCES = [
  { id: 'streetlight', label: 'Street lamp on a public road' },
  { id: 'estate',      label: 'HDB estate — void deck, corridor, carpark' },
  { id: 'condo',       label: 'Condo or private building' },
  { id: 'park',        label: 'Park, reserve or park-connector lighting' },
  { id: 'signage',     label: 'Shop sign, billboard or lit facade' },
]

const SOURCE_REASON = {
  streetlight: 'Public road lighting is installed and maintained by LTA.',
  estate: 'Common-area lighting in HDB estates is the Town Council\'s.',
  condo: 'Private estates are managed by their MCST.',
  park: 'Lighting inside parks and park connectors is NParks\'.',
  signage: 'Illuminated signage and facades are licensed through URA.',
}

/**
 * @param {{ lat: number, lng: number } | null} gps
 * @param {string | null} source  one of LIGHT_SOURCES ids, or null if not chosen
 * @returns {null | {
 *   place: { name: string, metres: number, inside: boolean, isReserve: boolean } | null,
 *   risk: { total: number, band: string } | null,
 *   owner: { key: string, name: string, confidence: 'confirmed'|'likely'|'guess', reason: string } | null,
 * }}
 */
export function lampContext(gps, source) {
  if (!gps) return null

  const place = nearestGreenSpace(gps.lat, gps.lng)
  const risk = scoreLocation(gps.lat, gps.lng)
  const density = densityAt(gps.lat, gps.lng)

  let owner = null
  if (source && AGENCIES[source]) {
    owner = { key: source, name: AGENCIES[source], confidence: 'confirmed', reason: SOURCE_REASON[source] }
  } else if (place?.inside) {
    owner = {
      key: 'park',
      name: AGENCIES.park,
      confidence: 'likely',
      reason: `This position falls inside ${formatPlaceName(place.name)}, an NParks-managed space.`,
    }
  } else if (!density.unavailable && density.value >= LAMP_OWNER.estateDensity) {
    owner = {
      key: 'estate',
      name: AGENCIES.estate,
      confidence: 'guess',
      reason: 'Densely built area — most common-area lighting here is the Town Council\'s. Choose the light source to confirm.',
    }
  }

  return {
    place: place ? { name: formatPlaceName(place.name), metres: place.metres, inside: place.inside, isReserve: place.isReserve } : null,
    risk: risk && !risk.unavailable ? { total: risk.total, band: risk.band } : null,
    owner,
  }
}

/** NParks names arrive as 'BEDOK TOWN PK'; the survey UI shows 'Bedok Town Park'. */
const NAME_ABBREVIATIONS = {
  PK: 'Park', PG: 'Playground', OS: 'Open Space', RD: 'Road', JLN: 'Jalan',
  AVE: 'Avenue', DR: 'Drive', ST: 'Street', CRES: 'Crescent', TCE: 'Terrace',
  NR: 'Nature Reserve', PC: 'Park Connector', GDNS: 'Gardens', CL: 'Close',
  LOR: 'Lorong', BLK: 'Block', HTS: 'Heights', CTR: 'Centre', EST: 'Estate',
}

export function formatPlaceName(raw) {
  return String(raw ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => NAME_ABBREVIATIONS[token] ?? (token.startsWith('(') ? token : token.charAt(0) + token.slice(1).toLowerCase()))
    .join(' ')
}

/** "120 m" under a kilometre, "2.1 km" beyond. */
export function formatDistance(metres) {
  if (metres < 1000) return `${Math.round(metres)} m`
  return `${(metres / 1000).toFixed(1)} km`
}
