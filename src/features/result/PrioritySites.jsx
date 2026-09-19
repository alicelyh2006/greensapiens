/**
 * F13 — the priority list.  OWNER: L3 (Result & Guidance)
 *
 * The map answers "how risky is this spot". It does not answer the question
 * anyone with a budget actually asks, which is "which places should I look at
 * first" — you cannot get that by clicking a surface one point at a time.
 *
 * Reads public/data/hotspots.json, built offline by scripts/build-hotspots.mjs
 * from the same risk grid the map draws. No new modelling happens here, and
 * nothing is scored in the browser; picking a row hands the coordinates to the
 * map, which scores it exactly as a click would.
 */
import { useEffect, useState } from 'react'
import { Panel, RiskPill, EmptyState } from '../../components/index.jsx'
import { DATA } from '../../lib/config.js'
import './priority.css'

function SiteRow({ site, onOpen }) {
  const where = site.inside
    ? `Inside ${site.place}`
    : `${site.metres} m from ${site.place}`

  return (
    <li className="priority-row">
      <span className="priority-row__rank" aria-hidden="true">{site.rank}</span>

      <div className="priority-row__body">
        <div className="priority-row__head">
          <h3 className="priority-row__where">{where}</h3>
          <RiskPill band={site.band} />
        </div>

        <dl className="priority-row__factors">
          <div><dt>Habitat</dt><dd>{site.habitat}</dd></div>
          <div><dt>Buildings</dt><dd>{site.density}</dd></div>
          <div>
            <dt>Light</dt>
            <dd>
              {site.light}
              <span className={`priority-row__conf priority-row__conf--${site.lightConfidence}`}>
                {site.lightConfidence === 'measured' ? 'surveyed' : 'estimated'}
              </span>
            </dd>
          </div>
          <div><dt>Score</dt><dd className="priority-row__score">{site.score}</dd></div>
        </dl>
      </div>

      <button
        type="button"
        className="priority-row__open"
        onClick={() => onOpen(site)}
      >
        Open on map
      </button>
    </li>
  )
}

export default function PrioritySites({ onOpen }) {
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(DATA.hotspots)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) d ? setData(d) : setFailed(true) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])

  if (failed) {
    return (
      <Panel>
        <EmptyState
          title="Priority list unavailable"
          body="The site list could not be loaded. The Risk Map still works — you can click any location directly."
        />
      </Panel>
    )
  }
  if (!data) {
    return <Panel><EmptyState title="Loading priority sites" body="Reading the risk grid." /></Panel>
  }

  const surveyed = data.sites.filter((s) => s.lightConfidence === 'measured').length

  return (
    <Panel>
      <div className="priority-intro">
        <p>
          The {data.sites.length} highest-scoring places in Singapore, ranked.
          Every one scores {data.threshold} or above — the worst 5% of everywhere
          we assessed — and each is at least {data.spacingKm} km from the others,
          so the list is {data.sites.length} distinct places rather than one
          hotspot and its neighbours.
        </p>
        <p className="priority-intro__caveat">
          This is where to <em>look</em>, not a finding. {surveyed === 0
            ? 'None of these has been surveyed yet, so every light value below is an assumption.'
            : `${surveyed} of ${data.sites.length} have been surveyed; the rest carry an assumed light value.`}{' '}
          Scores will move as that changes.
        </p>
      </div>

      <ol className="priority-list">
        {data.sites.map((site) => (
          <SiteRow key={site.rank} site={site} onOpen={onOpen} />
        ))}
      </ol>

      <p className="priority-foot">
        Derived from the same risk grid the map draws. Rebuild with{' '}
        <code>npm run data:hotspots</code> after any model change.
      </p>
    </Panel>
  )
}
