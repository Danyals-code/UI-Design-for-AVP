// ModifierStack — Blender-style stacked SwiftUI modifiers.
//
// Renders `item.modifiers` (an ordered array) as a list of collapsible rows.
// Each row shows the SwiftUI method name, per-arg controls, drag-to-reorder,
// and a delete button. The "+ Add Modifier" dropdown is filtered to the
// modifiers SwiftUI accepts on this view kind (strict — see registry).
//
// Order is meaningful: the inspector's top → bottom matches SwiftUI's chain
// order, so `.padding().background()` reads the same way the export emits.

import { useState } from 'react'
import {
  MODIFIERS, getAllowedModifiers,
  viewKind, makeModifier
} from '../../modifiers/registry'
import { Section, Row, NumField, IntField, Slider, ColorRow, Select } from './primitives'

// ---- per-modifier inspector bodies -----------------------------------
//
// Each branch reads `m` (the modifier entry) and writes via `set(patch)`.
// Kept in one switch so the registry stays declarative — adding a new
// modifier means: registry entry + one case here.

function ModifierBody({ m, set }) {
  switch (m.type) {
    case 'opacity':
      return <Row label="Value"><Slider value={m.value ?? 1} min={0} max={1} step={0.01} onChange={(v) => set({ value: v })} /></Row>

    case 'padding':
      return (
        <>
          <Row label="Edges">
            <Select
              value={m.edges || 'all'}
              options={[
                { value: 'all',         label: 'All' },
                { value: 'horizontal',  label: 'Horizontal' },
                { value: 'vertical',    label: 'Vertical' },
                { value: 'top',         label: 'Top' },
                { value: 'bottom',      label: 'Bottom' },
                { value: 'leading',     label: 'Leading' },
                { value: 'trailing',    label: 'Trailing' }
              ]}
              onChange={(v) => set({ edges: v })}
            />
          </Row>
          <Row label="Length"><NumField value={m.length ?? 0} step={1} suffix="pt" onChange={(v) => set({ length: v })} /></Row>
        </>
      )

    case 'offset':
      return (
        <Row label="X / Y">
          <NumField value={m.x || 0} step={1} suffix="pt" onChange={(v) => set({ x: v })} />
          <NumField value={m.y || 0} step={1} suffix="pt" onChange={(v) => set({ y: v })} />
        </Row>
      )

    case 'rotationEffect':
      return <Row label="Degrees"><NumField value={m.degrees || 0} step={1} suffix="°" onChange={(v) => set({ degrees: v })} /></Row>

    case 'scaleEffect':
      return (
        <Row label="X / Y">
          <NumField value={m.x ?? 1} step={0.05} onChange={(v) => set({ x: v })} />
          <NumField value={m.y ?? 1} step={0.05} onChange={(v) => set({ y: v })} />
        </Row>
      )

    case 'shadow':
      return (
        <>
          <Row label="Color"><ColorRow value={m.color || '#000000'} onChange={(v) => set({ color: v })} /></Row>
          <Row label="Radius"><IntField value={m.radius ?? 0} min={0} onChange={(v) => set({ radius: v })} /></Row>
          <Row label="X / Y">
            <IntField value={m.x ?? 0} onChange={(v) => set({ x: v })} />
            <IntField value={m.y ?? 0} onChange={(v) => set({ y: v })} />
          </Row>
        </>
      )

    case 'border':
      return (
        <>
          <Row label="Color"><ColorRow value={m.color || '#000000'} onChange={(v) => set({ color: v })} /></Row>
          <Row label="Width"><NumField value={m.width ?? 0} step={0.5} suffix="pt" onChange={(v) => set({ width: Math.max(0, v) })} /></Row>
        </>
      )

    case 'clipShape':
      return (
        <Row label="Shape">
          <Select
            value={m.shape || 'roundedRect'}
            options={[
              { value: 'roundedRect', label: 'Rounded Rectangle' },
              { value: 'circle',      label: 'Circle' },
              { value: 'capsule',     label: 'Capsule' }
            ]}
            onChange={(v) => set({ shape: v })}
          />
        </Row>
      )

    case 'foregroundStyle':
      return <Row label="Color"><ColorRow value={m.color || '#ffffff'} onChange={(v) => set({ color: v })} /></Row>

    case 'glassBackgroundEffect':
      return (
        <>
          <Row label="Mode">
            <Select
              value={m.displayMode || 'always'}
              options={[
                { value: 'always',   label: 'Always' },
                { value: 'implicit', label: 'Implicit (cascaded)' }
              ]}
              onChange={(v) => set({ displayMode: v })}
            />
          </Row>
          <Row label="Shape">
            <Select
              value={m.shape || 'auto'}
              options={[
                { value: 'auto',             label: 'Container Relative (default)' },
                { value: 'capsule',          label: 'Capsule' },
                { value: 'circle',           label: 'Circle' },
                { value: 'roundedRectangle', label: 'Rounded Rectangle' },
                { value: 'rectangle',        label: 'Rectangle' }
              ]}
              onChange={(v) => set({ shape: v })}
            />
          </Row>
        </>
      )

    case 'containerBackground':
      return (
        <>
          <Row label="Color"><ColorRow value={m.color || '#000000'} onChange={(v) => set({ color: v })} /></Row>
          <Row label="For">
            <Select
              value={m.placement || 'window'}
              options={[
                { value: 'window',     label: 'Window' },
                { value: 'navigation', label: 'Navigation' }
              ]}
              onChange={(v) => set({ placement: v })}
            />
          </Row>
        </>
      )

    case 'disabled':
      return (
        <Row label="On">
          <div className="segmented flex-1">
            <button className={m.value ? 'active' : ''} onClick={() => set({ value: true })}>On</button>
            <button className={!m.value ? 'active' : ''} onClick={() => set({ value: false })}>Off</button>
          </div>
        </Row>
      )

    case 'textCase':
      return (
        <Row label="Case">
          <Select
            value={m.value || 'uppercase'}
            options={[
              { value: 'uppercase', label: 'UPPERCASE' },
              { value: 'lowercase', label: 'lowercase' }
            ]}
            onChange={(v) => set({ value: v })}
          />
        </Row>
      )

    case 'lineLimit':
      return <Row label="Lines"><IntField value={m.value ?? 1} min={1} max={20} onChange={(v) => set({ value: v })} /></Row>
    case 'lineSpacing':
      return <Row label="Spacing"><NumField value={m.value ?? 0} step={1} suffix="pt" onChange={(v) => set({ value: v })} /></Row>
    case 'tracking':
      return <Row label="Tracking"><NumField value={m.value ?? 0} step={0.1} suffix="pt" onChange={(v) => set({ value: v })} /></Row>
    case 'kerning':
      return <Row label="Kerning"><NumField value={m.value ?? 0} step={0.1} suffix="pt" onChange={(v) => set({ value: v })} /></Row>
    case 'baselineOffset':
      return <Row label="Offset"><NumField value={m.value ?? 0} step={0.5} suffix="pt" onChange={(v) => set({ value: v })} /></Row>
    case 'truncationMode':
      return (
        <Row label="Mode">
          <Select
            value={m.value || 'middle'}
            options={[
              { value: 'tail',   label: 'Tail' },
              { value: 'middle', label: 'Middle' },
              { value: 'head',   label: 'Head' }
            ]}
            onChange={(v) => set({ value: v })}
          />
        </Row>
      )
    case 'minimumScaleFactor':
      return <Row label="Min Scale"><Slider value={m.value ?? 1} min={0.1} max={1} step={0.05} onChange={(v) => set({ value: v })} /></Row>
    case 'fontDesign':
      return (
        <Row label="Design">
          <Select
            value={m.value || 'rounded'}
            options={[
              { value: 'default',    label: 'Default (SF)' },
              { value: 'serif',      label: 'Serif (NY)' },
              { value: 'rounded',    label: 'Rounded' },
              { value: 'monospaced', label: 'Monospaced' }
            ]}
            onChange={(v) => set({ value: v })}
          />
        </Row>
      )

    // No-arg modifiers (italic, underline, strikethrough, monospacedDigit,
    // allowsTightening) render no body — the row title carries the meaning.
    case 'italic':
    case 'underline':
    case 'strikethrough':
    case 'monospacedDigit':
      return null

    case 'allowsTightening':
      return (
        <Row label="On">
          <div className="segmented flex-1">
            <button className={m.value ? 'active' : ''} onClick={() => set({ value: true })}>On</button>
            <button className={!m.value ? 'active' : ''} onClick={() => set({ value: false })}>Off</button>
          </div>
        </Row>
      )

    default:
      return <div className="text-[10px] text-textMute">No editor for {m.type}.</div>
  }
}

