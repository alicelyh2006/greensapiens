/**
 * Nightjar — app shell.
 *
 * Loads the static datasets once, then holds the selected location and its
 * risk result. Keep feature logic in features/; this file only composes.
 */
import { useEffect, useState } from 'react'
import MapView from './features/map/MapView.jsx'
import ResultPanel from './features/result/ResultPanel.jsx'
import Methodology from './features/result/Methodology.jsx'
import { initScoring, scoreLocation } from './lib/score.js'
import './App.css'

export default function App() {
  // Theme toggle, adopted from L2's branch. Persisted per viewer; the token
  // set in styles/tokens.css already handles data-theme in both directions.
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('nightjar-theme') || 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('nightjar-theme', theme)
    } catch {
      /* private windows throw — the theme just will not persist */
    }
  }, [theme])

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
        <button
          className="app__theme"
          type="button"
          onClick={() => setTheme((v) => (v === 'dark' ? 'light' : 'dark'))}
        >
          {theme === 'dark' ? 'Light mode' : 'Night mode'}
        </button>
        {/* TODO(L2 · F4): address / postal code search goes here.
            Must degrade to map-click (F3) if OneMap is unreachable. */}
      </header>

      <main className="app__body">
        <div className="app__map">
          <MapView
            selected={selected}
            onSelect={ready ? handleSelect : () => {}}
            theme={theme}
          />
        </div>

        <aside className="app__side">
          {ready ? (
            <ResultPanel risk={risk} location={selected} dataStatus={dataStatus} />
          ) : (
            <p className="app__loading">Loading map data…</p>
          )}
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
