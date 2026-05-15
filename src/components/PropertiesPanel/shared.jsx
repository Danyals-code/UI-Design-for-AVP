// Shared inspector sections — composed by per-domain inspectors and by the
// per-panelType inspectors in src/panels/inspectors.jsx. Each section is a
// React component that reads from the supplied `item` and writes via the
// supplied store actions; they're parameterised so the registry-driven
// PanelProps can pass everything in one ctx prop.

import { useState } from 'react'
import {
  TEXT_STYLES, TEXT_STYLE_ORDER,
  resolveSemantic,
  BUTTON_STYLES,
  TOGGLE_STYLES, PICKER_STYLES, LABEL_STYLES, TEXTFIELD_STYLES,
  CONTROL_SIZES,
  LIST_STYLES, LIST_STYLE_ORDER,
  SF_SYMBOLS,
  SYMBOL_RENDERING_MODES, SYMBOL_VARIANTS,
  ANIMATION_CURVES, TRANSITION_TYPES,
  ACCESSIBILITY_TRAITS,
  ptToUnits
} from '../../appleSystem'
import {
  Row, Section, NumField, IntField, PtField, Slider,
  ColorRow, Select, SemanticColorPicker
} from './primitives'
import SymbolPicker from '../SymbolPicker'

// ---- Frame variants ----------------------------------------------------

// Text & Link use a Figma-style fit/fixed/fill picker that maps onto SwiftUI
// frame semantics. Everything else uses the explicit width/height fields.
export function FigmaFrameSection({ item, updateItem, embedded = false }) {
  // When `embedded`, render rows inside a Fragment so the parent
  // section header carries the heading. Standalone usage keeps the
  // dedicated "Frame" section so non-Object call-sites still read
  // correctly.
  const Wrap = embedded ? FrameInline : FrameStandalone
  return (
    <Wrap>
      <Row label="Width">
        <div className="segmented flex-1">
          <button
            className={(item.widthMode || 'fit') === 'fit' ? 'active' : ''}
            onClick={() => updateItem(item.id, { widthMode: 'fit' })}
            title="Hug contents (SwiftUI default — Text is intrinsic)"
          >Fit</button>
          <button
            className={item.widthMode === 'fixed' ? 'active' : ''}
            onClick={() => {
              const next = Array.isArray(item.size) ? item.size : [ptToUnits(200), ptToUnits(40)]
              updateItem(item.id, { widthMode: 'fixed', size: next })
            }}
            title=".frame(width:) — explicit width"
          >Fixed</button>
          <button
            className={item.widthMode === 'fill' ? 'active' : ''}
            onClick={() => updateItem(item.id, { widthMode: 'fill' })}
            title=".frame(maxWidth: .infinity) — fill parent stack width"
          >Fill</button>
        </div>
      </Row>
      {item.widthMode === 'fixed' && Array.isArray(item.size) && (
        <Row label="Size">
          <PtField
            value={item.size[0]}
            onChange={(v) => updateItem(item.id, { size: [Math.max(0.05, v), item.size[1] ?? ptToUnits(40)] })}
          />
          <PtField
            value={item.size[1] ?? ptToUnits(40)}
            onChange={(v) => updateItem(item.id, { size: [item.size[0], Math.max(0.05, v)] })}
          />
        </Row>
      )}
    </Wrap>
  )
}

// Helpers: pick a Section header or a Fragment depending on whether
// the parent already supplies a heading.
function FrameStandalone({ children }) { return <Section title="Frame">{children}</Section> }
function FrameInline({ children })     { return <>{children}</> }

export function ExplicitFrameSection({ item, updateItem, lockHeight = false, lockHeightHint = null }) {
  if (!item.size) {
    return (
      <Section title="Frame">
        <div className="text-[10px] text-textMute">Auto-sized from content (SwiftUI default).</div>
        <button
          className="btn w-full justify-center mt-1"
          onClick={() => updateItem(item.id, { size: [ptToUnits(200), ptToUnits(40)] })}
        >Set explicit frame</button>
      </Section>
    )
  }
  return (
    <Section title="Frame">
      <Row label="Width"><PtField value={item.size[0]} onChange={(v) => updateItem(item.id, { size: [Math.max(0.05, v), item.size[1]] })} /></Row>
      {lockHeight ? (
        <div className="text-[10px] text-textMute">{lockHeightHint || 'Height is auto.'}</div>
      ) : (
        <Row label="Height"><PtField value={item.size[1]} onChange={(v) => updateItem(item.id, { size: [item.size[0], Math.max(0.05, v)] })} /></Row>
      )}
    </Section>
  )
}

// ---- Combined Layout (frame + appearance) ----------------------------
//
// For non-text panels these two were always edited together — the user
// almost never resizes a frame without also touching its fill or radius.
// Merging them into one "Layout" section halves the inspector's scroll
// distance for the most common case.
export function LayoutSection({ item, updateItem, scene, lockHeight = false, lockHeightHint = null, embedded = false }) {
  const scheme = scene?.designScheme || 'light'
  const hasSize = !!item.size
  const Wrap = embedded ? LayoutInline : LayoutStandalone
  return (
    <Wrap>
      {hasSize ? (
        <>
          <Row label="Width"><PtField value={item.size[0]} onChange={(v) => updateItem(item.id, { size: [Math.max(0.05, v), item.size[1]] })} /></Row>
          {lockHeight ? (
            <div className="text-[10px] text-textMute">{lockHeightHint || 'Height is auto.'}</div>
          ) : (
            <Row label="Height"><PtField value={item.size[1]} onChange={(v) => updateItem(item.id, { size: [item.size[0], Math.max(0.05, v)] })} /></Row>
          )}
        </>
      ) : (
        <>
          <div className="text-[10px] text-textMute">Auto-sized from content (SwiftUI default).</div>
          <button
            className="btn w-full justify-center mt-1"
            onClick={() => updateItem(item.id, { size: [ptToUnits(200), ptToUnits(40)] })}
          >Set explicit frame</button>
        </>
      )}
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
      <Row label="Radius">
        <PtField value={item.cornerRadius ?? 0} onChange={(v) => updateItem(item.id, { cornerRadius: Math.max(0, v) })} />
      </Row>
    </Wrap>
  )
}

