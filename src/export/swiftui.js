// SwiftUI code exporter.
//
// Walks the scene graph and emits SwiftUI source files:
//   - One `<TabName>View.swift` per Tab
//   - One `<AppName>App.swift` containing `@main` + the WindowGroup / TabView
//     that routes between tabs.
//
// Coverage is pragmatic — the common stack types, panels, NavigationSplitView,
// in-window TabView with `Tab` children, and presentation modifiers
// (sheet/alert/popover) round-trip faithfully. Unknown elements render as a
// placeholder comment so the exported file still compiles.
//
// The strict convention is: every public name in here must match the exact
// SwiftUI API string, so the output is mechanical to review against Apple's
// docs.

import { unitsToPt, textStyleDefaultWeight, NAVBAR_STYLE_SPECS, isPresentationPanel } from '../appleSystem'
import {
  emitPanel, isInteractivePanel, compileTapAction,
  panelFrameMode, panelHeightIsDerived
} from '../panels/registry'
import { MODIFIERS } from '../modifiers/registry'
import { emitRealityView, hasEntityChildren } from './realitykit'
import {
  emitBehaviorModifiers, emitBehaviorMethods, behaviorStateDecls
} from './behaviors'

// Behaviour plans collected while rendering one view file.
//
// Gestures, `@State` and the generated methods all belong at view scope, but
// they are discovered deep inside `renderWindow` / `renderPanel`. Threading a
// collector through every renderer signature would touch a dozen call sites
// for one feature, so `wrapTabView` clears this at entry and reads it after
// the body is built. Generation is synchronous and single-threaded per file,
// so a module-scoped accumulator is safe here.
let pendingBehaviorPlans = []

// ---------- helpers ----------

// ---------- frame + padding emission ----------
//
// The canvas sizes a view from `widthMode` / `heightMode` plus an explicit
// value, and until now none of that reached the export: a stack pinned to a
// 640 pt column came out hugging its content, and a `fill` child came out
// intrinsic. These two helpers close that.
//
// The mode resolution below deliberately duplicates the one in
// `layout.js` → `computeSize` rather than importing it, for the same reason
// `resolvedChildSizes` duplicates `layoutStack`: the two paths answer
// different questions (one produces a number to draw, one produces SwiftUI
// source) and sharing a function would not make them agree about the output
// that matters. `export/swiftui.test.js` pins the agreement instead, by
// checking every emitted frame against `computeSize` for every template.
//
// Units: stacks store `fixedWidth` / `fixedHeight` in POINTS; panels store
// `size` in internal UNITS. Both leave here as points.
function frameSpec(item) {
  if (!item) return null
  if (item.type === 'stack') {
    // Backwards compatibility, matching computeSize: an unset mode with a
    // concrete fixedWidth/fixedHeight still means 'fixed'.
    const widthMode = item.widthMode || (item.fixedWidth != null ? 'fixed' : 'fit')
    const heightMode = item.heightMode || (item.fixedHeight != null ? 'fixed' : 'fit')
    return {
      widthMode,
      heightMode,
      // A 'fixed' axis with no value falls back to hugging — that is what
      // the canvas does, and the export has to agree rather than invent a
      // number. Several templates are in exactly this state.
      width: widthMode === 'fixed' && item.fixedWidth != null ? item.fixedWidth : null,
      height: heightMode === 'fixed' && item.fixedHeight != null ? item.fixedHeight : null
    }
  }
  if (item.type === 'panel') {
    const mode = panelFrameMode(item.panelType)
    // 'none': the type sizes itself — shapes and gradients emit their own
    // frame, a Button sizes from its label and `controlSize`, a Spacer has
    // no frame. Emitting one here would fight whichever of those applies.
    if (mode === 'none') return null
    const size = Array.isArray(item.size) ? item.size : null
    // 'explicit': `size` IS the authored box, which is what the inspector's
    // width/height fields write and what the canvas draws. `widthMode` is
    // not part of the contract for these types, so a default 'fit' does not
    // mean "hug" the way it does for Text.
    if (mode === 'explicit') {
      return {
        widthMode: item.widthMode || 'fit',
        heightMode: item.heightMode || 'fit',
        width: size?.[0] ? unitsToPt(size[0]) : null,
        // A List grows with its rows on the canvas and in SwiftUI alike, so
        // only its width is meaningful.
        height: !panelHeightIsDerived(item.panelType) && size?.[1]
          ? unitsToPt(size[1])
          : null
      }
    }
    // 'figma': Fit / Fixed / Fill, where 'fit' genuinely means hug and
    // pinning the measured intrinsic would freeze the text at whatever
    // width this machine's font metrics happened to produce.
    const widthMode = item.widthMode || 'fit'
    const heightMode = item.heightMode || 'fit'
    return {
      widthMode,
      heightMode,
      width: widthMode === 'fixed' && size?.[0] ? unitsToPt(size[0]) : null,
      height: heightMode === 'fixed' && size?.[1] ? unitsToPt(size[1]) : null
    }
  }
  return null
}

// `.frame(...)` for an item's sizing intent, or null when it hugs on both
// axes (SwiftUI's default — emitting `.frame()` for that would be noise).
//   fixed + value → width: / height:
//   fill          → maxWidth: .infinity / maxHeight: .infinity
//   fit           → nothing
function frameModifier(item) {
  const spec = frameSpec(item)
  if (!spec) return null
  const parts = []
  if (spec.width != null) parts.push(`width: ${spec.width}`)
  else if (spec.widthMode === 'fill') parts.push('maxWidth: .infinity')
  if (spec.height != null) parts.push(`height: ${spec.height}`)
  else if (spec.heightMode === 'fill') parts.push('maxHeight: .infinity')
  if (parts.length === 0) return null
  return `.frame(${parts.join(', ')})`
}

// A panel parented straight to a window can be dragged anywhere on the plate,
// and the canvas places it at `panel.position`. Nothing carried that into the
// export, so every freely-placed control landed centred in the generated
// ZStack. Panels inside a stack are positioned by the layout engine instead,
// and their `position` is ignored on both sides — emitting one for those
// would fight the stack.
//
// Signs: `position` is scene-space (+y UP); SwiftUI's `.offset` is +y DOWN,
// so y flips. This composes with any `.offset` entry in the modifier stack
// exactly as the canvas composes them — additively.
function positionOffset(panel, items) {
  if (!panel || !Array.isArray(panel.position)) return null
  const parent = items.find((it) => it.id === panel.parentId)
  if (parent?.type !== 'window') return null
  const x = unitsToPt(panel.position[0] || 0)
  const y = unitsToPt(panel.position[1] || 0)
  if (!x && !y) return null
  return `.offset(x: ${x}, y: ${-y})`
}

// Padding, honouring the per-edge override the inspector writes as
// `paddingEdges`. SwiftUI has no four-value `.padding()`, so unequal edges
// emit one call per edge; equal ones collapse back to the short form.
function paddingModifiers(item) {
  const e = item.paddingEdges
  if (!e) return item.padding ? [`.padding(${item.padding})`] : []
  const top = e.top ?? 0
  const bottom = e.bottom ?? 0
  const leading = e.leading ?? 0
  const trailing = e.trailing ?? 0
  if (top === bottom && leading === trailing) {
    if (top === 0 && leading === 0) return []
    if (top === leading) return [`.padding(${top})`]
    const out = []
    if (leading) out.push(`.padding(.horizontal, ${leading})`)
    if (top) out.push(`.padding(.vertical, ${top})`)
    return out
  }
  const out = []
  if (top) out.push(`.padding(.top, ${top})`)
  if (bottom) out.push(`.padding(.bottom, ${bottom})`)
  if (leading) out.push(`.padding(.leading, ${leading})`)
  if (trailing) out.push(`.padding(.trailing, ${trailing})`)
  return out
}

