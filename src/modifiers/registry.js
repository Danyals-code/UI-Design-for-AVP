// SwiftUI modifier registry — Blender-style stacked modifiers.
//
// Each `item.modifiers` is an ordered array of `{ id, type, ...args }`. The
// inspector renders one row per entry (collapsible, reorderable, deletable),
// and the user adds new entries from a dropdown filtered to the modifiers
// SwiftUI actually accepts on that view kind. The order in the array is the
// SwiftUI chain order — `.padding(12).background(...)` ≠ the reverse, and the
// designer sees that fidelity in the canvas + export.
//
// `viewKind(item)` returns the lookup key used for filtering: a panel's
// `panelType` (`'text'`, `'button'`, …), or `'stack'` / `'window'` for the
// container item types. `getAllowedModifiers(kind)` returns the strict allow
// list — adding a modifier to a view that SwiftUI rejects is impossible
// because that modifier never appears in the dropdown for that view.

import { GLASS_DISPLAY_MODES, GLASS_SHAPES, CONTAINER_BG_PLACEMENTS } from '../appleSystem'

// ---- view-kind helpers --------------------------------------------------

export const viewKind = (item) => {
  if (!item) return null
  if (item.type === 'stack')  return 'stack'
  if (item.type === 'window') return 'window'
  if (item.type === 'panel')  return item.panelType
  return null
}

// 3D primitives have their own dedicated transform section (Z offset,
// rotation3DEffect, frame(depth:)). They also reject most 2D modifiers, so
// they get an empty modifier-stack — the inspector hides the section entirely.
const KIND_3D = new Set(['sphere', 'box', 'plane', 'cone', 'cylinder', 'text3d', 'mesh'])

// Presentation panels are conceptually `.sheet(...)` / `.alert(...)` modifiers
// on the parent — they don't accept their own modifier chain in the inspector
// sense. Hide the stack on those too.
const KIND_PRESENTATION = new Set(['sheet', 'popover', 'alert', 'confirmationdialog', 'inspector'])

const KIND_INTERACTIVE = new Set([
  'button', 'link', 'toggle', 'slider', 'stepper', 'picker',
  'datepicker', 'colorpicker', 'segmented', 'menu',
  'textfield', 'securefield', 'texteditor', 'search'
])

// Views that render text — accept the text-display modifier family
// (.italic / .underline / .lineLimit / .tracking / …). Text + Link are pure
// Text, the rest carry a label that SwiftUI lets you style with the same
// chain (Button, Label, Ticker, Slideshow, Text3D).
const KIND_TEXTUAL = new Set(['text', 'link', 'button', 'label', 'ticker', 'slideshow', 'text3d'])

// Views that render a tintable shape/icon — accept `.foregroundStyle()`.
// Includes textual views (foregroundStyle replaces .foregroundColor) plus
// shapes/symbols/images.
const KIND_TINTABLE = new Set([
  ...KIND_TEXTUAL,
  'image', 'asyncimage',
  'rectangle', 'circle', 'capsule', 'ellipse', 'unevenRoundedRect', 'path',
  'divider', 'progress', 'gauge'
])

// Views with a layout box that `.padding()` / `.border()` / `.clipShape()`
// can wrap. Stack + Window are containers; almost every concrete panel has a
// frame too. 3D primitives + presentation panels are the explicit no.
const has2DBox = (kind) =>
  kind && !KIND_3D.has(kind) && !KIND_PRESENTATION.has(kind)

// ---- modifier definitions ----------------------------------------------
//
// Each entry:
//   type        — internal id, also stored on item.modifiers[i].type
//   swiftName   — SwiftUI method name shown as the row title
//   group       — dropdown grouping label
//   defaults    — fresh args when added
//   appliesTo   — function (kind) => boolean — STRICT, used by the dropdown
//   Inspector   — ({ args, set }) => JSX for the row body
//   summarize   — (args, acc) => mutates a flat preview accumulator (used by
//                 Panel3D so the canvas can render the visual effect)
//   emit        — (args, panel) => string | string[] | null — SwiftUI lines

