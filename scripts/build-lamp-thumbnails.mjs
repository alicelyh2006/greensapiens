/**
 * Build the small lamp thumbnails the map popups show.
 *
 *   node scripts/build-lamp-thumbnails.mjs <folder> [<folder> ...]
 *
 * Reads public/data/lamps.json, finds each entry's `photo` in the folders
 * given, and writes a downscaled JPEG to public/data/lamps/, recording the
 * path back on the lamp as `thumb`.
 *
 * Why thumbnails and not the photographs. A survey photo off a phone is two
 * to four megabytes; seventeen of them would be most of the repository and
 * every visitor would pay for them. At 240 px on the long edge each one is
 * around twenty kilobytes, which is all a popup needs and small enough that
 * the whole set costs less than the risk grid.
 *
 * The originals stay off the repository deliberately — they carry the
 * photographer's EXIF, including the GPS we already extracted into lamps.json
 * and nothing else needs.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, extname } from 'node:path'
import jpeg from 'jpeg-js'
import decodeHeic from 'heic-decode'

const LONG_EDGE = 240
const QUALITY = 72
const OUT_DIR = './public/data/lamps'

const folders = process.argv.slice(2)
if (!folders.length) {
  console.error('usage: node scripts/build-lamp-thumbnails.mjs <folder> [<folder> ...]')
  process.exit(1)
}

/** Photo names vary — IMG_5704.HEIC, IMG20260910214642.jpg.jpeg. Compare stems. */
const stem = (name) => {
  let s = name.toLowerCase()
  while (/\.(jpg|jpeg|heic|heif)$/.test(s)) s = s.replace(/\.[^.]+$/, '')
  return s
}

const found = new Map()
for (const dir of folders) {
  if (!existsSync(dir)) { console.warn('no such folder:', dir); continue }
  for (const f of readdirSync(dir)) {
    if (['.jpg', '.jpeg', '.heic'].includes(extname(f).toLowerCase())) {
      found.set(stem(f), join(dir, f))
    }
  }
}

async function decode(path) {
  const bytes = readFileSync(path)
  if (extname(path).toLowerCase() === '.heic') return decodeHeic({ buffer: bytes })
  return jpeg.decode(bytes, { useTArray: true })
}

/**
 * Box-average downscale. Nearest-neighbour is fine for sampling a colour — the
 * classifier uses it — but it aliases badly on a photograph a person will look
 * at, so each output pixel here averages the block of input pixels it covers.
 */
function downscale({ width, height, data }, longEdge) {
  const scale = Math.min(1, longEdge / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const out = Buffer.alloc(w * h * 4)

  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * height) / h)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / h))
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * width) / w)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / w))
      let r = 0, g = 0, b = 0, n = 0
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * width + sx) * 4
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
        }
      }
      const d = (y * w + x) * 4
      out[d] = r / n; out[d + 1] = g / n; out[d + 2] = b / n; out[d + 3] = 255
    }
  }
  return { width: w, height: h, data: out }
}

mkdirSync(OUT_DIR, { recursive: true })

const path = './public/data/lamps.json'
const doc = JSON.parse(readFileSync(path, 'utf8'))
const lamps = Array.isArray(doc) ? doc : doc.lamps

let written = 0, bytes = 0
for (const lamp of lamps) {
  if (!lamp.photo) continue
  const src = found.get(stem(lamp.photo))
  if (!src) { console.warn('no photo on disk for', lamp.photo); continue }

  const small = downscale(await decode(src), LONG_EDGE)
  const name = `${stem(lamp.photo)}.jpg`
  const jpg = jpeg.encode(small, QUALITY).data
  writeFileSync(join(OUT_DIR, name), jpg)

  lamp.thumb = `data/lamps/${name}`
  written++
  bytes += jpg.length
  console.log(`  ${name.padEnd(28)} ${small.width}x${small.height}  ${(jpg.length / 1024).toFixed(0)} KB`)
}

writeFileSync(path, JSON.stringify(doc, null, 2) + '\n')
console.log(`\n${written} thumbnails, ${(bytes / 1024).toFixed(0)} KB total`)
