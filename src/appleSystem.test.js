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
  computeButtonFramePt, segmentedFrame,
  controlFraction, valueFromFraction, mixHex, applyAspectRatio,
  outlineVisibleRows,
  PICKER_STYLES, MENU_STYLES,
  PICKER_STYLES_SHOWING_OPTIONS, MENU_STYLES_AS_BUTTON, dateComponentsParts,
  LABEL_STYLES, TOGGLE_STYLES, TEXTFIELD_STYLES, labelSlots
} from './appleSystem'
import { DEFAULT_STYLES } from './store/factories'

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

// ---------------------------------------------------------------------------
// Control ranges (AUDIT #17)
//
// Slider, Gauge, Stepper and ProgressView each carry a value inside a range
// the designer declares. The canvas used to clamp that value to 0..1 and paint
// the result, which is right only when the range happens to BE 0..1 — so a
// slider authored 0...100 at 50 drew hard right on the canvas and centred on
// device, and the Gauge, whose own default range is 0...100, drew a full bar
// for a value the exporter wrote as 0.7%.
//
// `controlFraction` is the single conversion both the fill widths and the
// ring sweeps go through, so these pin it directly. The cross-check that the
// fraction matches what the generator emits lives in export/swiftui.test.js,
// where the real emitted Swift is available to compare against.
// ---------------------------------------------------------------------------
describe('control ranges', () => {
  it('maps a value onto its declared range, not onto 0...1', () => {
    // The bug in one line: 50 in 0...100 is the midpoint, not the far end.
    expect(controlFraction(50, 0, 100)).toBeCloseTo(0.5, 9)
    expect(controlFraction(70, 0, 100)).toBeCloseTo(0.7, 9)
    expect(controlFraction(0, 0, 100)).toBe(0)
    expect(controlFraction(100, 0, 100)).toBe(1)
  })

  it('still behaves for the 0...1 default every template uses', () => {
    expect(controlFraction(0.42, 0, 1)).toBeCloseTo(0.42, 9)
    expect(controlFraction(0.5, undefined, undefined)).toBeCloseTo(0.5, 9)
  })

  it('handles ranges that do not start at zero', () => {
    expect(controlFraction(20, 20, 40)).toBe(0)
    expect(controlFraction(30, 20, 40)).toBeCloseTo(0.5, 9)
    expect(controlFraction(40, 20, 40)).toBe(1)
    // Negative lower bound — a temperature dial, say.
    expect(controlFraction(0, -50, 50)).toBeCloseTo(0.5, 9)
  })

  it('clamps outside the range rather than overflowing the track', () => {
    expect(controlFraction(150, 0, 100)).toBe(1)
    expect(controlFraction(-10, 0, 100)).toBe(0)
  })

  it('reads missing bounds the way the exporter does', () => {
    // Both sides resolve an absent bound as `min ?? 0` / `max ?? 1`, so a
    // half-specified control lands in the same place in both outputs.
    expect(controlFraction(0.25, null, null)).toBeCloseTo(0.25, 9)
    expect(controlFraction(0.25, undefined, 1)).toBeCloseTo(0.25, 9)
  })

  it('draws an empty track for a zero-width or nonsense range', () => {
    // SwiftUI renders a zero-width range empty rather than dividing by zero.
    expect(controlFraction(5, 5, 5)).toBe(0)
    expect(controlFraction(NaN, 0, 100)).toBe(0)
    expect(controlFraction(50, 0, Infinity)).toBe(0)
  })
})

describe('dragging a control writes a value in its own range', () => {
  it('converts a track position back into the declared range', () => {
    expect(valueFromFraction(0.5, 0, 100)).toBeCloseTo(50, 9)
    expect(valueFromFraction(0, 20, 40)).toBeCloseTo(20, 9)
    expect(valueFromFraction(1, 20, 40)).toBeCloseTo(40, 9)
  })

  it('round-trips with controlFraction', () => {
    for (const [lo, hi] of [[0, 1], [0, 100], [20, 40], [-50, 50]]) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        expect(controlFraction(valueFromFraction(t, lo, hi), lo, hi)).toBeCloseTo(t, 9)
      }
    }
  })

  it('snaps to the step when the designer set one', () => {
    // SwiftUI treats step 0 as continuous; anything positive quantises.
    expect(valueFromFraction(0.44, 0, 100, 10)).toBeCloseTo(40, 9)
    expect(valueFromFraction(0.46, 0, 100, 10)).toBeCloseTo(50, 9)
    expect(valueFromFraction(0.44, 0, 100, 0)).toBeCloseTo(44, 9)
    // Steps count from the lower bound, not from zero.
    expect(valueFromFraction(0.5, 5, 25, 10)).toBeCloseTo(15, 9)
  })

  it('never leaves the range, whatever the step', () => {
    for (const t of [0, 0.5, 1]) {
      const v = valueFromFraction(t, 0, 7, 3)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(7)
    }
  })
})