const isOn = (v) => v === true

// Compact <Row> renderer — kept inline to avoid pulling the full inspector
// primitives into this file. The actual inspector imports primitives.jsx and
// passes the rendered children back through.

const allKinds = (kinds) => (k) => kinds.has(k)
const containerOnly = (k) => k === 'stack' || k === 'window'

export const MODIFIERS = {
  // ---- universal layout / opacity --------------------------------------
  opacity: {
    type: 'opacity',
    swiftName: '.opacity',
    group: 'Effect',
    defaults: { value: 1.0 },
    appliesTo: has2DBox,
    summarize(args, acc) { acc.opacity = args.value },
    emit(args) {
      if (args.value == null || args.value === 1) return null
      return `.opacity(${args.value})`
    }
  },

  padding: {
    type: 'padding',
    swiftName: '.padding',
    group: 'Layout',
    defaults: { edges: 'all', length: 8 },
    appliesTo: has2DBox,
    summarize() {}, // padding doesn't reflow our canvas — preview is approximate
    emit(args) {
      const len = args.length ?? 0
      if (!args.edges || args.edges === 'all') {
        return len ? `.padding(${len})` : `.padding()`
      }
      return len
        ? `.padding(.${args.edges}, ${len})`
        : `.padding(.${args.edges})`
    }
  },

  offset: {
    type: 'offset',
    swiftName: '.offset',
    group: 'Transform',
    defaults: { x: 0, y: 0 },
    appliesTo: has2DBox,
    summarize(args, acc) {
      acc.offsetX = (acc.offsetX || 0) + (args.x || 0)
      acc.offsetY = (acc.offsetY || 0) + (args.y || 0)
    },
    emit(args) {
      if (!args.x && !args.y) return null
      return `.offset(x: ${args.x || 0}, y: ${args.y || 0})`
    }
  },

  rotationEffect: {
    type: 'rotationEffect',
    swiftName: '.rotationEffect',
    group: 'Transform',
    defaults: { degrees: 0 },
    appliesTo: has2DBox,
    summarize(args, acc) { acc.rotation = (acc.rotation || 0) + (args.degrees || 0) },
    emit(args) {
      if (!args.degrees) return null
      return `.rotationEffect(.degrees(${args.degrees}))`
    }
  },

  scaleEffect: {
    type: 'scaleEffect',
    swiftName: '.scaleEffect',
    group: 'Transform',
    defaults: { x: 1, y: 1 },
    appliesTo: has2DBox,
    summarize(args, acc) {
      acc.scaleX = (acc.scaleX ?? 1) * (args.x ?? 1)
      acc.scaleY = (acc.scaleY ?? 1) * (args.y ?? 1)
    },
    emit(args) {
      const x = args.x ?? 1, y = args.y ?? 1
      if (x === 1 && y === 1) return null
      return `.scaleEffect(x: ${x}, y: ${y})`
    }
  },

  // ---- visual decoration -----------------------------------------------
  shadow: {
    type: 'shadow',
    swiftName: '.shadow',
    group: 'Effect',
    defaults: { color: '#000000', radius: 4, x: 0, y: 2 },
    appliesTo: has2DBox,
    summarize(args, acc) {
      if (args.radius > 0 && args.color) {
        acc.shadow = { color: args.color, radius: args.radius, x: args.x || 0, y: args.y || 0 }
      }
    },
    emit(args) {
      if (!args.radius || !args.color) return null
      return `.shadow(color: Color(hex: "${args.color}"), radius: ${args.radius}, x: ${args.x || 0}, y: ${args.y || 0})`
    }
  },

  border: {
    type: 'border',
    swiftName: '.border',
    group: 'Decoration',
    defaults: { color: '#000000', width: 1 },
    // SwiftUI's `.border` is on `View` — applies to anything except Text-only
    // (where you'd use `.underline` instead) and 3D / presentations. We keep
    // it on every 2D box; on Text it produces a frame border which is valid.
    appliesTo: has2DBox,
    summarize(args, acc) {
      if (args.width > 0 && args.color) acc.border = { color: args.color, width: args.width }
    },
    emit(args) {
      if (!args.width || !args.color) return null
      return `.border(Color(hex: "${args.color}"), width: ${args.width})`
    }
  },

  clipShape: {
    type: 'clipShape',
    swiftName: '.clipShape',
    group: 'Decoration',
    defaults: { shape: 'roundedRect' },
    appliesTo: has2DBox,
    summarize(args, acc) { acc.clipShape = args.shape },
    emit(args, panel) {
      if (!args.shape || args.shape === 'none') return null
      const cr = panel?.cornerRadius ?? 0
      const expr = args.shape === 'circle'      ? 'Circle()'
                 : args.shape === 'capsule'     ? 'Capsule()'
                 : `RoundedRectangle(cornerRadius: ${cr || 12})`
      return `.clipShape(${expr})`
    }
  },

  foregroundStyle: {
    type: 'foregroundStyle',
    swiftName: '.foregroundStyle',
    group: 'Color',
    defaults: { color: '#ffffff' },
    appliesTo: (k) => KIND_TINTABLE.has(k),
    summarize(args, acc) { acc.foregroundStyle = args.color },
    emit(args) {
      if (!args.color) return null
      return `.foregroundStyle(Color(hex: "${args.color}"))`
    }
  },

  // ---- visionOS chrome -------------------------------------------------
  glassBackgroundEffect: {
    type: 'glassBackgroundEffect',
    swiftName: '.glassBackgroundEffect',
    group: 'visionOS',
    defaults: { displayMode: 'always', shape: 'auto' },
    // Glass is a container chrome — only meaningful on views with their own
    // bounds (so excluding pure Text/Link, but the user can still add it via
    // a wrapping stack/window).
    appliesTo: (k) => has2DBox(k) && k !== 'text' && k !== 'link' && k !== 'divider' && k !== 'spacer',
    summarize(args, acc) {
      if (args.displayMode && args.displayMode !== 'never') {
        acc.glass = { displayMode: args.displayMode, shape: args.shape || 'auto' }
      }
    },
    emit(args, panel) {
      if (!args.displayMode || args.displayMode === 'never') return null
      const dm = args.displayMode === 'always' ? '' : `displayMode: .${args.displayMode}`
      if (!args.shape || args.shape === 'auto') {
        return `.glassBackgroundEffect(${dm})`
      }
      const cr = panel?.cornerRadius ?? 16
      const shapeExpr = args.shape === 'capsule'   ? 'Capsule()'
                      : args.shape === 'circle'    ? 'Circle()'
                      : args.shape === 'rectangle' ? 'Rectangle()'
                      : `RoundedRectangle(cornerRadius: ${cr}, style: .continuous)`
      const dmArg = dm ? `, ${dm}` : ''
      return `.glassBackgroundEffect(in: ${shapeExpr}${dmArg})`
    }
  },

  containerBackground: {
    type: 'containerBackground',
    swiftName: '.containerBackground',
    group: 'visionOS',
    defaults: { color: '#000000', placement: 'window' },
    // `.containerBackground(_:for:)` is a window/navigation backdrop — only
    // makes sense at the container level. Spec §3.3 ties it to .window /
    // .navigation placements, so we restrict to stack + window kinds.
    appliesTo: containerOnly,
    summarize(args, acc) {
      if (args.color) acc.containerBg = { color: args.color, placement: args.placement || 'window' }
    },
    emit(args) {
      if (!args.color) return null
      return `.containerBackground(Color(hex: "${args.color}"), for: .${args.placement || 'window'})`
    }
  },

  // ---- interactivity ---------------------------------------------------
  disabled: {
    type: 'disabled',
    swiftName: '.disabled',
    group: 'Interaction',
    defaults: { value: true },
    appliesTo: (k) => KIND_INTERACTIVE.has(k),
    summarize(args, acc) { if (isOn(args.value)) acc.disabled = true },
    emit(args) {
      return isOn(args.value) ? `.disabled(true)` : null
    }
  },

  // ---- text-display family ---------------------------------------------
  italic: {
    type: 'italic',
    swiftName: '.italic',
    group: 'Text',
    defaults: {},
    appliesTo: (k) => KIND_TEXTUAL.has(k),
    summarize(_a, acc) { acc.italic = true },
    emit() { return `.italic()` }
  },
  underline: {
    type: 'underline',
    swiftName: '.underline',
    group: 'Text',
    defaults: {},
    appliesTo: (k) => KIND_TEXTUAL.has(k),
    summarize(_a, acc) { acc.underline = true },
    emit() { return `.underline()` }
  },
  strikethrough: {
    type: 'strikethrough',
    swiftName: '.strikethrough',
    group: 'Text',
    defaults: {},
    appliesTo: (k) => KIND_TEXTUAL.has(k),
    summarize(_a, acc) { acc.strikethrough = true },
    emit() { return `.strikethrough()` }
  },
  textCase: {
    type: 'textCase',
    swiftName: '.textCase',
    group: 'Text',
    defaults: { value: 'uppercase' },
    appliesTo: (k) => KIND_TEXTUAL.has(k),
    summarize(args, acc) { acc.textCase = args.value },
    emit(args) {
      if (!args.value || args.value === 'none') return null
      return `.textCase(.${args.value})`
    }
  },
  lineLimit: {
    type: 'lineLimit',
    swiftName: '.lineLimit',
    group: 'Text',
    defaults: { value: 1 },
    appliesTo: (k) => KIND_TEXTUAL.has(k),
    summarize(args, acc) { acc.lineLimit = args.value },
    emit(args) {
      if (!args.value || args.value <= 0) return null
      return `.lineLimit(${args.value})`
    }
  },
  lineSpacing: {
    type: 'lineSpacing',
    swiftName: '.lineSpacing',
    group: 'Text',
    defaults: { value: 4 },
    appliesTo: (k) => KIND_TEXTUAL.has(k),
    summarize(args, acc) { acc.lineSpacing = args.value },
    emit(args) {
      if (!args.value) return null
      return `.lineSpacing(${args.value})`
    }
  },
  tracking: {
    type: 'tracking',
    swiftName: '.tracking',
    group: 'Text',
    defaults: { value: 0.5 },
    appliesTo: (k) => KIND_TEXTUAL.has(k),
    summarize(args, acc) { acc.tracking = args.value },
    emit(args) {
      if (!args.value) return null
      return `.tracking(${args.value})`
    }
  },
  kerning: {
    type: 'kerning',
    swiftName: '.kerning',
    group: 'Text',
    defaults: { value: 0.5 },
    appliesTo: (k) => KIND_TEXTUAL.has(k),
    summarize(args, acc) { acc.kerning = args.value },
    emit(args) {
      if (!args.value) return null
      return `.kerning(${args.value})`
    }
  },
  baselineOffset: {
    type: 'baselineOffset',
    swiftName: '.baselineOffset',
    group: 'Text',
    defaults: { value: 0 },
    appliesTo: (k) => KIND_TEXTUAL.has(k),
    summarize(args, acc) { acc.baselineOffset = args.value },
    emit(args) {
      if (!args.value) return null
      return `.baselineOffset(${args.value})`
    }
  },
  truncationMode: {
    type: 'truncationMode',
    swiftName: '.truncationMode',
    group: 'Text',
    defaults: { value: 'middle' },
    appliesTo: (k) => KIND_TEXTUAL.has(k),
    summarize(args, acc) { acc.truncationMode = args.value },
    emit(args) {
      if (!args.value || args.value === 'tail') return null
      return `.truncationMode(.${args.value})`
    }
  },
  minimumScaleFactor: {
    type: 'minimumScaleFactor',
    swiftName: '.minimumScaleFactor',
    group: 'Text',
    defaults: { value: 0.8 },
    appliesTo: (k) => KIND_TEXTUAL.has(k),
    summarize(args, acc) { acc.minimumScaleFactor = args.value },
    emit(args) {
      if (args.value == null || args.value >= 1) return null
      return `.minimumScaleFactor(${args.value})`
    }
  },
  allowsTightening: {
    type: 'allowsTightening',
    swiftName: '.allowsTightening',
    group: 'Text',
    defaults: { value: true },
    appliesTo: (k) => KIND_TEXTUAL.has(k),
    summarize(args, acc) { if (isOn(args.value)) acc.allowsTightening = true },
    emit(args) { return isOn(args.value) ? `.allowsTightening(true)` : null }
  },
  fontDesign: {
    type: 'fontDesign',
    swiftName: '.fontDesign',
    group: 'Text',
    defaults: { value: 'rounded' },
    appliesTo: (k) => KIND_TEXTUAL.has(k),
    summarize(args, acc) { acc.fontDesign = args.value },
    emit(args) {
      if (!args.value || args.value === 'default') return null
      return `.fontDesign(.${args.value})`
    }
  },
  monospacedDigit: {
    type: 'monospacedDigit',
    swiftName: '.monospacedDigit',
    group: 'Text',
    defaults: {},
    appliesTo: (k) => KIND_TEXTUAL.has(k),
    summarize(_a, acc) { acc.monospacedDigit = true },
    emit() { return `.monospacedDigit()` }
  }
}

