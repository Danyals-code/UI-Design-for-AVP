// Drag-to-scrub hook (Blender-style). Click-and-drag on a field to scrub the
// value; if the pointer doesn't move > 3 px, the event falls through as a
// normal click so the user can still type.

import { useRef, useCallback } from 'react'

export function useScrub(value, onChange, sensitivity = 1) {
  const scrubbing = useRef(false)
  const startX = useRef(0)
  const startVal = useRef(0)
  const moved = useRef(false)

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return
    startX.current = e.clientX
    startVal.current = typeof value === 'number' ? value : parseFloat(value) || 0
    moved.current = false
    scrubbing.current = true
    document.body.style.cursor = 'ew-resize'

    const onMove = (ev) => {
      const dx = ev.clientX - startX.current
      if (Math.abs(dx) >= 3) moved.current = true
      if (!moved.current) return
      const next = startVal.current + dx * sensitivity
      onChange(next)
    }
    const onUp = () => {
      scrubbing.current = false
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [value, onChange, sensitivity])

  return { onPointerDown, isScrubbing: () => scrubbing.current, didMove: () => moved.current }
}