// `ScrollView` opener, shared by the `scrollView` stack TYPE and the
// `scrollable` FLAG that any stack can carry. Spec 1.24 - axes default to
// `.vertical` and indicators to shown, so both arguments are omitted unless
// the designer overrode them.
function scrollViewOpener(stack) {
  const axis = stack?.scrollAxis === 'horizontal' ? '.horizontal'
             : stack?.scrollAxis === 'both' ? '[.horizontal, .vertical]'
             : null
  const shows = stack?.scrollShowsIndicators === false
  if (!axis && !shows) return 'ScrollView {'
  const args = [axis, shows ? 'showsIndicators: false' : null].filter(Boolean)
  return `ScrollView(${args.join(', ')}) {`
}

// Emit the container box's closing modifiers — content inset first, then the
// frame that sizes the box. Every `renderStack` branch that closes a
// container routes through here so a stack's sizing behaves the same whether
// it is a plain VStack, a Section, a Tab body or a DisclosureGroup.
function closeStackBox(stack, out, indentStr) {
  for (const p of paddingModifiers(stack)) out.push(`${indentStr}${p}`)
  const f = frameModifier(stack)
  if (f) out.push(`${indentStr}${f}`)
}

// A `.frame` entry in the modifier stack is the user editing the frame where
// they can see it, and `layout.js` already treats it as the source of truth
// over the panel-root fields. Let renderModifiers emit that one instead.
const hasFrameModifier = (item) =>
  Array.isArray(item.modifiers) && item.modifiers.some((m) => m.type === 'frame')

function sanitize(name) {
  // Convert "Tab 1 · Library" → "Tab1Library". Must start with a letter.
  let s = (name || 'Untitled').replace(/[^A-Za-z0-9]+/g, ' ').trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
  if (!/^[A-Za-z]/.test(s)) s = 'V' + s
  return s || 'Untitled'
}

function indent(n) { return '    '.repeat(n) }

function escapeString(s) {
  return String(s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
}

// Stable, Swift-safe state-var name from any item id.
function stateVarName(id) { return `showing_${String(id).replace(/[^A-Za-z0-9]/g, '_')}` }

function swiftColor(token, hex) {
  // Map our semantic tokens to SwiftUI's `Color` convenience values.
  // Tokens that have no first-party SwiftUI equivalent (designWindow,
  // designButton…) intentionally fall through to the hex fallback so the
  // designer's exact color survives the export.
  if (token) {
    const map = {
      // Foreground tiers
      primary: '.primary', secondary: '.secondary',
      tertiary: '.tertiary', quaternary: '.quaternary',
      // System colors
      systemBlue: '.blue', systemRed: '.red', systemGreen: '.green',
      systemOrange: '.orange', systemYellow: '.yellow', systemPurple: '.purple',
      systemPink: '.pink', systemTeal: '.teal', systemIndigo: '.indigo',
      systemGray: '.gray', systemBrown: '.brown', systemMint: '.mint',
      systemCyan: '.cyan',
      // Backgrounds (UIKit-bridged on visionOS)
      systemBackground: 'Color(.systemBackground)',
      secondarySystemBackground: 'Color(.secondarySystemBackground)',
      tertiarySystemBackground: 'Color(.tertiarySystemBackground)',
      // Fills
      systemFill: 'Color(.systemFill)',
      secondarySystemFill: 'Color(.secondarySystemFill)',
      tertiarySystemFill: 'Color(.tertiarySystemFill)',
      quaternarySystemFill: 'Color(.quaternarySystemFill)',
      // designWindow/Button/ButtonText: no SwiftUI equivalent — fall through
      // to the hex fallback so the designer's exact color is preserved.
      designButtonText: '.primary'
    }
    if (map[token]) return map[token]
  }
  if (hex) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex)
    if (m) {
      const r = parseInt(m[1].slice(0, 2), 16) / 255
      const g = parseInt(m[1].slice(2, 4), 16) / 255
      const b = parseInt(m[1].slice(4, 6), 16) / 255
      return `Color(red: ${r.toFixed(3)}, green: ${g.toFixed(3)}, blue: ${b.toFixed(3)})`
    }
  }
  return '.primary'
}

// Glass / material tokens used on stack `background` field. Unlike colors,
// these resolve to SwiftUI `Material` values that go inside `.background(...)`.
function swiftMaterial(token) {
  const map = {
    glassUltraThin: '.ultraThinMaterial',
    glassThin:      '.thinMaterial',
    glassRegular:   '.regularMaterial',
    glassThick:     '.thickMaterial',
    glassUltraThick:'.ultraThickMaterial',
    ultraThinMaterial: '.ultraThinMaterial',
    thinMaterial:      '.thinMaterial',
    regularMaterial:   '.regularMaterial',
    thickMaterial:     '.thickMaterial',
    ultraThickMaterial:'.ultraThickMaterial',
    bar:               '.bar'
  }
  return map[token] || null
}

function stackOpener(stackType, alignment, spacing, stack) {
  const align = alignment && alignment !== 'center' ? `.${alignment}` : null
  const sp = typeof spacing === 'number' ? spacing : null
  const argList = []
  if (align) argList.push(`alignment: ${align}`)
  if (sp != null) argList.push(`spacing: ${sp}`)
  const argStr = argList.length ? `(${argList.join(', ')})` : ''
  switch (stackType) {
    case 'hstack':          return `HStack${argStr} {`
    case 'zstack':          return `ZStack${align ? `(alignment: ${align})` : ''} {`
    case 'lazyhstack':      return `LazyHStack${argStr} {`
    case 'lazyvstack':      return `LazyVStack${argStr} {`
    // section and disclosure are handled as early-return paths in renderStack
    case 'navigationStack': return `NavigationStack {`
    case 'tabView':         return `TabView {`
    // Spec §1.24 — ScrollView axes default to `.vertical`. We only emit
    // the axis argument when the designer overrode the default; same for
    // showsIndicators (default true).
    case 'scrollView':      return scrollViewOpener(stack)
    // ViewThatFits accepts an `in:` axis set; default is both axes.
    case 'viewThatFits': {
      const axes = stack?.fitsAxes
      const arg = axes && axes !== 'both'
        ? (axes === 'horizontal' ? '(in: .horizontal)' : '(in: .vertical)')
        : ''
      return `ViewThatFits${arg} {`
    }
    // LazyV/HGrid emit fully via the renderStack code path (it already
    // knows about adaptive vs fixed columns); these fall through to the
    // catch-all so the renderer routes them correctly.
    default:                return `VStack${argStr} {`
  }
}

// SwiftUI animation curve → SwiftUI .animation(...) expression.
function animationCurveExpr(an) {
  const dur = an.duration ?? 0.35
  switch (an.curve) {
    case 'spring':    return `.spring(response: ${an.springResponse ?? 0.55}, dampingFraction: ${an.springDamping ?? 0.825})`
    case 'linear':    return `.linear(duration: ${dur})`
    case 'easeIn':    return `.easeIn(duration: ${dur})`
    case 'easeOut':   return `.easeOut(duration: ${dur})`
    case 'easeInOut': return `.easeInOut(duration: ${dur})`
    case 'default':   return null
    default:          return null
  }
}

// SwiftUI transition keyword → `.transition(.x)` expression. Only emitted
// when the user picked something other than the default opacity transition.
function transitionExpr(name) {
  if (!name || name === 'opacity') return null
  if (name === 'slide')    return '.slide'
  if (name === 'scale')    return '.scale'
  if (name === 'identity') return '.identity'
  if (name === 'move')     return '.move(edge: .bottom)'
  return `.${name}`
}

// ---------- text / panel rendering ----------

