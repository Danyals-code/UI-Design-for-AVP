// Panel inspector — registry-driven scaffold.
//
// Mirrors the 3D entity inspector's "compact and structured" feel:
// one Object section up top with name + the per-type fields rolled
// in, then Modifiers, then optional Styles, then a single standardised
// "Behaviors" dropdown that holds the hover-effect family and (for
// buttons) the On-Tap action. The old Advanced header (Animation /
// Accessibility / Info) is gone — those were rarely opened and made the
// panel feel cluttered.

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

// visionOS .hoverEffect family — rendered inside the unified Behaviors
// section for interactive controls. `inherit` defers to the owning
// window's spatial.hoverEffect.
function HoverRows({ item, updateItem }) {
  return (
    <>
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
    </>
  )
}

// On-tap action picker for SwiftUI Buttons. Live in preview: clicks
// dispatch the configured action against the store. Currently
// supports navigating between windows (the primary use-case the user
// asked for) and flipping/setting a toggle. The action schema is open
// — adding a new type means a new switch case in `runTapAction` and a
// new option here.
const TAP_ACTION_OPTIONS = [
  { value: 'none',           label: 'No action' },
  // SwiftUI `@Environment(\.openWindow)` action — opens (or focuses) the
  // WindowGroup matching the target window's `windowGroupId` as a
  // side-by-side window in the wearer's space.
  { value: 'navigateWindow', label: 'Open Window (.openWindow)' },
  { value: 'navigateTab',    label: 'Switch tab' },
  { value: 'flipToggle',     label: 'Flip toggle' },
  { value: 'setToggle',      label: 'Set toggle' },
  { value: 'presentSheet',   label: 'Show sheet' },
  { value: 'dismiss',        label: 'Dismiss sheet' }
]

function TapActionRows({ item }) {
  const updateItem = useStore((s) => s.updateItem)
  const items      = useStore((s) => s.items)
  const action = item.tapAction || { type: 'none' }
  const setAction = (patch) => {
    const merged = { ...action, ...patch }
    updateItem(item.id, { tapAction: merged.type === 'none' ? null : merged })
  }

  const windows = items.filter((it) => it.type === 'window')
  const tabViewStacks = items.filter((it) => it.type === 'stack' && it.stackType === 'tabView')
  const togglePanels  = items.filter((it) => it.type === 'panel' && it.panelType === 'toggle')
  const sheetPanels   = items.filter((it) => it.type === 'panel' && ['sheet', 'popover', 'alert'].includes(it.panelType))

  return (
      <div className="space-y-1.5">
        <div className="text-[9px] text-textMute leading-snug">
          Runs in preview when the wearer taps this button. Compiles into a
          SwiftUI <span className="text-textBase">action: { }</span> closure on export.
        </div>
        <Row label="Action">
          <Select
            value={action.type}
            options={TAP_ACTION_OPTIONS}
            onChange={(t) => setAction({ type: t })}
          />
        </Row>
        {action.type === 'navigateWindow' && (
          <Row label="Window">
            <Select
              value={action.windowId || ''}
              options={[
                { value: '', label: '— Pick a window —' },
                ...windows.map((w) => ({
                  value: w.id,
                  // Show both the human name and the SwiftUI WindowGroup
                  // id (the string that ends up in `openWindow(id:)`).
                  // Falls back to the sanitised name for legacy windows.
                  label: w.windowGroupId
                    ? `${w.name || 'Window'} · ${w.windowGroupId}`
                    : (w.name || 'Window')
                }))
              ]}
              onChange={(v) => setAction({ windowId: v || null })}
            />
          </Row>
        )}
        {action.type === 'navigateTab' && (
          <>
            <Row label="TabView">
              <Select
                value={action.stackId || ''}
                options={[
                  { value: '', label: '— Pick a TabView —' },
                  ...tabViewStacks.map((s) => ({ value: s.id, label: s.name || 'TabView' }))
                ]}
                onChange={(v) => setAction({ stackId: v || null })}
              />
            </Row>
            <Row label="Tab #">
              <input
                type="number"
                min={0}
                value={action.tab ?? 0}
                onChange={(e) => setAction({ tab: parseInt(e.target.value, 10) || 0 })}
                className="field w-16"
              />
            </Row>
          </>
        )}
        {(action.type === 'flipToggle' || action.type === 'setToggle') && (
          <>
            <Row label="Toggle">
              <Select
                value={action.panelId || ''}
                options={[
                  { value: '', label: '— Pick a toggle —' },
                  ...togglePanels.map((p) => ({ value: p.id, label: p.name || 'Toggle' }))
                ]}
                onChange={(v) => setAction({ panelId: v || null })}
              />
            </Row>
            {action.type === 'setToggle' && (
              <Row label="Value">
                <div className="segmented flex-1">
                  <button className={action.value ? 'active' : ''} onClick={() => setAction({ value: true })}>On</button>
                  <button className={!action.value ? 'active' : ''} onClick={() => setAction({ value: false })}>Off</button>
                </div>
              </Row>
            )}
          </>
        )}
        {(action.type === 'presentSheet' || action.type === 'dismiss') && (
          <Row label="Panel">
            <Select
              value={action.panelId || ''}
              options={[
                { value: '', label: '— Pick a sheet/popover/alert —' },
                ...sheetPanels.map((p) => ({ value: p.id, label: p.name || p.panelType }))
              ]}
              onChange={(v) => setAction({ panelId: v || null })}
            />
          </Row>
        )}
      </div>
  )
}

