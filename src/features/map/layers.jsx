/** F1 green-space boundaries · F2 risk surface. OWNER: L2 (Map) */
import { useEffect, useState } from 'react'
import { GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import { DATA, BANDS } from '../../lib/config.js'

function cssToken(name) {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
}

function bandForRisk(value) {
  if (value >= BANDS.high) return 'high'
  if (value >= BANDS.moderate) return 'moderate'
  return 'low'
}

function hexToRgba(hex, alpha) {
  const value = hex.replace('#', '')
  if (value.length !== 6) return `rgba(255, 255, 255, ${alpha})`
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function GreenSpaceLayer() {
  const [data, setData] = useState(null)

  useEffect(() => {
    let cancelled = false

    fetch(DATA.greenSpaces)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  if (!data) return null

  return (
    <GeoJSON
      data={data}
      interactive={false}
      style={() => ({
        color: cssToken('--habitat'),
        weight: 1.2,
        opacity: 0.85,
        fill: false,
      })}
    />
  )
}

export function RiskLayer({ opacity = 0.86, theme }) {
  const map = useMap()

  useEffect(() => {
    let canvas = null
    let frame = null
    let removeListeners = null
    let cancelled = false
    let hoveredIndex = -1
    let phase = 0

    fetch(DATA.riskGrid)
      .then((r) => (r.ok ? r.json() : null))
      .then((grid) => {
        if (cancelled || !grid?.bbox || !grid?.cell) return

        const { bbox, cell, cols, rows, data } = grid
        const colors = {
          low: cssToken('--risk-ramp-low'),
          moderate: cssToken('--risk-ramp-mid'),
          high: cssToken('--risk-ramp-high'),
        }

        const points = []
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            const value = data[row * cols + col]
            if (typeof value !== 'number' || value < 0) continue
            points.push({
              lat: bbox[1] + (row + 0.5) * cell,
              lng: bbox[0] + (col + 0.5) * cell,
              value,
            })
          }
        }
        points.sort((a, b) => a.value - b.value)

        canvas = L.DomUtil.create('canvas', 'risk-blob-layer', map.getPanes().overlayPane)
        const context = canvas.getContext('2d')
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

        function resize() {
          const size = map.getSize()
          const dpr = window.devicePixelRatio || 1
          canvas.width = size.x * dpr
          canvas.height = size.y * dpr
          canvas.style.width = `${size.x}px`
          canvas.style.height = `${size.y}px`
          context.setTransform(dpr, 0, 0, dpr, 0, 0)
        }

        function draw() {
          const size = map.getSize()
          context.clearRect(0, 0, size.x, size.y)
          for (let index = 0; index < points.length; index += 1) {
            const { lat, lng, value } = points[index]
            const position = map.latLngToContainerPoint([lat, lng])
            const edge = map.latLngToContainerPoint([lat, lng + cell])
            const cellPixels = Math.max(3, Math.abs(edge.x - position.x))
            const band = bandForRisk(value)
            const baseRadius = cellPixels * (0.5 + (value / 100) * 1.2)
            const breathing = band === 'high' && !reducedMotion ? 1 + Math.sin(phase) * 0.045 : 1
            const radius = baseRadius * breathing * (index === hoveredIndex ? 1.12 : 1)
            const gradient = context.createRadialGradient(position.x, position.y, 0, position.x, position.y, radius)
            const alpha = (band === 'low' ? 0.24 : band === 'moderate' ? 0.34 : 0.4) * opacity
            gradient.addColorStop(0, hexToRgba(colors[band], alpha))
            gradient.addColorStop(0.78, hexToRgba(colors[band], alpha * 0.72))
            gradient.addColorStop(0.92, hexToRgba(colors[band], alpha))
            gradient.addColorStop(1, hexToRgba(colors[band], alpha))
            context.fillStyle = gradient
            context.beginPath()
            context.arc(position.x, position.y, radius, 0, Math.PI * 2)
            context.fill()
            context.strokeStyle = hexToRgba(colors[band], Math.min(1, alpha * 1.4))
            context.lineWidth = 1.5
            context.stroke()
          }
        }

        function animate() {
          phase += 0.02
          draw()
          if (!reducedMotion) frame = requestAnimationFrame(animate)
        }

        const handleMove = () => { resize(); draw() }
        const handleMouseMove = (event) => {
          const nearest = points.reduce((best, point, index) => {
            const position = map.latLngToContainerPoint([point.lat, point.lng])
            const distance = position.distanceTo(event.containerPoint)
            return distance < best.distance ? { index, distance } : best
          }, { index: -1, distance: 22 })
          hoveredIndex = nearest.index
          draw()
        }
        map.on('move zoom resize', handleMove)
        map.on('mousemove', handleMouseMove)
        resize()
        animate()

        removeListeners = () => {
          map.off('move zoom resize', handleMove)
          map.off('mousemove', handleMouseMove)
          if (frame) cancelAnimationFrame(frame)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (removeListeners) removeListeners()
      if (frame) cancelAnimationFrame(frame)
      if (canvas) canvas.remove()
    }
  }, [map, opacity, theme])

  return null
}