function renderModifiers(panel, lines, pad) {
  // Walk the ordered modifier stack. Each entry's registry `emit()` returns
  // the SwiftUI source line(s) — chain order matches inspector order which
  // matches the array order. `.padding().background()` is not the same as
  // the reverse, and the export preserves whichever the designer chose.
  const ind = `${indent(pad)}    `
  const arr = Array.isArray(panel.modifiers) ? panel.modifiers : []
  for (const entry of arr) {
    const def = MODIFIERS[entry.type]
    if (!def || typeof def.emit !== 'function') continue
    const out = def.emit(entry, panel)
    if (!out) continue
    if (Array.isArray(out)) {
      for (const ln of out) if (ln) lines.push(`${ind}${ln}`)
    } else {
      lines.push(`${ind}${out}`)
    }
  }

  // 3D-primitive transforms — Z offset (`.offset(z:)`) plus per-axis
  // rotation (`.rotation3DEffect(...)`). These live on the panel root (not
  // in the modifier stack) because 3D primitives have their own dedicated
  // transform section in the inspector and reject the 2D modifier set.
  const threeD = ['sphere', 'box', 'plane', 'cone', 'cylinder', 'text3d', 'mesh']
  if (threeD.includes(panel.panelType)) {
    if (panel.zOffset) lines.push(`${ind}.offset(z: ${panel.zOffset})`)
    if (panel.rotX)    lines.push(`${ind}.rotation3DEffect(.degrees(${panel.rotX}), axis: (x: 1, y: 0, z: 0))`)
    if (panel.rotY)    lines.push(`${ind}.rotation3DEffect(.degrees(${panel.rotY}), axis: (x: 0, y: 1, z: 0))`)
    if (panel.rotZ)    lines.push(`${ind}.rotation3DEffect(.degrees(${panel.rotZ}), axis: (x: 0, y: 0, z: 1))`)
  }

  // visionOS `.hoverEffect()` family (spec §3.5) — kept as fixed panel-root
  // fields, not modifier-stack entries, because the four knobs are tightly
  // coupled (only one `.hoverEffect` per view; the others control inheritance).
  if (
    isInteractivePanel(panel.panelType) &&
    panel.hoverEffect && panel.hoverEffect !== 'inherit' && panel.hoverEffect !== 'none'
  ) {
    lines.push(`${ind}.hoverEffect(.${panel.hoverEffect})`)
  }
  if (panel.hoverEffectDisabled) lines.push(`${ind}.hoverEffectDisabled(true)`)
  if (panel.defaultHoverEffect && panel.defaultHoverEffect !== 'automatic') {
    lines.push(`${ind}.defaultHoverEffect(.${panel.defaultHoverEffect})`)
  }
  if (panel.hoverEffectGroup) {
    lines.push(`${ind}.hoverEffectGroup(.${panel.hoverEffectGroup})`)
  }

  // Accessibility — `panel.accessibility` carries label/hint/value/traits.
  // Empty strings are skipped so the chain doesn't pick up no-ops.
  const a = panel.accessibility || {}
  if (a.label) lines.push(`${ind}.accessibilityLabel("${escapeString(a.label)}")`)
  if (a.hint)  lines.push(`${ind}.accessibilityHint("${escapeString(a.hint)}")`)
  if (a.value) lines.push(`${ind}.accessibilityValue("${escapeString(a.value)}")`)
  if (Array.isArray(a.traits) && a.traits.length) {
    const traits = a.traits.map((t) => `.${t}`).join(', ')
    lines.push(`${ind}.accessibilityAddTraits([${traits}])`)
  }
  if (a.isAccessibilityElement === false) {
    lines.push(`${ind}.accessibilityHidden(true)`)
  }

  // Animation + transition. The modern API is `.animation(_:value:)`
  // with a binding that re-triggers the animation when it changes —
  // but at design time we have no concrete state to bind to. We emit
  // the *deprecated* single-arg `.animation(_:)` which still applies
  // implicitly to any state change in this view, and add a one-line
  // comment pointing the user at the modern form. This actually
  // animates (the previous `value: false` placeholder never fired),
  // at the cost of a deprecation warning the user can resolve by
  // switching to `.animation(curve, value: $yourState)`.
  const an = panel.animation
  if (an) {
    const curve = animationCurveExpr(an)
    if (curve) {
      lines.push(`${ind}.animation(${curve})  // prefer .animation(${curve}, value: $yourState)`)
    }
    const trans = transitionExpr(an.transition)
    if (trans) {
      lines.push(`${ind}.transition(${trans})`)
    }
  }
}

function renderPanel(panel, items, pad, out) {
  const ind = indent(pad)
  const push = (l) => out.push(ind + l)

  // A RealityView's children are RealityKit entities, not panels, so the
  // entity emitter owns it. The registry's own emit is a stub that only
  // prints a TODO; intercepting here is what turns it into real content.
  // With no entities we fall through to that stub, which is the honest
  // output for an empty RealityView.
  if (panel.panelType === 'realityview' && hasEntityChildren(panel.id, items)) {
    const plan = emitRealityView(panel.id, items, pad, out, {
      frameDepth: panel.depth || null
    })
    if (plan && plan.any) {
      emitBehaviorModifiers(plan, pad, out)
      pendingBehaviorPlans.push(plan)
    }
    renderModifiers(panel, out, pad)
    return
  }
  const sym = panel.symbolName
  const textColor = swiftColor(panel.textColorToken, panel.textColor)
  const fill = swiftColor(panel.colorToken, panel.color)
  const style = panel.textStyle || 'body'
  const fontW = panel.fontWeight
  // Only emit `.weight(...)` when the panel's weight differs from the
  // visionOS default for its text style. visionOS body resolves to Medium,
  // titles/headline to Bold — emitting `.weight(.medium)` for body would
  // be redundant and could lock the device into a fixed value if Apple
  // tunes the style later. See textStyleDefaultWeight in appleSystem.js.
  const styleDefault = textStyleDefaultWeight(style)
  const weight = fontW && fontW !== styleDefault ? `.weight(.${fontW})` : ''

  const applyTextModifiers = (l) => {
    // Text-display modifiers (.italic, .underline, .lineLimit, .tracking,
    // …) used to live as panel-root fields and get appended here. They've
    // moved into the modifier stack (`panel.modifiers[]`) and are emitted by
    // `renderModifiers` below in the order the designer placed them.
    //
    // `.multilineTextAlignment` is the one exception — it tracks the panel's
    // `textAlign` field (an intrinsic Text property exposed in the Text
    // section of the inspector), not a stack entry, so we still emit it here.
    const mods = []
    if (panel.textAlign && panel.textAlign !== 'center') {
      mods.push(`.multilineTextAlignment(.${panel.textAlign === 'left' ? 'leading' : 'trailing'})`)
    }
    return l + (mods.length ? mods.map((m) => `\n${ind}    ${m}`).join('') : '')
  }

  emitPanel(panel, {
    push, ind, out,
    escapeString, swiftColor, unitsToPt, applyTextModifiers,
    sym, fill, textColor, style, weight,
    // Lookup so per-panel emitters (button's tapAction in particular)
    // can resolve a referenced window/panel id back to its record.
    // Falls back to null when the id no longer exists, so emitters
    // can degrade to a generic identifier.
    lookupItem: (id) => items.find((it) => it.id === id) || null
  })

  // `.symbolVariant` — the `.fill` / `.circle` / `.square` / `.slash` form of
  // an SF Symbol. The canvas swaps the actual glyph for it (see the symbol
  // map in `icons.jsx`) and the export dropped it, so a filled icon on screen
  // came back outlined in Xcode. Emitted here rather than inside each
  // symbol-bearing emitter because the field is universal — every panel type
  // carries it — and guarded on the panel actually having a symbol, so it
  // never lands on a view with no glyph to vary. AUDIT #20.
  if (panel.symbolName && panel.symbolVariant) {
    out.push(`${indent(pad)}    .symbolVariant(.${panel.symbolVariant})`)
  }

  renderModifiers(panel, out, pad)

  // Panel sizing, after the user's own modifier chain so the frame bounds
  // whatever that chain produced — the same order the stack closer uses.
  // `frameSpec` returns null for the types that size themselves, so the only
  // guard needed here is the one for a `.frame` entry the user put in the
  // modifier stack, which layout.js treats as the source of truth.
  if (!hasFrameModifier(panel)) {
    const f = frameModifier(panel)
    if (f) out.push(`${indent(pad)}    ${f}`)
  }

  // Free placement last, so it moves the framed view rather than being
  // absorbed by a later frame.
  const off = positionOffset(panel, items)
  if (off) out.push(`${indent(pad)}    ${off}`)
}

// ---------- presentation emission (sheet/popover/alert) -----------------
//
// Presentation panels are conceptually modifiers on the parent view, not
// children. We collect them into a list returned to the parent renderer,
// which appends `.sheet(...)`/`.alert(...)`/`.popover(...)` AFTER the body
// is closed. A stateBag is also threaded through so `wrapTabView` can emit
// matching `@State` declarations on the View struct.

