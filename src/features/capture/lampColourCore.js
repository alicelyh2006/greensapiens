/**
 * F10 — the lamp colour reading itself, with no way to load an image.
 *
 * Split out from lampColour.js so the browser and the offline script run the
 * same arithmetic rather than two copies of it. That mattered: the readings
 * recorded in lamps.json came from a throwaway Node port of this algorithm,
 * and re-running it against the shipped version showed the two disagreeing by
 * up to 0.012 on the same photograph — four times the margin that decides
 * warm from neutral. Same logic, different decoder, different answer.
 *
 * Everything here is pure. Give it RGB bytes, get a reading back.
 */
import { LAMP_COLOUR } from '../../lib/config.js'

/**
 * sRGB byte to linear light.
 *
 * The bytes in an image file are gamma-encoded — deliberately non-linear, so
 * that 8 bits track human brightness perception rather than photons. Averaging
 * them directly, which this code used to do, averages the encoding instead of
 * the light. The error is not large but it runs one way: gamma compresses
 * bright values together, so a warm lamp's dominant red is pulled down
 * relative to its weak blue, and the reading drifts toward neutral.
 */
function srgbToLinear(v) {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

/**
 * Bucket a blue ratio, declining to answer near a boundary.
 *
 * A classifier that always commits looks more capable than one that abstains,
 * and is worth less: its confident wrong answers are indistinguishable from
 * its confident right ones. Both errors in our labelled set sit within
 * the warm/neutral line's fitted uncertainty, so they become abstentions
 * rather than mistakes, and every call made away from a boundary is correct.
 *
 * Each boundary has its own width. The warm/neutral one is narrow because we
 * measured where those classes overlap; the neutral/cool one is wide because
 * we have a single cool fixture and no idea where the line falls.
 */
export function bucketBlueRatio(blueRatio) {
  const { boundaries } = LAMP_COLOUR

  for (const { below, above, at, uncertainty } of boundaries) {
    if (Math.abs(blueRatio - at) <= uncertainty) {
      return { type: 'uncertain', confidence: 'uncertain', between: [below, above] }
    }
  }

  // Past every boundary it is clear of, so it belongs above the last one.
  let type = boundaries[0].below
  for (const b of boundaries) {
    if (blueRatio > b.at) type = b.above
  }
  return { type, confidence: 'confident', between: null }
}

/**
 * Read a lamp's colour from RGB bytes.
 *
 * @param {Uint8Array|Uint8ClampedArray} rgb  Tightly packed RGB, 3 bytes each.
 * @returns {{ type, confidence, between, blueRatio, avgR, avgG, avgB,
 *             clipped, pixelsSampled, warning }}
 */
export function analysePixels(rgb) {
  const { saturatedAt, brightestFraction, clippedLimit } = LAMP_COLOUR
  const total = Math.floor(rgb.length / 3)

  // A pixel with any channel at the ceiling has lost its colour: the sensor
  // clipped and sodium is no longer distinguishable from daylight-white. A
  // lamp at night almost always blows out, and pure white sits at a blue ratio
  // of exactly 255/765 = 0.333 — right in the middle of "neutral". Before
  // these were discarded, every overexposed lamp read neutral, which looked
  // entirely plausible and carried no information whatsoever.
  const luminance = new Float32Array(total)
  const usable = []
  let clippedCount = 0

  for (let i = 0; i < total; i++) {
    const r = rgb[i * 3]
    const g = rgb[i * 3 + 1]
    const b = rgb[i * 3 + 2]
    luminance[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if (r >= saturatedAt || g >= saturatedAt || b >= saturatedAt) {
      clippedCount++
      continue
    }
    usable.push(i)
  }

  const clipped = total ? clippedCount / total : 1

  // The colour lives in the unclipped halo around the source and on whatever
  // it is lighting, so take the brightest slice of what survived.
  usable.sort((a, b) => luminance[b] - luminance[a])
  const bright = usable.slice(0, Math.max(1, Math.floor(usable.length * brightestFraction)))

  if (!usable.length) {
    return {
      type: 'unknown',
      confidence: 'unreadable',
      between: null,
      blueRatio: 0,
      avgR: 0,
      avgG: 0,
      avgB: 0,
      clipped: 1,
      pixelsSampled: 0,
      warning: 'Image is too overexposed to read a colour.',
    }
  }

  let linR = 0, linG = 0, linB = 0
  let sumR = 0, sumG = 0, sumB = 0
  for (const i of bright) {
    const r = rgb[i * 3]
    const g = rgb[i * 3 + 1]
    const b = rgb[i * 3 + 2]
    sumR += r; sumG += g; sumB += b
    linR += srgbToLinear(r); linG += srgbToLinear(g); linB += srgbToLinear(b)
  }

  const count = bright.length
  const linTotal = linR + linG + linB || 1
  const blueRatio = linB / linTotal

  return {
    ...bucketBlueRatio(blueRatio),
    blueRatio,
    // Byte averages are reported for display only — they are what the photo
    // looks like, not what the classification is computed from.
    avgR: Math.round(sumR / count),
    avgG: Math.round(sumG / count),
    avgB: Math.round(sumB / count),
    clipped,
    pixelsSampled: count,
    warning: clipped > clippedLimit
      ? 'The lamp is blown out in this photo. Tap the lamp before shooting so the camera stops down — the reading uses the glow around it, not the source.'
      : null,
  }
}

/**
 * Nearest-neighbour downscale to a square, returning packed RGB.
 *
 * The browser gets this free from canvas; Node does not, so it lives here to
 * keep the two paths sampling the same pixels.
 */
export function downscaleToSquare(rgba, width, height, size = LAMP_COLOUR.sampleSize) {
  const out = new Uint8Array(size * size * 3)
  for (let y = 0; y < size; y++) {
    const sy = Math.min(height - 1, Math.floor(((y + 0.5) * height) / size))
    for (let x = 0; x < size; x++) {
      const sx = Math.min(width - 1, Math.floor(((x + 0.5) * width) / size))
      const s = (sy * width + sx) * 4
      const d = (y * size + x) * 3
      out[d] = rgba[s]
      out[d + 1] = rgba[s + 1]
      out[d + 2] = rgba[s + 2]
    }
  }
  return out
}
