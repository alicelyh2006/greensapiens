/**
 * F8 — visible methodology and sources.  OWNER: L3
 *
 * N8/honesty: this page must state plainly that the score is a weighted
 * heuristic built from published findings, not a validated model, and that we
 * did not discover the collision drivers ourselves.
 */
import { Panel } from '../../components/index.jsx'
import { WEIGHTS, HABITAT, BANDS } from '../../lib/config.js'
import './result.css'

export default function Methodology() {
  return (
    <Panel title="How this is calculated">
      <div className="methodology-content">

        {/* The three factors */}
        <div className="methodology-section">
          <h3>The three risk factors</h3>
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
                <td>{Math.round(WEIGHTS.habitat * 100)}%</td>
                <td>Distance to the nearest nature reserve or park connector edge</td>
              </tr>
              <tr>
                <td>Light level</td>
                <td>{Math.round(WEIGHTS.light * 100)}%</td>
                <td>Nocturnal light intensity from VIIRS satellite data, adjusted for blue-rich lamp presence</td>
              </tr>
              <tr>
                <td>Building density</td>
                <td>{Math.round(WEIGHTS.density * 100)}%</td>
                <td>Number of buildings per unit area in the surrounding 250 m grid cell</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Boundary effect */}
        <div className="methodology-section">
          <h3>Why risk peaks at the forest edge</h3>
          <p>
            Collision risk is highest <em>at the boundary</em> — not deep inside a reserve
            (there are no buildings to strike there) and not far away (migrating birds
            won't be flying there). Risk drops to near zero within{' '}
            {HABITAT.falloffInward} m inside a reserve and within {HABITAT.falloffOutward} m
            outside it. Forest-edge buildings dominate local collision records.
          </p>
        </div>

        {/* Blue light */}
        <div className="methodology-section">
          <h3>Why colour, not brightness</h3>
          <p>
            The published research identifies <strong>blue-rich nocturnal light</strong> — not
            overall brightness — as the strongest predictor of migratory bird collisions.
            This has two practical consequences:
          </p>
          <ul>
            <li>
              Colour temperature is visible in an ordinary photograph, so a phone camera
              is enough to classify a lamp — no photometer needed.
            </li>
            <li>
              The VIIRS Day/Night Band satellite sensor, the source behind essentially
              every light-pollution map, records roughly 500–900 nm. It is <strong>blind
              below 500 nm</strong> — precisely where white LEDs emit most strongly and
              precisely the band that predicts migrant collisions. VIIRS alone
              underestimates risk at locations lit by cool-white LEDs.
            </li>
          </ul>
        </div>

        {/* Disclaimer */}
        <div className="methodology-section">
          <div className="methodology-disclaimer">
            <strong>This score is a weighted heuristic, not a validated predictive model.</strong>{' '}
            Weights reflect our judgement, informed by the study below but not statistically
            derived from it. We did not discover the collision drivers — the research did.
            This tool operationalises published findings to make them actionable. Treat
            the output as a guide for prioritising attention, not as a precise prediction.
          </div>
        </div>

        {/* Citation */}
        <div className="methodology-section">
          <h3>Source</h3>
          <p className="methodology-citation">
            Disentangling the biotic and abiotic drivers of bird–building collisions in a
            tropical Asian city with ecological niche modeling.{' '}
            <em>Conservation Biology</em> 38, e14255 (2024).{' '}
            <a
              href="https://doi.org/10.1111/cobi.14255"
              target="_blank"
              rel="noopener noreferrer"
            >
              doi:10.1111/cobi.14255
            </a>
          </p>
        </div>

      </div>
    </Panel>
  )
}