function emitPresentationModifier(p, pad, out, stateBag) {
  const ind = `${indent(pad)}    `
  const stateName = stateVarName(p.id)
  stateBag.push(stateName)

  if (p.panelType === 'sheet') {
    // Spec §1.25 — translate the inspector's detent/fraction/height into
    // SwiftUI's `.presentationDetents([...])`. All other presentation
    // modifiers are emitted as a chain on the sheet content.
    let detent = '.large'
    if (p.sheetDetent === 'medium') detent = '.medium'
    else if (p.sheetDetent === 'fraction') detent = `.fraction(${p.sheetFraction ?? 0.5})`
    else if (p.sheetDetent === 'height')   detent = `.height(${p.sheetHeight ?? 320})`
    out.push(`${ind}.sheet(isPresented: $${stateName}) {`)
    out.push(`${ind}    Text("${escapeString(p.text || 'Sheet')}")`)
    out.push(`${ind}        .presentationDetents([${detent}])`)
    if (p.presentationDragIndicator && p.presentationDragIndicator !== 'automatic') {
      out.push(`${ind}        .presentationDragIndicator(.${p.presentationDragIndicator})`)
    }
    if (p.presentationCornerRadius && p.presentationCornerRadius > 0) {
      out.push(`${ind}        .presentationCornerRadius(${p.presentationCornerRadius})`)
    }
    if (p.presentationContentInteraction && p.presentationContentInteraction !== 'automatic') {
      out.push(`${ind}        .presentationContentInteraction(.${p.presentationContentInteraction})`)
    }
    if (p.presentationBackgroundInteraction && p.presentationBackgroundInteraction !== 'automatic') {
      out.push(`${ind}        .presentationBackgroundInteraction(.${p.presentationBackgroundInteraction})`)
    }
    if (p.interactiveDismissDisabled) {
      out.push(`${ind}        .interactiveDismissDisabled()`)
    }
    out.push(`${ind}}`)
  } else if (p.panelType === 'popover') {
    // visionOS ignores `arrowEdge:` but the SwiftUI signature still
    // accepts it — emit when the designer set a non-automatic value so
    // the code compiles unchanged on iPadOS / macOS.
    const arrow = p.popoverArrowEdge && p.popoverArrowEdge !== 'automatic'
      ? `, arrowEdge: .${p.popoverArrowEdge}` : ''
    // `attachmentAnchor:` defaults to `.rect(.bounds)`, so it is emitted only
    // when the designer picked the point anchor. It was read by neither side
    // before phase 1.3 — a live control wired to nothing — and the canvas now
    // draws a narrower arrow for it, so the code has to carry it too.
    const anchor = p.popoverAnchor === 'point'
      ? ', attachmentAnchor: .point(.center)' : ''
    out.push(`${ind}.popover(isPresented: $${stateName}${anchor}${arrow}) {`)
    out.push(`${ind}    Text("${escapeString(p.text || 'Popover')}")`)
    out.push(`${ind}        .padding()`)
    out.push(`${ind}}`)
  } else if (p.panelType === 'confirmationdialog') {
    // Spec §1.25 — confirmationDialog auto-adds a Cancel/dismiss button
    // when none is provided. We honour any list the designer supplied
    // and detect destructive/cancel roles by name.
    const buttons = p.alertButtons && p.alertButtons.length ? p.alertButtons : ['Cancel']
    const tv = p.titleVisibility && p.titleVisibility !== 'automatic'
      ? `, titleVisibility: .${p.titleVisibility}` : ''
    out.push(`${ind}.confirmationDialog("${escapeString(p.text || 'Confirm')}", isPresented: $${stateName}${tv}) {`)
    for (const btn of buttons) {
      const role = /cancel/i.test(btn) ? ', role: .cancel'
                 : /delete|remove|destroy/i.test(btn) ? ', role: .destructive'
                 : ''
      out.push(`${ind}    Button("${escapeString(btn)}"${role}) { }`)
    }
    if (p.alertMessage) {
      out.push(`${ind}} message: {`)
      out.push(`${ind}    Text("${escapeString(p.alertMessage)}")`)
    }
    out.push(`${ind}}`)
  } else if (p.panelType === 'inspector') {
    // Spec §1.25 — `.inspector(isPresented:content:)` becomes a trailing
    // sidebar on wide windows and a sheet in compact contexts. Width
    // hints (`.inspectorColumnWidth`) chain after the closure.
    out.push(`${ind}.inspector(isPresented: $${stateName}) {`)
    out.push(`${ind}    Text("${escapeString(p.text || 'Inspector')}")`)
    out.push(`${ind}        .padding()`)
    out.push(`${ind}}`)
    if (p.inspectorColumnWidth != null) {
      out.push(`${ind}.inspectorColumnWidth(${p.inspectorColumnWidth})`)
    } else if (p.inspectorMinWidth != null || p.inspectorIdealWidth != null || p.inspectorMaxWidth != null) {
      const args = []
      if (p.inspectorMinWidth   != null) args.push(`min: ${p.inspectorMinWidth}`)
      if (p.inspectorIdealWidth != null) args.push(`ideal: ${p.inspectorIdealWidth}`)
      if (p.inspectorMaxWidth   != null) args.push(`max: ${p.inspectorMaxWidth}`)
      out.push(`${ind}.inspectorColumnWidth(${args.join(', ')})`)
    }
  } else if (p.panelType === 'alert') {
    const buttons = p.alertButtons && p.alertButtons.length ? p.alertButtons : ['OK']
    out.push(`${ind}.alert("${escapeString(p.text || 'Alert')}", isPresented: $${stateName}) {`)
    for (const btn of buttons) {
      const role = /cancel/i.test(btn) ? ', role: .cancel'
                 : /delete|remove|destroy/i.test(btn) ? ', role: .destructive'
                 : ''
      out.push(`${ind}    Button("${escapeString(btn)}"${role}) { }`)
    }
    if (p.alertMessage) {
      out.push(`${ind}} message: {`)
      out.push(`${ind}    Text("${escapeString(p.alertMessage)}")`)
    }
    out.push(`${ind}}`)
    // Dialog metadata modifiers — `.dialogIcon`, `.dialogSeverity`,
    // `.dialogSuppressionToggle` chain after the alert closure.
    if (p.dialogIcon) {
      out.push(`${ind}.dialogIcon(Image(systemName: "${escapeString(p.dialogIcon)}"))`)
    }
    if (p.dialogSeverity && p.dialogSeverity !== 'automatic') {
      out.push(`${ind}.dialogSeverity(.${p.dialogSeverity})`)
    }
    if (p.dialogSuppressionToggle) {
      out.push(`${ind}.dialogSuppressionToggle(isSuppressed: .constant(false))`)
    }
  }
}

// ---------- stack rendering ----------

// Spec §1.26 — Render a `toolbar` stack as a `.toolbar { ... }` modifier
// on the parent view. Items inside are emitted as `ToolbarItem(placement:)`
// or `ToolbarItemGroup(placement:)` blocks. Used by renderWindow /
// renderStack to attach toolbar children as a trailing modifier rather
// than an inline child.
function emitToolbarModifier(toolbar, items, pad, out, stateBag) {
  const ind = `${indent(pad)}    `
  const inner = indent(pad + 2)
  out.push(`${ind}.toolbar {`)
  const kids = items.filter((c) => c.parentId === toolbar.id && c.visible !== false)
  for (const k of kids) {
    if (k.type !== 'stack') continue
    const placement = k.toolbarPlacement || 'automatic'
    if (k.stackType === 'toolbarItemGroup') {
      out.push(`${inner}ToolbarItemGroup(placement: .${placement}) {`)
      const inners = items.filter((c) => c.parentId === k.id)
      for (const ii of inners) {
        if (ii.type === 'panel') renderPanel(ii, items, pad + 3, out)
        else if (ii.type === 'stack') renderStack(ii, items, pad + 3, out, stateBag)
      }
      out.push(`${inner}}`)
    } else {
      // Treat anything else (toolbarItem or generic stacks) as a single
      // ToolbarItem. Unknown sub-stacks render their child as the body.
      out.push(`${inner}ToolbarItem(placement: .${placement}) {`)
      const inners = items.filter((c) => c.parentId === k.id)
      if (inners.length === 0) {
        // Empty placeholder so the closure compiles.
        out.push(`${inner}    Text("Item")`)
      } else {
        for (const ii of inners) {
          if (ii.type === 'panel') renderPanel(ii, items, pad + 3, out)
          else if (ii.type === 'stack') renderStack(ii, items, pad + 3, out, stateBag)
        }
      }
      out.push(`${inner}}`)
    }
  }
  out.push(`${ind}}`)
}

