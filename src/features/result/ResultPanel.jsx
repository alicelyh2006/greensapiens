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

/**
 * A short "what does this mean?" disclosure under the result. Credit to L4 for
 * the idea — reading the full page should not be necessary to trust a number.
 *
 * Deliberately SHORT, and it reads its numbers from config rather than
 * hard-coding them. The version this replaced was a hardcoded copy of the whole
 * methodology page, and the two drifted: it still advertised a 40/35/25 weighted
 * sum, described light as coming from VIIRS satellite data, and quoted an
 * inward-falloff distance whose feature is switched off. Anything that needs
 * maintaining lives on the How It Works page, once.
 */
function Methodology() {
  return (
    <details className="methodology">
      <summary className="methodology-toggle">
        <span>What does this mean?</span>
        <span aria-hidden="true">▸</span>
      </summary>
      <div className="methodology-content">
        <section className="methodology-section">
          <h3>How this is calculated</h3>
          <table className="methodology-weight-table">
            <thead>
              <tr>
                <th>Factor</th>
                <th>Role</th>
                <th>What it measures</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Habitat proximity</td>
                <td>Required</td>
                <td>Distance to mapped green space, scaled by its size</td>
              </tr>
              <tr>
                <td>Building density</td>
                <td>Required</td>
                <td>OpenStreetMap footprints nearby, weighted by storeys and glazing</td>
              </tr>
              <tr>
                <td>Light level</td>
                <td>Multiplier</td>
                <td>Colour temperature of lamps we have photographed within 250 m</td>
              </tr>
            </tbody>
          </table>
          <p>
            The first two are <strong>multiplied</strong>, not added — either at zero
            means no collision risk, because a collision needs both a bird and a
            building. Light scales that result between ×{MODEL.lightFloor.toFixed(2)}{' '}
            and ×1.00 and never zeroes it.
          </p>
        </section>

        <p className="methodology-disclaimer">
          This score is a hand-tuned heuristic, not a validated predictive model.
          We did not discover the collision drivers — the research did. Treat the
          output as a guide for prioritising attention, not as a prediction.
        </p>

        <p className="methodology-citation">
          Full method, data sources and limitations are on the{' '}
          <strong>How It Works</strong> page.
        </p>
      </div>
    </details>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ResultPanel({ risk, baseRisk = risk, location, onClose, onSimulate }) {
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
  const locationName = location?.label || 'Selected location'
  const score = Math.round(risk.total)
  const isSimulated = risk !== baseRisk
  const scoreStyle = { '--risk-angle': `${Math.max(0, Math.min(100, score)) * 3.6}deg` }

  return (
    <Panel>
      <header className="result-panel__header">
        <div>
          <span className="result-panel__eyebrow">Location details</span>
          <h2>{locationName}</h2>
          {location && <p>{location.lat.toFixed(4)}, {location.lng.toFixed(4)} · Singapore</p>}
        </div>
        <button className="result-panel__close" type="button" onClick={onClose} aria-label="Clear selected location">×</button>
      </header>

      <section className={`result-hero result-hero--${risk.band}`}>
        <div className="result-hero__score">
          <span>Nightjar risk</span>
          <div className="result-hero__value"><strong>{score}</strong><small>/100</small></div>
          <div className="result-hero__band"><RiskPill band={risk.band} />{isSimulated && <em>Simulated lighting</em>}</div>
        </div>
        <div className={`risk-ring risk-ring--${risk.band}`} style={scoreStyle} aria-label={`Risk score ${score} out of 100`}>
          <div aria-hidden="true">⌁</div>
        </div>
      </section>

      {onSimulate && (
        <section className="lighting-test">
          <div className="lighting-test__head">
            <div><span>What if we dim the lights?</span><p>Preview the light factor for this location.</p></div>
            <output>{Math.round(risk.factors.light.value * 100)}<small>/100</small></output>
          </div>
          <input
            className="risk-slider"
            type="range"
            min="0"
            max="100"
            value={Math.round(risk.factors.light.value * 100)}
            onChange={(event) => onSimulate(Number(event.target.value))}
            aria-label="Simulate light exposure"
          />
          {isSimulated && <button type="button" className="lighting-test__reset" onClick={() => onSimulate(null)}>Reset to observed lighting</button>}
        </section>
      )}

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
      <div className="result-section">
        <p className="result-section__title" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-faint)', marginBottom: 'var(--space-2)' }}>
          Why this location?
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
      <div className="result-section result-section--recommendations">
        <p className="result-section__title" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-faint)', marginBottom: 'var(--space-2)' }}>
          Recommended action
        </p>
        <div className="rec-list">
          {recommendations.map((rec, i) => (
            <RecCard key={i} rec={rec} />
          ))}
        </div>
      </div>

      <Methodology />
    </Panel>
  )
}
