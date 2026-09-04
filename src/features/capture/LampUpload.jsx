/**
 * F9 (EXIF GPS) + F10 (lamp colour classification).  OWNER: L4
 *
 * Reads a photo's embedded GPS, then classifies the lamp by colour. Blue
 * content, not brightness, is what predicts migrant collisions — so this needs
 * no photometry and no exposure calibration, only the colour a camera already
 * records.
 *
 * Mounted in the app from App.jsx. HEIC decoding is loaded on demand; see
 * heicConvert.js.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { heicToJpeg } from './heicConvert.js'
import { readExifGps } from './exifGps.js'
import { sampleLampColour } from './lampColour.js'
import { extractHeicThumbnail } from './extractHeicThumbnail.js'
import './LampUpload.css'

const LAMP_LABEL = {
  hps: {
    lamp: 'High-pressure sodium',
    appearance: 'Deep orange',
    cct: '~2000K',
    blueContent: 'Minimal',
    birdRisk: 'Low',
    riskBadgeClass: 'risk-badge--low',
    tagClass: 'lamp-type--hps',
  },
  warm_led: {
    lamp: 'Warm white LED',
    appearance: 'Yellowish',
    cct: '2700–3000K',
    blueContent: 'Low',
    birdRisk: 'Low',
    riskBadgeClass: 'risk-badge--low',
    tagClass: 'lamp-type--warm',
  },
  neutral_led: {
    lamp: 'Neutral LED',
    appearance: 'Plain white',
    cct: '~4000K',
    blueContent: 'Moderate',
    birdRisk: 'Medium',
    riskBadgeClass: 'risk-badge--medium',
    tagClass: 'lamp-type--neutral',
  },
  cool_led: {
    lamp: 'Cool white LED',
    appearance: 'Blue-white glare',
    cct: '5000–6500K',
    blueContent: 'High',
    birdRisk: 'High',
    riskBadgeClass: 'risk-badge--high',
    tagClass: 'lamp-type--cool',
  },
  unknown: {
    lamp: 'Unknown',
    appearance: 'Uncertain',
    cct: '—',
    blueContent: '—',
    birdRisk: 'Unknown',
    riskBadgeClass: 'risk-badge--unknown',
    tagClass: 'lamp-type--unknown',
  },
}

/** Format decimal degrees to a readable DMS string e.g. 1°21′30.5″ N */
function toDMS(decimal, posLabel, negLabel) {
  const abs = Math.abs(decimal)
  const deg = Math.floor(abs)
  const minFull = (abs - deg) * 60
  const min = Math.floor(minFull)
  const sec = ((minFull - min) * 60).toFixed(1)
  const dir = decimal >= 0 ? posLabel : negLabel
  return `${deg}°${min}′${sec}″ ${dir}`
}

function GpsSection({ gps }) {
  if (!gps) {
    return (
      <div className="gps-block gps-block--miss">
        <span className="gps-block__icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="2" y1="2" x2="22" y2="22"/>
            <path d="M10.584 10.587a2 2 0 0 0 2.828 2.83"/>
            <path d="M9.363 5.365A9.466 9.466 0 0 1 12 5c4.418 0 8 3.582 8 8a9.466 9.466 0 0 1-.365 2.637"/>
            <path d="M20.49 17.49A9.953 9.953 0 0 1 12 21c-4.418 0-8-3.582-8-8 0-3.216 1.52-6.07 3.874-7.874"/>
          </svg>
        </span>
        <div>
          <p className="gps-block__miss-title">Cannot get GPS of this photo</p>
          <p className="gps-block__miss-body">No location data found in EXIF — photo may have been taken with location off, or converted/stripped on upload.</p>
        </div>
      </div>
    )
  }

  const mapsUrl = `https://www.google.com/maps?q=${gps.lat},${gps.lng}`
  const latDMS = toDMS(gps.lat, 'N', 'S')
  const lngDMS = toDMS(gps.lng, 'E', 'W')

  return (
    <div className="gps-block gps-block--found">
      <div className="gps-block__coords">
        <span className="gps-block__icon gps-block__icon--found" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </span>
        <div className="gps-block__dms">
          <span>{latDMS}</span>
          <span>{lngDMS}</span>
          {gps.alt != null && (
            <span className="gps-block__alt">{gps.alt.toFixed(1)} m altitude</span>
          )}
        </div>
      </div>

      <div className="gps-block__decimal">
        {gps.lat.toFixed(6)}°, {gps.lng.toFixed(6)}°
      </div>

      <a
        className="gps-block__map-link"
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        View on Google Maps
      </a>
    </div>
  )
}

