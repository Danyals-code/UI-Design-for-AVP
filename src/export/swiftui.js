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

import { unitsToPt } from '../appleSystem'
import { emitPanel, isInteractivePanel } from '../panels/registry'

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
    ultraThickMaterial:'.ultraThickMaterial'
  }
  return map[token] || null
}

function stackOpener(stackType, alignment, spacing) {
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
    case 'section':         return `Section {`
    case 'disclosure':      return `DisclosureGroup {`
    case 'navigationStack': return `NavigationStack {`
    case 'tabView':         return `TabView {`
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
  // Layered modifiers — each one becomes a `.modifier(…)` chain on the
  // preceding view. Kept additive so callers can pick up partial chains.
  const m = panel.modifiers || {}
  const ind = `${indent(pad)}    `
  if (m.opacity != null && m.opacity !== 1.0) lines.push(`${ind}.opacity(${m.opacity})`)
  if (m.offsetX || m.offsetY)   lines.push(`${ind}.offset(x: ${m.offsetX || 0}, y: ${m.offsetY || 0})`)
  if (m.rotation)               lines.push(`${ind}.rotationEffect(.degrees(${m.rotation}))`)
  if (m.scaleX !== 1 || m.scaleY !== 1) lines.push(`${ind}.scaleEffect(x: ${m.scaleX ?? 1}, y: ${m.scaleY ?? 1})`)
  if (m.disabled)               lines.push(`${ind}.disabled(true)`)
  if (m.shadowRadius && m.shadowColor) {
    const x = m.shadowX || 0, y = m.shadowY || 0
    lines.push(`${ind}.shadow(color: ${swiftColor(null, m.shadowColor)}, radius: ${m.shadowRadius}, x: ${x}, y: ${y})`)
  }
  if (m.borderWidth && m.borderColor) {
    lines.push(`${ind}.overlay(RoundedRectangle(cornerRadius: ${unitsToPt(panel.cornerRadius || 0)}).stroke(${swiftColor(null, m.borderColor)}, lineWidth: ${m.borderWidth}))`)
  }
  // 3D-primitive transforms — Z offset (`.offset(z:)`) plus per-axis
  // rotation (`.rotation3DEffect(...)`). Only emitted when non-zero so
  // boilerplate stays out of the common case. Applied here so the modifier
  // chain order matches the inspector layout.
  const threeD = ['sphere', 'box', 'plane', 'cone', 'cylinder', 'text3d', 'mesh']
  if (threeD.includes(panel.panelType)) {
    if (panel.zOffset)        lines.push(`${ind}.offset(z: ${panel.zOffset})`)
    if (panel.rotX)           lines.push(`${ind}.rotation3DEffect(.degrees(${panel.rotX}), axis: (x: 1, y: 0, z: 0))`)
    if (panel.rotY)           lines.push(`${ind}.rotation3DEffect(.degrees(${panel.rotY}), axis: (x: 0, y: 1, z: 0))`)
    if (panel.rotZ)           lines.push(`${ind}.rotation3DEffect(.degrees(${panel.rotZ}), axis: (x: 0, y: 0, z: 1))`)
  }

  // visionOS `.hoverEffect()` — only emitted on interactive controls
  // (Button, Toggle, Picker, Slider, etc.) and only when the panel opts out
  // of inheritance. SwiftUI ignores the modifier on decorative views, so
  // emitting it on a Text or Rectangle would be misleading noise.
  if (
    isInteractivePanel(panel.panelType) &&
    panel.hoverEffect && panel.hoverEffect !== 'inherit' && panel.hoverEffect !== 'none'
  ) {
    lines.push(`${ind}.hoverEffect(.${panel.hoverEffect})`)
  }

  if (m.clipShape && m.clipShape !== 'none') {
    const shape = m.clipShape === 'capsule'  ? 'Capsule()'
              : m.clipShape === 'circle'   ? 'Circle()'
              : `RoundedRectangle(cornerRadius: ${unitsToPt(panel.cornerRadius || 0) || 12})`
    lines.push(`${ind}.clipShape(${shape})`)
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

  // Animation + transition. `.animation(_:value:)` requires a binding to
  // re-evaluate against; we don't have one at design time, so we emit a
  // self-binding `value: panel.id` placeholder + a TODO comment. This makes
  // the intent explicit without hiding the requirement.
  const an = panel.animation
  if (an) {
    const curve = animationCurveExpr(an)
    if (curve) {
      lines.push(`${ind}.animation(${curve}, value: false)  // TODO: bind value: to your driving state`)
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
  const sym = panel.symbolName
  const textColor = swiftColor(panel.textColorToken, panel.textColor)
  const fill = swiftColor(panel.colorToken, panel.color)
  const style = panel.textStyle || 'body'
  const fontW = panel.fontWeight
  const weight = fontW && fontW !== 'regular' ? `.weight(.${fontW})` : ''

  const applyTextModifiers = (l) => {
    const mods = []
    if (panel.italic) mods.push('.italic()')
    if (panel.underline) mods.push('.underline()')
    if (panel.strikethrough) mods.push('.strikethrough()')
    if (panel.lineLimit) mods.push(`.lineLimit(${panel.lineLimit})`)
    if (panel.tracking) mods.push(`.tracking(${panel.tracking})`)
    if (panel.textAlign && panel.textAlign !== 'center') mods.push(`.multilineTextAlignment(.${panel.textAlign === 'left' ? 'leading' : 'trailing'})`)
    return l + (mods.length ? mods.map((m) => `\n${ind}    ${m}`).join('') : '')
  }

  emitPanel(panel, {
    push, ind, out,
    escapeString, swiftColor, unitsToPt, applyTextModifiers,
    sym, fill, textColor, style, weight
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
    const detent = p.sheetDetent === 'medium' ? '.medium' : '.large'
    out.push(`${ind}.sheet(isPresented: $${stateName}) {`)
    out.push(`${ind}    Text("${escapeString(p.text || 'Sheet')}")`)
    out.push(`${ind}        .presentationDetents([${detent}])`)
    out.push(`${ind}}`)
  } else if (p.panelType === 'popover') {
    out.push(`${ind}.popover(isPresented: $${stateName}) {`)
    out.push(`${ind}    Text("${escapeString(p.text || 'Popover')}")`)
    out.push(`${ind}        .padding()`)
    out.push(`${ind}}`)
  } else if (p.panelType === 'alert') {
    const buttons = p.alertButtons && p.alertButtons.length ? p.alertButtons : ['OK']
    out.push(`${ind}.alert("${escapeString(p.text || 'Alert')}", isPresented: $${stateName}) {`)
    for (const btn of buttons) {
      const role = /cancel/i.test(btn) ? ', role: .cancel' : ''
      out.push(`${ind}    Button("${escapeString(btn)}"${role}) { }`)
    }
    if (p.alertMessage) {
      out.push(`${ind}} message: {`)
      out.push(`${ind}    Text("${escapeString(p.alertMessage)}")`)
    }
    out.push(`${ind}}`)
  }
}

// ---------- stack rendering ----------

function renderStack(stack, items, pad, out, stateBag) {
  const ind = indent(pad)

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
      out.push(`${ind}    VStack(alignment: .${stack.alignment || 'center'}, spacing: ${stack.spacing ?? 0}) {`)
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

  // Grid — adaptive vs fixed.
  if (stack.stackType === 'grid') {
    if ((stack.gridMode || 'fixed') === 'adaptive') {
      out.push(`${ind}LazyVGrid(columns: [GridItem(.adaptive(minimum: ${stack.minColumnWidth ?? 140}), spacing: ${stack.spacing ?? 0})], spacing: ${stack.spacing ?? 0}) {`)
    } else {
      out.push(`${ind}LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: ${stack.spacing ?? 0}), count: ${stack.columns || 2}), spacing: ${stack.spacing ?? 0}) {`)
    }
  } else {
    out.push(`${ind}${stackOpener(stack.stackType, stack.alignment, stack.spacing)}`)
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
  if (stack.cornerRadius) out.push(`${ind}    .cornerRadius(${unitsToPt(stack.cornerRadius)})`)
  if (stack.scrollable) out.push(`${ind}    // wrap in ScrollView { … } for scrollable content`)
  if (stack.navTitle) out.push(`${ind}    .navigationTitle("${escapeString(stack.navTitle)}")`)
  if (stack.ornament) {
    out.push(`${ind}    .ornament(attachmentAnchor: .scene(.${stack.ornament})) {`)
    out.push(`${ind}        // ornament content — render the stack's children here`)
    out.push(`${ind}    }`)
  }
}

function renderWindow(win, items, pad, out, stateBag) {
  const ind = indent(pad)
  // A Window's direct content children — separate ornaments and presentation
  // overlays so each can attach as a modifier rather than an inline child.
  const presentationTypes = new Set(['sheet', 'popover', 'alert'])
  const ownChildren = items.filter((c) => c.parentId === win.id)
  const presentationKids = ownChildren.filter((c) => c.type === 'panel' && presentationTypes.has(c.panelType))
  const ornamentKids = ownChildren.filter((c) => c.type === 'stack' && c.ornament)
  const inlineKids = ownChildren.filter((c) =>
    !presentationKids.includes(c) && !ornamentKids.includes(c)
  )

  out.push(`${ind}ZStack {`)
  for (const c of inlineKids) {
    if (c.type === 'stack') renderStack(c, items, pad + 1, out, stateBag)
    else if (c.type === 'panel') renderPanel(c, items, pad + 1, out)
  }
  out.push(`${ind}}`)
  out.push(`${ind}    .frame(width: ${unitsToPt(win.size?.[0] || 0)}, height: ${unitsToPt(win.size?.[1] || 0)})`)
  if (win.padding) out.push(`${ind}    .padding(${win.padding})`)

  // Ornaments first (visionOS draws them in the scene-relative coordinate
  // space; presentations sit modally on top).
  for (const o of ornamentKids) {
    out.push(`${ind}    .ornament(attachmentAnchor: .scene(.${o.ornament})) {`)
    renderStack(o, items, pad + 2, out, stateBag)
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
  const body = []
  const stateBag = []     // populated by renderWindow as presentations appear
  if (windows.length === 0) {
    body.push(`${indent(2)}Text("Empty Tab")`)
  } else if (windows.length === 1) {
    renderWindow(windows[0], items, 2, body, stateBag)
  } else {
    body.push(`${indent(2)}ZStack {`)
    for (const w of windows) renderWindow(w, items, 3, body, stateBag)
    body.push(`${indent(2)}}`)
  }

  // De-dup state names (stable per-id, but Swift won't accept duplicate decls).
  const uniqueStates = Array.from(new Set(stateBag))
  const stateDecls = uniqueStates.map((n) => `    @State private var ${n} = false`)

  return [
    `//`,
    `//  ${viewName}.swift`,
    `//  Generated by AR/VR UI Designer`,
    `//`,
    ``,
    `import SwiftUI`,
    ``,
    `struct ${viewName}: View {`,
    ...stateDecls,
    stateDecls.length ? `` : null,
    `    var body: some View {`,
    ...body,
    `    }`,
    `}`,
    ``,
    `#Preview(windowStyle: .automatic) {`,
    `    ${viewName}()`,
    `}`,
    ``
  ].filter((l) => l !== null).join('\n')
}

function renderAppFile(tabs, appName) {
  const imports = [
    `//`,
    `//  ${appName}.swift`,
    `//  Generated by AR/VR UI Designer`,
    `//`,
    ``,
    `import SwiftUI`,
    ``
  ]
  const appStruct = [
    `@main`,
    `struct ${appName}: App {`,
    `    var body: some Scene {`,
    `        WindowGroup {`,
    `            RootView()`,
    `        }`,
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
  root.push(`    }`, `}`, ``)
  return [...imports, ...appStruct, ...root].join('\n')
}

// ---------- public entry point ----------

export function exportSwiftUI(items, appName = 'MyApp') {
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
    content: renderAppFile(tabs, appName)
  })
  return files
}
