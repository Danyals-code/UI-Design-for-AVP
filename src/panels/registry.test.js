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
