/**
 * Lazy wrapper around heic2any.  OWNER: L4
 *
 * heic2any is 1.36 MB minified — roughly three times the rest of the app —
 * and importing it at the top of a module makes every visitor download it
 * whether or not they ever touch a photo. That alone breaks the 3-second
 * mobile budget (N2).
 *
 * Loading it on first use means the cost is paid only by someone who actually
 * drops an iPhone photo, and only once. The module cache handles the rest.
 *
 * Note there is a faster path before this one: extractHeicThumbnail() pulls
 * the preview already embedded in the file, which takes milliseconds and
 * needs no decoder. This is the fallback for files that have no thumbnail.
 */

let loading = null

async function getHeic2Any() {
  if (!loading) loading = import('heic2any').then((m) => m.default ?? m)
  return loading
}

/**
 * Convert a HEIC/HEIF blob to a JPEG blob.
 * @param {Blob} blob
 * @param {number} quality 0-1; callers use ~0.5-0.6 for previews
 * @returns {Promise<Blob>}
 */
export async function heicToJpeg(blob, quality = 0.6) {
  const heic2any = await getHeic2Any()
  const converted = await heic2any({ blob, toType: 'image/jpeg', quality })
  return Array.isArray(converted) ? converted[0] : converted
}
