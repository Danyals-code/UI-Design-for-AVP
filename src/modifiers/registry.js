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



// Convert a 6-digit hex color to a SwiftUI Color(...) expression.
// SwiftUI has no `Color(hex:)` init in its stdlib — always use Color(red:green:blue:).
function hexToColor(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '')
  if (m) {
    const r = (parseInt(m[1].slice(0, 2), 16) / 255).toFixed(3)
    const g = (parseInt(m[1].slice(2, 4), 16) / 255).toFixed(3)
    const b = (parseInt(m[1].slice(4, 6), 16) / 255).toFixed(3)
    return `Color(red: ${r}, green: ${g}, blue: ${b})`
  }
  return '.primary'
}

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

// RealityView is a SwiftUI view that hosts a RealityKit content closure.
// SwiftUI accepts a *small* subset of modifiers on it — the rest target
// 2D-text or interactive-control concerns that are no-ops on a 3D
// container. Restricting the inspector to this list keeps the experience
// honest about what the SwiftUI compiler will actually accept.
const REALITYVIEW_MODIFIERS = new Set([
  // Layout — controls where the view sits in the SwiftUI tree.
  'frame', 'padding', 'offset', 'position', 'fixedSize', 'aspectRatio',
  'layoutPriority', 'zIndex',
  // Visibility / opacity / clipping — apply to the SwiftUI surface, not
  // the 3D content inside.
  'opacity', 'hidden', 'clipped', 'clipShape', 'mask', 'blur',
  'blendMode', 'colorInvert', 'colorMultiply', 'saturation', 'brightness',
  'contrast', 'grayscale', 'compositingGroup',
  // Background / overlay containers — usable as decoration around the
  // RealityView (e.g. a blurred backdrop).
  'background', 'overlay', 'border',
  // Animation / transition — work on the SwiftUI view's state changes.
  'animation', 'transition',
  // Accessibility (semantic — applies to the RealityView itself).
  'accessibility'
])

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
    // SwiftUI's `.padding()` reduces the size proposed to the inner view.
    // For Text that means a smaller wrap bound and a taller frame; we
    // accumulate per-edge so multiple `.padding(.top, …)` chains add up
    // the way they do on device.
    summarize(args, acc) {
      const len = (args.length ?? 0) || 0
      const p = acc.padding || { top: 0, right: 0, bottom: 0, left: 0 }
      const edges = args.edges || 'all'
      if (edges === 'all') {
        p.top += len; p.right += len; p.bottom += len; p.left += len
      } else if (edges === 'horizontal') {
        p.left += len; p.right += len
      } else if (edges === 'vertical') {
        p.top += len; p.bottom += len
      } else if (edges === 'leading') {
        p.left += len
      } else if (edges === 'trailing') {
        p.right += len
      } else if (edges === 'top') {
        p.top += len
      } else if (edges === 'bottom') {
        p.bottom += len
      }
      acc.padding = p
    },
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
      return `.shadow(color: ${hexToColor(args.color)}, radius: ${args.radius}, x: ${args.x || 0}, y: ${args.y || 0})`
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
      return `.border(${hexToColor(args.color)}, width: ${args.width})`
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
    appliesTo: has2DBox,
    summarize(args, acc) { acc.foregroundStyle = args.color },
    emit(args) {
      if (!args.color) return null
      return `.foregroundStyle(${hexToColor(args.color)})`
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
      return `.containerBackground(${hexToColor(args.color)}, for: .${args.placement || 'window'})`
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
  multilineTextAlignment: {
    type: 'multilineTextAlignment',
    swiftName: '.multilineTextAlignment',
    group: 'Text',
    defaults: { value: 'leading' },
    appliesTo: (k) => KIND_TEXTUAL.has(k),
    summarize(args, acc) { if (args.value) acc.multilineTextAlignment = args.value },
    emit(args) {
      if (!args.value) return null
      return `.multilineTextAlignment(.${args.value})`
    }
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
  },

  // ---- layout frame -------------------------------------------------------
  frame: {
    type: 'frame',
    swiftName: '.frame',
    group: 'Layout',
    defaults: { width: null, height: null, minWidth: null, minHeight: null, maxWidth: false, maxHeight: false, alignment: 'center' },
    appliesTo: has2DBox,
    // Track width / minWidth / maxWidth as separate values so the text
    // wrap pipeline can resolve the proposal correctly:
    //   - frame(width:) — exact override, ignores parent proposal
    //   - frame(minWidth:) / frame(maxWidth:) — clamps the proposal
    //   - frame(maxWidth: .infinity) — fills the parent's inner width
    // The maxWidth field uses `true` as a sentinel for ".infinity" so
    // existing UI keeps working; a number means a finite cap.
    summarize(args, acc) {
      if (args.width  != null) acc.frameWidth  = args.width
      if (args.height != null) acc.frameHeight = args.height
      if (typeof args.minWidth  === 'number') acc.frameMinWidth  = args.minWidth
      if (typeof args.minHeight === 'number') acc.frameMinHeight = args.minHeight
      if (args.maxWidth === true) acc.frameMaxWidth  = Infinity
      else if (typeof args.maxWidth === 'number') acc.frameMaxWidth = args.maxWidth
      if (args.maxHeight === true) acc.frameMaxHeight = Infinity
      else if (typeof args.maxHeight === 'number') acc.frameMaxHeight = args.maxHeight
      if (args.alignment) acc.frameAlignment = args.alignment
    },
    emit(args) {
      const parts = []
      if (args.width  != null)  parts.push(`width: ${args.width}`)
      if (args.height != null)  parts.push(`height: ${args.height}`)
      if (typeof args.minWidth  === 'number') parts.push(`minWidth: ${args.minWidth}`)
      if (typeof args.minHeight === 'number') parts.push(`minHeight: ${args.minHeight}`)
      if (args.maxWidth === true) parts.push(`maxWidth: .infinity`)
      else if (typeof args.maxWidth === 'number') parts.push(`maxWidth: ${args.maxWidth}`)
      if (args.maxHeight === true) parts.push(`maxHeight: .infinity`)
      else if (typeof args.maxHeight === 'number') parts.push(`maxHeight: ${args.maxHeight}`)
      if (args.alignment && args.alignment !== 'center') parts.push(`alignment: .${args.alignment}`)
      if (parts.length === 0) return null
      return `.frame(${parts.join(', ')})`
    }
  },

  // ---- background / overlay -----------------------------------------------
  background: {
    type: 'background',
    swiftName: '.background',
    group: 'Decoration',
    defaults: { color: '#1c1c1e', colorToken: null, material: null, alignment: 'center' },
    appliesTo: has2DBox,
    summarize(args, acc) { acc.background = args.color || args.material },
    emit(args) {
      if (args.material) return `.background(${args.material})`
      if (!args.color && !args.colorToken) return null
      const c = args.colorToken
        ? { primary: '.primary', secondary: '.secondary', systemBlue: '.blue', systemRed: '.red',
            systemGreen: '.green', systemOrange: '.orange', systemGray: '.gray' }[args.colorToken] || hexToColor(args.color || '#000000')
        : hexToColor(args.color || '#000000')
      const align = args.alignment && args.alignment !== 'center' ? `, alignment: .${args.alignment}` : ''
      return `.background(${c}${align})`
    }
  },

  overlay: {
    type: 'overlay',
    swiftName: '.overlay',
    group: 'Decoration',
    defaults: { color: '#ffffff', alignment: 'center', opacity: 0.2 },
    appliesTo: has2DBox,
    summarize(args, acc) { acc.overlay = { color: args.color, opacity: args.opacity } },
    emit(args) {
      if (!args.color) return null
      const align = args.alignment && args.alignment !== 'center' ? `, alignment: .${args.alignment}` : ''
      const op = (args.opacity != null && args.opacity !== 1) ? `.opacity(${args.opacity})` : ''
      return `.overlay(${hexToColor(args.color)}${op ? `.${op.slice(1)}` : ''}${align})`
    }
  },

  // ---- sizing helpers -------------------------------------------------------
  aspectRatio: {
    type: 'aspectRatio',
    swiftName: '.aspectRatio',
    group: 'Layout',
    defaults: { ratio: null, contentMode: 'fit' },
    appliesTo: has2DBox,
    // Carries the content mode as well: `.fit` shrinks the frame inside the
    // proposal, `.fill` grows it to cover, and the canvas has to know which.
    summarize(args, acc) {
      if (args.ratio) acc.aspectRatio = { ratio: args.ratio, contentMode: args.contentMode || 'fit' }
    },
    emit(args) {
      const r = args.ratio ? `${args.ratio}, ` : ''
      return `.aspectRatio(${r}contentMode: .${args.contentMode || 'fit'})`
    }
  },

  fixedSize: {
    type: 'fixedSize',
    swiftName: '.fixedSize',
    group: 'Layout',
    defaults: { horizontal: true, vertical: true },
    appliesTo: has2DBox,
    // SwiftUI splits horizontal vs vertical — horizontal:true means
    // "don't wrap, give me my intrinsic single-line width"; vertical:true
    // means "don't truncate vertically". Track them independently so the
    // text measurement pipeline can apply each correctly.
    summarize(args, acc) {
      if (args.horizontal !== false) acc.fixedSizeH = true
      if (args.vertical   !== false) acc.fixedSizeV = true
      acc.fixedSize = true
    },
    emit(args) {
      if (args.horizontal && args.vertical) return `.fixedSize()`
      return `.fixedSize(horizontal: ${args.horizontal ? 'true' : 'false'}, vertical: ${args.vertical ? 'true' : 'false'})`
    }
  },

  zIndex: {
    type: 'zIndex',
    swiftName: '.zIndex',
    group: 'Layout',
    defaults: { value: 1 },
    appliesTo: has2DBox,
    summarize(args, acc) { acc.zIndex = args.value },
    emit(args) {
      if (!args.value) return null
      return `.zIndex(${args.value})`
    }
  },

  layoutPriority: {
    type: 'layoutPriority',
    swiftName: '.layoutPriority',
    group: 'Layout',
    defaults: { value: 1 },
    appliesTo: has2DBox,
    // Read by `layout.js` when a stack shares out its slack. This wrote
    // nothing at all until phase 1.1, which made it a no-op on BOTH sides —
    // it emitted real Swift and changed neither the canvas nor the layout
    // engine. AUDIT #15.
    summarize(args, acc) {
      const v = Number(args.value)
      if (Number.isFinite(v)) acc.layoutPriority = v
    },
    emit(args) {
      if (!args.value) return null
      return `.layoutPriority(${args.value})`
    }
  },

  // ---- tint / color -------------------------------------------------------
  tint: {
    type: 'tint',
    swiftName: '.tint',
    group: 'Color',
    defaults: { color: '#007aff' },
    appliesTo: has2DBox,
    summarize(args, acc) { acc.tint = args.color },
    emit(args) {
      if (!args.color) return null
      return `.tint(${hexToColor(args.color)})`
    }
  },

  // ---- visionOS hover effects --------------------------------------------
  hoverEffect: {
    type: 'hoverEffect',
    swiftName: '.hoverEffect',
    group: 'visionOS',
    defaults: { value: 'automatic' },
    appliesTo: (k) => KIND_INTERACTIVE.has(k) || k === 'stack',
    summarize(args, acc) { acc.hoverEffect = args.value },
    emit(args) {
      if (!args.value || args.value === 'automatic') return `.hoverEffect()`
      if (args.value === 'none') return `.hoverEffect(.none)`
      return `.hoverEffect(.${args.value})`
    }
  },

  hoverEffectDisabled: {
    type: 'hoverEffectDisabled',
    swiftName: '.hoverEffectDisabled',
    group: 'visionOS',
    defaults: { value: true },
    appliesTo: has2DBox,
    summarize(args, acc) { if (isOn(args.value)) acc.hoverEffectDisabled = true },
    emit(args) { return isOn(args.value) ? `.hoverEffectDisabled(true)` : null }
  },

  // ---- content / hit-testing shape ----------------------------------------
  contentShape: {
    type: 'contentShape',
    swiftName: '.contentShape',
    group: 'Interaction',
    defaults: { shape: 'rectangle' },
    appliesTo: has2DBox,
    summarize() {},
    emit(args) {
      const s = args.shape || 'rectangle'
      const expr = s === 'circle' ? 'Circle()' : s === 'capsule' ? 'Capsule()' : 'Rectangle()'
      return `.contentShape(${expr})`
    }
  },

  // ---- navigation ---------------------------------------------------------
  navigationTitle: {
    type: 'navigationTitle',
    swiftName: '.navigationTitle',
    group: 'Navigation',
    defaults: { title: '' },
    appliesTo: has2DBox,
    // Read by Stack3D, which prefers this over `stack.navTitle`. Two sources
    // for one concept is the shape 2.3 spent a phase removing elsewhere; here
    // the modifier is the SwiftUI spelling, so it wins when present and the
    // stored field remains the default.
    summarize(args, acc) { acc.navigationTitle = args.title || null },
    emit(args) {
      if (!args.title) return null
      return `.navigationTitle("${args.title.replace(/"/g, '\\"')}")`
    }
  },

  // ---- toolbar chrome -----------------------------------------------------
  toolbarBackground: {
    type: 'toolbarBackground',
    swiftName: '.toolbarBackground',
    group: 'Navigation',
    defaults: { visibility: 'automatic', placement: 'automatic' },
    appliesTo: has2DBox,
    // Read by Stack3D to hide the toolbar's own plate when the designer
    // sets `.hidden`.
    summarize(args, acc) {
      acc.toolbarBackground = { visibility: args.visibility, placement: args.placement }
    },
    emit(args) {
      const vis = args.visibility || 'automatic'
      if (vis === 'automatic') return null
      const place = args.placement && args.placement !== 'automatic' ? `, for: .${args.placement}` : ''
      return `.toolbarBackground(.${vis}${place})`
    }
  },

  // ---- scroll -------------------------------------------------------------
  scrollIndicators: {
    type: 'scrollIndicators',
    swiftName: '.scrollIndicators',
    group: 'Scroll',
    defaults: { value: 'hidden' },
    appliesTo: (k) => k === 'stack',
    // Read by Stack3D to suppress the scroll thumb, alongside the
    // ScrollView's own `showsIndicators:` argument. Inert until AUDIT #4
    // gave scrollable stacks something to indicate.
    summarize(args, acc) { acc.scrollIndicators = args.value },
    emit(args) {
      if (!args.value || args.value === 'automatic') return null
      return `.scrollIndicators(.${args.value})`
    }
  },

  scrollDisabled: {
    type: 'scrollDisabled',
    swiftName: '.scrollDisabled',
    group: 'Scroll',
    defaults: { value: true },
    appliesTo: (k) => k === 'stack',
    // Read by Stack3D, which stops honouring the scroll axes when set —
    // matching the device, where the content still overflows its box but
    // the gesture does nothing.
    summarize(args, acc) { acc.scrollDisabled = isOn(args.value) },
    emit(args) { return isOn(args.value) ? `.scrollDisabled(true)` : null }
  },

  // ---- escape hatch ----------------------------------------------------
  //
  // An arbitrary modifier, authored by the designer and appended verbatim.
  //
  // Every other entry here models one SwiftUI method, so the reachable set
  // is exactly this file. This entry lifts that limit: any modifier Apple
  // ships — or any one that arrives after this was written — can be applied
  // today without a registry change.
  //
  // `appliesTo` is deliberately unrestricted where the modifier section is
  // shown at all. The strict allow-list exists to stop the inspector
  // offering a modifier SwiftUI would reject on that view; here the user is
  // asserting they know what they are attaching, and second-guessing them
  // would defeat the point. (3D primitives and presentation panels hide the
  // modifier section entirely — reach for the `custom` panel there.)
  //
  // `summarize` is intentionally a no-op: the canvas cannot know what an
  // arbitrary modifier does visually, and guessing would be worse than
  // rendering the view unmodified.
  customModifier: {
    type: 'customModifier',
    swiftName: '.custom',
    group: 'Custom',
    defaults: { source: '.padding(8)' },
    appliesTo: () => true,
    summarize() {},
    emit(args) {
      const raw = String(args.source ?? '').trim()
      if (!raw) return null
      // Tolerate both `.opacity(0.5)` and `opacity(0.5)` — the leading dot
      // is what makes it a chain entry, and typing it is easy to forget.
      return raw.startsWith('.') ? raw : `.${raw}`
    }
  }
}