// Unified Behaviors dropdown — standardised across SwiftUI views. Holds
// the hover-effect family (interactive controls) and the Button on-tap
// action under one "Behaviors" header, so interaction lives in the same
// place on every view. Non-interactive views show a short "coming soon"
// note so the section reads consistently everywhere.
function BehaviorsSection({ item, interactive, updateItem }) {
  const isButton = item.panelType === 'button'
  return (
    <Section title="Behaviors" defaultOpen={false}>
      {interactive && (
        <>
          <div className="text-[9px] text-textMute uppercase tracking-wider mb-1">Hover</div>
          <HoverRows item={item} updateItem={updateItem} />
        </>
      )}
      {isButton && (
        <>
          <div className="text-[9px] text-textMute uppercase tracking-wider mt-3 mb-1">On Tap</div>
          <TapActionRows item={item} />
        </>
      )}
      {!interactive && (
        <div className="text-[9px] text-textMute leading-snug">
          Tap / hover / appear → show / hide / navigate / open URL behaviours
          are <span className="text-textBase">coming soon</span> for this view.
        </div>
      )}
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

  // Styles section is only meaningful for controls whose dedicated
  // inspector doesn't already expose Size + style pickers. Buttons,
  // toggles, sliders, and the input fields (text / secure / search)
  // include Size (and style) in their own merged section, so duplicating
  // them under "Styles" produced confusing twin pickers. Pickers remain
  // the main type that still needs the standalone Styles section.
  const stylesOwnsSize = ['button', 'toggle', 'slider', 'textfield', 'securefield', 'search'].includes(item.panelType)
  const showStyles = interactive && !stylesOwnsSize

  return (
    <div className="flex-1 overflow-y-auto scrollbar">
      {/* Object — the panel-level "what is this" header. Name + frame
          live here for every panel kind so the user always finds them
          in the same place. Per-type inspectors below own the
          control-specific fields (Slider value range, Button style,
          etc.). The header is named "Object" rather than the panel's
          type so it doesn't collide with the inspector's own section
          (e.g. Slider used to have two "Slider" dropdowns). */}
      {/* Object section. Suppressed for panels with `mergedIdentity` —
          their per-type inspector owns Name + Frame inside its own
          single section, avoiding a stray "Object — Text" header when
          the user just wants to edit the text. */}
      {!meta.mergedIdentity && (
        <Section title={`Object — ${titleCase}`} defaultOpen={true}>
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
      )}

      {Inspector && <Inspector {...ctx} />}

      <ModifierStack item={item} updateItem={updateItem} />

      {showStyles && <StylesSection item={item} updateItem={updateItem} />}

      {meta.useSymbol && <SymbolSection item={item} updateItem={updateItem} />}

      {/* One standardised "Behaviors" dropdown across every view — holds
          the hover-effect family and (for buttons) the live On-Tap action. */}
      <BehaviorsSection item={item} interactive={interactive} updateItem={updateItem} />
    </div>
  )
}
