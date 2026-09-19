/**
 * Run the lamp colour classifier over a folder of survey photographs.
 *
 *   node scripts/classify-lamps.mjs <folder> [labels.json]
 *
 * Why this exists. The classifier readings stored in lamps.json were produced
 * by a one-off script that was never committed, so nobody could re-run them —
 * including us. Worse, that script was a hand port of the browser code rather
 * than the code itself, and the two disagreed by up to 0.012 on the same
 * photograph, against boundaries that turn on 0.003. This runs the shipped
 * module, so what it prints is what the app would say.
 *
 * Pass a labels file — { "IMG_5701": "warm-led", ... } of what you saw
 * standing under each lamp — and it also reports agreement, and where the
 * classes overlap. Those are two different things: agreement is a score,
 * the overlap is what the boundaries in config.js should be set from.
 *
 * Reads .jpg and .heic. Nothing leaves the machine.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import jpeg from 'jpeg-js'
import decodeHeic from 'heic-decode'
import { analysePixels, downscaleToSquare } from '../src/features/capture/lampColourCore.js'

const [folder, labelsPath] = process.argv.slice(2)
if (!folder) {
  console.error('usage: node scripts/classify-lamps.mjs <folder> [labels.json]')
  process.exit(1)
}

const labels = labelsPath && existsSync(labelsPath)
  ? JSON.parse(readFileSync(labelsPath, 'utf8'))
  : {}

async function pixelsOf(path) {
  const bytes = readFileSync(path)
  if (extname(path).toLowerCase() === '.heic') {
    const { width, height, data } = await decodeHeic({ buffer: bytes })
    return downscaleToSquare(data, width, height)
  }
  const { width, height, data } = jpeg.decode(bytes, { useTArray: true })
  return downscaleToSquare(data, width, height)
}

const files = readdirSync(folder)
  .filter((f) => ['.jpg', '.jpeg', '.heic'].includes(extname(f).toLowerCase()))
  .sort()

if (!files.length) {
  console.error(`no .jpg or .heic files in ${folder}`)
  process.exit(1)
}

const rows = []
for (const file of files) {
  const id = basename(file, extname(file))
  const reading = await analysePixels(await pixelsOf(join(folder, file)))
  rows.push({ id, label: labels[id] ?? null, ...reading })
}

const pad = (v, n) => String(v).padEnd(n)
console.log(`\n${files.length} photographs from ${folder}\n`)
console.log(pad('photo', 11) + pad('blue', 8) + pad('reading', 26) + pad('by eye', 18) + 'clipped')

for (const r of rows) {
  const reading = r.type === 'uncertain' ? `${r.between.join(' or ')}?` : r.type
  const mark = !r.label ? '' : r.confidence !== 'confident' ? ' (abstained)' : r.type === r.label ? ' ok' : ' MISS'
  console.log(
    pad(r.id, 11) + pad(r.blueRatio.toFixed(4), 8) + pad(reading, 26) +
    pad((r.label ?? '—') + mark, 18) + (r.clipped * 100).toFixed(1) + '%'
  )
}

const labelled = rows.filter((r) => r.label)
if (!labelled.length) {
  console.log('\nNo labels supplied, so nothing to check against.\n')
  process.exit(0)
}

const committed = labelled.filter((r) => r.confidence === 'confident')
const right = committed.filter((r) => r.type === r.label)

console.log(`\nAgainst ${labelled.length} lamps identified by eye:`)
console.log(`  answered   ${committed.length}, of which ${right.length} correct`)
console.log(`  abstained  ${labelled.length - committed.length}, too close to a boundary to call`)
for (const r of committed.filter((x) => x.type !== x.label)) {
  console.log(`  MISS  ${r.id}  read ${r.type}, was ${r.label}, at ${r.blueRatio.toFixed(4)}`)
}

// Where each class actually sits, which is what the thresholds should follow.
// Printed as a range so an overlap between two classes is visible as one: if
// the top of 'warm-led' is above the bottom of 'neutral-led', no single
// dividing line can separate them and the band between is guesswork.
console.log('\nObserved range of each class:')
const byLabel = new Map()
for (const r of labelled) {
  if (!byLabel.has(r.label)) byLabel.set(r.label, [])
  byLabel.get(r.label).push(r.blueRatio)
}
const order = ['sodium', 'warm-led', 'neutral-led', 'cool-led']
const seen = [...byLabel.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
for (const [label, values] of seen) {
  values.sort((a, b) => a - b)
  console.log(`  ${pad(label, 13)} n=${pad(values.length, 4)}` +
    `${values[0].toFixed(4)} – ${values[values.length - 1].toFixed(4)}`)
}
for (let i = 0; i < seen.length - 1; i++) {
  const lower = seen[i][1]
  const upper = seen[i + 1][1]
  const top = Math.max(...lower)
  const bottom = Math.min(...upper)
  const gap = bottom > top
  console.log(`  ${seen[i][0]} / ${seen[i + 1][0]}: ` + (gap
    ? `clean gap ${bottom.toFixed(4)} – ${top.toFixed(4)}, midpoint ${((top + bottom) / 2).toFixed(4)}`
    : `OVERLAP ${bottom.toFixed(4)} – ${top.toFixed(4)}, no line separates them`))
}
console.log()