// ---- chevron + small icon buttons ------------------------------------

function Chev({ open }) {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 140ms ease' }}>
      <path d="M3.5 2L7 5L3.5 8" />
    </svg>
  )
}

// ---- single modifier row ---------------------------------------------

function ModifierRow({ m, index, total, onChange, onMove, onDelete }) {
  const [open, setOpen] = useState(true)
  const def = MODIFIERS[m.type]
  if (!def) {
    return (
      <div className="border border-border rounded mb-1 px-2 py-1 text-[10px] text-textMute">
        Unknown modifier: {m.type}
      </div>
    )
  }
  return (
    <div className="border border-border rounded mb-1 bg-surface3/30">
      <div className="flex items-center gap-1 px-1.5 py-1 cursor-pointer select-none" onClick={() => setOpen(!open)}>
        <span className="text-textMute flex items-center justify-center w-3"><Chev open={open} /></span>
        <span className="flex-1 text-[10px] font-mono text-text">{def.swiftName}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onMove(index, -1) }}
          disabled={index === 0}
          className="px-1 text-[10px] text-textMute hover:text-text disabled:opacity-30"
          title="Move up"
        >▲</button>
        <button
          onClick={(e) => { e.stopPropagation(); onMove(index, +1) }}
          disabled={index === total - 1}
          className="px-1 text-[10px] text-textMute hover:text-text disabled:opacity-30"
          title="Move down"
        >▼</button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(index) }}
          className="px-1 text-[10px] text-textMute hover:text-danger"
          title="Remove"
        >×</button>
      </div>
      {open && (
        <div className="px-2 pb-1.5 pt-0.5 space-y-1">
          <ModifierBody m={m} set={(patch) => onChange(index, patch)} />
        </div>
      )}
    </div>
  )
}

