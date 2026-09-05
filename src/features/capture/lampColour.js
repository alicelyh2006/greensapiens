/**
 * SPIKE · F10 — Sample the brightest region of an image and bucket into lamp type.
 *
 * Algorithm:
 *   1. Decode image onto a 200x200 canvas (fast, no full-res needed).
 *   2. DISCARD saturated pixels — see below.
 *   3. Of what remains, take the brightest decile.
 *   4. Average their R, G, B and compute blue ratio = B / (R + G + B).
 *   5. Bucket into the four lamp types.
 *
 * Why step 2 matters. A lamp photographed at night almost always blows out:
 * the source clips to 255,255,255, whose blue ratio is exactly 255/765 =
 * 0.333. That sits in the "neutral" band, so EVERY overexposed lamp — sodium
 * or cool LED alike — was classifying as neutral. The reading looked
 * plausible and carried no information at all.
 *
 * Colour survives in the unclipped halo around the source and on the surfaces
 * it lights, so that is what we sample. `clipped` is returned so the UI can
 * tell someone their photo is too blown out to read.
 *
 * Thresholds are rough starters — adjust after testing real lamp photos.
 *
 * @param {File} file
 * @returns {Promise<{ type: 'warm'|'neutral'|'cool'|'unknown', avgR, avgG, avgB, blueRatio, pixelsSampled }>}
 */
import { heicToJpeg } from './heicConvert.js'
import { extractHeicThumbnail } from './extractHeicThumbnail.js'

export async function sampleLampColour(file) {
  let imageBlob = file
  const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
                 file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')

  if (isHeic) {
    // 1. Try instant thumbnail extraction (~5-10ms)
    const fastThumb = await extractHeicThumbnail(file).catch(() => null)
    if (fastThumb) {
      imageBlob = fastThumb
    } else {
      // 2. Fallback to heic2any with reduced quality for speed
      try {
        const converted = await heicToJpeg(file, 0.5)
        imageBlob = Array.isArray(converted) ? converted[0] : converted
      } catch (e) {
        console.warn('HEIC conversion for colour sampling failed:', e)
      }
    }
  }

  const bitmap = await createImageBitmap(imageBlob)
  const SIZE = 200
  const canvas = new OffscreenCanvas(SIZE, SIZE)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, SIZE, SIZE)
  bitmap.close()

  const { data } = ctx.getImageData(0, 0, SIZE, SIZE)
  const total = SIZE * SIZE

  // A pixel with any channel at or near the ceiling has lost its colour: the
  // sensor clipped and we cannot tell sodium from daylight-white any more.
  const SATURATED = 250

  const lum = new Float32Array(total)
  const usable = []
  let clippedCount = 0

  for (let i = 0; i < total; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if (r >= SATURATED || g >= SATURATED || b >= SATURATED) {
      clippedCount++
      continue
    }
    usable.push(i)
  }

  // Brightest decile of what survived — the halo and lit surfaces, which do
  // carry the colour cast.
  usable.sort((a, b) => lum[b] - lum[a])
  const take = Math.max(1, Math.floor(usable.length * 0.1))
  const bright = usable.slice(0, take)

  let sumR = 0, sumG = 0, sumB = 0
  for (const i of bright) {
    sumR += data[i * 4]
    sumG += data[i * 4 + 1]
    sumB += data[i * 4 + 2]
  }
  const count = bright.length
  const clipped = clippedCount / total

  if (count === 0) {
    return {
      type: 'unknown',
      avgR: 0,
      avgG: 0,
      avgB: 0,
      blueRatio: 0,
      redRatio: 0,
      greenRatio: 0,
      pixelsSampled: 0,
      clipped: 1,
      warning: 'Image is too overexposed to read a colour.',
    }
  }

  const avgR = Math.round(sumR / count)
  const avgG = Math.round(sumG / count)
  const avgB = Math.round(sumB / count)
  const total3 = avgR + avgG + avgB || 1

  const blueRatio = avgB / total3
  const redRatio = avgR / total3
  const greenRatio = avgG / total3

  // Four-bucket classification ordered by blue content & appearance:
  // 1. High-pressure sodium: ~2000K, Deep orange, Minimal blue (blueRatio < 0.18, high red)
  // 2. Warm white LED: 2700–3000K, Yellowish, Low blue (0.18 <= blueRatio < 0.28)
  // 3. Neutral LED: ~4000K, Plain white, Moderate blue (0.28 <= blueRatio < 0.35)
  // 4. Cool white LED: 5000–6500K, Blue-white glare, High blue (blueRatio >= 0.35)
  let type
  if (blueRatio < 0.18 || (redRatio > 0.55 && blueRatio < 0.22)) {
    type = 'hps'
  } else if (blueRatio < 0.28) {
    type = 'warm_led'
  } else if (blueRatio < 0.35) {
    type = 'neutral_led'
  } else {
    type = 'cool_led'
  }

  return {
    type,
    avgR,
    avgG,
    avgB,
    blueRatio,
    redRatio,
    greenRatio,
    pixelsSampled: count,
    clipped,
    warning:
      clipped > 0.05
        ? 'The lamp is blown out in this photo. Tap the lamp before shooting so the camera stops down — the reading uses the glow around it, not the source.'
        : null,
  }
}
