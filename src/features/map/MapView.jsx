/**
 * F1 map · F2 risk surface · F3 click-select · F4 search · F12 layers
 * OWNER: L2 (Map)
 */
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import { MAP_DEFAULT, MAP_BOUNDS } from '../../lib/config.js'
import { GreenSpaceLayer, RiskLayer } from './layers.jsx'
import './MapView.css'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow })

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

/* L2's runtime RiskSurface was removed here. It scored every cell in the
   browser on load — at 45x70 that is ~6s of blocking work, which breaks the
   3-second budget (N2). The precomputed grid in layers.jsx renders the same
   surface instantly from a 52 KB file. L2's land-mask idea was kept and moved
   into scripts/build-risk-grid.mjs. */

function SearchControl({ onSelect }) {
  const map = useMap()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function search(e) {
    e?.preventDefault()
    const q = query.trim()
    if (!q) return
    setLoading(true); setError(''); setResults([])
    try {
      const params = new URLSearchParams({ q, format: 'jsonv2', limit: '5', countrycodes: 'sg', viewbox: '103.59,1.47,104.10,1.15', bounded: '1' })
      const res = await fetch(`${NOMINATIM_URL}?${params}`)
      if (!res.ok) throw new Error('Search unavailable')
      const data = await res.json()
      if (!data.length) { setError('No Singapore location found.'); return }
      setResults(data)
    } catch {
      setError('Search is temporarily unavailable. You can still click the map.')
    } finally { setLoading(false) }
  }

  function choose(item) {
    const lat = Number(item.lat), lng = Number(item.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    map.setView([lat, lng], Math.max(map.getZoom(), 15), { animate: true })
    const accepted = onSelect({ lat, lng, label: item.display_name })
    if (accepted === false) { setError('That result is outside the assessable Singapore land area.'); return }
    setResults([])
    setQuery(item.display_name.split(',').slice(0, 2).join(','))
  }

  return (
    <form className="map-search" onSubmit={search}>
      <span className="map-search__icon" aria-hidden="true">⌕</span>
      <input className="map-search__input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search address, building or postal code" aria-label="Search Singapore location" />
      {loading && <div className="map-search__status">Searching…</div>}
      {error && <div className="map-search__error">{error}</div>}
      {results.length > 0 && <ul className="map-search__results">
        {results.map((item) => <li key={`${item.place_id}-${item.lat}-${item.lon}`} className="map-search__result" onMouseDown={() => choose(item)}>
          <div className="map-search__result-title">{item.name || item.display_name.split(',')[0]}</div>
          <div className="map-search__result-sub">{item.display_name}</div>
        </li>)}
      </ul>}
    </form>
  )
}



function ClickHandler({ onSelect, isSelectable }) {
  useMapEvents({ click(e) { if (isSelectable(e.latlng.lat, e.latlng.lng)) onSelect({ lat: e.latlng.lat, lng: e.latlng.lng }) } })
  return null
}

function isInsideBoundary(lat, lng, boundary) {
  if (!boundary?.features?.length) return false
  const pt = point([lng, lat])
  return boundary.features.some((feature) => booleanPointInPolygon(pt, feature))
}

export default function MapView({ selected, onSelect, scoringReady, theme = 'light' }) {
  const [boundary, setBoundary] = useState(null)
  const [riskVisible, setRiskVisible] = useState(true)

  useEffect(() => {
    fetch('/data/singapore-boundary.geojson').then((r) => r.ok ? r.json() : null).then(setBoundary).catch(() => setBoundary(null))
  }, [])

  const tileUrl = theme === 'dark'
    ? 'https://www.onemap.gov.sg/maps/tiles/Night/{z}/{x}/{y}.png'
    : 'https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png'
  const attribution = '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:16px;width:16px;vertical-align:middle"/> <a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a> © contributors | <a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>'

  const selectable = useMemo(() => (lat, lng) => isInsideBoundary(lat, lng, boundary), [boundary])

  return <div className="map-shell">
    <MapContainer center={MAP_DEFAULT.center} zoom={MAP_DEFAULT.zoom} minZoom={MAP_DEFAULT.minZoom} maxZoom={MAP_DEFAULT.maxZoom} maxBounds={MAP_BOUNDS} maxBoundsViscosity={0.8} scrollWheelZoom zoomControl={false}>
      <ZoomControl position="bottomright" />
      <TileLayer key={theme} attribution={attribution} url={tileUrl} maxZoom={19} minZoom={11} detectRetina />
      <SearchControl onSelect={(location) => { if (!selectable(location.lat, location.lng)) return false; onSelect(location); return true }} />
      {riskVisible && <RiskLayer theme={theme} />}
      <GreenSpaceLayer />
      <ClickHandler onSelect={onSelect} isSelectable={selectable} />
      {selected && <Marker position={[selected.lat, selected.lng]}><Popup><strong>{selected.label || 'Selected location'}</strong><br />{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</Popup></Marker>}
    </MapContainer>
    <div className="map-tools">
      <button className={`layer-toggle ${riskVisible ? 'layer-toggle--active' : ''}`} type="button" onClick={() => setRiskVisible((v) => !v)}>{riskVisible ? 'Hide risk' : 'Show risk'}</button>
    </div>
    <div className="map-legend">
      <div className="map-legend__title">Collision risk</div>
      <div className="map-legend__items"><span><i className="legend-swatch legend-swatch--low" />Low</span><span><i className="legend-swatch legend-swatch--moderate" />Moderate</span><span><i className="legend-swatch legend-swatch--high" />High</span></div>
    </div>
  </div>
}
