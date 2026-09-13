// Low-level inspector primitives — fields, sliders, color picker, segmented
// containers, section accordions. Reused across every per-domain inspector.

import { useState, useRef, useCallback } from 'react'
import {
  SCENE_COLOR_GROUPS,
  SCENE_COLOR_LABELS,
  STACK_TYPES,
  MATERIAL_LIBRARY,
  MATERIAL_LIBRARY_VALUES,
  unitsToPt,
  ptToUnits
} from '../../appleSystem'
import { useStore } from '../../store'
import { useScrub } from './useScrub'

export function Row({ label, children, labelWidth = 56 }) {
  return (
    <div className="flex items-center gap-2">
      {label && <label className="text-textDim text-[10px] cursor-ew-resize select-none" style={{ minWidth: labelWidth }}>{label}</label>}
      <div className="flex-1 flex items-center gap-1.5 min-w-0">{children}</div>
    </div>
  )
}

// ---- Scrub-or-type input shell --------------------------------------
//
// Common shell for the numeric field types. Replaces the old pattern
// of `e.preventDefault()` on pointer-down, which blocked the input
// from focusing on click and made keyboard editing impossible. We now:
//
//   - Keep the input as a normal text field (not number) so partially-
//     typed values like "1.", "-", or "0.0" don't get clobbered by
//     the toFixed format string while the user is mid-typing.
//   - Track a local `draft` while the field is focused; render `draft`
//     instead of the formatted store value during that window so the
//     cursor doesn't jump on every keystroke.
//   - On blur (or Enter), parse the draft, validate, and commit. Esc
//     drops the draft.
//   - Pointer-down still hands off to `useScrub`. The hook itself only
//     fires onChange once the cursor has moved >3 px, so a still
//     click falls through to native focus + edit. No preventDefault
//     means the click reaches the underlying <input> normally.
function NumericShell({
  formatted,           // string the input shows when not being edited
  parse,               // (string) -> number | null   (null = invalid)
  apply,               // (number) -> void            (commit to store)
  scrubValue,          // number used as scrub start
  scrubStep,           // px-to-units sensitivity
  onScrub,             // (next) -> void
  flexClass = 'flex-1',
  suffix,
  inputType = 'text',
  inputProps = {}
}) {
  const inputRef = useRef(null)
  const [draft, setDraft] = useState(null)
  const focusedRef = useRef(false)
  const scrub = useScrub(scrubValue, onScrub, scrubStep)

  // External value changes (undo, gizmo drag, scrub) shouldn't fight a
  // user typing. While focused, we hold the draft. When focus leaves
  // we fall back to the formatted store value.
  const display = focusedRef.current && draft !== null ? draft : formatted

  return (
    <div className={`relative ${flexClass}`}>
      <input
        ref={inputRef}
        type={inputType}
        value={display}
        inputMode="decimal"
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => {
          focusedRef.current = true
          setDraft(formatted)
          // Select all so the user can replace the value with one keystroke.
          requestAnimationFrame(() => inputRef.current?.select?.())
        }}
        onBlur={() => {
          focusedRef.current = false
          if (draft !== null) {
            const n = parse(draft)
            if (n !== null) apply(n)
          }
          setDraft(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.target.blur() }
          else if (e.key === 'Escape') { setDraft(null); e.target.blur() }
        }}
        onPointerDown={(e) => {
          // Hand the gesture to the scrub hook; if the cursor moves,
          // it takes over. If not, the native click flow focuses the
          // input and the user can type.
          scrub.onPointerDown(e)
        }}
        className="field cursor-ew-resize"
        {...inputProps}
      />
      {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-textMute pointer-events-none">{suffix}</span>}
    </div>
  )
}

export function NumField({ value, step = 0.05, onChange, suffix }) {
  const v = Number.isFinite(value) ? value : 0
  return (
    <NumericShell
      formatted={v.toFixed(2)}
      parse={(raw) => {
        const n = parseFloat(raw)
        return Number.isFinite(n) ? n : null
      }}
      apply={(n) => onChange(parseFloat(n.toFixed(4)))}
      scrubValue={v}
      scrubStep={step}
      onScrub={(next) => onChange(parseFloat(Number(next).toFixed(4)))}
      suffix={suffix}
    />
  )
}

export function PtField({ value, onChange }) {
  const displayed = unitsToPt(value)
  return (
    <NumericShell
      formatted={String(displayed)}
      parse={(raw) => {
        const n = parseFloat(raw)
        return Number.isFinite(n) ? Math.round(n) : null
      }}
      apply={(n) => onChange(ptToUnits(n))}
      scrubValue={displayed}
      scrubStep={1}
      onScrub={(next) => onChange(ptToUnits(Math.round(next)))}
      suffix="pt"
    />
  )
}

