// SwiftUI Text measurement.
//
// This module decides how much room a Text panel reserves, and the same
// numbers are consumed twice: `layout.js` uses them to position siblings,
// and `Panel3D` uses them to render. If measurement drifts, text overlaps
// the panel below it, so the invariants here are about self-consistency as
// much as absolute values.
//
// Assertions stick to properties the pipeline is specified to hold -
// `lineLimit` is a hard cap, a truncated line carries an ellipsis, scale
// stays within the floor the caller set - rather than pinning exact glyph
// widths, which would just re-state the 0.55 advance constant.

import { describe, it, expect } from 'vitest'
import { measureSwiftUIText, wrapLines, singleLineWidth, glyphAdvanceUnits } from './text'
import { ptToUnits } from './appleSystem'

const FS = ptToUnits(17)          // body size
const W = (pt) => ptToUnits(pt)

const LOREM = 'The quick brown fox jumps over the lazy dog near the river bank'

describe('glyph metrics', () => {
  it('grows with font size', () => {
    expect(glyphAdvanceUnits(ptToUnits(34))).toBeGreaterThan(glyphAdvanceUnits(ptToUnits(17)))
  })

  it('adds tracking on top of the advance', () => {
    const plain = glyphAdvanceUnits(FS, 0)
    const tracked = glyphAdvanceUnits(FS, 4)
    expect(tracked).toBeCloseTo(plain + ptToUnits(4), 10)
  })

  it('shrinks when tightening is applied', () => {
    expect(glyphAdvanceUnits(FS, 0, 0.95)).toBeLessThan(glyphAdvanceUnits(FS, 0, 1))
  })

  it('measures an empty string as zero width', () => {
    expect(singleLineWidth('', FS)).toBe(0)
  })
})

describe('wrapLines', () => {
  it('breaks at word boundaries, not mid-word', () => {
    const lines = wrapLines(LOREM, FS, W(200))
    expect(lines.length).toBeGreaterThan(1)
    // Re-joining with single spaces must reproduce the input, which only
    // holds if every break landed on whitespace.
    expect(lines.join(' ').replace(/\s+/g, ' ').trim()).toBe(LOREM)
  })

  it('honours hard newlines as line breaks', () => {
    expect(wrapLines('one\ntwo\nthree', FS, W(400))).toEqual(['one', 'two', 'three'])
  })

  it('keeps a blank line for a blank paragraph', () => {
    expect(wrapLines('a\n\nb', FS, W(400))).toEqual(['a', '', 'b'])
  })

  it('character-breaks a single word wider than the bound', () => {
    // UAX-14 fallback: a word with no break opportunity still has to fit.
    const lines = wrapLines('Pneumonoultramicroscopicsilicovolcanoconiosis', FS, W(60))
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join('')).toBe('Pneumonoultramicroscopicsilicovolcanoconiosis')
  })

  it('never returns an empty array', () => {
    expect(wrapLines('', FS, W(200))).toEqual([''])
  })

  it('degrades to one line rather than looping when the bound is zero', () => {
    expect(wrapLines('some text', FS, 0)).toEqual(['some text'])
  })

  it('produces fewer lines as the bound widens', () => {
    const narrow = wrapLines(LOREM, FS, W(120)).length
    const wide = wrapLines(LOREM, FS, W(400)).length
    expect(wide).toBeLessThan(narrow)
  })
})

