/**
 * F11 — citizen collision reporting.  OWNER: L4 (Capture & Contribution)
 *
 * N5: everything stays in the browser and the UI says so.
 *
 *   1. Citizens upload a photo of the bird collision (JPEG, HEIC, PNG).
 *   2. Extracts EXIF GPS from photo automatically.
 *   3. If GPS is missing, allows entering location or using device geolocation.
 *   4. Persists reports locally to localStorage ("nightjar.reports.v1") for testing.
 *   5. Connects to database later on.
 */
import { useState, useRef, useEffect } from 'react'
import { readExifGps } from './exifGps.js'
import { extractHeicThumbnail } from './extractHeicThumbnail.js'
import { heicToJpeg } from './heicConvert.js'
import './ReportForm.css'

const STORAGE_KEY = 'nightjar.reports.v1'

function getStoredReports() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

function saveReports(reports) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports))
  } catch (e) {
    console.warn('Could not save to localStorage:', e)
  }
}

function toDMS(decimal, posLabel, negLabel) {
  if (decimal == null) return ''
  const abs = Math.abs(decimal)
  const deg = Math.floor(abs)
  const minFull = (abs - deg) * 60
  const min = Math.floor(minFull)
  const sec = ((minFull - min) * 60).toFixed(1)
  const dir = decimal >= 0 ? posLabel : negLabel
  return `${deg}°${min}′${sec}″ ${dir}`
}

