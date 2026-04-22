// SwiftUI code exporter.
//
// Walks the scene graph and emits SwiftUI source files:
//   - One `<TabName>View.swift` per Tab
//   - One `<AppName>App.swift` containing `@main` + the WindowGroup / TabView
//     that routes between tabs.
//
// Coverage is pragmatic — the common stack types, panels and NavigationSplitView
// round-trip faithfully. Unknown elements render as a placeholder comment so
// the exported file still compiles and obviously calls out the gap.
//
// The strict convention is: every public name in here must match the exact
// SwiftUI API string, so the output is mechanical to review against Apple's
// docs.

import { unitsToPt } from '../appleSystem'

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

function swiftColor(token, hex) {
  // Map our semantic tokens to SwiftUI's `Color` convenience values.
  if (token) {
    const map = {
      primary: '.primary', secondary: '.secondary',
      systemBlue: '.blue', systemRed: '.red', systemGreen: '.green',
      systemOrange: '.orange', systemYellow: '.yellow', systemPurple: '.purple',
      systemPink: '.pink', systemTeal: '.teal', systemIndigo: '.indigo',
      systemGray: '.gray', systemBrown: '.brown', systemMint: '.mint',
      systemCyan: '.cyan',
      systemBackground: 'Color(.systemBackground)',
      secondarySystemBackground: 'Color(.secondarySystemBackground)',
      tertiarySystemBackground: 'Color(.tertiarySystemBackground)',
      systemFill: 'Color(.systemFill)',
      secondarySystemFill: 'Color(.secondarySystemFill)'
    }
    if (map[token]) return map[token]
  }
  if (hex) {
    // Basic hex → Color(red:, green:, blue:) conversion; keeps the exact
    // value from the designer. visionOS supports the literal Color(...)
    // initialiser so this round-trips faithfully.
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

function stackOpener(stackType, alignment, spacing) {
  // Map our stackType to the exact SwiftUI view name + alignment enum.
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
    case 'tab':             return `Group {`   // single Tab content
    default:                return `VStack${argStr} {`
  }
}

// ---------- text / panel rendering ----------

function renderModifiers(panel, lines, pad) {
  // Layered modifiers — emit each one as a `.modifier(…)` chain on the
  // preceding view. Kept additive so callers can pick up partial chains.
  const m = panel.modifiers || {}
  if (m.opacity != null && m.opacity !== 1.0) lines.push(`${indent(pad)}    .opacity(${m.opacity})`)
  if (m.offsetX || m.offsetY)   lines.push(`${indent(pad)}    .offset(x: ${m.offsetX || 0}, y: ${m.offsetY || 0})`)
  if (m.rotation)               lines.push(`${indent(pad)}    .rotationEffect(.degrees(${m.rotation}))`)
  if (m.scaleX !== 1 || m.scaleY !== 1) lines.push(`${indent(pad)}    .scaleEffect(x: ${m.scaleX ?? 1}, y: ${m.scaleY ?? 1})`)
  if (m.disabled)               lines.push(`${indent(pad)}    .disabled(true)`)
  if (m.borderWidth && m.borderColor) {
    lines.push(`${indent(pad)}    .overlay(RoundedRectangle(cornerRadius: ${unitsToPt(panel.cornerRadius || 0)}).stroke(${swiftColor(null, m.borderColor)}, lineWidth: ${m.borderWidth}))`)
  }
}

function renderPanel(panel, items, pad, out) {
  const t = panel.panelType
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

  switch (t) {
    case 'text': {
      const line = `Text("${escapeString(panel.text || '')}").font(.${style}${weight}).foregroundStyle(${textColor})`
      push(applyTextModifiers(line))
      break
    }
    case 'link': {
      // We don't persist a URL — use the displayed text as the destination label.
      push(`Link("${escapeString(panel.text || 'Open')}", destination: URL(string: "https://example.com")!).font(.${style}${weight})`)
      break
    }
    case 'label': {
      const icon = sym || panel.iconName || 'circle.fill'
      push(`Label("${escapeString(panel.text || 'Label')}", systemImage: "${icon}").font(.${style}${weight})`)
      break
    }
    case 'button': {
      const label = sym
        ? `Label("${escapeString(panel.text || 'Button')}", systemImage: "${sym}")`
        : `Text("${escapeString(panel.text || 'Button')}")`
      const bs = panel.buttonStyle && panel.buttonStyle !== 'plain' ? `.buttonStyle(.${panel.buttonStyle})` : ''
      push(`Button { /* action */ } label: { ${label} }${bs}`)
      break
    }
    case 'image': {
      if (sym) push(`Image(systemName: "${sym}")`)
      else push(`Image(systemName: "photo")   // placeholder asset`)
      break
    }
    case 'asyncimage': {
      push(`AsyncImage(url: URL(string: "https://example.com/image.jpg"))`)
      break
    }
    case 'toggle': {
      push(`Toggle("${escapeString(panel.text || 'Toggle')}", isOn: .constant(${panel.toggleOn ? 'true' : 'false'}))`)
      break
    }
    case 'slider': {
      push(`Slider(value: .constant(${panel.sliderValue ?? 0.5}))`)
      break
    }
    case 'stepper': {
      push(`Stepper("${escapeString(panel.text || 'Stepper')}", value: .constant(${panel.stepperValue ?? 0}), in: ${panel.stepperMin ?? 0}...${panel.stepperMax ?? 10})`)
      break
    }
    case 'progress': {
      push(`ProgressView(value: ${panel.value ?? 0.5})`)
      break
    }
    case 'gauge': {
      push(`Gauge(value: ${panel.value ?? 0.5}) { Text("${escapeString(panel.text || '')}") }`)
      break
    }
    case 'textfield': {
      push(`TextField("${escapeString(panel.text || '')}", text: .constant("${escapeString(panel.textfieldValue || '')}"))`)
      break
    }
    case 'securefield': {
      push(`SecureField("${escapeString(panel.text || '')}", text: .constant(""))`)
      break
    }
    case 'texteditor': {
      push(`TextEditor(text: .constant("${escapeString(panel.text || '')}"))`)
      break
    }
    case 'picker': {
      const opts = panel.pickerOptions || []
      push(`Picker("${escapeString(panel.text || '')}", selection: .constant("${escapeString(panel.pickerValue || opts[0] || '')}")) {`)
      opts.forEach((o) => out.push(`${ind}    Text("${escapeString(o)}").tag("${escapeString(o)}")`))
      push(`}${panel.pickerStyle ? `.pickerStyle(.${panel.pickerStyle})` : ''}`)
      break
    }
    case 'datepicker': {
      push(`DatePicker("${escapeString(panel.text || 'Date')}", selection: .constant(Date()))`)
      break
    }
    case 'colorpicker': {
      push(`ColorPicker("${escapeString(panel.text || 'Color')}", selection: .constant(${swiftColor(null, panel.pickedColor || '#ff3b30')}))`)
      break
    }
    case 'search': {
      push(`// .searchable(text: $searchText, prompt: "${escapeString(panel.text || 'Search')}")   // attach on parent view`)
      break
    }
    case 'list': {
      push(`List {`)
      ;(panel.rows || []).forEach((r) => {
        const rowLabel = r.systemImage
          ? `Label("${escapeString(r.title || '')}", systemImage: "${r.systemImage}")`
          : `Text("${escapeString(r.title || '')}")`
        out.push(`${ind}    ${rowLabel}`)
      })
      push(`}${panel.listStyle ? `.listStyle(.${panel.listStyle})` : ''}`)
      break
    }
    case 'table': {
      push(`Table(/* rows */[]) {`)
      ;(panel.columns || []).forEach((c) => out.push(`${ind}    TableColumn("${escapeString(c)}") { _ in Text("") }`))
      push(`}`)
      break
    }
    case 'menu': {
      push(`Menu("${escapeString(panel.text || 'Menu')}") {`)
      ;(panel.menuItems || []).forEach((m) => out.push(`${ind}    Button("${escapeString(m)}") { }`))
      push(`}`)
      break
    }
    case 'form': {
      push(`Form {`)
      ;(panel.rows || []).forEach((r) => out.push(`${ind}    Text("${escapeString(r.title || '')}")`))
      push(`}`)
      break
    }
    case 'groupbox': {
      push(`GroupBox("${escapeString(panel.text || '')}") { }`)
      break
    }
    case 'contentUnavailable': {
      push(`ContentUnavailableView("${escapeString(panel.text || 'No Content')}", systemImage: "${sym || 'questionmark'}", description: Text("${escapeString(panel.alertMessage || '')}"))`)
      break
    }
    case 'sheet': {
      push(`// .sheet(isPresented: $showing) { Text("${escapeString(panel.text || 'Sheet')}") }`)
      break
    }
    case 'popover': {
      push(`// .popover(isPresented: $showing) { Text("${escapeString(panel.text || 'Popover')}") }`)
      break
    }
    case 'alert': {
      push(`// .alert("${escapeString(panel.text || 'Alert')}", isPresented: $showing) { Button("OK") { } }`)
      break
    }
    case 'divider':   push(`Divider()`); break
    case 'spacer':    push(`Spacer()`); break
    case 'rectangle': push(`Rectangle().fill(${fill}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)}).cornerRadius(${unitsToPt(panel.cornerRadius || 0)})`); break
    case 'circle':    push(`Circle().fill(${fill}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)})`); break
    case 'capsule':   push(`Capsule().fill(${fill}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)})`); break
    case 'ellipse':   push(`Ellipse().fill(${fill}).frame(width: ${unitsToPt(panel.size?.[0] || 0)}, height: ${unitsToPt(panel.size?.[1] || 0)})`); break
    default: {
      push(`// TODO: ${t} — panel type not yet covered by the exporter`)
    }
  }

  renderModifiers(panel, out, pad)
}

// ---------- stack rendering ----------

function renderStack(stack, items, pad, out) {
  const ind = indent(pad)

  // NavigationSplitView — styled root HStack with splitStyle.
  if (stack.splitStyle) {
    const children = items.filter((c) => c.parentId === stack.id)
    const sidebar = children.find((c) => c.type === 'stack' && c.name === 'Sidebar')
    const detail = children.find((c) => c.type === 'stack' && c.name === 'Detail')
    out.push(`${ind}NavigationSplitView {`)
    if (sidebar) renderStack(sidebar, items, pad + 1, out)
    out.push(`${ind}} detail: {`)
    if (detail) renderStack(detail, items, pad + 1, out)
    out.push(`${ind}}`)
    if (stack.searchable && stack.searchable !== 'none') {
      out.push(`${ind}    .searchable(text: .constant(""), placement: .${stack.searchable === 'sidebar' ? 'sidebar' : 'toolbar'}, prompt: "${escapeString(stack.searchPrompt || 'Search')}")`)
    }
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
    if (c.type === 'stack') renderStack(c, items, pad + 1, out)
    else if (c.type === 'panel') renderPanel(c, items, pad + 1, out)
  }
  out.push(`${ind}}`)

  // Closing modifiers on the stack container.
  if (stack.padding) out.push(`${ind}    .padding(${stack.padding})`)
  if (stack.background) {
    const bg = stack.background.startsWith('#')
      ? swiftColor(null, stack.background)
      : swiftColor(stack.background, null)
    out.push(`${ind}    .background(${bg})`)
  }
  if (stack.cornerRadius) out.push(`${ind}    .cornerRadius(${unitsToPt(stack.cornerRadius)})`)
  if (stack.navTitle) out.push(`${ind}    .navigationTitle("${escapeString(stack.navTitle)}")`)
  if (stack.ornament) {
    out.push(`${ind}    .ornament(attachmentAnchor: .scene(.${stack.ornament})) {`)
    out.push(`${ind}        // ornament content — render the stack's children here`)
    out.push(`${ind}    }`)
  }
}

function renderWindow(win, items, pad, out) {
  const ind = indent(pad)
  // A Window's direct content children (skip presentation overlays since
  // those are modifiers on the parent view, not embedded views).
  const presentationTypes = new Set(['sheet', 'popover', 'alert'])
  const contentKids = items.filter((c) =>
    c.parentId === win.id &&
    !(c.type === 'panel' && presentationTypes.has(c.panelType))
  )
  const ornamentKids = contentKids.filter((c) => c.type === 'stack' && c.ornament)
  const inlineKids = contentKids.filter((c) => !ornamentKids.includes(c))

  out.push(`${ind}ZStack {`)
  for (const c of inlineKids) {
    if (c.type === 'stack') renderStack(c, items, pad + 1, out)
    else if (c.type === 'panel') renderPanel(c, items, pad + 1, out)
  }
  out.push(`${ind}}`)
  // Window-level material + frame.
  out.push(`${ind}    .frame(width: ${unitsToPt(win.size?.[0] || 0)}, height: ${unitsToPt(win.size?.[1] || 0)})`)
  if (win.padding) out.push(`${ind}    .padding(${win.padding})`)
  // Ornaments attach to the window view, not to the inner stack.
  for (const o of ornamentKids) {
    out.push(`${ind}    .ornament(attachmentAnchor: .scene(.${o.ornament})) {`)
    renderStack(o, items, pad + 2, out)
    out.push(`${ind}    }`)
  }
}

// ---------- top-level file wrappers ----------

function wrapTabView(viewName, windows, items) {
  const body = []
  if (windows.length === 0) {
    body.push(`${indent(2)}Text("Empty Tab")`)
  } else if (windows.length === 1) {
    renderWindow(windows[0], items, 2, body)
  } else {
    body.push(`${indent(2)}ZStack {`)
    for (const w of windows) renderWindow(w, items, 3, body)
    body.push(`${indent(2)}}`)
  }
  return [
    `//`,
    `//  ${viewName}.swift`,
    `//  Generated by AR/VR UI Designer`,
    `//`,
    ``,
    `import SwiftUI`,
    ``,
    `struct ${viewName}: View {`,
    `    var body: some View {`,
    ...body,
    `    }`,
    `}`,
    ``,
    `#Preview(windowStyle: .automatic) {`,
    `    ${viewName}()`,
    `}`,
    ``
  ].join('\n')
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
