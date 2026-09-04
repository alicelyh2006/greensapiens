/**
 * F5 score display · F6 recommendations · F7 seasonal context
 * OWNER: L3 (Result & Guidance)
 *
 * Turns a RiskResult into something a person can act on. Builds against the
 * mock scoreLocation — needs nothing from any other lane.
 */
import { Panel, RiskPill, EmptyState } from '../../components/index.jsx'
import { getRecommendations, isPeakSeason } from '../../lib/recommendations.js'
import { WEIGHTS } from '../../lib/config.js'
import './result.css'

// ── Private sub-components ────────────────────────────────────────────────────

/** Derive a risk band label from a 0–1 factor value. */
function valueToBand(value) {
  if (value >= 0.67) return 'high'
  if (value >= 0.34) return 'moderate'
  return 'low'
}

/** F5 — a single factor row: label, weight, progress bar, and note. */
function FactorBar({ name, factor }) {
  const band = valueToBand(factor.value)
  const pct = Math.round(factor.value * 100)
  const weightPct = Math.round(factor.weight * 100)
  return (
    <div className="factor-item">
      <div className="factor-header">
        <span className="factor-name">{name}</span>
        <span className="factor-weight">{weightPct}% weight · {pct}/100</span>
      </div>
      <div className="factor-bar">
        <div
          className={`factor-fill factor-fill--${band}`}
          style={{ width: `${pct}%` }}
          role="meter"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${name} ${pct} out of 100`}
        />
      </div>
      <p className="factor-note">{factor.note}</p>
    </div>
  )
}

/** F6 — a single recommendation card with action, why, owner, and horizon. */
function RecCard({ rec }) {
  const horizonLabels = { now: 'Act now', seasonal: 'Seasonal', permanent: 'Long-term' }
  return (
    <div className="rec-item">
      <p className="rec-action">{rec.action}</p>
      <p className="rec-why">{rec.why}</p>
      <div className="rec-meta">
        <span className="owner-badge">{rec.owner}</span>
        <span className={`horizon-tag horizon-tag--${rec.horizon}`}>
          {horizonLabels[rec.horizon] ?? rec.horizon}
        </span>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ResultPanel({ risk, location }) {
  if (!risk) {
    return (
      <Panel>
        <EmptyState
          title="Pick a place on the map"
          body="Tap anywhere in Singapore to see how likely bird-building collisions are there, and what would reduce them."
        />
      </Panel>
    )
  }

  const recommendations = getRecommendations(risk)
  const peakSeason = isPeakSeason()

  return (
    <Panel title="Collision risk">
      <RiskPill band={risk.band} />

      {risk.isMock && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>
          Habitat and building density use real data. Light is estimated until
          our field survey is complete, so this score will change.
        </p>
      )}

      {/* F7 — seasonal alert: amber banner during Oct–Nov */}
      {peakSeason && (
        <div className="season-alert" role="alert">
          <p className="season-alert__heading">🐦 Peak migration period</p>
          <p className="season-alert__body">
            October – November is when migratory birds along the East Asian–Australasian
            Flyway pass through Singapore. Collision risk is highest now.
          </p>
        </div>
      )}

      {/* F5 — factor breakdown */}
      <div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-faint)', marginBottom: 'var(--space-2)' }}>
          Why this score
        </p>
        <div className="factor-list">
          <FactorBar name="Habitat proximity" factor={risk.factors.habitat} />
          <FactorBar name="Light level" factor={risk.factors.light} />
          <FactorBar name="Building density" factor={risk.factors.density} />
        </div>
      </div>

      {/* F6 — recommendations */}
      <div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-faint)', marginBottom: 'var(--space-2)' }}>
          What would help
        </p>
        <div className="rec-list">
          {recommendations.map((rec, i) => (
            <RecCard key={i} rec={rec} />
          ))}
        </div>
      </div>
    </Panel>
  )
}

