// Window inspector. Frame, material, spatial settings, ornaments,
// environment, modifiers.

import { useStore } from '../../store'
import {
  TEXT_STYLES, TEXT_STYLE_ORDER,
  MATERIALS, MATERIAL_ORDER,
  IMMERSION_STYLES, HOVER_EFFECTS, GESTURE_TYPES, WINDOW_RESIZABILITY
} from '../../appleSystem'
import {
  Row, Section, NumField, IntField, PtField,
  ColorRow, Select, SemanticColorPicker
} from './primitives'
import { UniversalModifiers } from './shared'
import { ToolbarWizard } from './wizards'

export function WindowProps({ item }) {
  const updateItem = useStore((s) => s.updateItem)
  const renameItem = useStore((s) => s.renameItem)
  return (
    <div className="flex-1 overflow-y-auto scrollbar">
      <Section title="Window" defaultOpen={false}>
        <Row label="Name">
          <input value={item.name} onChange={(e) => renameItem(item.id, e.target.value)} className="field flex-1" />
        </Row>
      </Section>

      {/* Frame — size, position, inner padding. */}
      <Section title="Frame" defaultOpen={false}>
        <div className="text-[9px] text-textMute uppercase tracking-wider mb-1">Size</div>
        <div className="grid grid-cols-2 gap-1.5">
          <Row label="W"><PtField value={item.size[0]} onChange={(v) => updateItem(item.id, { size: [v, item.size[1]] })} /></Row>
          <Row label="H"><PtField value={item.size[1]} onChange={(v) => updateItem(item.id, { size: [item.size[0], v] })} /></Row>
          <Row label="Radius"><PtField value={item.cornerRadius} onChange={(v) => updateItem(item.id, { cornerRadius: v })} /></Row>
          <Row label="Pad">
            <input
              type="number"
              step={1}
              value={item.padding ?? 14}
              onChange={(e) => updateItem(item.id, { padding: parseFloat(e.target.value) || 0 })}
              className="field"
            />
            <span className="text-[9px] text-textMute">pt</span>
          </Row>
        </div>
        <div className="text-[9px] text-textMute uppercase tracking-wider mt-3 mb-1">Position</div>
        <div className="grid grid-cols-3 gap-1.5">
          <Row label="X"><NumField value={item.position[0]} onChange={(v) => updateItem(item.id, { position: [v, item.position[1], item.position[2]] })} /></Row>
          <Row label="Y"><NumField value={item.position[1]} onChange={(v) => updateItem(item.id, { position: [item.position[0], v, item.position[2]] })} /></Row>
          <Row label="Z"><NumField value={item.position[2]} onChange={(v) => updateItem(item.id, { position: [item.position[0], item.position[1], v] })} /></Row>
        </div>
      </Section>

      <Section title="Material" defaultOpen={false}>
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

      {/* Chrome — visionOS exposes two first-party window attachments:
          • `.toolbar { ... }` ornament (top/bottom, leading/principal/trailing)
          • `NavigationSplitView` — two-column split inside the current window
          Sidebars for page navigation live on the scene's Tabs (pages). */}
      <Section title="Ornaments" defaultOpen={false}>
        <div className="text-[10px] text-textMute mb-1 leading-relaxed">
          Attach a SwiftUI <code>.toolbar</code> (top or bottom) with
          leading / principal / trailing items. For side navigation, use
          the scene's Tabs (pages) — they render as a sidebar automatically.
        </div>
        <ToolbarWizard />
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
