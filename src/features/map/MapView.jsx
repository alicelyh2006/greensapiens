/**
 * F1 map · F2 risk surface · F3 click-select · F4 search · F12 layers
 * OWNER: L2 (Map)
 */
import { useCallback, useEffect, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  ZoomControl,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import { MAP_DEFAULT, MAP_BOUNDS, DATA } from '../../lib/config.js'
import { GreenSpaceLayer, RiskLayer } from './layers.jsx'
import './MapView.css'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const SEARCH_VIEWBOX = '103.59,1.47,104.10,1.15'
const SEARCH_ZOOM = 15
const SEARCH_RESULT_LIMIT = 5

/**
 * Resolve any map coordinate to the exact source risk-grid cell.
 *  -1 is water/outside the assessable grid and is rejected.
 *  0 is valid land with zero modelled risk and is accepted.
 */
function snapToRiskCell(lat, lng, grid) {
  if (!grid?.bbox || !grid?.cell || !grid?.cols || !grid?.rows) return null

  const [minLng, minLat] = grid.bbox
  const col = Math.floor((lng - minLng) / grid.cell)
  const row = Math.floor((lat - minLat) / grid.cell)

  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return null

  const value = grid.data?.[row * grid.cols + col]
  if (typeof value !== 'number' || value < 0) return null

  return {
    lat: minLat + (row + 0.5) * grid.cell,
    lng: minLng + (col + 0.5) * grid.cell,
    row,
    col,
    riskValue: value,
  }
}

/**
 * Leaflet's normal useMapEvents click path can be blocked by a visual
 * overlay. Listen on the map container during capture instead. This keeps
 * the risk surface and green-space layers visual-only while guaranteeing
 * map clicks reach the selection flow.
 */
function ClickHandler({ onSelect }) {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()

    function handleClick(event) {
      if (event.target?.closest?.('.leaflet-control, .map-search')) return

      const latlng = map.mouseEventToLatLng(event)
      onSelect({ lat: latlng.lat, lng: latlng.lng })
    }

    container.addEventListener('click', handleClick, true)
    return () => container.removeEventListener('click', handleClick, true)
  }, [map, onSelect])

  return null
}

function SearchControl({ onSelect, onMessage }) {
  const map = useMap()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function search(e) {
    e?.preventDefault()
    const q = query.trim()
    if (!q || loading) return

    setLoading(true)
    setError('')
    setResults([])
    onMessage?.('')

    try {
      const params = new URLSearchParams({
        q,
        format: 'jsonv2',
        limit: String(SEARCH_RESULT_LIMIT),
        countrycodes: 'sg',
        viewbox: SEARCH_VIEWBOX,
        bounded: '1',
      })

      const res = await fetch(`${NOMINATIM_URL}?${params}`)
      if (!res.ok) throw new Error('Search unavailable')

      const data = await res.json()
      if (!data.length) {
        setError('No Singapore location found.')
        return
      }

      setResults(data)
    } catch {
      setError('Search is temporarily unavailable. You can still click the map.')
    } finally {
      setLoading(false)
    }
  }

  function choose(item) {
    const lat = Number(item.lat)
    const lng = Number(item.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

    const accepted = onSelect({ lat, lng, label: item.display_name })
    if (accepted === false) {
      setError('That location is outside the assessable risk grid.')
      onMessage?.('That location is outside the assessable risk grid.')
      return
    }

    map.flyTo(
      [accepted.lat, accepted.lng],
      Math.max(map.getZoom(), SEARCH_ZOOM),
      { animate: true, duration: 0.6 }
    )

    setResults([])
    setError('')
    onMessage?.('')
    setQuery(item.name || item.display_name.split(',').slice(0, 2).join(','))
  }

  return (
    <form className="map-search" onSubmit={search}>
      <span className="map-search__icon" aria-hidden="true">⌕</span>
      <input
        className="map-search__input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search address, building or postal code"
        aria-label="Search Singapore location"
      />
      {loading && <div className="map-search__status">Searching…</div>}
      {error && <div className="map-search__error">{error}</div>}
      {results.length > 0 && (
        <ul className="map-search__results">
          {results.map((item) => (
            <li
              key={`${item.place_id}-${item.lat}-${item.lon}`}
              className="map-search__result"
              onMouseDown={() => choose(item)}
            >
              <div className="map-search__result-title">
                {item.name || item.display_name.split(',')[0]}
              </div>
              <div className="map-search__result-sub">{item.display_name}</div>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}

export default function MapView({ selected, onSelect, theme = 'light', riskVisible = true, habitatVisible = true, visible = true }) {
  const [riskGrid, setRiskGrid] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false

    fetch(DATA.riskGrid)
      .then((r) => (r.ok ? r.json() : null))
      .then((grid) => {
        if (!cancelled) setRiskGrid(grid)
      })
      .catch(() => {
        if (!cancelled) setRiskGrid(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const selectLocation = useCallback(
    (location) => {
      if (!riskGrid) {
        setMessage('Risk data is still loading. Please try again.')
        return false
      }

      const snapped = snapToRiskCell(location.lat, location.lng, riskGrid)
      if (!snapped) {
        setMessage('That location is outside the assessable Singapore land area.')
        return false
      }

      onSelect({
        lat: snapped.lat,
        lng: snapped.lng,
        label: location.label,
      })
      setMessage('')
      return snapped
    },
    [riskGrid, onSelect]
  )

  const tileUrl = theme === 'dark'
    ? 'https://www.onemap.gov.sg/maps/tiles/Night/{z}/{x}/{y}.png'
    : 'https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png'

  const attribution =
    '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:16px;width:16px;vertical-align:middle"/> ' +
    '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a> © contributors | ' +
    '<a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>'

  return (
    <div className="map-shell">
      <MapContainer
        center={MAP_DEFAULT.center}
        zoom={MAP_DEFAULT.zoom}
        minZoom={MAP_DEFAULT.minZoom}
        maxZoom={MAP_DEFAULT.maxZoom}
        maxBounds={MAP_BOUNDS}
        maxBoundsViscosity={0.8}
        scrollWheelZoom
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          key={theme}
          attribution={attribution}
          url={tileUrl}
          maxZoom={19}
          minZoom={11}
          detectRetina
        />

        <SearchControl onSelect={selectLocation} onMessage={setMessage} />

        {riskVisible && <RiskLayer theme={theme} />}
        {habitatVisible && <GreenSpaceLayer />}
        <ClickHandler onSelect={selectLocation} />

        {selected && (
          <Marker position={[selected.lat, selected.lng]}>
            <Popup>
              <strong>{selected.label || 'Selected location'}</strong>
              <br />
              {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
            </Popup>
          </Marker>
        )}
      </MapContainer>

      <div className="map-tools">
        <span className="map-mode-chip">{theme === 'dark' ? 'Night Mode' : 'Day Mode'}</span>
      </div>

      {message && <div className="map-search__error">{message}</div>}

      <div className="map-legend">
        <div className="map-legend__title">Collision risk</div>
        <div className="map-legend__items">
          <span><i className="legend-swatch legend-swatch--low" />Low</span>
          <span><i className="legend-swatch legend-swatch--moderate" />Moderate</span>
          <span><i className="legend-swatch legend-swatch--high" />High</span>
        </div>
      </div>
    </div>
  )
}
