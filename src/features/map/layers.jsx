/**
 * F1 green-space boundaries · F2 risk surface.  OWNER: L2 (Map)
 *
 * Both read committed static files. No scoring happens here — the risk grid is
 * precomputed by scripts/build-risk-grid.mjs from the L1-owned model.
 *
 * House rule: colours come from tokens, never hex literals. These layers read
 * the CSS custom properties at runtime so they follow the light/dark theme.
 */
import { useEffect, useState } from 'react'
import { GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import { DATA, BANDS } from '../../lib/config.js'

/** Read a CSS custom property and return it as [r, g, b]. */
function tokenRgb(name, fallback = [128, 128, 128]) {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  const hex = raw.replace('#', '')
  if (hex.length !== 6) return fallback
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ]
}

const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))

// ---------------------------------------------------------------------------

/** F1 — NParks green spaces, drawn as an outline so the risk layer stays legible. */
export function GreenSpaceLayer() {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch(DATA.greenSpaces)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setData(d))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

  return (
    <GeoJSON
      data={data}
      interactive={false}
      style={() => {
        const s = getComputedStyle(document.documentElement)
        // Outline only. A fill here would compete with the risk surface,
        // which is the layer that actually carries information.
        return {
          color: s.getPropertyValue('--habitat').trim() || '#4c8c5a',
          weight: 1.2,
          opacity: 0.85,
          fill: false,
        }
      }}
    />
  )
}

// ---------------------------------------------------------------------------

/**
 * F2 — the risk surface.
 *
 * Painted once to an offscreen canvas and added as a single image overlay.
 * Drawing ~7,000 individual Leaflet rectangles would crawl; one image does not.
 */
export function RiskLayer({ opacity = 0.75 }) {
  const map = useMap()

  useEffect(() => {
    let overlay = null
    let cancelled = false

    fetch(DATA.riskGrid)
      .then((r) => (r.ok ? r.json() : null))
      .then((grid) => {
        if (cancelled || !grid) return

        const { bbox, cols, rows, data, max } = grid
        const canvas = document.createElement('canvas')
        canvas.width = cols
        canvas.height = rows
        const ctx = canvas.getContext('2d')
        const img = ctx.createImageData(cols, rows)

        const low = tokenRgb('--risk-low', [111, 191, 139])
        const mid = tokenRgb('--risk-moderate', [224, 169, 74])
        const high = tokenRgb('--risk-high', [224, 114, 114])

        // Normalise against the "high" band, not the observed peak. The
        // distribution is heavily skewed — median 17, p99 57, and only a
        // couple of cells reach the top — so scaling to the maximum renders
        // almost the entire island invisible.
        const ceiling = Math.max(BANDS.high, 1)

        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const v = data[y * cols + x] ?? 0
            // Canvas y grows downward; grid row 0 is the SOUTH edge. Flip.
            const o = ((rows - 1 - y) * cols + x) * 4
            if (v <= 0) {
              img.data[o + 3] = 0
              continue
            }
            const t = Math.min(1, v / ceiling)
            const [r, g, b] = t < 0.5 ? lerp(low, mid, t * 2) : lerp(mid, high, (t - 0.5) * 2)
            img.data[o] = r
            img.data[o + 1] = g
            img.data[o + 2] = b
            img.data[o + 3] = Math.round(Math.pow(t, 0.8) * 255)
          }
        }
        ctx.putImageData(img, 0, 0)

        const bounds = [
          [bbox[1], bbox[0]],
          [bbox[3], bbox[2]],
        ]
        overlay = L.imageOverlay(canvas.toDataURL(), bounds, {
          opacity,
          interactive: false,
          className: 'risk-overlay',
        }).addTo(map)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (overlay) map.removeLayer(overlay)
    }
  }, [map, opacity])

  return null
}