function renderStack(stack, items, pad, out, stateBag) {
  const ind = indent(pad)

  // Toolbar / ToolbarItem / ToolbarItemGroup stacks are inline-skip when
  // rendered standalone — they only make sense as a `.toolbar { ... }`
  // modifier emitted by emitToolbarModifier. If a designer drops one
  // outside a parent that handles it (e.g. a free-floating toolbar in
  // the layers tree), emit a comment so the export still compiles.
  if (stack.stackType === 'toolbar' || stack.stackType === 'toolbarItem' || stack.stackType === 'toolbarItemGroup') {
    out.push(`${ind}// ${stack.stackType} — render via .toolbar { … } modifier on the parent`)
    return
  }

  // NavigationSplitView — styled root HStack with splitStyle.
  //
  // Which child goes in which column mirrors `layout.js`, which renders
  // EVERY child of a split view: an explicit `slot` wins (what the sidebar
  // wizard writes), then the wrapper-stack names the older templates use,
  // and failing both the first child becomes the sidebar and the rest the
  // detail. Matching only two children by their user-visible name used to
  // drop whole panes on the floor — renaming "Detail" to anything else in
  // the layers panel deleted it from the export, and the `filesApp`
  // template (whose detail pane is called "Main") lost its entire
  // right-hand side.
  if (stack.splitStyle) {
    const children = items.filter((c) => c.parentId === stack.id && c.visible !== false)
    const slotted = children.some((c) => c.slot === 'sidebar' || c.slot === 'detail')
    let sidebarKids
    let detailKids
    if (slotted) {
      sidebarKids = children.filter((c) => (c.slot || 'sidebar') === 'sidebar')
      detailKids = children.filter((c) => c.slot === 'detail')
    } else {
      const byName = (n) => children.filter((c) => c.name === n)
      const named = { sidebar: byName('Sidebar'), detail: byName('Detail') }
      const coversEverything =
        named.sidebar.length > 0 && named.detail.length > 0 &&
        named.sidebar.length + named.detail.length === children.length
      sidebarKids = coversEverything ? named.sidebar : children.slice(0, 1)
      detailKids = coversEverything ? named.detail : children.slice(1)
    }
    const renderChild = (c) => {
      if (c.type === 'stack') renderStack(c, items, pad + 1, out, stateBag)
      else if (c.type === 'panel') renderPanel(c, items, pad + 1, out)
    }
    out.push(`${ind}NavigationSplitView {`)
    for (const c of sidebarKids) renderChild(c)
    out.push(`${ind}} detail: {`)
    if (detailKids.length === 0) {
      // Empty placeholder so the closure compiles.
      out.push(`${indent(pad + 1)}Text("Detail")`)
    } else {
      for (const c of detailKids) renderChild(c)
    }
    out.push(`${ind}}`)
    if (stack.searchable && stack.searchable !== 'none') {
      out.push(`${ind}    .searchable(text: .constant(""), placement: .${stack.searchable === 'sidebar' ? 'sidebar' : 'toolbar'}, prompt: "${escapeString(stack.searchPrompt || 'Search')}")`)
    }
    return
  }

  // SwiftUI in-window TabView nesting — child `tab` stacks emit
  // `Tab("Label", systemImage: "icon") { ... }` (the modern visionOS API,
  // distinct from the legacy `.tabItem { ... }` that sits on a generic view).
  if (stack.stackType === 'tab') {
    const label = escapeString(stack.tabLabel || stack.name || 'Tab')
    if (stack.tabIcon) {
      out.push(`${ind}Tab("${label}", systemImage: "${escapeString(stack.tabIcon)}") {`)
    } else {
      out.push(`${ind}Tab("${label}") {`)
    }
    const kids = items.filter((c) => c.parentId === stack.id)
    // A Tab's body is a single VStack of its children — keeps padding/spacing
    // consistent with how Apple wires Tab content.
    if (kids.length === 1) {
      const c = kids[0]
      if (c.type === 'stack') renderStack(c, items, pad + 1, out, stateBag)
      else if (c.type === 'panel') renderPanel(c, items, pad + 1, out)
    } else if (kids.length > 1) {
      {
        const sp = typeof stack.spacing === 'number' ? `, spacing: ${stack.spacing}` : ''
        out.push(`${ind}    VStack(alignment: .${stack.alignment || 'center'}${sp}) {`)
      }
      for (const c of kids) {
        if (c.type === 'stack') renderStack(c, items, pad + 2, out, stateBag)
        else if (c.type === 'panel') renderPanel(c, items, pad + 2, out)
      }
      out.push(`${ind}    }`)
      closeStackBox(stack, out, `${ind}        `)
    }
    out.push(`${ind}}`)
    return
  }

  // Section — emit with optional header string and footer text.
  if (stack.stackType === 'section') {
    const header = stack.sectionHeader || ''
    const footer = stack.sectionFooter || ''
    if (header) {
      out.push(`${ind}Section("${escapeString(header)}") {`)
    } else {
      out.push(`${ind}Section {`)
    }
    const kids = items.filter((c) => c.parentId === stack.id)
    for (const c of kids) {
      if (c.type === 'stack') renderStack(c, items, pad + 1, out, stateBag)
      else if (c.type === 'panel') renderPanel(c, items, pad + 1, out)
    }
    if (footer) {
      out.push(`${ind}} footer: {`)
      out.push(`${ind}    Text("${escapeString(footer)}")`)
    }
    out.push(`${ind}}`)
    closeStackBox(stack, out, `${ind}    `)
    return
  }

  // DisclosureGroup — emit with label and @State isExpanded binding.
  if (stack.stackType === 'disclosure') {
    const label = stack.disclosureLabel || 'Section'
    const stateVar = `isExpanded_${String(stack.id).replace(/[^A-Za-z0-9]/g, '_')}`
    stateBag.push(stateVar)
    out.push(`${ind}DisclosureGroup(isExpanded: $${stateVar}) {`)
    const kids = items.filter((c) => c.parentId === stack.id)
    for (const c of kids) {
      if (c.type === 'stack') renderStack(c, items, pad + 1, out, stateBag)
      else if (c.type === 'panel') renderPanel(c, items, pad + 1, out)
    }
    out.push(`${ind}} label: {`)
    out.push(`${ind}    Text("${escapeString(label)}")`)
    out.push(`${ind}}`)
    closeStackBox(stack, out, `${ind}    `)
    return
  }

  // A stack marked `scrollable` becomes a real `ScrollView` wrapping the
  // stack, which is what the canvas models: the box is the viewport and the
  // children overflow inside it. This used to emit a
  // `// wrap in ScrollView { ... }` comment instead, so the two shipped
  // templates that rely on it (settings, article) exported a view that
  // simply clipped its overflow. AUDIT #3.
  //
  // Only the plain-stack path scrolls. Section, DisclosureGroup, Tab bodies
  // and NavigationSplitView return earlier and bring their own scrolling
  // semantics; the canvas does not offer the toggle on those either.
  const scrolls = !!stack.scrollable
  const boxInd = indent(pad)
  const contentPad = scrolls ? pad + 1 : pad
  const contentInd = indent(contentPad)
  if (scrolls) out.push(`${boxInd}${scrollViewOpener(stack)}`)

  // Grid family — `grid`, `lazyVGrid`, `lazyHGrid` all share the
  // adaptive-vs-fixed column model on the canvas. SwiftUI's `Grid` view
  // doesn't take a `columns:` parameter — that's `LazyVGrid` semantics —
  // so we emit `LazyVGrid` for the legacy `grid` type to preserve the
  // existing exporter contract, and `LazyHGrid` for `lazyHGrid`.
  const isGridLike = stack.stackType === 'grid' ||
                     stack.stackType === 'lazyVGrid' ||
                     stack.stackType === 'lazyHGrid'
  if (isGridLike) {
    const hasSp = typeof stack.spacing === 'number'
    const itemSp = hasSp ? `, spacing: ${stack.spacing}` : ''
    const gridSp = hasSp ? `, spacing: ${stack.spacing}` : ''
    const isHorizontal = stack.stackType === 'lazyHGrid'
    const ctor = isHorizontal ? 'LazyHGrid' : 'LazyVGrid'
    const tracksKey = isHorizontal ? 'rows' : 'columns'
    if ((stack.gridMode || 'fixed') === 'adaptive') {
      out.push(`${contentInd}${ctor}(${tracksKey}: [GridItem(.adaptive(minimum: ${stack.minColumnWidth ?? 140})${itemSp})]${gridSp}) {`)
    } else {
      out.push(`${contentInd}${ctor}(${tracksKey}: Array(repeating: GridItem(.flexible()${itemSp}), count: ${stack.columns || 2})${gridSp}) {`)
    }
  } else {
    out.push(`${contentInd}${stackOpener(stack.stackType, stack.alignment, stack.spacing, stack)}`)
  }

  const kids = items.filter((c) => c.parentId === stack.id)
  for (const c of kids) {
    if (c.type === 'stack') renderStack(c, items, contentPad + 1, out, stateBag)
    else if (c.type === 'panel') renderPanel(c, items, contentPad + 1, out)
  }
  out.push(`${contentInd}}`)

  // Content-level modifiers: padding insets the children and scrolls WITH
  // them, so it stays on the stack even when a ScrollView wraps it.
  for (const p of paddingModifiers(stack)) out.push(`${contentInd}    ${p}`)

  // Close the ScrollView, if one was opened above. Everything after this
  // point describes the BOX — its size, its fill, its clip — and the box is
  // the ScrollView's viewport, not the scrolling content. Putting the frame
  // inside would pin the content to the viewport height and it would never
  // scroll; putting the background inside would scroll the fill away with
  // the content.
  if (scrolls) out.push(`${boxInd}}`)

  // Closing modifiers on the stack container.
  //
  // Order is load-bearing and mirrors how the canvas composes the box:
  //   .padding  — insets the CONTENT, inside the frame (emitted above)
  //   .frame    — sizes the box itself
  //   .background / .clipShape — paint that box
  // Emitting `.frame` before `.padding` would grow the view past its frame
  // instead of insetting within it, and painting the background before the
  // frame would leave it sized to the content rather than the box.
  const boxMod = `${boxInd}    `
  const f = frameModifier(stack)
  if (f) out.push(`${boxMod}${f}`)
  if (stack.background) {
    const mat = swiftMaterial(stack.background)
    if (mat) {
      out.push(`${boxMod}.background(${mat})`)
    } else {
      const bg = stack.background.startsWith('#')
        ? swiftColor(null, stack.background)
        : swiftColor(stack.background, null)
      out.push(`${boxMod}.background(${bg})`)
    }
  }
  if (stack.cornerRadius) {
    const cr = unitsToPt(stack.cornerRadius)
    out.push(`${boxMod}.clipShape(RoundedRectangle(cornerRadius: ${cr}, style: .continuous))`)
  }
  if (stack.navTitle) out.push(`${boxMod}.navigationTitle("${escapeString(stack.navTitle)}")`)
  if (stack.ornament) {
    out.push(`${boxMod}.ornament(attachmentAnchor: .scene(.${stack.ornament})) {`)
    out.push(`${boxInd}        // ornament content — render the stack's children here`)
    out.push(`${boxMod}}`)
  }
}

