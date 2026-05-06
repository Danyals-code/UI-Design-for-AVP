// Panel inspector — registry-driven scaffold.
//
// Renders shared scaffolding (Name, Frame, Appearance, Modifiers, Styles,
// Symbol, Animation, Accessibility, Info) plus the per-type inspector from
// `src/panels/inspectors.jsx`. Knowing nothing about specific panel types is
// the whole point — adding a new panel means adding one entry to the
// inspectors registry, not editing this file.

import { useStore } from '../../store'
import { Row, Section, Select } from './primitives'
import {
  FigmaFrameSection, LayoutSection,
  StylesSection, SymbolSection,
  AnimationSection, AccessibilitySection, InfoSection
} from './shared'
import { ModifierStack } from './ModifierStack'
import { INSPECTORS, getPanelMeta } from '../../panels/inspectors'
import { isInteractivePanel } from '../../panels/registry'

// visionOS .hoverEffect — `inherit` defers to the owning window's
// `spatial.hoverEffect`. The remaining values match SwiftUI's `HoverEffect`
// enum 1:1 so the exporter can emit `.hoverEffect(.<value>)`.
const HOVER_EFFECT_OPTIONS = [
  { value: 'inherit',   label: 'Inherit (window)' },
  { value: 'automatic', label: 'Automatic' },
  { value: 'highlight', label: 'Highlight' },
  { value: 'lift',      label: 'Lift' },
  { value: 'none',      label: 'None' }
]

export function PanelProps({ item, scene }) {
  const updateItem      = useStore((s) => s.updateItem)
  const renameItem      = useStore((s) => s.renameItem)
  const applyTextStyle  = useStore((s) => s.applyTextStyle)
  const switchPanelType = useStore((s) => s.switchPanelType)

  const meta = getPanelMeta(item.panelType)
  const Inspector = INSPECTORS[item.panelType]
  const interactive = isInteractivePanel(item.panelType)

  const ctx = { item, scene, updateItem, applyTextStyle, switchPanelType }
  const titleCase = item.panelType.charAt(0).toUpperCase() + item.panelType.slice(1)

  // Styles section is only meaningful for interactive controls — it carries
  // `controlSize` plus per-control style pickers (toggleStyle, pickerStyle,
  // …). Hiding it for Text/Image/Shape removes a section header that used
  // to render with only a single greyed-out "Size" row.
  const showStyles = interactive

  return (
    <div className="flex-1 overflow-y-auto scrollbar">
      <Section title={titleCase}>
        <Row label="Name">
          <input value={item.name} onChange={(e) => renameItem(item.id, e.target.value)} className="field flex-1" />
        </Row>
      </Section>

      {/* Layout = frame + appearance. Text/Link keep the figma-style frame
          picker (fit/fixed/fill) since their frame semantics differ from a
          regular 2D panel. */}
      {meta.frameMode === 'figma'
        ? <FigmaFrameSection item={item} updateItem={updateItem} />
        : meta.frameMode === 'none'
          ? null
          : <LayoutSection item={item} updateItem={updateItem} scene={scene} lockHeight={meta.lockHeight} lockHeightHint={meta.lockHeightHint} />}

      {Inspector && <Inspector {...ctx} />}

      <ModifierStack item={item} updateItem={updateItem} />

      {showStyles && <StylesSection item={item} updateItem={updateItem} />}

      {/* Spec §3.5 — visionOS hover modifier family. Only meaningful on
          interactive controls (visionOS auto-applies hover affordances to
          Button/Toggle/Picker/etc. and ignores them elsewhere). Hidden for
          non-interactive panels so the inspector doesn't suggest knobs
          that are no-ops in SwiftUI. */}
      {interactive && (
        <Section title="Interaction" defaultOpen={false}>
          <Row label="Hover">
            <Select
              value={item.hoverEffect || 'inherit'}
              options={HOVER_EFFECT_OPTIONS}
              onChange={(v) => updateItem(item.id, { hoverEffect: v })}
            />
          </Row>
          <Row label="Disabled">
            <div className="segmented flex-1">
              <button className={item.hoverEffectDisabled ? 'active' : ''} onClick={() => updateItem(item.id, { hoverEffectDisabled: true })}>On</button>
              <button className={!item.hoverEffectDisabled ? 'active' : ''} onClick={() => updateItem(item.id, { hoverEffectDisabled: false })}>Off</button>
            </div>
          </Row>
          <Row label="Default">
            <Select
              value={item.defaultHoverEffect || 'automatic'}
              options={[
                { value: 'automatic', label: 'Automatic' },
                { value: 'highlight', label: 'Highlight' },
                { value: 'lift',      label: 'Lift' }
              ]}
              onChange={(v) => updateItem(item.id, { defaultHoverEffect: v })}
            />
          </Row>
          <Row label="Group">
            <input
              value={item.hoverEffectGroup || ''}
              onChange={(e) => updateItem(item.id, { hoverEffectGroup: e.target.value || null })}
              className="field flex-1"
              placeholder="(none) e.g. automatic"
            />
          </Row>
        </Section>
      )}

      {meta.useSymbol && <SymbolSection item={item} updateItem={updateItem} />}

      {/* Advanced — Animation / Accessibility / Info live behind a single
          divider so the everyday inspector reads short. The user clicks
          into each sub-section when they need it. */}
      <div className="text-[9px] text-textMute uppercase tracking-wider px-3 pt-3 pb-1 border-t border-border bg-surface2/30">
        Advanced
      </div>
      <AnimationSection item={item} updateItem={updateItem} />
      <AccessibilitySection item={item} updateItem={updateItem} />
      <InfoSection item={item} />
    </div>
  )
}
