// Design-token resolution.
//
// Every colour and material in the app funnels through these two helpers,
// and the Materials & Colors editor lets the user override any of the 24
// library entries. The contract that matters: whatever the user picks, the
// resolver returns a COMPLETE spec - a renderer that reads
// `spec.color`/`spec.opacity` must never get undefined, in either design
// scheme, for any of the 24 keys.

import { describe, it, expect } from 'vitest'
import {
  resolveSemantic, resolveAnyMaterial, resolveMaterial, isGlassMaterialKey,
  materialSwiftValue, MATERIAL_LIBRARY, MATERIAL_LIBRARY_VALUES,
  MATERIALS, MATERIAL_ORDER, SCENE_COLOR_GROUPS, SCENE_COLOR_LABELS,
  DEFAULT_SCENE_COLORS, buildDefaultSceneColors,
  ptToUnits, unitsToPt, metersToPt, ptToMeters,
  TEXT_STYLES, TEXT_STYLE_ORDER, textStyleDefaultWeight,
  computeButtonFramePt, segmentedFrame
} from './appleSystem'

const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/
const scene = (over = {}) => ({ designScheme: 'light', colors: buildDefaultSceneColors(), materialProps: {}, ...over })

describe('the material library', () => {
  it('lists 24 entries: the scene tokens plus the glass tiers', () => {
    const tokenCount = SCENE_COLOR_GROUPS
      .filter((g) => g.key !== 'colors')
      .reduce((n, g) => n + g.tokens.length, 0)
    expect(MATERIAL_LIBRARY.length).toBe(tokenCount + MATERIAL_ORDER.length)
    expect(MATERIAL_LIBRARY_VALUES.length).toBe(MATERIAL_LIBRARY.length)
  })

  it('has no duplicate keys', () => {
    expect(new Set(MATERIAL_LIBRARY_VALUES).size).toBe(MATERIAL_LIBRARY_VALUES.length)
  })

  it('gives every entry a label and a group for the picker', () => {
    for (const m of MATERIAL_LIBRARY) {
      expect(m.label, `${m.value} has no label`).toBeTruthy()
      expect(m.group, `${m.value} has no group`).toBeTruthy()
    }
  })

  it('separates glass tiers from flat colour tokens', () => {
    for (const key of MATERIAL_ORDER) expect(isGlassMaterialKey(key)).toBe(true)
    expect(isGlassMaterialKey('primary')).toBe(false)
    expect(isGlassMaterialKey('nonsense')).toBe(false)
  })
})

describe('resolveAnyMaterial returns a complete spec', () => {
  const REQUIRED = ['color', 'opacity', 'fillType', 'blur', 'blurAmount']

  for (const schemeName of ['light', 'dark']) {
    it(`for all 24 keys in the ${schemeName} scheme`, () => {
      const s = scene({ designScheme: schemeName })
      for (const key of MATERIAL_LIBRARY_VALUES) {
        const spec = resolveAnyMaterial(key, s)
        expect(spec, `${key} resolved to nothing`).toBeTruthy()
        for (const field of REQUIRED) {
          expect(spec[field], `${key}.${field} is undefined in ${schemeName}`).toBeDefined()
        }
        expect(spec.color, `${key} colour is not a hex string`).toMatch(HEX)
        expect(spec.opacity).toBeGreaterThanOrEqual(0)
        expect(spec.opacity).toBeLessThanOrEqual(1)
      }
    })
  }

  it('matches resolveMaterial exactly for the glass tiers', () => {
    const s = scene()
    for (const key of MATERIAL_ORDER) {
      expect(resolveAnyMaterial(key, s)).toEqual(resolveMaterial(key, s.materialProps))
    }
  })

  it('lets a scene override win over the tier default', () => {
    const s = scene({ materialProps: { glass: { color: '#123456', opacity: 0.5 } } })
    const spec = resolveAnyMaterial('glass', s)
    expect(spec.color).toBe('#123456')
    expect(spec.opacity).toBe(0.5)
    // Untouched fields still come from the tier.
    expect(spec.blurAmount).toBe(MATERIALS.glass.blurAmount)
  })

  it('lets a scene override reach a flat colour token too', () => {
    const s = scene({ materialProps: { separator: { color: '#abcdef' } } })
    expect(resolveAnyMaterial('separator', s).color).toBe('#abcdef')
  })

  it('carries stacked layers through when the user adds them', () => {
    const layers = [{ color: '#ffffff', opacity: 0.4 }, { color: '#000000', opacity: 0.1 }]
    const s = scene({ materialProps: { glass: { layers } } })
    expect(resolveAnyMaterial('glass', s).layers).toEqual(layers)
  })

  it('does not mutate the scene it reads', () => {
    const s = scene()
    const before = JSON.stringify(s)
    for (const key of MATERIAL_LIBRARY_VALUES) resolveAnyMaterial(key, s)
    expect(JSON.stringify(s)).toBe(before)
  })

  it('still returns a usable spec for an unknown key', () => {
    // Stored selections can go stale; the renderer must not crash on one.
    const spec = resolveAnyMaterial('someRemovedToken', scene())
    expect(spec.color).toMatch(HEX)
    expect(spec.opacity).toBeDefined()
  })
})

