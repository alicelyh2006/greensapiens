/**
 * F8 — visible methodology and sources.  OWNER: L3
 *
 * N8/honesty: this page must state plainly that the score is a weighted
 * heuristic built from published findings, not a validated model, and that we
 * did not discover the collision drivers ourselves.
 */
import { Panel } from '../../components/index.jsx'
import { MODEL, HABITAT, BANDS, DENSITY_RADIUS_M } from '../../lib/config.js'
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
                <th>Role</th>
                <th>What it measures</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Habitat proximity</td>
                <td>Required</td>
                <td>
                  Distance to the nearest mapped green space, scaled by how large
                  that green space is and decaying with distance from its edge
                </td>
              </tr>
              <tr>
                <td>Building density</td>
                <td>Required</td>
                <td>
                  OpenStreetMap building footprints within {DENSITY_RADIUS_M} m,
                  each weighted by storeys and how glazed its facade typically is,
                  rather than counted — a glass tower and a shophouse are not the
                  same hazard
                </td>
              </tr>
              <tr>
                <td>Light level</td>
                <td>Multiplier</td>
                <td>
                  Colour temperature of lamps we have photographed and classified
                  within 250 m. Where we have not surveyed, this is an estimate and
                  the result says so
                </td>
              </tr>
            </tbody>
          </table>
          <p>
            The first two are <strong>multiplied</strong>, not added: either at zero
            means no collision risk, because a collision needs both a bird and a
            building. The forest-edge peak that the research describes is therefore
            something this model <em>produces</em> rather than something we told it.
            Light scales that result between ×{MODEL.lightFloor.toFixed(2)} and ×1.00
            and never zeroes it, since an unlit facade still kills by daylight
            reflection.
          </p>
          <p>
            We do <strong>not</strong> use VIIRS satellite imagery to measure light,
            despite it being the source behind most light-pollution maps. The reason
            is below.
          </p>
        </div>

        {/* Boundary effect */}
        <div className="methodology-section">
          <h3>Why risk peaks at the forest edge</h3>
          <p>
            Collision risk is highest <em>at the boundary</em> — not deep inside a
            reserve, where there is nothing built to strike, and not far outside it,
            where migrating birds are not concentrated. Bird presence fades to zero
            about {HABITAT.falloffOutward} m beyond a green-space edge.
          </p>
          <p>
            Nothing in the model says "risk peaks at the edge". We never encoded
            that. Inside a reserve the score falls to zero because building density
            there is zero, and the two factors are multiplied; far outside one it
            falls because bird presence is. The edge is simply the only place both
            are non-zero at once, so the peak lands there on its own. Forest-edge
            buildings dominate local collision records, and the model reproducing
            that without being told is the closest thing we have to a check on it.
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
            <strong>This score is a hand-tuned heuristic, not a validated predictive
            model.</strong>{' '}
            The thresholds, falloff distances and the light floor reflect our judgement,
            informed by the study below but not statistically derived from it. We did not
            discover the collision drivers — the research did. This tool operationalises
            published findings to make them actionable. Treat the output as a guide for
            prioritising attention, not as a precise prediction.
          </div>
          <div className="methodology-disclaimer">
            <strong>Lamp coverage is sparse.</strong>{' '}
            Light is the one factor we measure ourselves, and we have classified only the
            lamps our own field survey has reached. Everywhere else the light factor is an
            estimate, and the result panel says so on each affected location. More survey
            coverage will move these scores.
          </div>
        </div>

        {/* Data sources */}
        <div className="methodology-section">
          <h3>Data sources</h3>
          <table className="methodology-weight-table">
            <thead>
              <tr>
                <th>Dataset</th>
                <th>Source</th>
                <th>Licence</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Parks, reserves, park connectors</td>
                <td>NParks via data.gov.sg</td>
                <td>Singapore Open Data Licence</td>
              </tr>
              <tr>
                <td>Building footprints</td>
                <td>OpenStreetMap via Overpass</td>
                <td>ODbL</td>
              </tr>
              <tr>
                <td>Land and waterbody masks</td>
                <td>URA planning areas via data.gov.sg</td>
                <td>Singapore Open Data Licence</td>
              </tr>
              <tr>
                <td>Base map tiles</td>
                <td>OneMap, Singapore Land Authority</td>
                <td>SLA terms</td>
              </tr>
              <tr>
                <td>Lamp classifications</td>
                <td>Our own field survey</td>
                <td>In this repository</td>
              </tr>
            </tbody>
          </table>
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

