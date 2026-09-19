/**
 * Offline data prep — turn the risk grid into smooth contour bands.
 *
 *   npm run data:contours
 *
 * Why. The grid is 333 m square cells. Drawn as cells it reads as a raster —
 * blocky, and at island zoom it is 2,055 small squares rather than a shape you
 * can point at. Risk does not actually have square edges; the cell boundary is
 * an artefact of how we sampled, not something in the world.
 *
 * Contours give the same information as regions with outlines, the way a
 * weather warning map does: here is the moderate area, here is the high area
 * inside it. That is also closer to how the output is meant to be used — "which
 * stretch of edge should a Town Council look at" rather than "what is the value
 * of this particular 333 m square".
 *
 * Two steps make the lines smooth rather than staircased:
 *   1. bilinear upsample the grid 4x, so isolines have sub-cell resolution
 *   2. Chaikin corner-cutting on the resulting rings
 *
 * Neither invents data — both interpolate between cells we computed, which is
 * the same assumption the map already makes by colouring a cell uniformly.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { contours } from 'd3-contour'
import { BANDS } from '../src/lib/config.js'

const SRC = './public/data/risk-grid.json'
const OUT = './public/data/risk-contours.geojson'
const UPSAMPLE = 4
const SMOOTH_PASSES = 4

/*
 * Smoothing here is GEOMETRY ONLY, deliberately.
 *
 * The obvious way to make contours rounder is to blur the field before
 * contouring. Tried it at one cell of sigma: it wiped out the high band
 * completely, because a blur pulls peaks down and a 55 surrounded by 30s
 * drops below the threshold. The map would then have disagreed with the number
 * the panel reports for the same spot, which is the exact failure we spent a
 * day fixing. Chaikin moves the outline points without touching a value, so
 * which regions exist is still decided entirely by the grid.
 */

const grid = JSON.parse(readFileSync(SRC, 'utf8'))
const { bbox, cell, cols, rows, data } = grid
console.log(`risk grid ${cols} x ${rows}`)

// -1 means sea or outside the grid. For contouring that is the same as "no
// risk" — we want the isoline to stop at the coast, not wrap around it.
const src = data.map((v) => (v < 0 ? 0 : v))

const W = (cols - 1) * UPSAMPLE + 1
const H = (rows - 1) * UPSAMPLE + 1
const up = new Float64Array(W * H)
for (let y = 0; y < H; y++) {
  const gy = y / UPSAMPLE
  const y0 = Math.min(rows - 1, Math.floor(gy)), y1 = Math.min(rows - 1, y0 + 1)
  const fy = gy - y0
  for (let x = 0; x < W; x++) {
    const gx = x / UPSAMPLE
    const x0 = Math.min(cols - 1, Math.floor(gx)), x1 = Math.min(cols - 1, x0 + 1)
    const fx = gx - x0
    const a = src[y0 * cols + x0], b = src[y0 * cols + x1]
    const c = src[y1 * cols + x0], d = src[y1 * cols + x1]
    up[y * W + x] = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy
  }
}
console.log(`upsampled ${UPSAMPLE}x to ${W} x ${H}`)

/** Chaikin corner cutting. Keeps rings closed. */
function smooth(ring) {
  let pts = ring
  for (let p = 0; p < SMOOTH_PASSES; p++) {
    if (pts.length < 4) break
    const out = []
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]
      out.push([x0 + 0.25 * (x1 - x0), y0 + 0.25 * (y1 - y0)])
      out.push([x0 + 0.75 * (x1 - x0), y0 + 0.75 * (y1 - y0)])
    }
    out.push(out[0])
    pts = out
  }
  return pts
}

/** Upsampled grid index -> lon/lat. */
const toLngLat = ([x, y]) => [
  bbox[0] + (x / UPSAMPLE + 0.5) * cell,
  bbox[1] + (y / UPSAMPLE + 0.5) * cell,
]

/**
 * Drop points closer together than MIN_STEP degrees (~20 m). Chaikin doubles
 * the point count on every pass, and the untrimmed output was 506 KB — ten
 * times the grid it came from — for detail far below what any zoom level
 * shows.
 */
const MIN_STEP = 0.0002
/**
 * The low band is a background wash covering most of the built-up island, and
 * its outlines are long and wriggly where they follow the coast. It carries no
 * detail anyone reads at 20 m, so it is thinned three times as hard — which is
 * most of the difference between a 555 KB file and a 250 KB one.
 */
const MIN_STEP_LOW = 0.0006
function decimate(ring, step = MIN_STEP) {
  const out = [ring[0]]
  for (let i = 1; i < ring.length - 1; i++) {
    const [ax, ay] = out[out.length - 1]
    const [bx, by] = ring[i]
    if (Math.abs(bx - ax) > step || Math.abs(by - ay) > step) out.push(ring[i])
  }
  out.push(out[0])
  return out
}

/**
 * Three thresholds, not two.
 *
 * Contouring only at moderate and high leaves the rest of the island as bare
 * basemap, which reads as "not assessed" when what it means is "assessed, and
 * there is little here". ASSESSED draws the outer edge of everywhere the model
 * gives any score at all — 2,055 cells of the 6,749 on land — as a faint green
 * band beneath the other two.
 *
 * It is set just above zero rather than at a round number because zero is
 * exactly what the model returns where habitat or buildings are absent, and
 * that boundary is the one worth drawing: inside it the two factors overlap,
 * outside it one of them is missing entirely.
 */
const ASSESSED = 1
const thresholds = [ASSESSED, BANDS.moderate, BANDS.high]
const generated = contours().size([W, H]).thresholds(thresholds)(up)

const features = []
for (const c of generated) {
  const band = c.value >= BANDS.high ? 'high'
    : c.value >= BANDS.moderate ? 'moderate'
    : 'low'
  const polygons = c.coordinates
    .map((poly) =>
      poly
        .map((ring) => decimate(smooth(ring).map(toLngLat), band === 'low' ? MIN_STEP_LOW : MIN_STEP))
        // A ring under ~8 points after smoothing is a single-cell speck.
        .filter((ring) => ring.length >= 8)
    )
    .filter((poly) => poly.length)
  if (!polygons.length) continue
  features.push({
    type: 'Feature',
    properties: { band, threshold: c.value },
    geometry: { type: 'MultiPolygon', coordinates: polygons },
  })
  console.log(`  ${band.padEnd(9)} threshold ${String(c.value).padStart(3)}  ${polygons.length} regions`)
}

for (const f of features)
  f.geometry.coordinates = f.geometry.coordinates.map((poly) =>
    poly.map((ring) => ring.map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)])))

const out = { type: 'FeatureCollection', note: 'Risk contour bands generated from public/data/risk-grid.json by scripts/build-risk-contours.mjs. Bilinear upsampled 4x then Chaikin-smoothed; the curves interpolate between computed cells and do not add information.', features }
writeFileSync(OUT, JSON.stringify(out))
const kb = (JSON.stringify(out).length / 1024).toFixed(0)
console.log(`wrote ${OUT} (${kb} KB)`)
