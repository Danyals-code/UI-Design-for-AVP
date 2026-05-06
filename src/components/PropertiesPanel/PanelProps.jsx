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
  FigmaFrameSection, ExplicitFrameSection,
  AppearanceSection,
  TextModifiers, UniversalModifiers,
  StylesSection, SymbolSection,
  AnimationSection, AccessibilitySection, InfoSection
} from './shared'
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

  const ctx = { item, scene, updateItem, applyTextStyle, switchPanelType }
  const titleCase = item.panelType.charAt(0).toUpperCase() + item.panelType.slice(1)

  return (
    <div className="flex-1 overflow-y-auto scrollbar">
      <Section title={titleCase}>
        <Row label="Name">
          <input value={item.name} onChange={(e) => renameItem(item.id, e.target.value)} className="field flex-1" />
        </Row>
      </Section>

      {meta.frameMode === 'figma'
        ? <FigmaFrameSection item={item} updateItem={updateItem} />
        : meta.frameMode === 'none'
          ? null
          : <ExplicitFrameSection item={item} updateItem={updateItem} lockHeight={meta.lockHeight} lockHeightHint={meta.lockHeightHint} />}

      {meta.hasFill && <AppearanceSection item={item} updateItem={updateItem} scene={scene} />}

      {Inspector && <Inspector {...ctx} />}

      {meta.useTextModifiers
        ? <TextModifiers item={item} updateItem={updateItem} />
        : <UniversalModifiers item={item} updateItem={updateItem} />}

      <StylesSection item={item} updateItem={updateItem} />

      {/* Hover effect only applies to interactive controls — visionOS
          auto-applies it to Button/Toggle/Picker/etc. and ignores it on
          decorative views. We mirror that policy: the section is hidden
          for non-interactive types so the inspector doesn't suggest a
          knob that has no effect in SwiftUI. */}
      {/*
        Spec §3.5 — visionOS hover modifier family.
        - `.hoverEffect(_:)` only applies to interactive controls.
        - `.hoverEffectDisabled(_:)` and `.defaultHoverEffect(_:)` make
          sense on any view, so we surface them outside the
          interactive-only gate.
        - `.hoverEffectGroup(_:)` shares one effect across grouped views.
      */}
      <Section title="Interaction" defaultOpen={false}>
        {isInteractivePanel(item.panelType) && (
          <>
            <Row label="Hover">
              <Select
                value={item.hoverEffect || 'inherit'}
                options={HOVER_EFFECT_OPTIONS}
                onChange={(v) => updateItem(item.id, { hoverEffect: v })}
              />
            </Row>
            <div className="text-[10px] text-textMute leading-relaxed mt-1">
              visionOS gaze-driven hover. <code>inherit</code> uses the
              window’s effect; <code>highlight</code> tints,
              <code>lift</code> raises with a soft shadow.
            </div>
          </>
        )}
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

      <SymbolSection item={item} updateItem={updateItem} />
      <AnimationSection item={item} updateItem={updateItem} />
      <AccessibilitySection item={item} updateItem={updateItem} />
      <InfoSection item={item} />
    </div>
  )
}
