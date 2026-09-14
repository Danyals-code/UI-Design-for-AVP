// Exported-Swift validity, checked against every template in the app.
//
// The exporter is the product's output path, so these tests care about one
// thing: does the generated source still look like Swift that a compiler
// would accept? We can't run swiftc here, so we check the two structural
// properties that a generator can plausibly break:
//
//   1. braces balance (with string literals stripped, so a `{` inside a
//      user's text never counts as code)
//   2. no line of code hands the rest of itself to a `//` comment
//
// (2) exists because of a real bug: the button emitter used to return the
// string `// no action` for un-wired buttons, and that value is
// interpolated MID-LINE into `Button{ <body> } label: { <label> }`. The
// line comment swallowed the closing brace, the `label:` argument and the
// entire trailing modifier chain, so 11 of the 14 window templates
// exported Swift that could not compile. See the comment above
// `compileAction` in src/panels/registry.js.

import { describe, it, expect } from 'vitest'
import { TEMPLATES } from '../templates'
import { panelTypes } from '../panels/registry'
import { exportSwiftUI } from './swiftui'
import { DEFAULT_SCENE, makeStack, makePanel } from '../store/factories'
import { NAVBAR_STYLE_SPECS, ptToUnits, unitsToPt, BUTTON_STYLES, controlFraction,
  isPresentationPanel, inspectorColumnWidth, outlineVisibleRows,
  dateComponentsParts } from '../appleSystem'
import { computeSize } from '../layout'
import { makeTab, makeWindow, makeModelEntity } from '../store/factories'
import { TRIGGERS, ACTIONS, getTriggerSchema, getActionSchema, defaultParamsFor } from '../behaviors/registry'
import { triggerGeneratesSwift, actionGeneratesSwift } from './behaviors'

const QUOTE = String.fromCharCode(34)
const BACKSLASH = String.fromCharCode(92)

// Walk a line character by character, tracking Swift string literals, and
// report where an unquoted `//` starts (or -1). Escapes inside strings are
// honoured so a literal containing a quote doesn't end the string early.
function findLineComment(line) {
  let inString = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inString) {
      if (c === BACKSLASH) i++
      else if (c === QUOTE) inString = false
      continue
    }
    if (c === QUOTE) { inString = true; continue }
    if (c === '/' && line[i + 1] === '/') return i
  }
  return -1
}

// Strip string literals AND any trailing line comment, leaving only the
// characters a Swift parser would read as code.
function codeOnly(line) {
  const cut = findLineComment(line)
  const head = cut >= 0 ? line.slice(0, cut) : line
  let out = ''
  let inString = false
  for (let i = 0; i < head.length; i++) {
    const c = head[i]
    if (inString) {
      if (c === BACKSLASH) i++
      else if (c === QUOTE) inString = false
      continue
    }
    if (c === QUOTE) { inString = true; continue }
    out += c
  }
  return out
}

function braceBalance(text) {
  let depth = 0
  let wentNegative = false
  for (const line of text.split('\n')) {
    for (const c of codeOnly(line)) {
      if (c === '{') depth++
      else if (c === '}') {
        depth--
        if (depth < 0) wentNegative = true
      }
    }
  }
  return { depth, wentNegative }
}

// Swift has no multi-line plain string literal, so an unescaped newline
// inside one splits it across two lines and stops compiling. Braces stay
// balanced when that happens, so the checks above cannot see it. Counting
// unescaped quotes per line can: a line that opens a literal must close it.
//
// This caught a real bug. Attachment copy is often multi-line ("Mercury\n
// 4,879 km"), and the entity emitter escaped quotes and backslashes but not
// newlines, so every multi-line attachment emitted a broken literal.
function unterminatedStrings(text) {
  const hits = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const cut = findLineComment(line)
    const code = cut >= 0 ? line.slice(0, cut) : line
    let quotes = 0
    for (let j = 0; j < code.length; j++) {
      if (code[j] === BACKSLASH) { j++; continue }
      if (code[j] === QUOTE) quotes++
    }
    if (quotes % 2 !== 0) hits.push({ line: i + 1, text: line.trim() })
  }
  return hits
}

// A line comment is fine on its own line, even when the prose inside it
// mentions braces (the exporter emits several such notes deliberately).
// It is NOT fine when real code precedes it on the same line and the
// commented-out remainder carries braces, because then the comment has
// eaten structural syntax.
function swallowedCode(text) {
  const hits = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const cut = findLineComment(line)
    if (cut < 0) continue
    const before = line.slice(0, cut).trim()
    if (before === '') continue
    const commented = line.slice(cut)
    if (commented.includes('{') || commented.includes('}')) {
      hits.push({ line: i + 1, text: line.trim() })
    }
  }
  return hits
}

const templateKeys = Object.keys(TEMPLATES)

function exportTemplate(key) {
  const { items } = TEMPLATES[key].build()
  const scene = { ...DEFAULT_SCENE, sceneMode: TEMPLATES[key].mode }
  return exportSwiftUI(items, 'Demo', scene)
}

describe('exportSwiftUI', () => {
  it('covers every registered template', () => {
    // Guards against a template being added without export coverage, and
    // documents the count these tests actually walk.
    expect(templateKeys.length).toBeGreaterThanOrEqual(20)
  })

  describe.each(templateKeys)('template: %s', (key) => {
    it('exports at least a view file and an app file', () => {
      const files = exportTemplate(key)
      expect(files.length).toBeGreaterThanOrEqual(2)
      for (const f of files) {
        expect(f.filename).toMatch(/\.swift$/)
        expect(typeof f.content).toBe('string')
        expect(f.content.trim().length).toBeGreaterThan(0)
      }
    })

    it('emits balanced braces in every file', () => {
      for (const f of exportTemplate(key)) {
        const { depth, wentNegative } = braceBalance(f.content)
        expect(
          wentNegative,
          `${f.filename} closes a brace that was never opened`
        ).toBe(false)
        expect(depth, `${f.filename} leaves ${depth} brace(s) unclosed`).toBe(0)
      }
    })

    it('never lets a line comment swallow code', () => {
      for (const f of exportTemplate(key)) {
        const hits = swallowedCode(f.content)
        expect(
          hits,
          `${f.filename}: ${hits.length} line(s) hand structural syntax to a ` +
          `// comment, e.g. line ${hits[0]?.line}: ${hits[0]?.text}`
        ).toEqual([])
      }
    })

    it('closes every string literal on the line it opens', () => {
      for (const f of exportTemplate(key)) {
        const hits = unterminatedStrings(f.content)
        expect(
          hits,
          `${f.filename}: ${hits.length} unterminated string literal(s), ` +
          `e.g. line ${hits[0]?.line}: ${hits[0]?.text}`
        ).toEqual([])
      }
    })
  })
})

