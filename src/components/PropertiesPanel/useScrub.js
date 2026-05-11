// Drag-to-scrub hook (Blender-style). Click-and-drag on a field to scrub
// the value; if the pointer doesn't travel past a small threshold the
// event falls through as a normal click so the user can still type.
//
// The threshold + the preventDefault-only-once-moving pattern matters:
// without it, a steady click would still flip into scrub mode (because
// `mousemove` fires once or twice from sub-pixel device noise) and the
// browser would skip focusing the input, leaving the field unable to
// take keystrokes. 6 px is the sweet spot — small enough that
// intentional drags feel snappy, large enough to ignore trackpad jitter.

import { useRef, useCallback } from 'react'

export function useScrub(value, onChange, sensitivity = 1) {
  const scrubbing = useRef(false)
  const startX = useRef(0)
  const startVal = useRef(0)
  const moved = useRef(false)
  const targetRef = useRef(null)

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return
    // Don't hijack drags that originate on a child UI control (e.g.
    // the `×` clear-button or the suffix span). Without this, those
    // clicks couldn't fire — the pointer-down would always be
    // intercepted by the parent input.
    if (e.target && e.target !== e.currentTarget && e.target.tagName === 'BUTTON') return
    startX.current = e.clientX
    startVal.current = typeof value === 'number' ? value : parseFloat(value) || 0
    moved.current = false
    scrubbing.current = true
    targetRef.current = e.currentTarget

    const onMove = (ev) => {
      const dx = ev.clientX - startX.current
      if (!moved.current) {
        if (Math.abs(dx) < 6) return
        // First time we cross the threshold: take over from the
        // browser. Preventing the default here keeps the field from
        // entering text-selection mode mid-drag, and pulling focus to
        // body avoids the cursor blinking inside an input the user is
        // actively scrubbing.
        moved.current = true
        document.body.style.cursor = 'ew-resize'
        try { ev.preventDefault?.() } catch {}
        if (document.activeElement && document.activeElement.blur) {
          document.activeElement.blur()
        }
      }
      const next = startVal.current + dx * sensitivity
      onChange(next)
    }
    const onUp = () => {
      const didScrub = moved.current
      scrubbing.current = false
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      // If the user clicked without crossing the threshold, restore
      // focus + selection on the input so typing just works.
      if (!didScrub && targetRef.current) {
        try {
          targetRef.current.focus()
          targetRef.current.select?.()
        } catch {}
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [value, onChange, sensitivity])

  return { onPointerDown, isScrubbing: () => scrubbing.current, didMove: () => moved.current }
}