export function IntField({ value, min, max, onChange }) {
  const clamped = useCallback((v) => {
    let n = Math.round(v)
    if (min != null) n = Math.max(min, n)
    if (max != null) n = Math.min(max, n)
    onChange(n)
  }, [onChange, min, max])
  return (
    <NumericShell
      flexClass="flex-1"
      formatted={String(value)}
      parse={(raw) => {
        const n = parseInt(raw, 10)
        return Number.isFinite(n) ? n : null
      }}
      apply={clamped}
      scrubValue={value}
      scrubStep={1}
      onScrub={clamped}
      inputProps={{ min, max }}
    />
  )
}

export function Slider({ value, min, max, step, onChange, suffix }) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-accent"
      />
      <span className="text-[9px] text-textMute font-mono w-10 text-right">
        {Number(value).toFixed(2)}{suffix || ''}
      </span>
    </div>
  )
}

export function ColorRow({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 flex-1">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 rounded bg-surface3 border border-border cursor-pointer flex-shrink-0"
      />
      <span className="text-[9px] text-textMute font-mono truncate">{value}</span>
    </div>
  )
}

export function Select({ value, options, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="field flex-1 cursor-pointer"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// SVG chevron — rotates 90\u00b0 when the section opens. Replacing the prior
// \u25b8 / \u25be glyphs gives sub-pixel alignment and a single rotation
// transform we can animate cleanly.
function SectionChevron({ open }) {
  return (
    <svg
      width="9" height="9" viewBox="0 0 10 10"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      style={{
        transform: open ? 'rotate(90deg)' : 'none',
        transition: 'transform 140ms ease'
      }}
    >
      <path d="M3.5 2L7 5L3.5 8" />
    </svg>
  )
}

// Section state is persisted in the zustand store keyed by `title` so
// that collapsing/expanding a section sticks across selection changes
// — without this every click on a different layer remounts the
// PropertiesPanel and resets local useState back to defaultOpen,
// which the user reads as "the inspector lost my place".
export function Section({ title, children, defaultOpen = false, action }) {
  const stored = useStore((s) => s.inspectorSectionOpen?.[title])
  const setStored = useStore((s) => s.setInspectorSectionOpen)
  const open = stored === undefined ? defaultOpen : stored
  const toggle = () => setStored(title, !open)
  return (
    <div className="border-b border-border">
      <div className="section-header" onClick={toggle}>
        <span className="text-textMute flex items-center justify-center w-3">
          <SectionChevron open={open} />
        </span>
        <span className="flex-1">{title}</span>
        {action && <span onClick={(e) => e.stopPropagation()}>{action}</span>}
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  )
}

// Color picker grouped by category — mirrors the visionOS Figma kit's
// "Color styles" panel (Text / Controls / Views / Windows / Separators /
// Colors). Editing a token's actual hex lives in Scene → Colors; picking
// it here is a *reference* — the panel tracks whatever value the scene
// palette currently holds for that token.
export function SemanticColorPicker({ token, onChange }) {
  return (
    <select
      value={token || ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="field flex-1 cursor-pointer"
    >
      <option value="">— Custom —</option>
      {SCENE_COLOR_GROUPS.map((group) => (
        <optgroup key={group.key} label={group.label}>
          {group.tokens.map((t) => (
            <option key={t} value={t}>{SCENE_COLOR_LABELS[t] || t}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

// Unified material picker — the 24 scene materials (every Text / Controls /
// Views / Windows / Separators token, then the nine glass tiers), grouped
// exactly like Scene → Materials & Colors. Drop-in for any view that
// exposes a surface / fill material, so the same library is offered
// everywhere and a Scene-Settings edit retunes every consumer. `fallback`
// is the value shown when the stored selection isn't (or is no longer) a
// library material.
export function MaterialField({ value, onChange, fallback }) {
  const resolved = MATERIAL_LIBRARY_VALUES.includes(value)
    ? value
    : (fallback && MATERIAL_LIBRARY_VALUES.includes(fallback) ? fallback : MATERIAL_LIBRARY_VALUES[0])
  // Rebuild the optgroups from the library descriptors, preserving the
  // library's group order (Text → Controls → Views → Windows → Separators
  // → Materials).
  const groups = []
  for (const m of MATERIAL_LIBRARY) {
    let g = groups.find((x) => x.label === m.group)
    if (!g) { g = { label: m.group, items: [] }; groups.push(g) }
    g.items.push(m)
  }
  return (
    <select
      value={resolved}
      onChange={(e) => onChange(e.target.value)}
      className="field flex-1 cursor-pointer"
    >
      {groups.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

export function StackAlignmentPicker({ stackType, value, onChange }) {
  const alignments = STACK_TYPES[stackType]?.alignments || ['center']
  return (
    <Select
      value={value}
      options={alignments.map((a) => ({ value: a, label: a }))}
      onChange={onChange}
    />
  )
}

export function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`tab-strip-btn ${active ? 'active' : ''}`}
    >
      {children}
    </button>
  )
}