function LayoutStandalone({ children }) { return <Section title="Layout" defaultOpen={true}>{children}</Section> }
function LayoutInline({ children })     { return <>{children}</> }

// ---- Appearance --------------------------------------------------------

export function AppearanceSection({ item, updateItem, scene }) {
  const scheme = scene?.designScheme || 'light'
  return (
    <Section title="Appearance">
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
      <Row label="Radius">
        <PtField value={item.cornerRadius ?? 0} onChange={(v) => updateItem(item.id, { cornerRadius: Math.max(0, v) })} />
      </Row>
    </Section>
  )
}

// ---- Text section (shared by text/button/slideshow/ticker) -------------

export function TextSection({ item, updateItem, applyTextStyle, scene, sectionTitle = 'Text', includeBody = true, includeAlign = true, includeWeight = true, isText = false, embedded = false }) {
  const scheme = scene?.designScheme || 'light'
  // `embedded` skips the outer <Section> so the caller can render the
  // text controls inline within another section header — used by the
  // consolidated Button inspector where label text sits below the
  // style pickers in one merged "Button" dropdown.
  const Wrapper = embedded ? (({ children }) => <>{children}</>) : (({ children }) => <Section title={sectionTitle}>{children}</Section>)
  return (
    <Wrapper>
      {includeBody && (
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
      {includeWeight && (
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
      )}
      <Row label={isText ? 'Color' : 'Text'}>
        <SemanticColorPicker
          token={isText ? item.colorToken : item.textColorToken}
          onChange={(t) => {
            if (isText) {
              if (t) updateItem(item.id, { colorToken: t, color: resolveSemantic(t, scene) })
              else updateItem(item.id, { colorToken: null })
            } else {
              if (t) updateItem(item.id, { textColorToken: t, textColor: resolveSemantic(t, scene) })
              else updateItem(item.id, { textColorToken: null })
            }
          }}
        />
      </Row>
      {includeAlign && (
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
      )}
    </Wrapper>
  )
}

// ---- Modifier sections (removed) --------------------------------------
//
// `TextModifiers`, `UniversalModifiers`, and `VisionChromeRows` previously
// lived here as flat-object editors over `item.modifiers`. Modifiers are now
// an ordered array rendered by `ModifierStack`, sourced from a SwiftUI-
// faithful registry (`src/modifiers/registry.js`) with strict per-view allow
// lists. The inspector only offers the modifiers SwiftUI accepts on the
// selected view, and chain order matches the export.


// ---- Styles section (controls per-control "style" pickers) ------------

export function StylesSection({ item, updateItem }) {
  const t = item.panelType
  const isToggle = t === 'toggle'
  const isPicker = t === 'picker'
  const isLabel  = t === 'label'
  const isTextField = t === 'textfield' || t === 'securefield'
  return (
    <Section title="Styles" defaultOpen={false}>
      {isToggle    && <Row label="Toggle"><Select value={item.styles?.toggleStyle || 'switch'} options={TOGGLE_STYLES} onChange={(v) => updateItem(item.id, { styles: { ...item.styles, toggleStyle: v } })} /></Row>}
      {isPicker    && <Row label="Picker"><Select value={item.styles?.pickerStyle || 'menu'} options={PICKER_STYLES} onChange={(v) => updateItem(item.id, { styles: { ...item.styles, pickerStyle: v } })} /></Row>}
      {isLabel     && <Row label="Label"><Select value={item.styles?.labelStyle || 'titleAndIcon'} options={LABEL_STYLES} onChange={(v) => updateItem(item.id, { styles: { ...item.styles, labelStyle: v } })} /></Row>}
      {isTextField && <Row label="TextField"><Select value={item.styles?.textFieldStyle || 'roundedBorder'} options={TEXTFIELD_STYLES} onChange={(v) => updateItem(item.id, { styles: { ...item.styles, textFieldStyle: v } })} /></Row>}
      <Row label="Size"><Select value={item.styles?.controlSize || 'regular'} options={CONTROL_SIZES} onChange={(v) => updateItem(item.id, { styles: { ...item.styles, controlSize: v } })} /></Row>
    </Section>
  )
}

// ---- SF Symbol section -----------------------------------------------

export function SymbolSection({ item, updateItem }) {
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

// ---- Animation ---------------------------------------------------------

export function AnimationSection({ item, updateItem }) {
  return (
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
  )
}

// ---- Accessibility ---------------------------------------------------

export function AccessibilitySection({ item, updateItem }) {
  return (
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
  )
}

export function InfoSection({ item }) {
  return (
    <Section title="Info" defaultOpen={false}>
      <div className="text-[10px] text-textMute font-mono">ID: {item.id}</div>
    </Section>
  )
}

// ---- ListStyle helpers re-exports for inspectors ---------------------

export { LIST_STYLES, LIST_STYLE_ORDER, BUTTON_STYLES }
