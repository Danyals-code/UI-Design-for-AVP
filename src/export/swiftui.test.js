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
import { exportSwiftUI } from './swiftui'
import { DEFAULT_SCENE } from '../store/factories'
import { NAVBAR_STYLE_SPECS } from '../appleSystem'

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
