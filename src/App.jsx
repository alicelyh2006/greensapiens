import { useEffect, useMemo, useState } from 'react'
import MapView from './features/map/MapView.jsx'
import ResultPanel from './features/result/ResultPanel.jsx'
import Methodology from './features/result/Methodology.jsx'
import ReportForm from './features/capture/ReportForm.jsx'
import LampUpload from './features/capture/LampUpload.jsx'
import { initScoring, scoreLocation, simulateLightExposure } from './lib/score.js'
import './App.css'

const DEFAULT_REPORT = {
  location: '',
  date: '',
  time: '',
  species: '',
  notes: '',
}

function Icon({ name, size = 16 }) {
  const paths = {
    map: 'M3 4.5 8 2l8 3.5 5-2.5v16l-5 2.5-8-3.5-5 2.5v-16ZM8 2v16M16 5.5v16',
    eye: 'M2 12s3.2-6 10-6 10 6 10 6-3.2 6-10 6S2 12 2 12Zm10 3.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z',
    report: 'M7 3h10v4H7zM5 7h14v13H5zM8 11h8M8 15h6',
    insight: 'M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3Zm-3 18h6',
    info: 'M12 8v8M12 5.2v.1',
    lamp: 'M9 20h6M10 17h4M12 3a5 5 0 0 0-3 8.9c.7.5 1 1.1 1 1.9h4c0-.8.3-1.4 1-1.9A5 5 0 0 0 12 3Z',
    warning: 'M12 3 2.8 20h18.4L12 3Zm0 6v5M12 17v.1',
    moon: 'M20.5 14.8A8.7 8.7 0 0 1 9.2 3.5 8.8 8.8 0 1 0 20.5 14.8Z',
    search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm5-1 5 5',
    close: 'm6 6 12 12M18 6 6 18',
    bird: 'M4 17c3-1 4-5 8-7 2-1 4-1 7-4-1 4-3 7-7 8-2 .5-4 .5-6 3l-2-2Zm8-7 2-5 2 3',
    filter: 'M4 6h16M7 12h10M10 18h4',
  }
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name] || paths.info} />
    </svg>
  )
}

