/**
 * L2 risk-surface adapter.
 *
 * The map never reimplements the risk formula. Each cell delegates to the
 * L1-owned scoreLocation(lat, lng) contract and stores only the returned
 * total/band needed for rendering.
 */
import { scoreLocation } from '../../lib/score.js'
import { MAP_BOUNDS, RISK_SURFACE } from '../../lib/config.js'

export function buildRiskGrid({ bounds = MAP_BOUNDS, rows = RISK_SURFACE.rows, columns = RISK_SURFACE.columns } = {}) {
  const [[south, west], [north, east]] = bounds
  const latStep = (north - south) / rows
  const lngStep = (east - west) / columns
  const cells = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const southLat = south + row * latStep
      const northLat = southLat + latStep
      const westLng = west + column * lngStep
      const eastLng = westLng + lngStep
      const lat = (southLat + northLat) / 2
      const lng = (westLng + eastLng) / 2
      const score = scoreLocation(lat, lng)

      cells.push({
        key: `${row}-${column}`,
        bounds: [[southLat, westLng], [northLat, eastLng]],
        total: score.total,
        band: score.band,
      })
    }
  }

  return cells
}
