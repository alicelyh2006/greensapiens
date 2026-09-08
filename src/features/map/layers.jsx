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
    let staticCanvas = null
    let removeListeners = null
    let redrawFrame = null
    let cancelled = false
    let hoveredIndex = -1

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
              row,
              col,
              value,
            })
          }
        }
        points.sort((a, b) => a.value - b.value)

        canvas = L.DomUtil.create('canvas', 'risk-blob-layer', map.getPanes().overlayPane)
        const context = canvas.getContext('2d')
        staticCanvas = document.createElement('canvas')
        const staticContext = staticCanvas.getContext('2d')

        function resize() {
          const size = map.getSize()
          const dpr = window.devicePixelRatio || 1
          canvas.width = size.x * dpr
          canvas.height = size.y * dpr
          staticCanvas.width = size.x * dpr
          staticCanvas.height = size.y * dpr
          canvas.style.width = `${size.x}px`
          canvas.style.height = `${size.y}px`
          context.setTransform(dpr, 0, 0, dpr, 0, 0)
          staticContext.setTransform(dpr, 0, 0, dpr, 0, 0)
        }

        function getGridMetrics() {
          const origin = map.latLngToContainerPoint([
            bbox[1] + cell / 2,
            bbox[0] + cell / 2,
          ])
          const columnEdge = map.latLngToContainerPoint([
            bbox[1] + cell / 2,
            bbox[0] + cell * 1.5,
          ])
          const rowEdge = map.latLngToContainerPoint([
            bbox[1] + cell * 1.5,
            bbox[0] + cell / 2,
          ])
          return {
            origin,
            columnSpacing: Math.max(3, Math.abs(columnEdge.x - origin.x)),
            rowSpacing: Math.max(3, Math.abs(rowEdge.y - origin.y)),
          }
        }

        function pointPosition(point) {
          return map.latLngToContainerPoint([point.lat, point.lng])
        }

        function drawPoint(target, point, index, metrics) {
          const { value } = point
          const position = pointPosition(point)
          const size = map.getSize()
          if (position.x < -40 || position.y < -40 || position.x > size.x + 40 || position.y > size.y + 40) return
          const band = bandForRisk(value)
          const radius = Math.min(metrics.columnSpacing, metrics.rowSpacing) * 0.58
          const alpha = index === hoveredIndex ? Math.min(1, opacity + 0.14) : opacity

          target.fillStyle = hexToRgba(colors[band], alpha)
          target.beginPath()
          for (let vertex = 0; vertex < 6; vertex += 1) {
            const angle = (Math.PI / 3) * vertex
            const x = position.x + radius * Math.cos(angle)
            const y = position.y + radius * Math.sin(angle)
            if (vertex === 0) target.moveTo(x, y)
            else target.lineTo(x, y)
          }
          target.closePath()
          target.fill()
        }

        function drawStatic() {
          const size = map.getSize()
          const metrics = getGridMetrics()
          staticContext.clearRect(0, 0, size.x, size.y)
          for (let index = 0; index < points.length; index += 1) {
            if (index === hoveredIndex) continue
            drawPoint(staticContext, points[index], index, metrics)
          }
        }

        function draw(timestamp = 0) {
          const size = map.getSize()
          const metrics = getGridMetrics()
          context.clearRect(0, 0, size.x, size.y)
          context.drawImage(staticCanvas, 0, 0, size.x, size.y)
          for (let index = 0; index < points.length; index += 1) {
            if (index === hoveredIndex) drawPoint(context, points[index], index, metrics)
          }
        }

        const scheduleRedraw = () => {
          if (redrawFrame) return
          redrawFrame = requestAnimationFrame(() => {
            redrawFrame = null
            resize()
            drawStatic()
            draw()
          })
        }
        const handleMove = scheduleRedraw
        const handleMouseMove = (event) => {
          const metrics = getGridMetrics()
          const nearest = points.reduce((best, point, index) => {
            const position = pointPosition(point)
            const distance = Math.hypot(
              position.x - event.containerPoint.x,
              position.y - event.containerPoint.y
            )
            return distance < best.distance ? { index, distance } : best
          }, { index: -1, distance: 22 })
          hoveredIndex = nearest.index
          scheduleRedraw()
        }
        map.on('move zoom resize', handleMove)
        map.on('mousemove', handleMouseMove)
        resize()
        drawStatic()
        draw()

        removeListeners = () => {
          map.off('move zoom resize', handleMove)
          map.off('mousemove', handleMouseMove)
          if (redrawFrame) cancelAnimationFrame(redrawFrame)
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
      if (removeListeners) removeListeners()
      if (redrawFrame) cancelAnimationFrame(redrawFrame)
      if (canvas) canvas.remove()
      if (staticCanvas) staticCanvas.width = 0
    }
  }, [map, opacity, theme])

  return null
}
