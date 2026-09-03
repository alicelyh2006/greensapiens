/**
 * Nightjar — app shell.
 *
 * Loads the static datasets once, then holds the selected location and its
 * risk result. Keep feature logic in features/; this file only composes.
 */
import { useEffect, useState } from 'react'
import MapView from './features/map/MapView.jsx'
import ResultPanel from './features/result/ResultPanel.jsx'
import { initScoring, scoreLocation } from './lib/score.js'
import './App.css'

export default function App() {
  const [ready, setReady] = useState(false)
  const [dataStatus, setDataStatus] = useState(null)
  const [selected, setSelected] = useState(null)
  const [risk, setRisk] = useState(null)

  // Datasets load once. scoreLocation stays synchronous afterwards, because
  // three other lanes call it directly and must not have to await.
  useEffect(() => {
    let cancelled = false
    initScoring().then((status) => {
      if (cancelled) return
      setDataStatus(status)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

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
            Must degrade to map-click (F3) if OneMap is unreachable. */}
      </header>

      <main className="app__body">
        <div className="app__map">
          <MapView selected={selected} onSelect={ready ? handleSelect : () => {}} />
        </div>

        <aside className="app__side">
          {ready ? (
            <ResultPanel risk={risk} location={selected} dataStatus={dataStatus} />
          ) : (
            <p className="app__loading">Loading map data…</p>
          )}
          {/* TODO(L4): mount LampUpload and ReportForm here once they do something */}
          {/* TODO(L3 · F8): route or disclose Methodology */}
        </aside>
      </main>
    </div>
  )
}