export default function ReportForm({ onSubmit }) {
  const [photo, setPhoto] = useState(null)
  const [previewSrc, setPreviewSrc] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [gpsData, setGpsData] = useState(null)
  const [gpsStatus, setGpsStatus] = useState('idle') // 'idle' | 'found' | 'miss'

  // Form fields
  const [condition, setCondition] = useState('dead')
  const [birdSpecies, setBirdSpecies] = useState('')
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().slice(0, 16))
  const [locationDesc, setLocationDesc] = useState('')
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')
  const [notes, setNotes] = useState('')

  const [savedReports, setSavedReports] = useState(getStoredReports)
  const [statusMessage, setStatusMessage] = useState(null)

  const fileInputRef = useRef(null)

  // Handle Photo Upload & EXIF GPS
  async function handleFileSelected(file) {
    if (!file) return
    setIsProcessing(true)
    setPhoto(file)
    setGpsStatus('idle')
    setGpsData(null)

    const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
                   file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')

    // 1. Generate preview
    if (isHeic) {
      const fastThumb = await extractHeicThumbnail(file).catch(() => null)
      if (fastThumb) {
        setPreviewSrc(URL.createObjectURL(fastThumb))
      } else {
        try {
          const converted = await heicToJpeg(file, 0.6)
          const blob = Array.isArray(converted) ? converted[0] : converted
          setPreviewSrc(URL.createObjectURL(blob))
        } catch (e) {
          setPreviewSrc(null)
        }
      }
    } else {
      setPreviewSrc(URL.createObjectURL(file))
    }

    // 2. Extract EXIF GPS
    try {
      const gps = await readExifGps(file)
      if (gps && gps.lat && gps.lng) {
        setGpsData(gps)
        setGpsStatus('found')
        setManualLat(gps.lat.toFixed(6))
        setManualLng(gps.lng.toFixed(6))
      } else {
        setGpsStatus('miss')
      }
    } catch (err) {
      setGpsStatus('miss')
    }

    setIsProcessing(false)
  }

  // Use browser geolocation as fallback
  function handleUseDeviceLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        setManualLat(lat.toFixed(6))
        setManualLng(lng.toFixed(6))
        setGpsData({ lat, lng, source: 'device' })
        setGpsStatus('found')
      },
      (err) => {
        alert('Could not retrieve device location: ' + err.message)
      },
      { timeout: 10000 }
    )
  }

  // Submit report to local collection
  function handleSubmitReport(e) {
    e.preventDefault()
    if (!photo) {
      alert('Please upload a photo of the incident')
      return
    }

    const latNum = parseFloat(manualLat)
    const lngNum = parseFloat(manualLng)

    const newReport = {
      id: 'rpt-' + Date.now(),
      createdAt: new Date().toISOString(),
      fileName: photo.name,
      incidentDate,
      condition,
      birdSpecies: birdSpecies.trim() || 'Unidentified bird',
      locationDesc: locationDesc.trim() || 'Not specified',
      notes: notes.trim(),
      coords: !isNaN(latNum) && !isNaN(lngNum) ? { lat: latNum, lng: lngNum } : null,
      gpsSource: gpsData?.source || (gpsStatus === 'found' ? 'EXIF' : 'manual'),
      previewUrl: previewSrc,
    }

    const updated = [newReport, ...savedReports]
    setSavedReports(updated)
    saveReports(updated)

    // Reset current form
    setPhoto(null)
    setPreviewSrc(null)
    setGpsData(null)
    setGpsStatus('idle')
    setBirdSpecies('')
    setLocationDesc('')
    setManualLat('')
    setManualLng('')
    setNotes('')

    setStatusMessage('Collision report logged locally! (Database sync ready)')
    setTimeout(() => setStatusMessage(null), 4000)
  }

  function handleDeleteReport(id) {
    const filtered = savedReports.filter(r => r.id !== id)
    setSavedReports(filtered)
    saveReports(filtered)
  }

  return (
    <div className="collision-page">
      {/* Header */}
      <header className="collision-header">
        <div className="collision-header__inner">
          <h1 className="collision-title">Report a Bird Collision</h1>
          <p className="collision-sub">
            Found a dead or stunned bird near a building? Logging it builds the
            evidence base Singapore does not currently have.
            <br />
            <strong>Privacy:</strong> reports stay on this device and are never uploaded.
          </p>
        </div>
      </header>

      <main className="collision-main">
        {statusMessage && (
          <div className="loc-banner loc-banner--found">
            <strong>&#10003; {statusMessage}</strong>
          </div>
        )}

        {/* Report Submission Form */}
        <section className="form-card">
          <h2 className="form-card__title">New Incident Submission</h2>
          <p className="form-card__desc">
            Upload a clear photo of the stunned or deceased bird. If location services were enabled on your camera, the coordinates will be automatically recorded.
          </p>

          <form onSubmit={handleSubmitReport}>
            {/* Photo dropzone */}
            <div
              className="collision-dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.dataset.over = 'true' }}
              onDragLeave={(e) => { delete e.currentTarget.dataset.over }}
              onDrop={(e) => {
                e.preventDefault()
                delete e.currentTarget.dataset.over
                if (e.dataTransfer.files?.[0]) handleFileSelected(e.dataTransfer.files[0])
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif,image/heic,image/heif"
                className="collision-dropzone__input"
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />
              <div className="collision-dropzone__icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              {isProcessing ? (
                <p className="collision-dropzone__label">Inspecting photo &amp; EXIF GPS&#8230;</p>
              ) : photo ? (
                <p className="collision-dropzone__label">Photo attached: {photo.name} (<span className="collision-dropzone__link">Change</span>)</p>
              ) : (
                <>
                  <p className="collision-dropzone__label">Drop collision photo here or <span className="collision-dropzone__link">browse</span></p>
                  <p className="collision-dropzone__hint">JPEG, HEIC, PNG accepted</p>
                </>
              )}
            </div>

            {/* Photo Preview & EXIF Status */}
            {photo && (
              <div className="preview-container">
                <div className="preview-media">
                  {previewSrc ? (
                    <img src={previewSrc} alt="Collision upload preview" />
                  ) : (
                    <span>Photo</span>
                  )}
                </div>
                <div className="preview-meta">
                  <p className="preview-filename">{photo.name}</p>

                  {gpsStatus === 'found' && (
                    <div className="loc-banner loc-banner--found">
                      <div className="loc-banner__title">
                        <span>&#9679; GPS Location Extracted from Photo</span>
                      </div>
                      <p className="loc-banner__details">
                        {toDMS(gpsData.lat, 'N', 'S')}, {toDMS(gpsData.lng, 'E', 'W')}
                      </p>
                      <div className="loc-banner__coords">
                        {gpsData.lat.toFixed(6)}°, {gpsData.lng.toFixed(6)}°
                      </div>
                    </div>
                  )}

                  {gpsStatus === 'miss' && (
                    <div className="loc-banner loc-banner--miss">
                      <div className="loc-banner__title">
                        <span>&#9888; Cannot get GPS of this photo</span>
                      </div>
                      <p className="loc-banner__details">
                        No location data was embedded in the photo's EXIF. Please enter the coordinates or building address below.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Detailed Form Fields */}
            <div className="form-grid">
              <div className="form-field">
                <label className="form-label" htmlFor="field-condition">Bird Condition</label>
                <select
                  id="field-condition"
                  className="form-select"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                >
                  <option value="dead">Dead / Fatal Collision</option>
                  <option value="stunned">Stunned / Unable to fly</option>
                  <option value="injured">Visibly Injured</option>
                  <option value="unknown">Unknown / Not Sure</option>
                </select>
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="field-date">Date &amp; Time Observed</label>
                <input
                  id="field-date"
                  type="datetime-local"
                  className="form-input"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="field-species">
                  Species / Description <span>(optional)</span>
                </label>
                <input
                  id="field-species"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Pitta, Kingfisher, small green bird"
                  value={birdSpecies}
                  onChange={(e) => setBirdSpecies(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="field-location-desc">
                  Building / Location Landmark <span>(optional)</span>
                </label>
                <input
                  id="field-location-desc"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Near glass atrium at Biopolis Matrix"
                  value={locationDesc}
                  onChange={(e) => setLocationDesc(e.target.value)}
                />
              </div>

              {/* Coordinates Section */}
              <div className="form-field">
                <label className="form-label" htmlFor="field-lat">
                  Latitude <span>(auto from photo or manual)</span>
                </label>
                <input
                  id="field-lat"
                  type="text"
                  className="form-input font-mono"
                  placeholder="e.g. 1.298541"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label className="form-label" htmlFor="field-lng">
                  Longitude <span>(auto from photo or manual)</span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    id="field-lng"
                    type="text"
                    className="form-input font-mono"
                    placeholder="e.g. 103.788421"
                    style={{ flex: 1 }}
                    value={manualLng}
                    onChange={(e) => setManualLng(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={handleUseDeviceLocation}
                    title="Get current GPS coordinates from your device"
                  >
                    Use GPS
                  </button>
                </div>
              </div>

              <div className="form-field form-field--full">
                <label className="form-label" htmlFor="field-notes">
                  Additional Notes <span>(optional)</span>
                </label>
                <textarea
                  id="field-notes"
                  className="form-textarea"
                  placeholder="Details on surrounding lighting, facade glass reflection, or nearby trees..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn-primary"
                disabled={!photo || isProcessing}
              >
                Log Collision Incident
              </button>
            </div>
          </form>
        </section>

        {/* Saved Collision Reports List */}
        {savedReports.length > 0 && (
          <section className="saved-section">
            <div className="saved-header">
              <h2 className="saved-title">
                Logged Incidents <span className="results__count">{savedReports.length}</span>
              </h2>
              <button
                className="btn-ghost"
                onClick={() => {
                  if (confirm('Clear all logged collision reports on this device?')) {
                    setSavedReports([])
                    saveReports([])
                  }
                }}
              >
                Clear all records
              </button>
            </div>

            <div className="saved-grid">
              {savedReports.map((rpt) => (
                <article key={rpt.id} className="report-card">
                  {rpt.previewUrl && (
                    <div className="report-card__thumb">
                      <img src={rpt.previewUrl} alt={rpt.birdSpecies} />
                    </div>
                  )}

                  <div className="report-card__body">
                    <div className="report-card__header">
                      <div>
                        <h3 style={{ margin: '0 0 2px', fontSize: '1rem', fontWeight: 700 }}>
                          {rpt.birdSpecies}
                        </h3>
                        <p className="report-card__time">
                          {new Date(rpt.incidentDate).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      </div>
                      <span className={`report-card__condition cond--${rpt.condition}`}>
                        {rpt.condition}
                      </span>
                    </div>

                    <p className="report-card__desc">
                      <strong>Location Landmark:</strong> {rpt.locationDesc}
                    </p>

                    {rpt.coords ? (
                      <div className="loc-banner loc-banner--found" style={{ padding: '6px 10px' }}>
                        <div style={{ fontSize: '0.75rem' }}>
                          <strong>{rpt.coords.lat.toFixed(5)}°, {rpt.coords.lng.toFixed(5)}°</strong>
                          {' '}({rpt.gpsSource})
                        </div>
                        <a
                          href={`https://www.google.com/maps?q=${rpt.coords.lat},${rpt.coords.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="collision-header__link"
                          style={{ fontSize: '0.75rem', marginTop: '2px', display: 'inline-block' }}
                        >
                          View on map &rarr;
                        </a>
                      </div>
                    ) : (
                      <div className="loc-banner loc-banner--miss" style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
                        No GPS coordinates available
                      </div>
                    )}

                    {rpt.notes && (
                      <p className="report-card__desc" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                        <em>"{rpt.notes}"</em>
                      </p>
                    )}

                    <div className="report-card__footer">
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                        Report ID: #{rpt.id.replace('rpt-', '')}
                      </span>
                      <button
                        className="btn-delete"
                        onClick={() => handleDeleteReport(rpt.id)}
                        title="Delete this report"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
