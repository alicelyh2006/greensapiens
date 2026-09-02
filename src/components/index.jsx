/**
 * Shared components — import everything from here:
 *   import { Panel, RiskPill } from '../../components'
 *
 * Rule: no component defines its own colour. Tokens only.
 * Need a new hue? Add a token in styles/tokens.css and tell the team.
 */
import './components.css'

export function Button({ variant = 'default', children, ...props }) {
  return (
    <button className={`btn ${variant === 'primary' ? 'btn--primary' : ''}`} {...props}>
      {children}
    </button>
  )
}

export function Panel({ title, children, ...props }) {
  return (
    <section className="panel" {...props}>
      {title && <h2 className="panel__title">{title}</h2>}
      {children}
    </section>
  )
}

export function Card({ label, children, ...props }) {
  return (
    <div className="card" {...props}>
      {label && <span className="card__label">{label}</span>}
      {children}
    </div>
  )
}

const BAND_LABELS = {
  low: 'Low risk',
  moderate: 'Moderate risk',
  high: 'High risk',
}

/**
 * N4 — risk is never conveyed by colour alone. The text label is mandatory.
 */
export function RiskPill({ band }) {
  const known = band in BAND_LABELS
  return (
    <span className={`pill pill--${known ? band : 'unknown'}`}>
      <span className="pill__dot" aria-hidden="true" />
      {known ? BAND_LABELS[band] : 'Not assessed'}
    </span>
  )
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {body && <p className="empty__body">{body}</p>}
      {action}
    </div>
  )
}
