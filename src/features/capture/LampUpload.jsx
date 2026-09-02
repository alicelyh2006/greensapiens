/**
 * F9 EXIF location · F10 lamp colour classification
 * OWNER: L4 (Capture & Contribution)
 *
 * ⚠️ SPIKE THIS FIRST (days 2–3), in a throwaway page, before wiring anything.
 * It is the only requirement with real technical uncertainty:
 *   1. does a phone photo carry GPS in EXIF after upload?
 *   2. can we read average colour of the bright region reliably?
 * If either fails, we drop F10 early and cheaply.
 *
 * Note: no photometry, no exposure calibration. We only need to bucket a lamp
 * into one of four types by colour — blue content, not brightness, is what
 * predicts migrant collisions.
 */
import { Panel, EmptyState } from '../../components/index.jsx'

export default function LampUpload({ onAdd }) {
  // TODO(L4 · F9): read EXIF GPS + timestamp from each uploaded file.
  //   Candidate library: exifr (small, works in browser).
  //   Fall back to map-click placement when a photo has no GPS.

  // TODO(L4 · F10): draw the image to a <canvas>, sample the brightest region,
  //   compute average RGB, bucket into LAMP_TYPES from config.js.

  return (
    <Panel title="Add a light">
      <EmptyState
        title="Photo upload not built yet"
        body="Will read location from the photo's EXIF data and classify the lamp by colour."
      />
    </Panel>
  )
}