describe('measureSwiftUIText', () => {
  it('reports every wrapped line and a height that covers them', () => {
    const r = measureSwiftUIText(LOREM, FS, W(200))
    expect(r.lines.length).toBeGreaterThan(1)
    expect(r.height).toBeGreaterThan(FS)
    expect(r.truncated).toBe(false)
  })

  it('keeps measured width inside the proposed bound when wrapping', () => {
    const r = measureSwiftUIText(LOREM, FS, W(200))
    expect(r.width).toBeLessThanOrEqual(W(200) + 1e-9)
  })

  it('grows height with line spacing', () => {
    const tight = measureSwiftUIText(LOREM, FS, W(200), { lineSpacingPt: 0 })
    const loose = measureSwiftUIText(LOREM, FS, W(200), { lineSpacingPt: 10 })
    expect(loose.height).toBeGreaterThan(tight.height)
    expect(loose.lines.length).toBe(tight.lines.length)
  })

  describe('lineLimit', () => {
    it('is a hard cap', () => {
      for (const limit of [1, 2, 3]) {
        const r = measureSwiftUIText(LOREM, FS, W(120), { lineLimit: limit })
        expect(r.lines.length, `lineLimit ${limit} exceeded`).toBeLessThanOrEqual(limit)
      }
    })

    it('flags truncation only when it actually clipped', () => {
      const clipped = measureSwiftUIText(LOREM, FS, W(120), { lineLimit: 1 })
      expect(clipped.truncated).toBe(true)
      const roomy = measureSwiftUIText('short', FS, W(400), { lineLimit: 5 })
      expect(roomy.truncated).toBe(false)
    })

    it('is ignored when the vertical axis is fixed', () => {
      // `.fixedSize(vertical: true)` means the view keeps its full height,
      // so the limit must not clip it.
      const r = measureSwiftUIText(LOREM, FS, W(120), { lineLimit: 1, fixedSizeV: true })
      expect(r.lines.length).toBeGreaterThan(1)
      expect(r.truncated).toBe(false)
    })

    it('treats null and zero as unlimited', () => {
      const unlimited = measureSwiftUIText(LOREM, FS, W(120), { lineLimit: null })
      const zero = measureSwiftUIText(LOREM, FS, W(120), { lineLimit: 0 })
      expect(zero.lines.length).toBe(unlimited.lines.length)
      expect(zero.truncated).toBe(false)
    })
  })

  describe('truncationMode', () => {
    const ELLIPSIS = '…'

    it('tail keeps the beginning and marks the end', () => {
      const r = measureSwiftUIText(LOREM, FS, W(120), { lineLimit: 1, truncationMode: 'tail' })
      expect(r.lines[0].startsWith('The')).toBe(true)
      expect(r.lines[0]).toContain(ELLIPSIS)
    })

    it('head keeps the end and marks the beginning', () => {
      const r = measureSwiftUIText(LOREM, FS, W(120), { lineLimit: 1, truncationMode: 'head' })
      expect(r.lines[0]).toContain(ELLIPSIS)
      expect(r.lines[0].indexOf(ELLIPSIS)).toBe(0)
    })

    it('middle keeps both ends and elides the centre', () => {
      const r = measureSwiftUIText(LOREM, FS, W(140), { lineLimit: 1, truncationMode: 'middle' })
      const idx = r.lines[0].indexOf(ELLIPSIS)
      expect(idx).toBeGreaterThan(0)
      expect(idx).toBeLessThan(r.lines[0].length - 1)
    })

    it('every mode still respects the line cap', () => {
      for (const mode of ['head', 'middle', 'tail']) {
        for (const limit of [1, 2, 3]) {
          const r = measureSwiftUIText(LOREM, FS, W(120), { lineLimit: limit, truncationMode: mode })
          expect(r.lines.length, `${mode} @ ${limit}`).toBeLessThanOrEqual(limit)
        }
      }
    })

    it('marks an ellipsis somewhere whenever it truncated', () => {
      for (const mode of ['head', 'middle', 'tail']) {
        const r = measureSwiftUIText(LOREM, FS, W(120), { lineLimit: 2, truncationMode: mode })
        expect(r.truncated).toBe(true)
        expect(r.lines.join(''), `${mode} lost its ellipsis`).toContain(ELLIPSIS)
      }
    })
  })

  describe('minimumScaleFactor', () => {
    it('shrinks the font rather than wrapping, down to the floor', () => {
      const r = measureSwiftUIText('A fairly long single line of text', FS, W(120), {
        minimumScaleFactor: 0.5
      })
      expect(r.scale).toBeLessThan(1)
      expect(r.scale).toBeGreaterThanOrEqual(0.5)
      expect(r.fontSize).toBeCloseTo(FS * r.scale, 10)
    })

    it('never scales below the floor the caller set', () => {
      for (const floor of [0.3, 0.5, 0.8]) {
        const r = measureSwiftUIText(LOREM, FS, W(60), { minimumScaleFactor: floor })
        expect(r.scale, `floor ${floor} breached`).toBeGreaterThanOrEqual(floor)
      }
    })

    it('leaves scale at 1 when the text already fits', () => {
      const r = measureSwiftUIText('ok', FS, W(400), { minimumScaleFactor: 0.5 })
      expect(r.scale).toBe(1)
    })

    it('defaults to no scaling', () => {
      expect(measureSwiftUIText(LOREM, FS, W(60)).scale).toBe(1)
    })
  })

  describe('allowsTightening', () => {
    it('leaves metrics untouched when off', () => {
      expect(measureSwiftUIText(LOREM, FS, W(200)).tightenFactor).toBe(1)
    })

    it('never tightens beyond the 5% SwiftUI allows', () => {
      const r = measureSwiftUIText('Just barely too wide for one line', FS, W(150), {
        allowsTightening: true
      })
      expect(r.tightenFactor).toBeLessThanOrEqual(1)
      expect(r.tightenFactor).toBeGreaterThanOrEqual(0.95)
    })
  })

  describe('fixedSize(horizontal:)', () => {
    it('reports the intrinsic single-line size and does not wrap', () => {
      const r = measureSwiftUIText(LOREM, FS, W(80), { fixedSizeH: true })
      expect(r.lines).toEqual([LOREM])
      expect(r.width).toBeGreaterThan(W(80))
    })

    it('still splits on hard newlines', () => {
      const r = measureSwiftUIText('one\ntwo', FS, W(80), { fixedSizeH: true })
      expect(r.lines).toEqual(['one', 'two'])
    })
  })

  describe('degenerate input', () => {
    it('handles empty and nullish text without throwing', () => {
      for (const t of ['', null, undefined]) {
        const r = measureSwiftUIText(t, FS, W(200))
        expect(r.lines.length).toBeGreaterThanOrEqual(1)
        expect(r.width).toBe(0)
        expect(Number.isFinite(r.height)).toBe(true)
      }
    })

    it('returns finite metrics for an infinite proposal', () => {
      // layout.js passes Infinity for "no parent proposal yet".
      const r = measureSwiftUIText(LOREM, FS, Number.POSITIVE_INFINITY)
      expect(r.lines).toEqual([LOREM])
      expect(Number.isFinite(r.width)).toBe(true)
      expect(Number.isFinite(r.height)).toBe(true)
    })
  })
})
