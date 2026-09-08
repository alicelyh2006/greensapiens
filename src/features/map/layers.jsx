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

function aggregateHexBins(grid) {
  const { bbox, cell, cols, rows, data } = grid
  const binRows = Math.ceil(rows / 2)
  const binCols = Math.ceil(cols / 2)
  const bins = []

  for (let binRow = 0; binRow < binRows; binRow += 1) {
    for (let binCol = 0; binCol < binCols; binCol += 1) {
      const values = []
      for (let row = binRow * 2; row < Math.min(binRow * 2 + 2, rows); row += 1) {
        for (let col = binCol * 2; col < Math.min(binCol * 2 + 2, cols); col += 1) {
          const value = data[row * cols + col]
          if (typeof value === 'number' && value >= 0) values.push(value)
        }
      }

      if (!values.length) continue

      bins.push({
        lat: bbox[1] + (binRow * 2 + 1) * cell,
        lng: bbox[0] + (binCol * 2 + 1) * cell,
        value: values.reduce((sum, value) => sum + value, 0) / values.length,
      })
    }
  }

  return { bins, cell: cell * 2 }
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

        const { bins, cell: binCell } = aggregateHexBins(grid)
        const renderer = L.canvas({ padding: 0.5 })
        group = L.layerGroup()

        const fills = {
          low: cssToken('--risk-ramp-low'),
          moderate: cssToken('--risk-ramp-mid'),
          high: cssToken('--risk-ramp-high'),
        }

        if (!fills.low || !fills.moderate || !fills.high) return

        for (const { lat, lng, value } of bins) {
          const band = bandForRisk(value)
          const fill = fills[band]
          const glow = band !== 'low'
          const radius = binCell * 111_000 * (0.18 + (value / 100) * 0.3)

          if (glow) {
            L.circle([lat, lng], {
              renderer,
              interactive: false,
              bubblingMouseEvents: false,
              radius: radius * 1.18,
              fillColor: fill,
              fillOpacity: opacity * 0.16,
            }).addTo(group)
          }

          L.circle([lat, lng], {
            renderer,
            interactive: false,
            bubblingMouseEvents: false,
            radius,
            fillColor: fill,
            fillOpacity: band === 'low' ? opacity * 0.42 : opacity,
          }).addTo(group)
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
