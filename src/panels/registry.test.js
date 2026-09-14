// Panel registry emit tests.
//
// swiftui.test.js checks whole-template output; this file pins the single
// emitter that produced non-compiling Swift, plus the registry invariants
// the store and exporter both rely on.

import { describe, it, expect } from 'vitest'
import { PANELS, panelTypes, panelDefaults, emitPanel, isInteractivePanel } from './registry'

// Minimal stand-in for the exporter's emit context. Only the helpers the
// button emitter actually reaches for.
function makeCtx() {
  const lines = []
  return {
    lines,
    push: (l) => lines.push(l),
    ind: '',
    escapeString: (s) => String(s ?? '').replace(/"/g, '\\"'),
    swiftColor: (token, hex) => (token ? `.${token}` : `Color("${hex}")`),
    unitsToPt: (u) => Math.round((u || 0) * 1360),
    applyTextModifiers: (l) => l,
    lookupItem: () => null
  }
}

function emit(panelType, overrides = {}) {
  const ctx = makeCtx()
  emitPanel({ panelType, ...panelDefaults(panelType), ...overrides }, ctx)
  return ctx.lines
}

describe('button emit', () => {
  // The regression: `compileAction` returned the string `// no action`,
  // which is interpolated mid-line into `Button{ <body> } label: { ... }`.
  // A line comment there eats the closing brace, the `label:` argument and
  // every chained modifier.
  it('uses a block comment for an un-wired button, never a line comment', () => {
    const [line] = emit('button', { tapAction: null, text: 'Get Started' })
    expect(line).toContain('/* no action */')
    expect(line).not.toContain('// no action')
  })

  it('keeps the label argument and modifier chain outside any comment', () => {
    const [line] = emit('button', { tapAction: null, text: 'Get Started' })
    const commentStart = line.indexOf('//')
    // Either there is no line comment at all, or nothing structural follows.
    if (commentStart !== -1) {
      const tail = line.slice(commentStart)
      expect(tail).not.toContain('label:')
      expect(tail).not.toContain('}')
    }
    expect(line).toContain('label:')
  })

  it('balances braces with and without a tap action', () => {
    const count = (s, ch) => s.split(ch).length - 1
    for (const tapAction of [
      null,
      { type: 'unrecognised-action-type' },
      { type: 'navigateTab', tab: 2 },
      { type: 'flipToggle', panelId: 'panel-1' }
    ]) {
      const [line] = emit('button', { tapAction, text: 'Go' })
      // Strip the block comment before counting so its contents can't skew
      // the tally.
      const bare = line.replace(/\/\*[\s\S]*?\*\//g, '')
      expect(count(bare, '{'), `unbalanced for ${JSON.stringify(tapAction)}`)
        .toBe(count(bare, '}'))
    }
  })

  it('compiles a recognised action into a real statement', () => {
    const [line] = emit('button', { tapAction: { type: 'navigateTab', tab: 3 } })
    expect(line).toContain('selectedTab = 3')
    expect(line).not.toContain('no action')
  })
})

describe('registry invariants', () => {
  it('gives every panel type an emit function', () => {
    for (const type of panelTypes()) {
      expect(typeof PANELS[type].emit, `${type} has no emit()`).toBe('function')
    }
  })

  it('emits at least one line for every panel type at its defaults', () => {
    for (const type of panelTypes()) {
      expect(emit(type).length, `${type} emitted nothing`).toBeGreaterThan(0)
    }
  })

  it('hands back a fresh defaults object each call', () => {
    // `makePanel` spreads these onto new items; a shared reference would let
    // one panel's edit leak into the next panel of the same type.
    const a = panelDefaults('button')
    const b = panelDefaults('button')
    expect(a).not.toBe(b)
  })

  it('treats only real controls as interactive', () => {
    expect(isInteractivePanel('button')).toBe(true)
    expect(isInteractivePanel('toggle')).toBe(true)
    expect(isInteractivePanel('text')).toBe(false)
    expect(isInteractivePanel('divider')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Frame mode
//
// `panelFrameMode` decides whether the exporter emits `.frame(...)` from a
// panel's stored `size`, from its Fit/Fixed/Fill mode, or not at all. The
// inspector carries the same vocabulary in `PANEL_META.frameMode`, because
// it drives which fields that inspector renders — and the two must agree, or
// a type shows width/height fields whose values never reach the export (or
// the reverse).
//
// The inspector lives in a .jsx module that pulls in React and the store, so
// this reads its source rather than importing it. The check is exact: every
// `frameMode:` literal in PANEL_META is matched against the registry.
// ---------------------------------------------------------------------------

import fs from 'fs'
import { panelFrameMode, panelHeightIsDerived } from './registry'

const inspectorSource = fs.readFileSync(new URL('./inspectors.jsx', import.meta.url), 'utf8')

// PANEL_META entries are either `type: sharedConst` or `type: { ... }`.
// Resolve both to the frameMode they end up with.
function inspectorFrameModes() {
  const consts = {}
  for (const m of inspectorSource.matchAll(
    /^const (\w+) = \{ frameMode: '(\w+)'/gm
  )) consts[m[1]] = m[2]

  const start = inspectorSource.indexOf('export const PANEL_META')
  const end = inspectorSource.indexOf('\n}', start)
  const block = inspectorSource.slice(start, end)

  const out = {}
  for (const line of block.split('\n')) {
    const m = /^\s{2}(\w+):\s*(.+?),?\s*$/.exec(line)
    if (!m) continue
    const [, type, value] = m
    const inline = /frameMode: '(\w+)'/.exec(value)
    if (inline) { out[type] = inline[1]; continue }
    const spread = /\.\.\.(\w+)/.exec(value)
    const bare = /^(\w+)$/.exec(value.replace(/,$/, ''))
    const ref = spread?.[1] || bare?.[1]
    if (ref && consts[ref]) out[type] = consts[ref]
  }
  return out
}

describe('frame mode', () => {
  it('parses the inspector metadata it is checked against', () => {
    // Guards the regex above: if PANEL_META is restructured and nothing is
    // parsed, the agreement test below would pass vacuously.
    const modes = inspectorFrameModes()
    expect(Object.keys(modes).length).toBeGreaterThan(15)
    expect(new Set(Object.values(modes))).toEqual(new Set(['explicit', 'figma', 'none']))
  })

  it('agrees with the inspector for every type the inspector names', () => {
    const mismatches = []
    for (const [type, inspectorMode] of Object.entries(inspectorFrameModes())) {
      const registryMode = panelFrameMode(type)
      if (registryMode !== inspectorMode) {
        mismatches.push(`${type}: registry '${registryMode}' vs inspector '${inspectorMode}'`)
      }
    }
    expect(mismatches).toEqual([])
  })

  it('defaults an unlisted type to an explicit frame', () => {
    // Matches `getPanelMeta`, which falls back to `explicitFrame`.
    expect(panelFrameMode('definitely-not-a-panel-type')).toBe('explicit')
  })

  it('marks the list as height-derived, matching lockHeight', () => {
    expect(panelHeightIsDerived('list')).toBe(true)
    expect(inspectorSource).toMatch(/list: \{ \.\.\.explicitFrame, lockHeight: true/)
  })

  it('gives every registered type a valid mode', () => {
    for (const type of panelTypes()) {
      expect(['explicit', 'figma', 'none'], type).toContain(panelFrameMode(type))
    }
  })
})
