/**
 * HEIC thumbnail extractor — a fast path that only some files can take.
 *
 * Some HEIC cameras embed a small JPEG preview in the EXIF TIFF (IFD1 / SubIFD)
 * or as an ISOBMFF item. Where one exists, lifting it out costs ~5-15 ms and
 * skips a WebAssembly HEVC decode of a 12-48 megapixel frame entirely. That is
 * the win this file exists for.
 *
 * KNOWN LIMITATION — measured, not assumed. Current iPhones do not write a JPEG
 * preview. Dumping the container on the 29 photographs from our 19 September
 * survey gives:
 *
 *   items in iinf:  { hvc1: 61, grid: 2, mime: 1, Exif: 1 }
 *   iref:           dimg thmb dimg auxl cdsc cdsc
 *
 * There IS a thumbnail — that is what `thmb` references — but it is another
 * hvc1 item, HEVC-encoded like the 61 tiles of the full image. There is no
 * JPEG to lift. So on those files this returns null, correctly, and
 * sampleLampColour falls back to heic2any. That is not a bug here and it does
 * not need fixing by adding cases: decoding an HEVC thumbnail still needs an
 * HEVC decoder, so the 1.3 MB library stays either way and only decode time
 * would improve. Uploads take a couple of seconds instead of milliseconds.
 *
 * Do not assume this path runs. On the most common camera in Singapore it does
 * not.
 */

function getString(view, offset, len) {
  let s = ''
  for (let i = 0; i < len && offset + i < view.byteLength; i++) {
    s += String.fromCharCode(view.getUint8(offset + i))
  }
  return s
}

function readVarInt(view, pos, size) {
  if (size === 0) return 0
  let val = 0
  for (let i = 0; i < size; i++) val = val * 256 + view.getUint8(pos + i)
  return val
}

function getBoxes(view, start, end) {
  const boxes = []
  let pos = start
  while (pos + 8 <= end && pos + 8 <= view.byteLength) {
    const size32 = view.getUint32(pos)
    const type   = getString(view, pos + 4, 4)
    let size, headerSize

    if (size32 === 1) {
      const hi = view.getUint32(pos + 8)
      const lo = view.getUint32(pos + 12)
      size = hi * 0x100000000 + lo
      headerSize = 16
    } else if (size32 === 0) {
      size = end - pos
      headerSize = 8
    } else {
      size = size32
      headerSize = 8
    }

    if (size < headerSize) break
    const boxEnd = Math.min(pos + size, end)
    boxes.push({ type, start: pos, dataStart: pos + headerSize, end: boxEnd })
    pos += size
  }
  return boxes
}

/**
 * Scan TIFF IFD0 and IFD1 for an embedded JPEG thumbnail (tags 0x0201 JPEGInterchangeFormat and 0x0202).
 */
function extractTiffThumbnail(view, tiffGlobalOffset, buffer) {
  try {
    const bom = view.getUint16(0)
    if (bom !== 0x4949 && bom !== 0x4d4d) return null
    const le = bom === 0x4949

    const ifd0Offset = view.getUint32(4, le)
    if (ifd0Offset >= view.byteLength) return null

    const entryCount0 = view.getUint16(ifd0Offset, le)
    // Offset to IFD1 is 4 bytes immediately following IFD0 entries
    const ifd1PtrOffset = ifd0Offset + 2 + entryCount0 * 12
    if (ifd1PtrOffset + 4 > view.byteLength) return null
    const ifd1Offset = view.getUint32(ifd1PtrOffset, le)

    if (ifd1Offset > 0 && ifd1Offset + 2 <= view.byteLength) {
      const entryCount1 = view.getUint16(ifd1Offset, le)
      let thumbOffset = null
      let thumbLength = null

      for (let i = 0; i < entryCount1; i++) {
        const off = ifd1Offset + 2 + i * 12
        if (off + 12 > view.byteLength) break
        const tag = view.getUint16(off, le)
        const val = view.getUint32(off + 8, le)

        if (tag === 0x0201) thumbOffset = val // JPEGInterchangeFormat
        if (tag === 0x0202) thumbLength = val // JPEGInterchangeFormatLength
      }

      if (thumbOffset && thumbLength && thumbOffset + thumbLength <= view.byteLength) {
        const absoluteThumbOffset = tiffGlobalOffset + thumbOffset
        const thumbBytes = new Uint8Array(buffer, absoluteThumbOffset, thumbLength)
        // Verify JPEG SOI marker
        if (thumbBytes[0] === 0xff && thumbBytes[1] === 0xd8) {
          return new Blob([thumbBytes], { type: 'image/jpeg' })
        }
      }
    }
  } catch (err) {
    // Ignore and fallback
  }
  return null
}

