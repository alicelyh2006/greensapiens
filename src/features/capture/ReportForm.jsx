/**
 * F11 — collision incident reporting.  OWNER: L4
 *
 * N5: everything stays in the browser. Nothing leaves the device, and the UI
 * must say so — it removes every privacy question before it is asked.
 */
import { Panel, EmptyState } from '../../components/index.jsx'

export default function ReportForm({ onSubmit }) {
  // TODO(L4 · F11): location (map pin or device GPS), date, optional notes.
  //   Persist to localStorage under a versioned key, e.g. 'nightjar.reports.v1'.
  //   Wrap every read and write in try/catch — private windows throw.

  return (
    <Panel title="Report a collision">
      <EmptyState
        title="Reporting not built yet"
        body="Found a dead or stunned bird near a building? This will let you log it. Reports stay on your device."
      />
    </Panel>
  )
}
