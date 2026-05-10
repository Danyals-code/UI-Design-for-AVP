// Panel inspector — registry-driven scaffold.
//
// Mirrors the 3D entity inspector's "compact and structured" feel:
// one Object section up top with name + the per-type fields rolled
// in, then Modifiers, then optional Styles, then Hover (interactive
// panels only), and finally a Behaviors placeholder so designers can
// see where window-level interactions will land. The old Advanced
// header (Animation / Accessibility / Info) is gone — those were
// rarely opened and made the panel feel cluttered.

import { useStore } from '../../store'
import { Row, Section, Select } from './primitives'
import {
  FigmaFrameSection, LayoutSection,
  StylesSection, SymbolSection
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

// Placeholder triggers / actions for Window-level behaviours. The 3D
// inspector has the live runtime; for windows we expose the same shape
// as a stub so the editor reads consistent across types. Wiring up the
// real interpreter is a follow-up.
const WINDOW_TRIGGER_STUBS = [
  { value: 'tap',     label: 'Tap' },
  { value: 'hover',   label: 'Hover' },
  { value: 'appear',  label: 'On appear' },
  { value: 'disappear', label: 'On disappear' }
]
const WINDOW_ACTION_STUBS = [
  { value: 'show',     label: 'Show window' },
  { value: 'hide',     label: 'Hide window' },
  { value: 'navigate', label: 'Navigate to tab' },
  { value: 'open',     label: 'Open URL' },
  { value: 'message',  label: 'Send message' }
]

function WindowBehaviorsPlaceholder() {
  return (
    <Section title="Behaviors" defaultOpen={false}>
      <div className="space-y-1.5">
        <div className="text-[9px] text-textMute leading-snug">
          Window behaviours are <span className="text-textBase">coming soon</span>.
          Pick a trigger and action below to sketch the intent — the export
          will pick them up once the runtime is wired.
        </div>
        <Row label="Trigger">
          <Select value="tap" options={WINDOW_TRIGGER_STUBS} onChange={() => {}} />
        </Row>
        <Row label="Action">
          <Select value="navigate" options={WINDOW_ACTION_STUBS} onChange={() => {}} />
        </Row>
      </div>
    </Section>
  )
}

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
      {/* Object — the everyday "what is this" header. Name lives here
          alongside the figma / fixed frame picker, mirroring the 3D
          entity inspector where Object holds name + kind + transform
          in one place. The per-type Inspector continues to render as
          its own section below since each type has 5–10 fields and
          packing them into Object too would make this header heavy. */}
      <Section title={titleCase} defaultOpen={true}>
        <Row label="Name">
          <input value={item.name} onChange={(e) => renameItem(item.id, e.target.value)} className="field flex-1" />
        </Row>
        {meta.frameMode === 'figma'
          ? <FigmaFrameSection item={item} updateItem={updateItem} embedded />
          : meta.frameMode === 'none'
            ? null
            : <LayoutSection item={item} updateItem={updateItem} scene={scene}
                             lockHeight={meta.lockHeight} lockHeightHint={meta.lockHeightHint}
                             embedded />}
      </Section>

      {Inspector && <Inspector {...ctx} />}

      <ModifierStack item={item} updateItem={updateItem} />

      {showStyles && <StylesSection item={item} updateItem={updateItem} />}

      {/* visionOS hover modifier family — only meaningful on interactive
          controls. Renamed from "Interaction" to "Hover" so it doesn't
          collide with the new "Behaviors" placeholder below. */}
      {interactive && (
        <Section title="Hover" defaultOpen={false}>
          <Row label="Effect">
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

      {/* Behaviors — placeholder mirroring the 3D inspector. Real
          window-level interactions will fill these in later; for now
          the section is a visual seam so designers can see where
          they'll go and the editor reads consistent across types. */}
      <WindowBehaviorsPlaceholder />
    </div>
  )
}
