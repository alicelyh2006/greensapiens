/**
 * F5 score display · F6 recommendations · F7 seasonal context
 * OWNER: L3 (Result & Guidance)
 *
 * Turns a RiskResult into something a person can act on. Builds against the
 * mock scoreLocation — needs nothing from any other lane.
 */
import { Panel, RiskPill, EmptyState } from '../../components/index.jsx'
import { getRecommendations, isPeakSeason } from '../../lib/recommendations.js'
import { MODEL } from '../../lib/config.js'
import './result.css'

// ── Private sub-components ────────────────────────────────────────────────────

/** Derive a risk band label from a 0–1 factor value. */
function valueToBand(value) {
  if (value >= 0.67) return 'high'
  if (value >= 0.34) return 'moderate'
  return 'low'
}

/**
 * F5 — a single factor row: label, role in the model, progress bar, and note.
 *
 * `role` says how this factor enters the score, and it is not decoration. The
 * model multiplies habitat by density, so either one at zero means no risk at
 * all — the middle of a reserve scores zero however much habitat it has. Light
 * only scales what those two produce. This row used to read "40% weight",
 * which described a weighted sum the model has never used and invited people
 * to "fix" the model to match the label.
 */
function FactorBar({ name, factor, role }) {
  const band = valueToBand(factor.value)
  const pct = Math.round(factor.value * 100)
  return (
    <div className="factor-item">
      <div className="factor-header">
        <span className="factor-name">{name}</span>
        <span className="factor-weight">{role} · {pct}/100</span>
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
  const lightMultiplier =
    MODEL.lightFloor + (1 - MODEL.lightFloor) * risk.factors.light.value

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
          <FactorBar name="Habitat proximity" factor={risk.factors.habitat} role="Required" />
          <FactorBar name="Building density" factor={risk.factors.density} role="Required" />
          <FactorBar
            name="Light level"
            factor={risk.factors.light}
            role={`Multiplier ×${lightMultiplier.toFixed(2)}`}
          />
        </div>
        <p className="factor-model-note">
          Habitat and building density are multiplied, so either one at zero means
          no collision risk — there is nothing to hit in a forest, and nothing to
          hit it in a built-up area with no birds. Light scales that result
          between ×{MODEL.lightFloor.toFixed(2)} and ×1.00; it never brings the
          score to zero, because an unlit facade still kills by daylight
          reflection.
        </p>
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