/**
 * Fast extract thumbnail blob from a HEIC file without decompressing HEVC video frames.
 * Returns a Blob (image/jpeg) if an embedded preview is found, or null if full decoding is required.
 */
export async function extractHeicThumbnail(file) {
  try {
    const buf = await file.arrayBuffer()
    const view = new DataView(buf)

    const topBoxes = getBoxes(view, 0, view.byteLength)
    let metaBox = topBoxes.find(b => b.type === 'meta')
    if (!metaBox) {
      const moov = topBoxes.find(b => b.type === 'moov')
      if (moov) metaBox = getBoxes(view, moov.dataStart, moov.end).find(b => b.type === 'meta')
    }
    if (!metaBox) return null

    const metaBoxes = getBoxes(view, metaBox.dataStart + 4, metaBox.end)
    const iinfBox   = metaBoxes.find(b => b.type === 'iinf')
    const ilocBox   = metaBoxes.find(b => b.type === 'iloc')
    if (!iinfBox || !ilocBox) return null

    // 1. Locate Exif item
    const iinfVersion = view.getUint8(iinfBox.dataStart)
    let pos = iinfBox.dataStart + 4
    const entryCount = iinfVersion >= 2 ? view.getUint32(pos) : view.getUint16(pos)
    pos += iinfVersion >= 2 ? 4 : 2

    let exifItemId = null
    for (let i = 0; i < entryCount && pos + 8 <= iinfBox.end; i++) {
      const infeSize = view.getUint32(pos)
      const infeType = getString(view, pos + 4, 4)
      if (infeType !== 'infe') { pos += Math.max(infeSize, 8); continue }

      const infeVersion = view.getUint8(pos + 8)
      let p = pos + 8 + 4
      let itemId
      if (infeVersion <= 1) {
        itemId = view.getUint16(p); p += 4
      } else if (infeVersion === 2) {
        itemId = view.getUint16(p); p += 4
      } else {
        itemId = view.getUint32(p); p += 6
      }
      if (infeVersion >= 2 && getString(view, p, 4) === 'Exif') {
        exifItemId = itemId
      }
      pos += Math.max(infeSize, 8)
      if (exifItemId !== null) break
    }

    if (exifItemId === null) return null

    // 2. Locate offset of Exif in iloc
    const ilocVersion = view.getUint8(ilocBox.dataStart)
    pos = ilocBox.dataStart + 4
    const sizeByte1      = view.getUint8(pos++)
    const offsetSize     = (sizeByte1 >> 4) & 0xf
    const lengthSize     = sizeByte1 & 0xf
    const sizeByte2      = view.getUint8(pos++)
    const baseOffsetSize = (sizeByte2 >> 4) & 0xf
    const indexSize      = ilocVersion >= 1 ? (sizeByte2 & 0xf) : 0
    const itemCount      = ilocVersion >= 2 ? view.getUint32(pos) : view.getUint16(pos)
    pos += ilocVersion >= 2 ? 4 : 2

    let exifFileOffset = null
    for (let i = 0; i < itemCount && pos < ilocBox.end; i++) {
      const itemId = ilocVersion >= 2 ? view.getUint32(pos) : view.getUint16(pos)
      pos += ilocVersion >= 2 ? 4 : 2
      if (ilocVersion >= 1) pos += 2
      pos += 2
      const baseOffset = readVarInt(view, pos, baseOffsetSize); pos += baseOffsetSize
      const extentCount = view.getUint16(pos); pos += 2

      for (let e = 0; e < extentCount; e++) {
        if (ilocVersion >= 1 && indexSize > 0) pos += indexSize
        const extentOffset = readVarInt(view, pos, offsetSize); pos += offsetSize
        const extentLength = readVarInt(view, pos, lengthSize); pos += lengthSize
        if (itemId === exifItemId && e === 0) {
          exifFileOffset = baseOffset + extentOffset
        }
      }
      if (exifFileOffset !== null) break
    }

    if (exifFileOffset === null || exifFileOffset + 4 > view.byteLength) return null

    const exifHeaderSkip = view.getUint32(exifFileOffset)
    const tiffStart = exifFileOffset + 4 + exifHeaderSkip
    if (tiffStart >= view.byteLength) return null

    // Check for TIFF embedded thumbnail
    return extractTiffThumbnail(new DataView(buf, tiffStart), tiffStart, buf)
  } catch (e) {
    return null
  }
}
