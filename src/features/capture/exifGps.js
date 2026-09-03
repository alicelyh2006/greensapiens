/**
 * SPIKE · F9 — Read GPS from JPEG or HEIC/HEIF EXIF without any library.
 *
 * Returns { lat, lng, alt? } or throws with a descriptive message.
 *
 * JPEG: walks APP segments for APP1 / TIFF IFD GPS.
 * HEIC: walks ISOBMFF boxes (ftyp → meta → iinf/iloc) to locate the
 *       Exif item, then parses the same TIFF GPS IFD.
 */

// ─── Shared helpers ──────────────────────────────────────────────────────────

function getString(view, offset, len) {
  let s = ''
  for (let i = 0; i < len && offset + i < view.byteLength; i++) {
    s += String.fromCharCode(view.getUint8(offset + i))
  }
  return s
}

/** Read a variable-width big-endian unsigned int (used for ISOBMFF fields). */
function readVarInt(view, pos, size) {
  if (size === 0) return 0
  let val = 0
  for (let i = 0; i < size; i++) val = val * 256 + view.getUint8(pos + i)
  return val
}

function dmsToDecimal(dms, ref) {
  const [deg, min, sec] = dms
  let dd = deg + min / 60 + sec / 3600
  if (ref === 'S' || ref === 'W') dd = -dd
  return dd
}

function readRational(view, offset, littleEndian) {
  const num = view.getUint32(offset, littleEndian)
  const den = view.getUint32(offset + 4, littleEndian)
  return den === 0 ? 0 : num / den
}

// ─── TIFF GPS IFD parser (shared by JPEG + HEIC) ─────────────────────────────

/**
 * @param {DataView} view  DataView whose offset 0 is the TIFF header start.
 */
function parseTiffGps(view) {
  const bom = view.getUint16(0)
  if (bom !== 0x4949 && bom !== 0x4d4d) throw new Error('Bad TIFF byte-order mark')
  const le = bom === 0x4949

  const ifd0Offset = view.getUint32(4, le)
  const entryCount = view.getUint16(ifd0Offset, le)

  let gpsIfdOffset = null
  for (let i = 0; i < entryCount; i++) {
    const entryOff = ifd0Offset + 2 + i * 12
    if (view.getUint16(entryOff, le) === 0x8825) {
      gpsIfdOffset = view.getUint32(entryOff + 8, le)
      break
    }
  }
  if (gpsIfdOffset == null) throw new Error('No GPS IFD pointer in IFD0')

  const gpsEntryCount = view.getUint16(gpsIfdOffset, le)
  const gps = {}

  for (let i = 0; i < gpsEntryCount; i++) {
    const entryOff = gpsIfdOffset + 2 + i * 12
    const tag     = view.getUint16(entryOff, le)
    const count   = view.getUint32(entryOff + 4, le)
    const valOff  = entryOff + 8

    if (tag === 0x0001) {
      gps.latRef = String.fromCharCode(view.getUint8(valOff))
    } else if (tag === 0x0002) {
      const off = view.getUint32(valOff, le)
      gps.lat = [readRational(view, off, le), readRational(view, off + 8, le), readRational(view, off + 16, le)]
    } else if (tag === 0x0003) {
      gps.lngRef = String.fromCharCode(view.getUint8(valOff))
    } else if (tag === 0x0004) {
      const off = view.getUint32(valOff, le)
      gps.lng = [readRational(view, off, le), readRational(view, off + 8, le), readRational(view, off + 16, le)]
    } else if (tag === 0x0005) {
      gps.altRef = view.getUint8(valOff)
    } else if (tag === 0x0006) {
      const off = (count <= 1) ? view.getUint32(valOff, le) : valOff
      gps.alt = readRational(view, off, le)
    }
  }

  if (!gps.lat || !gps.lng) throw new Error('GPS IFD present but lat/lng missing')

  return {
    lat: dmsToDecimal(gps.lat, gps.latRef),
    lng: dmsToDecimal(gps.lng, gps.lngRef),
    alt: gps.alt != null ? (gps.altRef === 1 ? -gps.alt : gps.alt) : undefined,
  }
}

// ─── JPEG parser ──────────────────────────────────────────────────────────────

async function readJpegExifGps(file) {
  const buf = await file.slice(0, 128 * 1024).arrayBuffer()
  const raw = new DataView(buf)

  if (raw.getUint16(0) !== 0xffd8) throw new Error('Not a JPEG')

  let pos = 2
  while (pos < raw.byteLength - 4) {
    const marker = raw.getUint16(pos)
    const segLen = raw.getUint16(pos + 2)

    if (marker === 0xffe1) {
      const magic = getString(raw, pos + 4, 4)
      if (magic === 'Exif') {
        const tiffStart = pos + 10  // marker(2) + length(2) + 'Exif\0\0'(6)
        return parseTiffGps(new DataView(buf, tiffStart))
      }
    }

    pos += 2 + segLen
    if (segLen < 2) break
  }

  throw new Error('No EXIF APP1 found in JPEG')
}

// ─── HEIC / ISOBMFF parser ───────────────────────────────────────────────────

