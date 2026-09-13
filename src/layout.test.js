// Stack layout engine.
//
// The load-bearing property here is agreement between two code paths that
// deliberately duplicate each other:
//
//   • `layoutStack` decides WHERE each child sits
//   • `resolvedChildSizes` decides HOW BIG the renderer draws it
//
// Both re-run the text measurement pipeline, and the source comments say in
// so many words that they must not drift. Nothing enforced that until now.
//
// Rather than reimplementing the positioning maths in the test - which would
// just reproduce any bug it contains - these tests assert the observable
// consequences of agreement: siblings laid out with the sizes the renderer
// uses must not overlap, and must stay inside the parent. If one path
// measures a wrapped Text as one line tall while the other measures three,
// the boxes collide and these fail.

import { describe, it, expect } from 'vitest'
import {
  computeSize, layoutStack, resolvedChildSizes, gridColumnCount, SYSTEM_SPACING_PT
} from './layout'
import { ptToUnits } from './appleSystem'
import { makeStack, makePanel, textStyleToFontSize } from './store/factories'
import { TEMPLATES } from './templates'

const EPS = 1e-6

// Every stack across every template, paired with its items array.
function allStacks() {
  const out = []
  for (const [key, t] of Object.entries(TEMPLATES)) {
    const { items } = t.build()
    for (const it of items) {
      if (it.type === 'stack') out.push({ key, stack: it, items })
    }
  }
  return out
}

const childrenOf = (stack, items) =>
  items.filter((c) => c.parentId === stack.id && c.visible !== false)

