/**
 * F1 map · F2 risk surface · F3 click-select · F4 search · F12 layers
 * OWNER: L2 (Map)
 *
 * Renders a Singapore basemap and reports clicks upward. Everything else is
 * still to build.
 */
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import { MAP_DEFAULT } from '../../lib/config.js'

function ClickHandler({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

export default function MapView({ selected, onSelect }) {
  return (
    <MapContainer
      center={MAP_DEFAULT.center}
      zoom={MAP_DEFAULT.zoom}
      minZoom={MAP_DEFAULT.minZoom}
      maxZoom={MAP_DEFAULT.maxZoom}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* TODO(L2 · F1): GeoJSON layer for NParks boundaries from public/data/ */}
      {/* TODO(L2 · F2): risk surface — grid or choropleth coloured by score */}
      {/* TODO(L2 · F12): layer toggles for risk / habitat / lamps / reports */}

      <ClickHandler onSelect={onSelect} />
      {selected && <Marker position={[selected.lat, selected.lng]} />}
    </MapContainer>
  )
}
