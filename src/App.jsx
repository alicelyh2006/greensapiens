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
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('nightjar-theme') || 'dark' } catch { return 'dark' } })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('nightjar-theme', theme) } catch { /* storage may be unavailable */ }
  }, [theme])

  useEffect(() => {
    let cancelled = false
    initScoring().then((status) => { if (!cancelled) { setDataStatus(status); setReady(true) } })
    return () => { cancelled = true }
  }, [])

  function handleSelect(location) {
    setSelected(location)
    setRisk(scoreLocation(location.lat, location.lng))
  }

  return <div className="app">
    <header className="app__header"><h1 className="app__title">Nightjar</h1><p className="app__tagline">Bird-collision risk in Singapore</p><button className="app__theme" type="button" onClick={() => setTheme((v) => v === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Light mode' : 'Night mode'}</button></header>
    <main className="app__body">
      <div className="app__map"><MapView selected={selected} onSelect={ready ? handleSelect : () => {}} scoringReady={ready} theme={theme} /></div>
      <aside className="app__side">{ready ? <ResultPanel risk={risk} location={selected} dataStatus={dataStatus} /> : <p className="app__loading">Loading map data…</p>}</aside>
    </main>
  </div>
}