// Stable display order in the "Add Modifier" dropdown — keeps related ones
// together regardless of insertion order in the registry.
const ORDER = [
  'opacity', 'padding',
  'offset', 'rotationEffect', 'scaleEffect',
  'shadow', 'border', 'clipShape', 'foregroundStyle',
  'glassBackgroundEffect', 'containerBackground',
  'disabled',
  'italic', 'underline', 'strikethrough', 'textCase',
  'lineLimit', 'lineSpacing', 'tracking', 'kerning', 'baselineOffset',
  'truncationMode', 'minimumScaleFactor', 'allowsTightening',
  'fontDesign', 'monospacedDigit'
]

export const ALL_MODIFIER_TYPES = ORDER

// Strict allow-list lookup. Returns the modifier definitions a given view
// kind is allowed to receive, in display order. Empty for 3D / presentation
// kinds — the inspector hides the section entirely in that case.
export function getAllowedModifiers(kind) {
  if (!kind) return []
  if (KIND_3D.has(kind)) return []
  if (KIND_PRESENTATION.has(kind)) return []
  return ORDER
    .map((t) => MODIFIERS[t])
    .filter((def) => def.appliesTo(kind))
}

export function isModifierAllowed(kind, type) {
  const def = MODIFIERS[type]
  if (!def) return false
  if (!kind) return false
  if (KIND_3D.has(kind) || KIND_PRESENTATION.has(kind)) return false
  return def.appliesTo(kind)
}

