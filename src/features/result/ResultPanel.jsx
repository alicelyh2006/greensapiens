import { Panel, Card, RiskPill, EmptyState } from '../../components/index.jsx'
import { getRecommendations, isPeakSeason } from '../../lib/recommendations.js'

const LABELS = { habitat: 'Habitat', density: 'Building density', light: 'Blue-light exposure' }

function pct(value) { return `${Math.round(value * 100)}%` }

export default function ResultPanel({ risk, location }) {
  if (!risk) {
    return <Panel><EmptyState title="Pick a place on the map" body="Search for an address or tap a location on Singapore land to see its estimated collision risk." /></Panel>
  }

  if (risk.unavailable) {
    return <Panel title="No risk assessment"><RiskPill band="unknown" /><p className="result__notice">Nightjar does not calculate or display risk for this location because it is outside the Singapore land boundary or has no usable land-use data.</p></Panel>
  }

  const recommendations = getRecommendations(risk)
  const measuredLight = risk.factors.light.confidence === 'measured'

  return <Panel title="Collision risk">
    <div className="result-score">
      <strong className="result-score__value">{risk.total}</strong><span className="result-score__scale">/100</span>
      <RiskPill band={risk.band} />
    </div>

    <p className="result__notice">Estimated risk index, not a probability of collision. The model combines published Singapore collision drivers with the project's current static datasets.</p>

    <Card label="Why">
      <div className="factor-list">
        {Object.entries(risk.factors).map(([key, factor]) => <div className="factor" key={key}>
          <div className="factor__top"><span>{LABELS[key]}</span><strong>{pct(factor.value)}</strong></div>
          <div className="factor__bar"><span style={{ width: `${Math.round(factor.value * 100)}%` }} /></div>
          <div className="factor__meta">Weight {Math.round(factor.weight * 100)}% · {factor.note}</div>
        </div>)}
      </div>
    </Card>

    <Card label="Data quality">
      <p className="result__notice">Habitat: NParks green-space polygons. Building density: URA Master Plan land-use zoning used as a proxy for built density. Light: {measuredLight ? `${risk.factors.light.sampleCount} nearby surveyed lamps` : 'estimated because there are not enough surveyed lamps nearby'}.</p>
    </Card>

    {isPeakSeason() && <Card label="Season"><p className="result__notice">October–November is the project's peak migration window; collision risk can be more consequential during this period.</p></Card>}

    <Card label="What would help"><p className="result__notice">{recommendations[0].action}</p></Card>
    {location?.label && <p className="result__location">{location.label}</p>}
  </Panel>
}
