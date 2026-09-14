// Font faces for `.fontDesign(_:)`.
//
// The app renders 3D text through troika (which needs a font FILE) and
// measures it through Canvas2D (which needs a CSS FAMILY). Both have to name
// the same face for a given design, or the canvas wraps a serif heading at
// Inter's widths and draws it in Source Serif. These tests pin the table both
// sides read, the vocabulary the inspector offers out of it, and the wiring
// that carries a design from the modifier down to the measurer.

import { describe, it, expect, afterEach } from 'vitest'
import {
  getFont, getInterFont, FONT_DESIGNS, FONT_DESIGN_OPTIONS, FONT_FAMILIES, fontFamilyFor
} from './fonts'
import {
  singleLineWidth, wrapLines, measureSwiftUIText, setTextMeasurer, resetTextMeasurer
} from './text'
import { textMetrics } from './layout'
import { ptToUnits } from './appleSystem'
import { makeTab, makeWindow, makePanel } from './store/factories'
import { exportSwiftUI } from './export/swiftui'

// ---------------------------------------------------------------------------
// The four font designs (AUDIT #5)
//
// `.fontDesign(_:)` picks one of four faces. Three of the four had no face to
// pick, so a serif heading drew as Inter and shipped as New York — and the
// canvas measured it at Inter's widths, which is the half of the defect that
// would have survived a font swap done carelessly.
// ---------------------------------------------------------------------------
describe('the font design table', () => {
  it('covers every design the modifier offers', () => {
    // The modifier's vocabulary and the face table are one list or the other
    // rots: a design the inspector can set with no face behind it draws Inter
    // and says nothing about it.
    for (const { value, label } of FONT_DESIGN_OPTIONS) {
      expect(FONT_DESIGNS, `'${value}' has no face`).toContain(value)
      expect(label, `'${value}' has no label`).toBeTruthy()
    }
    // And nothing with a face is missing from the list.
    expect(FONT_DESIGN_OPTIONS.map((o) => o.value).sort()).toEqual([...FONT_DESIGNS].sort())
  })

  it('gives each design its own face', () => {
    const faces = FONT_DESIGNS.map((d) => getFont(d, 'regular', false))
    expect(new Set(faces).size).toBe(FONT_DESIGNS.length)
  })

  it('gives each design the same four weights and both styles', () => {
    // A design swap must not silently change the weight as well.
    for (const design of FONT_DESIGNS) {
      const seen = new Set()
      for (const weight of ['regular', 'medium', 'semibold', 'bold']) {
        for (const italic of [false, true]) {
          const url = getFont(design, weight, italic)
          expect(url, `${design}/${weight}/${italic} has no file`).toBeTruthy()
          seen.add(url)
        }
      }
      expect(seen.size, `${design} reuses a file across weights or styles`).toBe(8)
    }
  })

  it('falls back to the default face rather than to nothing', () => {
    // A project carrying a design this build has never heard of still renders.
    for (const d of [undefined, null, '', 'nonsense']) {
      expect(getFont(d, 'regular', false)).toBe(getFont('default', 'regular', false))
    }
    expect(getFont('serif', 'nonsense', false)).toBe(getFont('serif', 'regular', false))
  })

  it('keeps the Inter helper pointing at the default design', () => {
    for (const weight of ['regular', 'medium', 'semibold', 'bold']) {
      for (const italic of [false, true]) {
        expect(getInterFont(weight, italic)).toBe(getFont('default', weight, italic))
      }
    }
  })

  it('names a CSS family for every design, for the measurement side', () => {
    // Canvas2D measures by family name while troika shapes from the file. If
    // a design had no family the two would be looking at different faces and
    // the canvas would wrap where the device does not.
    for (const design of FONT_DESIGNS) {
      expect(FONT_FAMILIES[design], `${design} has no CSS family`).toBeTruthy()
      expect(fontFamilyFor(design)).toContain(FONT_FAMILIES[design])
    }
    expect(fontFamilyFor('nonsense')).toBe(fontFamilyFor('default'))
  })

  it('gives the serif and mono designs a fallback of their own shape', () => {
    // Before the webfont loads, a measurement lands on the fallback. Falling
    // back to the UI sans for all four would measure a serif as a grotesque.
    expect(fontFamilyFor('serif')).toMatch(/serif/)
    expect(fontFamilyFor('monospaced')).toMatch(/mono/)
  })
})

