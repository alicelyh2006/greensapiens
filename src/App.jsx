/**
 * Nightjar — app shell.
 *
 * Holds the selected location and the risk result, and wires the four lanes
 * together. Keep feature logic in features/; this file just composes.
 *
 * Test edit for git push verification.
 */
import { useState } from 'react'
import MapView from './features/map/MapView.jsx'
import ResultPanel from './features/result/ResultPanel.jsx'
import Methodology from './features/result/Methodology.jsx'
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
          {/* F8: methodology disclosure — collapsible, below the result panel */}
          <details style={{ marginTop: 'var(--space-3)' }}>
            <summary style={{
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-faint)',
              listStyle: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) 0',
              borderTop: '1px solid var(--line)',
            }}>
              How is this calculated? ▸
            </summary>
            <div style={{ marginTop: 'var(--space-3)' }}>
              <Methodology />
            </div>
          </details>
        </aside>
      </main>
    </div>
  )
}
