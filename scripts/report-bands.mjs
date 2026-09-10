/**
 * Where the band thresholds should sit, given the current model.
 * Run after any change to the model or its data — if the distribution moves,
 * BANDS in src/lib/config.js should move with it.
 */
import { readFileSync } from 'node:fs'
import { BANDS } from '../src/lib/config.js'

const d = JSON.parse(readFileSync('./public/data/risk-grid.json', 'utf8'))
  .data.filter((v) => v > 0)
  .sort((a, b) => a - b)
const at = (q) => d[Math.floor((d.length - 1) * q)]

console.log(`\n${d.length.toLocaleString()} assessed locations (score > 0)\n`)
console.log('  percentile   threshold   locations')
for (const [name, q] of [['top 1%', 0.99], ['top 5%', 0.95], ['top 10%', 0.9], ['top 25%', 0.75]]) {
  const t = at(q)
  const n = d.filter((v) => v >= t).length
  console.log(`  ${name.padEnd(11)}${String(t).padStart(9)}${String(n).padStart(12)}`)
}
console.log(`\n  config: moderate >= ${BANDS.moderate}, high >= ${BANDS.high}`)
console.log(`  giving ${d.filter((v) => v >= BANDS.moderate).length} moderate+ and ${d.filter((v) => v >= BANDS.high).length} high\n`)
