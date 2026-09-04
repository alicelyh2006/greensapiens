/**
 * Modal shell for the contribution features.
 *
 * The capture components were written as full-width pages, and they are good
 * that way — dropzones, previews and result cards all need room. Rather than
 * cramming them into a 24rem sidebar, the sidebar holds a button and the
 * component gets a full-size surface when opened. That keeps L4's layout
 * intact instead of rewriting it.
 */
import { useEffect, useRef } from 'react'
import './modal.css'

export default function Modal({ open, title, onClose, children }) {
  const panelRef = useRef(null)

  // Escape to close, and stop the page behind from scrolling.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
      >
        <button className="modal__close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}
