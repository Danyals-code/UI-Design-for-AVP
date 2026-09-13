// The escape hatch: raw Swift authored in the designer and emitted verbatim.
//
// Two things have to hold. The fragment must reach the generated file
// unchanged — the whole point is that the designer's text is not
// second-guessed. And a fragment that would break the file has to be caught
// while the user can still see it, because the failure otherwise surfaces in
// Xcode with no indication of which node produced it.

import { describe, it, expect } from 'vitest'
import { validateSwiftFragment } from './swiftValidate'
import { exportSwiftUI } from './swiftui'
import { PANELS } from '../panels/registry'
import { MODIFIERS } from '../modifiers/registry'
import {
  makeTab, makeWindow, makeStack, makePanel, DEFAULT_SCENE
} from '../store/factories'

// Build a minimal scene around one panel and return the generated view file.
function exportWith(panelType, overrides = {}) {
  const tab = makeTab({ name: 'T' })
  const win = makeWindow({ parentId: tab.id })
  const stack = makeStack({ parentId: win.id })
  const panel = makePanel(panelType, { parentId: stack.id, ...overrides })
  const files = exportSwiftUI([tab, win, stack, panel], 'Probe', { ...DEFAULT_SCENE })
  return files.find((f) => f.filename === 'TView.swift').content
}

describe('validateSwiftFragment', () => {
  it('accepts ordinary SwiftUI', () => {
    expect(validateSwiftFragment('Text("Hello").font(.largeTitle)').ok).toBe(true)
    expect(validateSwiftFragment('VStack {\n  Text("a")\n}').ok).toBe(true)
  })

  it('accepts an empty fragment', () => {
    // Mid-edit emptiness is a normal state, not something to flag.
    expect(validateSwiftFragment('').ok).toBe(true)
    expect(validateSwiftFragment('   \n  ').ok).toBe(true)
  })

  it('catches an unclosed brace and names the line it opened on', () => {
    const r = validateSwiftFragment('VStack {\n  Text("a")')
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/line 1/i)
  })

  it('catches a stray closing bracket', () => {
    const r = validateSwiftFragment('Text("a"))')
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/nothing open/i)
  })

  it('catches a mismatched pair', () => {
    const r = validateSwiftFragment('foo(bar]')
    expect(r.ok).toBe(false)
  })

  it('catches a string literal left open at end of line', () => {
    // Swift has no multi-line plain literal, and braces stay balanced when
    // this happens, so the bracket check alone cannot see it.
    const r = validateSwiftFragment('Text("unterminated')
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/string literal/i)
  })

  it('ignores brackets inside string literals', () => {
    expect(validateSwiftFragment('Text("a { b ) c")').ok).toBe(true)
  })

  it('ignores an escaped quote inside a literal', () => {
    expect(validateSwiftFragment('Text("say \\"hi\\"")').ok).toBe(true)
  })

  it('ignores brackets inside comments', () => {
    expect(validateSwiftFragment('Text("a") // trailing } brace').ok).toBe(true)
    expect(validateSwiftFragment('/* a { b */ Text("a")').ok).toBe(true)
  })

  it('catches an unclosed block comment', () => {
    const r = validateSwiftFragment('Text("a") /* never closed')
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/block comment/i)
  })
})

describe('custom panel', () => {
  it('is a registered panel type with an emitter', () => {
    expect(PANELS.custom).toBeTruthy()
    expect(typeof PANELS.custom.emit).toBe('function')
  })

  it('emits the authored source verbatim', () => {
    const out = exportWith('custom', { code: 'MyBespokeView(count: 3)' })
    expect(out).toContain('MyBespokeView(count: 3)')
  })

  it('preserves multi-line source and its internal indentation', () => {
    const out = exportWith('custom', {
      code: 'VStack {\n    Text("one")\n    Text("two")\n}'
    })
    expect(out).toContain('VStack {')
    expect(out).toContain('Text("one")')
    expect(out).toContain('Text("two")')
    // The fragment's own 4-space indent rides on top of the generated indent,
    // rather than being flattened to the left margin.
    expect(out).toMatch(/\n(\s+)Text\("one"\)/)
    const genIndent = out.match(/\n(\s*)VStack \{/)[1]
    const bodyIndent = out.match(/\n(\s*)Text\("one"\)/)[1]
    expect(bodyIndent.length).toBeGreaterThan(genIndent.length)
  })

  it('emits a real view rather than a hole when the source is empty', () => {
    // The node still occupies a slot in a result builder; emitting nothing
    // there would silently change the parent's layout.
    const out = exportWith('custom', { code: '' })
    expect(out).toContain('EmptyView()')
  })

  it('normalises CRLF so a pasted fragment emits clean lines', () => {
    const out = exportWith('custom', { code: 'Text("a")\r\nText("b")' })
    expect(out).not.toContain('\r')
    expect(out).toContain('Text("b")')
  })

  it('does not emit a TODO — it is covered, not stubbed', () => {
    const out = exportWith('custom', { code: 'Text("x")' })
    expect(out).not.toMatch(/\/\/ TODO/)
  })

  it('keeps the file structurally valid for well-formed source', () => {
    const out = exportWith('custom', { code: 'VStack {\n    Text("ok")\n}' })
    expect(validateSwiftFragment(out).ok).toBe(true)
  })
})

describe('custom modifier', () => {
  const emit = (source) => MODIFIERS.customModifier.emit({ source })

  it('is registered and applies to any view that shows the stack', () => {
    expect(MODIFIERS.customModifier).toBeTruthy()
    expect(MODIFIERS.customModifier.appliesTo('text')).toBe(true)
    expect(MODIFIERS.customModifier.appliesTo('stack')).toBe(true)
  })

  it('emits the source as a chain entry', () => {
    expect(emit('.symbolEffect(.bounce)')).toBe('.symbolEffect(.bounce)')
  })

  it('adds the leading dot when the user omits it', () => {
    expect(emit('padding(8)')).toBe('.padding(8)')
  })

  it('drops an empty entry rather than emitting a bare dot', () => {
    expect(emit('')).toBe(null)
    expect(emit('   ')).toBe(null)
  })

  it('contributes nothing to the canvas preview accumulator', () => {
    // An arbitrary modifier's visual effect is unknowable, so the canvas
    // must render the view unmodified rather than guess.
    const acc = { opacity: 1 }
    MODIFIERS.customModifier.summarize({ source: '.opacity(0)' }, acc)
    expect(acc.opacity).toBe(1)
  })

  it('survives the export path onto a real panel', () => {
    const out = exportWith('text', {
      text: 'Hi',
      modifiers: [{ id: 'm1', type: 'customModifier', source: '.symbolEffect(.pulse)' }]
    })
    expect(out).toContain('.symbolEffect(.pulse)')
  })
})
