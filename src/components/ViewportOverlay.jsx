// Viewport top-right toolbar.
//   [ Zoom slider ]  [ Overlays ▾ ]  [ Window | Volume ]  [ 2D | 3D ]
//
// Window/Volume picks the scene type — flipping it kicks off a fresh seed
// for the new mode (with a confirmation dialog when the current scene has
// unsaved edits). 2D/3D is the camera toggle for window mode; in volume
// mode it greys out because the volumetric stage is always 3D.
//
// HDRI lives in Scene → Viewport (inspector). Pan-mode is gone — in 3D
// preview, left-drag rotates by default (matches Blender / Maya / C4D).

import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { GridIcon, WindowIcon, VolumeIcon, ChevronDown } from './icons'

// ---- Zoom slider ------------------------------------------------------

function ZoomSlider() {
  const zoomDistance = useStore((s) => s.zoomDistance)
  const setZoomDistance = useStore((s) => s.setZoomDistance)
  // Metres-scale slider: 0.3m–4m range covers "tip of window" to
  // "across the room". 1.4m is the natural framing for a 1.2m window.
  const DEFAULT_DIST = 1.4
  const RESET_DIST = DEFAULT_DIST
  const pct = Math.round((DEFAULT_DIST / Math.max(0.05, zoomDistance)) * 100)

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
        min={0.3}
        max={5}
        step={0.02}
        value={zoomDistance}
        onChange={(e) => setZoomDistance(parseFloat(e.target.value))}
        onDoubleClick={() => setZoomDistance(RESET_DIST)}
        className="w-24 accent-accent cursor-pointer"
        title="Zoom — double-click to reset"
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

  const sceneMode     = useStore((s) => s.scene.sceneMode)
  const showDemoScene = useStore((s) => s.scene.showDemoScene)
  const gridAxes      = useStore((s) => s.gridAxes)
  const showAxes      = useStore((s) => s.showAxes)
  const showSceneInfo = useStore((s) => s.showSceneInfo)
  const preview3D     = useStore((s) => s.scene.preview3D)
  const toggleGridAxis  = useStore((s) => s.toggleGridAxis)
  const toggleAxes      = useStore((s) => s.toggleAxes)
  const toggleSceneInfo = useStore((s) => s.toggleSceneInfo)
  const toggleDemoScene = useStore((s) => s.toggleDemoScene)

  // Volume mode is always 3D — grids X / Y / axes apply unconditionally.
  // Window mode honours the user's 2D / 3D toggle.
  const isVolume = sceneMode === 'volume'
  const orbitActive = isVolume || preview3D

  useEffect(() => {
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

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
          className="popover absolute right-0 top-full mt-1 rounded z-50 py-2 px-2.5 w-52"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/*
            Demo Scene applies to both window and volume modes — window
            mode renders inside the same studio so a "hide the room"
            toggle belongs here too. Previously it only surfaced in
            volume mode, leaving window users with no way to opt out.
          */}
          <div className="text-[9px] text-textMute uppercase tracking-wider mb-2 px-1">Studio</div>
          <OverlayRow label="Demo Scene" on={showDemoScene} toggle={toggleDemoScene} />
          <div className="border-b border-border my-2" />

          <div className="text-[9px] text-textMute uppercase tracking-wider mb-2 px-1">Grid</div>
          <OverlayRow label="X (side)"   on={gridAxes.x} toggle={() => toggleGridAxis('x')} disabled={!orbitActive} disabledHint="3D only" />
          <OverlayRow label="Y (floor)"  on={gridAxes.y} toggle={() => toggleGridAxis('y')} disabled={!orbitActive} disabledHint="3D only" />
          <OverlayRow label="Z (back)"   on={gridAxes.z} toggle={() => toggleGridAxis('z')} />

          <div className="text-[9px] text-textMute uppercase tracking-wider mt-3 mb-2 px-1">Guides</div>
          <OverlayRow label="Axes Gizmo" on={showAxes}      toggle={toggleAxes} disabled={!orbitActive} disabledHint="3D only" />
          <OverlayRow label="Scene Info" on={showSceneInfo} toggle={toggleSceneInfo} />
        </div>
      )}
    </div>
  )
}

