// Low-level inspector primitives — fields, sliders, color picker, segmented
// containers, section accordions. Reused across every per-domain inspector.

import { useState, useRef, useCallback } from 'react'
import {
  SEMANTIC_COLOR_ORDER,
  STACK_TYPES,
  unitsToPt, ptToUnits
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

export function NumField({ value, step = 0.05, onChange, suffix }) {
  const scrub = useScrub(value, (v) => onChange(parseFloat(v.toFixed(4))), step)
  const inputRef = useRef(null)
  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="number"
        step={step}
        value={Number(value).toFixed(2)}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        onPointerDown={(e) => {
          scrub.onPointerDown(e)
          e.preventDefault()
          const listener = () => {
            if (!scrub.didMove()) inputRef.current?.focus()
            window.removeEventListener('pointerup', listener)
          }
          window.addEventListener('pointerup', listener)
        }}
        className="field cursor-ew-resize"
      />
      {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-textMute pointer-events-none">{suffix}</span>}
    </div>
  )
}

export function PtField({ value, onChange }) {
  const displayed = unitsToPt(value)
  const scrub = useScrub(displayed, (v) => onChange(ptToUnits(Math.round(v))), 1)
  const inputRef = useRef(null)
  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="number"
        step={1}
        value={displayed}
        onChange={(e) => onChange(ptToUnits(parseFloat(e.target.value) || 0))}
        onPointerDown={(e) => {
          scrub.onPointerDown(e)
          e.preventDefault()
          const listener = () => {
            if (!scrub.didMove()) inputRef.current?.focus()
            window.removeEventListener('pointerup', listener)
          }
          window.addEventListener('pointerup', listener)
        }}
        className="field cursor-ew-resize"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-textMute pointer-events-none">pt</span>
    </div>
  )
}

export function IntField({ value, min, max, onChange }) {
  const clamped = useCallback((v) => {
    let n = Math.round(v)
    if (min != null) n = Math.max(min, n)
    if (max != null) n = Math.min(max, n)
    onChange(n)
  }, [onChange, min, max])
  const scrub = useScrub(value, clamped, 1)
  const inputRef = useRef(null)
  return (
    <input
      ref={inputRef}
      type="number"
      step={1}
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
      onPointerDown={(e) => {
        scrub.onPointerDown(e)
        e.preventDefault()
        const listener = () => {
          if (!scrub.didMove()) inputRef.current?.focus()
          window.removeEventListener('pointerup', listener)
        }
        window.addEventListener('pointerup', listener)
      }}
      className="field flex-1 cursor-ew-resize"
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

export function SemanticColorPicker({ token, onChange }) {
  return (
    <Select
      value={token || ''}
      options={[
        { value: '', label: '— Custom —' },
        ...SEMANTIC_COLOR_ORDER.map((t) => ({ value: t, label: t }))
      ]}
      onChange={(v) => onChange(v || null)}
    />
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