// ---------- navigation bar -> .toolbar ---------------------------------
//
// A NavigationBar has no single SwiftUI primitive; it is window chrome, and
// SwiftUI expresses that as `.navigationTitle` plus `.toolbar { ... }` on the
// window body. That is exactly how the designer models it too (navbar is a
// window-level panel, never nested in a content stack), so the mapping is
// direct. `NAVBAR_STYLE_SPECS` decides which slots the chosen style fills.
function emitNavbarToolbar(panel, items, pad, out) {
  const ind = `${indent(pad)}    `
  const spec = NAVBAR_STYLE_SPECS[panel.navbarStyle] || NAVBAR_STYLE_SPECS.trailingButtons
  const lookupItem = (id) => items.find((it) => it.id === id) || null
  const title = panel.title || ''

  // A leading-aligned title is what `.navigationTitle` already renders on
  // visionOS; a centred one needs the explicit `.principal` slot.
  if (title && spec.titleAlign !== 'center') {
    out.push(`${ind}.navigationTitle("${escapeString(title)}")`)
  }

  // One Button per configured item. `label` wins over `symbolName` when set,
  // matching how the canvas draws the chip.
  const buttonFor = (b) => {
    const action = compileTapAction(b?.tapAction, lookupItem)
    const label = b?.label
      ? `Text("${escapeString(b.label)}")`
      : `Image(systemName: "${escapeString(b?.symbolName || 'circle')}")`
    return `Button{ ${action} } label: { ${label} }`
  }

  const rows = []
  const centredTitle = title && spec.titleAlign === 'center'
  if (centredTitle) {
    rows.push([`ToolbarItem(placement: .principal) {`, [`Text("${escapeString(title)}").font(.headline)`], `}`])
  }

  if (spec.leading === 'buttons') {
    const btns = (panel.leadingButtons || []).map(buttonFor)
    if (btns.length) {
      rows.push([`ToolbarItemGroup(placement: .topBarLeading) {`, btns, `}`])
    }
  } else if (spec.leading === 'backCircle' || spec.leading === 'backCapsule') {
    // The designer's Back affordance maps to a dismiss action. Which
    // environment value that is depends on how the window was presented, so
    // the generated button points at the two candidates rather than guessing.
    const label = spec.leading === 'backCapsule'
      ? `Label("Back", systemImage: "chevron.backward")`
      : `Image(systemName: "chevron.backward")`
    rows.push([`ToolbarItem(placement: .topBarLeading) {`, [
      `// Use @Environment(\\.dismiss) for a sheet, or @Environment(\\.dismissWindow) for a window.`,
      `Button{ /* dismiss() */ } label: { ${label} }`
    ], `}`])
  }

  if (spec.trailing === 'buttons') {
    const btns = (panel.trailingButtons || []).map(buttonFor)
    if (btns.length) {
      rows.push([`ToolbarItemGroup(placement: .topBarTrailing) {`, btns, `}`])
    }
  } else if (spec.trailing === 'avatar') {
    rows.push([`ToolbarItem(placement: .topBarTrailing) {`, [
      `Image(systemName: "person.crop.circle.fill")`,
      `    .font(.title2)`
    ], `}`])
  } else if (spec.trailing === 'search') {
    // `.searchable` is a view modifier, not a toolbar item, so it is emitted
    // alongside the toolbar rather than inside it.
    rows.push(null)
  }

  if (rows.filter(Boolean).length > 0) {
    out.push(`${ind}.toolbar {`)
    for (const row of rows) {
      if (!row) continue
      const [open, body, close] = row
      out.push(`${ind}    ${open}`)
      for (const l of body) out.push(`${ind}        ${l}`)
      out.push(`${ind}    ${close}`)
    }
    out.push(`${ind}}`)
  }

  if (spec.trailing === 'search') {
    out.push(`${ind}.searchable(text: $navbarSearchText, prompt: "Search")`)
  }
}

