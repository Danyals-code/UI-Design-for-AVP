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
export function FigmaFrameSection({ item, updateItem }) {
  return (
    <Section title="Frame">
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
      <div className="text-[10px] text-textMute leading-relaxed mt-1">
        {item.widthMode === 'fill'
          ? 'Fills the parent stack\u2019s inner width. Padding still applies.'
          : item.widthMode === 'fixed'
          ? 'Uses the explicit size below. Content that overflows is truncated by .lineLimit.'
          : 'Hugs the content \u2014 the native SwiftUI Text behaviour.'}
      </div>
    </Section>
  )
}

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

// ---- Appearance --------------------------------------------------------

export function AppearanceSection({ item, updateItem, scene }) {
  const scheme = scene?.designScheme || 'light'
  return (
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
  )
}

// ---- Text section (shared by text/button/slideshow/ticker) -------------

export function TextSection({ item, updateItem, applyTextStyle, scene, sectionTitle = 'Text', includeBody = true, includeAlign = true, includeWeight = true, isText = false }) {
  const scheme = scene?.designScheme || 'light'
  return (
    <Section title={sectionTitle}>
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
              if (t) updateItem(item.id, { colorToken: t, color: resolveSemantic(t, scheme) })
              else updateItem(item.id, { colorToken: null })
            } else {
              if (t) updateItem(item.id, { textColorToken: t, textColor: resolveSemantic(t, scheme) })
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
    </Section>
  )
}

// ---- Modifier sections -------------------------------------------------

// Text & Link modifiers — narrower set that matches what SwiftUI's `Text` /
// `Link` actually respond to. Keeps `.italic()`, `.underline()`, `.lineLimit()`
// etc. on the panel root rather than in `.modifiers`.
export function TextModifiers({ item, updateItem }) {
  const m = item.modifiers || {}
  const upd = (patch) => updateItem(item.id, { modifiers: { ...m, ...patch } })
  const setField = (patch) => updateItem(item.id, patch)
  return (
    <Section title="Modifiers" defaultOpen={false}>
      <div className="text-[9px] text-textMute uppercase tracking-wider mb-1">.italic() · .underline() · .strikethrough()</div>
      <Row label="Italic">
        <div className="segmented flex-1">
          <button className={item.italic ? 'active' : ''} onClick={() => setField({ italic: true })}>On</button>
          <button className={!item.italic ? 'active' : ''} onClick={() => setField({ italic: false })}>Off</button>
        </div>
      </Row>
      <Row label="Underline">
        <div className="segmented flex-1">
          <button className={item.underline ? 'active' : ''} onClick={() => setField({ underline: true })}>On</button>
          <button className={!item.underline ? 'active' : ''} onClick={() => setField({ underline: false })}>Off</button>
        </div>
      </Row>
      <Row label="Strike">
        <div className="segmented flex-1">
          <button className={item.strikethrough ? 'active' : ''} onClick={() => setField({ strikethrough: true })}>On</button>
          <button className={!item.strikethrough ? 'active' : ''} onClick={() => setField({ strikethrough: false })}>Off</button>
        </div>
      </Row>

      <div className="text-[9px] text-textMute uppercase tracking-wider mt-3 mb-1">.textCase() · .lineLimit() · .lineSpacing() · .tracking()</div>
      <Row label="Case">
        <Select
          value={item.textCase || 'none'}
          options={[
            { value: 'none',      label: 'None' },
            { value: 'uppercase', label: 'UPPERCASE' },
            { value: 'lowercase', label: 'lowercase' }
          ]}
          onChange={(v) => setField({ textCase: v })}
        />
      </Row>
      <Row label="Lines"><IntField value={item.lineLimit ?? 0} min={0} max={20} onChange={(v) => setField({ lineLimit: Math.max(0, v) })} /></Row>
      <Row label="Line Sp."><PtField value={item.lineSpacing ?? 0} onChange={(v) => setField({ lineSpacing: Math.max(0, v) })} /></Row>
      <Row label="Tracking"><NumField value={item.tracking ?? 0} step={0.1} onChange={(v) => setField({ tracking: v })} suffix="pt" /></Row>

      <div className="text-[9px] text-textMute uppercase tracking-wider mt-3 mb-1">.opacity()</div>
      <Row label="Opacity">
        <Slider value={m.opacity ?? 1} min={0} max={1} step={0.01} onChange={(v) => upd({ opacity: v })} />
      </Row>

      <div className="text-[9px] text-textMute uppercase tracking-wider mt-3 mb-1">.shadow()</div>
      <Row label="Color"><ColorRow value={m.shadowColor || '#000000'} onChange={(v) => upd({ shadowColor: v })} /></Row>
      <Row label="Radius"><IntField value={m.shadowRadius ?? 0} min={0} onChange={(v) => upd({ shadowRadius: v })} /></Row>
      <Row label="X / Y">
        <IntField value={m.shadowX ?? 0} onChange={(v) => upd({ shadowX: v })} />
        <IntField value={m.shadowY ?? 0} onChange={(v) => upd({ shadowY: v })} />
      </Row>

      <div className="text-[9px] text-textMute uppercase tracking-wider mt-3 mb-1">.rotationEffect() · .scaleEffect() · .offset()</div>
      <Row label="Rotation"><NumField value={m.rotation ?? 0} step={1} onChange={(v) => upd({ rotation: v })} suffix="°" /></Row>
      <Row label="Scale X"><NumField value={m.scaleX ?? 1} step={0.05} onChange={(v) => upd({ scaleX: v })} /></Row>
      <Row label="Scale Y"><NumField value={m.scaleY ?? 1} step={0.05} onChange={(v) => upd({ scaleY: v })} /></Row>
      <Row label="Offset X"><IntField value={m.offsetX ?? 0} onChange={(v) => upd({ offsetX: v })} /><span className="text-[9px] text-textMute">pt</span></Row>
      <Row label="Offset Y"><IntField value={m.offsetY ?? 0} onChange={(v) => upd({ offsetY: v })} /><span className="text-[9px] text-textMute">pt</span></Row>
    </Section>
  )
}

export function UniversalModifiers({ item, updateItem }) {
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
