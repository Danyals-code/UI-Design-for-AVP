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

  const selected = items.find((it) => it.id === selectedId)
  const canTransform = selected && selected.type === 'entity'
  const isOrbit = sceneMode === 'volume' || preview3D

  // Keyboard shortcuts — Blender G / R / S, Esc back to pointer.
  // Active whenever the camera is in orbit mode (volume or window-3D)
  // even without a selection — pressing G with nothing selected is
  // harmless, but the user's muscle memory needs the keys to always
  // mean the same thing.
  useEffect(() => {
    if (!isOrbit) return
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'g') { setTransformMode('translate'); e.preventDefault() }
      else if (k === 'r') { setTransformMode('rotate'); e.preventDefault() }
      else if (k === 's' && !e.shiftKey) { setTransformMode('scale'); e.preventDefault() }
      else if (k === 'escape') { setTransformMode('none'); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOrbit, setTransformMode])

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
              onClick={disabled ? undefined : () => setTransformMode(mode)}
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
      </div>
    </div>
  )
}