describe('resolveSemantic', () => {
  it('returns a hex for every palette token in both schemes', () => {
    for (const schemeName of ['light', 'dark']) {
      const s = scene({ designScheme: schemeName })
      for (const token of Object.keys(SCENE_COLOR_LABELS)) {
        expect(resolveSemantic(token, s), `${token} in ${schemeName}`).toMatch(HEX)
      }
    }
  })

  it('prefers a scene palette override', () => {
    const s = scene()
    s.colors.primary = '#ff0000'
    expect(resolveSemantic('primary', s)).toBe('#ff0000')
  })

  it('lets a Materials-editor colour override the palette', () => {
    // The materials editor writes into materialProps; that has to win, or a
    // colour edited there would not show up on consumers of the token.
    const s = scene({ materialProps: { primary: { color: '#00ff00' } } })
    s.colors.primary = '#ff0000'
    expect(resolveSemantic('primary', s)).toBe('#00ff00')
  })

  it('accepts a bare scheme string for legacy callers', () => {
    expect(resolveSemantic('primary', 'light')).toMatch(HEX)
    expect(resolveSemantic('primary', 'dark')).toMatch(HEX)
  })

  it('never returns undefined for an unknown token', () => {
    expect(resolveSemantic('notAToken', scene())).toMatch(HEX)
  })

  it('ships a hex for every default palette entry', () => {
    for (const [token, value] of Object.entries(DEFAULT_SCENE_COLORS)) {
      if (typeof value !== 'string') continue      // windowGlassOpacity is a number
      expect(value, `${token} default is not a hex`).toMatch(HEX)
    }
  })

  it('hands out a fresh palette each time, so edits do not leak', () => {
    const a = buildDefaultSceneColors()
    a.primary = '#000000'
    expect(buildDefaultSceneColors().primary).toBe(DEFAULT_SCENE_COLORS.primary)
  })
})

describe('materialSwiftValue', () => {
  it('emits a valid ShapeStyle for every library key', () => {
    for (const key of MATERIAL_LIBRARY_VALUES) {
      expect(materialSwiftValue(key), `${key}`).toMatch(/^\.[a-zA-Z]+$/)
    }
  })

  it('falls back rather than returning nothing', () => {
    expect(materialSwiftValue('unknown')).toBe('.regularMaterial')
  })
})

describe('unit conversion', () => {
  it('round-trips points through units', () => {
    for (const pt of [1, 14, 17, 320, 1200]) {
      expect(unitsToPt(ptToUnits(pt))).toBe(pt)
    }
  })

  it('treats one metre as 1360 points, matching the canvas scale', () => {
    expect(metersToPt(1)).toBe(1360)
    expect(ptToMeters(1360)).toBe(1)
    // A 1200pt window is therefore well under a metre wide.
    expect(ptToUnits(1200)).toBeCloseTo(0.882, 3)
  })
})

describe('typography', () => {
  it('orders every text style, with no gaps or extras', () => {
    expect(new Set(TEXT_STYLE_ORDER)).toEqual(new Set(Object.keys(TEXT_STYLES)))
  })

  it('gives every style a size, weight and line height', () => {
    for (const [key, s] of Object.entries(TEXT_STYLES)) {
      expect(s.pt, `${key}`).toBeGreaterThan(0)
      expect(s.weight, `${key}`).toBeTruthy()
      expect(s.lineHeight, `${key}`).toBeGreaterThanOrEqual(s.pt)
    }
  })

  it('descends monotonically across the standard ramp', () => {
    // The order mirrors Apple's Font.TextStyle listing: the two visionOS-only
    // extra-large styles are a leading pair, then the standard ramp restarts
    // at largeTitle. So extraLargeTitle2 (28pt) sitting below largeTitle
    // (34pt) is Apple's design, not a gap in ours - the monotonic check
    // belongs to the standard ramp alone.
    const standard = TEXT_STYLE_ORDER.slice(TEXT_STYLE_ORDER.indexOf('largeTitle'))
    const sizes = standard.map((k) => TEXT_STYLES[k].pt)
    for (let i = 0; i + 1 < sizes.length; i++) {
      expect(sizes[i], `${standard[i]} is smaller than ${standard[i + 1]}`)
        .toBeGreaterThanOrEqual(sizes[i + 1])
    }
  })

  it('keeps the extra-large pair in descending order too', () => {
    expect(TEXT_STYLES.extraLargeTitle.pt).toBeGreaterThan(TEXT_STYLES.extraLargeTitle2.pt)
    // extraLargeTitle is the largest style in the whole ramp.
    const max = Math.max(...Object.values(TEXT_STYLES).map((s) => s.pt))
    expect(TEXT_STYLES.extraLargeTitle.pt).toBe(max)
  })

  it('reports the visionOS default weight per style', () => {
    // visionOS bumps body to medium for legibility on glass; the exporter
    // relies on this to decide when `.weight(...)` is redundant.
    expect(textStyleDefaultWeight('body')).toBe('medium')
    expect(textStyleDefaultWeight('largeTitle')).toBe('bold')
  })
})

describe('control frames', () => {
  it('widens a button to fit a longer label', () => {
    const short = computeButtonFramePt({ text: 'OK', textStyle: 'body' })
    const long = computeButtonFramePt({ text: 'Continue to the next step', textStyle: 'body' })
    expect(long[0]).toBeGreaterThan(short[0])
    // Height is locked to the size preset, not the label.
    expect(long[1]).toBe(short[1])
  })

  it('grows a segmented control by one segment at a time', () => {
    const two = segmentedFrame(2)[0]
    const three = segmentedFrame(3)[0]
    expect(three).toBeGreaterThan(two)
    expect(segmentedFrame(2)[1]).toBe(segmentedFrame(5)[1])
  })

  it('never returns a zero-width segmented frame', () => {
    for (const n of [0, null, undefined, 1]) {
      expect(segmentedFrame(n)[0]).toBeGreaterThan(0)
    }
  })
})
