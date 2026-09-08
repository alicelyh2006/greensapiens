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
          <p>The score combines three indicators that describe conditions around the selected location.</p>
          <table className="methodology-weight-table">
            <thead>
              <tr>
                <th>Factor</th>
                <th>Weight</th>
                <th>What it measures</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Habitat proximity</td>
                <td>40%</td>
                <td>Distance to the nearest nature reserve or park connector edge</td>
              </tr>
              <tr>
                <td>Light level</td>
                <td>35%</td>
                <td>Nocturnal light intensity from VIIRS satellite data, adjusted for blue-rich lamp presence</td>
              </tr>
              <tr>
                <td>Building density</td>
                <td>25%</td>
                <td>Number of buildings per unit area in the surrounding 250 m grid cell</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="methodology-section">
          <h3>Why risk peaks at the forest edge</h3>
          <p>
            Collision risk is highest at the boundary — not deep inside a reserve
            (there are no buildings to strike there) and not far away (migrating
            birds will not be flying there). Risk drops to near zero within 150 m
            inside a reserve and within 500 m outside it. Forest-edge buildings
            dominate local collision records.
          </p>
        </section>

        <section className="methodology-section">
          <h3>Why colour, not brightness</h3>
          <p>
            The published research identifies blue-rich nocturnal light — not
            overall brightness — as the strongest predictor of migratory bird
            collisions. This has two practical consequences:
          </p>
          <ul>
            <li>Colour temperature is visible in an ordinary photograph, so a phone camera is enough to classify a lamp — no photometer needed.</li>
            <li>The VIIRS Day/Night Band satellite sensor, the source behind essentially every light-pollution map, records roughly 500–900 nm. It is blind below 500 nm — precisely where white LEDs emit most strongly and precisely the band that predicts migrant collisions. VIIRS alone underestimates risk at locations lit by cool-white LEDs.</li>
          </ul>
        </section>

        <p className="methodology-disclaimer">
          This score is a weighted heuristic, not a validated predictive model.
          Weights reflect our judgement, informed by the study below but not
          statistically derived from it. We did not discover the collision
          drivers — the research did. This tool operationalises published
          findings to make them actionable. Treat the output as a guide for
          prioritising attention, not as a precise prediction.
        </p>

        <section className="methodology-section">
          <h3>Source</h3>
          <p className="methodology-citation">
            Disentangling the biotic and abiotic drivers of bird–building
            collisions in a tropical Asian city with ecological niche modeling.
            Conservation Biology 38, e14255 (2024).{' '}
            <a
              href="https://doi.org/10.1111/cobi.14255"
              target="_blank"
              rel="noopener noreferrer"
            >
              doi:10.1111/cobi.14255
            </a>
          </p>
        </section>
      </div>
    </details>
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

      <Methodology />
    </Panel>
  )
}
