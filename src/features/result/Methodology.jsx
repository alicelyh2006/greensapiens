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
    <Panel>
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
        {/* How we tested it */}
        <div className="methodology-section">
          <h3>How we tested this</h3>
          <p>
            Every number in this model was chosen by us. The obvious risk is
            that we tuned them until the map looked the way we expected, which
            would make the output a picture of our assumptions rather than a
            finding. So we tested for that in two ways, and both results are
            below whether or not they flatter us.
          </p>

          <h4>Do our arbitrary constants drive the answer?</h4>
          <p>
            We changed each hand-picked constant by a large amount — halved or
            doubled, in most cases — and measured how much of the ranking of
            the fifty riskiest locations survived.
          </p>
          <table className="methodology-weight-table">
            <thead>
              <tr><th>Constant</th><th>Change</th><th>Top 50 unchanged</th></tr>
            </thead>
            <tbody>
              <tr><td>Light floor</td><td>0.45 to 0.20 / 0.70</td><td>100%</td></tr>
              <tr><td>Habitat floor</td><td>0.08 to 0.00 / 0.20</td><td>92-94%</td></tr>
              <tr><td>Green-space size, lower bound</td><td>1 to 0.1 / 5 ha</td><td>88-90%</td></tr>
              <tr><td>Green-space size, upper bound</td><td>100 to 50 / 500 ha</td><td>80-86%</td></tr>
              <tr><td>Nature-reserve bonus</td><td>0.15 to 0</td><td>100%</td></tr>
              <tr><td>Assumed light where unsurveyed</td><td>0.50 to 0.30 / 0.80</td><td>98-100%</td></tr>
              <tr><td>Lamp search radius</td><td>250 to 500 m</td><td>98%</td></tr>
              <tr><td><strong>Habitat falloff distance</strong></td><td>500 to 250 / 1000 m</td><td><strong>70-76%</strong></td></tr>
            </tbody>
          </table>
          <p>
            Eleven of the twelve barely matter. The nature-reserve bonus — a
            number with no justification behind it at all — changes nothing.
            What produces the ranking is the <em>structure</em>, habitat
            multiplied by building density, not the tuning.
          </p>
          <p>
            One constant is load-bearing: the <strong>500 m falloff</strong>
            over which bird presence decays away from green space. Halve or
            double it and roughly 30% of the ranking changes. That is the single
            parameter this model rests on, and the one worth arguing about.
          </p>

          <h4>Does it agree with anyone who is not us?</h4>
          <p>
            NParks has fitted bird-safe glass at three sites, decided on their
            own evidence. We have never used that fact to build or tune
            anything, so it works as an out-of-sample check.
          </p>
          <table className="methodology-weight-table">
            <thead>
              <tr><th>Site</th><th>Where our model ranks it</th></tr>
            </thead>
            <tbody>
              <tr><td>Sungei Buloh Wetland Reserve</td><td>93rd percentile</td></tr>
              <tr><td>HortPark</td><td>97th percentile</td></tr>
              <tr><td>Singapore Botanic Gardens</td><td>91st percentile</td></tr>
              <tr><td>Marina Bay Sands (control)</td><td>0</td></tr>
              <tr><td>Changi Airport (control)</td><td>0</td></tr>
              <tr><td>Tuas industrial west (control)</td><td>0</td></tr>
            </tbody>
          </table>
          <p>
            Three for three in the top 10%. Two caveats we will not hide behind:
            three sites is not a validation set, and all three are large parks
            where our habitat term is trivially high, so the test partly
            measures whether somewhere is near a park, which is easy.
          </p>
          <p>
            The controls carry more weight. <strong>Marina Bay Sands scores
            zero</strong>, and it is one of the largest glass facades in
            Singapore. A model that simply counted glass would rank it first.
            This one ranks it last, because there is no habitat beside it — and
            nobody fits bird-safe glass at Marina Bay Sands.
          </p>
        </div>

        {/* What testing changed */}
        <div className="methodology-section">
          <h3>What testing changed</h3>
          <p>
            Three things were wrong, and all three were found by checking rather
            than by preference. We list them because a model nobody has broken
            is a model nobody has tested.
          </p>
          <ul>
            <li>
              <strong>Height was weighted backwards.</strong> Hazard rose
              linearly with storeys, so a 40-storey tower counted as forty
              shophouses. The study this project is built on says the opposite:
              prioritise <em>short</em> buildings, under 20 m, at forest edges,
              because that is the altitude birds fly at. Height is now capped at
              six storeys, and out-of-sample agreement went up rather than down.
            </li>
            <li>
              <strong>Building size was missing entirely.</strong> A five-storey
              shophouse and a five-storey shopping mall scored identically, even
              though glass area is the strongest predictor in the literature. We
              re-fetched 183,616 building footprints and now model perimeter
              times facade height times glazing — about 96 million square metres
              of glass across Singapore.
            </li>
            <li>
              <strong>Small parks were masking large ones.</strong> Habitat read
              the <em>nearest</em> green space rather than the strongest. At our
              own survey site the nearest polygon is a 0.3 ha playground, which
              scores zero on the size curve, so the location read low — while
              Central Catchment Nature Reserve sat 152 m away and was never
              considered. 323 of the 461 NParks polygons are under a hectare, so
              this was suppressing scores across every housing estate on a
              reserve edge.
            </li>
          </ul>
        </div>

        {/* The classifier */}
        <div className="methodology-section">
          <h3>What does not work yet</h3>
          <p>
            The lamp classifier — the part that reads a photograph and decides
            how blue a light is — <strong>does not reliably work</strong>, and
            we would rather say so than let the numbers imply otherwise.
          </p>
          <p>
            Run over the 29 photographs from our first field survey it put 21 of
            28 readable images in the neutral bucket and found no warm source at
            all, when several are plainly warm to the eye. The cause is phone
            auto-white-balance: the camera corrects each scene toward neutral
            grey, which is exactly the colour cast the method depends on
            measuring. Cropping tight to the lamp changed only 4 of 28, so it is
            not a framing problem.
          </p>
          <p>
            Its <em>ordering</em> was right — it ranked a gold restaurant sign
            warmest and the blue-white park lamps bluest — so the signal is
            there and it is the absolute thresholds that fail. Fixing it
            properly needs a camera with white balance locked, or a reference
            card in frame. Until then the lamp classifications on this map were
            made by eye, and every entry records which method produced it.
          </p>
        </div>

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
            <strong>We model one kind of bird, and the research describes
            two.</strong>{' '}
            The study we build on separates them: migratory species collide
            where building density and blue nocturnal light are high, resident
            species collide near forest cover. Those are different mechanisms
            with different fixes, and this map blends them into a single score.
            Modelling them apart is the right thing to do and we have not done
            it.
          </div>
          <div className="methodology-disclaimer">
            <strong>Our resolution is coarser than the effect.</strong>{' '}
            The literature finds vegetation matters most within about 50 m of
            the glass. Our cells are 333 m, so we cannot see that — habitat
            here is distance to green space at a much coarser scale, which is a
            proxy for the same thing and not a measurement of it.
          </div>
          <div className="methodology-disclaimer">
            <strong>Band thresholds are presentation, not science.</strong>{' '}
            The score distribution across Singapore is smooth with no natural
            break anywhere, so where "moderate" ends and "high" begins is a
            choice we made. We set them at percentiles of the locations we
            assessed rather than at round numbers, so that the label states
            something checkable.
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