describe('two-stop tint mixing', () => {
  it('returns each end at the ends', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('samples the middle', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('falls back rather than emitting a broken colour', () => {
    expect(mixHex('not-a-colour', '#ffffff', 0.5)).toBe('not-a-colour')
    expect(mixHex(null, null, 0.5)).toBe('#007aff')
  })
})

describe('applyAspectRatio', () => {
  const box = [200, 100]   // 2:1

  it('returns the box untouched when there is no ratio to apply', () => {
    expect(applyAspectRatio(box, null)).toEqual(box)
    expect(applyAspectRatio(box, { ratio: null })).toEqual(box)
    expect(applyAspectRatio(box, { ratio: 2 })).toEqual(box)   // already 2:1
  })

  it('fits inside the box, fills to cover it', () => {
    expect(applyAspectRatio(box, { ratio: 1, contentMode: 'fit' })).toEqual([100, 100])
    expect(applyAspectRatio(box, { ratio: 1, contentMode: 'fill' })).toEqual([200, 200])
  })

  it('handles a box that is too TALL for the ratio, not just too wide', () => {
    const tall = [100, 200]  // 1:2
    expect(applyAspectRatio(tall, { ratio: 1, contentMode: 'fit' })).toEqual([100, 100])
    expect(applyAspectRatio(tall, { ratio: 1, contentMode: 'fill' })).toEqual([200, 200])
  })

  it('defaults to fit, as SwiftUI does', () => {
    expect(applyAspectRatio(box, { ratio: 1 })).toEqual([100, 100])
  })

  it('always produces the ratio it was asked for', () => {
    for (const b of [[200, 100], [100, 200], [137, 41]]) {
      for (const ratio of [0.25, 1, 16 / 9, 4]) {
        for (const contentMode of ['fit', 'fill']) {
          const [w, h] = applyAspectRatio(b, { ratio, contentMode })
          expect(w / h, `${b} -> ${ratio} ${contentMode}`).toBeCloseTo(ratio, 9)
        }
      }
    }
  })

  it('never grows when fitting, never shrinks when filling', () => {
    for (const ratio of [0.5, 1, 3]) {
      const [fw, fh] = applyAspectRatio(box, { ratio, contentMode: 'fit' })
      expect(fw).toBeLessThanOrEqual(box[0] + 1e-9)
      expect(fh).toBeLessThanOrEqual(box[1] + 1e-9)
      const [gw, gh] = applyAspectRatio(box, { ratio, contentMode: 'fill' })
      expect(gw).toBeGreaterThanOrEqual(box[0] - 1e-9)
      expect(gh).toBeGreaterThanOrEqual(box[1] - 1e-9)
    }
  })

  it('refuses a ratio that has no geometry behind it', () => {
    for (const ratio of [0, -1, NaN, Infinity]) {
      expect(applyAspectRatio(box, { ratio })).toEqual(box)
    }
    expect(applyAspectRatio([0, 0], { ratio: 1 })).toEqual([0, 0])
  })
})

// ---------------------------------------------------------------------------
// Form and OutlineGroup rows (AUDIT #6)
//
// Both types exported their row data faithfully — a real `Form { … }` with
// every row, and a generated recursive `OutlineNode` model — while the canvas
// drew an empty plate. So the rows a designer typed into the inspector were
// invisible until export. The row data itself was never the problem; nothing
// read it on the canvas side.
//
// `outlineVisibleRows` is the piece with real logic in it: a collapsed row
// hides everything beneath it, which is easy to get subtly wrong.
// ---------------------------------------------------------------------------
describe('outlineVisibleRows', () => {
  const rows = (...spec) => spec.map(([title, indent, expanded]) => ({ title, indent, expanded }))

  it('shows a flat list whole', () => {
    const out = outlineVisibleRows(rows(['A', 0], ['B', 0], ['C', 0]))
    expect(out.map((r) => r.title)).toEqual(['A', 'B', 'C'])
    expect(out.every((r) => r.isParent === false)).toBe(true)
  })

  it('marks a row as a parent when the next row sits deeper', () => {
    const out = outlineVisibleRows(rows(['A', 0, true], ['A1', 1]))
    expect(out.map((r) => [r.title, r.isParent])).toEqual([['A', true], ['A1', false]])
  })

  it('hides the descendants of a collapsed row', () => {
    const out = outlineVisibleRows(rows(
      ['Documents', 0, false],
      ['Images', 1],
      ['Videos', 1],
      ['Downloads', 0, true],
      ['Recent', 1]
    ))
    expect(out.map((r) => r.title)).toEqual(['Documents', 'Downloads', 'Recent'])
  })

  it('shows them again when it is expanded', () => {
    const out = outlineVisibleRows(rows(
      ['Documents', 0, true],
      ['Images', 1],
      ['Videos', 1]
    ))
    expect(out.map((r) => r.title)).toEqual(['Documents', 'Images', 'Videos'])
  })

  it('hides a whole subtree, not just the first level', () => {
    // The bug this guards: stopping at the immediate children and letting
    // grandchildren reappear underneath a collapsed ancestor.
    const out = outlineVisibleRows(rows(
      ['Root', 0, false],
      ['Child', 1, true],
      ['Grandchild', 2],
      ['Sibling', 0]
    ))
    expect(out.map((r) => r.title)).toEqual(['Root', 'Sibling'])
  })

  it('resumes at the first row back at or above the collapsed level', () => {
    const out = outlineVisibleRows(rows(
      ['A', 0, true],
      ['A1', 1, false],
      ['A1a', 2],
      ['A2', 1],
      ['B', 0]
    ))
    expect(out.map((r) => r.title)).toEqual(['A', 'A1', 'A2', 'B'])
  })

  it('tags each visible row with its nesting level', () => {
    const out = outlineVisibleRows(rows(['A', 0, true], ['A1', 1, true], ['A1a', 2]))
    expect(out.map((r) => r.level)).toEqual([0, 1, 2])
  })

  it('survives rows with nothing on them', () => {
    expect(outlineVisibleRows(undefined)).toEqual([])
    expect(outlineVisibleRows([])).toEqual([])
    expect(outlineVisibleRows([{}]).map((r) => r.level)).toEqual([0])
  })
})

// ---------------------------------------------------------------------------
// Per-type style vocabularies (AUDIT #19)
//
// Thirteen style fields exported correctly and changed nothing on screen. The
// renderer branches on style names as string literals, which is the shape
// that rots quietly: a misspelled case never matches, the canvas keeps its
// default treatment, and nothing fails — the defect reappears in the same
// form it was fixed from. These pin every name the canvas branches on to a
// real case of its own picker.
// ---------------------------------------------------------------------------
describe('style names the canvas branches on are real cases', () => {
  const values = (vocab) => vocab.map((v) => v.value)

  it('every picker style that shows options is a real PickerStyle', () => {
    for (const style of PICKER_STYLES_SHOWING_OPTIONS) {
      expect(values(PICKER_STYLES), `'${style}' is not a picker style`).toContain(style)
    }
  })

  it('leaves the menu-ish picker styles to draw a value and a chevron', () => {
    // A still canvas cannot open a menu, so those styles must NOT be in the
    // set — listing them would draw options the device keeps hidden.
    expect(PICKER_STYLES_SHOWING_OPTIONS).not.toContain('menu')
    expect(PICKER_STYLES_SHOWING_OPTIONS).not.toContain('automatic')
    expect(PICKER_STYLES_SHOWING_OPTIONS).not.toContain('navigationLink')
  })

  it('every menu style that collapses to a button is a real MenuStyle', () => {
    for (const style of MENU_STYLES_AS_BUTTON) {
      expect(values(MENU_STYLES), `'${style}' is not a menu style`).toContain(style)
    }
    // `.automatic` is the open list, so it must not collapse.
    expect(MENU_STYLES_AS_BUTTON).not.toContain('automatic')
  })

  it('accounts for every menu style one way or the other', () => {
    // Nothing in the vocabulary should fall through unconsidered: a style is
    // either the open list or the collapsed button.
    for (const style of values(MENU_STYLES)) {
      const collapses = MENU_STYLES_AS_BUTTON.includes(style)
      expect(typeof collapses, `'${style}' unaccounted for`).toBe('boolean')
    }
    expect(MENU_STYLES_AS_BUTTON.length).toBeGreaterThan(0)
    expect(MENU_STYLES_AS_BUTTON.length).toBeLessThan(values(MENU_STYLES).length)
  })
})

describe('dateComponentsParts', () => {
  it('shows only what each value asks for', () => {
    expect(dateComponentsParts('date')).toEqual({ date: true, time: false, seconds: false })
    expect(dateComponentsParts('hourAndMinute')).toEqual({ date: false, time: true, seconds: false })
    expect(dateComponentsParts('hourMinuteAndSecond')).toEqual({ date: false, time: true, seconds: true })
    expect(dateComponentsParts('dateAndTime')).toEqual({ date: true, time: true, seconds: false })
  })

  it('falls back to the SwiftUI default for anything unrecognised', () => {
    // `displayedComponents:` defaults to `[.date, .hourAndMinute]`.
    for (const v of [undefined, null, '', 'nonsense']) {
      expect(dateComponentsParts(v)).toEqual({ date: true, time: true, seconds: false })
    }
  })

  it('never asks for seconds without a time', () => {
    for (const v of ['date', 'hourAndMinute', 'hourMinuteAndSecond', 'dateAndTime']) {
      const p = dateComponentsParts(v)
      if (p.seconds) expect(p.time, `${v} wants seconds without a time`).toBe(true)
    }
  })

  it('always shows something', () => {
    for (const v of ['date', 'hourAndMinute', 'hourMinuteAndSecond', 'dateAndTime']) {
      const p = dateComponentsParts(v)
      expect(p.date || p.time, `${v} shows nothing at all`).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// The styles bag (AUDIT #31)
//
// Three per-control style fields reached the export only. The renderer
// branches on their case names as string literals — the shape that rots
// quietly — so these pin every name against its real vocabulary, the same
// guard the 1.8 style pickers got.
// ---------------------------------------------------------------------------
describe('the style cases the renderers branch on are real', () => {
  const values = (vocab) => vocab.map((v) => v.value)

  it('labelStyle: iconOnly and titleOnly are real LabelStyles', () => {
    for (const v of ['iconOnly', 'titleOnly', 'titleAndIcon', 'automatic']) {
      expect(values(LABEL_STYLES), `'${v}'`).toContain(v)
    }
  })

  it('toggleStyle: button is a real ToggleStyle', () => {
    expect(values(TOGGLE_STYLES)).toContain('button')
    expect(values(TOGGLE_STYLES)).toContain('switch')
  })

  it('textFieldStyle: plain and roundedBorder are real TextFieldStyles', () => {
    expect(values(TEXTFIELD_STYLES)).toContain('plain')
    expect(values(TEXTFIELD_STYLES)).toContain('roundedBorder')
  })

  it('the styles bag holds only what both sides read', () => {
    // Four fields were removed rather than wired, each a second home for a
    // concept that already had one. A key reappearing here is that
    // duplication coming back.
    expect(Object.keys(DEFAULT_STYLES).sort())
      .toEqual(['labelStyle', 'textFieldStyle', 'toggleStyle'])
  })
})

describe('labelSlots', () => {
  it('shows only the icon for iconOnly, only the title for titleOnly', () => {
    expect(labelSlots('iconOnly', true)).toEqual({ icon: true, title: false })
    expect(labelSlots('titleOnly', true)).toEqual({ icon: false, title: true })
  })

  it('honours iconOnly even when the label HAS text', () => {
    // The case that used to diverge: the canvas drew the text because its
    // only rule was "empty text means icon-only", and the device hid it.
    expect(labelSlots('iconOnly', true).title).toBe(false)
  })

  it('shows both for titleAndIcon, whatever the text', () => {
    expect(labelSlots('titleAndIcon', true)).toEqual({ icon: true, title: true })
    expect(labelSlots('titleAndIcon', false)).toEqual({ icon: true, title: true })
  })

  it('falls back to the empty-text rule for automatic', () => {
    expect(labelSlots('automatic', true)).toEqual({ icon: true, title: true })
    expect(labelSlots('automatic', false)).toEqual({ icon: true, title: false })
    expect(labelSlots(undefined, false)).toEqual({ icon: true, title: false })
  })

  it('never hides both slots', () => {
    for (const style of ['automatic', 'iconOnly', 'titleOnly', 'titleAndIcon', undefined]) {
      for (const hasText of [true, false]) {
        const s = labelSlots(style, hasText)
        expect(s.icon || s.title, `${style}/${hasText} draws nothing`).toBe(true)
      }
    }
  })
})
