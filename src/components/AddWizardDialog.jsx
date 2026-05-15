// Modal dialog that prompts for a compound component's structural
// properties before it gets dropped into the scene. Mirrors Apple's
// "Insert instance" panel in their visionOS Figma kit.
//
// Styling matches the app chrome (body #181818, fields #262626, borders
// #2e2e2e) rather than a separate zinc palette so the dialog reads as
// part of the editor rather than a Tailwind cards-in-cards modal. List
// schemas can opt into `inlineRow: true` to render each item on a
// single row (label · field · × delete) instead of an expanding card —
// used for the Sidebar wizard's Groups list per user spec.

import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { WIZARDS } from '../wizards/registry'

const APP_BG       = '#181818'
const FIELD_BG     = '#262626'
const FIELD_BORDER = '#2e2e2e'
const TEXT_MAIN    = '#e4e4e4'
const TEXT_MUTED   = '#8e8e93'

const fieldDefault = (field, scopeDefaults) => {
  if (scopeDefaults && Object.prototype.hasOwnProperty.call(scopeDefaults, field.id)) {
    return scopeDefaults[field.id]
  }
  if (Object.prototype.hasOwnProperty.call(field, 'default')) return field.default
  switch (field.type) {
    case 'boolean': return false
    case 'number':  return field.min ?? 0
    case 'list':    return []
    case 'select':  return field.options?.[0]?.value
    default:        return ''
  }
}

function buildEmptyItem(itemFields) {
  const obj = {}
  for (const f of itemFields || []) {
    if (f.type === 'list') {
      obj[f.id] = [buildEmptyItem(f.itemFields)]
    } else {
      obj[f.id] = fieldDefault(f, null)
    }
  }
  return obj
}

// ---- Field renderers ---------------------------------------------------

const labelStyle = {
  display: 'block',
  fontSize: 10, fontWeight: 600,
  letterSpacing: 0.6, textTransform: 'uppercase',
  color: TEXT_MUTED, marginBottom: 4
}

const inputStyle = {
  width: '100%', height: 28,
  padding: '0 8px',
  background: FIELD_BG, border: `1px solid ${FIELD_BORDER}`,
  borderRadius: 5,
  color: TEXT_MAIN,
  fontSize: 12, outline: 'none'
}

function TextField({ label, value, onChange, width }) {
  return (
    <label style={{ display: 'block', width: width || '100%' }}>
      {label && <span style={labelStyle}>{label}</span>}
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  )
}

function NumberField({ label, value, onChange, min, max, step, width, compact = false }) {
  return (
    <label style={{ display: compact ? 'inline-flex' : 'block', alignItems: 'center', gap: 6, width: width || (compact ? 'auto' : '100%') }}>
      {label && <span style={compact ? { ...labelStyle, marginBottom: 0 } : labelStyle}>{label}</span>}
      <input
        type="number"
        value={value ?? ''}
        min={min} max={max} step={step ?? 1}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        style={{ ...inputStyle, width: compact ? 64 : '100%' }}
      />
    </label>
  )
}

// Toggle — Apple-style pill. Pixel-exact sizing so the knob always sits
// 2pt inset from each edge regardless of how Tailwind resolves classes
// on the user's system.
function BooleanField({ label, value, onChange }) {
  const PILL_W = 36, PILL_H = 20, KNOB = 16, INSET = 2
  return (
    <label
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', userSelect: 'none', padding: '4px 0' }}
      onClick={(e) => { e.preventDefault(); onChange(!value) }}
    >
      <span style={{ fontSize: 12, color: TEXT_MAIN }}>{label}</span>
      <span
        style={{
          position: 'relative',
          width: PILL_W, height: PILL_H,
          borderRadius: PILL_H / 2,
          background: value ? '#a1a1aa' : '#3f3f46',
          transition: 'background-color 120ms ease',
          flexShrink: 0
        }}
        aria-pressed={value}
        role="switch"
      >
        <span
          style={{
            position: 'absolute',
            top: INSET,
            left: value ? PILL_W - KNOB - INSET : INSET,
            width: KNOB, height: KNOB,
            borderRadius: KNOB / 2,
            background: '#ffffff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            transition: 'left 120ms ease'
          }}
        />
      </span>
    </label>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label style={{ display: 'block' }}>
      {label && <span style={labelStyle}>{label}</span>}
      <select
        value={value ?? options?.[0]?.value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}

// Compact × button for removing a list item.
function RemoveIconButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Remove"
      style={{
        width: 20, height: 20, padding: 0,
        background: 'transparent', border: 'none',
        color: TEXT_MUTED, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 4, flexShrink: 0
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#ff453a'; e.currentTarget.style.background = 'rgba(255,69,58,0.12)' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_MUTED; e.currentTarget.style.background = 'transparent' }}
    >
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  )
}

// List field — repeating group with two render modes:
//   1. `inlineRow: true` (set on the schema field): each item is one
//      flat row "<Item Label NN>  <single-field input>  ×". No
//      collapsible card, no inner box. Used by the Sidebar wizard's
//      Groups list per user spec.
//   2. default: each item is a flat row with its sub-fields stacked
//      underneath. No nested card chrome — just dividers.
function ListField({ field, value, onChange }) {
  const items = Array.isArray(value) ? value : []
  const canAdd    = items.length < (field.maxItems ?? 100)
  const canRemove = items.length > (field.minItems ?? 0)
  const updateItem = (idx, next) => {
    const out = items.slice()
    out[idx] = next
    onChange(out)
  }
  const removeItem = (idx) => {
    const out = items.slice()
    out.splice(idx, 1)
    onChange(out)
  }
  const addItem = () => {
    onChange([...items, buildEmptyItem(field.itemFields)])
  }

  const inline = field.inlineRow === true && (field.itemFields || []).length === 1

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={labelStyle}>{field.label}</span>
        <span style={{ fontSize: 11, color: TEXT_MUTED }}>{items.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, idx) => {
          const labelText = `${field.itemLabel || 'Item'} ${String(idx + 1).padStart(2, '0')}`
          if (inline) {
            const f = field.itemFields[0]
            const v = item[f.id] ?? fieldDefault(f, null)
            // Flat row — no card chrome, no border. Per user spec: just
            // a label, the single field, and the × button on one line.
            return (
              <div
                key={idx}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '4px 2px'
                }}
              >
                <span style={{ flex: 1, fontSize: 12, color: TEXT_MAIN, fontWeight: 500 }}>{labelText}</span>
                {f.type === 'number' && (
                  <NumberField compact label={f.label} value={v} min={f.min} max={f.max} step={f.step}
                    onChange={(x) => updateItem(idx, { ...item, [f.id]: x })} />
                )}
                {f.type === 'text' && (
                  <input
                    type="text"
                    value={v ?? ''}
                    onChange={(e) => updateItem(idx, { ...item, [f.id]: e.target.value })}
                    style={{ ...inputStyle, width: 120, height: 24 }}
                  />
                )}
                {canRemove && <RemoveIconButton onClick={() => removeItem(idx)} />}
              </div>
            )
          }
          // Non-inline list item — flat row, no inner card chrome
          return (
            <div
              key={idx}
              style={{
                padding: '8px 10px',
                background: FIELD_BG, border: `1px solid ${FIELD_BORDER}`,
                borderRadius: 5
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: TEXT_MAIN, fontWeight: 500 }}>{labelText}</span>
                {canRemove && <RemoveIconButton onClick={() => removeItem(idx)} />}
              </div>
              <ItemFieldset
                fields={field.itemFields || []}
                values={item}
                onChange={(next) => updateItem(idx, next)}
              />
            </div>
          )
        })}
      </div>
      {canAdd && (
        <button
          type="button"
          onClick={addItem}
          style={{
            marginTop: 8, width: '100%', height: 26,
            background: 'transparent',
            border: `1px dashed ${FIELD_BORDER}`,
            borderRadius: 5,
            color: TEXT_MUTED, fontSize: 11,
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_MAIN; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_MUTED; e.currentTarget.style.background = 'transparent' }}
        >
          + Add {field.itemLabel || 'Item'}
        </button>
      )}
    </div>
  )
}

