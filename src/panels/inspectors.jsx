// Per-panel-type inspectors. Indexed by panelType, each entry returns a
// React fragment with the panel's type-specific sections. Generic
// scaffolding (Name, Modifiers, Symbol, Animation, Accessibility, Info)
// is rendered by PanelProps; this file handles only what's unique to each
// panel type.
//
// `INSPECTORS[type]` is called with a ctx object:
//   { item, scene, updateItem, applyTextStyle, switchPanelType }
// Per-type metadata lives in PANEL_META — keys: hasFill, frameMode,
// useTextModifiers, lockHeight, lockHeightHint.

import {
  Row, Section, IntField, PtField, NumField, Slider, ColorRow, Select,
  SemanticColorPicker, MaterialField
} from '../components/PropertiesPanel/primitives'
import {
  TextSection, FigmaFrameSection, LayoutSection, SymbolSection,
  LIST_STYLES, LIST_STYLE_ORDER, BUTTON_STYLES
} from '../components/PropertiesPanel/shared'
import { useStore } from '../store'
import { resolveSemantic, resolveAnyMaterial, SF_SYMBOLS, SYMBOL_VARIANTS } from '../appleSystem'
import { SymbolIcon } from '../components/icons'
import SymbolPicker from '../components/SymbolPicker'
import { useState } from 'react'
import {
  BUTTON_BORDER_SHAPES, CONTROL_SIZES,
  BUTTON_SIZES, BUTTON_SIZE_ORDER, BUTTON_SHAPES, BUTTON_SHAPE_ORDER,
  DATE_PICKER_STYLES, PROGRESS_VIEW_STYLES, GAUGE_STYLES,
  MENU_STYLES, MENU_ORDER, MENU_INDICATOR_VISIBILITY,
  FORM_STYLES, GROUP_BOX_STYLES, DISCLOSURE_GROUP_STYLES,
  TABLE_STYLES, TAB_VIEW_STYLES, WINDOW_STYLES,
  PICKER_STYLES, TOGGLE_STYLES, LABEL_STYLES,
  SYMBOL_RENDERING_MODES,
  KEYBOARD_TYPES, TEXT_CONTENT_TYPES, SUBMIT_LABELS, TEXT_AUTOCAPITALIZATION,
  DATE_COMPONENTS, IMAGE_SCALES,
  NAVBAR_STYLES, NAVBAR_STYLE_SPECS, NAVBAR_INTERACTIONS,
  ptToUnits, segmentedFrame
} from '../appleSystem'

// ---- shared mini-inspectors -------------------------------------------

// Image inspector — Name + Frame + Appearance + the image-specific
// controls merged into ONE section. PANEL_META marks image/asyncimage
// as `mergedIdentity` so the generic "Object — Image" header is dropped.
const ImageInspector = ({ item, updateItem, switchPanelType, scene }) => {
  const renameItem = useStore((s) => s.renameItem)
  return (
  <Section title="Image" defaultOpen={true}>
    <Row label="Name">
      <input value={item.name} onChange={(e) => renameItem(item.id, e.target.value)} className="field flex-1" />
    </Row>
    <LayoutSection item={item} updateItem={updateItem} scene={scene} embedded />
    <Row label="Async">
      <div className="segmented flex-1">
        <button className={item.panelType === 'image' ? 'active' : ''} onClick={() => switchPanelType(item.id, 'image')}>Off</button>
        <button className={item.panelType === 'asyncimage' ? 'active' : ''} onClick={() => switchPanelType(item.id, 'asyncimage')}>On</button>
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
    <Row label="Fit">
      <div className="segmented flex-1">
        <button className={(item.imageFit || 'fill') === 'fill' ? 'active' : ''} onClick={() => updateItem(item.id, { imageFit: 'fill' })} title="Scale to cover — crops edges (default)">Fill</button>
        <button className={item.imageFit === 'fit' ? 'active' : ''} onClick={() => updateItem(item.id, { imageFit: 'fit' })} title="Scale to fit — letterbox">Fit</button>
        <button className={item.imageFit === 'stretch' ? 'active' : ''} onClick={() => updateItem(item.id, { imageFit: 'stretch' })} title="Stretch to frame — ignores aspect">Stretch</button>
        <button className={item.imageFit === 'tile' ? 'active' : ''} onClick={() => updateItem(item.id, { imageFit: 'tile' })} title="Repeat image as tiles">Tile</button>
      </div>
    </Row>
  </Section>
  )
}

const VariantSwitcher = ({ panelType, switchPanelType, item, label, options }) => (
  <Section title={label}>
    <Row label={label}>
      <Select value={panelType} options={options} onChange={(v) => switchPanelType(item.id, v)} />
    </Row>
  </Section>
)

const SHAPE_VARIANTS = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'unevenRoundedRect', label: 'Uneven Rounded' },
  { value: 'path', label: 'Path' },
  { value: 'linearGradient', label: 'Linear Gradient' },
  { value: 'radialGradient', label: 'Radial Gradient' },
  { value: 'angularGradient', label: 'Angular Gradient' }
]

const SHAPE_LABELS = Object.fromEntries(SHAPE_VARIANTS.map((v) => [v.value, v.label]))

// Unified Shape/Gradient inspector — one Section that owns Name, the
// Geometry picker (the primary control), Frame, Fill (or gradient stops),
// per-shape radius fields, and Stroke. Replaces the previous chain of
// separate "Object — X" + "Geometry" + per-shape + "Stroke" sections.
//
// SwiftUI ground truth:
//   Rectangle / Circle / Capsule / Ellipse  — no shape-specific params,
//     drawn into the frame given by `.frame(width:height:)`.
//   RoundedRectangle(cornerRadius:)         — cornerRadius is the only
//     extra parameter; we expose Rectangle as RoundedRectangle when
//     cornerRadius > 0 (the exporter already does this via clipShape).
//   UnevenRoundedRectangle(top/bottom×L/R:) — four corner radii.
//   LinearGradient(colors:, startPoint:, endPoint:) — two-stop, angle.
//   RadialGradient(colors:, center:, startRadius:, endRadius:).
//   AngularGradient(colors:, center:).
function ShapeInspector({ item, updateItem, switchPanelType, scene }) {
  const renameItem = useStore((s) => s.renameItem)
  const type = item.panelType
  const isGradient = type === 'linearGradient' || type === 'radialGradient' || type === 'angularGradient'
  const showCornerRadius = type === 'rectangle' // RoundedRectangle case
  const showUnevenRadii  = type === 'unevenRoundedRect'
  const showStroke       = !isGradient
  return (
    <Section title={`Shape — ${SHAPE_LABELS[type] || type}`} defaultOpen={true}>
      <Row label="Name">
        <input
          value={item.name}
          onChange={(e) => renameItem(item.id, e.target.value)}
          className="field flex-1"
        />
      </Row>
      <Row label="Geometry">
        <Select value={type} options={SHAPE_VARIANTS} onChange={(v) => switchPanelType(item.id, v)} />
      </Row>
      <Row label="Width">
        <PtField value={item.size?.[0] ?? 0} onChange={(v) => updateItem(item.id, { size: [Math.max(0.05, v), item.size?.[1] ?? 0.05] })} />
      </Row>
      <Row label="Height">
        <PtField value={item.size?.[1] ?? 0} onChange={(v) => updateItem(item.id, { size: [item.size?.[0] ?? 0.05, Math.max(0.05, v)] })} />
      </Row>

      {!isGradient && (
        <>
          <Row label="Fill">
            <SemanticColorPicker
              token={item.colorToken}
              onChange={(t) => {
                if (t) updateItem(item.id, { colorToken: t, color: resolveSemantic(t, scene) })
                else updateItem(item.id, { colorToken: null })
              }}
            />
          </Row>
          <Row label="Hex">
            <ColorRow value={item.color} onChange={(v) => updateItem(item.id, { color: v, colorToken: null })} />
          </Row>
        </>
      )}

      {showCornerRadius && (
        <Row label="Radius">
          <PtField value={item.cornerRadius ?? 0} onChange={(v) => updateItem(item.id, { cornerRadius: Math.max(0, v) })} />
        </Row>
      )}

      {showUnevenRadii && (
        <>
          <Row label="Top L"><PtField value={item.topLeadingRadius ?? 0} onChange={(v) => updateItem(item.id, { topLeadingRadius: Math.max(0, v) })} /></Row>
          <Row label="Top R"><PtField value={item.topTrailingRadius ?? 0} onChange={(v) => updateItem(item.id, { topTrailingRadius: Math.max(0, v) })} /></Row>
          <Row label="Bot L"><PtField value={item.bottomLeadingRadius ?? 0} onChange={(v) => updateItem(item.id, { bottomLeadingRadius: Math.max(0, v) })} /></Row>
          <Row label="Bot R"><PtField value={item.bottomTrailingRadius ?? 0} onChange={(v) => updateItem(item.id, { bottomTrailingRadius: Math.max(0, v) })} /></Row>
        </>
      )}

      {isGradient && (
        <>
          <Row label="From"><ColorRow value={item.gradientFrom || '#007aff'} onChange={(v) => updateItem(item.id, { gradientFrom: v })} /></Row>
          <Row label="To"><ColorRow value={item.gradientTo || '#af52de'} onChange={(v) => updateItem(item.id, { gradientTo: v })} /></Row>
          {type === 'linearGradient' && (
            <Row label="Angle">
              <IntField value={item.gradientAngle ?? 180} min={0} max={360} onChange={(v) => updateItem(item.id, { gradientAngle: v })} />
            </Row>
          )}
        </>
      )}

      {showStroke && (
        <>
          <Row label="Stroke">
            <ColorRow value={item.strokeColor || '#000000'} onChange={(v) => updateItem(item.id, { strokeColor: v })} />
          </Row>
          <Row label="Width">
            <PtField value={item.strokeWidth ?? 0} onChange={(v) => updateItem(item.id, { strokeWidth: Math.max(0, v) })} />
          </Row>
        </>
      )}

      {type === 'path' && (
        <div className="text-[10px] text-textMute leading-snug">
          Custom Path — describe the path in the SwiftUI export. The
          canvas shows a placeholder until a path body is wired up.
        </div>
      )}
    </Section>
  )
}