function renderWindow(win, items, pad, out, stateBag) {
  const ind = indent(pad)
  // A Window's direct content children — separate ornaments and presentation
  // overlays so each can attach as a modifier rather than an inline child.
  // Spec §1.25 — every panel type that attaches as a `.xxx(...)` modifier
  // on the parent view, not as an inline child. We separate them so they
  // can ride along after the body and emit matching `@State` declarations.
  const ownChildren = items.filter((c) => c.parentId === win.id)
  const presentationKids = ownChildren.filter((c) => c.type === 'panel' && isPresentationPanel(c.panelType))
  const ornamentKids = ownChildren.filter((c) => c.type === 'stack' && c.ornament)
  // Spec §1.26 — every Toolbar child becomes a `.toolbar { … }` modifier
  // on the window body. Direct children with stackType 'toolbar' route
  // here instead of being emitted inline.
  const toolbarKids = ownChildren.filter((c) => c.type === 'stack' && c.stackType === 'toolbar')
  // Navigation bars are window chrome and export as `.toolbar { … }` on the
  // body, so they route out of the inline content the same way toolbars do.
  const navbarKids = ownChildren.filter((c) => c.type === 'panel' && c.panelType === 'navbar')
  // RealityKit entities parented straight to the window. A volumetric window
  // IS a RealityView, so its entity children become that view's content.
  // Without this they fell out of the render entirely: every volume template
  // exported an empty `ZStack { }`.
  const entityKids = ownChildren.filter((c) => c.type === 'entity')
  const inlineKids = ownChildren.filter((c) =>
    !presentationKids.includes(c) && !ornamentKids.includes(c) && !toolbarKids.includes(c) &&
    !navbarKids.includes(c) && !entityKids.includes(c)
  )

  // Wrap the window content in a ScrollView when the designer flipped
  // the `Scrollable` toggle. This keeps the SwiftUI tree compact —
  // no spare ScrollView wrappers for windows that fit their plate.
  const openWrap = win.scrollable ? `${ind}ScrollView {` : `${ind}ZStack {`
  const closeWrap = `${ind}}`
  out.push(openWrap)
  for (const c of inlineKids) {
    if (c.type === 'stack') renderStack(c, items, pad + 1, out, stateBag)
    else if (c.type === 'panel') renderPanel(c, items, pad + 1, out)
  }
  if (entityKids.length > 0) {
    const plan = emitRealityView(win.id, items, pad + 1, out)
    if (plan && plan.any) {
      // Gestures attach to the RealityView itself, so they go here rather
      // than on the enclosing ZStack.
      emitBehaviorModifiers(plan, pad + 1, out)
      pendingBehaviorPlans.push(plan)
    }
  }
  out.push(closeWrap)

  // A volumetric window is sized in metres by `.defaultSize(… in: .meters)`
  // on the WindowGroup, and its content fills the volume. Pinning the body to
  // a point-based frame would fight that, so flat plates get the frame and
  // volumes do not.
  const isVolumetric = win.windowStyle === 'volumetric'
  if (!isVolumetric) {
    // Padding BEFORE frame. The canvas treats `win.padding` as an inner
    // inset — a 1200×800 plate whose content area is 1172×772 — and
    // `.frame(…).padding(14)` is the opposite: it grows the view to
    // 1228×828 with the content still at full size. Insetting first and
    // then pinning the box reproduces what the designer sees.
    if (win.padding) out.push(`${ind}    .padding(${win.padding})`)
    out.push(`${ind}    .frame(width: ${unitsToPt(win.size?.[0] || 0)}, height: ${unitsToPt(win.size?.[1] || 0)})`)
  }

  // Toolbars first — they sit at the chrome level. Each child Toolbar
  // attaches as its own `.toolbar { … }` modifier.
  for (const t of toolbarKids) {
    emitToolbarModifier(t, items, pad, out, stateBag)
  }

  // Navigation bars, same chrome level. A `trailingSearch` style needs a
  // `@State` string for its `.searchable` binding.
  for (const nb of navbarKids) {
    const spec = NAVBAR_STYLE_SPECS[nb.navbarStyle] || NAVBAR_STYLE_SPECS.trailingButtons
    if (spec.trailing === 'search') {
      stateBag.push({ name: 'navbarSearchText', type: 'String', default: '""' })
    }
    emitNavbarToolbar(nb, items, pad, out)
  }

  // Ornaments next (visionOS draws them in the scene-relative coordinate
  // space; presentations sit modally on top). Spec §1.26 / §3.4 —
  // `attachmentAnchor:` is required and may be `.scene(...)` or
  // `.parent(...)` (visionOS 26).
  for (const o of ornamentKids) {
    const anchorMode = o.ornamentAnchorMode || 'scene'  // 'scene' | 'parent'
    const anchor = anchorMode === 'parent'
      ? `.parent(.${o.ornament})`
      : `.scene(.${o.ornament})`
    const visibility = o.ornamentVisibility && o.ornamentVisibility !== 'automatic'
      ? `, visibility: .${o.ornamentVisibility}` : ''
    const alignment = o.ornamentContentAlignment && o.ornamentContentAlignment !== 'center'
      ? `, contentAlignment: .${o.ornamentContentAlignment}` : ''
    out.push(`${ind}    .ornament(attachmentAnchor: ${anchor}${visibility}${alignment}) {`)
    renderStack(o, items, pad + 2, out, stateBag)
    out.push(`${indent(pad + 2)}    .glassBackgroundEffect()`)
    out.push(`${ind}    }`)
  }

  // Presentation modifiers: emitted after ornaments. Each presentation
  // appends a state-var name to `stateBag` so wrapTabView can emit matching
  // `@State` declarations on the View struct.
  for (const p of presentationKids) {
    emitPresentationModifier(p, pad, out, stateBag)
  }
}

// ---------- top-level file wrappers ----------

function wrapTabView(viewName, windows, items) {
  // Reset the per-file behaviour collector before anything renders into it.
  pendingBehaviorPlans = []
  const body = []
  // `stateBag` entries are either a string (legacy: Bool=false, used for
  // `showing_*` and `isExpanded_*` flags) or an object
  // `{ name, type, default }` for typed declarations. wrapTabView
  // partitions them at emit time so existing callers keep working.
  const stateBag = []
  if (windows.length === 0) {
    body.push(`${indent(2)}Text("Empty Tab")`)
  } else if (windows.length === 1) {
    renderWindow(windows[0], items, 2, body, stateBag)
  } else {
    body.push(`${indent(2)}ZStack {`)
    for (const w of windows) renderWindow(w, items, 3, body, stateBag)
    body.push(`${indent(2)}}`)
  }

  // `selectedTab` — referenced by Button.tapAction.navigateTab emit
  // (`selectedTab = N`) and by any in-window TabView. Declare it once
  // at the top of the view so the generated code compiles. We don't
  // bind it to TabView's `selection:` yet — that would require
  // emitting `Tab(value:)` for every child and is a follow-up.
  const tabWindows = windows.filter((w) => w.id != null)
  const isDescendantOfTabbedWindow = (it) => {
    let cursor = it
    while (cursor && cursor.parentId) {
      const parent = items.find((x) => x.id === cursor.parentId)
      if (!parent) break
      if (tabWindows.some((w) => w.id === parent.id)) return true
      cursor = parent
    }
    return false
  }
  const needsSelectedTab = items.some((it) => {
    if (!isDescendantOfTabbedWindow(it)) return false
    if (it.type === 'stack' && it.stackType === 'tabView') return true
    if (it.type === 'panel' && it.panelType === 'button' && it.tapAction?.type === 'navigateTab') return true
    return false
  })
  if (needsSelectedTab) {
    stateBag.push({ name: 'selectedTab', type: 'Int', default: '0' })
  }

  // De-dup. Strings (Bool=false legacy) and typed objects use separate
  // keys so they can't collide.
  const seenStrings = new Set()
  const seenObjects = new Set()
  const stateDecls = []
  for (const entry of stateBag) {
    if (typeof entry === 'string') {
      if (seenStrings.has(entry)) continue
      seenStrings.add(entry)
      stateDecls.push(`    @State private var ${entry} = false`)
    } else if (entry && typeof entry === 'object' && entry.name) {
      if (seenObjects.has(entry.name)) continue
      seenObjects.add(entry.name)
      const typeAnno = entry.type ? `: ${entry.type}` : ''
      stateDecls.push(`    @State private var ${entry.name}${typeAnno} = ${entry.default}`)
    }
  }

  // RealityKit is only imported when the view actually builds entities, so
  // a plain 2D layout does not carry an unused import.
  const usesRealityKit = body.some((l) => typeof l === 'string' && l.includes('RealityView'))

  // Behaviour scope: `@State` above the body, generated methods below it.
  const behaviorDecls = []
  const behaviorMethods = []
  for (const plan of pendingBehaviorPlans) {
    for (const l of behaviorStateDecls(plan)) behaviorDecls.push(l)
    emitBehaviorMethods(plan, 1, behaviorMethods)
  }

  return [
    `//`,
    `//  ${viewName}.swift`,
    `//  Generated by AR/VR UI Designer`,
    `//`,
    ``,
    `import SwiftUI`,
    usesRealityKit ? `import RealityKit` : null,
    ``,
    `struct ${viewName}: View {`,
    ...behaviorDecls,
    ...stateDecls,
    (stateDecls.length || behaviorDecls.length) ? `` : null,
    `    var body: some View {`,
    ...body,
    `    }`,
    ...behaviorMethods,
    `}`,
    ``,
    `#Preview(windowStyle: ${windows.some((w) => w.windowStyle === 'volumetric') ? '.volumetric' : '.automatic'}) {`,
    `    ${viewName}()`,
    `}`,
    ``
  ].filter((l) => l !== null).join('\n')
}