function Sidebar({ theme, onTheme, activeTab, onTabChange, layers, onLayerChange }) {
  const nav = [
    ['map', 'Risk Map', 'risk'],
    ['eye', 'Lamp Observations', 'observations'],
    ['report', 'Report Collision', 'report'],
    ['info', 'How It Works', 'method'],
  ]
  const layerRows = [
    ['risk', 'Risk Heatmap'],
    ['habitat', 'Habitat (NParks)'],
    ['lamp', 'Lamp Observations'],
    ['reports', 'Collision Reports'],
  ]

  return (
    <aside className="app__sidebar">
      <div className="brand">
        <div className="brand__mark"><Icon name="bird" size={30} /></div>
        <div>
          <div className="brand__name">NIGHTJAR</div>
          <div className="brand__tag">See the light. See the risk. Change the night.</div>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Primary">
        {nav.map(([icon, label, tab]) => (
          <button
            key={tab}
            className={`sidebar-nav__item ${activeTab === tab ? 'sidebar-nav__item--active' : ''}`}
            type="button"
            aria-current={activeTab === tab ? 'page' : undefined}
            onClick={() => onTabChange(tab)}
          >
            <Icon name={icon} /> <span>{label}</span>
          </button>
        ))}
      </nav>

      <section className="sidebar-section">
        <div className="sidebar-section__title">LAYERS</div>
        <div className="layer-list">
          {layerRows.map(([key, label]) => (
            <label className="layer-row" key={label}>
              <input
                type="checkbox"
                checked={layers[key]}
                onChange={(e) => onLayerChange(key, e.target.checked)}
              />
              <span className={`layer-dot layer-dot--${key}`} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>

      <div className="season-card">
        <div className="season-card__icon"><Icon name="bird" size={17} /></div>
        <div>
          <div className="season-card__label">Peak Migration Season</div>
          <strong>October – November</strong>
        </div>
      </div>

      <div className="sidebar-about">
        <div className="sidebar-section__title">ABOUT NIGHTJAR</div>
        <p>Nightjar maps light pollution and habitat factors to identify potential bird-collision risk areas in Singapore.</p>
      </div>

    </aside>
  )
}

function WorkspaceHeader({ activeTab, theme, onTheme }) {
  const titles = {
    risk: ['Risk Map', 'Explore Singapore’s estimated bird-collision risk.'],
    observations: ['Lamp Observations', 'Review the existing field-observation gallery.'],
    report: ['Report a Collision', 'Record a local incident and keep the draft on this device.'],
    method: ['How This Is Calculated', 'What the score is built from, and what it cannot tell you.'],
  }
  const [title, subtitle] = titles[activeTab]
  return (
    <header className="workspace-header">
      <div>
        <div className="workspace-header__eyebrow">NIGHTJAR / {activeTab === 'risk' ? 'MAP' : activeTab.toUpperCase()}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <button className="workspace-header__theme" type="button" onClick={onTheme}>
        <Icon name="moon" size={14} />
        {theme === 'dark' ? 'Night Mode' : 'Day Mode'}
      </button>
    </header>
  )
}

function RiskMapView({ selected, risk, simulatedRisk, onSelect, theme, layers, onClear, onSimulate }) {
  return (
    <section className="risk-view">
      <div className="risk-view__map">
        <MapView
          selected={selected}
          onSelect={onSelect}
          theme={theme}
          riskVisible={layers.risk}
          habitatVisible={layers.habitat}
          lampsVisible={layers.lamp}
          reportsVisible={layers.reports}
          visible
        />
      </div>
      <aside className="app__inspector">
        <ResultPanel
          risk={simulatedRisk || risk}
          baseRisk={risk}
          location={selected}
          onClose={onClear}
          onSimulate={onSimulate}
        />
      </aside>
    </section>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('risk')
  const [ready, setReady] = useState(false)
  const [dataStatus, setDataStatus] = useState(null)
  const [selected, setSelected] = useState(null)
  const [risk, setRisk] = useState(null)
  const [simulationLight, setSimulationLight] = useState(null)
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('nightjar-theme') || 'dark' } catch { return 'dark' }
  })
  const [layers, setLayers] = useState(() => {
    // Keys must match what MapView reads. 'warning' used to sit here in place
    // of 'reports', so that checkbox wrote a key nothing consumed.
    const defaults = { risk: true, habitat: true, lamp: true, reports: true }
    try {
      const saved = JSON.parse(localStorage.getItem('nightjar-layers'))
      return saved ? { ...defaults, ...saved } : defaults
    } catch {
      return defaults
    }
  })
  const [reportDraft, setReportDraft] = useState(DEFAULT_REPORT)
  const [reportSubmitted, setReportSubmitted] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('nightjar-theme', theme) } catch { /* private browsing */ }
  }, [theme])

  useEffect(() => {
    try { localStorage.setItem('nightjar-layers', JSON.stringify(layers)) } catch { /* private browsing */ }
  }, [layers])

  useEffect(() => {
    let cancelled = false
    initScoring().then((status) => {
      if (cancelled) return
      setDataStatus(status)
      setReady(true)
    })
    return () => { cancelled = true }
  }, [])

  function handleSelect(location) {
    if (!location) {
      setSelected(null)
      setRisk(null)
      setSimulationLight(null)
      return null
    }
    if (!ready) return false

    const nextRisk = scoreLocation(location.lat, location.lng)
    setSelected(location)
    setRisk(nextRisk)
    // Do NOT seed the simulator here. Seeding it made simulatedRisk non-null on
    // every click, so displayRisk was always the simulated one, and
    // simulateLightExposure overwrote the light note with "Simulated light
    // exposure: N/100" everywhere. A measured reading from the field survey and
    // a pure fallback guess were then worded identically, which hid the survey
    // in the one place it would have shown up. There is also no slider in the UI
    // yet, so nothing was ever being simulated. Left null until something calls
    // onSimulate.
    setSimulationLight(null)
    return location
  }

  function handleLayerChange(key, value) {
    setLayers((current) => ({ ...current, [key]: value }))
  }

  function handleReportChange(event) {
    const { name, value } = event.target
    setReportSubmitted(false)
    setReportDraft((current) => ({ ...current, [name]: value }))
  }

  function handleReportSubmit(event) {
    event.preventDefault()
    const record = { ...reportDraft, submittedAt: new Date().toISOString() }
    try {
      const existing = JSON.parse(localStorage.getItem('nightjar.reports.v1') || '[]')
      localStorage.setItem('nightjar.reports.v1', JSON.stringify([...existing, record]))
    } catch { /* private browsing */ }
    setReportSubmitted(true)
  }

  const simulatedRisk = useMemo(() => {
    if (!risk || simulationLight === null) return null
    return simulateLightExposure(risk, simulationLight)
  }, [risk, simulationLight])

  const displayRisk = simulatedRisk || risk

  return (
    <div className="app">
      <Sidebar
        theme={theme}
        onTheme={() => setTheme((v) => v === 'dark' ? 'light' : 'dark')}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        layers={layers}
        onLayerChange={handleLayerChange}
      />

      <main className="app__workspace">
        <WorkspaceHeader
          activeTab={activeTab}
          theme={theme}
          onTheme={() => setTheme((v) => v === 'dark' ? 'light' : 'dark')}
        />

        <div className="app__view-stack">
          <div className={`view-shell ${activeTab === 'risk' ? 'view-shell--active' : ''}`} aria-hidden={activeTab !== 'risk'}>
            <RiskMapView
              selected={selected}
              risk={risk}
              simulatedRisk={displayRisk}
              onSelect={handleSelect}
              theme={theme}
              layers={layers}
              onClear={() => handleSelect(null)}
              onSimulate={setSimulationLight}
            />
          </div>

          <div className={`view-shell ${activeTab === 'observations' ? 'view-shell--active' : ''}`} aria-hidden={activeTab !== 'observations'}>
            <LampUpload />
          </div>

          <div className={`view-shell ${activeTab === 'report' ? 'view-shell--active' : ''}`} aria-hidden={activeTab !== 'report'}>
            <ReportForm
              draft={reportDraft}
              onChange={handleReportChange}
              onSubmit={handleReportSubmit}
              submitted={reportSubmitted}
              selectedLocation={selected}
            />
          </div>

          {/* F8 — methodology and sources. N8 requires this to be reachable in
              the app, not only in the README: the score is a hand-tuned
              heuristic and the interface has to say so somewhere a judge or a
              town council can actually find it. */}
          <div className={`view-shell ${activeTab === 'method' ? 'view-shell--active' : ''}`} aria-hidden={activeTab !== 'method'}>
            <Methodology />
          </div>
        </div>

        <div className="sr-only" aria-live="polite">
          {dataStatus ? 'Nightjar data loaded.' : 'Loading Nightjar data.'}
        </div>
      </main>
    </div>
  )
}
