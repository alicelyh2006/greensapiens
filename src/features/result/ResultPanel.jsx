/**
 * F5 score display · F6 recommendations · F7 seasonal context
 * OWNER: L3 (Result & Guidance)
 *
 * Turns a RiskResult into something a person can act on. Builds against the
 * mock scoreLocation — needs nothing from any other lane.
 */
import { Panel, Card, RiskPill, EmptyState } from '../../components/index.jsx'
import { getRecommendations, isPeakSeason } from '../../lib/recommendations.js'

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

  return (
    <Panel title="Collision risk">
      <RiskPill band={risk.band} />

      {risk.isMock && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-faint)' }}>
          Placeholder data — the scoring model is not implemented yet.
        </p>
      )}

      {/* TODO(L3 · F5): show each factor with its value, weight and note */}
      <Card label="Why">
        <p style={{ fontSize: 'var(--text-sm)' }}>Factor breakdown not built yet.</p>
      </Card>

      {/* TODO(L3 · F7): make Oct–Nov salient rather than showing risk as constant */}
      {isPeakSeason() && (
        <Card label="Season">
          <p style={{ fontSize: 'var(--text-sm)' }}>
            Peak migration period — collisions are most frequent in October and November.
          </p>
        </Card>
      )}

      {/* TODO(L3 · F6): render real recommendations with action, why and owner */}
      <Card label="What would help">
        <p style={{ fontSize: 'var(--text-sm)' }}>{recommendations[0].action}</p>
      </Card>
    </Panel>
  )
}
