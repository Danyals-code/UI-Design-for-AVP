// Viewport top-right toolbar.
//   [ Zoom slider ]  [ Overlays \u25be ]  [ 2D | 3D ]
//
// HDRI lives in Scene \u2192 Viewport (inspector). Pan-mode is gone \u2014 in 3D
// preview, left-drag rotates by default (matches Blender / Maya / C4D),
// so a separate hand-toggle is unnecessary.

import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { GridIcon, VolumeIcon, ChevronDown } from './icons'

// ---- Zoom slider ------------------------------------------------------

function ZoomSlider() {
  const zoomDistance = useStore((s) => s.zoomDistance)
  const setZoomDistance = useStore((s) => s.setZoomDistance)
  const DEFAULT_DIST = 7.0
  // 85% zoom is the out-of-box framing. Double-click returns here.
  const DEFAULT_PCT = 0.85
  const RESET_DIST = DEFAULT_DIST / DEFAULT_PCT
  const pct = Math.round((DEFAULT_DIST / Math.max(0.5, zoomDistance)) * 100)

  return (
    <div
      className="flex items-center gap-1.5 rounded px-2"
      style={{
        height: 28,
        border: '1px solid #2e2e2e',
        background: 'rgba(21, 21, 21, 0.88)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <span className="text-[11px] font-medium text-white w-9 text-right tabular-nums">{pct}%</span>
      <input
        type="range"
        min={2}
        max={14}
        step={0.05}
        value={zoomDistance}
        onChange={(e) => setZoomDistance(parseFloat(e.target.value))}
        onDoubleClick={() => setZoomDistance(RESET_DIST)}
        className="w-24 accent-accent cursor-pointer"
        title="Zoom \u2014 double-click to reset to 85%"
      />
    </div>
  )
}

// ---- Overlays dropdown ------------------------------------------------
// Mirrors Blender's viewport-overlay popover. Toggles render-time guides
// without cluttering the toolbar with one button per option.

function OverlaysDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const showGrid  = useStore((s) => s.showGrid)
  const showAxes  = useStore((s) => s.showAxes)
  const showStats = useStore((s) => s.showStats)
  const toggleGrid  = useStore((s) => s.toggleGrid)
  const toggleAxes  = useStore((s) => s.toggleAxes)
  const toggleStats = useStore((s) => s.toggleStats)

  useEffect(() => {
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // The button always reads as "active" (overlays are always doing
  // something). Highlight on hover; expand to show the popover.
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Viewport overlays"
        className="vp-btn"
        style={{ width: 'auto', paddingLeft: 8, paddingRight: 6, gap: 4 }}
      >
        <GridIcon />
        <ChevronDown size={9} />
      </button>
      {open && (
        <div
          className="popover absolute right-0 top-full mt-1 rounded z-50 py-2 px-2.5 w-44"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="text-[9px] text-textMute uppercase tracking-wider mb-2 px-1">Guides</div>
          <OverlayRow label="Grid"        on={showGrid}  toggle={toggleGrid} />
          <OverlayRow label="Axes Gizmo"  on={showAxes}  toggle={toggleAxes} />
          <OverlayRow label="Statistics"  on={showStats} toggle={toggleStats} />
          <div className="text-[9px] text-textMute leading-relaxed mt-2 pt-2 border-t border-border px-1">
            Left-drag the viewport to orbit freely. Click an axis arrow on the gizmo to snap.
          </div>
        </div>
      )}
    </div>
  )
}

function OverlayRow({ label, on, toggle }) {
  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 w-full px-1 py-1 text-[11px] text-text hover:bg-hover rounded transition-colors"
    >
      <span
        className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[8px] ${
          on ? 'bg-accent border-accent text-white' : 'bg-surface3 border-border text-transparent'
        }`}
      >{'\u2713'}</span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  )
}

// ---- View mode toggle (2D / 3D) ---------------------------------------
// Stable segmented button \u2014 same shape and size in both states, with the
// active mode highlighted. Mirrors Blender's Wireframe / Solid / Material /
// Rendered shading buttons: always visible, always the same metric.

function ViewModeToggle() {
  const preview3D = useStore((s) => s.scene.preview3D)
  const updateScene = useStore((s) => s.updateScene)
  // Inherits the shared `.segmented` styling (rounded, overflow:hidden) so
  // the active highlight stays inside the parent rounded rect. Backdrop
  // blur layered on top so it harmonises with the rest of the overlay.
  return (
    <div
      className="segmented"
      style={{
        height: 28,
        background: 'rgba(21, 21, 21, 0.88)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <button
        className={!preview3D ? 'active' : ''}
        onClick={() => updateScene({ preview3D: false })}
        title="Flat 2D head-on view"
        style={{ minWidth: 38 }}
      >2D</button>
      <button
        className={preview3D ? 'active' : ''}
        onClick={() => updateScene({ preview3D: true })}
        title="Orbit camera — see your design in 3D"
        style={{ minWidth: 44 }}
      ><VolumeIcon size={11} /> 3D</button>
    </div>
  )
}

// ---- Top-level overlay -------------------------------------------------

export default function ViewportOverlay() {
  const sceneMode = useStore((s) => s.scene.sceneMode)
  const preview3D = useStore((s) => s.scene.preview3D)

  const isVolume = sceneMode === 'volume'
  const isWindow = sceneMode === 'window'
  // Toolbar only makes sense when the canvas is on screen.
  const showSceneControls = isWindow || (isVolume && preview3D)

  return (
    <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10 pointer-events-auto">
      {showSceneControls && (
        <>
          <ZoomSlider />
          <OverlaysDropdown />
        </>
      )}
      {/* View mode \u2014 only meaningful for windows (Volume always renders
          in 3D when its canvas is up). */}
      {isWindow && <ViewModeToggle />}
    </div>
  )
}