function OverlayRow({ label, on, toggle, disabled = false, disabledHint }) {
  return (
    <button
      onClick={disabled ? undefined : toggle}
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
      className={`flex items-center gap-2 w-full px-1 py-1 text-[11px] rounded transition-colors ${
        disabled
          ? 'text-textMute cursor-not-allowed opacity-50'
          : 'text-text hover:bg-hover'
      }`}
    >
      <span
        className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[8px] ${
          on ? 'bg-accent border-accent text-white' : 'bg-surface3 border-border text-transparent'
        }`}
      >{'✓'}</span>
      <span className="flex-1 text-left">{label}</span>
      {disabled && disabledHint && (
        <span className="text-[8px] text-textMute uppercase tracking-wider">{disabledHint}</span>
      )}
    </button>
  )
}

// ---- Confirm-reset dialog --------------------------------------------
//
// Modal shown when the user flips Window/Volume on a scene that has been
// edited since the last template/seed. Switching modes seeds a fresh
// scene for the target mode — destructive in the sense that the current
// item tree is replaced. ⌘Z still recovers the prior scene afterwards.

function SwitchModeDialog({ targetMode, onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-surface border border-border rounded-xl shadow-2xl w-[420px] max-w-[92vw] overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-[13px] font-semibold text-text">
            Switch to {targetMode === 'volume' ? 'Volume' : 'Window'} mode?
          </div>
          <div className="text-[11px] text-textMute mt-1 leading-relaxed">
            Switching modes replaces your current scene with a fresh
            {targetMode === 'volume' ? ' volumetric stage' : ' window'} seed.
            You can recover this scene with <kbd className="kbd">⌘Z</kbd> after the switch.
          </div>
        </div>
        <div className="px-5 py-3 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="btn"
          >Stay in {targetMode === 'volume' ? 'Window' : 'Volume'}</button>
          <button
            onClick={onConfirm}
            className="btn btn-primary"
          >Switch &amp; Reset</button>
        </div>
      </div>
    </div>
  )
}

// ---- Scene mode toggle (Window / Volume) -----------------------------

function SceneModeToggle() {
  const sceneMode = useStore((s) => s.scene.sceneMode)
  const sceneIsDirty = useStore((s) => s.sceneIsDirty)
  const switchSceneMode = useStore((s) => s.switchSceneMode)
  const [pending, setPending] = useState(null)

  const onPick = (mode) => {
    if (mode === sceneMode) return
    // Pristine scenes (just-seeded / just-template-applied / fresh launch)
    // skip the warning — there's nothing for the user to lose.
    if (!sceneIsDirty) {
      switchSceneMode(mode)
      return
    }
    setPending(mode)
  }

  const onConfirm = () => {
    if (pending) switchSceneMode(pending)
    setPending(null)
  }

  return (
    <>
      <div
        className="segmented"
        style={{
          height: 28,
          background: 'rgba(21, 21, 21, 0.88)',
          backdropFilter: 'blur(8px)'
        }}
      >
        <button
          className={sceneMode === 'window' ? 'active' : ''}
          onClick={() => onPick('window')}
          title="Flat 2D scene that floats in space"
          style={{ minWidth: 64, gap: 4 }}
        >
          <WindowIcon size={12} /> Window
        </button>
        <button
          className={sceneMode === 'volume' ? 'active' : ''}
          onClick={() => onPick('volume')}
          title="Bounded 3D scene with depth"
          style={{ minWidth: 64, gap: 4 }}
        >
          <VolumeIcon size={12} /> Volume
        </button>
      </div>
      {pending && (
        <SwitchModeDialog
          targetMode={pending}
          onCancel={() => setPending(null)}
          onConfirm={onConfirm}
        />
      )}
    </>
  )
}

// ---- VR View button --------------------------------------------------
//
// Replaces the old 2D/3D segmented toggle. Window mode now renders
// exclusively in the wearer's VR view (`preview3D` is forced on), so
// the button's sole job in either mode is to snap the orbit camera
// back to the wearer's default eye-line pose — the visionOS analogue
// of "press 0 in Blender for camera view".
function VRViewButton() {
  const sceneMode = useStore((s) => s.scene.sceneMode)
  const preview3D = useStore((s) => s.scene.preview3D)
  const updateScene = useStore((s) => s.updateScene)
  const isVolume = sceneMode === 'volume'

  const onClick = () => {
    if (!isVolume && !preview3D) {
      // Safety net — if anything ever flipped preview3D off, ensure
      // we're back in the 3D framing before snapping the camera.
      updateScene({ preview3D: true })
    }
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('snap-camera-to-default'))
    })
  }

  return (
    <button
      onClick={onClick}
      title="Snap to the wearer's default eye-line pose"
      className="vp-btn"
      style={{
        width: 'auto',
        height: 28,
        paddingLeft: 12, paddingRight: 12,
        whiteSpace: 'nowrap',
        border: '1px solid #2e2e2e',
        background: 'rgba(21, 21, 21, 0.88)',
        backdropFilter: 'blur(8px)',
        color: '#cfcfd1',
        fontSize: 11
      }}
    >
      VR View
    </button>
  )
}

function CameraEntityViewButton() {
  const items = useStore((s) => s.items)
  const selectedId = useStore((s) => s.selectedId)
  const sceneMode = useStore((s) => s.scene.sceneMode)
  const preview3D = useStore((s) => s.scene.preview3D)
  const isOrbit = sceneMode === 'volume' || preview3D

  // Prefer a selected camera entity, otherwise fall back to the first
  // camera entity in the document.
  const selected = items.find((it) => it.id === selectedId)
  const target = (selected && selected.type === 'entity' && selected.entityKind === 'camera')
    ? selected
    : items.find((it) => it.type === 'entity' && it.entityKind === 'camera')

  if (!isOrbit || !target) return null
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent('snap-camera-to-entity', { detail: { entityId: target.id } }))}
      title={`Snap orbit camera to ${target.name || 'camera'}`}
      className="vp-btn"
      style={{
        height: 28,
        paddingLeft: 10, paddingRight: 10, gap: 6,
        border: '1px solid #2e2e2e',
        background: 'rgba(21, 21, 21, 0.88)',
        backdropFilter: 'blur(8px)',
        color: '#cfcfd1',
        fontSize: 11
      }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="9" height="7" rx="1" />
        <path d="M11 7l3-2v6l-3-2z" />
      </svg>
      Camera Entity
    </button>
  )
}

// ---- Top-level overlay -------------------------------------------------

export default function ViewportOverlay() {
  return (
    <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10 pointer-events-auto">
      <VRViewButton />
      <CameraEntityViewButton />
      <ZoomSlider />
      <OverlaysDropdown />
      <SceneModeToggle />
    </div>
  )
}