function FileCard({ file, result }) {
  const [previewSrc, setPreviewSrc] = useState(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const isHeic = file.type === 'image/heic' || file.type === 'image/heif' ||
                 file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')

  useEffect(() => {
    let cancelled = false
    let objectUrl = null

    if (isHeic) {
      setLoadingPreview(true)
      // 1. Try instant embedded preview extraction (~5-15ms)
      extractHeicThumbnail(file)
        .then(async (fastThumb) => {
          if (cancelled) return
          if (fastThumb) {
            objectUrl = URL.createObjectURL(fastThumb)
            setPreviewSrc(objectUrl)
            setLoadingPreview(false)
            return
          }
          // 2. Fallback: heic2any decoding with optimized preview quality (0.6)
          try {
            const converted = await heicToJpeg(file, 0.6)
            if (cancelled) return
            const blob = Array.isArray(converted) ? converted[0] : converted
            objectUrl = URL.createObjectURL(blob)
            setPreviewSrc(objectUrl)
          } catch (err) {
            console.warn('HEIC preview rendering failed:', err)
          } finally {
            if (!cancelled) setLoadingPreview(false)
          }
        })
        .catch((err) => {
          console.warn('Fast HEIC thumbnail extraction error:', err)
          if (!cancelled) setLoadingPreview(false)
        })
    } else {
      objectUrl = URL.createObjectURL(file)
      setPreviewSrc(objectUrl)
    }

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file, isHeic])

  return (
    <article className="card">
      <div className="card__thumb">
        {loadingPreview ? (
          <div className="card__thumb-placeholder">
            <span>Converting HEIC&#8230;</span>
            <small>Generating browser preview</small>
          </div>
        ) : previewSrc ? (
          <img src={previewSrc} alt={file.name} />
        ) : (
          <div className="card__thumb-placeholder">
            <span>{isHeic ? 'HEIC / HEIF' : 'Image'}</span>
            <small>Could not render preview</small>
          </div>
        )}
      </div>

      <div className="card__body">
        <p className="card__filename">{file.name}</p>

        <section className="card__section">
          <h3 className="card__section-title">
            <span className="badge badge--gps">F9 · GPS</span>
          </h3>
          <GpsSection gps={result.gps} />
        </section>

        <section className="card__section">
          <h3 className="card__section-title">
            <span className="badge badge--colour">F10 · Light Classification</span>
          </h3>
          {result.colour ? (
            (() => {
              const info = LAMP_LABEL[result.colour.type] || LAMP_LABEL.unknown
              return (
                <div className="lamp-report">
                  <div className="swatch-row">
                    <span
                      className="swatch"
                      style={{ background: `rgb(${result.colour.avgR},${result.colour.avgG},${result.colour.avgB})` }}
                      title="Sampled average pixel colour"
                    />
                    <div className="lamp-header-info">
                      <span className={`lamp-type ${info.tagClass}`}>
                        {info.lamp}
                      </span>
                      <span className={`risk-pill ${info.riskBadgeClass}`}>
                        {info.birdRisk} Bird Risk
                      </span>
                    </div>
                  </div>

                  <dl className="card__dl card__dl--metrics">
                    <dt>Appearance</dt>
                    <dd>{info.appearance}</dd>
                    <dt>Approx. CCT</dt>
                    <dd>{info.cct}</dd>
                    <dt>Blue Content</dt>
                    <dd>
                      <strong>{info.blueContent}</strong> ({((result.colour.blueRatio || 0) * 100).toFixed(1)}%)
                    </dd>
                    <dt>Sampled RGB</dt>
                    <dd className="font-mono">
                      R:{result.colour.avgR} G:{result.colour.avgG} B:{result.colour.avgB}
                    </dd>
                  </dl>
                </div>
              )
            })()
          ) : (
            <p className="card__miss">Colour sampling failed</p>
          )}
        </section>
      </div>
    </article>
  )
}

export default function LampUpload({ onAdd }) {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [lampTypeFilter, setLampTypeFilter] = useState('all')
  const [birdRiskFilter, setBirdRiskFilter] = useState('all')
  const inputRef = useRef(null)

  const processFiles = useCallback(async (files) => {
    if (!files.length) return
    setBusy(true)
    const results = await Promise.all(
      Array.from(files).map(async (file) => {
        const [gps, colour] = await Promise.all([
          readExifGps(file).catch(() => null),
          sampleLampColour(file).catch(() => null),
        ])
        return { file, result: { gps, colour } }
      })
    )
    setItems((prev) => [...results, ...prev])
    setBusy(false)
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    e.currentTarget.dataset.over = ''
    processFiles(e.dataTransfer.files)
  }, [processFiles])

  const onDragOver = (e) => { e.preventDefault(); e.currentTarget.dataset.over = 'true' }
  const onDragLeave = (e) => { delete e.currentTarget.dataset.over }

  const filteredItems = useMemo(() => {
    return items.filter(({ result }) => {
      const type = result?.colour?.type || 'unknown'
      const info = LAMP_LABEL[type] || LAMP_LABEL.unknown
      const risk = (info.birdRisk || 'Unknown').toLowerCase()

      if (lampTypeFilter !== 'all' && type !== lampTypeFilter) {
        return false
      }
      if (birdRiskFilter !== 'all' && risk !== birdRiskFilter.toLowerCase()) {
        return false
      }
      return true
    })
  }, [items, lampTypeFilter, birdRiskFilter])

  const hasActiveFilters = lampTypeFilter !== 'all' || birdRiskFilter !== 'all'

  return (
    <div className="spike">
      <header className="spike__header">
        <h1 className="spike__title">Add a light</h1>
        <p className="spike__sub">
          Photograph a lamp near a park or reserve edge. Location is read from
          the photo, and the lamp is classified by colour — blue-rich lighting
          is what draws migrating birds off course.
          <br />
          Nothing leaves your device.
        </p>
      </header>

      <main className="spike__main">
        <div
          className="dropzone"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload lamp photos"
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.heic,.heif,image/heic,image/heif"
            multiple
            className="dropzone__input"
            onChange={(e) => processFiles(e.target.files)}
          />
          <div className="dropzone__icon" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          {busy ? (
            <p className="dropzone__label">Processing&#8230;</p>
          ) : (
            <>
              <p className="dropzone__label">Drop photos here or <span className="dropzone__link">browse</span></p>
              <p className="dropzone__hint">JPEG, HEIC / HEIF, PNG · multiple files OK</p>
            </>
          )}
        </div>

        {/* Persistent Filter Toolbar */}
        <div className="filter-bar">
          <div className="filter-group">
            <label htmlFor="filter-lamp-type" className="filter-label">
              Lamp type:
            </label>
            <select
              id="filter-lamp-type"
              className="filter-select"
              value={lampTypeFilter}
              onChange={(e) => setLampTypeFilter(e.target.value)}
            >
              <option value="all">All Lamp Types</option>
              <option value="hps">High-pressure sodium (~2000K)</option>
              <option value="warm_led">Warm white LED (2700–3000K)</option>
              <option value="neutral_led">Neutral LED (~4000K)</option>
              <option value="cool_led">Cool white LED (5000–6500K)</option>
              <option value="unknown">Unknown / Unclassified</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="filter-bird-risk" className="filter-label">
              Bird risk:
            </label>
            <select
              id="filter-bird-risk"
              className="filter-select"
              value={birdRiskFilter}
              onChange={(e) => setBirdRiskFilter(e.target.value)}
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk (Minimal / Low Blue)</option>
              <option value="medium">Medium Risk (Moderate Blue)</option>
              <option value="high">High Risk (High Blue)</option>
              <option value="unknown">Unknown Risk</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              className="btn-ghost"
              onClick={() => {
                setLampTypeFilter('all')
                setBirdRiskFilter('all')
              }}
            >
              Reset filters
            </button>
          )}
        </div>

        {items.length > 0 ? (
          <section className="results">
            <div className="results__header">
              <div className="results__title-row">
                <h2 className="results__title">
                  Results{' '}
                  <span className="results__count">
                    {hasActiveFilters ? `${filteredItems.length} of ${items.length}` : items.length}
                  </span>
                </h2>
              </div>
              <div className="results__actions">
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setItems([])
                    setLampTypeFilter('all')
                    setBirdRiskFilter('all')
                  }}
                >
                  Clear all
                </button>
              </div>
            </div>

            {filteredItems.length > 0 ? (
              <div className="results__grid">
                {filteredItems.map(({ file, result }, i) => (
                  <FileCard key={`${file.name}-${i}`} file={file} result={result} />
                ))}
              </div>
            ) : (
              <div className="results__empty">
                <p>No uploaded photos match the selected filters.</p>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setLampTypeFilter('all')
                    setBirdRiskFilter('all')
                  }}
                >
                  Reset filters
                </button>
              </div>
            )}
          </section>
        ) : null}
      </main>
    </div>
  )
}