function ItemFieldset({ fields, values, onChange }) {
  const setField = (id, v) => onChange({ ...values, [id]: v })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {fields.map((f) => {
        if (f.dependsOn && !values[f.dependsOn]) return null
        const v = values[f.id] ?? fieldDefault(f, null)
        if (f.type === 'text')    return <TextField    key={f.id} label={f.label} value={v}                onChange={(x) => setField(f.id, x)} />
        if (f.type === 'number')  return <NumberField  key={f.id} label={f.label} value={v} min={f.min} max={f.max} step={f.step} onChange={(x) => setField(f.id, x)} />
        if (f.type === 'boolean') return <BooleanField key={f.id} label={f.label} value={v}                onChange={(x) => setField(f.id, x)} />
        if (f.type === 'select')  return <SelectField  key={f.id} label={f.label} value={v} options={f.options} onChange={(x) => setField(f.id, x)} />
        if (f.type === 'list')    return <ListField    key={f.id} field={f}       value={v}                onChange={(x) => setField(f.id, x)} />
        return null
      })}
    </div>
  )
}

export default function AddWizardDialog() {
  const pending = useStore((s) => s.pendingWizard)
  const cancel  = useStore((s) => s.cancelWizard)
  const submit  = useStore((s) => s.submitWizard)

  const [values, setValues] = useState(null)

  useEffect(() => {
    if (pending) setValues(pending.values)
    else setValues(null)
  }, [pending])

  useEffect(() => {
    if (!pending) return
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cancel() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(values) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, values, cancel, submit])

  const spec = useMemo(() => pending ? WIZARDS[pending.kind] : null, [pending])
  if (!pending || !spec || !values) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)'
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) cancel() }}
    >
      <div
        style={{
          width: 420, maxHeight: '85vh',
          background: APP_BG,
          border: `1px solid ${FIELD_BORDER}`,
          borderRadius: 8,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.55)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '14px 18px 10px', borderBottom: `1px solid ${FIELD_BORDER}` }}>
          <div style={{ color: TEXT_MAIN, fontWeight: 600, fontSize: 14 }}>{spec.title}</div>
          {spec.description && (
            <div style={{ color: TEXT_MUTED, fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>{spec.description}</div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
          <ItemFieldset
            fields={spec.fields}
            values={values}
            onChange={setValues}
          />
        </div>
        <div style={{
          padding: '10px 18px',
          borderTop: `1px solid ${FIELD_BORDER}`,
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8
        }}>
          <button
            type="button"
            onClick={cancel}
            style={{
              height: 28, padding: '0 12px', borderRadius: 5,
              background: 'transparent', border: 'none',
              color: TEXT_MAIN, fontSize: 12, cursor: 'pointer'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = FIELD_BG }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >Cancel</button>
          <button
            type="button"
            onClick={() => submit(values)}
            title="Insert (⌘↵)"
            style={{
              height: 28, padding: '0 14px', borderRadius: 5,
              background: '#f4f4f5', border: 'none',
              color: '#0a0a0a', fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}
          >Insert</button>
        </div>
      </div>
    </div>
  )
}