describe('a design reaches the measurement pipeline', () => {
  // The measurer is pluggable, so this pins the wiring rather than the metrics
  // of any particular face — the built-in approximation cannot tell faces
  // apart, and the browser measurer is the one that can.
  afterEach(() => resetTextMeasurer())

  it('hands the design to the measurer', () => {
    const seen = []
    setTextMeasurer((text, size, weight, design) => { seen.push(design); return text.length * size * 0.5 })
    singleLineWidth('abc', ptToUnits(17), 0, 1, 'regular', 'serif')
    expect(seen).toContain('serif')
  })

  it('carries it through wrapping too', () => {
    const seen = new Set()
    setTextMeasurer((text, size, weight, design) => { seen.add(design); return text.length * size * 0.5 })
    wrapLines('some words that will wrap', ptToUnits(17), ptToUnits(80), 0, 1, 'regular', 'monospaced')
    expect([...seen]).toEqual(['monospaced'])
  })

  it('carries it through the whole measurement', () => {
    const seen = new Set()
    setTextMeasurer((text, size, weight, design) => { seen.add(design); return text.length * size * 0.5 })
    measureSwiftUIText('a longer run of text to wrap', ptToUnits(17), ptToUnits(90), { fontDesign: 'rounded' })
    expect([...seen]).toEqual(['rounded'])
  })

  it('defaults to the default design when nothing asks for one', () => {
    const seen = new Set()
    setTextMeasurer((text, size, weight, design) => { seen.add(design); return text.length * size * 0.5 })
    measureSwiftUIText('some text', ptToUnits(17), ptToUnits(200), {})
    expect([...seen]).toEqual(['default'])
  })

  it('measures two designs differently once a real measurer is installed', () => {
    // The defect in one assertion: every design used to measure the same.
    setTextMeasurer((text, size, weight, design) =>
      text.length * size * (design === 'monospaced' ? 0.6 : 0.5))
    const mono = singleLineWidth('abcdef', ptToUnits(17), 0, 1, 'regular', 'monospaced')
    const sans = singleLineWidth('abcdef', ptToUnits(17), 0, 1, 'regular', 'default')
    expect(mono).toBeGreaterThan(sans)
  })
})

describe('textMetrics resolves the design the renderer draws with', () => {
  const panel = (over = {}) => makePanel('text', { text: 'Heading', ...over })
  const mod = (over = {}) => over

  it('defaults to the default design', () => {
    expect(textMetrics(panel(), mod()).fontDesign).toBe('default')
  })

  it('reads the modifier', () => {
    expect(textMetrics(panel(), mod({ fontDesign: 'serif' })).fontDesign).toBe('serif')
  })

  it('reads the panel field when there is no modifier', () => {
    expect(textMetrics(panel({ fontDesign: 'rounded' }), mod()).fontDesign).toBe('rounded')
  })

  it('lets the modifier win, since that is what the export emits', () => {
    const m = textMetrics(panel({ fontDesign: 'rounded' }), mod({ fontDesign: 'monospaced' }))
    expect(m.fontDesign).toBe('monospaced')
  })

  it('survives a panel with no modifiers at all', () => {
    expect(textMetrics(panel(), undefined).fontDesign).toBe('default')
  })
})

describe('the design the canvas measures is the design the file carries', () => {
  const emit = (design) => {
    const tab = makeTab({ name: 'T' })
    const win = makeWindow({ name: 'W', parentId: tab.id })
    const text = makePanel('text', {
      parentId: win.id, text: 'Heading',
      modifiers: design === 'default' ? [] : [{ type: 'fontDesign', value: design }]
    })
    return exportSwiftUI([tab, win, text], 'App', {}).map((f) => f.content).join('\n')
  }

  it('emits the design the canvas picked a face for', () => {
    for (const design of FONT_DESIGNS) {
      const swift = emit(design)
      const resolved = textMetrics(
        { text: 'Heading' },
        design === 'default' ? {} : { fontDesign: design }
      ).fontDesign
      expect(resolved).toBe(design)
      // `.default` is the implicit case, so the exporter elides it.
      if (design === 'default') expect(swift).not.toContain('.fontDesign(')
      else expect(swift).toContain(`.fontDesign(.${design})`)
    }
  })
})
