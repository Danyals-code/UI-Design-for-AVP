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

import { unitsToPt, textStyleDefaultWeight, NAVBAR_STYLE_SPECS } from '../appleSystem'
import { emitPanel, isInteractivePanel, compileTapAction } from '../panels/registry'
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
    case 'scrollView': {
      const axis = stack?.scrollAxis === 'horizontal' ? '.horizontal'
                 : stack?.scrollAxis === 'both' ? '[.horizontal, .vertical]'
                 : null
      const showsArg = stack?.scrollShowsIndicators === false ? `, showsIndicators: false` : ''
      const axisArg = axis ? axis : ''
      const argsCombined = axis ? `(${axisArg}${showsArg})`
                                : (showsArg ? `(${showsArg.replace(/^,\s*/, '')})` : '')
      return `ScrollView${argsCombined} {`
    }
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

  renderModifiers(panel, out, pad)
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
    out.push(`${ind}.popover(isPresented: $${stateName}${arrow}) {`)
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
  if (stack.splitStyle) {
    const children = items.filter((c) => c.parentId === stack.id)
    const sidebar = children.find((c) => c.type === 'stack' && c.name === 'Sidebar')
    const detail = children.find((c) => c.type === 'stack' && c.name === 'Detail')
    out.push(`${ind}NavigationSplitView {`)
    if (sidebar) renderStack(sidebar, items, pad + 1, out, stateBag)
    out.push(`${ind}} detail: {`)
    if (detail) renderStack(detail, items, pad + 1, out, stateBag)
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
      if (stack.padding) out.push(`${ind}        .padding(${stack.padding})`)
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
    if (stack.padding) out.push(`${ind}    .padding(${stack.padding})`)
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
    if (stack.padding) out.push(`${ind}    .padding(${stack.padding})`)
    return
  }

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
      out.push(`${ind}${ctor}(${tracksKey}: [GridItem(.adaptive(minimum: ${stack.minColumnWidth ?? 140})${itemSp})]${gridSp}) {`)
    } else {
      out.push(`${ind}${ctor}(${tracksKey}: Array(repeating: GridItem(.flexible()${itemSp}), count: ${stack.columns || 2})${gridSp}) {`)
    }
  } else {
    out.push(`${ind}${stackOpener(stack.stackType, stack.alignment, stack.spacing, stack)}`)
  }

  const kids = items.filter((c) => c.parentId === stack.id)
  for (const c of kids) {
    if (c.type === 'stack') renderStack(c, items, pad + 1, out, stateBag)
    else if (c.type === 'panel') renderPanel(c, items, pad + 1, out)
  }
  out.push(`${ind}}`)

  // Closing modifiers on the stack container.
  if (stack.padding) out.push(`${ind}    .padding(${stack.padding})`)
  if (stack.background) {
    const mat = swiftMaterial(stack.background)
    if (mat) {
      out.push(`${ind}    .background(${mat})`)
    } else {
      const bg = stack.background.startsWith('#')
        ? swiftColor(null, stack.background)
        : swiftColor(stack.background, null)
      out.push(`${ind}    .background(${bg})`)
    }
  }
  if (stack.cornerRadius) {
    const cr = unitsToPt(stack.cornerRadius)
    out.push(`${ind}    .clipShape(RoundedRectangle(cornerRadius: ${cr}, style: .continuous))`)
  }
  if (stack.scrollable) out.push(`${ind}    // wrap in ScrollView { … } for scrollable content`)
  if (stack.navTitle) out.push(`${ind}    .navigationTitle("${escapeString(stack.navTitle)}")`)
  if (stack.ornament) {
    out.push(`${ind}    .ornament(attachmentAnchor: .scene(.${stack.ornament})) {`)
    out.push(`${ind}        // ornament content — render the stack's children here`)
    out.push(`${ind}    }`)
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
  const presentationTypes = new Set(['sheet', 'popover', 'alert', 'confirmationdialog', 'inspector'])
  const ownChildren = items.filter((c) => c.parentId === win.id)
  const presentationKids = ownChildren.filter((c) => c.type === 'panel' && presentationTypes.has(c.panelType))
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
    out.push(`${ind}    .frame(width: ${unitsToPt(win.size?.[0] || 0)}, height: ${unitsToPt(win.size?.[1] || 0)})`)
    if (win.padding) out.push(`${ind}    .padding(${win.padding})`)
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
