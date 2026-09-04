/**
 * SPIKE · F10 — Sample the brightest region of an image and bucket into lamp type.
 *
 * Algorithm:
 *   1. Decode image onto a 200x200 canvas (fast, no full-res needed).
 *   2. Find pixels brighter than the 90th-percentile luminance.
 *   3. Average their R, G, B.
 *   4. Compute blue ratio = B / (R + G + B).
 *   5. Bucket: blueRatio < 0.28 → warm, < 0.36 → neutral, else cool.
 *
 * Thresholds are rough starters — adjust after testing real lamp photos.
 *
 * @param {File} file
 * @returns {Promise<{ type: 'warm'|'neutral'|'cool'|'unknown', avgR, avgG, avgB, blueRatio, pixelsSampled }>}
 */
import heic2any from 'heic2any'
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
        const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.5 })
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

  // Compute luminance for every pixel
  const lum = new Float32Array(total)
  for (let i = 0; i < total; i++) {
    const r = data[i * 4]
    const g = data[i * 4 + 1]
    const b = data[i * 4 + 2]
    // perceived luminance
    lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  // 90th-percentile luminance threshold
  const sorted = Float32Array.from(lum).sort()
  const threshold = sorted[Math.floor(total * 0.90)]

  // Average RGB of bright pixels
  let sumR = 0, sumG = 0, sumB = 0, count = 0
  for (let i = 0; i < total; i++) {
    if (lum[i] >= threshold) {
      sumR += data[i * 4]
      sumG += data[i * 4 + 1]
      sumB += data[i * 4 + 2]
      count++
    }
  }

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
  }
}
