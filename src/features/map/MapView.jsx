/**
 * F1 map · F2 risk surface · F3 click-select · F4 search · F12 layers
 * OWNER: L2 (Map)
 *
 * Renders a Singapore basemap with habitat + risk overlays, click-to-select,
 * address search, and layer controls. All risk scoring delegates to the
 * L1-owned scoreLocation() contract — no risk logic lives here.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Rectangle, ZoomControl, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { MAP_DEFAULT, MAP_BOUNDS, RISK_SURFACE } from '../../lib/config.js'
import { buildRiskGrid } from './riskGrid.js'
import './MapView.css'

// Fix Leaflet default marker icons — Vite does not resolve them automatically.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

/** Constrain panning to Singapore and surrounding waters. */


function RiskSurface({ cells }) {
  return (
    <>
      {cells.map((cell) => (
        <Rectangle
          key={cell.key}
          bounds={cell.bounds}
          pathOptions={{
            className: `risk-cell risk-cell--${cell.band}`,
            fillOpacity: RISK_SURFACE.opacity,
            weight: 0,
            interactive: false,
          }}
        />
      ))}
    </>
  )
}

function ClickHandler({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

export default function MapView({ selected, onSelect }) {
  const riskGrid = useState(() => buildRiskGrid())[0]

  return (
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
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <RiskSurface cells={riskGrid} />
      <ClickHandler onSelect={onSelect} />
      {selected && (
        <Marker position={[selected.lat, selected.lng]}>
          <Popup>
            <strong>Selected location</strong><br />
            {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
          </Popup>
        </Marker>
      )}
    </MapContainer>
  )
}
