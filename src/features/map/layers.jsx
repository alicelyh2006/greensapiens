/**
 * F1 green-space boundaries · F2 risk surface. OWNER: L2 (Map)
 *
 * The risk surface is rendered from the L1-generated risk grid. Each visible
 * hexagon is centred on the exact geographic centre of one source grid cell.
 * This layer never calculates risk and is never interactive.
 */
import { useEffect, useState } from 'react'
import { GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import { DATA, BANDS } from '../../lib/config.js'

function cssToken(name) {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

function bandForRisk(value) {
  if (value >= BANDS.high) return 'high'
  if (value >= BANDS.moderate) return 'moderate'
  return 'low'
}

function hexPositions(lat, lng, cell, scale = 1) {
  const latRadius = cell * 0.5 * scale
  const lngRadius = latRadius / Math.cos((lat * Math.PI) / 180)
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index
    return [
      lat + Math.sin(angle) * latRadius,
      lng + Math.cos(angle) * lngRadius,
    ]
  })
}

export function GreenSpaceLayer() {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false

    fetch(DATA.greenSpaces)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setData(d)
      })
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
      style={() => ({
        color: cssToken('--habitat'),
        weight: 1.2,
        opacity: 0.85,
        fill: false,
      })}
    />
  )
}

export function RiskLayer({ opacity = 0.86, theme }) {
  const map = useMap()

  useEffect(() => {
    let group = null
    let cancelled = false

    fetch(DATA.riskGrid)
      .then((r) => (r.ok ? r.json() : null))
      .then((grid) => {
        if (cancelled || !grid?.bbox || !grid?.cell) return

        const { bbox, cell, cols, rows, data } = grid
        const renderer = L.canvas({ padding: 0.5 })
        group = L.layerGroup()

        const fills = {
          low: cssToken('--risk-ramp-low'),
          moderate: cssToken('--risk-ramp-mid'),
          high: cssToken('--risk-ramp-high'),
        }

        if (!fills.low || !fills.moderate || !fills.high) return

        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const value = data[row * cols + col]
            // -1 marks masked water/outside cells; zero is valid low risk.
            if (typeof value !== 'number' || value < 0) continue

            const lat = bbox[1] + (row + 0.5) * cell
            const lng = bbox[0] + (col + 0.5) * cell
            const band = bandForRisk(value)
            const fill = fills[band]
            const glow = band !== 'low'
            const cellScale = band === 'high' ? 1.07 : 1

            if (glow) {
              L.polygon(hexPositions(lat, lng, cell, cellScale * 1.16), {
                renderer,
                interactive: false,
                bubblingMouseEvents: false,
                stroke: false,
                fillColor: fill,
                fillOpacity: opacity * 0.16,
              }).addTo(group)
            }

            L.polygon(hexPositions(lat, lng, cell, cellScale), {
              renderer,
              interactive: false,
              bubblingMouseEvents: false,
              stroke: false,
              fillColor: fill,
              fillOpacity: band === 'low' ? opacity * 0.42 : opacity,
            }).addTo(group)
          }
        }

        group.addTo(map)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (group) map.removeLayer(group)
    }
  }, [map, opacity, theme])

  return null
}