// Filter a modifier array down to the entries valid for a given view kind.
// Used by `switchPanelType` so a Button → Text conversion drops modifiers
// that no longer apply (e.g. `.disabled`).
export function filterModifiers(arr, kind) {
  if (!Array.isArray(arr)) return []
  return arr.filter((m) => isModifierAllowed(kind, m.type))
}

// Reduce a modifier array to a flat preview struct for the canvas. Last
// write wins — order in the inspector matches order in SwiftUI but the
// canvas can only render an approximation, so a later `.opacity(0.5)`
// overrides an earlier one for preview purposes.
export function summarizeModifiers(arr) {
  const acc = { opacity: 1, scaleX: 1, scaleY: 1 }
  if (!Array.isArray(arr)) return acc
  for (const entry of arr) {
    const def = MODIFIERS[entry.type]
    if (!def || !def.summarize) continue
    def.summarize(entry, acc)
  }
  return acc
}

// id helper for new modifier entries
let modIdCounter = 1
export const newModifierId = () => `mod-${modIdCounter++}`

// Construct a fresh modifier entry of the given type (defaults from registry).
export function makeModifier(type) {
  const def = MODIFIERS[type]
  if (!def) throw new Error(`Unknown modifier type: ${type}`)
  return { id: newModifierId(), type, ...def.defaults }
}