/** Return all immediate child boxes within [start, end) of the view. */
function getBoxes(view, start, end) {
  const boxes = []
  let pos = start
  while (pos + 8 <= end && pos + 8 <= view.byteLength) {
    const size32 = view.getUint32(pos)
    const type   = getString(view, pos + 4, 4)
    let size, headerSize

    if (size32 === 1) {
      // 64-bit extended size — read as two 32-bit halves (avoids BigInt)
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

async function readHeicExifGps(file) {
  // Read the whole file — HEIC metadata can be anywhere (before or after mdat).
  const buf = await file.arrayBuffer()
  const view = new DataView(buf)

  // Walk top-level boxes
  const topBoxes = getBoxes(view, 0, view.byteLength)

  // Find 'meta' at top level or inside 'moov'
  let metaBox = topBoxes.find(b => b.type === 'meta')
  if (!metaBox) {
    const moov = topBoxes.find(b => b.type === 'moov')
    if (moov) metaBox = getBoxes(view, moov.dataStart, moov.end).find(b => b.type === 'meta')
  }
  if (!metaBox) throw new Error('No meta box found in HEIC file')

  // meta is a FullBox → skip version(1) + flags(3) = 4 bytes before children
  const metaBoxes = getBoxes(view, metaBox.dataStart + 4, metaBox.end)
  const iinfBox   = metaBoxes.find(b => b.type === 'iinf')
  const ilocBox   = metaBoxes.find(b => b.type === 'iloc')
  if (!iinfBox || !ilocBox) throw new Error('Missing iinf or iloc boxes in HEIC meta')

  // ── Find the item ID of the Exif entry in iinf ──
  const iinfVersion = view.getUint8(iinfBox.dataStart)
  let pos = iinfBox.dataStart + 4  // past FullBox version+flags

  const entryCount = iinfVersion >= 2 ? view.getUint32(pos) : view.getUint16(pos)
  pos += iinfVersion >= 2 ? 4 : 2

  let exifItemId = null

  for (let i = 0; i < entryCount && pos + 8 <= iinfBox.end; i++) {
    const infeSize = view.getUint32(pos)
    const infeType = getString(view, pos + 4, 4)
    if (infeType !== 'infe') { pos += Math.max(infeSize, 8); continue }

    const infeVersion = view.getUint8(pos + 8)
    let p = pos + 8 + 4  // past box header(8) + FullBox version+flags(4)

    let itemId
    if (infeVersion <= 1) {
      itemId = view.getUint16(p); p += 4  // item_ID(2) + item_protection_index(2)
    } else if (infeVersion === 2) {
      itemId = view.getUint16(p); p += 4
    } else {  // version 3
      itemId = view.getUint32(p); p += 6  // item_ID(4) + item_protection_index(2)
    }

    if (infeVersion >= 2) {
      const itemTypeFcc = getString(view, p, 4)
      if (itemTypeFcc === 'Exif') exifItemId = itemId
    }

    pos += Math.max(infeSize, 8)
    if (exifItemId !== null) break
  }

  if (exifItemId === null) throw new Error('No Exif item found in HEIC iinf — photo may have no GPS metadata')

  // ── Find the file offset of the Exif item in iloc ──
  const ilocVersion = view.getUint8(ilocBox.dataStart)
  pos = ilocBox.dataStart + 4  // past FullBox version+flags

  const sizeByte1       = view.getUint8(pos++);
  const offsetSize      = (sizeByte1 >> 4) & 0xf
  const lengthSize      = sizeByte1 & 0xf
  const sizeByte2       = view.getUint8(pos++)
  const baseOffsetSize  = (sizeByte2 >> 4) & 0xf
  const indexSize       = ilocVersion >= 1 ? (sizeByte2 & 0xf) : 0

  const itemCount = ilocVersion >= 2 ? view.getUint32(pos) : view.getUint16(pos)
  pos += ilocVersion >= 2 ? 4 : 2

  let exifFileOffset = null

  for (let i = 0; i < itemCount && pos < ilocBox.end; i++) {
    const itemId = ilocVersion >= 2 ? view.getUint32(pos) : view.getUint16(pos)
    pos += ilocVersion >= 2 ? 4 : 2

    if (ilocVersion >= 1) pos += 2  // construction_method (we assume 0 = file offset)
    pos += 2                         // data_reference_index

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

  if (exifFileOffset === null) throw new Error('Exif item location not found in HEIC iloc')
  if (exifFileOffset + 4 > view.byteLength) throw new Error('Exif offset is beyond the data read')

  // At exifFileOffset: 4-byte ExifHeaderOffset (big-endian) then optional header then TIFF
  const exifHeaderSkip = view.getUint32(exifFileOffset)   // usually 0 or 6
  const tiffStart = exifFileOffset + 4 + exifHeaderSkip

  if (tiffStart >= view.byteLength) throw new Error('TIFF data out of range in HEIC Exif item')

  return parseTiffGps(new DataView(buf, tiffStart))
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Read GPS from a JPEG or HEIC/HEIF photo file.
 * @param {File} file
 * @returns {Promise<{ lat: number, lng: number, alt?: number }>}
 */
export async function readExifGps(file) {
  const type = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  const isHeic = type === 'image/heic' || type === 'image/heif'
              || name.endsWith('.heic') || name.endsWith('.heif')

  if (isHeic) return readHeicExifGps(file)
  return readJpegExifGps(file)
}
