// Blender-style transform toolbar pinned to the top-left of the viewport.
// Switches the active gizmo mode: pointer (no gizmo) / translate / rotate
// / scale. Mirrors Blender's left toolbar — same visual cadence, same
// keyboard shortcuts (G / R / S, Esc cancels back to pointer).
//
// The toolbar only shows when an entity is selected — there's no useful
// gizmo without a target — and only when the camera is in an orbit
// mode (volume, or window's 3D preview). In flat 2D head-on mode the
// gizmo would project to a 1D handle so we don't expose it there.

import { useEffect } from 'react'
import { useStore } from '../store'
import {
  PointerToolIcon, MoveToolIcon, RotateToolIcon, ScaleToolIcon
} from './icons'

const TOOLS = [
  { mode: 'none',      Icon: PointerToolIcon, label: 'Select',    hint: 'Esc' },
  { mode: 'translate', Icon: MoveToolIcon,    label: 'Move',      hint: 'G' },
  { mode: 'rotate',    Icon: RotateToolIcon,  label: 'Rotate',    hint: 'R' },
  { mode: 'scale',     Icon: ScaleToolIcon,   label: 'Scale',     hint: 'S' }
]

export default function TransformToolbar() {
  const sceneMode    = useStore((s) => s.scene.sceneMode)
  const preview3D    = useStore((s) => s.scene.preview3D)
  const selectedId   = useStore((s) => s.selectedId)
  const items        = useStore((s) => s.items)
  const transformMode = useStore((s) => s.transformMode)
  const setTransformMode = useStore((s) => s.setTransformMode)

  const transformKind = useStore((s) => s.transformKind)
  const transformAxis = useStore((s) => s.transformAxis)
  const setTransformAxis = useStore((s) => s.setTransformAxis)

  const selected = items.find((it) => it.id === selectedId)
  const canTransform = selected && selected.type === 'entity'
  const isOrbit = sceneMode === 'volume' || preview3D

  // Keyboard shortcuts — Blender chord: G / R / S enter the modal
  // (cursor-driven) tool; an immediate follow-up X / Y / Z constrains
  // the active modal to that axis (e.g. `S X` = scale on X). Esc
  // returns to pointer. The toolbar buttons take the alternate route —
  // they enter `kind: 'gizmo'` so the user gets a draggable handle.
  useEffect(() => {
    if (!isOrbit) return
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'g')      { setTransformMode('translate', 'modal'); e.preventDefault() }
      else if (k === 'r') { setTransformMode('rotate',    'modal'); e.preventDefault() }
      else if (k === 's' && !e.shiftKey) { setTransformMode('scale', 'modal'); e.preventDefault() }
      else if (k === 'escape') { setTransformMode('none', 'gizmo'); e.preventDefault() }
      else if (k === 'x' || k === 'y' || k === 'z') {
        // Axis chord — only meaningful while a modal is active. Toggle
        // on / off so the user can lift the constraint without exiting
        // the tool (matches Blender behaviour).
        const cur = useStore.getState()
        if (cur.transformMode !== 'none' && cur.transformKind === 'modal') {
          setTransformAxis(cur.transformAxis === k ? null : k)
          e.preventDefault()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOrbit, setTransformMode, setTransformAxis])

  // Toolbar persists in 3D modes regardless of selection — gives the
  // user a stable mental model ("the tools live here when I'm in 3D").
  // Buttons disable when no entity is selected so it's clear *what*
  // they'd act on, but the toolbar itself stays visible.
  if (!isOrbit) return null

  return (
    <div className="absolute top-3 left-3 z-10 pointer-events-auto flex flex-col gap-1">
      <div
        className="rounded flex flex-col p-1"
        style={{
          border: '1px solid #2e2e2e',
          background: 'rgba(21, 21, 21, 0.88)',
          backdropFilter: 'blur(8px)'
        }}
      >
        {TOOLS.map(({ mode, Icon, label, hint }) => {
          const active = transformMode === mode
          // Pointer is always usable; the transform tools need a target.
          const disabled = mode !== 'none' && !canTransform
          return (
            <button
              key={mode}
              // Buttons enter the same modal flow as G / R / S. We
              // attempted a drei-<TransformControls> visible handle
              // here but it conflicts with Entity3D's controlled
              // position/rotation/scale: the gizmo expects to own
              // those fields on the same Object3D, while React keeps
              // re-applying the controlled props on every store
              // update. Switching to uncontrolled-via-ref left the
              // gizmo attaching at world origin (the group's pose
              // before the imperative seed ran). A clean fix needs a
              // larger refactor of the entity render tree — out of
              // scope for now, so the modal cursor flow handles both
              // entry points.
              onClick={disabled ? undefined : () => setTransformMode(mode, 'modal')}
              disabled={disabled}
              title={disabled ? `${label} — select an entity first` : `${label}${hint ? ` (${hint})` : ''}`}
              className={`vp-btn justify-center ${active ? 'active' : ''}`}
              style={{
                width: 28, height: 28,
                border: 'none',
                background: active ? 'rgba(10, 132, 255, 0.85)' : 'transparent',
                color: disabled ? '#5a5d62' : (active ? '#ffffff' : '#cfcfd1'),
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.45 : 1
              }}
            >
              <Icon />
            </button>
          )
        })}
      </div>
      <div
        className="text-[8px] text-center text-textMute uppercase tracking-wider"
        style={{ width: 36 }}
      >
        {TOOLS.find((t) => t.mode === transformMode)?.label || 'Select'}
        {/* Show the chord status under the active tool so the designer
            can read off "Move · X" while a constraint is in effect. */}
        {transformMode !== 'none' && transformAxis && (
          <div className="text-accent">{transformAxis.toUpperCase()}</div>
        )}
      </div>
    </div>
  )
}