// Stable display order in the "Add Modifier" dropdown — keeps related ones
// together regardless of insertion order in the registry.
const ORDER = [
  // Layout
  'frame', 'aspectRatio', 'fixedSize', 'zIndex', 'layoutPriority',
  'opacity', 'padding',
  'offset', 'rotationEffect', 'scaleEffect',
  // Decoration
  'background', 'overlay',
  'shadow', 'border', 'clipShape',
  // Color
  'foregroundStyle', 'tint',
  // visionOS chrome
  'glassBackgroundEffect', 'containerBackground',
  'hoverEffect', 'hoverEffectDisabled',
  // Interaction
  'disabled', 'contentShape',
  // Text
  'italic', 'underline', 'strikethrough', 'textCase',
  'lineLimit', 'lineSpacing', 'tracking', 'kerning', 'baselineOffset',
  'truncationMode', 'minimumScaleFactor', 'allowsTightening', 'multilineTextAlignment',
  'fontDesign', 'monospacedDigit',
  // Navigation
  'navigationTitle', 'toolbarBackground',
  // Scroll
  'scrollIndicators', 'scrollDisabled',
  // Escape hatch — last in the dropdown so the modelled modifiers stay the
  // obvious first choice and this is the deliberate fallback.
  'customModifier'
]

export const ALL_MODIFIER_TYPES = ORDER

// Strict allow-list lookup. Returns the modifier definitions a given view
// kind is allowed to receive, in display order. Empty for 3D / presentation
// kinds — the inspector hides the section entirely in that case.
// RealityView gets a tight curated allowlist (REALITYVIEW_MODIFIERS) so
// the user only sees modifiers that SwiftUI actually accepts on a 3D
// content host.
export function getAllowedModifiers(kind) {
  if (!kind) return []
  if (KIND_3D.has(kind)) return []
  if (KIND_PRESENTATION.has(kind)) return []
  if (kind === 'realityview') {
    return ORDER
      .filter((t) => REALITYVIEW_MODIFIERS.has(t))
      .map((t) => MODIFIERS[t])
      .filter((def) => def.appliesTo(kind))
  }
  return ORDER
    .map((t) => MODIFIERS[t])
    .filter((def) => def.appliesTo(kind))
}

export function isModifierAllowed(kind, type) {
  const def = MODIFIERS[type]
  if (!def) return false
  if (!kind) return false
  if (KIND_3D.has(kind) || KIND_PRESENTATION.has(kind)) return false
  if (kind === 'realityview' && !REALITYVIEW_MODIFIERS.has(type)) return false
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