// ---- add-modifier dropdown -------------------------------------------

function AddModifier({ kind, onAdd }) {
  const [open, setOpen] = useState(false)
  const allowed = getAllowedModifiers(kind)
  if (allowed.length === 0) return null

  // Group by `group` for a tidier menu.
  const groups = {}
  for (const def of allowed) {
    (groups[def.group] = groups[def.group] || []).push(def)
  }
  return (
    <div className="relative mt-1">
      <button
        className="btn w-full justify-center text-[10px]"
        onClick={() => setOpen((o) => !o)}
      >
        + Add Modifier
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 bg-surface2 border border-border rounded shadow-lg z-20 max-h-72 overflow-y-auto scrollbar">
            {Object.entries(groups).map(([groupName, defs]) => (
              <div key={groupName}>
                <div className="px-2 pt-1.5 pb-0.5 text-[9px] uppercase tracking-wider text-textMute">{groupName}</div>
                {defs.map((def) => (
                  <button
                    key={def.type}
                    className="w-full text-left px-2 py-1 text-[10px] font-mono hover:bg-surface3"
                    onClick={() => { onAdd(def.type); setOpen(false) }}
                  >
                    {def.swiftName}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---- top-level component ---------------------------------------------

export function ModifierStack({ item, updateItem }) {
  const kind = viewKind(item)
  const allowed = getAllowedModifiers(kind)
  // Don't render the section at all for view kinds with no allowed
  // modifiers (3D primitives, presentation panels) — keeps the inspector
  // honest about what SwiftUI accepts.
  if (allowed.length === 0) return null

  const list = Array.isArray(item.modifiers) ? item.modifiers : []

  const replace = (next) => updateItem(item.id, { modifiers: next })

  const onChange = (i, patch) => {
    const next = list.slice()
    next[i] = { ...next[i], ...patch }
    replace(next)
  }
  const onMove = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const next = list.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    replace(next)
  }
  const onDelete = (i) => {
    const next = list.slice()
    next.splice(i, 1)
    replace(next)
  }
  const onAdd = (type) => {
    replace([...list, makeModifier(type)])
  }

  return (
    <Section title="Modifiers" defaultOpen={true}>
      {list.length === 0 && (
        <div className="text-[10px] text-textMute leading-relaxed mb-1">
          No modifiers. Order matches the SwiftUI chain — top is applied first.
        </div>
      )}
      {list.map((m, i) => (
        <ModifierRow
          key={m.id || i}
          m={m}
          index={i}
          total={list.length}
          onChange={onChange}
          onMove={onMove}
          onDelete={onDelete}
        />
      ))}
      <AddModifier kind={kind} onAdd={onAdd} />
    </Section>
  )
}
