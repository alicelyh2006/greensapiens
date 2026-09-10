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
import { DATA, BANDS, LAMP_TYPES } from '../../lib/config.js'

const REPORTS_STORAGE_KEY = 'nightjar.reports.v1'

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

function readReports() {
  try {
    const stored = JSON.parse(localStorage.getItem(REPORTS_STORAGE_KEY) || '[]')
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

export function CollisionReportsLayer() {
  const map = useMap()

  useEffect(() => {
    let group = null
    let cancelled = false

    function renderReports() {
      if (cancelled) return
      if (group) map.removeLayer(group)

      group = L.layerGroup()
      readReports().forEach((report) => {
        const lat = Number(report.coords?.lat)
        const lng = Number(report.coords?.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

        const marker = L.circleMarker([lat, lng], {
          radius: 7,
          color: cssToken('--risk-high'),
          weight: 2,
          fillColor: cssToken('--risk-high'),
          fillOpacity: 0.9,
        })
        const date = report.incidentDate
          ? new Date(report.incidentDate).toLocaleDateString()
          : 'Date not recorded'
        const popup = document.createElement('div')
        const title = document.createElement('strong')
        title.textContent = 'Collision report'
        popup.append(title)
        popup.append(document.createElement('br'))
        popup.append(document.createTextNode(report.birdSpecies || 'Unidentified bird'))
        popup.append(document.createElement('br'))
        popup.append(document.createTextNode(report.condition || 'Unknown condition'))
        popup.append(document.createElement('br'))
        popup.append(document.createTextNode(date))
        marker.bindPopup(popup)
        marker.addTo(group)
      })

      group.addTo(map)
    }

    renderReports()
    window.addEventListener('nightjar:reports-changed', renderReports)
    window.addEventListener('storage', renderReports)

    return () => {
      cancelled = true
      window.removeEventListener('nightjar:reports-changed', renderReports)
      window.removeEventListener('storage', renderReports)
      if (group) map.removeLayer(group)
    }
  }, [map])

  return null
}

/**
 * F10 — the lamps we have actually been to.
 *
 * Reads public/data/lamps.json, the committed field survey, and draws one dot
 * per fixture coloured by how blue it is: warm sources green, neutral amber,
 * blue-rich red. Until now this file existed only inside the score, so a
 * survey that took an evening to collect was invisible to anyone using the
 * app — including anyone judging whether we had done it.
 *
 * Separate from the browser-local observations someone adds through the
 * capture form. These are ours, committed, and the same for every visitor.
 */
export function SurveyedLampsLayer() {
  const map = useMap()

  useEffect(() => {
    let group = null
    let cancelled = false

    fetch(DATA.lamps)
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (cancelled || !payload?.lamps?.length) return

        group = L.layerGroup()
        for (const lamp of payload.lamps) {
          const lat = Number(lamp.lat)
          const lng = Number(lamp.lng)
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

          const type = LAMP_TYPES.find((t) => t.id === lamp.type)
          const colour = cssToken(`--risk-${type?.risk ?? 'moderate'}`)

          const marker = L.circleMarker([lat, lng], {
            radius: 6,
            color: colour,
            weight: 2,
            fillColor: colour,
            fillOpacity: 0.85,
          })

          // Built as nodes rather than innerHTML — the survey notes are our own
          // text today, but this popup would happily render anything the file
          // contained, and lamps.json is meant to grow by contribution.
          const popup = document.createElement('div')
          const title = document.createElement('strong')
          title.textContent = type?.label ?? lamp.type
          popup.append(title)
          const line = (text) => {
            if (!text) return
            popup.append(document.createElement('br'))
            popup.append(document.createTextNode(text))
          }
          line(lamp.what)
          line(type?.appearance)
          if (lamp.kind) line(`Fixture: ${lamp.kind}`)
          if (lamp.surveyed) line(`Surveyed ${lamp.surveyed}`)
          if (lamp.method === 'visual') line('Classified by eye, not by the classifier')
          marker.bindPopup(popup)
          marker.addTo(group)
        }

        group.addTo(map)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (group) map.removeLayer(group)
    }
  }, [map])

  return null
}

function hexPositions(lat, lng, cell) {
  const latRadius = cell * 0.46
  const lngRadius = (cell * 0.46) / Math.cos((lat * Math.PI) / 180)

  const positions = []
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i
    positions.push([
      lat + Math.sin(angle) * latRadius,
      lng + Math.cos(angle) * lngRadius,
    ])
  }
  return positions
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
          low: cssToken('--risk-low'),
          moderate: cssToken('--risk-moderate'),
          high: cssToken('--risk-high'),
        }

        if (!fills.low || !fills.moderate || !fills.high) return

        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const value = data[row * cols + col]
            // Skip zero-risk cells, not just no-data ones. 4,814 of the 6,749
            // land cells score exactly 0 — habitat or density is absent, so
            // there is nothing to show. Drawing them buries the 210 cells that
            // are moderate or above under three times as many blank ones.
            if (typeof value !== 'number' || value <= 0) continue

            const lat = bbox[1] + (row + 0.5) * cell
            const lng = bbox[0] + (col + 0.5) * cell
            const band = bandForRisk(value)

            L.polygon(hexPositions(lat, lng, cell), {
              renderer,
              interactive: false,
              bubblingMouseEvents: false,
              stroke: false,
              fillColor: fills[band],
              fillOpacity: opacity,
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