const PICKER_VARIANTS = [
  { value: 'picker', label: 'Default' },
  { value: 'datepicker', label: 'Date Picker' },
  { value: 'colorpicker', label: 'Color Picker' }
]

// Three SwiftUI input-field flavors share a single picker so the user
// can pivot between them without re-creating a panel — the same way
// shapes flip between Rectangle / Circle / etc.
const INPUT_VARIANTS = [
  { value: 'textfield',   label: 'Text Field' },
  { value: 'securefield', label: 'Secure Field' },
  { value: 'search',      label: 'Search Field' }
]

const COLLECTION_VARIANTS = [
  { value: 'list', label: 'List' },
  { value: 'form', label: 'Form' },
  { value: 'groupbox', label: 'GroupBox' },
  { value: 'outlinegroup', label: 'Outline Group' }
]

// ---- registry ----------------------------------------------------------

// Text inspector — Name + Frame + Text controls merged into ONE section.
// PANEL_META marks `text` as `mergedIdentity`, which suppresses the
// generic "Object — Text" section so this is the only header the user
// sees for a text panel.
function TextInspector(ctx) {
  const { item } = ctx
  const renameItem = useStore((s) => s.renameItem)
  return (
    <Section title="Text" defaultOpen={true}>
      <Row label="Name">
        <input
          value={item.name}
          onChange={(e) => renameItem(item.id, e.target.value)}
          className="field flex-1"
        />
      </Row>
      <FigmaFrameSection item={item} updateItem={ctx.updateItem} embedded />
      <TextSection {...ctx} embedded includeBody isText />
    </Section>
  )
}

