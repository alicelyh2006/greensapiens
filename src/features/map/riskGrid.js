import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import { scoreLocation } from '../../lib/score.js'
import { MAP_BOUNDS, RISK_SURFACE } from '../../lib/config.js'

function land(lat, lng, features) {
  if (!features?.length) return false
  const p = point([lng, lat])
  return features.some((f) => booleanPointInPolygon(p, f))
}

function polygonStaysOnLand(positions, features) {
  return positions.every(([lat, lng]) => land(lat, lng, features))
}

function hex(lat, lng, latStep, lngStep) {
  const rLat = latStep * 0.42
  const rLng = lngStep * 0.42
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6
    return [lat + rLat * Math.sin(a), lng + rLng * Math.cos(a)]
  })
}

export function buildRiskGrid({ bounds = MAP_BOUNDS, rows = RISK_SURFACE.rows, columns = RISK_SURFACE.columns, boundaryFeatures } = {}) {
  const [[south, west], [north, east]] = bounds
  const latStep = (north - south) / rows
  const lngStep = (east - west) / columns
  const cells = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const lat = south + (row + 0.5) * latStep
      const lng = west + (column + 0.5) * lngStep
      if (!land(lat, lng, boundaryFeatures)) continue
      const positions = hex(lat, lng, latStep, lngStep)
      // Do not draw a cell unless the whole hex remains inside the land mask.
      if (!polygonStaysOnLand(positions, boundaryFeatures)) continue
      const score = scoreLocation(lat, lng)
      if (score.total <= 0) continue
      cells.push({ key: `${row}-${column}`, center: [lat, lng], positions, total: score.total, band: score.band })
    }
  }
  return cells
}
