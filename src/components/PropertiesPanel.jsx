import { useState, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { VStackIcon, HStackIcon, ZStackIcon } from './icons'
import {
  TEXT_STYLES, TEXT_STYLE_ORDER,
  WINDOW_PRESETS, VOLUME_PRESETS,
  SEMANTIC_COLOR_ORDER, resolveSemantic,
  STACK_TYPES, BUTTON_STYLES,
  MATERIALS, MATERIAL_ORDER,
  TOGGLE_STYLES, PICKER_STYLES, LABEL_STYLES, TEXTFIELD_STYLES,
  CONTROL_SIZES, TABLE_STYLES,
  SF_SYMBOLS,
  SYMBOL_RENDERING_MODES, SYMBOL_VARIANTS,
  ANIMATION_CURVES, TRANSITION_TYPES,
  IMMERSION_STYLES, HOVER_EFFECTS, GESTURE_TYPES, WINDOW_RESIZABILITY,
  ACCESSIBILITY_TRAITS,
  unitsToPt, ptToUnits
} from '../appleSystem'
import SymbolPicker from './SymbolPicker'

// ---- Drag-to-scrub hook (Blender-style) ----
// Click-and-drag on the label or input to scrub the value. If the pointer
// doesn't move more than 3 px, the event falls through as a normal click
// so the user can still type.

function useScrub(value, onChange, sensitivity = 1) {
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

// ---- primitives ----

function Row({ label, children, labelWidth = 56 }) {
  return (
    <div className="flex items-center gap-2">
      {label && <label className="text-textDim text-[10px] cursor-ew-resize select-none" style={{ minWidth: labelWidth }}>{label}</label>}
      <div className="flex-1 flex items-center gap-1.5 min-w-0">{children}</div>
    </div>
  )
}

function NumField({ value, step = 0.05, onChange, suffix }) {
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
          // Prevent focusing the input during scrub — only focus on click.
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

function PtField({ value, onChange }) {
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

function IntField({ value, min, max, onChange }) {
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

function Slider({ value, min, max, step, onChange, suffix }) {
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

function ColorRow({ value, onChange }) {
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

function Select({ value, options, onChange }) {
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

function Section({ title, children, defaultOpen = true, action }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-border">
      <div className="section-header" onClick={() => setOpen(!open)}>
        <span className="text-[8px] text-textMute">{open ? '▾' : '▸'}</span>
        <span className="flex-1">{title}</span>
        {action && <span onClick={(e) => e.stopPropagation()}>{action}</span>}
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  )
}

function SemanticColorPicker({ token, onChange }) {
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

function StackAlignmentPicker({ stackType, value, onChange }) {
  const alignments = STACK_TYPES[stackType]?.alignments || ['center']
  return (
    <Select
      value={value}
      options={alignments.map((a) => ({ value: a, label: a }))}
      onChange={onChange}
    />
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 h-[34px] text-[10px] uppercase tracking-wider font-semibold transition-colors border-b ${
        active
          ? 'text-text border-accent bg-surface2'
          : 'text-textMute border-transparent hover:text-text'
      }`}
    >
      {children}
    </button>
  )
}

// ---- Universal Modifiers (shared by Window, Stack, Panel) ----

function UniversalModifiers({ item, updateItem }) {
  const m = item.modifiers || {}
  const upd = (patch) => updateItem(item.id, { modifiers: { ...m, ...patch } })
  return (
    <Section title="Modifiers" defaultOpen={false}>
      <div className="text-[9px] text-textMute uppercase tracking-wider mb-1">.opacity() · .disabled() · .clipShape()</div>
      <Row label="Opacity">
        <Slider value={m.opacity ?? 1} min={0} max={1} step={0.01} onChange={(v) => upd({ opacity: v })} />
      </Row>
      <Row label="Disabled">
        <div className="segmented flex-1">
          <button className={m.disabled ? 'active' : ''} onClick={() => upd({ disabled: true })}>On</button>
          <button className={!m.disabled ? 'active' : ''} onClick={() => upd({ disabled: false })}>Off</button>
        </div>
      </Row>
      <Row label="Clip">
        <Select
          value={m.clipShape || 'none'}
          options={[
            { value: 'none',        label: 'None' },
            { value: 'circle',      label: 'Circle' },
            { value: 'capsule',     label: 'Capsule' },
            { value: 'roundedRect', label: 'Rounded Rect' }
          ]}
          onChange={(v) => upd({ clipShape: v })}
        />
      </Row>

      <div className="text-[9px] text-textMute uppercase tracking-wider mt-3 mb-1">.shadow()</div>
      <Row label="Color"><ColorRow value={m.shadowColor || '#000000'} onChange={(v) => upd({ shadowColor: v })} /></Row>
      <Row label="Radius"><IntField value={m.shadowRadius ?? 0} min={0} onChange={(v) => upd({ shadowRadius: v })} /></Row>
      <Row label="X / Y">
        <IntField value={m.shadowX ?? 0} onChange={(v) => upd({ shadowX: v })} />
        <IntField value={m.shadowY ?? 0} onChange={(v) => upd({ shadowY: v })} />
      </Row>

      <div className="text-[9px] text-textMute uppercase tracking-wider mt-3 mb-1">.border()</div>
      <Row label="Color"><ColorRow value={m.borderColor || '#000000'} onChange={(v) => upd({ borderColor: v })} /></Row>
      <Row label="Width"><PtField value={m.borderWidth ?? 0} onChange={(v) => upd({ borderWidth: Math.max(0, v) })} /></Row>

      <div className="text-[9px] text-textMute uppercase tracking-wider mt-3 mb-1">.rotationEffect() · .scaleEffect() · .offset()</div>
      <Row label="Rotation"><NumField value={m.rotation ?? 0} step={1} onChange={(v) => upd({ rotation: v })} suffix="°" /></Row>
      <Row label="Scale X"><NumField value={m.scaleX ?? 1} step={0.05} onChange={(v) => upd({ scaleX: v })} /></Row>
      <Row label="Scale Y"><NumField value={m.scaleY ?? 1} step={0.05} onChange={(v) => upd({ scaleY: v })} /></Row>
      <Row label="Offset X"><IntField value={m.offsetX ?? 0} onChange={(v) => upd({ offsetX: v })} /><span className="text-[9px] text-textMute">pt</span></Row>
      <Row label="Offset Y"><IntField value={m.offsetY ?? 0} onChange={(v) => upd({ offsetY: v })} /><span className="text-[9px] text-textMute">pt</span></Row>
    </Section>
  )
}

// ---- main ----

export default function PropertiesPanel({ width = 280 }) {
  const [tab, setTab] = useState('object')
  const selectedId = useStore((s) => s.selectedId)
  const item = useStore((s) => s.items.find((p) => p.id === selectedId))
  const scene = useStore((s) => s.scene)
  const updateScene = useStore((s) => s.updateScene)

  return (
    <div
      style={{ width }}
      className="bg-surface border-l border-border flex flex-col h-full flex-shrink-0"
    >
      <div className="flex">
        <TabButton active={tab === 'object'} onClick={() => setTab('object')}>Object</TabButton>
        <TabButton active={tab === 'scene'} onClick={() => setTab('scene')}>Scene</TabButton>
      </div>

      {tab === 'object'
        ? !item
          ? <Empty />
          : item.type === 'window'   ? <WindowProps item={item} />
          : item.type === 'stack'    ? <StackProps item={item} />
          : <PanelProps item={item} scene={scene} />
        : <SceneProps scene={scene} updateScene={updateScene} />}
    </div>
  )
}

function Empty() {
  return (
    <div className="p-6 text-center text-textMute text-[11px] leading-relaxed">
      Select an item in the canvas or layers list to edit its properties.
    </div>
  )
}

// ---- window ----

function WindowProps({ item }) {
  const updateItem = useStore((s) => s.updateItem)
  const renameItem = useStore((s) => s.renameItem)
  return (
    <div className="flex-1 overflow-y-auto scrollbar">
      <Section title="Window">
        <Row label="Name">
          <input value={item.name} onChange={(e) => renameItem(item.id, e.target.value)} className="field flex-1" />
        </Row>
      </Section>
      <Section title="Size">
        <Row label="Width"><PtField value={item.size[0]} onChange={(v) => updateItem(item.id, { size: [v, item.size[1]] })} /></Row>
        <Row label="Height"><PtField value={item.size[1]} onChange={(v) => updateItem(item.id, { size: [item.size[0], v] })} /></Row>
        <Row label="Radius"><PtField value={item.cornerRadius} onChange={(v) => updateItem(item.id, { cornerRadius: v })} /></Row>
      </Section>
      <Section title="Position">
        <Row label="X"><NumField value={item.position[0]} onChange={(v) => updateItem(item.id, { position: [v, item.position[1], item.position[2]] })} /></Row>
        <Row label="Y"><NumField value={item.position[1]} onChange={(v) => updateItem(item.id, { position: [item.position[0], v, item.position[2]] })} /></Row>
        <Row label="Z"><NumField value={item.position[2]} onChange={(v) => updateItem(item.id, { position: [item.position[0], item.position[1], v] })} /></Row>
      </Section>
      <Section title="Material">
        <Row label="Glass">
          <Select
            value={item.material || 'regular'}
            options={MATERIAL_ORDER.map((k) => ({ value: k, label: `${MATERIALS[k].label} · ${Math.round(MATERIALS[k].opacity * 100)}%` }))}
            onChange={(v) => updateItem(item.id, { material: v })}
          />
        </Row>
        <Row label="Tint">
          <SemanticColorPicker
            token={item.colorToken}
            onChange={(t) => updateItem(item.id, { colorToken: t })}
          />
        </Row>
        <Row label="Fallback">
          <ColorRow value={item.color} onChange={(v) => updateItem(item.id, { color: v, colorToken: null })} />
        </Row>
      </Section>

      {/* Phase 10 — visionOS Spatial */}
      <Section title="Spatial" defaultOpen={false}>
        <Row label="Immersion"><Select value={item.spatial?.immersionStyle || 'mixed'} options={IMMERSION_STYLES} onChange={(v) => updateItem(item.id, { spatial: { ...item.spatial, immersionStyle: v } })} /></Row>
        <Row label="Hover"><Select value={item.spatial?.hoverEffect || 'automatic'} options={HOVER_EFFECTS} onChange={(v) => updateItem(item.id, { spatial: { ...item.spatial, hoverEffect: v } })} /></Row>
        <Row label="Resize"><Select value={item.spatial?.windowResizability || 'automatic'} options={WINDOW_RESIZABILITY} onChange={(v) => updateItem(item.id, { spatial: { ...item.spatial, windowResizability: v } })} /></Row>
        <div className="text-[9px] text-textMute uppercase tracking-wider mt-2">Gestures</div>
        <div className="flex flex-wrap gap-1">
          {GESTURE_TYPES.map((g) => {
            const gestures = item.spatial?.gestures || []
            const active = gestures.includes(g.value)
            return (
              <button
                key={g.value}
                onClick={() => {
                  const next = active ? gestures.filter((x) => x !== g.value) : [...gestures, g.value]
                  updateItem(item.id, { spatial: { ...item.spatial, gestures: next } })
                }}
                className={`px-2 py-0.5 text-[9px] rounded border transition-colors ${
                  active ? 'bg-accent border-accent text-white' : 'bg-surface3 border-border text-textDim hover:text-text'
                }`}
              >
                {g.label}
              </button>
            )
          })}
        </div>
      </Section>

      {/* Chrome — ornament wizards (per-window, not per-scene) */}
      <Section title="Ornaments">
        <div className="text-[10px] text-textMute mb-1">
          Attach .ornament() views to this window's edges.
        </div>
        <NavBarWizard />
        <ToolbarWizard />
        <OrnamentWizards />
      </Section>

      <Section title="Environment" defaultOpen={false}>
        <Row label="Font"><Select value={item.environment?.font || ''} options={[{ value: '', label: '— Inherit —' }, ...TEXT_STYLE_ORDER.map((k) => ({ value: k, label: TEXT_STYLES[k].label }))]} onChange={(v) => updateItem(item.id, { environment: { ...item.environment, font: v || null } })} /></Row>
        <Row label="Foreground"><SemanticColorPicker token={item.environment?.foregroundStyle} onChange={(t) => updateItem(item.id, { environment: { ...item.environment, foregroundStyle: t } })} /></Row>
        <Row label="Direction">
          <div className="segmented flex-1">
            <button className={(item.environment?.layoutDirection || 'leftToRight') === 'leftToRight' ? 'active' : ''} onClick={() => updateItem(item.id, { environment: { ...item.environment, layoutDirection: 'leftToRight' } })}>LTR</button>
            <button className={(item.environment?.layoutDirection) === 'rightToLeft' ? 'active' : ''} onClick={() => updateItem(item.id, { environment: { ...item.environment, layoutDirection: 'rightToLeft' } })}>RTL</button>
          </div>
        </Row>
        <Row label="Locale"><input value={item.environment?.locale || ''} onChange={(e) => updateItem(item.id, { environment: { ...item.environment, locale: e.target.value } })} className="field flex-1" placeholder="en-US" /></Row>
      </Section>

      <UniversalModifiers item={item} updateItem={updateItem} />
    </div>
  )
}

// ---- stack ----

function StackProps({ item }) {
  const updateItem = useStore((s) => s.updateItem)
  const renameItem = useStore((s) => s.renameItem)
  return (
    <div className="flex-1 overflow-y-auto scrollbar">
      <Section title="Stack">
        <Row label="Name">
          <input value={item.name} onChange={(e) => renameItem(item.id, e.target.value)} className="field flex-1" />
        </Row>
        <Row label="Kind">
          <div className="segmented flex-1">
            <button
              className={item.stackType === 'vstack' ? 'active' : ''}
              onClick={() => updateItem(item.id, { stackType: 'vstack', alignment: 'center' })}
            ><VStackIcon /> VStack</button>
            <button
              className={item.stackType === 'hstack' ? 'active' : ''}
              onClick={() => updateItem(item.id, { stackType: 'hstack', alignment: 'center' })}
            ><HStackIcon /> HStack</button>
            <button
              className={item.stackType === 'zstack' ? 'active' : ''}
              onClick={() => updateItem(item.id, { stackType: 'zstack', alignment: 'center' })}
            ><ZStackIcon /> ZStack</button>
          </div>
        </Row>
      </Section>

      <Section title="Layout">
        <Row label="Align">
          <StackAlignmentPicker
            stackType={item.stackType}
            value={item.alignment}
            onChange={(v) => updateItem(item.id, { alignment: v })}
          />
        </Row>
        {item.stackType !== 'zstack' && (
          <Row label="Spacing">
            <IntField value={item.spacing} onChange={(v) => updateItem(item.id, { spacing: v })} />
            <span className="text-[9px] text-textMute">pt</span>
          </Row>
        )}
        <Row label="Padding">
          <IntField value={item.paddingEdges ? -1 : item.padding} onChange={(v) => updateItem(item.id, { padding: v, paddingEdges: null })} />
          <span className="text-[9px] text-textMute">pt</span>
          <button
            className={`btn btn-ghost text-[9px] ${item.paddingEdges ? 'text-accent' : ''}`}
            onClick={() => {
              if (item.paddingEdges) {
                updateItem(item.id, { paddingEdges: null })
              } else {
                const p = item.padding || 0
                updateItem(item.id, { paddingEdges: { top: p, bottom: p, leading: p, trailing: p } })
              }
            }}
            title="Per-edge padding"
          >4-edge</button>
        </Row>
        {item.paddingEdges && (
          <div className="grid grid-cols-2 gap-1 mt-1">
            <Row label="Top"><IntField value={item.paddingEdges.top ?? 0} onChange={(v) => updateItem(item.id, { paddingEdges: { ...item.paddingEdges, top: v } })} /></Row>
            <Row label="Bottom"><IntField value={item.paddingEdges.bottom ?? 0} onChange={(v) => updateItem(item.id, { paddingEdges: { ...item.paddingEdges, bottom: v } })} /></Row>
            <Row label="Leading"><IntField value={item.paddingEdges.leading ?? 0} onChange={(v) => updateItem(item.id, { paddingEdges: { ...item.paddingEdges, leading: v } })} /></Row>
            <Row label="Trailing"><IntField value={item.paddingEdges.trailing ?? 0} onChange={(v) => updateItem(item.id, { paddingEdges: { ...item.paddingEdges, trailing: v } })} /></Row>
          </div>
        )}
        {item.stackType === 'grid' && (
          <Row label="Columns">
            <IntField value={item.columns || 2} min={1} max={12} onChange={(v) => updateItem(item.id, { columns: v })} />
          </Row>
        )}
        <div className="text-[10px] text-textMute leading-relaxed mt-1">
          {STACK_TYPES[item.stackType]?.description}
        </div>
      </Section>

      {item.stackType === 'section' && (
        <Section title="Section">
          <Row label="Header">
            <input value={item.sectionHeader || ''} onChange={(e) => updateItem(item.id, { sectionHeader: e.target.value })} className="field flex-1" placeholder="Section Title" />
          </Row>
          <Row label="Footer">
            <input value={item.sectionFooter || ''} onChange={(e) => updateItem(item.id, { sectionFooter: e.target.value })} className="field flex-1" placeholder="Optional footnote" />
          </Row>
        </Section>
      )}

      {item.stackType === 'disclosure' && (
        <Section title="Disclosure">
          <Row label="Label">
            <input value={item.disclosureLabel || ''} onChange={(e) => updateItem(item.id, { disclosureLabel: e.target.value })} className="field flex-1" />
          </Row>
          <Row label="Expanded">
            <div className="segmented flex-1">
              <button className={item.expanded ? 'active' : ''} onClick={() => updateItem(item.id, { expanded: true })}>Open</button>
              <button className={!item.expanded ? 'active' : ''} onClick={() => updateItem(item.id, { expanded: false })}>Closed</button>
            </div>
          </Row>
        </Section>
      )}

      {item.stackType === 'navstack' && (
        <Section title="Navigation">
          <Row label="Title">
            <input value={item.navTitle || ''} onChange={(e) => updateItem(item.id, { navTitle: e.target.value })} className="field flex-1" placeholder="Navigation Title" />
          </Row>
          <Row label="Active">
            <IntField value={item.activeChild ?? 0} min={0} onChange={(v) => updateItem(item.id, { activeChild: v })} />
          </Row>
        </Section>
      )}

      {item.stackType === 'tabview' && (
        <Section title="Navigation Stack (TabView)">
          <div className="text-[10px] text-textMute mb-2">
            Only the active Tab is visible at a time. Add Tab children in the layers panel.
          </div>
          <Row label="Active Tab">
            <IntField value={item.activeTab ?? 0} min={0} onChange={(v) => updateItem(item.id, { activeTab: v })} />
            <span className="text-[9px] text-textMute">index</span>
          </Row>
        </Section>
      )}

      {item.stackType === 'tab' && (
        <Section title="Tab">
          <Row label="Label">
            <input
              value={item.tabLabel || ''}
              onChange={(e) => updateItem(item.id, { tabLabel: e.target.value })}
              className="field flex-1"
              placeholder="Tab name"
            />
          </Row>
          <Row label="Icon">
            <input
              value={item.tabIcon || ''}
              onChange={(e) => updateItem(item.id, { tabIcon: e.target.value || null })}
              className="field flex-1"
              placeholder="SF Symbol name (e.g. star)"
            />
          </Row>
          <div className="text-[10px] text-textMute mt-1">
            Use any SF Symbol name. The parent TabView controls which tab is active.
          </div>
        </Section>
      )}

      <Section title="Frame">
        <Row label="Width">
          <div className="flex-1">
            <input
              type="number"
              step={1}
              placeholder="auto"
              value={item.fixedWidth ?? ''}
              onChange={(e) => {
                const v = e.target.value === '' ? null : parseFloat(e.target.value)
                updateItem(item.id, { fixedWidth: isNaN(v) ? null : v })
              }}
              className="field"
            />
          </div>
          <span className="text-[9px] text-textMute">pt</span>
        </Row>
        <Row label="Height">
          <div className="flex-1">
            <input
              type="number"
              step={1}
              placeholder="auto"
              value={item.fixedHeight ?? ''}
              onChange={(e) => {
                const v = e.target.value === '' ? null : parseFloat(e.target.value)
                updateItem(item.id, { fixedHeight: isNaN(v) ? null : v })
              }}
              className="field"
            />
          </div>
          <span className="text-[9px] text-textMute">pt</span>
        </Row>
      </Section>

      <Section title=".ornament()">
        <div className="text-[9px] text-textMute mb-1">attachmentAnchor — which edge of the window</div>
        <Row label="Anchor">
          <Select
            value={item.ornament || ''}
            options={[
              { value: '',                label: '— None —' },
              { value: 'leading',         label: '.scene(.leading)' },
              { value: 'trailing',        label: '.scene(.trailing)' },
              { value: 'top',             label: '.scene(.top)' },
              { value: 'bottom',          label: '.scene(.bottom)' },
              { value: 'topLeading',      label: '.scene(.topLeading)' },
              { value: 'topTrailing',     label: '.scene(.topTrailing)' },
              { value: 'bottomLeading',   label: '.scene(.bottomLeading)' },
              { value: 'bottomTrailing',  label: '.scene(.bottomTrailing)' },
              { value: 'center',          label: '.scene(.center)' }
            ]}
            onChange={(v) => updateItem(item.id, { ornament: v || null })}
          />
        </Row>
        <div className="text-[9px] text-textMute mt-2 mb-1">contentAlignment — ornament's own alignment</div>
        <Row label="Alignment">
          <Select
            value={item.ornamentContentAlignment || 'center'}
            options={[
              { value: 'center',        label: '.center' },
              { value: 'leading',       label: '.leading' },
              { value: 'trailing',      label: '.trailing' },
              { value: 'top',           label: '.top' },
              { value: 'bottom',        label: '.bottom' },
              { value: 'topLeading',    label: '.topLeading' },
              { value: 'topTrailing',   label: '.topTrailing' },
              { value: 'bottomLeading', label: '.bottomLeading' },
              { value: 'bottomTrailing',label: '.bottomTrailing' }
            ]}
            onChange={(v) => updateItem(item.id, { ornamentContentAlignment: v })}
          />
        </Row>
        <div className="text-[9px] text-textMute mt-2 mb-1">visibility</div>
        <Row label="Visibility">
          <div className="segmented flex-1">
            {['automatic', 'visible', 'hidden'].map((v) => (
              <button
                key={v}
                className={(item.ornamentVisibility || 'automatic') === v ? 'active' : ''}
                onClick={() => updateItem(item.id, { ornamentVisibility: v })}
              >{v}</button>
            ))}
          </div>
        </Row>
        <div className="text-[9px] text-textMute mt-2 mb-1">offsetFromBoundary</div>
        <Row label="Offset">
          <IntField value={item.ornamentOffset ?? 0} onChange={(v) => updateItem(item.id, { ornamentOffset: v })} />
          <span className="text-[9px] text-textMute">pt</span>
        </Row>
        <div className="text-[9px] text-textMute mt-2 mb-1">Background &amp; Material</div>
        <Row label="Background">
          <SemanticColorPicker
            token={item.background}
            onChange={(t) => updateItem(item.id, { background: t })}
          />
        </Row>
        <Row label="Material">
          <Select
            value={item.material || 'regular'}
            options={MATERIAL_ORDER.map((k) => ({ value: k, label: `${MATERIALS[k].label} · ${Math.round(MATERIALS[k].opacity * 100)}%` }))}
            onChange={(v) => updateItem(item.id, { material: v })}
          />
        </Row>
      </Section>

      <Section title="Scroll View">
        <Row label="Scrollable">
          <div className="segmented flex-1">
            <button className={item.scrollable ? 'active' : ''} onClick={() => updateItem(item.id, { scrollable: true })}>On</button>
            <button className={!item.scrollable ? 'active' : ''} onClick={() => updateItem(item.id, { scrollable: false })}>Off</button>
          </div>
        </Row>
        <div className="text-[10px] text-textMute">Draws a scroll indicator along the trailing edge.</div>
      </Section>

      {/* Phase 12 — Environment (cascade to children) */}
      <Section title="Environment" defaultOpen={false}>
        <Row label="Font"><Select value={item.environment?.font || ''} options={[{ value: '', label: '— Inherit —' }, ...TEXT_STYLE_ORDER.map((k) => ({ value: k, label: TEXT_STYLES[k].label }))]} onChange={(v) => updateItem(item.id, { environment: { ...item.environment, font: v || null } })} /></Row>
        <Row label="Foreground"><SemanticColorPicker token={item.environment?.foregroundStyle} onChange={(t) => updateItem(item.id, { environment: { ...item.environment, foregroundStyle: t } })} /></Row>
        <Row label="Direction">
          <div className="segmented flex-1">
            <button className={(item.environment?.layoutDirection || 'leftToRight') === 'leftToRight' ? 'active' : ''} onClick={() => updateItem(item.id, { environment: { ...item.environment, layoutDirection: 'leftToRight' } })}>LTR</button>
            <button className={(item.environment?.layoutDirection) === 'rightToLeft' ? 'active' : ''} onClick={() => updateItem(item.id, { environment: { ...item.environment, layoutDirection: 'rightToLeft' } })}>RTL</button>
          </div>
        </Row>
        <Row label="Locale"><input value={item.environment?.locale || ''} onChange={(e) => updateItem(item.id, { environment: { ...item.environment, locale: e.target.value } })} className="field flex-1" placeholder="en-US" /></Row>
      </Section>

      <UniversalModifiers item={item} updateItem={updateItem} />

      <Section title="Info" defaultOpen={false}>
        <div className="text-[10px] text-textMute font-mono">ID: {item.id}</div>
      </Section>
    </div>
  )
}

// ---- panel (leaf elements) ----

function PanelProps({ item, scene }) {
  const updateItem = useStore((s) => s.updateItem)
  const renameItem = useStore((s) => s.renameItem)
  const applyTextStyle = useStore((s) => s.applyTextStyle)
  const switchPanelType = useStore((s) => s.switchPanelType)
  const { panelType } = item
  const isAnyShape = ['rectangle', 'circle', 'capsule', 'ellipse', 'unevenRoundedRect', 'path', 'linearGradient', 'radialGradient', 'angularGradient'].includes(panelType)
  const isAnyPicker = ['picker', 'datepicker', 'colorpicker'].includes(panelType)
  const isAnyList = ['list', 'form', 'groupbox', 'outlinegroup'].includes(panelType)
  const isText = panelType === 'text'
  const isButton = panelType === 'button'
  const isToggle = panelType === 'toggle'
  const isSegmented = panelType === 'segmented'
  const isSlideshow = panelType === 'slideshow'
  const isTicker = panelType === 'ticker'
  const isImage = panelType === 'image'
  const isShape = ['rectangle', 'circle', 'capsule', 'ellipse', 'unevenRoundedRect', 'path'].includes(panelType)
  const isAlert = panelType === 'alert'
  const isSheet = panelType === 'sheet'
  const isPopover = panelType === 'popover'
  const isDivider = panelType === 'divider'
  const isSearch = panelType === 'search'
  const isLabel = panelType === 'label'
  const isTextField = panelType === 'textfield' || panelType === 'securefield'
  const isTextEditor = panelType === 'texteditor'
  const isPicker = panelType === 'picker'
  const isDatePicker = panelType === 'datepicker'
  const isColorPicker = panelType === 'colorpicker'
  const isGradient = ['linearGradient', 'radialGradient', 'angularGradient'].includes(panelType)
  const isUnevenRect = panelType === 'unevenRoundedRect'
  const isGroupBox = panelType === 'groupbox'
  const isForm = panelType === 'form'
  const isContentUnavailable = panelType === 'contentUnavailable'
  const isList = panelType === 'list'
  const isTable = panelType === 'table'
  const isMenu = panelType === 'menu'
  const isProgress = panelType === 'progress'
  const isSlider = panelType === 'slider'
  const isStepper = panelType === 'stepper'
  const isGauge = panelType === 'gauge'
  const hasFill = !isText
  const scheme = scene.designScheme || 'light'

  return (
    <div className="flex-1 overflow-y-auto scrollbar">
      <Section title={panelType.charAt(0).toUpperCase() + panelType.slice(1)}>
        <Row label="Name">
          <input value={item.name} onChange={(e) => renameItem(item.id, e.target.value)} className="field flex-1" />
        </Row>
        {/* Shape geometry variant switcher */}
        {isAnyShape && (
          <Row label="Geometry">
            <Select value={panelType} options={[
              { value: 'rectangle', label: 'Rectangle' },
              { value: 'circle', label: 'Circle' },
              { value: 'ellipse', label: 'Ellipse' },
              { value: 'capsule', label: 'Capsule' },
              { value: 'unevenRoundedRect', label: 'Uneven Rounded' },
              { value: 'path', label: 'Path' },
              { value: 'linearGradient', label: 'Linear Gradient' },
              { value: 'radialGradient', label: 'Radial Gradient' },
              { value: 'angularGradient', label: 'Angular Gradient' }
            ]} onChange={(v) => switchPanelType(item.id, v)} />
          </Row>
        )}
        {/* Picker type variant switcher */}
        {isAnyPicker && (
          <Row label="Picker Type">
            <Select value={panelType} options={[
              { value: 'picker', label: 'Default' },
              { value: 'datepicker', label: 'Date Picker' },
              { value: 'colorpicker', label: 'Color Picker' }
            ]} onChange={(v) => switchPanelType(item.id, v)} />
          </Row>
        )}
        {/* List/Form variant switcher */}
        {isAnyList && (
          <Row label="Collection">
            <Select value={panelType} options={[
              { value: 'list', label: 'List' },
              { value: 'form', label: 'Form' },
              { value: 'groupbox', label: 'GroupBox' },
              { value: 'outlinegroup', label: 'Outline Group' }
            ]} onChange={(v) => switchPanelType(item.id, v)} />
          </Row>
        )}
        {/* Image async toggle */}
        {(panelType === 'image' || panelType === 'asyncimage') && (
          <>
            <Row label="Async">
              <div className="segmented flex-1">
                <button className={panelType === 'image' ? 'active' : ''} onClick={() => switchPanelType(item.id, 'image')}>Off</button>
                <button className={panelType === 'asyncimage' ? 'active' : ''} onClick={() => switchPanelType(item.id, 'asyncimage')}>On</button>
              </div>
            </Row>
            <Row label="Image">
              <label className="btn flex-1 justify-center cursor-pointer">
                {item.imageUrl ? 'Replace' : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const url = URL.createObjectURL(file)
                      updateItem(item.id, { imageUrl: url })
                    }
                  }}
                />
              </label>
              {item.imageUrl && (
                <button className="btn btn-ghost" onClick={() => updateItem(item.id, { imageUrl: null })}>Clear</button>
              )}
            </Row>
            <Row label="URL">
              <input
                value={item.imageUrl || ''}
                onChange={(e) => updateItem(item.id, { imageUrl: e.target.value || null })}
                className="field flex-1"
                placeholder="https://..."
              />
            </Row>
          </>
        )}
      </Section>

      {/* Frame — only for elements with explicit size (not auto-sized text) */}
      {item.size && (
        <Section title="Frame">
          <Row label="Width"><PtField value={item.size[0]} onChange={(v) => updateItem(item.id, { size: [Math.max(0.05, v), item.size[1]] })} /></Row>
          <Row label="Height"><PtField value={item.size[1]} onChange={(v) => updateItem(item.id, { size: [item.size[0], Math.max(0.05, v)] })} /></Row>
        </Section>
      )}
      {!item.size && (
        <Section title="Frame">
          <div className="text-[10px] text-textMute">Auto-sized from content (SwiftUI default).</div>
          <button className="btn w-full justify-center mt-1" onClick={() => updateItem(item.id, { size: [ptToUnits(200), ptToUnits(40)] })}>Set explicit frame</button>
        </Section>
      )}

      {hasFill && (
        <Section title="Appearance">
          <Row label="Fill">
            <SemanticColorPicker
              token={item.colorToken}
              onChange={(t) => {
                if (t) updateItem(item.id, { colorToken: t, color: resolveSemantic(t, scheme) })
                else updateItem(item.id, { colorToken: null })
              }}
            />
          </Row>
          <Row label="Hex">
            <ColorRow value={item.color} onChange={(v) => updateItem(item.id, { color: v, colorToken: null })} />
          </Row>
          <Row label="Radius">
            <PtField value={item.cornerRadius ?? 0} onChange={(v) => updateItem(item.id, { cornerRadius: Math.max(0, v) })} />
          </Row>
        </Section>
      )}

      {isButton && (
        <Section title="Button Style">
          <Row label="Style">
            <Select
              value={item.buttonStyle || 'bordered'}
              options={Object.entries(BUTTON_STYLES).map(([k, v]) => ({ value: k, label: v.label }))}
              onChange={(v) => updateItem(item.id, { buttonStyle: v })}
            />
          </Row>
        </Section>
      )}

      {isToggle && (
        <Section title="State">
          <Row label="Value">
            <div className="segmented flex-1">
              <button
                className={item.toggleOn ? 'active' : ''}
                onClick={() => updateItem(item.id, { toggleOn: true })}
              >On</button>
              <button
                className={!item.toggleOn ? 'active' : ''}
                onClick={() => updateItem(item.id, { toggleOn: false })}
              >Off</button>
            </div>
          </Row>
        </Section>
      )}

      {isSegmented && (
        <Section title="Segments">
          <Row label="Items">
            <input
              value={(item.segments || []).join(', ')}
              onChange={(e) => updateItem(item.id, { segments: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              className="field flex-1"
            />
          </Row>
          <Row label="Selected">
            <IntField
              value={item.selectedSegment ?? 0}
              min={0}
              max={Math.max(0, (item.segments || []).length - 1)}
              onChange={(v) => updateItem(item.id, { selectedSegment: v })}
            />
          </Row>
        </Section>
      )}

      {isSlideshow && (
        <Section title="Slides">
          <Row label="Count">
            <IntField
              value={item.slideCount || 3}
              min={1}
              max={10}
              onChange={(v) => updateItem(item.id, { slideCount: v })}
            />
          </Row>
          <Row label="Active">
            <IntField
              value={item.currentSlide ?? 0}
              min={0}
              max={(item.slideCount || 3) - 1}
              onChange={(v) => updateItem(item.id, { currentSlide: v })}
            />
          </Row>
          <Row label="Title">
            <input
              value={item.text || ''}
              onChange={(e) => updateItem(item.id, { text: e.target.value })}
              className="field flex-1"
            />
          </Row>
        </Section>
      )}

      {isTicker && (
        <Section title="Ticker">
          <Row>
            <textarea
              value={item.text || ''}
              onChange={(e) => updateItem(item.id, { text: e.target.value })}
              rows={2}
              className="field resize-none"
            />
          </Row>
          <div className="text-[10px] text-textMute">Scrolls right-to-left during preview.</div>
        </Section>
      )}

      {isSearch && (
        <Section title="Search">
          <Row label="Placeholder">
            <input
              value={item.text || ''}
              onChange={(e) => updateItem(item.id, { text: e.target.value })}
              className="field flex-1"
            />
          </Row>
        </Section>
      )}

      {isList && (
        <Section title="List">
          <Row label="Style">
            <Select
              value={item.listStyle || 'plain'}
              options={[
                { value: 'plain',  label: 'Plain' },
                { value: 'inset',  label: 'Inset' },
                { value: 'sidebar', label: 'Sidebar' }
              ]}
              onChange={(v) => updateItem(item.id, { listStyle: v })}
            />
          </Row>
          <Row label="Row Height">
            <IntField value={item.rowHeight || 60} min={32} max={120} onChange={(v) => updateItem(item.id, { rowHeight: v })} />
            <span className="text-[9px] text-textMute">pt</span>
          </Row>
          <div className="text-[10px] text-textMute uppercase tracking-wider mt-2">Rows</div>
          {(item.rows || []).map((r, i) => (
            <div key={i} className="flex flex-col gap-1">
              <Row label={`#${i + 1}`}>
                <input
                  value={r.title || ''}
                  onChange={(e) => {
                    const next = [...item.rows]
                    next[i] = { ...r, title: e.target.value }
                    updateItem(item.id, { rows: next })
                  }}
                  placeholder="Title"
                  className="field flex-1"
                />
              </Row>
              <Row label="">
                <input
                  value={r.subtitle || ''}
                  onChange={(e) => {
                    const next = [...item.rows]
                    next[i] = { ...r, subtitle: e.target.value }
                    updateItem(item.id, { rows: next })
                  }}
                  placeholder="Subtitle"
                  className="field flex-1"
                />
                <button
                  className="btn btn-icon btn-ghost"
                  onClick={() => updateItem(item.id, { rows: item.rows.filter((_, j) => j !== i) })}
                  title="Delete row"
                >×</button>
              </Row>
            </div>
          ))}
          <button
            className="btn w-full justify-center mt-1"
            onClick={() => updateItem(item.id, { rows: [...(item.rows || []), { title: `Item ${(item.rows?.length || 0) + 1}`, subtitle: '' }] })}
          >+ Add Row</button>
        </Section>
      )}

      {isTable && (
        <Section title="Table">
          <Row label="Columns">
            <input
              value={(item.columns || []).join(', ')}
              onChange={(e) => updateItem(item.id, { columns: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              className="field flex-1"
            />
          </Row>
          <div className="text-[10px] text-textMute uppercase tracking-wider mt-1">Rows</div>
          {(item.rows || []).map((row, i) => (
            <Row key={i} label={`#${i + 1}`}>
              <input
                value={row.join(', ')}
                onChange={(e) => {
                  const next = [...item.rows]
                  next[i] = e.target.value.split(',').map(s => s.trim())
                  updateItem(item.id, { rows: next })
                }}
                className="field flex-1"
              />
              <button
                className="btn btn-icon btn-ghost"
                onClick={() => updateItem(item.id, { rows: item.rows.filter((_, j) => j !== i) })}
              >×</button>
            </Row>
          ))}
          <button
            className="btn w-full justify-center"
            onClick={() => updateItem(item.id, { rows: [...(item.rows || []), (item.columns || []).map(() => '—')] })}
          >+ Add Row</button>
        </Section>
      )}

      {isMenu && (
        <Section title="Menu">
          <Row label="Items">
            <textarea
              value={(item.menuItems || []).join('\n')}
              onChange={(e) => updateItem(item.id, { menuItems: e.target.value.split('\n').filter(Boolean) })}
              rows={4}
              className="field resize-none"
            />
          </Row>
          <div className="text-[10px] text-textMute">One item per line.</div>
        </Section>
      )}

      {isProgress && (
        <Section title="Progress">
          <Row label="Value">
            <Slider
              value={item.value ?? 0.5}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => updateItem(item.id, { value: v })}
            />
          </Row>
        </Section>
      )}

      {isSlider && (
        <Section title="Slider">
          <Row label="Value">
            <Slider
              value={item.sliderValue ?? 0.5}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => updateItem(item.id, { sliderValue: v })}
            />
          </Row>
        </Section>
      )}

      {isStepper && (
        <Section title="Stepper">
          <Row label="Value">
            <IntField
              value={item.stepperValue ?? 0}
              min={item.stepperMin ?? 0}
              max={item.stepperMax ?? 100}
              onChange={(v) => updateItem(item.id, { stepperValue: v })}
            />
          </Row>
          <Row label="Min">
            <IntField value={item.stepperMin ?? 0} onChange={(v) => updateItem(item.id, { stepperMin: v })} />
          </Row>
          <Row label="Max">
            <IntField value={item.stepperMax ?? 100} onChange={(v) => updateItem(item.id, { stepperMax: v })} />
          </Row>
        </Section>
      )}

      {isGauge && (
        <Section title="Gauge">
          <Row label="Value">
            <Slider
              value={item.value ?? 0.5}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => updateItem(item.id, { value: v })}
            />
          </Row>
          <Row label="Label">
            <input
              value={item.text || ''}
              onChange={(e) => updateItem(item.id, { text: e.target.value })}
              className="field flex-1"
              placeholder="Displayed text"
            />
          </Row>
        </Section>
      )}

      {isShape && (
        <Section title="Stroke">
          <Row label="Color">
            <ColorRow
              value={item.strokeColor || '#000000'}
              onChange={(v) => updateItem(item.id, { strokeColor: v })}
            />
          </Row>
          <Row label="Width">
            <PtField
              value={item.strokeWidth ?? 0}
              onChange={(v) => updateItem(item.id, { strokeWidth: Math.max(0, v) })}
            />
          </Row>
        </Section>
      )}

      {isAlert && (
        <Section title="Alert">
          <Row label="Title">
            <input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" />
          </Row>
          <Row label="Message">
            <textarea value={item.alertMessage || ''} onChange={(e) => updateItem(item.id, { alertMessage: e.target.value })} rows={2} className="field resize-none" />
          </Row>
          <Row label="Buttons">
            <input
              value={(item.alertButtons || []).join(', ')}
              onChange={(e) => updateItem(item.id, { alertButtons: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              className="field flex-1"
              placeholder="Cancel, OK"
            />
          </Row>
        </Section>
      )}

      {isSheet && (
        <Section title="Sheet">
          <Row label="Detent">
            <Select
              value={item.sheetDetent || 'large'}
              options={[
                { value: 'medium', label: 'Medium' },
                { value: 'large', label: 'Large' }
              ]}
              onChange={(v) => updateItem(item.id, { sheetDetent: v })}
            />
          </Row>
          <Row label="Content">
            <textarea value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} rows={2} className="field resize-none" />
          </Row>
        </Section>
      )}

      {isPopover && (
        <Section title="Popover">
          <Row label="Content">
            <textarea value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} rows={2} className="field resize-none" />
          </Row>
        </Section>
      )}

      {(isText || isButton || isSlideshow || isTicker) && (
        <Section title={isButton ? 'Label' : 'Text'}>
          {!isTicker && !isSlideshow && (
            <Row>
              <textarea
                value={item.text || ''}
                onChange={(e) => updateItem(item.id, { text: e.target.value })}
                rows={2}
                className="field resize-none"
              />
            </Row>
          )}
          <Row label="Style">
            <Select
              value={item.textStyle || 'body'}
              options={TEXT_STYLE_ORDER.map((k) => ({
                value: k,
                label: `${TEXT_STYLES[k].label} · ${TEXT_STYLES[k].pt}pt`
              }))}
              onChange={(v) => applyTextStyle(item.id, v)}
            />
          </Row>
          <Row label="Weight">
            <Select
              value={item.fontWeight || 'regular'}
              options={[
                { value: 'regular', label: 'Regular' },
                { value: 'medium', label: 'Medium' },
                { value: 'semibold', label: 'Semibold' },
                { value: 'bold', label: 'Bold' }
              ]}
              onChange={(v) => updateItem(item.id, { fontWeight: v })}
            />
          </Row>
          <Row label={isText ? 'Color' : 'Text'}>
            <SemanticColorPicker
              token={isText ? item.colorToken : item.textColorToken}
              onChange={(t) => {
                if (isText) {
                  if (t) updateItem(item.id, { colorToken: t, color: resolveSemantic(t, scheme) })
                  else updateItem(item.id, { colorToken: null })
                } else {
                  if (t) updateItem(item.id, { textColorToken: t, textColor: resolveSemantic(t, scheme) })
                  else updateItem(item.id, { textColorToken: null })
                }
              }}
            />
          </Row>
          <Row label="Align">
            <div className="segmented flex-1">
              {['left', 'center', 'right'].map((a) => (
                <button
                  key={a}
                  className={item.textAlign === a ? 'active' : ''}
                  onClick={() => updateItem(item.id, { textAlign: a })}
                >{a}</button>
              ))}
            </div>
          </Row>
        </Section>
      )}

      {/* Phase 3 type editors */}
      {isLabel && (
        <Section title="Label">
          <Row label="Icon"><input value={item.iconName || ''} onChange={(e) => updateItem(item.id, { iconName: e.target.value })} className="field flex-1" placeholder="A" maxLength={2} /></Row>
          <Row label="Icon Color"><ColorRow value={item.iconColor || '#007aff'} onChange={(v) => updateItem(item.id, { iconColor: v })} /></Row>
        </Section>
      )}
      {isTextField && (
        <Section title="TextField">
          <Row label="Placeholder"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
          {panelType === 'securefield' && <Row label="Dots"><IntField value={item.dotCount || 8} min={1} max={20} onChange={(v) => updateItem(item.id, { dotCount: v })} /></Row>}
        </Section>
      )}
      {isTextEditor && (
        <Section title="TextEditor">
          <Row label="Lines"><IntField value={item.lineCount || 5} min={1} max={20} onChange={(v) => updateItem(item.id, { lineCount: v })} /></Row>
          <Row label="Placeholder"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
        </Section>
      )}
      {isPicker && (
        <Section title="Picker">
          <Row label="Label"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
          <Row label="Value"><input value={item.pickerValue || ''} onChange={(e) => updateItem(item.id, { pickerValue: e.target.value })} className="field flex-1" /></Row>
          <Row label="Options"><input value={(item.pickerOptions || []).join(', ')} onChange={(e) => updateItem(item.id, { pickerOptions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className="field flex-1" /></Row>
          <Row label="Style"><Select value={item.pickerStyle || 'menu'} options={[{value:'menu',label:'Menu'},{value:'segmented',label:'Segmented'},{value:'wheel',label:'Wheel'},{value:'inline',label:'Inline'}]} onChange={(v) => updateItem(item.id, { pickerStyle: v })} /></Row>
        </Section>
      )}
      {isDatePicker && (
        <Section title="DatePicker">
          <Row label="Label"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
          <Row label="Date"><input type="date" value={item.dateValue || ''} onChange={(e) => updateItem(item.id, { dateValue: e.target.value })} className="field flex-1" /></Row>
          <Row label="Style"><Select value={item.dateStyle || 'compact'} options={[{value:'compact',label:'Compact'},{value:'graphical',label:'Graphical'},{value:'wheel',label:'Wheel'}]} onChange={(v) => updateItem(item.id, { dateStyle: v })} /></Row>
        </Section>
      )}
      {isColorPicker && (
        <Section title="ColorPicker">
          <Row label="Label"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
          <Row label="Color"><ColorRow value={item.pickedColor || '#ff0000'} onChange={(v) => updateItem(item.id, { pickedColor: v })} /></Row>
        </Section>
      )}
      {isContentUnavailable && (
        <Section title="Empty State">
          <Row label="Title"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
          <Row label="Subtitle"><input value={item.alertMessage || ''} onChange={(e) => updateItem(item.id, { alertMessage: e.target.value })} className="field flex-1" /></Row>
        </Section>
      )}

      {/* Phase 5 type editors */}
      {isUnevenRect && (
        <Section title="Corner Radii">
          <Row label="Top L"><PtField value={item.topLeadingRadius ?? 0} onChange={(v) => updateItem(item.id, { topLeadingRadius: Math.max(0, v) })} /></Row>
          <Row label="Top R"><PtField value={item.topTrailingRadius ?? 0} onChange={(v) => updateItem(item.id, { topTrailingRadius: Math.max(0, v) })} /></Row>
          <Row label="Bot L"><PtField value={item.bottomLeadingRadius ?? 0} onChange={(v) => updateItem(item.id, { bottomLeadingRadius: Math.max(0, v) })} /></Row>
          <Row label="Bot R"><PtField value={item.bottomTrailingRadius ?? 0} onChange={(v) => updateItem(item.id, { bottomTrailingRadius: Math.max(0, v) })} /></Row>
        </Section>
      )}
      {isGradient && (
        <Section title="Gradient">
          <Row label="From"><ColorRow value={item.gradientFrom || '#007aff'} onChange={(v) => updateItem(item.id, { gradientFrom: v })} /></Row>
          <Row label="To"><ColorRow value={item.gradientTo || '#af52de'} onChange={(v) => updateItem(item.id, { gradientTo: v })} /></Row>
          {panelType === 'linearGradient' && <Row label="Angle"><IntField value={item.gradientAngle || 180} min={0} max={360} onChange={(v) => updateItem(item.id, { gradientAngle: v })} /></Row>}
        </Section>
      )}

      {/* Phase 6 — Universal Modifiers */}
      <UniversalModifiers item={item} updateItem={updateItem} />

      {/* Phase 7 — Style Modifiers */}
      <Section title="Styles" defaultOpen={false}>
        {(isToggle) && <Row label="Toggle"><Select value={item.styles?.toggleStyle || 'switch'} options={TOGGLE_STYLES} onChange={(v) => updateItem(item.id, { styles: { ...item.styles, toggleStyle: v } })} /></Row>}
        {(isPicker) && <Row label="Picker"><Select value={item.styles?.pickerStyle || 'menu'} options={PICKER_STYLES} onChange={(v) => updateItem(item.id, { styles: { ...item.styles, pickerStyle: v } })} /></Row>}
        {(isLabel) && <Row label="Label"><Select value={item.styles?.labelStyle || 'titleAndIcon'} options={LABEL_STYLES} onChange={(v) => updateItem(item.id, { styles: { ...item.styles, labelStyle: v } })} /></Row>}
        {(isTextField) && <Row label="TextField"><Select value={item.styles?.textFieldStyle || 'roundedBorder'} options={TEXTFIELD_STYLES} onChange={(v) => updateItem(item.id, { styles: { ...item.styles, textFieldStyle: v } })} /></Row>}
        <Row label="Size"><Select value={item.styles?.controlSize || 'regular'} options={CONTROL_SIZES} onChange={(v) => updateItem(item.id, { styles: { ...item.styles, controlSize: v } })} /></Row>
      </Section>

      {/* Phase 8 — SF Symbol */}
      <SymbolSection item={item} updateItem={updateItem} />

      {/* Phase 9 — Animation */}
      <Section title="Animation" defaultOpen={false}>
        <Row label="Curve"><Select value={item.animation?.curve || 'default'} options={ANIMATION_CURVES} onChange={(v) => updateItem(item.id, { animation: { ...item.animation, curve: v } })} /></Row>
        <Row label="Duration"><Slider value={item.animation?.duration ?? 0.35} min={0.05} max={2.0} step={0.05} suffix="s" onChange={(v) => updateItem(item.id, { animation: { ...item.animation, duration: v } })} /></Row>
        <Row label="Transition"><Select value={item.animation?.transition || 'opacity'} options={TRANSITION_TYPES} onChange={(v) => updateItem(item.id, { animation: { ...item.animation, transition: v } })} /></Row>
        {item.animation?.curve === 'spring' && (
          <>
            <Row label="Response"><Slider value={item.animation?.springResponse ?? 0.55} min={0.1} max={2.0} step={0.05} onChange={(v) => updateItem(item.id, { animation: { ...item.animation, springResponse: v } })} /></Row>
            <Row label="Damping"><Slider value={item.animation?.springDamping ?? 0.825} min={0} max={1} step={0.025} onChange={(v) => updateItem(item.id, { animation: { ...item.animation, springDamping: v } })} /></Row>
          </>
        )}
      </Section>

      {/* Phase 11 — Accessibility */}
      <Section title="Accessibility" defaultOpen={false}>
        <Row label="Label"><input value={item.accessibility?.label || ''} onChange={(e) => updateItem(item.id, { accessibility: { ...item.accessibility, label: e.target.value } })} className="field flex-1" placeholder="VoiceOver label" /></Row>
        <Row label="Hint"><input value={item.accessibility?.hint || ''} onChange={(e) => updateItem(item.id, { accessibility: { ...item.accessibility, hint: e.target.value } })} className="field flex-1" placeholder="Usage hint" /></Row>
        <Row label="Value"><input value={item.accessibility?.value || ''} onChange={(e) => updateItem(item.id, { accessibility: { ...item.accessibility, value: e.target.value } })} className="field flex-1" placeholder="Current value" /></Row>
        <div className="text-[9px] text-textMute uppercase tracking-wider mt-2">Traits</div>
        <div className="flex flex-wrap gap-1">
          {ACCESSIBILITY_TRAITS.map((t) => {
            const traits = item.accessibility?.traits || []
            const active = traits.includes(t.value)
            return (
              <button
                key={t.value}
                onClick={() => {
                  const next = active ? traits.filter((x) => x !== t.value) : [...traits, t.value]
                  updateItem(item.id, { accessibility: { ...item.accessibility, traits: next } })
                }}
                className={`px-2 py-0.5 text-[9px] rounded border transition-colors ${
                  active ? 'bg-accent border-accent text-white' : 'bg-surface3 border-border text-textDim hover:text-text'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </Section>

      <Section title="Info" defaultOpen={false}>
        <div className="text-[10px] text-textMute font-mono">ID: {item.id}</div>
      </Section>
    </div>
  )
}

// Symbol section — extracted so it can hold its own picker state.
function SymbolSection({ item, updateItem }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const sym = item.symbolName ? SF_SYMBOLS[item.symbolName] : null
  return (
    <Section title="SF Symbol" defaultOpen={false}>
      <Row label="Symbol">
        <button onClick={() => setPickerOpen(true)} className="btn flex-1 justify-between">
          <span>{sym ? `${sym.glyph} ${sym.label}` : 'None'}</span>
          <span className="text-[9px] text-textMute">Pick</span>
        </button>
      </Row>
      {item.symbolName && (
        <>
          <Row label="Mode"><Select value={item.symbolRenderingMode || 'monochrome'} options={SYMBOL_RENDERING_MODES} onChange={(v) => updateItem(item.id, { symbolRenderingMode: v })} /></Row>
          <Row label="Variant"><Select value={item.symbolVariant || ''} options={SYMBOL_VARIANTS.map(s => ({ ...s, value: s.value || '' }))} onChange={(v) => updateItem(item.id, { symbolVariant: v || null })} /></Row>
          <button onClick={() => updateItem(item.id, { symbolName: null })} className="btn btn-ghost text-[10px] w-full justify-center text-danger mt-1">Remove Symbol</button>
        </>
      )}
      {pickerOpen && (
        <SymbolPicker
          current={item.symbolName}
          onSelect={(name) => updateItem(item.id, { symbolName: name })}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </Section>
  )
}

// ---- scene ----

function NavBarWizard() {
  const [open, setOpen] = useState(false)
  const [height, setHeight] = useState(56)
  const [count, setCount] = useState(3)
  const [labels, setLabels] = useState(['Home', 'Search', 'Profile'])
  const addNavBar = useStore((s) => s.addNavBar)

  const setCountClamped = (n) => {
    const c = Math.max(1, Math.min(6, n))
    setCount(c)
    if (labels.length < c) {
      setLabels([...labels, ...Array(c - labels.length).fill('').map((_, i) => `Item ${labels.length + i + 1}`)])
    }
  }

  if (!open) {
    return (
      <button className="btn w-full justify-center" onClick={() => setOpen(true)}>
        + Navigation Bar
      </button>
    )
  }
  return (
    <div className="flex flex-col gap-2 p-2 bg-surface2 border border-border rounded">
      <Row label="Height">
        <IntField value={height} min={44} max={96} onChange={setHeight} />
        <span className="text-[9px] text-textMute">pt</span>
      </Row>
      <Row label="Items">
        <IntField value={count} min={1} max={6} onChange={setCountClamped} />
      </Row>
      {Array.from({ length: count }).map((_, i) => (
        <Row key={i} label={`#${i + 1}`}>
          <input
            value={labels[i] || ''}
            onChange={(e) => {
              const next = [...labels]
              next[i] = e.target.value
              setLabels(next)
            }}
            className="field flex-1"
          />
        </Row>
      ))}
      <div className="flex gap-1 mt-1">
        <button
          className="btn btn-primary flex-1 justify-center"
          onClick={() => {
            addNavBar({ height, labels: labels.slice(0, count) })
            setOpen(false)
          }}
        >
          Add
        </button>
        <button className="btn flex-1 justify-center" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function TabBarWizard() {
  const [open, setOpen] = useState(false)
  const [pages, setPages] = useState(4)
  const [labels, setLabels] = useState(['Home', 'Search', 'Library', 'Profile'])
  const addTabBar = useStore((s) => s.addTabBar)
  const setPagesClamped = (n) => {
    const p = Math.max(2, Math.min(5, n))
    setPages(p)
    if (labels.length < p) {
      setLabels([...labels, ...Array(p - labels.length).fill('').map((_, i) => `Tab ${labels.length + i + 1}`)])
    }
  }
  if (!open) {
    return (
      <button className="btn w-full justify-center" onClick={() => setOpen(true)}>
        + Tab Bar
      </button>
    )
  }
  return (
    <div className="flex flex-col gap-2 p-2 bg-surface2 border border-border rounded">
      <Row label="Pages">
        <IntField value={pages} min={2} max={5} onChange={setPagesClamped} />
      </Row>
      {Array.from({ length: pages }).map((_, i) => (
        <Row key={i} label={`Tab ${i + 1}`}>
          <input
            value={labels[i] || ''}
            onChange={(e) => {
              const next = [...labels]
              next[i] = e.target.value
              setLabels(next)
            }}
            className="field flex-1"
          />
        </Row>
      ))}
      <div className="flex gap-1 mt-1">
        <button
          className="btn btn-primary flex-1 justify-center"
          onClick={() => {
            addTabBar({ pages, labels: labels.slice(0, pages) })
            setOpen(false)
          }}
        >
          Add
        </button>
        <button className="btn flex-1 justify-center" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function SplitViewWizard() {
  const addSplitView = useStore((s) => s.addSplitView)
  return (
    <button className="btn w-full justify-center" onClick={() => addSplitView()}>
      + Split View (new Window)
    </button>
  )
}

function ToolbarWizard() {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState('top')
  const [count, setCount] = useState(3)
  const [items, setItems] = useState(['Action 1', 'Action 2', 'Action 3'])
  const addToolbar = useStore((s) => s.addToolbar)

  const setCountClamped = (n) => {
    const c = Math.max(1, Math.min(8, n))
    setCount(c)
    if (items.length < c) {
      setItems([...items, ...Array(c - items.length).fill('').map((_, i) => `Action ${items.length + i + 1}`)])
    }
  }

  if (!open) {
    return (
      <button className="btn w-full justify-center" onClick={() => setOpen(true)}>
        + Toolbar
      </button>
    )
  }
  return (
    <div className="flex flex-col gap-2 p-2 bg-surface2 border border-border rounded">
      <Row label="Placement">
        <Select
          value={placement}
          options={[
            { value: 'top',      label: 'Top' },
            { value: 'bottom',   label: 'Bottom' },
            { value: 'leading',  label: 'Leading' },
            { value: 'trailing', label: 'Trailing' }
          ]}
          onChange={setPlacement}
        />
      </Row>
      <Row label="Items">
        <IntField value={count} min={1} max={8} onChange={setCountClamped} />
      </Row>
      {Array.from({ length: count }).map((_, i) => (
        <Row key={i} label={`#${i + 1}`}>
          <input
            value={items[i] || ''}
            onChange={(e) => {
              const next = [...items]
              next[i] = e.target.value
              setItems(next)
            }}
            className="field flex-1"
          />
        </Row>
      ))}
      <div className="flex gap-1 mt-1">
        <button
          className="btn btn-primary flex-1 justify-center"
          onClick={() => {
            addToolbar({ placement, items: items.slice(0, count) })
            setOpen(false)
          }}
        >Add</button>
        <button className="btn flex-1 justify-center" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}

function OrnamentWizards() {
  const addOrnament = useStore((s) => s.addOrnament)
  return (
    <div className="grid grid-cols-2 gap-1">
      <button className="btn justify-center" onClick={() => addOrnament('leading')}>+ Leading</button>
      <button className="btn justify-center" onClick={() => addOrnament('trailing')}>+ Trailing</button>
    </div>
  )
}

function SceneProps({ scene, updateScene }) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar">
      <Section title="Scene">
        <Row label="Mode">
          <div className="segmented flex-1">
            <button className={scene.sceneMode === 'window' ? 'active' : ''} onClick={() => updateScene({ sceneMode: 'window' })}>Window</button>
            <button className={scene.sceneMode === 'volume' ? 'active' : ''} onClick={() => updateScene({ sceneMode: 'volume' })}>Volume</button>
          </div>
        </Row>
      </Section>

      <Section title={scene.sceneMode === 'window' ? 'Window Preset' : 'Volume Preset'}>
        {scene.sceneMode === 'window' ? (
          <Row label="Preset">
            <Select
              value={scene.windowPreset}
              options={Object.entries(WINDOW_PRESETS).map(([k, v]) => ({
                value: k,
                label: `${v.label} (${v.width}×${v.height})`
              }))}
              onChange={(v) => updateScene({ windowPreset: v })}
            />
          </Row>
        ) : (
          <Row label="Preset">
            <Select
              value={scene.volumePreset}
              options={Object.entries(VOLUME_PRESETS).map(([k, v]) => ({
                value: k,
                label: `${v.label} (${v.width}×${v.height}×${v.depth})`
              }))}
              onChange={(v) => updateScene({ volumePreset: v })}
            />
          </Row>
        )}
      </Section>

      <Section title="Viewport">
        <Row label="Background">
          <div className="segmented flex-1">
            <button className={scene.colorScheme === 'light' ? 'active' : ''} onClick={() => updateScene({ colorScheme: 'light' })}>Light</button>
            <button className={scene.colorScheme === 'dark' ? 'active' : ''} onClick={() => updateScene({ colorScheme: 'dark' })}>Dark</button>
          </div>
        </Row>
        <div className="text-[10px] text-textMute">Only the viewport background. Your design stays on its own scheme.</div>
      </Section>

      <Section title="Design">
        <Row label="Scheme">
          <div className="segmented flex-1">
            <button className={scene.designScheme === 'light' ? 'active' : ''} onClick={() => updateScene({ designScheme: 'light' })}>Light</button>
            <button className={scene.designScheme === 'dark' ? 'active' : ''} onClick={() => updateScene({ designScheme: 'dark' })}>Dark</button>
          </div>
        </Row>
        <Row label="Tint">
          <ColorRow value={scene.tintColor} onChange={(v) => updateScene({ tintColor: v })} />
        </Row>
      </Section>

    </div>
  )
}