// ---- Label inspector ------------------------------------------------
//
// One consolidated section that owns the entire SwiftUI `Label("text",
// systemImage:)` surface area:
//   - Identity (Name)
//   - Frame (Width / Height) via embedded LayoutSection
//   - Text body
//   - SF Symbol picker (Lucide-rendered preview + Pick button)
//   - Style / Image Scale / Rendering Mode / Variant
//   - Icon Color
//
// Previously these lived in three separate dropdowns (Object — Label,
// Label, SF Symbol). PANEL_META.label is `mergedIdentity: true` and
// excluded from SYMBOL_USERS so PanelProps skips the duplicate sections
// when this inspector is shown.
function LabelInspector({ item, updateItem, scene }) {
  const renameItem = useStore((s) => s.renameItem)
  const [pickerOpen, setPickerOpen] = useState(false)
  const sym = item.symbolName ? SF_SYMBOLS[item.symbolName] : null
  return (
    <Section title="Label" defaultOpen={true}>
      <Row label="Name">
        <input value={item.name} onChange={(e) => renameItem(item.id, e.target.value)} className="field flex-1" />
      </Row>
      <LayoutSection item={item} updateItem={updateItem} scene={scene} embedded />
      <Row label="Title">
        <input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" placeholder="Label" />
      </Row>
      <Row label="Symbol">
        <button onClick={() => setPickerOpen(true)} className="btn flex-1 justify-between">
          <span className="flex items-center gap-1.5">
            {item.symbolName && (
              <SymbolIcon
                name={item.symbolName}
                size={14}
                variant={item.symbolVariant}
                renderingMode={item.symbolRenderingMode}
                color={item.iconColor || 'currentColor'}
              />
            )}
            <span>{sym ? sym.label : 'None'}</span>
          </span>
          <span className="text-[9px] text-textMute">Pick</span>
        </button>
      </Row>
      <Row label="Variant">
        <Select
          value={item.symbolVariant || ''}
          options={SYMBOL_VARIANTS.map((s) => ({ ...s, value: s.value || '' }))}
          onChange={(v) => updateItem(item.id, { symbolVariant: v || null })}
        />
      </Row>
      <Row label="Mode">
        <Select
          value={item.symbolRenderingMode || 'monochrome'}
          options={SYMBOL_RENDERING_MODES}
          onChange={(v) => updateItem(item.id, { symbolRenderingMode: v })}
        />
      </Row>
      <Row label="Icon Color">
        <ColorRow value={item.iconColor || '#007aff'} onChange={(v) => updateItem(item.id, { iconColor: v })} />
      </Row>
      <Row label="Style">
        <Select
          value={item.styles?.labelStyle || 'automatic'}
          options={LABEL_STYLES}
          onChange={(v) => updateItem(item.id, { styles: { ...item.styles, labelStyle: v } })}
        />
      </Row>
      <Row label="Img Scale">
        <Select
          value={item.imageScale || 'medium'}
          options={IMAGE_SCALES}
          onChange={(v) => updateItem(item.id, { imageScale: v })}
        />
      </Row>
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

// Button inspector — Name + Size/Style/Role/Tint + Label + SF Symbol all
// in ONE section. PANEL_META.button is `mergedIdentity` (no generic
// "Object — Button" header) and excluded from SYMBOL_USERS (no standalone
// SF Symbol section), so this single dropdown owns the whole button.
//
// Width / height aren't user-editable: the frame tracks the Size preset
// (small/regular/large) so every button matches an Apple-spec size.
function ButtonInspector({ item, updateItem, scene }) {
  const renameItem = useStore((s) => s.renameItem)
  const applySize = (key) => {
    const s = BUTTON_SIZES[key] || BUTTON_SIZES.regular
    updateItem(item.id, {
      buttonSize: key,
      size: [ptToUnits(s.width), ptToUnits(s.height)],
      fontSize: ptToUnits(s.fontPt),
      controlSize: key === 'small' ? 'small' : key === 'large' ? 'large' : 'regular'
    })
  }
  const applyShape = (key) => {
    const s = BUTTON_SHAPES[key] || BUTTON_SHAPES.capsule
    updateItem(item.id, {
      buttonShape: key,
      buttonBorderShape: key,
      cornerRadius: ptToUnits(s.radiusPt)
    })
  }
  return (
    <Section title="Button" defaultOpen={true}>
      <Row label="Name">
        <input value={item.name} onChange={(e) => renameItem(item.id, e.target.value)} className="field flex-1" />
      </Row>
      <Row label="Size">
        <Select
          value={item.buttonSize || 'regular'}
          options={BUTTON_SIZE_ORDER.map((k) => ({
            value: k,
            label: `${BUTTON_SIZES[k].label} (${BUTTON_SIZES[k].width}×${BUTTON_SIZES[k].height})`
          }))}
          onChange={applySize}
        />
      </Row>
      <Row label="Style">
        <Select
          value={item.buttonShape || 'capsule'}
          options={BUTTON_SHAPE_ORDER.map((k) => ({
            value: k,
            label: BUTTON_SHAPES[k].label
          }))}
          onChange={applyShape}
        />
      </Row>
      <Row label="Role">
        <Select
          value={item.buttonRole || 'none'}
          options={[
            { value: 'none',        label: 'None' },
            { value: 'destructive', label: 'Destructive' },
            { value: 'cancel',      label: 'Cancel' }
          ]}
          onChange={(v) => updateItem(item.id, { buttonRole: v })}
        />
      </Row>
      <Row label="Tint">
        <ColorRow
          value={item.tint || '#0a84ff'}
          onChange={(v) => updateItem(item.id, { tint: v })}
        />
        {item.tint && (
          <button
            className="btn btn-ghost text-[9px]"
            title="Use system tint"
            onClick={() => updateItem(item.id, { tint: null })}
          >×</button>
        )}
      </Row>

      {/* Label sub-section. Buttons always render the label centred on
          both axes (no alignment picker) and the text size is locked to
          the Size dropdown above (no style picker) — only the content
          body, its weight, and its colour are editable. */}
      <div className="text-[9px] text-textMute uppercase tracking-wider mt-3 mb-1">Label</div>
      <Row label="Content">
        <textarea
          value={item.text || ''}
          onChange={(e) => updateItem(item.id, { text: e.target.value })}
          rows={2}
          className="field flex-1 resize-none"
          placeholder="Button label"
        />
      </Row>
      <Row label="Weight">
        <Select
          value={item.fontWeight || 'semibold'}
          options={[
            { value: 'regular',  label: 'Regular' },
            { value: 'medium',   label: 'Medium' },
            { value: 'semibold', label: 'Semibold' },
            { value: 'bold',     label: 'Bold' }
          ]}
          onChange={(v) => updateItem(item.id, { fontWeight: v })}
        />
      </Row>
      <Row label="Color">
        <SemanticColorPicker
          token={item.textColorToken}
          onChange={(t) => {
            if (t) updateItem(item.id, { textColorToken: t, textColor: resolveSemantic(t, scene) })
            else   updateItem(item.id, { textColorToken: null })
          }}
        />
      </Row>

      <SymbolSection item={item} updateItem={updateItem} embedded />
    </Section>
  )
}

// Slider inspector — Name + Frame + value range + control Size in ONE
// section. PANEL_META.slider is `mergedIdentity`, and PanelProps treats
// slider as owning its own size (so no separate "Styles" section). A
// SwiftUI Slider has no background plate, so there's no Fill control —
// the renderer skips the frame fill for sliders too.
function SliderInspector({ item, updateItem }) {
  const renameItem = useStore((s) => s.renameItem)
  const lo = item.sliderMin ?? 0
  const hi = item.sliderMax ?? 1
  const step = item.sliderStep ?? 0
  return (
    <Section title="Slider" defaultOpen={true}>
      <Row label="Name">
        <input value={item.name} onChange={(e) => renameItem(item.id, e.target.value)} className="field flex-1" />
      </Row>
      <Row label="Width"><PtField value={item.size?.[0] ?? 0} onChange={(v) => updateItem(item.id, { size: [Math.max(0.05, v), item.size?.[1] ?? 0.05] })} /></Row>
      <Row label="Height"><PtField value={item.size?.[1] ?? 0} onChange={(v) => updateItem(item.id, { size: [item.size?.[0] ?? 0.05, Math.max(0.05, v)] })} /></Row>
      <Row label="Value">
        <Slider
          value={item.sliderValue ?? lo}
          min={lo}
          max={hi}
          step={step > 0 ? step : 0.01}
          onChange={(v) => updateItem(item.id, { sliderValue: v })}
        />
      </Row>
      <Row label="Min"><NumField value={lo} step={1} onChange={(v) => updateItem(item.id, { sliderMin: v })} /></Row>
      <Row label="Max"><NumField value={hi} step={1} onChange={(v) => updateItem(item.id, { sliderMax: v })} /></Row>
      {/*
        `step:` defaults to 0 (continuous). Spec §1.5 emits `step:` only
        when non-zero so SwiftUI keeps the continuous behaviour by default.
      */}
      <Row label="Step"><NumField value={step} step={0.05} onChange={(v) => updateItem(item.id, { sliderStep: Math.max(0, v) })} /></Row>
      <Row label="Min Label"><input value={item.sliderMinLabel || ''} onChange={(e) => updateItem(item.id, { sliderMinLabel: e.target.value })} className="field flex-1" placeholder="(none)" /></Row>
      <Row label="Max Label"><input value={item.sliderMaxLabel || ''} onChange={(e) => updateItem(item.id, { sliderMaxLabel: e.target.value })} className="field flex-1" placeholder="(none)" /></Row>
      <Row label="Size"><Select value={item.styles?.controlSize || 'regular'} options={CONTROL_SIZES} onChange={(v) => updateItem(item.id, { styles: { ...item.styles, controlSize: v } })} /></Row>
    </Section>
  )
}

// Input-field / segmented Material pickers draw from the unified
// MATERIAL_LIBRARY (all 24 scene materials) via the shared <MaterialField>
// primitive, so every surface offers the same list the user tunes in
// Scene → Materials & Colors. The selection is stored on the panel's
// `colorToken` (and `selectedColorToken` for the segmented thumb) so the
// existing fill pipeline tints the plate; defaults keep the visionOS
// recessed-glass look.

// Unified inspector for the three SwiftUI input fields (TextField,
// SecureField, search). One consolidated section that owns Name, the
// Input Type variant switcher, Frame, the Pill/Rounded edge, the
// per-variant controls, and the control Size — replacing the previous
// chain of Object + Input Type + per-field + Styles dropdowns. PANEL_META
// marks all three `mergedIdentity`, and PanelProps treats them as owning
// their size so no separate Styles section is rendered.
function InputFieldInspector({ item, updateItem, switchPanelType, scene }) {
  const renameItem = useStore((s) => s.renameItem)
  const t = item.panelType
  const isText   = t === 'textfield'
  const isSecure = t === 'securefield'
  const isSearch = t === 'search'
  const title = isText ? 'Text Field' : isSecure ? 'Secure Field' : 'Search Field'
  const edge = item.fieldShape || 'pill'
  return (
    <Section title={title} defaultOpen={true}>
      <Row label="Name">
        <input value={item.name} onChange={(e) => renameItem(item.id, e.target.value)} className="field flex-1" />
      </Row>
      <Row label="Input Type">
        <Select value={t} options={INPUT_VARIANTS} onChange={(v) => switchPanelType(item.id, v)} />
      </Row>
      <Row label="Width"><PtField value={item.size?.[0] ?? 0} onChange={(v) => updateItem(item.id, { size: [Math.max(0.05, v), item.size?.[1] ?? 0.05] })} /></Row>
      <Row label="Height"><PtField value={item.size?.[1] ?? 0} onChange={(v) => updateItem(item.id, { size: [item.size?.[0] ?? 0.05, Math.max(0.05, v)] })} /></Row>
      {/* Edge — Pill (capsule, default) tracks the field height; Rounded
          uses the stored corner radius. */}
      <Row label="Edge">
        <div className="segmented flex-1">
          <button className={edge === 'pill' ? 'active' : ''} onClick={() => updateItem(item.id, { fieldShape: 'pill' })}>Pill</button>
          <button className={edge === 'rounded' ? 'active' : ''} onClick={() => updateItem(item.id, { fieldShape: 'rounded' })}>Rounded</button>
        </div>
      </Row>
      {/* Material — the surface the field sits on, picked from the full
          scene material library (all 24). All three input variants share
          this; the Recessed Material View is the visionOS default. */}
      <Row label="Material">
        <MaterialField
          value={item.colorToken}
          fallback="viewRecessed"
          onChange={(v) => updateItem(item.id, { colorToken: v, color: resolveAnyMaterial(v, scene).color })}
        />
      </Row>
      <Row label="Placeholder">
        <input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" />
      </Row>
      <Row label="Value">
        {isSecure
          ? <input type="password" value={item.securefieldValue || ''} onChange={(e) => updateItem(item.id, { securefieldValue: e.target.value })} className="field flex-1" placeholder="(empty)" />
          : <input value={isText ? (item.textfieldValue || '') : (item.searchValue || '')} onChange={(e) => updateItem(item.id, { [isText ? 'textfieldValue' : 'searchValue']: e.target.value })} className="field flex-1" placeholder="(empty)" />
        }
      </Row>

      {isText && (
        <>
          <Row label="Axis">
            <div className="segmented flex-1">
              <button className={item.axis !== 'vertical' ? 'active' : ''} onClick={() => updateItem(item.id, { axis: 'horizontal' })}>Horizontal</button>
              <button className={item.axis === 'vertical' ? 'active' : ''} onClick={() => updateItem(item.id, { axis: 'vertical' })}>Vertical</button>
            </div>
          </Row>
          {item.axis === 'vertical' && (
            <Row label="Lines"><IntField value={item.lineLimit ?? 1} min={1} max={20} onChange={(v) => updateItem(item.id, { lineLimit: Math.max(1, v) })} /></Row>
          )}
          <Row label="Keyboard">
            <Select value={item.keyboardType || 'default'} options={KEYBOARD_TYPES} onChange={(v) => updateItem(item.id, { keyboardType: v })} />
          </Row>
          <Row label="Content">
            <Select value={item.textContentType || ''} options={TEXT_CONTENT_TYPES} onChange={(v) => updateItem(item.id, { textContentType: v })} />
          </Row>
          <Row label="Submit">
            <Select value={item.submitLabel || 'return'} options={SUBMIT_LABELS} onChange={(v) => updateItem(item.id, { submitLabel: v })} />
          </Row>
          <Row label="Autocap">
            <Select value={item.textInputAutocapitalization || 'sentences'} options={TEXT_AUTOCAPITALIZATION} onChange={(v) => updateItem(item.id, { textInputAutocapitalization: v })} />
          </Row>
          <Row label="Autocorrect">
            <div className="segmented flex-1">
              <button className={!item.autocorrectionDisabled ? 'active' : ''} onClick={() => updateItem(item.id, { autocorrectionDisabled: false })}>On</button>
              <button className={item.autocorrectionDisabled ? 'active' : ''} onClick={() => updateItem(item.id, { autocorrectionDisabled: true })}>Off</button>
            </div>
          </Row>
        </>
      )}

      {isSecure && (
        <>
          <Row label="Empty Dots"><IntField value={item.dotCount || 8} min={1} max={20} onChange={(v) => updateItem(item.id, { dotCount: v })} /></Row>
          <Row label="Submit">
            <Select value={item.submitLabel || 'done'} options={SUBMIT_LABELS} onChange={(v) => updateItem(item.id, { submitLabel: v })} />
          </Row>
        </>
      )}

      <div className="text-[10px] text-textMute leading-snug mt-1">
        {isSearch
          ? <>In preview, click the field to focus and type. Export emits <code>.searchable(text:prompt:)</code> on the parent view.</>
          : isSecure
            ? <>SecureField forces <code>.textContentType(.password)</code> and masks input. Click the field in preview to type.</>
            : <>In preview, click the field to focus and type — the value lives on the panel and persists across selections.</>}
      </div>
    </Section>
  )
}

// Sample labels used when the user bumps the segment count up.
const SEGMENT_SAMPLE = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth']

// Segmented control — everything in ONE merged section (PANEL_META marks
// it `mergedIdentity`, so PanelProps drops the generic "Object" header).
// Name + Frame + segment Count/Items/Selected + the Material tier live
// together. A segmented picker has no user fill colour — its only
// appearance control is the track Material — so there's no Fill/Hex here.
function SegmentedInspector({ item, updateItem, scene }) {
  const renameItem = useStore((s) => s.renameItem)
  const segs = item.segments || []
  // Any change to the segment list re-fits the frame (88pt per segment)
  // and clamps the selection so it can't dangle past the last segment.
  const setSegments = (next) => updateItem(item.id, {
    segments: next,
    size: segmentedFrame(next.length),
    selectedSegment: Math.max(0, Math.min(next.length - 1, item.selectedSegment ?? 0))
  })
  const setCount = (n) => {
    const target = Math.max(2, Math.min(8, n))
    const next = target > segs.length
      ? [...segs, ...Array.from({ length: target - segs.length }, (_, i) => SEGMENT_SAMPLE[(segs.length + i) % SEGMENT_SAMPLE.length])]
      : segs.slice(0, target)
    setSegments(next)
  }
  return (
    <Section title="Segmented" defaultOpen={true}>
      <Row label="Name">
        <input value={item.name} onChange={(e) => renameItem(item.id, e.target.value)} className="field flex-1" />
      </Row>
      <Row label="Width">
        <PtField value={item.size?.[0] ?? ptToUnits(188)} onChange={(v) => updateItem(item.id, { size: [Math.max(0.05, v), item.size?.[1] ?? ptToUnits(44)] })} />
      </Row>
      <Row label="Height">
        <PtField value={item.size?.[1] ?? ptToUnits(44)} onChange={(v) => updateItem(item.id, { size: [item.size?.[0] ?? ptToUnits(188), Math.max(0.05, v)] })} />
      </Row>
      <Row label="Count">
        <IntField value={segs.length} min={2} max={8} onChange={setCount} />
      </Row>
      <Row label="Items">
        <input
          value={segs.join(', ')}
          onChange={(e) => setSegments(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
          className="field flex-1"
        />
      </Row>
      <Row label="Selected">
        <IntField value={item.selectedSegment ?? 0} min={0} max={Math.max(0, segs.length - 1)} onChange={(v) => updateItem(item.id, { selectedSegment: v })} />
      </Row>
      {/* Both materials are picked from the full scene material library
          (all 24, Scene → Materials & Colors); the background long tile
          defaults to the Recessed Material View, the selected front tile to
          the raised Thicker tier. */}
      <Row label="Background">
        <MaterialField
          value={item.colorToken}
          fallback="viewRecessed"
          onChange={(v) => updateItem(item.id, { colorToken: v, color: resolveAnyMaterial(v, scene).color })}
        />
      </Row>
      <Row label="Selected Tile">
        <MaterialField
          value={item.selectedColorToken}
          fallback="viewThicker"
          onChange={(v) => updateItem(item.id, { selectedColorToken: v })}
        />
      </Row>
    </Section>
  )
}

export const INSPECTORS = {
  text: (ctx) => <TextInspector {...ctx} />,

  // Spec §1.17 — NavigationLink. Two emit modes: value-based (links into
  // a NavigationStack `.navigationDestination(for:)`) and destination-based
  // (inline destination view name). The inspector exposes both.
  navigationlink: ({ item, updateItem }) => (
    <>
      <Section title="Navigation Link">
        <Row label="Label">
          <input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" placeholder="See Details" />
        </Row>
        <Row label="Mode">
          <div className="segmented flex-1">
            <button className={(item.linkMode || 'value') === 'value' ? 'active' : ''} onClick={() => updateItem(item.id, { linkMode: 'value' })}>Value</button>
            <button className={item.linkMode === 'destination' ? 'active' : ''} onClick={() => updateItem(item.id, { linkMode: 'destination' })}>Destination</button>
          </div>
        </Row>
        {(item.linkMode || 'value') === 'value' ? (
          <Row label="Value">
            <input
              value={item.navValue || ''}
              onChange={(e) => updateItem(item.id, { navValue: e.target.value })}
              className="field flex-1"
              placeholder="detail"
            />
          </Row>
        ) : (
          <Row label="Destination">
            <input
              value={item.destinationName || ''}
              onChange={(e) => updateItem(item.id, { destinationName: e.target.value })}
              className="field flex-1"
              placeholder="DetailView"
            />
          </Row>
        )}
        <div className="text-[10px] text-textMute leading-snug mt-1">
          Value links require an enclosing <code>NavigationStack</code> with a matching <code>.navigationDestination(for:)</code>.
        </div>
      </Section>
      <TextSection {...{ item, updateItem }} sectionTitle="Text" includeBody={false} />
    </>
  ),

  confirmationdialog: ({ item, updateItem }) => (
    <Section title="Confirmation Dialog">
      <Row label="Title"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
      <Row label="Message"><textarea value={item.alertMessage || ''} onChange={(e) => updateItem(item.id, { alertMessage: e.target.value })} rows={2} className="field resize-none" /></Row>
      <Row label="Buttons">
        <input
          value={(item.alertButtons || []).join(', ')}
          onChange={(e) => updateItem(item.id, { alertButtons: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          className="field flex-1"
          placeholder="Delete, Cancel"
        />
      </Row>
      <Row label="Title Vis">
        {/*
          `titleVisibility:` defaults to `.automatic` — visionOS shows the
          title only when the dialog has a message body.
        */}
        <Select
          value={item.titleVisibility || 'automatic'}
          options={[
            { value: 'automatic', label: 'Automatic' },
            { value: 'visible',   label: 'Visible' },
            { value: 'hidden',    label: 'Hidden' }
          ]}
          onChange={(v) => updateItem(item.id, { titleVisibility: v })}
        />
      </Row>
      <div className="text-[10px] text-textMute leading-snug mt-1">
        Buttons named "Cancel" / "Delete" / "Remove" auto-receive the matching SwiftUI role.
      </div>
    </Section>
  ),

  inspector: ({ item, updateItem }) => (
    <Section title="Inspector">
      <Row label="Content"><textarea value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} rows={2} className="field resize-none" /></Row>
      {/*
        Spec §1.25 — `.inspectorColumnWidth(_:)` and the `(min:ideal:max:)`
        overload. Either explicit width OR the min/ideal/max trio; null
        leaves the system default (visionOS-tuned).
      */}
      <Row label="Width (pt)"><IntField value={item.inspectorColumnWidth ?? 0} min={0} onChange={(v) => updateItem(item.id, { inspectorColumnWidth: v || null })} /></Row>
      <div className="text-[9px] text-textMute uppercase tracking-wider mt-2 mb-1">Or min / ideal / max</div>
      <Row label="Min"><IntField value={item.inspectorMinWidth ?? 0} min={0} onChange={(v) => updateItem(item.id, { inspectorMinWidth: v || null })} /></Row>
      <Row label="Ideal"><IntField value={item.inspectorIdealWidth ?? 0} min={0} onChange={(v) => updateItem(item.id, { inspectorIdealWidth: v || null })} /></Row>
      <Row label="Max"><IntField value={item.inspectorMaxWidth ?? 0} min={0} onChange={(v) => updateItem(item.id, { inspectorMaxWidth: v || null })} /></Row>
      <div className="text-[10px] text-textMute leading-snug mt-1">
        Trailing sidebar on wide windows; sheet in compact contexts.
      </div>
    </Section>
  ),

  link: (ctx) => (
    <>
      <Section title="Link">
        {/*
          Persisted destination URL. The SwiftUI exporter wraps this in
          `URL(string:)` and force-unwraps; an empty string falls back to a
          placeholder so the generated code still compiles.
        */}
        <Row label="URL">
          <input
            type="url"
            value={ctx.item.url || ''}
            onChange={(e) => ctx.updateItem(ctx.item.id, { url: e.target.value })}
            className="field flex-1"
            placeholder="https://..."
          />
        </Row>
      </Section>
      <TextSection {...ctx} sectionTitle="Text" includeBody isText />
    </>
  ),

  button: (ctx) => <ButtonInspector {...ctx} />,

  toggle: ({ item, updateItem }) => (
    <Section title="Toggle">
      <Row label="Label">
        <input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" placeholder="Toggle" />
      </Row>
      <Row label="Value">
        <div className="segmented flex-1">
          <button className={item.toggleOn ? 'active' : ''} onClick={() => updateItem(item.id, { toggleOn: true })}>On</button>
          <button className={!item.toggleOn ? 'active' : ''} onClick={() => updateItem(item.id, { toggleOn: false })}>Off</button>
        </div>
      </Row>
      <Row label="Style">
        <Select
          value={item.styles?.toggleStyle || 'automatic'}
          options={TOGGLE_STYLES}
          onChange={(v) => updateItem(item.id, { styles: { ...item.styles, toggleStyle: v } })}
        />
      </Row>
      <Row label="Size">
        <Select
          value={item.styles?.controlSize || 'regular'}
          options={CONTROL_SIZES}
          onChange={(v) => updateItem(item.id, { styles: { ...item.styles, controlSize: v } })}
        />
      </Row>
      <Row label="Tint">
        <ColorRow
          value={item.tint || '#34c759'}
          onChange={(v) => updateItem(item.id, { tint: v })}
        />
        {item.tint && (
          <button className="btn btn-ghost text-[9px]" onClick={() => updateItem(item.id, { tint: null })} title="System tint">×</button>
        )}
      </Row>
    </Section>
  ),

  segmented: (ctx) => <SegmentedInspector {...ctx} />,

  slideshow: (ctx) => (
    <>
      <Section title="Slides">
        <Row label="Count">
          <IntField value={ctx.item.slideCount || 3} min={1} max={10} onChange={(v) => ctx.updateItem(ctx.item.id, { slideCount: v })} />
        </Row>
        <Row label="Active">
          <IntField value={ctx.item.currentSlide ?? 0} min={0} max={(ctx.item.slideCount || 3) - 1} onChange={(v) => ctx.updateItem(ctx.item.id, { currentSlide: v })} />
        </Row>
        <Row label="Title">
          <input value={ctx.item.text || ''} onChange={(e) => ctx.updateItem(ctx.item.id, { text: e.target.value })} className="field flex-1" />
        </Row>
      </Section>
      <TextSection {...ctx} sectionTitle="Text" includeBody={false} />
    </>
  ),

  ticker: (ctx) => (
    <>
      <Section title="Ticker">
        <Row>
          <textarea
            value={ctx.item.text || ''}
            onChange={(e) => ctx.updateItem(ctx.item.id, { text: e.target.value })}
            rows={2}
            className="field resize-none"
          />
        </Row>
        <div className="text-[10px] text-textMute">Scrolls right-to-left during preview.</div>
      </Section>
      <TextSection {...ctx} sectionTitle="Text" includeBody={false} />
    </>
  ),

  image: ImageInspector,
  asyncimage: ImageInspector,

  search: (ctx) => <InputFieldInspector {...ctx} />,

  // Navigation Bar — fixed-height (92pt) chrome strip. The style picker
  // swaps between 6 visionOS-kit layouts; structural defaults (item
  // sizes, side padding, item gap) are locked and not user-editable —
  // the user only edits the title text and the leading/trailing button
  // arrays for styles that expose them.
  navbar: ({ item, updateItem }) => {
    const spec = NAVBAR_STYLE_SPECS[item.navbarStyle] || NAVBAR_STYLE_SPECS.trailingButtons
    const editButtons = (key, mutator) => {
      const arr = item[key] || []
      updateItem(item.id, { [key]: mutator(arr) })
    }
    const renderButtonList = (key, label) => {
      const arr = item[key] || []
      const addBtn = () => editButtons(key, (a) => [
        ...a,
        { id: `nb-${key}-${Date.now()}`, symbolName: 'star', label: '', tapAction: null }
      ])
      const updBtn = (i, patch) => editButtons(key, (a) => a.map((b, j) => j === i ? { ...b, ...patch } : b))
      const delBtn = (i) => editButtons(key, (a) => a.filter((_, j) => j !== i))
      return (
        <>
          <div className="text-[10px] text-textMute uppercase tracking-wider mt-2">{label}</div>
          {arr.map((btn, i) => (
            <Row key={btn.id || i} label={`#${i + 1}`}>
              <input
                value={btn.symbolName || ''}
                onChange={(e) => updBtn(i, { symbolName: e.target.value || null })}
                placeholder="SF Symbol (e.g. gear)"
                className="field flex-1"
              />
              <button className="btn btn-icon btn-ghost" onClick={() => delBtn(i)} title="Remove button">×</button>
            </Row>
          ))}
          <button className="btn w-full justify-center mt-1" onClick={addBtn}>+ Add Button</button>
        </>
      )
    }
    // Map a position-in-array to a user-readable button name. Used by
    // the Interaction section's row labels so the user can match the
    // dropdown to the visual button on the canvas.
    const btnLabel = (btn, i, side) => {
      const name = btn.symbolName || btn.label || `Button ${i + 1}`
      return `${side === 'leading' ? 'L' : 'T'}${i + 1} · ${name}`
    }
    const renderInteractionRows = (key, side) => {
      const arr = item[key] || []
      return arr.map((btn, i) => (
        <Row key={`act-${btn.id || i}`} label={btnLabel(btn, i, side)} labelWidth={100}>
          <Select
            value={btn.tapAction?.type || 'none'}
            options={NAVBAR_INTERACTIONS}
            onChange={(v) => {
              const next = v === 'none' ? null : { type: v }
              const updated = arr.map((b, j) => j === i ? { ...b, tapAction: next } : b)
              updateItem(item.id, { [key]: updated })
            }}
          />
        </Row>
      ))
    }
    const showLeadingInteractions  = spec.leading  === 'buttons'
    const showTrailingInteractions = spec.trailing === 'buttons'
    return (
      <>
        <Section title="Navigation Bar" defaultOpen={true}>
          <Row label="Style">
            <Select
              value={item.navbarStyle || 'trailingButtons'}
              options={NAVBAR_STYLES}
              onChange={(v) => updateItem(item.id, { navbarStyle: v })}
            />
          </Row>
          <Row label="Title">
            <input
              value={item.title || ''}
              onChange={(e) => updateItem(item.id, { title: e.target.value })}
              placeholder="Title"
              className="field flex-1"
            />
          </Row>
          <div className="text-[10px] text-textMute leading-snug mt-1">
            Locked: 92pt tall · 24pt side padding · items 44pt · 16pt gap.
            Edge-to-edge across the window.
          </div>
          {spec.leadingEditable  && renderButtonList('leadingButtons',  'Leading buttons')}
          {spec.trailingEditable && renderButtonList('trailingButtons', 'Trailing buttons')}
        </Section>
        {(showLeadingInteractions || showTrailingInteractions) && (
          <Section title="Interaction" defaultOpen={false}>
            <div className="text-[10px] text-textMute leading-snug mb-2">
              What each navbar button does in preview. Wires to the same
              action vocabulary as a Button's tap action.
            </div>
            {showLeadingInteractions  && renderInteractionRows('leadingButtons',  'leading')}
            {showTrailingInteractions && renderInteractionRows('trailingButtons', 'trailing')}
          </Section>
        )}
      </>
    )
  },

  list: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="list" switchPanelType={switchPanelType} item={item} label="Collection" options={COLLECTION_VARIANTS} />
      <Section title="List">
        <Row label="Style">
          <Select
            value={item.listStyle || 'insetGrouped'}
            options={LIST_STYLE_ORDER.map((k) => ({ value: k, label: LIST_STYLES[k].label }))}
            onChange={(v) => updateItem(item.id, { listStyle: v })}
          />
        </Row>
        <div className="text-[10px] text-textMute leading-snug">
          Row height &amp; spacing are fixed by the list style. The list grows
          in height as you add rows; width stays user-editable.
        </div>
        {/*
          Spec §1.19 — list-row modifiers. These attach to each row at
          export time (`.listRowSeparator(...)`, `.listRowBackground(...)`),
          so the values feed the SwiftUI exporter rather than the canvas.
        */}
        <div className="text-[10px] text-textMute uppercase tracking-wider mt-3 mb-1">.listRowSeparator() · .listRowBackground() · .listRowSpacing() · .headerProminence()</div>
        <Row label="Separators">
          <Select
            value={item.listRowSeparator || 'automatic'}
            options={[
              { value: 'automatic', label: 'Automatic' },
              { value: 'visible',   label: 'Visible' },
              { value: 'hidden',    label: 'Hidden' }
            ]}
            onChange={(v) => updateItem(item.id, { listRowSeparator: v })}
          />
        </Row>
        <Row label="Sep Tint">
          <ColorRow
            value={item.listRowSeparatorTint || ''}
            onChange={(v) => updateItem(item.id, { listRowSeparatorTint: v })}
          />
        </Row>
        <Row label="Row BG">
          <ColorRow
            value={item.listRowBackground || ''}
            onChange={(v) => updateItem(item.id, { listRowBackground: v })}
          />
        </Row>
        <Row label="Row Tint">
          <ColorRow
            value={item.listItemTint || ''}
            onChange={(v) => updateItem(item.id, { listItemTint: v })}
          />
        </Row>
        <Row label="Row Spacing">
          <PtField value={item.listRowSpacing ?? 0} onChange={(v) => updateItem(item.id, { listRowSpacing: Math.max(0, v) })} />
        </Row>
        <Row label="Header">
          <Select
            value={item.headerProminence || 'standard'}
            options={[
              { value: 'standard',  label: 'Standard' },
              { value: 'increased', label: 'Increased' }
            ]}
            onChange={(v) => updateItem(item.id, { headerProminence: v })}
          />
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
    </>
  ),

  table: ({ item, updateItem }) => (
    <Section title="Table">
      <Row label="Style">
        <Select value={item.tableStyle || 'automatic'} options={TABLE_STYLES} onChange={(v) => updateItem(item.id, { tableStyle: v })} />
      </Row>
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
  ),

  menu: ({ item, updateItem }) => (
    <Section title="Menu">
      <Row label="Title">
        <input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" placeholder="Menu" />
      </Row>
      <Row label="Items">
        <textarea
          value={(item.menuItems || []).join('\n')}
          onChange={(e) => updateItem(item.id, { menuItems: e.target.value.split('\n').filter(Boolean) })}
          rows={4}
          className="field resize-none"
        />
      </Row>
      <div className="text-[10px] text-textMute">One item per line.</div>
      <Row label="Style">
        <Select value={item.menuStyle || 'automatic'} options={MENU_STYLES} onChange={(v) => updateItem(item.id, { menuStyle: v })} />
      </Row>
      <Row label="Order">
        {/*
          `.menuOrder(_:)` — `.priority` keeps the user's explicit ordering;
          `.fixed` keeps Apple's; `.automatic` is the SwiftUI default.
        */}
        <Select value={item.menuOrder || 'automatic'} options={MENU_ORDER} onChange={(v) => updateItem(item.id, { menuOrder: v })} />
      </Row>
      <Row label="Indicator">
        <Select value={item.menuIndicator || 'automatic'} options={MENU_INDICATOR_VISIBILITY} onChange={(v) => updateItem(item.id, { menuIndicator: v })} />
      </Row>
    </Section>
  ),

  form: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="form" switchPanelType={switchPanelType} item={item} label="Collection" options={COLLECTION_VARIANTS} />
      <Section title="Form">
        {/*
          Spec §1.21 — Form `.automatic` resolves to grouped on visionOS.
          `.columns` is macOS-flavoured but available; emitted only when
          overridden so the device default applies on visionOS.
        */}
        <Row label="Style">
          <Select value={item.formStyle || 'automatic'} options={FORM_STYLES} onChange={(v) => updateItem(item.id, { formStyle: v })} />
        </Row>
      </Section>
    </>
  ),

  groupbox: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="groupbox" switchPanelType={switchPanelType} item={item} label="Collection" options={COLLECTION_VARIANTS} />
      <Section title="GroupBox">
        <Row label="Label"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" placeholder="(none)" /></Row>
        <Row label="Style">
          <Select value={item.groupBoxStyle || 'automatic'} options={GROUP_BOX_STYLES} onChange={(v) => updateItem(item.id, { groupBoxStyle: v })} />
        </Row>
      </Section>
    </>
  ),

  outlinegroup: ({ item, switchPanelType }) => (
    <VariantSwitcher panelType="outlinegroup" switchPanelType={switchPanelType} item={item} label="Collection" options={COLLECTION_VARIANTS} />
  ),

  progress: ({ item, updateItem }) => (
    <Section title="Progress">
      <Row label="Label">
        <input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" placeholder="(none)" />
      </Row>
      <Row label="Determinate">
        <div className="segmented flex-1">
          <button className={!item.indeterminate ? 'active' : ''} onClick={() => updateItem(item.id, { indeterminate: false })}>Yes</button>
          <button className={item.indeterminate ? 'active' : ''} onClick={() => updateItem(item.id, { indeterminate: true })}>No</button>
        </div>
      </Row>
      {!item.indeterminate && (
        <>
          <Row label="Value">
            <Slider value={item.value ?? 0.5} min={0} max={item.total ?? 1} step={0.01} onChange={(v) => updateItem(item.id, { value: v })} />
          </Row>
          {/*
            `total:` defaults to 1.0. Stored so designers can express
            `value: 30, total: 100`-style ratios; the exporter elides the
            `total:` argument when it equals 1.
          */}
          <Row label="Total"><NumField value={item.total ?? 1} step={1} onChange={(v) => updateItem(item.id, { total: Math.max(0.01, v) })} /></Row>
        </>
      )}
      <Row label="Style">
        <Select value={item.progressViewStyle || 'automatic'} options={PROGRESS_VIEW_STYLES} onChange={(v) => updateItem(item.id, { progressViewStyle: v })} />
      </Row>
    </Section>
  ),

  slider: (ctx) => <SliderInspector {...ctx} />,

  stepper: ({ item, updateItem }) => (
    <Section title="Stepper">
      <Row label="Label">
        <input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" placeholder="Stepper" />
      </Row>
      <Row label="Value"><IntField value={item.stepperValue ?? 0} min={item.stepperMin ?? 0} max={item.stepperMax ?? 100} onChange={(v) => updateItem(item.id, { stepperValue: v })} /></Row>
      <Row label="Min"><IntField value={item.stepperMin ?? 0} onChange={(v) => updateItem(item.id, { stepperMin: v })} /></Row>
      <Row label="Max"><IntField value={item.stepperMax ?? 100} onChange={(v) => updateItem(item.id, { stepperMax: v })} /></Row>
      {/*
        SwiftUI Stepper `step:` defaults to 1. Spec §1.6 — emit only when
        the designer overrides so the SwiftUI default keeps applying.
      */}
      <Row label="Step"><IntField value={item.stepperStep ?? 1} min={1} onChange={(v) => updateItem(item.id, { stepperStep: Math.max(1, v) })} /></Row>
    </Section>
  ),

  gauge: ({ item, updateItem }) => (
    <Section title="Gauge">
      <Row label="Value"><Slider value={item.value ?? 0.5} min={item.gaugeMin ?? 0} max={item.gaugeMax ?? 1} step={0.01} onChange={(v) => updateItem(item.id, { value: v })} /></Row>
      <Row label="Min"><NumField value={item.gaugeMin ?? 0} step={1} onChange={(v) => updateItem(item.id, { gaugeMin: v })} /></Row>
      <Row label="Max"><NumField value={item.gaugeMax ?? 1} step={1} onChange={(v) => updateItem(item.id, { gaugeMax: v })} /></Row>
      <Row label="Label"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" placeholder="Current value text" /></Row>
      <Row label="Min Label"><input value={item.gaugeMinLabel || ''} onChange={(e) => updateItem(item.id, { gaugeMinLabel: e.target.value })} className="field flex-1" placeholder="(none)" /></Row>
      <Row label="Max Label"><input value={item.gaugeMaxLabel || ''} onChange={(e) => updateItem(item.id, { gaugeMaxLabel: e.target.value })} className="field flex-1" placeholder="(none)" /></Row>
      <Row label="Style">
        <Select value={item.gaugeStyle || 'automatic'} options={GAUGE_STYLES} onChange={(v) => updateItem(item.id, { gaugeStyle: v })} />
      </Row>
      {/*
        `.tint(_:)` accepts a `Gradient` for capacity gauges. We expose
        a two-stop gradient (from/to); exporter writes `Gradient(colors:)`.
      */}
      <Row label="Gradient">
        <ColorRow value={item.gaugeTintFrom || ''} onChange={(v) => updateItem(item.id, { gaugeTintFrom: v })} />
        <ColorRow value={item.gaugeTintTo || ''} onChange={(v) => updateItem(item.id, { gaugeTintTo: v })} />
      </Row>
    </Section>
  ),

  // ---- Shapes & Gradients ----
  // All shape/gradient panel types share one consolidated inspector. The
  // Geometry picker sits at the top so switching variants is the primary
  // action. PANEL_META marks these as `mergedIdentity` so the generic
  // Object section is suppressed.
  rectangle:        (ctx) => <ShapeInspector {...ctx} />,
  circle:           (ctx) => <ShapeInspector {...ctx} />,
  capsule:          (ctx) => <ShapeInspector {...ctx} />,
  ellipse:          (ctx) => <ShapeInspector {...ctx} />,
  path:             (ctx) => <ShapeInspector {...ctx} />,
  unevenRoundedRect:(ctx) => <ShapeInspector {...ctx} />,
  linearGradient:   (ctx) => <ShapeInspector {...ctx} />,
  radialGradient:   (ctx) => <ShapeInspector {...ctx} />,
  angularGradient:  (ctx) => <ShapeInspector {...ctx} />,

  // ---- Presentations ----
  alert: ({ item, updateItem }) => (
    <Section title="Alert">
      <Row label="Title"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
      <Row label="Message"><textarea value={item.alertMessage || ''} onChange={(e) => updateItem(item.id, { alertMessage: e.target.value })} rows={2} className="field resize-none" /></Row>
      <Row label="Buttons">
        <input
          value={(item.alertButtons || []).join(', ')}
          onChange={(e) => updateItem(item.id, { alertButtons: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          className="field flex-1"
          placeholder="Cancel, OK"
        />
      </Row>
      {/*
        Spec §1.25 — `.dialogIcon`, `.dialogSeverity`, `.dialogSuppressionToggle`.
        `.standard` is the default severity.
      */}
      <Row label="Severity">
        <Select
          value={item.dialogSeverity || 'automatic'}
          options={[
            { value: 'automatic', label: 'Automatic' },
            { value: 'standard',  label: 'Standard' },
            { value: 'critical',  label: 'Critical' }
          ]}
          onChange={(v) => updateItem(item.id, { dialogSeverity: v })}
        />
      </Row>
      <Row label="Icon"><input value={item.dialogIcon || ''} onChange={(e) => updateItem(item.id, { dialogIcon: e.target.value })} className="field flex-1" placeholder="exclamationmark.triangle" /></Row>
      <Row label="Suppress">
        <div className="segmented flex-1">
          <button className={item.dialogSuppressionToggle ? 'active' : ''} onClick={() => updateItem(item.id, { dialogSuppressionToggle: true })}>On</button>
          <button className={!item.dialogSuppressionToggle ? 'active' : ''} onClick={() => updateItem(item.id, { dialogSuppressionToggle: false })}>Off</button>
        </div>
      </Row>
    </Section>
  ),

  sheet: ({ item, updateItem }) => (
    <Section title="Sheet">
      <Row label="Detent">
        <Select
          value={item.sheetDetent || 'large'}
          options={[
            { value: 'medium',     label: 'Medium' },
            { value: 'large',      label: 'Large' },
            { value: 'fraction',   label: 'Fraction' },
            { value: 'height',     label: 'Height (pt)' }
          ]}
          onChange={(v) => updateItem(item.id, { sheetDetent: v })}
        />
      </Row>
      {item.sheetDetent === 'fraction' && (
        <Row label="Fraction"><Slider value={item.sheetFraction ?? 0.5} min={0.1} max={1} step={0.05} onChange={(v) => updateItem(item.id, { sheetFraction: v })} /></Row>
      )}
      {item.sheetDetent === 'height' && (
        <Row label="Height (pt)"><IntField value={item.sheetHeight ?? 320} min={120} onChange={(v) => updateItem(item.id, { sheetHeight: v })} /></Row>
      )}
      {/* Spec §1.25 — full presentation modifier set. */}
      <Row label="Drag">
        <Select
          value={item.presentationDragIndicator || 'automatic'}
          options={[
            { value: 'automatic', label: 'Automatic' },
            { value: 'visible',   label: 'Visible' },
            { value: 'hidden',    label: 'Hidden' }
          ]}
          onChange={(v) => updateItem(item.id, { presentationDragIndicator: v })}
        />
      </Row>
      <Row label="Corner"><PtField value={item.presentationCornerRadius ?? 0} onChange={(v) => updateItem(item.id, { presentationCornerRadius: Math.max(0, v) })} /></Row>
      <Row label="Content Mode">
        <Select
          value={item.presentationContentInteraction || 'automatic'}
          options={[
            { value: 'automatic', label: 'Automatic' },
            { value: 'resizes',   label: 'Resizes' },
            { value: 'scrolls',   label: 'Scrolls' }
          ]}
          onChange={(v) => updateItem(item.id, { presentationContentInteraction: v })}
        />
      </Row>
      <Row label="BG Interact">
        <Select
          value={item.presentationBackgroundInteraction || 'automatic'}
          options={[
            { value: 'automatic', label: 'Automatic' },
            { value: 'enabled',   label: 'Enabled' },
            { value: 'disabled',  label: 'Disabled' }
          ]}
          onChange={(v) => updateItem(item.id, { presentationBackgroundInteraction: v })}
        />
      </Row>
      <Row label="Dismiss Lock">
        <div className="segmented flex-1">
          <button className={item.interactiveDismissDisabled ? 'active' : ''} onClick={() => updateItem(item.id, { interactiveDismissDisabled: true })}>On</button>
          <button className={!item.interactiveDismissDisabled ? 'active' : ''} onClick={() => updateItem(item.id, { interactiveDismissDisabled: false })}>Off</button>
        </div>
      </Row>
      <Row label="Content"><textarea value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} rows={2} className="field resize-none" /></Row>
    </Section>
  ),

  popover: ({ item, updateItem }) => (
    <Section title="Popover">
      <Row label="Content"><textarea value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} rows={2} className="field resize-none" /></Row>
      {/*
        Spec §1.25 — `attachmentAnchor:` defaults to `.rect(.bounds)`.
        `arrowEdge:` is ignored on visionOS but kept here for fidelity to
        the SwiftUI signature.
      */}
      <Row label="Anchor">
        <Select
          value={item.popoverAnchor || 'rectBounds'}
          options={[
            { value: 'rectBounds', label: '.rect(.bounds) (default)' },
            { value: 'point',      label: 'Point' }
          ]}
          onChange={(v) => updateItem(item.id, { popoverAnchor: v })}
        />
      </Row>
      <Row label="Arrow Edge">
        <Select
          value={item.popoverArrowEdge || 'automatic'}
          options={[
            { value: 'automatic', label: 'Automatic' },
            { value: 'top',       label: 'Top' },
            { value: 'bottom',    label: 'Bottom' },
            { value: 'leading',   label: 'Leading' },
            { value: 'trailing',  label: 'Trailing' }
          ]}
          onChange={(v) => updateItem(item.id, { popoverArrowEdge: v })}
        />
      </Row>
      <div className="text-[10px] text-textMute">Arrow edge is ignored on visionOS — popovers extend beyond window bounds.</div>
    </Section>
  ),

  // ---- Phase 3 type editors ----
  label: (ctx) => <LabelInspector {...ctx} />,
  textfield:   (ctx) => <InputFieldInspector {...ctx} />,
  securefield: (ctx) => <InputFieldInspector {...ctx} />,
  texteditor: ({ item, updateItem }) => (
    <Section title="TextEditor">
      <Row label="Lines"><IntField value={item.lineCount || 5} min={1} max={20} onChange={(v) => updateItem(item.id, { lineCount: v })} /></Row>
      <Row label="Placeholder"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
    </Section>
  ),
  picker: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="picker" switchPanelType={switchPanelType} item={item} label="Picker Type" options={PICKER_VARIANTS} />
      <Section title="Picker">
        <Row label="Label"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
        <Row label="Value"><input value={item.pickerValue || ''} onChange={(e) => updateItem(item.id, { pickerValue: e.target.value })} className="field flex-1" /></Row>
        <Row label="Options"><input value={(item.pickerOptions || []).join(', ')} onChange={(e) => updateItem(item.id, { pickerOptions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className="field flex-1" /></Row>
        {/*
          Picker style — `.automatic` resolves to `.menu` on visionOS so we
          keep it as the default and let the exporter elide the modifier.
          `.navigationLink` is included for use inside NavigationStack.
        */}
        <Row label="Style"><Select value={item.pickerStyle || 'automatic'} options={PICKER_STYLES} onChange={(v) => updateItem(item.id, { pickerStyle: v })} /></Row>
      </Section>
    </>
  ),
  datepicker: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="datepicker" switchPanelType={switchPanelType} item={item} label="Picker Type" options={PICKER_VARIANTS} />
      <Section title="DatePicker">
        <Row label="Label"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
        <Row label="Date"><input type="date" value={item.dateValue || ''} onChange={(e) => updateItem(item.id, { dateValue: e.target.value })} className="field flex-1" /></Row>
        {/*
          `displayedComponents:` — defaults to `[.hourAndMinute, .date]`
          (we model that as 'dateAndTime'). visionOS 2 adds `hourMinuteAndSecond`.
        */}
        <Row label="Components">
          <Select value={item.displayedComponents || 'dateAndTime'} options={DATE_COMPONENTS} onChange={(v) => updateItem(item.id, { displayedComponents: v })} />
        </Row>
        <Row label="Style">
          <Select value={item.dateStyle || 'automatic'} options={DATE_PICKER_STYLES} onChange={(v) => updateItem(item.id, { dateStyle: v })} />
        </Row>
      </Section>
    </>
  ),
  colorpicker: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="colorpicker" switchPanelType={switchPanelType} item={item} label="Picker Type" options={PICKER_VARIANTS} />
      <Section title="ColorPicker">
        <Row label="Label"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
        <Row label="Color"><ColorRow value={item.pickedColor || '#ff0000'} onChange={(v) => updateItem(item.id, { pickedColor: v })} /></Row>
        <Row label="Opacity">
          {/*
            `supportsOpacity:` defaults to true (spec §1.9). When the
            designer opts out we omit the alpha slider on the system panel.
          */}
          <div className="segmented flex-1">
            <button className={(item.supportsOpacity ?? true) ? 'active' : ''} onClick={() => updateItem(item.id, { supportsOpacity: true })}>On</button>
            <button className={!(item.supportsOpacity ?? true) ? 'active' : ''} onClick={() => updateItem(item.id, { supportsOpacity: false })}>Off</button>
          </div>
        </Row>
      </Section>
    </>
  ),
  contentUnavailable: ({ item, updateItem }) => (
    <Section title="Empty State">
      <Row label="Title"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
      <Row label="Subtitle"><input value={item.alertMessage || ''} onChange={(e) => updateItem(item.id, { alertMessage: e.target.value })} className="field flex-1" /></Row>
    </Section>
  ),

  // ---- 3D primitives (RealityKit / Model3D) ----
  // Each exposes its native MeshResource parameters in pt; the SwiftUI
  // exporter converts to meters (1 m ≈ 1000 pt).
  //
  // Transform — every 3D primitive shares this. In SwiftUI, Model3D /
  // RealityView are normal SwiftUI views: the parent stack lays them out
  // on X/Y. For Z and orientation:
  //   - `.offset(z: pt)`          — visionOS-only Z translation
  //   - `.rotation3DEffect(…)`     — per-axis rotation in degrees
  // These are emitted by the SwiftUI exporter for any 3D primitive that
  // sets non-zero values.

  sphere: (ctx) => (
    <>
      <Section title="Sphere">
        <Row label="Radius"><PtField value={ctx.item.radius ?? 80} onChange={(v) => ctx.updateItem(ctx.item.id, { radius: Math.max(1, v) })} /></Row>
        <Row label="Depth"><PtField value={ctx.item.depth ?? 160} onChange={(v) => ctx.updateItem(ctx.item.id, { depth: Math.max(0, v) })} /></Row>
        <div className="text-[10px] text-textMute">.frame(depth:) reserves Z-room around the sphere.</div>
      </Section>
      <TransformSection {...ctx} />
    </>
  ),
  box: (ctx) => (
    <>
      <Section title="Box">
        <Row label="W"><PtField value={ctx.item.boxWidth  ?? 120} onChange={(v) => ctx.updateItem(ctx.item.id, { boxWidth:  Math.max(1, v) })} /></Row>
        <Row label="H"><PtField value={ctx.item.boxHeight ?? 120} onChange={(v) => ctx.updateItem(ctx.item.id, { boxHeight: Math.max(1, v) })} /></Row>
        <Row label="D"><PtField value={ctx.item.boxDepth  ?? 120} onChange={(v) => ctx.updateItem(ctx.item.id, { boxDepth:  Math.max(1, v) })} /></Row>
        <Row label="Radius"><PtField value={ctx.item.boxCornerRadius ?? 0} onChange={(v) => ctx.updateItem(ctx.item.id, { boxCornerRadius: Math.max(0, v) })} /></Row>
        <Row label="Frame Depth"><PtField value={ctx.item.depth ?? 160} onChange={(v) => ctx.updateItem(ctx.item.id, { depth: Math.max(0, v) })} /></Row>
      </Section>
      <TransformSection {...ctx} />
    </>
  ),
  plane: (ctx) => (
    <>
      <Section title="Plane">
        <Row label="W"><PtField value={ctx.item.planeWidth ?? 200} onChange={(v) => ctx.updateItem(ctx.item.id, { planeWidth: Math.max(1, v) })} /></Row>
        <Row label="D"><PtField value={ctx.item.planeDepth ?? 140} onChange={(v) => ctx.updateItem(ctx.item.id, { planeDepth: Math.max(1, v) })} /></Row>
        <Row label="Frame Depth"><PtField value={ctx.item.depth ?? 40} onChange={(v) => ctx.updateItem(ctx.item.id, { depth: Math.max(0, v) })} /></Row>
      </Section>
      <TransformSection {...ctx} />
    </>
  ),
  cone: (ctx) => (
    <>
      <Section title="Cone">
        <Row label="Radius"><PtField value={ctx.item.coneRadius ?? 70}  onChange={(v) => ctx.updateItem(ctx.item.id, { coneRadius: Math.max(1, v) })} /></Row>
        <Row label="Height"><PtField value={ctx.item.coneHeight ?? 180} onChange={(v) => ctx.updateItem(ctx.item.id, { coneHeight: Math.max(1, v) })} /></Row>
        <Row label="Frame Depth"><PtField value={ctx.item.depth ?? 180} onChange={(v) => ctx.updateItem(ctx.item.id, { depth: Math.max(0, v) })} /></Row>
      </Section>
      <TransformSection {...ctx} />
    </>
  ),
  cylinder: (ctx) => (
    <>
      <Section title="Cylinder">
        <Row label="Radius"><PtField value={ctx.item.cylRadius ?? 70}  onChange={(v) => ctx.updateItem(ctx.item.id, { cylRadius: Math.max(1, v) })} /></Row>
        <Row label="Height"><PtField value={ctx.item.cylHeight ?? 180} onChange={(v) => ctx.updateItem(ctx.item.id, { cylHeight: Math.max(1, v) })} /></Row>
        <Row label="Frame Depth"><PtField value={ctx.item.depth ?? 180} onChange={(v) => ctx.updateItem(ctx.item.id, { depth: Math.max(0, v) })} /></Row>
      </Section>
      <TransformSection {...ctx} />
    </>
  ),
  text3d: (ctx) => (
    <>
      <Section title="3D Text">
        <Row label="Text"><input value={ctx.item.text || ''} onChange={(e) => ctx.updateItem(ctx.item.id, { text: e.target.value })} className="field flex-1" /></Row>
        <Row label="Extrude"><PtField value={ctx.item.extrusionDepth ?? 20} onChange={(v) => ctx.updateItem(ctx.item.id, { extrusionDepth: Math.max(0, v) })} /></Row>
        <Row label="Frame Depth"><PtField value={ctx.item.depth ?? 60} onChange={(v) => ctx.updateItem(ctx.item.id, { depth: Math.max(0, v) })} /></Row>
        <div className="text-[10px] text-textMute">Text3D requires visionOS 2.0+.</div>
      </Section>
      <TransformSection {...ctx} />
    </>
  ),
  mesh: (ctx) => (
    <>
      <Section title="Custom Mesh">
        <Row label="Asset"><input value={ctx.item.meshAsset || ''} onChange={(e) => ctx.updateItem(ctx.item.id, { meshAsset: e.target.value })} className="field flex-1" placeholder="Earth" /></Row>
        <Row label="Frame Depth"><PtField value={ctx.item.depth ?? 200} onChange={(v) => ctx.updateItem(ctx.item.id, { depth: Math.max(0, v) })} /></Row>
        <div className="text-[10px] text-textMute">USDZ asset name in your Xcode project bundle. RealityView/Model3D sit inside the parent stack — the stack handles X/Y placement just like for 2D views.</div>
      </Section>
      <TransformSection {...ctx} />
    </>
  ),

  // RealityView — bridge from SwiftUI into the RealityKit entity tree.
  // Children are entities (anchor / model / group), edited in their own
  // EntityProps inspector — this section configures the bridge itself.
  realityview: ({ item, updateItem }) => (
    <>
      <Section title="RealityView">
        <Row label="Camera">
          <Select
            value={item.cameraMode || 'spatialTracking'}
            options={[
              { value: 'spatialTracking', label: 'Spatial tracking (visionOS)' },
              { value: 'nonAR',           label: 'Non-AR' },
              { value: 'virtualReality',  label: 'Virtual reality' }
            ]}
            onChange={(v) => updateItem(item.id, { cameraMode: v })}
          />
        </Row>
        <Row label="Axes">
          <div className="segmented flex-1">
            <button
              className={item.showAnchorAxes ? 'active' : ''}
              onClick={() => updateItem(item.id, { showAnchorAxes: true })}
              title="Draw an XYZ gizmo at the RealityView origin (designer only)"
            >On</button>
            <button
              className={!item.showAnchorAxes ? 'active' : ''}
              onClick={() => updateItem(item.id, { showAnchorAxes: false })}
            >Off</button>
          </div>
        </Row>
        <div className="text-[10px] text-textMute leading-snug mt-1">
          Add entities to this RealityView from the layers panel — anchors,
          model entities, and groups become children here. The SwiftUI
          exporter emits a <code>RealityView</code> shell; the entity body
          will land with the RealityKit exporter.
        </div>
      </Section>
    </>
  )
}

// Shared transform editor — Z offset (visionOS .offset(z:)) plus rotation
// X/Y/Z (degrees, fed to .rotation3DEffect). Used by every 3D primitive
// inspector. Kept here rather than in shared.jsx because it's only ever
// rendered for 3D types.
function TransformSection({ item, updateItem }) {
  return (
    <Section title="Transform" defaultOpen={false}>
      <div className="text-[9px] text-textMute uppercase tracking-wider mb-1">.offset(z:) — visionOS depth</div>
      <Row label="Z">
        <PtField value={item.zOffset ?? 0} onChange={(v) => updateItem(item.id, { zOffset: v })} />
      </Row>
      <div className="text-[9px] text-textMute uppercase tracking-wider mt-3 mb-1">.rotation3DEffect(…) — degrees per axis</div>
      <Row label="Rot X"><NumField value={item.rotX ?? 0} step={1} onChange={(v) => updateItem(item.id, { rotX: v })} suffix="\u00b0" /></Row>
      <Row label="Rot Y"><NumField value={item.rotY ?? 0} step={1} onChange={(v) => updateItem(item.id, { rotY: v })} suffix="\u00b0" /></Row>
      <Row label="Rot Z"><NumField value={item.rotZ ?? 0} step={1} onChange={(v) => updateItem(item.id, { rotZ: v })} suffix="\u00b0" /></Row>
      <div className="text-[10px] text-textMute leading-relaxed mt-1">
        Stacks place 3D content the same way they place 2D views (X / Y).
        Use this section for the Z axis and orientation — those map to
        SwiftUI <code>.offset(z:)</code> and <code>.rotation3DEffect(…)</code>.
      </div>
    </Section>
  )
}

// ---- per-type metadata ------------------------------------------------
//
// Used by PanelProps to decide which shared scaffolding to render:
//   hasFill          - render Appearance rows (fill / radius)
//   frameMode        - 'figma' (text/link, fit/fixed/fill picker),
//                      'explicit' (width+height fields), 'none'
//   useSymbol        - render the SF Symbol section
//   lockHeight       - hide Height field in explicit Frame
//   lockHeightHint   - replacement caption when lockHeight is set

const figmaFrame = { frameMode: 'figma', hasFill: false }
const explicitFrame = { frameMode: 'explicit', hasFill: true }
// `mergedIdentity` panels own the Name field inside their own per-type
// inspector — the generic "Object — X" section is suppressed so the
// inspector reads as a single tidy section. Text is the canonical case:
// Name + Frame + Text controls all under one "Text" header.
const mergedFigmaFrame = { frameMode: 'figma', hasFill: false, mergedIdentity: true }

// Panel types whose SwiftUI emit takes a `systemImage:` argument or otherwise
// renders an SF Symbol glyph. Only these get the SF Symbol picker — the
// section was previously rendered for every panel, which produced an empty
// header on Text, Image, Slider, Progress, etc.
const SYMBOL_USERS = new Set([
  // `label` and `button` own their symbol picker inside their own
  // consolidated section, so they're intentionally excluded here —
  // keeping them would double up the SF Symbol section (one inside the
  // merged inspector, one stand-alone).
  'link', 'navigationlink', 'contentUnavailable',
  'toggle', 'picker', 'menu'
])

// Shapes and gradients own Name + Geometry + Frame + Fill/Stops + Stroke
// inside their unified `ShapeInspector`. `mergedIdentity: true` tells
// PanelProps to skip the generic "Object — X" header.
const mergedShape = { frameMode: 'none', hasFill: false, mergedIdentity: true }

export const PANEL_META = {
  text: mergedFigmaFrame,
  link: { ...figmaFrame, useSymbol: true },
  // Label owns Name + Frame + Title + Icon + Symbol + Style + ImgScale +
  // Mode + Variant inside one consolidated section. mergedIdentity drops
  // the generic "Object — Label" header; useSymbol stays false (already
  // excluded from SYMBOL_USERS) so the stand-alone SF Symbol section
  // isn't rendered next to the merged one.
  label: { frameMode: 'explicit', hasFill: true, mergedIdentity: true },
  list: { ...explicitFrame, lockHeight: true, lockHeightHint: 'Height is auto — grows with the row count at the style\'s fixed row height.' },
  // Button owns Name + Size/Style/Role/Tint + Label + SF Symbol inside
  // one consolidated section. mergedIdentity drops the generic "Object —
  // Button" header; frameMode 'none' is moot once merged (the inspector
  // controls size via the Size preset). Excluded from SYMBOL_USERS so the
  // stand-alone SF Symbol section isn't rendered alongside the merged one.
  button: { frameMode: 'none', hasFill: false, mergedIdentity: true },
  // Slider owns Name + Frame + range + control Size in one section; no
  // Fill (a SwiftUI Slider has no background plate).
  slider: { frameMode: 'explicit', hasFill: false, mergedIdentity: true },
  // Image / AsyncImage own Name + Frame + Appearance + media controls in
  // one consolidated section.
  image:      { frameMode: 'explicit', hasFill: false, mergedIdentity: true },
  asyncimage: { frameMode: 'explicit', hasFill: false, mergedIdentity: true },
  // Input fields (TextField / SecureField / search) own Name + Input Type +
  // Frame + Edge + per-variant controls + Size in one consolidated section.
  textfield:   { frameMode: 'explicit', hasFill: false, mergedIdentity: true },
  securefield: { frameMode: 'explicit', hasFill: false, mergedIdentity: true },
  search:      { frameMode: 'explicit', hasFill: false, mergedIdentity: true },
  // Segmented owns Name + Frame + Count/Items/Selected + Material in one
  // consolidated section. No Fill — the track Material is its only
  // appearance control.
  segmented:   { frameMode: 'none', hasFill: false, mergedIdentity: true },
  // Navbar is locked to 92pt height / parent-width — the user only edits
  // style, title, and the button arrays in the per-type inspector.
  navbar: { frameMode: 'none', hasFill: false },
  // Shapes & gradients — single consolidated section
  rectangle:         mergedShape,
  circle:            mergedShape,
  capsule:           mergedShape,
  ellipse:           mergedShape,
  path:              mergedShape,
  unevenRoundedRect: mergedShape,
  linearGradient:    mergedShape,
  radialGradient:    mergedShape,
  angularGradient:   mergedShape,
  // Default for everything else: explicit frame + has fill
}

export const getPanelMeta = (panelType) => {
  const base = PANEL_META[panelType] || explicitFrame
  // Auto-derive `useSymbol` from the symbol-users set when not explicitly set.
  return { useSymbol: SYMBOL_USERS.has(panelType), ...base }
}
