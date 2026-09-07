import { Panel } from '../../components/index.jsx'
import { getRecommendations } from '../../lib/recommendations.js'

const LABELS = { habitat: 'Habitat Proximity', light: 'Light Exposure', density: 'Building Density' }
const ICONS = { habitat: '✦', light: '☾', density: '▦' }

function pct(value) { return Math.round(value * 100) }

function bandLabel(band) {
  return band === 'high' ? 'HIGH' : band === 'moderate' ? 'MODERATE' : band === 'low' ? 'LOW' : 'NOT ASSESSED'
}

export default function ResultPanel({ risk, baseRisk, location, onClose, onSimulate }) {
  if (!risk) {
    return (
      <Panel>
        <div className="inspector-empty">
          <div className="inspector-empty__icon">⌖</div>
          <span>NIGHTJAR RISK</span>
          <strong>Pick a place on the map</strong>
          <p>Search for an address or tap a location on Singapore land to see its estimated collision risk.</p>
        </div>
      </Panel>
    )
  }

  if (risk.unavailable) {
    return <Panel><div className="inspector-empty"><span>NIGHTJAR RISK</span><strong>No assessment</strong><p>This location is outside the assessable Singapore land area.</p></div></Panel>
  }

  const recommendations = getRecommendations(risk)
  const locationName = location?.label?.split(',')[0] || 'Selected location'
  const region = location?.label?.split(',').slice(1, 2)[0]?.trim() || 'Singapore'
  const isSimulated = Boolean(risk.isSimulation)
  const baseTotal = baseRisk?.total ?? risk.total

  return (
    <Panel>
      <div className="inspector-head">
        <div><strong>{locationName}</strong><span>{region}</span></div>
        <button className="inspector-close" type="button" aria-label="Clear selected location" onClick={onClose}>×</button>
      </div>

      <div className="score-card">
        <div>
          <span className="eyebrow">NIGHTJAR RISK</span>
          <div className="score-line"><strong>{risk.total}</strong><span>/100</span><b className={`score-band score-band--${risk.band}`}>{bandLabel(risk.band)}</b></div>
          {isSimulated && <small className="simulation-note">Hypothetical lighting scenario · base {baseTotal}/100</small>}
          {!isSimulated && <small>What does this mean? ⓘ</small>}
        </div>
        <div className={`risk-ring risk-ring--${risk.band}`} style={{ '--risk-angle': `${Math.max(8, risk.total * 3.6)}deg` }}><div><IconBird /></div></div>
      </div>

      <div className="factor-stack">
        {Object.entries(risk.factors).map(([key, factor]) => (
          <div className="factor-row" key={key}>
            <div className="factor-row__label"><span className={`factor-icon factor-icon--${key}`}>{ICONS[key]}</span><span>{LABELS[key]}</span></div>
            <div className="factor-row__bar"><span style={{ width: `${pct(factor.value)}%` }} /></div>
            <strong>{pct(factor.value)}<small>/100</small></strong>
          </div>
        ))}
      </div>

      <div className="simulation-panel">
        <div className="simulation-panel__head">
          <div><span className="eyebrow">WHAT IF WE DIM THE LIGHTS?</span><p>Adjust the selected location's light exposure and see the projected risk immediately.</p></div>
          <span className="simulation-badge">LIVE</span>
        </div>
        <div className="simulation-row"><span>Current Light Exposure</span><strong>{baseRisk ? pct(baseRisk.factors.light.value) : 0}<small>/100</small></strong></div>
        <input
          className="risk-slider"
          type="range"
          min="0"
          max="100"
          value={isSimulated ? pct(risk.factors.light.value) : pct(baseRisk?.factors?.light?.value ?? 1)}
          onChange={(e) => onSimulate?.(Number(e.target.value))}
          aria-label="Simulated light exposure"
        />
        <div className="simulation-row simulation-row--muted"><span>Simulated Light Exposure</span><strong>{pct(risk.factors.light.value)}<small>/100</small></strong></div>
        <div className="projection projection--inspector">
          <div><span>Projected risk</span><strong>{baseTotal} <em>→</em> {risk.total}</strong></div>
          <small>{Math.max(0, Math.round((1 - risk.total / Math.max(1, baseTotal)) * 100))}% reduction</small>
        </div>
      </div>

      <div className="inspector-section">
        <span className="eyebrow">WHY THIS LOCATION?</span>
        <p>High light exposure and building density near habitat can create a stronger collision risk for migratory birds.</p>
      </div>

      <div className="inspector-section inspector-section--split">
        <div><span className="eyebrow">PEAK CONCERN</span><strong className="peak-text">October – November</strong></div>
        <div className="bird-line"><IconBird /></div>
      </div>

      <div className="inspector-section action-section">
        <div className="action-icon">☼</div>
        <div><span className="eyebrow">RECOMMENDED ACTION</span><p>{recommendations[0]?.action || 'Reduce blue-rich exterior lighting during migration season.'}</p></div>
      </div>

      <div className="inspector-section owner-section">
        <div className="action-icon">▦</div>
        <div><span className="eyebrow">LIKELY OWNER / AUTHORITY</span><strong>Private Building Management</strong><p>Consult URA guidelines</p></div>
      </div>

      <button className="agency-button" type="button">More info on agencies <span>→</span></button>
    </Panel>
  )
}

function IconBird() {
  return <svg width="35" height="24" viewBox="0 0 50 32" fill="none" aria-hidden="true"><path d="M5 23c7-2 9-8 17-11 5-2 9-2 17-8-2 8-6 13-14 15-4 1-8 1-12 6l-8-2Z" fill="currentColor" opacity=".9"/><path d="m22 12 3-8 4 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
}