describe('computeSize', () => {
  it('is pure - the same item measures the same twice', () => {
    for (const { stack, items } of allStacks().slice(0, 60)) {
      const a = computeSize(stack, items)
      const b = computeSize(stack, items)
      expect(a).toEqual(b)
    }
  })

  it('returns finite, non-negative dimensions for every item in every template', () => {
    for (const [key, t] of Object.entries(TEMPLATES)) {
      const { items } = t.build()
      for (const it of items) {
        if (it.type === 'entity' || it.type === 'tab') continue
        const [w, h] = computeSize(it, items)
        expect(Number.isFinite(w), `${key}/${it.name} width is not finite`).toBe(true)
        expect(Number.isFinite(h), `${key}/${it.name} height is not finite`).toBe(true)
        expect(w, `${key}/${it.name} width is negative`).toBeGreaterThanOrEqual(0)
        expect(h, `${key}/${it.name} height is negative`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('honours an explicit fixed frame', () => {
    const s = makeStack({
      stackType: 'vstack', widthMode: 'fixed', heightMode: 'fixed',
      fixedWidth: 300, fixedHeight: 200, padding: 0
    })
    expect(computeSize(s, [s])).toEqual([ptToUnits(300), ptToUnits(200)])
  })

  it('grows a VStack with each child it gains', () => {
    const s = makeStack({ stackType: 'vstack', padding: 0, spacing: 0 })
    const one = makePanel('rectangle', { parentId: s.id })
    const two = makePanel('rectangle', { parentId: s.id })
    const withOne = computeSize(s, [s, one])[1]
    const withTwo = computeSize(s, [s, one, two])[1]
    expect(withTwo).toBeGreaterThan(withOne)
  })

  it('grows an HStack horizontally, not vertically', () => {
    const s = makeStack({ stackType: 'hstack', padding: 0, spacing: 0 })
    const one = makePanel('rectangle', { parentId: s.id })
    const two = makePanel('rectangle', { parentId: s.id })
    const [w1, h1] = computeSize(s, [s, one])
    const [w2, h2] = computeSize(s, [s, one, two])
    expect(w2).toBeGreaterThan(w1)
    expect(h2).toBeCloseTo(h1, 10)
  })

  it('counts padding on both edges', () => {
    const bare = makeStack({ stackType: 'vstack', padding: 0 })
    const padded = makeStack({ stackType: 'vstack', padding: 20 })
    const kidA = makePanel('rectangle', { parentId: bare.id })
    const kidB = makePanel('rectangle', { parentId: padded.id })
    const [, hb] = computeSize(bare, [bare, kidA])
    const [, hp] = computeSize(padded, [padded, kidB])
    expect(hp - hb).toBeCloseTo(ptToUnits(40), 9)
  })

  it('reserves more height for a wrapped Text than a short one', () => {
    // The whole point of threading the wrap bound through: a long string in a
    // narrow fixed-width column has to reserve every line it will render.
    const col = makeStack({
      stackType: 'vstack', padding: 0, spacing: 0,
      widthMode: 'fixed', fixedWidth: 140
    })
    const short = makePanel('text', {
      parentId: col.id, text: 'Hi', textStyle: 'body',
      fontSize: textStyleToFontSize('body'), widthMode: 'fill'
    })
    const long = makePanel('text', {
      parentId: col.id, text: 'A considerably longer sentence that has to wrap across several lines in a narrow column',
      textStyle: 'body', fontSize: textStyleToFontSize('body'), widthMode: 'fill'
    })
    const hShort = computeSize(col, [col, short])[1]
    const hLong = computeSize(col, [col, long])[1]
    expect(hLong).toBeGreaterThan(hShort * 2)
  })
})

describe('gridColumnCount', () => {
  it('uses the declared count in fixed mode', () => {
    expect(gridColumnCount({ gridMode: 'fixed', columns: 3 }, ptToUnits(600), 0)).toBe(3)
  })

  it('derives the count from the available width in adaptive mode', () => {
    const s = { gridMode: 'adaptive', minColumnWidth: 100, columns: 2 }
    const wide = gridColumnCount(s, ptToUnits(620), 0)
    const narrow = gridColumnCount(s, ptToUnits(220), 0)
    expect(wide).toBeGreaterThan(narrow)
    expect(narrow).toBeGreaterThanOrEqual(1)
  })

  it('falls back to the declared count when no width is known yet', () => {
    expect(gridColumnCount({ gridMode: 'adaptive', columns: 4, minColumnWidth: 100 }, null, 0)).toBe(4)
  })

  it('never returns zero columns', () => {
    // A minimum wider than the whole row still has to place one column.
    expect(gridColumnCount({ gridMode: 'adaptive', minColumnWidth: 9999 }, ptToUnits(10), 0)).toBe(1)
    // A meaningless count is treated as unset and falls back to the default
    // of 2, matching the `stack.columns || 2` default used elsewhere.
    expect(gridColumnCount({ gridMode: 'fixed', columns: 0 }, ptToUnits(400), 0)).toBe(2)
    expect(gridColumnCount({ gridMode: 'fixed' }, ptToUnits(400), 0)).toBe(2)
  })
})

describe('layoutStack positions every visible child', () => {
  it('returns a finite position for each child it lays out', () => {
    for (const { key, stack, items } of allStacks()) {
      const pos = layoutStack(stack, items)
      for (const [id, p] of pos) {
        expect(Array.isArray(p), `${key}/${id} position is not a triple`).toBe(true)
        for (const n of p) {
          expect(Number.isFinite(n), `${key}/${id} has a non-finite coordinate`).toBe(true)
        }
      }
    }
  })

  it('lays out only the active child of a TabView', () => {
    const tv = makeStack({ stackType: 'tabView', activeTab: 1 })
    const t1 = makeStack({ parentId: tv.id, stackType: 'tab' })
    const t2 = makeStack({ parentId: tv.id, stackType: 'tab' })
    const pos = layoutStack(tv, [tv, t1, t2])
    expect(pos.has(t2.id)).toBe(true)
    expect(pos.has(t1.id)).toBe(false)
  })

  it('lays out nothing for a collapsed DisclosureGroup', () => {
    const d = makeStack({ stackType: 'disclosure', expanded: false })
    const kid = makePanel('text', { parentId: d.id, text: 'hidden' })
    expect(layoutStack(d, [d, kid]).size).toBe(0)
  })

  it('skips children marked invisible', () => {
    const s = makeStack({ stackType: 'vstack' })
    const shown = makePanel('rectangle', { parentId: s.id })
    const hidden = makePanel('rectangle', { parentId: s.id, visible: false })
    const pos = layoutStack(s, [s, shown, hidden])
    expect(pos.has(shown.id)).toBe(true)
    expect(pos.has(hidden.id)).toBe(false)
  })
})

// The drift test. Siblings are placed by one code path and sized by another;
// if the two disagree about a child's extent, the boxes overlap.
describe('layoutStack and resolvedChildSizes agree', () => {
  const LINEAR = new Set(['vstack', 'lazyvstack', 'hstack', 'lazyhstack'])

  const candidates = () => allStacks().filter(({ stack, items }) => {
    if (!LINEAR.has(stack.stackType)) return false
    if (stack.splitStyle) return false                 // slot layout, own rules
    const kids = childrenOf(stack, items)
    if (kids.length < 2) return false
    // Slot-tagged children route through the NavigationSplitView branch.
    if (kids.some((c) => c.slot === 'sidebar' || c.slot === 'detail')) return false
    return true
  })

  it('has stacks to check', () => {
    expect(candidates().length).toBeGreaterThan(20)
  })

  it('never overlaps two siblings along the stack axis', () => {
    for (const { key, stack, items } of candidates()) {
      const outer = computeSize(stack, items)
      const pos = layoutStack(stack, items, outer)
      const sizes = resolvedChildSizes(stack, items, outer)
      const kids = childrenOf(stack, items).filter((c) => pos.has(c.id))
      const vertical = stack.stackType === 'vstack' || stack.stackType === 'lazyvstack'
      const axis = vertical ? 1 : 0

      // Order children along the axis, then check each pair's boxes.
      const boxes = kids.map((c) => {
        const p = pos.get(c.id)
        const s = sizes.get(c.id) || computeSize(c, items)
        const centre = p[axis]
        const extent = s[axis] ?? 0
        return { name: c.name, lo: centre - extent / 2, hi: centre + extent / 2 }
      }).sort((a, b) => a.lo - b.lo)

      for (let i = 0; i + 1 < boxes.length; i++) {
        const a = boxes[i]
        const b = boxes[i + 1]
        expect(
          b.lo - a.hi,
          `${key}/${stack.name}: "${a.name}" and "${b.name}" overlap by ` +
          `${((a.hi - b.lo) * 1360).toFixed(1)}pt - the positioning and sizing ` +
          `paths disagree about an extent`
        ).toBeGreaterThanOrEqual(-EPS)
      }
    }
  })

  it('keeps every child inside its parent along the stack axis', () => {
    for (const { key, stack, items } of candidates()) {
      if (stack.scrollable) continue           // content may exceed the frame
      const outer = computeSize(stack, items)
      const pos = layoutStack(stack, items, outer)
      const sizes = resolvedChildSizes(stack, items, outer)
      const vertical = stack.stackType === 'vstack' || stack.stackType === 'lazyvstack'
      const axis = vertical ? 1 : 0
      const pad = ptToUnits(stack.padding ?? 0)
      const half = outer[axis] / 2 - pad
      // Asymmetric padding shifts the content band; allow the full pad as slack.
      const slack = ptToUnits(stack.padding ?? 0) + EPS

      for (const c of childrenOf(stack, items)) {
        const p = pos.get(c.id)
        if (!p) continue
        const s = sizes.get(c.id) || computeSize(c, items)
        const lo = p[axis] - (s[axis] ?? 0) / 2
        const hi = p[axis] + (s[axis] ?? 0) / 2
        expect(hi, `${key}/${stack.name}: "${c.name}" overflows the top/right edge`)
          .toBeLessThanOrEqual(half + slack)
        expect(lo, `${key}/${stack.name}: "${c.name}" overflows the bottom/left edge`)
          .toBeGreaterThanOrEqual(-half - slack)
      }
    }
  })

  it('sizes every positioned child', () => {
    for (const { key, stack, items } of allStacks()) {
      const outer = computeSize(stack, items)
      const pos = layoutStack(stack, items, outer)
      const sizes = resolvedChildSizes(stack, items, outer)
      for (const id of pos.keys()) {
        expect(sizes.has(id), `${key}/${stack.name}: child ${id} is positioned but unsized`).toBe(true)
      }
    }
  })
})

describe('fill and spacer expansion', () => {
  it('stretches a fill-width Text to the parent inner width', () => {
    const col = makeStack({
      stackType: 'vstack', padding: 20, spacing: 0,
      widthMode: 'fixed', fixedWidth: 400
    })
    const txt = makePanel('text', {
      parentId: col.id, text: 'Fill me', widthMode: 'fill',
      textStyle: 'body', fontSize: textStyleToFontSize('body')
    })
    const items = [col, txt]
    const outer = computeSize(col, items)
    const sizes = resolvedChildSizes(col, items, outer)
    expect(sizes.get(txt.id)[0]).toBeCloseTo(ptToUnits(400 - 40), 9)
  })

  it('gives a spacer the leftover main-axis space', () => {
    const row = makeStack({
      stackType: 'hstack', padding: 0, spacing: 0,
      widthMode: 'fixed', fixedWidth: 400, heightMode: 'fixed', fixedHeight: 60
    })
    const a = makePanel('rectangle', { parentId: row.id, size: [ptToUnits(100), ptToUnits(40)] })
    const sp = makePanel('spacer', { parentId: row.id })
    const b = makePanel('rectangle', { parentId: row.id, size: [ptToUnits(100), ptToUnits(40)] })
    const items = [row, a, sp, b]
    const pos = layoutStack(row, items, computeSize(row, items))
    // With the spacer absorbing the slack, the two rectangles sit at opposite
    // ends of the row rather than side by side in the middle.
    const gap = pos.get(b.id)[0] - pos.get(a.id)[0]
    expect(gap).toBeCloseTo(ptToUnits(300), 6)
  })

  it('splits leftover space evenly between two spacers', () => {
    const row = makeStack({
      stackType: 'hstack', padding: 0, spacing: 0,
      widthMode: 'fixed', fixedWidth: 400
    })
    const sp1 = makePanel('spacer', { parentId: row.id })
    const mid = makePanel('rectangle', { parentId: row.id, size: [ptToUnits(100), ptToUnits(40)] })
    const sp2 = makePanel('spacer', { parentId: row.id })
    const items = [row, sp1, mid, sp2]
    const pos = layoutStack(row, items, computeSize(row, items))
    // Equal spacers centre the middle child.
    expect(pos.get(mid.id)[0]).toBeCloseTo(0, 6)
  })
})

describe('alignment', () => {
  const rowWith = (alignment) => {
    const col = makeStack({
      stackType: 'vstack', padding: 0, spacing: 0, alignment,
      widthMode: 'fixed', fixedWidth: 400
    })
    const kid = makePanel('rectangle', { parentId: col.id, size: [ptToUnits(100), ptToUnits(40)] })
    const items = [col, kid]
    return layoutStack(col, items, computeSize(col, items)).get(kid.id)[0]
  }

  it('puts a leading child left of a centred one, and trailing right', () => {
    const leading = rowWith('leading')
    const centre = rowWith('center')
    const trailing = rowWith('trailing')
    expect(leading).toBeLessThan(centre)
    expect(centre).toBeLessThan(trailing)
    expect(centre).toBeCloseTo(0, 9)
    // Mirrored about the centre line.
    expect(leading).toBeCloseTo(-trailing, 9)
  })
})

describe('spacing', () => {
  it('leaves the configured gap between siblings', () => {
    const col = makeStack({ stackType: 'vstack', padding: 0, spacing: 24 })
    const a = makePanel('rectangle', { parentId: col.id, size: [ptToUnits(50), ptToUnits(40)] })
    const b = makePanel('rectangle', { parentId: col.id, size: [ptToUnits(50), ptToUnits(40)] })
    const items = [col, a, b]
    const pos = layoutStack(col, items, computeSize(col, items))
    const delta = pos.get(a.id)[1] - pos.get(b.id)[1]
    expect(delta).toBeCloseTo(ptToUnits(40 + 24), 9)
  })

  it('falls back to the system gap when spacing is null', () => {
    const col = makeStack({ stackType: 'vstack', padding: 0, spacing: null })
    const a = makePanel('rectangle', { parentId: col.id, size: [ptToUnits(50), ptToUnits(40)] })
    const b = makePanel('rectangle', { parentId: col.id, size: [ptToUnits(50), ptToUnits(40)] })
    const items = [col, a, b]
    const pos = layoutStack(col, items, computeSize(col, items))
    const delta = pos.get(a.id)[1] - pos.get(b.id)[1]
    expect(delta).toBeCloseTo(ptToUnits(40 + SYSTEM_SPACING_PT), 9)
  })
})
