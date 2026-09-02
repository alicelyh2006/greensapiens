/**
 * Nightjar — app shell.
 *
 * Holds the selected location and the risk result, and wires the four lanes
 * together. Keep feature logic in features/; this file just composes.
 */
import { useState } from 'react'
import MapView from './features/map/MapView.jsx'
import ResultPanel from './features/result/ResultPanel.jsx'
import { scoreLocation } from './lib/score.js'
import './App.css'

export default function App() {
  const [selected, setSelected] = useState(null)
  const [risk, setRisk] = useState(null)

  function handleSelect(location) {
    setSelected(location)
    setRisk(scoreLocation(location.lat, location.lng))
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Nightjar</h1>
        <p className="app__tagline">Bird-collision risk in Singapore</p>
        {/* TODO(L2 · F4): address / postal code search goes here.
            Must degrade to map-click (F3) if OneMap is unreachable — never block. */}
      </header>

      <main className="app__body">
        <div className="app__map">
          <MapView selected={selected} onSelect={handleSelect} />
        </div>

        <aside className="app__side">
          <ResultPanel risk={risk} location={selected} />
          {/* TODO(L4): mount LampUpload and ReportForm here once they do something */}
          {/* TODO(L3 · F8): route or disclose Methodology */}
        </aside>
      </main>
    </div>
  )
}
