/**
 * F10 — get pixels out of an uploaded photo and hand them to the classifier.
 *
 * This file is the browser's decode path and nothing else. The reading itself
 * lives in lampColourCore.js, which the offline script in scripts/ also uses,
 * so there is exactly one implementation of the arithmetic.
 *
 * What this cannot do: recover the lamp's actual colour. A phone applies auto
 * white balance before writing the file, which is an attempt to remove exactly
 * the cast we are trying to measure. See LAMP_COLOUR in config.js for what
 * that costs and why the thresholds are fitted rather than physical.
 */
import { LAMP_COLOUR } from '../../lib/config.js'
import { analysePixels, downscaleToSquare } from './lampColourCore.js'
import { heicToJpeg } from './heicConvert.js'
import { extractHeicThumbnail } from './extractHeicThumbnail.js'

function isHeic(file) {
  return file.type === 'image/heic' || file.type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')
}

/**
 * @param {File} file
 * @returns {Promise<ReturnType<typeof analysePixels>>}
 */
export async function sampleLampColour(file) {
  let imageBlob = file

  if (isHeic(file)) {
    // 1. Embedded JPEG preview, if the camera wrote one — ~5-15 ms.
    //    Current iPhones do not: their thumbnail is HEVC like the full image,
    //    so this returns null on most files we see. See extractHeicThumbnail.js.
    const fastThumb = await extractHeicThumbnail(file).catch(() => null)
    if (fastThumb) {
      imageBlob = fastThumb
    } else {
      // 2. The usual path in practice — full HEVC decode via heic2any, at
      //    reduced quality because we only sample colour from it.
      try {
        const converted = await heicToJpeg(file, 0.5)
        imageBlob = Array.isArray(converted) ? converted[0] : converted
      } catch (e) {
        console.warn('HEIC conversion for colour sampling failed:', e)
      }
    }
  }

  const size = LAMP_COLOUR.sampleSize
  const bitmap = await createImageBitmap(imageBlob)
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, size, size)
  bitmap.close()

  const { data } = ctx.getImageData(0, 0, size, size)
  return analysePixels(downscaleToSquare(data, size, size, size))
}
