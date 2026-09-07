/**
 * F8 — visible methodology and sources.  OWNER: L3
 *
 * N8/honesty: this page must state plainly that the score is a weighted
 * heuristic built from published findings, not a validated model, and that we
 * did not discover the collision drivers ourselves.
 */
import { Panel } from '../../components/index.jsx'

export default function Methodology() {
  return (
    <Panel title="How this is calculated">
      {/* TODO(L3 · F8): write this out properly —
          - the three factors and their weights (import from config.js)
          - why habitat risk peaks AT the boundary
          - blue light vs brightness, and the VIIRS blind spot below 500nm
          - full citation: Conservation Biology 38, e14255 (2024)
          - explicit statement: heuristic, not a validated prediction */}
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-dim)' }}>
        Not written yet.
      </p>
    </Panel>
  )
}