// F2 / F3: what the two renderers that used to emit nothing now produce.
describe('RealityKit export', () => {
  const volumeKeys = Object.keys(TEMPLATES).filter((k) => TEMPLATES[k].mode === 'volume')

  it('covers the volume templates', () => {
    expect(volumeKeys.length).toBeGreaterThanOrEqual(6)
  })

  describe.each(volumeKeys.filter((k) => k !== 'emptyVolume'))('volume: %s', (key) => {
    const viewOf = () => {
      const files = exportTemplate(key)
      return files.find((f) => f.filename.endsWith('View.swift')).content
    }

    it('emits a RealityView instead of an empty body', () => {
      const view = viewOf()
      expect(view).toContain('RealityView {')
      // The regression this replaced: `var body: some View { ZStack { } }`.
      expect(view.replace(/\s+/g, ' ')).not.toContain('var body: some View { ZStack { } }')
    })

    it('imports RealityKit', () => {
      expect(viewOf()).toContain('import RealityKit')
    })

    it('adds every root entity to the content and parents the rest', () => {
      const view = viewOf()
      expect(view).toMatch(/content\.add\(/)
      expect(view).toMatch(/\.addChild\(/)
    })

    it('builds real meshes and materials, not placeholders', () => {
      const view = viewOf()
      expect(view).toMatch(/ModelEntity\(mesh: \./)
      expect(view).toMatch(/Material|SimpleMaterial/)
    })

    it('leaves no TODO placeholder behind', () => {
      // navbar and realityview were the two emitters that printed a TODO.
      expect(viewOf()).not.toContain('TODO')
    })

    it('resolves attachments through the attachments closure when present', () => {
      const view = viewOf()
      if (!view.includes('attachments.entity(for:')) return
      // Both halves must exist: the two-parameter closure form, and a
      // matching Attachment declaration for every id resolved.
      expect(view).toContain('RealityView { content, attachments in')
      expect(view).toContain('} attachments: {')
      const resolved = [...view.matchAll(/attachments\.entity\(for: "([^"]+)"\)/g)].map((m) => m[1])
      const declared = [...view.matchAll(/Attachment\(id: "([^"]+)"\)/g)].map((m) => m[1])
      for (const id of resolved) {
        expect(declared, `attachment "${id}" is resolved but never declared`).toContain(id)
      }
      expect(new Set(declared).size, 'duplicate Attachment ids').toBe(declared.length)
    })

    it('previews as a volumetric window', () => {
      expect(viewOf()).toContain('#Preview(windowStyle: .volumetric)')
    })

    it('gives every entity a unique Swift local', () => {
      const view = viewOf()
      const names = [...view.matchAll(/^\s*(?:let|var) ([A-Za-z_][A-Za-z0-9_]*) = /gm)].map((m) => m[1])
      expect(new Set(names).size, 'a local name is declared twice').toBe(names.length)
    })
  })
})

// F14: behaviour codegen.
describe('behavior export', () => {
  const volumeKeys = Object.keys(TEMPLATES)
    .filter((k) => TEMPLATES[k].mode === 'volume' && k !== 'emptyVolume')

  const viewOf = (key) => {
    const files = exportTemplate(key)
    return files.find((f) => f.filename.endsWith('View.swift')).content
  }

  describe.each(volumeKeys)('volume: %s', (key) => {
    it('declares a scene root so methods can resolve entities by name', () => {
      const view = viewOf(key)
      if (!view.includes('MARK: - Behaviors')) return
      expect(view).toContain('@State private var sceneRoot = Entity()')
      expect(view).toContain('content.add(sceneRoot)')
    })

    it('never emits a duplicate switch case', () => {
      // Two behaviours on one entity must both fire. One case per behaviour
      // would leave the second unreachable, so they are grouped per entity.
      const view = viewOf(key)
      const blocks = view.split('switch entity.name {').slice(1)
      for (const block of blocks) {
        const body = block.split('default: break')[0]
        const cases = [...body.matchAll(/case "([^"]+)":/g)].map((m) => m[1])
        expect(new Set(cases).size, `duplicate case labels: ${cases.join(', ')}`)
          .toBe(cases.length)
      }
    })

    it('gives every gesture target the components it needs to be hit', () => {
      // A gesture against an entity with no InputTargetComponent and no
      // collision shape silently never fires.
      const view = viewOf(key)
      if (!view.includes('.targetedToAnyEntity()')) return
      expect(view).toContain('InputTargetComponent()')
      expect(view).toContain('generateCollisionShapes(recursive: true)')
    })

    it('calls only methods it also defines', () => {
      const view = viewOf(key)
      const called = new Set([...view.matchAll(/await (behavior\d+)\(/g)].map((m) => m[1]))
      const defined = new Set([...view.matchAll(/private func (behavior\d+)\(/g)].map((m) => m[1]))
      for (const name of called) {
        expect(defined, `${name} is called but never defined`).toContain(name)
      }
    })

    it('resolves entity names that exist in the scene', () => {
      const { items } = TEMPLATES[key].build()
      const names = new Set(items.filter((i) => i.type === 'entity').map((i) => i.name))
      const view = viewOf(key)
      const looked = [...view.matchAll(/findEntity\(named: "([^"]+)"\)/g)].map((m) => m[1])
      for (const n of looked) {
        expect(names, `findEntity("${n}") names no entity in the scene`).toContain(n)
      }
    })

    it('leaves no empty branch behind', () => {
      // An `else { }` with only a comment in it is a silently-inert feature,
      // which is worse than not generating the feature at all.
      const view = viewOf(key)
      expect(view.replace(/\s+/g, ' ')).not.toMatch(/else \{ \}/)
    })

    it('declares toggle state only when an action auto-reverses', () => {
      const view = viewOf(key)
      if (view.includes('toggleState[')) {
        expect(view).toContain('@State private var toggleState: [String: Bool] = [:]')
      } else {
        expect(view).not.toContain('toggleState')
      }
    })
  })

  it('generates the trigger kinds it claims to, across all volume templates', () => {
    const all = volumeKeys.map(viewOf).join('\n')
    // Each of these is a trigger the exporter says it generates.
    expect(all).toContain('SpatialTapGesture()')
    expect(all).toContain('Notification.Name(')
    expect(all).toMatch(/\.task \{/)
    expect(all).toMatch(/while !Task\.isCancelled/)
  })

  it('names the real API for every trigger it does not generate', () => {
    const all = volumeKeys.map(viewOf).join('\n')
    if (!all.includes('Behaviors still to wire up')) return
    // The point of the documented path is that it is actionable, not that it
    // merely says "unsupported".
    expect(all).toMatch(/System|SpatialEventGesture|AnimationEvents|ShaderGraphMaterial/)
  })
})

describe('navigation bar export', () => {
  // Built directly rather than via a template, so the test states the
  // navbar contract instead of depending on which template happens to use one.
  const sceneWithNavbar = (navbarStyle) => {
    const { items, activeTabId } = TEMPLATES.blank.build()
    const win = items.find((it) => it.type === 'window')
    return {
      items: [
        ...items,
        {
          id: 'panel-nav', type: 'panel', panelType: 'navbar', parentId: win.id,
          visible: true, name: 'Nav', navbarStyle, title: 'Library',
          leadingButtons: [{ id: 'l1', symbolName: 'list.bullet', label: '', tapAction: null }],
          trailingButtons: [
            { id: 't1', symbolName: 'magnifyingglass', label: '', tapAction: null },
            { id: 't2', symbolName: '', label: 'Done', tapAction: { type: 'navigateTab', tab: 2 } }
          ],
          modifiers: []
        }
      ],
      activeTabId
    }
  }

  const exportNav = (style) => {
    const { items } = sceneWithNavbar(style)
    const files = exportSwiftUI(items, 'Demo', { ...DEFAULT_SCENE })
    return files.find((f) => f.filename.endsWith('View.swift')).content
  }

  it('emits a .toolbar instead of a TODO comment', () => {
    const view = exportNav('leadingTrailingButtons')
    expect(view).toContain('.toolbar {')
    expect(view).not.toContain('TODO')
  })

  it('places leading and trailing groups', () => {
    const view = exportNav('leadingTrailingButtons')
    expect(view).toContain('ToolbarItemGroup(placement: .topBarLeading)')
    expect(view).toContain('ToolbarItemGroup(placement: .topBarTrailing)')
  })

  it('centres the title in .principal when the style centres it', () => {
    expect(exportNav('leadingTrailingButtons')).toContain('ToolbarItem(placement: .principal)')
  })

  it('uses .navigationTitle for a leading-aligned title', () => {
    const view = exportNav('trailingButtons')
    expect(view).toContain('.navigationTitle("Library")')
    expect(view).not.toContain('ToolbarItem(placement: .principal)')
  })

  it('honours each button tap action, and marks the un-wired ones', () => {
    const view = exportNav('trailingButtons')
    expect(view).toContain('selectedTab = 2')
    expect(view).toContain('/* no action */')
  })

  it('declares a search binding only for the search style', () => {
    const search = exportNav('trailingSearch')
    expect(search).toContain('.searchable(text: $navbarSearchText')
    expect(search).toContain('@State private var navbarSearchText: String = ""')
    expect(exportNav('trailingButtons')).not.toContain('navbarSearchText')
  })

  it('stays structurally valid for every navbar style', () => {
    for (const style of Object.keys(NAVBAR_STYLE_SPECS)) {
      const view = exportNav(style)
      const { depth, wentNegative } = braceBalance(view)
      expect(wentNegative, `${style} closes an unopened brace`).toBe(false)
      expect(depth, `${style} leaves braces unclosed`).toBe(0)
      expect(swallowedCode(view), `${style} swallows code in a comment`).toEqual([])
      expect(unterminatedStrings(view), `${style} has an unterminated string`).toEqual([])
    }
  })
})

// The helpers above are load-bearing, so prove they can actually see the
// bug they exist to catch. Without these, a helper that silently matched
// nothing would make every test above pass for the wrong reason.
describe('validity helpers', () => {
  it('accepts a well-formed button', () => {
    const good = 'Button{ /* no action */ } label: { Text("Go") }.buttonStyle(.bordered)'
    expect(braceBalance(good).depth).toBe(0)
    expect(swallowedCode(good)).toEqual([])
  })

  it('rejects the regression this suite exists for', () => {
    const bad = 'Button{ // no action } label: { Text("Go") }.buttonStyle(.bordered)'
    expect(braceBalance(bad).depth).toBe(1)
    expect(swallowedCode(bad)).toHaveLength(1)
  })

  it('allows a standalone comment that merely mentions braces', () => {
    const note = '        // wrap in ScrollView { ... } for scrollable content'
    expect(braceBalance(note).depth).toBe(0)
    expect(swallowedCode(note)).toEqual([])
  })

  it('ignores braces inside user-authored strings', () => {
    const str = 'Text("a { brace } in copy")'
    expect(braceBalance(str).depth).toBe(0)
  })

  it('ignores an escaped quote inside a string', () => {
    const esc = 'Text("she said ' + BACKSLASH + '"hi' + BACKSLASH + '" { }")'
    expect(braceBalance(esc).depth).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Frame emission
//
// The canvas sizes a view from `widthMode` / `heightMode` plus an explicit
// value; until this landed none of it reached the export, so a stack pinned
// to a 640 pt column came out hugging its content and a `fill` child came out
// intrinsic. `swiftui.js` resolves those modes in `frameSpec`, deliberately
// duplicating the resolution in `layout.js` -> `computeSize`. These tests are
// what keeps the duplicate honest.
//
// Modifier ORDER carries as much meaning as the frame itself: in SwiftUI
// `.padding(24).frame(width: 640)` is a 640 pt box with its content inset,
// while `.frame(width: 640).padding(24)` is a 688 pt box. Only the first
// matches what the canvas draws, so the order is asserted, not just the
// presence.
// ---------------------------------------------------------------------------

// Build one view file around a caller-supplied set of children. The blank
// template seeds a fill/fill stack, dropped here so each case states its own
// sizing rather than inheriting that one.
const swiftFor = (extra) => {
  const { items } = TEMPLATES.blank.build()
  const win = items.find((it) => it.type === 'window')
  const kept = items.filter((it) => it.type !== 'stack')
  return exportSwiftUI([...kept, ...extra(win)], 'App', {})[0].content
}

const stackWith = (props) => (win) => [
  { ...makeStack({ parentId: win.id, name: 'Box', stackType: 'vstack' }), ...props }
]

// The window body always emits its own `.frame(width:height:)`, so "this view
// got no frame" is a count of one, not an absence.
const frameCount = (src) => src.split('.frame(').length - 1
const WINDOW_FRAME_ONLY = 1

const panelWith = (panelType, props) => (win) => [
  { ...makePanel(panelType, { parentId: win.id }), ...props }
]

describe('frame emission - stacks', () => {
  it('emits a fixed width from fixedWidth', () => {
    expect(swiftFor(stackWith({ widthMode: 'fixed', fixedWidth: 640 })))
      .toContain('.frame(width: 640)')
  })

  it('emits maxWidth: .infinity for a fill axis', () => {
    expect(swiftFor(stackWith({ widthMode: 'fill' })))
      .toContain('.frame(maxWidth: .infinity)')
  })

  it('combines both axes into one .frame call', () => {
    expect(swiftFor(stackWith({ widthMode: 'fixed', fixedWidth: 320, heightMode: 'fill' })))
      .toContain('.frame(width: 320, maxHeight: .infinity)')
  })

  it('emits nothing for a stack that hugs on both axes', () => {
    expect(frameCount(swiftFor(stackWith({ widthMode: 'fit', heightMode: 'fit' }))))
      .toBe(WINDOW_FRAME_ONLY)
  })

  it('hugs when the mode is fixed but no value was ever set', () => {
    // Several templates are in exactly this state. computeSize falls back to
    // hugging, so inventing a number here would make the export disagree
    // with the canvas rather than agree with the template's intent.
    expect(frameCount(swiftFor(stackWith({ widthMode: 'fixed', fixedWidth: null }))))
      .toBe(WINDOW_FRAME_ONLY)
  })

  it('treats a bare fixedWidth with no mode as fixed, like computeSize does', () => {
    expect(swiftFor(stackWith({ widthMode: undefined, fixedWidth: 200 })))
      .toContain('.frame(width: 200)')
  })

  it('insets content before sizing the box, never after', () => {
    const src = swiftFor(stackWith({ padding: 24, widthMode: 'fixed', fixedWidth: 640 }))
    const padAt = src.indexOf('.padding(24)')
    const frameAt = src.indexOf('.frame(width: 640)')
    expect(padAt).toBeGreaterThan(-1)
    expect(frameAt).toBeGreaterThan(padAt)
  })

  it('paints the background around the frame, not around the content', () => {
    const src = swiftFor(stackWith({
      widthMode: 'fixed', fixedWidth: 640, background: 'glassThin'
    }))
    expect(src.indexOf('.background(')).toBeGreaterThan(src.indexOf('.frame(width: 640)'))
  })
})

describe('frame emission - per-edge padding', () => {
  it('emits one call per edge when the edges differ', () => {
    const src = swiftFor(stackWith({
      paddingEdges: { top: 8, bottom: 16, leading: 24, trailing: 4 }
    }))
    expect(src).toContain('.padding(.top, 8)')
    expect(src).toContain('.padding(.bottom, 16)')
    expect(src).toContain('.padding(.leading, 24)')
    expect(src).toContain('.padding(.trailing, 4)')
  })

  it('collapses symmetric edges to the axis form', () => {
    const src = swiftFor(stackWith({
      paddingEdges: { top: 12, bottom: 12, leading: 30, trailing: 30 }
    }))
    expect(src).toContain('.padding(.horizontal, 30)')
    expect(src).toContain('.padding(.vertical, 12)')
    expect(src).not.toContain('.padding(.top,')
  })

  it('collapses fully uniform edges to the short form', () => {
    expect(swiftFor(stackWith({
      paddingEdges: { top: 16, bottom: 16, leading: 16, trailing: 16 }
    }))).toContain('.padding(16)')
  })

  it('overrides the uniform padding field when both are present', () => {
    const src = swiftFor(stackWith({
      padding: 24, paddingEdges: { top: 4, bottom: 4, leading: 4, trailing: 4 }
    }))
    expect(src).toContain('.padding(4)')
    expect(src).not.toContain('.padding(24)')
  })
})

describe('frame emission - panels', () => {
  it('emits a fixed width from the panel size', () => {
    expect(swiftFor(panelWith('text', {
      text: 'Hi', widthMode: 'fixed', size: [ptToUnits(240), ptToUnits(40)]
    }))).toContain('.frame(width: 240)')
  })

  it('emits maxWidth: .infinity for a fill panel', () => {
    expect(swiftFor(panelWith('text', { text: 'Hi', widthMode: 'fill' })))
      .toContain('.frame(maxWidth: .infinity)')
  })

  it('leaves shapes to size themselves - no second frame', () => {
    // Rectangle / Circle / gradients / 3D primitives already emit their own
    // frame; a second one would fight the first.
    const src = swiftFor(panelWith('rectangle', {
      widthMode: 'fixed', size: [ptToUnits(100), ptToUnits(50)]
    }))
    // The window's frame, plus the Rectangle's own — and no third.
    expect(frameCount(src)).toBe(WINDOW_FRAME_ONLY + 1)
    expect(src).toContain('.frame(width: 100, height: 50)')
  })

  it('defers to a .frame entry in the modifier stack', () => {
    // That entry is the frame the user can see and edit, and layout.js
    // already treats it as the source of truth over the panel-root fields.
    const src = swiftFor(panelWith('text', {
      text: 'Hi',
      widthMode: 'fixed',
      size: [ptToUnits(240), ptToUnits(40)],
      modifiers: [{
        id: 'm1', type: 'frame', width: 500, height: null,
        minWidth: null, minHeight: null, maxWidth: false, maxHeight: false,
        alignment: 'center'
      }]
    }))
    expect(src).toContain('.frame(width: 500)')
    expect(src).not.toContain('.frame(width: 240)')
  })
})

describe('frame emission - window body', () => {
  it('insets the content inside the plate rather than growing past it', () => {
    // The canvas treats win.padding as an inner inset: a 1200x800 plate with
    // a 1172x772 content area. `.frame(...).padding(14)` is the opposite - it
    // grows the view to 1228x828.
    const { items } = TEMPLATES.blank.build()
    const src = exportSwiftUI(items, 'App', {})[0].content
    const padAt = src.indexOf('.padding(14)')
    const frameAt = src.indexOf('.frame(width: 1200')
    expect(padAt).toBeGreaterThan(-1)
    expect(frameAt).toBeGreaterThan(padAt)
  })
})

describe('frame emission agrees with the canvas', () => {
  // The load-bearing property: for every item across every template that
  // declares a fixed axis with a real value, the width the exporter writes
  // must be the width computeSize reserves. If the two resolutions drift, a
  // designer's column comes out a different size in Xcode than on the canvas.
  it('every fixed-width item exports the width computeSize reserves', () => {
    const mismatches = []
    for (const key of templateKeys) {
      const { items } = TEMPLATES[key].build()
      const src = exportSwiftUI(items, 'App', {}).map((f) => f.content).join('\n')
      for (const it of items) {
        if (it.type !== 'stack' && it.type !== 'panel') continue
        if ((it.widthMode || 'fit') !== 'fixed') continue
        const declared = it.type === 'stack'
          ? (it.fixedWidth != null ? it.fixedWidth : null)
          : (Array.isArray(it.size) && it.size[0] ? Math.round(unitsToPt(it.size[0])) : null)
        if (declared == null) continue
        const canvas = Math.round(unitsToPt(computeSize(it, items)[0]))
        if (declared !== canvas) {
          mismatches.push(`${key}/${it.name}: declared ${declared}pt but canvas reserves ${canvas}pt`)
        } else if (!src.includes(`.frame(width: ${declared}`)) {
          mismatches.push(`${key}/${it.name}: canvas reserves ${canvas}pt, no matching .frame emitted`)
        }
      }
    }
    expect(mismatches).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// ScrollView emission
//
// `stack.scrollable` used to emit a `// wrap in ScrollView { ... }` comment,
// so the two templates that rely on it exported a view that simply clipped
// its overflow. It now emits a real ScrollView, and WHERE each modifier lands
// is the whole point: the frame sizes the viewport, the padding rides with
// the scrolling content. Putting the frame inside would pin the content to
// the viewport height and nothing would ever scroll; putting the background
// inside would scroll the fill away with the content.
// ---------------------------------------------------------------------------

describe('scrollable stacks', () => {
  const scrollingStack = (props) => stackWith({
    scrollable: true, padding: 24, widthMode: 'fill', heightMode: 'fill', ...props
  })

  it('emits a real ScrollView, not a comment', () => {
    const src = swiftFor(scrollingStack({}))
    expect(src).toContain('ScrollView {')
    expect(src).not.toContain('wrap in ScrollView')
  })

  // The ScrollView's OWN closing brace, matched by indentation — the first
  // `}` after the opener belongs to the stack nested inside it.
  const scrollViewSpan = (src) => {
    const lines = src.split('\n')
    const indentOf = (l) => l.length - l.trimStart().length
    const open = lines.findIndex((l) => l.includes('ScrollView'))
    const close = lines.findIndex(
      (l, i) => i > open && l.trim() === '}' && indentOf(l) === indentOf(lines[open])
    )
    return { open, close, at: (needle) => lines.findIndex((l) => l.includes(needle)) }
  }

  it('puts the frame on the viewport and the padding on the content', () => {
    const { open, close, at } = scrollViewSpan(swiftFor(scrollingStack({})))
    expect(open).toBeGreaterThan(-1)
    expect(close).toBeGreaterThan(open)
    // Padding scrolls with the content; the frame sizes the viewport.
    expect(at('.padding(24)')).toBeGreaterThan(open)
    expect(at('.padding(24)')).toBeLessThan(close)
    expect(at('.frame(maxWidth: .infinity, maxHeight: .infinity)')).toBeGreaterThan(close)
  })

  it('keeps the background outside, so the fill does not scroll away', () => {
    const { close, at } = scrollViewSpan(swiftFor(scrollingStack({ background: 'glassThin' })))
    expect(at('.background(')).toBeGreaterThan(close)
  })

  it('omits both arguments at the defaults', () => {
    // Spec 1.24: vertical axis, indicators shown.
    expect(swiftFor(scrollingStack({}))).toContain('ScrollView {')
  })

  it('emits the axis when the designer overrode it', () => {
    expect(swiftFor(scrollingStack({ scrollAxis: 'horizontal' })))
      .toContain('ScrollView(.horizontal) {')
    expect(swiftFor(scrollingStack({ scrollAxis: 'both' })))
      .toContain('ScrollView([.horizontal, .vertical]) {')
  })

  it('emits showsIndicators only when turned off', () => {
    expect(swiftFor(scrollingStack({ scrollShowsIndicators: false })))
      .toContain('ScrollView(showsIndicators: false) {')
    expect(swiftFor(scrollingStack({ scrollAxis: 'horizontal', scrollShowsIndicators: false })))
      .toContain('ScrollView(.horizontal, showsIndicators: false) {')
  })

  it('leaves a non-scrollable stack alone', () => {
    expect(swiftFor(stackWith({ padding: 24 }))).not.toContain('ScrollView')
  })

  it('gives the two templates that rely on it a real ScrollView', () => {
    for (const key of ['settings', 'article']) {
      const src = exportSwiftUI(TEMPLATES[key].build().items, 'App', {})
        .map((f) => f.content).join('\n')
      expect(src, `${key} lost its ScrollView`).toContain('ScrollView {')
      expect(src, `${key} still emits the placeholder comment`)
        .not.toContain('wrap in ScrollView')
    }
  })
})

// ---------------------------------------------------------------------------
// Button role vs button style
//
// `destructive` is a ButtonRole, not a ButtonStyle. It sat in BUTTON_STYLES
// as "a convenience" and emitted `.buttonStyle(.destructive)`, which does not
// compile — and the settings template shipped it. The value now routes to the
// `buttonRole` field it always belonged in, both on load and at emit time.
// ---------------------------------------------------------------------------

describe('button role', () => {
  it('no longer offers destructive as a style', () => {
    expect(Object.keys(BUTTON_STYLES)).not.toContain('destructive')
  })

  it('emits a role initializer, never a destructive style', () => {
    const src = swiftFor(panelWith('button', { text: 'Delete', buttonRole: 'destructive' }))
    expect(src).toContain('Button(role: .destructive)')
    expect(src).not.toContain('.buttonStyle(.destructive)')
  })

  it('rescues a scene that still carries the old style value', () => {
    // Not every scene arrives through the loader — an in-memory scene, or a
    // template that had not been re-seeded, would otherwise emit the line
    // that does not compile.
    const src = swiftFor(panelWith('button', { text: 'Delete', buttonStyle: 'destructive' }))
    expect(src).toContain('Button(role: .destructive)')
    expect(src).not.toContain('.buttonStyle(.destructive)')
  })

  it('does not clobber a role the designer already set', () => {
    const src = swiftFor(panelWith('button', {
      text: 'Cancel', buttonStyle: 'destructive', buttonRole: 'cancel'
    }))
    expect(src).toContain('Button(role: .cancel)')
  })

  it('leaves every real style alone', () => {
    const src = swiftFor(panelWith('button', { text: 'Go', buttonStyle: 'borderedProminent' }))
    expect(src).toContain('.buttonStyle(.borderedProminent)')
  })
})

// ---------------------------------------------------------------------------
// List style
//
// LIST_STYLES doubles as the canvas's preset table, so it carries a 'default'
// preset SwiftUI has no `.default` case for. The same shape of bug as
// `.buttonStyle(.destructive)`, found by the vocabulary sweep in
// parity.test.js rather than by anyone hitting it.
// ---------------------------------------------------------------------------

describe('list style', () => {
  it('maps the default preset to automatic, and elides it', () => {
    const src = swiftFor(panelWith('list', { listStyle: 'default' }))
    expect(src).not.toContain('.listStyle(.default)')
    expect(src).not.toContain('.listStyle(.automatic)')
  })

  it('emits every other preset verbatim', () => {
    expect(swiftFor(panelWith('list', { listStyle: 'insetGrouped' })))
      .toContain('.listStyle(.insetGrouped)')
    expect(swiftFor(panelWith('list', { listStyle: 'sidebar' })))
      .toContain('.listStyle(.sidebar)')
  })
})

// ---------------------------------------------------------------------------
// Free placement
//
// A panel dropped straight onto a window plate can be dragged anywhere, and
// the canvas draws it at `panel.position`. Nothing carried that into the
// export, so every freely-placed control landed centred in the ZStack.
//
// The sign flip is the subtle half: `position` is scene-space with +y UP,
// while SwiftUI's `.offset` has +y DOWN. Getting it wrong mirrors the layout
// vertically, which is exactly the bug the canvas had with the `.offset`
// modifier — ArrowUp moved a panel down.
// ---------------------------------------------------------------------------

describe('free placement', () => {
  const onWindowAt = (position) => (win) => [
    { ...makePanel('text', { parentId: win.id }), text: 'Free', position }
  ]

  it('emits an offset for a panel placed on the plate', () => {
    expect(swiftFor(onWindowAt([ptToUnits(40), 0, 0])))
      .toContain('.offset(x: 40, y: 0)')
  })

  it('flips y, because scene space points up and SwiftUI points down', () => {
    // Dragged UP on the canvas (+y) must move up on device too (-y).
    expect(swiftFor(onWindowAt([0, ptToUnits(30), 0])))
      .toContain('.offset(x: 0, y: -30)')
  })

  it('emits nothing for a panel sitting at the origin', () => {
    expect(swiftFor(onWindowAt([0, 0, 0]))).not.toContain('.offset(')
  })

  it('ignores position inside a stack, where the layout engine owns it', () => {
    const { items } = TEMPLATES.blank.build()
    const win = items.find((it) => it.type === 'window')
    const stack = makeStack({ parentId: win.id, name: 'Row', stackType: 'vstack' })
    const kid = {
      ...makePanel('text', { parentId: stack.id }),
      text: 'In a stack',
      position: [ptToUnits(999), ptToUnits(999), 0]
    }
    const kept = items.filter((it) => it.type !== 'stack')
    const src = exportSwiftUI([...kept, stack, kid], 'App', {})[0].content
    expect(src).not.toContain('.offset(')
  })

  it('composes with an offset modifier the way the canvas does', () => {
    const win = (w) => [{
      ...makePanel('text', { parentId: w.id }),
      text: 'Both',
      position: [ptToUnits(10), 0, 0],
      modifiers: [{ id: 'm1', type: 'offset', x: 5, y: 0 }]
    }]
    const src = swiftFor(win)
    expect(src).toContain('.offset(x: 5, y: 0)')    // the modifier
    expect(src).toContain('.offset(x: 10, y: 0)')   // the placement
  })
})

// ---------------------------------------------------------------------------
// Behaviour codegen coverage
//
// The behaviour vocabulary is deliberately wider than what the generator can
// write: 8 of 12 triggers and 11 of 15 actions become real Swift, and the
// rest are emitted as a documented "still to wire up" block naming the
// RealityKit API to finish them with. That is an honest place to land — but
// the designer only found out after exporting, so the Behaviors inspector now
// warns up front, reading `triggerGeneratesSwift` / `actionGeneratesSwift`.
//
// These tests check the predicates against what the generator ACTUALLY does,
// rather than against the sets they are built from — a tautology would not
// catch the emitter and the warning drifting apart.
// ---------------------------------------------------------------------------

describe('behaviour codegen coverage', () => {
  const NOT_WIRED = 'Behaviors still to wire up'

  // One volumetric window, the entity that carries the behaviour, and a
  // second entity for it to aim at.
  //
  // The target matters: several actions (`lookAt`, `follow`, `moveTo`)
  // resolve a target entity and fall back to the documented form when they
  // cannot — `lookAt` defaults to the wearer, which is not a resolvable
  // entity. Pointing them at a real one exercises the generating path, so
  // what these tests measure is the action type rather than an unresolved
  // default.
  const sceneWith = (trigger, action) => {
    const tab = makeTab({ name: 'Vol' })
    const win = makeWindow({ name: 'Vol', parentId: tab.id, windowStyle: 'volumetric' })
    const target = makeModelEntity('box', { parentId: win.id, name: 'Target' })
    const params = defaultParamsFor(getActionSchema(action))
    if ('target' in params) params.target = target.id
    const entity = makeModelEntity('sphere', {
      parentId: win.id,
      name: 'Subject',
      behaviors: [{
        id: 'beh-1',
        trigger: { type: trigger, params: defaultParamsFor(getTriggerSchema(trigger)) },
        actions: [{ id: 'act-1', type: action, params }]
      }]
    })
    return exportSwiftUI([tab, win, target, entity], 'App', {}).map((f) => f.content).join('\n')
  }

  it('exercises the whole vocabulary', () => {
    expect(TRIGGERS.length).toBeGreaterThanOrEqual(12)
    expect(ACTIONS.length).toBeGreaterThanOrEqual(15)
  })

  it.each(TRIGGERS.map((t) => t.type))('trigger %s: the warning matches the output', (type) => {
    // `scaleTo` generates, so whether the behaviour lands in the
    // "still to wire up" block is decided by the trigger alone.
    const src = sceneWith(type, 'scaleTo')
    const documented = src.includes(NOT_WIRED) && src.includes(`WHEN ${type}`)
    expect(
      triggerGeneratesSwift(type),
      `trigger "${type}": inspector says ${triggerGeneratesSwift(type) ? 'generated' : 'documented'}, ` +
      `export ${documented ? 'documented' : 'generated'} it`
    ).toBe(!documented)
  })

  it.each(ACTIONS.map((a) => a.type))('action %s: the warning matches the output', (type) => {
    // `tap` generates, so the action alone decides whether a real call is
    // written into the generated method. An ungenerated one leaves a
    // `// DO <type>: <what to do instead>` note in the method body rather
    // than vanishing.
    const src = sceneWith('tap', type)
    const documented = new RegExp(`// DO ${type}:`).test(src)
    expect(
      actionGeneratesSwift(type),
      `action "${type}": inspector says ${actionGeneratesSwift(type) ? 'generated' : 'documented'}, ` +
      `export ${documented ? 'documented' : 'generated'} it`
    ).toBe(!documented)
  })

  it('documents the gap rather than silently dropping it', () => {
    // The load-bearing property behind the warning: nothing the designer
    // authored disappears without a trace naming the API to finish it with.
    const triggers = TRIGGERS.map((t) => t.type).filter((t) => !triggerGeneratesSwift(t))
    const actions = ACTIONS.map((a) => a.type).filter((a) => !actionGeneratesSwift(a))
    expect(triggers.length + actions.length).toBeGreaterThan(0)
    for (const type of triggers) {
      const src = sceneWith(type, 'scaleTo')
      expect(src, `trigger "${type}" vanished from the export`).toContain(NOT_WIRED)
      expect(src).toContain(`WHEN ${type}`)
    }
    for (const type of actions) {
      const src = sceneWith('tap', type)
      expect(src, `action "${type}" vanished from the export`).toMatch(new RegExp(`// DO ${type}:`))
    }
  })
})

// ---------------------------------------------------------------------------
// Control ranges reach the device as the canvas draws them (AUDIT #17)
//
// `appleSystem.test.js` pins `controlFraction` itself. What matters here is the
// seam: the fraction the canvas paints has to be derived from the SAME value
// and bounds the generator writes into the Swift file. So these export a real
// panel, read the numbers back out of the emitted source, and feed those to the
// canvas helper — if either side starts reading a different field, or the
// exporter's `?? 0` / `?? 1` fallbacks drift from the canvas's, the fraction
// stops matching and this fails.
// ---------------------------------------------------------------------------
describe('control ranges reach the export as the canvas draws them', () => {
  const emitPanel = (type, props) => {
    const tab = makeTab({ name: 'T' })
    const win = makeWindow({ name: 'W', parentId: tab.id })
    const panel = makePanel(type, { parentId: win.id, name: 'C', ...props })
    return exportSwiftUI([tab, win, panel], 'App', {}).map((f) => f.content).join('\n')
  }
  const num = (s) => Number(s)

  it('Slider: the emitted value and bounds give the fraction the canvas fills', () => {
    const swift = emitPanel('slider', { sliderValue: 50, sliderMin: 0, sliderMax: 100 })
    const m = swift.match(/Slider\(value: \.constant\(([-\d.]+)\), in: ([-\d.]+)\.\.\.([-\d.]+)/)
    expect(m, `no ranged Slider in:\n${swift}`).toBeTruthy()
    expect(controlFraction(num(m[1]), num(m[2]), num(m[3]))).toBeCloseTo(0.5, 9)
  })

  it('Slider: a 0...1 slider still emits the bare initialiser and reads the same', () => {
    const swift = emitPanel('slider', { sliderValue: 0.25 })
    expect(swift).toContain('Slider(value: .constant(0.25))')
    const m = swift.match(/Slider\(value: \.constant\(([-\d.]+)\)\)/)
    // No `in:` means SwiftUI's own 0...1 default, which is what the canvas
    // falls back to when the bounds are absent.
    expect(controlFraction(num(m[1]), undefined, undefined)).toBeCloseTo(0.25, 9)
  })

  it('Gauge: the shipped default is self-consistent', () => {
    // The default seeds `value: 70` in `0...100` with the label "70". It used
    // to seed 0.7, which drew a 70%-full bar here and exported 0.7%.
    const swift = emitPanel('gauge', {})
    const m = swift.match(/Gauge\(value: ([-\d.]+), in: ([-\d.]+)\.\.\.([-\d.]+)/)
    expect(m, `no ranged Gauge in:\n${swift}`).toBeTruthy()
    expect(controlFraction(num(m[1]), num(m[2]), num(m[3]))).toBeCloseTo(0.7, 9)
    // ...and the number the gauge prints agrees with where the needle sits.
    const label = swift.match(/currentValueLabel: \{ Text\("(\d+)"\) \}/)
    expect(Number(label[1]) / 100).toBeCloseTo(0.7, 9)
  })

  it('Gauge: an arbitrary range maps the same on both sides', () => {
    const swift = emitPanel('gauge', { value: 30, gaugeMin: 20, gaugeMax: 40, text: '' })
    const m = swift.match(/Gauge\(value: ([-\d.]+), in: ([-\d.]+)\.\.\.([-\d.]+)/)
    expect(controlFraction(num(m[1]), num(m[2]), num(m[3]))).toBeCloseTo(0.5, 9)
  })

  it('ProgressView: value is measured against total, not against 1', () => {
    const swift = emitPanel('progress', { value: 30, total: 100 })
    const m = swift.match(/ProgressView\(value: ([-\d.]+), total: ([-\d.]+)\)/)
    expect(m, `no ProgressView with a total in:\n${swift}`).toBeTruthy()
    expect(controlFraction(num(m[1]), 0, num(m[2]))).toBeCloseTo(0.3, 9)
  })

  it('Stepper: the emitted bounds are the ones the canvas clamps to', () => {
    const swift = emitPanel('stepper', { stepperValue: 5, stepperMin: 0, stepperMax: 10, stepperStep: 5 })
    const m = swift.match(/Stepper\("[^"]*", value: \.constant\(([-\d.]+)\), in: ([-\d.]+)\.\.\.([-\d.]+), step: ([-\d.]+)\)/)
    expect(m, `no stepped Stepper in:\n${swift}`).toBeTruthy()
    const [, v, lo, hi, step] = m.map(num)
    // Pressing + from here lands on the upper bound and goes no further —
    // the canvas steps by `step` and stops, as SwiftUI does.
    expect(Math.min(hi, v + step)).toBe(10)
    expect(Math.min(hi, 10 + step)).toBe(10)
    expect(Math.max(lo, v - step)).toBe(0)
    expect(Math.max(lo, 0 - step)).toBe(0)
  })

  it('every ranged control emits bounds the canvas can read back', () => {
    // A sweep rather than four spot checks: whatever the range, the value the
    // generator writes must sit inside the bounds it writes beside it.
    const cases = [
      ['slider', { sliderValue: 7, sliderMin: 5, sliderMax: 25 }],
      ['gauge', { value: 7, gaugeMin: 5, gaugeMax: 25 }],
      ['stepper', { stepperValue: 7, stepperMin: 5, stepperMax: 25 }]
    ]
    for (const [type, props] of cases) {
      const swift = emitPanel(type, props)
      const m = swift.match(/in: ([-\d.]+)\.\.\.([-\d.]+)/)
      expect(m, `${type} emitted no range`).toBeTruthy()
      const f = controlFraction(7, num(m[1]), num(m[2]))
      expect(f, `${type} fraction`).toBeCloseTo(0.1, 9)
      expect(f).toBeGreaterThan(0)
      expect(f).toBeLessThan(1)
    }
  })
})

// ---------------------------------------------------------------------------
// Presentations (AUDIT #7)
//
// Five panel types are not laid out as children at all: each attaches to its
// PARENT as a `.sheet(…)` / `.popover(…)` / `.alert(…)` /
// `.confirmationDialog(…)` / `.inspector(…)` modifier. The canvas knew about
// three of them and the exporter about five, so a `confirmationdialog` or an
// `inspector` was laid out as an ordinary child on screen while the generated
// code presented it over the view — the wrong PLACE, not merely the wrong
// pixels.
//
// One set answers for both sides now. What follows checks that set against
// what the generator actually emits, type by type, rather than against the
// list it is built from.
// ---------------------------------------------------------------------------
describe('presentations route the same way on both sides', () => {
  const PRESENTATION_MODIFIERS = [
    '.sheet(', '.popover(', '.alert(', '.confirmationDialog(', '.inspector('
  ]
  const underWindow = (type, props = {}) => {
    const tab = makeTab({ name: 'T' })
    const win = makeWindow({ name: 'W', parentId: tab.id })
    const panel = makePanel(type, { parentId: win.id, name: 'P', ...props })
    return exportSwiftUI([tab, win, panel], 'App', {}).map((f) => f.content).join('\n')
  }

  it('presents exactly the types the exporter attaches as a modifier', () => {
    for (const type of panelTypes()) {
      const swift = underWindow(type)
      const presented = PRESENTATION_MODIFIERS.some((m) => swift.includes(m))
      expect(isPresentationPanel(type),
        `${type}: isPresentationPanel=${isPresentationPanel(type)} but the ` +
        `export ${presented ? 'DOES' : 'does NOT'} attach a presentation modifier`
      ).toBe(presented)
    }
  })

  it('covers all five, so the sweep above is not vacuous', () => {
    const presented = panelTypes().filter(isPresentationPanel).sort()
    expect(presented).toEqual(
      ['alert', 'confirmationdialog', 'inspector', 'popover', 'sheet']
    )
  })

  it('emits the dialog and inspector that used to be laid out inline', () => {
    // The two the canvas did not know about. Both reach the file as modifiers.
    expect(underWindow('confirmationdialog')).toContain('.confirmationDialog(')
    expect(underWindow('inspector')).toContain('.inspector(')
  })

  it('carries the popover anchor that neither side read', () => {
    expect(underWindow('popover', { popoverAnchor: 'point' }))
      .toContain('attachmentAnchor: .point(.center)')
    // The default stays implicit rather than emitting `.rect(.bounds)`.
    expect(underWindow('popover', { popoverAnchor: 'rectBounds' }))
      .not.toContain('attachmentAnchor:')
  })

  it('emits the column width the canvas draws the inspector at', () => {
    // The seam that matters: the width in the generated Swift and the width
    // the canvas column resolves to have to be the same number.
    const swift = underWindow('inspector', { inspectorColumnWidth: 280 })
    expect(swift).toContain('.inspectorColumnWidth(280)')
    const windowW = ptToUnits(1200)
    expect(inspectorColumnWidth({ exact: 280 }, windowW)).toBeCloseTo(ptToUnits(280), 9)
  })

  it('emits the min/ideal/max triple the canvas clamps between', () => {
    const swift = underWindow('inspector', {
      inspectorMinWidth: 200, inspectorIdealWidth: 320, inspectorMaxWidth: 400
    })
    expect(swift).toContain('.inspectorColumnWidth(min: 200, ideal: 320, max: 400)')
    const windowW = ptToUnits(1200)
    const drawn = inspectorColumnWidth(
      { min: 200, ideal: 320, max: 400 }, windowW
    )
    expect(drawn).toBeCloseTo(ptToUnits(320), 9)
  })
})

describe('inspectorColumnWidth precedence', () => {
  const W = ptToUnits(1200)

  it('lets an exact width win outright, as the exporter does', () => {
    // `.inspectorColumnWidth(n)` and `(min:ideal:max:)` are separate calls in
    // SwiftUI and the exporter emits the first when it is set, so the canvas
    // has to ignore the bounds in that case too.
    expect(inspectorColumnWidth({ exact: 280, min: 400, max: 500 }, W))
      .toBeCloseTo(ptToUnits(280), 9)
  })

  it('clamps the ideal between the bounds', () => {
    expect(inspectorColumnWidth({ ideal: 100, min: 200 }, W)).toBeCloseTo(ptToUnits(200), 9)
    expect(inspectorColumnWidth({ ideal: 900, max: 400 }, W)).toBeCloseTo(ptToUnits(400), 9)
    expect(inspectorColumnWidth({ ideal: 300, min: 200, max: 400 }, W)).toBeCloseTo(ptToUnits(300), 9)
  })

  it('falls back to the stored frame, then to the system default', () => {
    expect(inspectorColumnWidth({ stored: ptToUnits(260) }, W)).toBeCloseTo(ptToUnits(260), 9)
    expect(inspectorColumnWidth({}, W)).toBeCloseTo(ptToUnits(320), 9)
  })

  it('still has to fit the window it splits', () => {
    const narrow = ptToUnits(300)
    expect(inspectorColumnWidth({ ideal: 5000 }, narrow)).toBeLessThanOrEqual(narrow)
    expect(inspectorColumnWidth({ exact: 5000 }, narrow)).toBeLessThanOrEqual(narrow)
    // ...and never collapses to nothing.
    expect(inspectorColumnWidth({ ideal: 0 }, W)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Form and OutlineGroup carry their row metrics (AUDIT #6)
//
// `rowHeight` reached NEITHER side: the canvas had no row rendering to apply
// it to and the generated rows did not mention it. Now the canvas lays each
// row out at that height and the generated row carries it as a floor, so the
// two describe the same row.
// ---------------------------------------------------------------------------
describe('form and outlinegroup row metrics', () => {
  const emit = (type, props = {}) => {
    const tab = makeTab({ name: 'T' })
    const win = makeWindow({ name: 'W', parentId: tab.id })
    const panel = makePanel(type, { parentId: win.id, name: 'P', ...props })
    return exportSwiftUI([tab, win, panel], 'App', {}).map((f) => f.content).join('\n')
  }

  it('emits a Form row per authored row', () => {
    const swift = emit('form', {
      rows: [{ title: 'Alpha' }, { title: 'Beta' }, { title: 'Gamma' }]
    })
    expect(swift).toContain('Form {')
    for (const t of ['Alpha', 'Beta', 'Gamma']) expect(swift).toContain(`Text("${t}")`)
  })

  it('carries rowHeight onto each generated row', () => {
    const swift = emit('form', { rows: [{ title: 'Alpha' }], rowHeight: 64 })
    // A Form row grows for its content, so the authored height is a floor.
    expect(swift).toContain('Text("Alpha").frame(minHeight: 64)')
  })

  it('carries rowHeight onto the outline row too', () => {
    const swift = emit('outlinegroup', { rows: [{ title: 'Root', indent: 0 }], rowHeight: 52 })
    expect(swift).toContain('Text(node.title).frame(minHeight: 52)')
  })

  it('omits the height when there is none to carry', () => {
    expect(emit('form', { rows: [{ title: 'A' }], rowHeight: null })).not.toContain('minHeight')
    expect(emit('form', { rows: [{ title: 'A' }], rowHeight: 0 })).not.toContain('minHeight')
  })

  it('emits formStyle only when it is not the default', () => {
    expect(emit('form', { formStyle: 'columns' })).toContain('.formStyle(.columns)')
    expect(emit('form', { formStyle: 'grouped' })).toContain('.formStyle(.grouped)')
    // `.automatic` resolves to grouped on visionOS and is implicit.
    expect(emit('form', { formStyle: 'automatic' })).not.toContain('.formStyle(')
  })

  it('builds the outline tree from the same indents the canvas walks', () => {
    // The export nests by `indent`; `outlineVisibleRows` flattens by the same
    // field. Both have to read a two-level tree as a parent with children.
    const rows = [
      { title: 'Root', indent: 0, expanded: true },
      { title: 'Kid', indent: 1 }
    ]
    const swift = emit('outlinegroup', { rows })
    expect(swift).toContain('OutlineNode(title: "Root", children: [')
    expect(swift).toContain('OutlineNode(title: "Kid")')
    const walked = outlineVisibleRows(rows)
    expect(walked.map((r) => [r.title, r.isParent])).toEqual([['Root', true], ['Kid', false]])
  })
})

// ---------------------------------------------------------------------------
// Date-picker components (AUDIT #19)
//
// `displayedComponents` is one decision read twice: the exporter maps it onto
// a SwiftUI `displayedComponents:` argument, and the canvas decides which
// parts of the value to print. The canvas used to print the raw stored ISO
// date whatever was chosen, so a time-only picker still previewed a date.
// These check the two halves agree, against the real emitted argument.
// ---------------------------------------------------------------------------
describe('the date picker shows the components it emits', () => {
  const emit = (props) => {
    const tab = makeTab({ name: 'T' })
    const win = makeWindow({ name: 'W', parentId: tab.id })
    const panel = makePanel('datepicker', { parentId: win.id, name: 'D', ...props })
    return exportSwiftUI([tab, win, panel], 'App', {}).map((f) => f.content).join('\n')
  }

  it('agrees about every value in the vocabulary', () => {
    for (const comps of ['date', 'hourAndMinute', 'hourMinuteAndSecond', 'dateAndTime']) {
      const swift = emit({ displayedComponents: comps })
      const line = swift.split('\n').find((l) => l.includes('DatePicker('))
      expect(line, `no DatePicker emitted for ${comps}`).toBeTruthy()
      const parts = dateComponentsParts(comps)
      // `dateAndTime` is the SwiftUI default, so its argument is elided —
      // which is itself the claim that both halves are shown.
      const arg = /displayedComponents: (.+?)\)$/.exec(line)?.[1] ?? '[.date, .hourAndMinute]'
      expect(arg.includes('.date'), `${comps}: date`).toBe(parts.date)
      expect(
        arg.includes('.hourAndMinute') || arg.includes('.hourMinuteAndSecond'),
        `${comps}: time`
      ).toBe(parts.time)
      expect(arg.includes('.hourMinuteAndSecond'), `${comps}: seconds`).toBe(parts.seconds)
    }
  })

  it('elides the argument at the SwiftUI default and emits it otherwise', () => {
    expect(emit({ displayedComponents: 'dateAndTime' })).not.toContain('displayedComponents:')
    expect(emit({ displayedComponents: 'date' })).toContain('displayedComponents: .date')
  })

  it('emits the picker style the canvas switches its layout on', () => {
    // `.graphical` draws a month grid and `.wheel` draws drum columns, so a
    // style the exporter can emit and the canvas cannot see would put the two
    // back out of step.
    for (const style of ['compact', 'graphical', 'wheel']) {
      expect(emit({ dateStyle: style })).toContain(`.datePickerStyle(.${style})`)
    }
    expect(emit({ dateStyle: 'automatic' })).not.toContain('.datePickerStyle(')
  })
})

// ---------------------------------------------------------------------------
// Canvas-only visuals now reach the file (AUDIT #20)
//
// This group ran the other way from the rest of Stage 1: the canvas drew
// these and the EXPORT dropped them, so a filled icon came back outlined, an
// image came back as a `photo` placeholder, and a Label's tinted icon tile
// came back as a plain row. The work was in the emitters, so these read the
// generated Swift.
// ---------------------------------------------------------------------------
describe('canvas-only visuals reach the export', () => {
  const emit = (type, props = {}) => {
    const tab = makeTab({ name: 'T' })
    const win = makeWindow({ name: 'W', parentId: tab.id })
    const panel = makePanel(type, { parentId: win.id, name: 'P', ...props })
    return exportSwiftUI([tab, win, panel], 'App', {}).map((f) => f.content).join('\n')
  }

  it('carries the SF Symbol variant the canvas draws', () => {
    for (const variant of ['fill', 'circle', 'square', 'slash']) {
      expect(emit('label', { symbolName: 'star', symbolVariant: variant }))
        .toContain(`.symbolVariant(.${variant})`)
    }
  })

  it('never puts symbolVariant on a view with no symbol to vary', () => {
    expect(emit('text', { symbolVariant: 'fill', symbolName: null }))
      .not.toContain('.symbolVariant(')
    expect(emit('label', { symbolName: 'star', symbolVariant: null }))
      .not.toContain('.symbolVariant(')
  })

  it('names the image instead of emitting a photo placeholder', () => {
    // A pasted http URL is a real remote image.
    expect(emit('image', { imageUrl: 'https://example.com/hero.png' }))
      .toContain('AsyncImage(url: URL(string: "https://example.com/hero.png"))')
    // A bundled path becomes an asset-catalog reference by its basename.
    expect(emit('image', { imageUrl: '/samples/mountain.jpg' }))
      .toContain('Image("mountain")')
    // A data: URL from the asset library has no filename, so the panel's own
    // name is the best handle the designer will recognise.
    expect(emit('image', { name: 'Hero Shot', imageUrl: 'data:image/png;base64,AAA' }))
      .toContain('Image("Hero Shot")')
    // ...and an empty frame still says so rather than lying about a photo.
    expect(emit('image', { imageUrl: null })).toContain('// no image set')
  })

  it('carries the field shape the canvas draws the edge from', () => {
    expect(emit('textfield', { fieldShape: 'pill' })).toContain('.clipShape(Capsule())')
    expect(emit('securefield', { fieldShape: 'pill' })).toContain('.clipShape(Capsule())')
    const rounded = emit('textfield', { fieldShape: 'rounded' })
    expect(rounded).toContain('.clipShape(RoundedRectangle(cornerRadius:')
    expect(rounded).not.toContain('Capsule()')
  })

  it('carries the editor height the canvas rules lines for', () => {
    expect(emit('texteditor', { lineCount: 7 })).toContain('.lineLimit(7)')
    expect(emit('texteditor', { lineCount: 0 })).not.toContain('.lineLimit(')
  })

  describe('the Label icon tile', () => {
    const tile = { symbolName: 'gear', iconColor: '#ffffff', iconTileColor: '#007aff', iconTileSize: 30, iconTileRadius: 8 }

    it('switches to the two-closure form, which can carry one', () => {
      // `Label(_:systemImage:)` has nowhere to put a tile, so a tile forces
      // the explicit form. Emitting the short form with a tile set would
      // silently drop every part of it — the original defect.
      const swift = emit('label', tile)
      expect(swift).toContain('Label {')
      expect(swift).toContain('} icon: {')
      expect(swift).toContain('Image(systemName: "gear")')
    })

    it('carries the colour, the size and the radius', () => {
      const swift = emit('label', tile)
      expect(swift).toContain('.frame(width: 30, height: 30)')
      expect(swift).toContain('cornerRadius: 8')
      // Both colours reach it: the glyph's and the tile's.
      expect(swift.match(/\.foregroundStyle\(/g)?.length).toBeGreaterThanOrEqual(1)
      expect(swift).toContain('.background(')
    })

    it('stays on the short form when there is no tile', () => {
      const swift = emit('label', { symbolName: 'gear', iconTileColor: null })
      expect(swift).toContain('Label("Label", systemImage: "gear")')
      expect(swift).not.toContain('} icon: {')
    })

    it('still carries a bare icon colour without a tile', () => {
      expect(emit('label', { symbolName: 'gear', iconTileColor: null, iconColor: '#ff3b30' }))
        .toContain('.foregroundStyle(')
    })
  })
})