function renderAppFile(tabs, appName, scene = {}, items = []) {
  const imports = [
    `//`,
    `//  ${appName}.swift`,
    `//  Generated by AR/VR UI Designer`,
    `//`,
    ``,
    `import SwiftUI`,
    ``
  ]
  // Build the top-level Scene per the user's chosen scene mode (spec §3.1).
  // - 'window'    → WindowGroup (default 1280x720 unless overridden)
  // - 'volume'    → WindowGroup with .windowStyle(.volumetric) + volume metadata
  // - 'immersive' → ImmersiveSpace with .immersionStyle(...) and friends
  const mode = scene.sceneMode || 'window'
  const allWindows = items.filter((i) => i.type === 'window')
  const firstWindow = allWindows[0] || {}

  const sceneLines = []
  if (mode === 'immersive') {
    sceneLines.push(`        ImmersiveSpace(id: "Immersive") {`)
    sceneLines.push(`            RootView()`)
    sceneLines.push(`        }`)
    // Immersion modifiers (spec §3.1)
    const style = scene.immersionStyle || 'mixed'
    if (style === 'progressive') {
      const lo = scene.progressiveRange?.[0] ?? 0.5
      const hi = scene.progressiveRange?.[1] ?? 1.0
      const init = scene.progressiveInitial ?? 0.5
      // visionOS 2+ form: range with explicit initial amount
      sceneLines.push(`        .immersionStyle(selection: .constant(.progressive(${lo}...${hi}, initialAmount: ${init})), in: .progressive)`)
    } else if (style !== 'automatic') {
      sceneLines.push(`        .immersionStyle(selection: .constant(.${style}), in: .${style})`)
    }
    if (scene.upperLimbVisibility && scene.upperLimbVisibility !== 'automatic') {
      sceneLines.push(`        .upperLimbVisibility(.${scene.upperLimbVisibility})`)
    }
    if (scene.preferredSurroundingsEffect === 'systemDark') {
      sceneLines.push(`        .preferredSurroundingsEffect(.systemDark)`)
    } else if (scene.preferredSurroundingsEffect === 'colorMultiply' && scene.surroundingsColorMultiply) {
      const c = scene.surroundingsColorMultiply
      // Reuse swiftColor via a tiny shim — we don't have ctx here, so spell it out.
      sceneLines.push(`        .preferredSurroundingsEffect(.colorMultiply(Color(red: ${parseInt(c.slice(1, 3), 16) / 255}, green: ${parseInt(c.slice(3, 5), 16) / 255}, blue: ${parseInt(c.slice(5, 7), 16) / 255})))`)
    }
    if (scene.immersiveEnvironmentBehavior && scene.immersiveEnvironmentBehavior !== 'automatic') {
      sceneLines.push(`        .immersiveEnvironmentBehavior(.${scene.immersiveEnvironmentBehavior})`)
    }
  } else {
    sceneLines.push(`        WindowGroup {`)
    sceneLines.push(`            RootView()`)
    sceneLines.push(`        }`)
    if (mode === 'volume' || firstWindow.windowStyle === 'volumetric') {
      // Volumetric WindowGroup (spec §3.2). Emit `.defaultSize(in: .meters)`
      // when the user provided a depth, plus the world-scaling/baseplate
      // /alignment/viewpoints modifiers.
      sceneLines.push(`        .windowStyle(.volumetric)`)
      const depth = firstWindow.volumeDepthMeters ?? 1.0
      sceneLines.push(`        .defaultSize(width: ${depth}, height: ${depth}, depth: ${depth}, in: .meters)`)
      if (firstWindow.worldScalingBehavior && firstWindow.worldScalingBehavior !== 'automatic') {
        sceneLines.push(`        .defaultWorldScalingBehavior(.${firstWindow.worldScalingBehavior})`)
      }
      if (firstWindow.volumeBaseplateVisibility && firstWindow.volumeBaseplateVisibility !== 'automatic') {
        sceneLines.push(`        .volumeBaseplateVisibility(.${firstWindow.volumeBaseplateVisibility})`)
      }
      if (firstWindow.volumeWorldAlignment && firstWindow.volumeWorldAlignment !== 'adaptive') {
        sceneLines.push(`        .volumeWorldAlignment(.${firstWindow.volumeWorldAlignment})`)
      }
      if (firstWindow.supportedVolumeViewpoints && firstWindow.supportedVolumeViewpoints !== 'all') {
        const v = firstWindow.supportedVolumeViewpoints === 'front'
          ? '.front' : '[.front, .back]'
        sceneLines.push(`        .supportedVolumeViewpoints(${v})`)
      }
    } else if (firstWindow.windowStyle === 'plain') {
      sceneLines.push(`        .windowStyle(.plain)`)
    }
    // Emit .defaultSize so visionOS honours the designed canvas size.
    // Without this the runtime defaults to 1280×720 for regular windows.
    const winW = unitsToPt(firstWindow.size?.[0] || 0)
    const winH = unitsToPt(firstWindow.size?.[1] || 0)
    if (winW > 0 && winH > 0 && (firstWindow.windowStyle !== 'volumetric' && mode !== 'volume')) {
      sceneLines.push(`        .defaultSize(width: ${winW}, height: ${winH})`)
    }
  }

  const appStruct = [
    `@main`,
    `struct ${appName}: App {`,
    `    var body: some Scene {`,
    ...sceneLines,
    `    }`,
    `}`,
    ``
  ]
  const root = [
    `struct RootView: View {`,
    `    var body: some View {`
  ]
  if (tabs.length <= 1) {
    const view = tabs.length === 1 ? sanitize(tabs[0].name) + 'View' : 'Text("No tabs")'
    root.push(`        ${view}${tabs.length === 1 ? '()' : ''}`)
  } else {
    root.push(`        TabView {`)
    for (const t of tabs) {
      const view = sanitize(t.name) + 'View'
      const icon = t.icon || 'folder'
      root.push(`            ${view}()`)
      root.push(`                .tabItem {`)
      root.push(`                    Label("${escapeString(t.name)}", systemImage: "${icon}")`)
      root.push(`                }`)
    }
    root.push(`        }`)
  }
  // visionOS forces `colorScheme` to `.dark` system-wide (spec §0.4). Apply
  // it on RootView so previews honour the visionOS palette even if the
  // generated code is reused on iPad.
  root.push(`        .preferredColorScheme(.dark)`)
  root.push(`    }`, `}`, ``)
  return [...imports, ...appStruct, ...root].join('\n')
}

// ---------- public entry point ----------

export function exportSwiftUI(items, appName = 'MyApp', scene = {}) {
  const tabs = items.filter((i) => i.type === 'tab')
  const files = []
  for (const tab of tabs) {
    const viewName = sanitize(tab.name) + 'View'
    const windows = items.filter((i) => i.type === 'window' && i.parentId === tab.id)
    files.push({
      filename: `${viewName}.swift`,
      content: wrapTabView(viewName, windows, items)
    })
  }
  files.push({
    filename: `${appName}.swift`,
    content: renderAppFile(tabs, appName, scene, items)
  })
  return files
}
