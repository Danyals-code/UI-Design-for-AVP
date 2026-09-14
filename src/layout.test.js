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
  computeSize, layoutStack, resolvedChildSizes, gridColumnCount, SYSTEM_SPACING_PT,
  scrollAxesOf
} from './layout'
import { ptToUnits } from './appleSystem'
import { makeStack, makePanel, makeTab, makeWindow, textStyleToFontSize } from './store/factories'
import { TEMPLATES } from './templates'
import { exportSwiftUI } from './export/swiftui'

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

// ---------------------------------------------------------------------------
// Scrolling (AUDIT #4)
//
// A scrollable stack used to draw a decorative bar and nothing else: its
// content was laid out around the box's CENTRE, so an overflowing stack was
// clipped at both ends at once and its first screenful sat above the top
// edge, unreachable. The `settings` and `article` templates both ship that
// way, which made it the most visible "this is broken" moment in the app.
//
// Two properties are pinned here. The first is the layout half of the fix:
// a scroller anchors its content to the leading edge of the axis it scrolls.
// The second is the agreement that matters - the canvas must scroll exactly
// the views the exporter wraps in a ScrollView, checked against what the
// generator actually emits rather than against the list `scrollAxesOf` is
// built from, since comparing a predicate to its own source is a tautology
// that would not catch the two drifting apart.
// ---------------------------------------------------------------------------
describe('scrolling', () => {
  // A column of `rows` fixed-height rows inside a viewport of `viewportPt`,
  // so the content overflows by a known amount.
  const column = (stackOverrides, { rows = 6, rowPt = 100, viewportPt = 300 } = {}) => {
    const col = makeStack({
      stackType: 'vstack', padding: 0, spacing: 0,
      heightMode: 'fixed', fixedHeight: viewportPt,
      widthMode: 'fixed', fixedWidth: 200,
      ...stackOverrides
    })
    const kids = Array.from({ length: rows }, () =>
      makePanel('rectangle', { parentId: col.id, size: [ptToUnits(200), ptToUnits(rowPt)] }))
    return { col, items: [col, ...kids], kids }
  }

  it('anchors an overflowing scroller to the top, not the centre', () => {
    const { col, items, kids } = column({ scrollable: true })
    const [, h] = computeSize(col, items)
    const firstTop = layoutStack(col, items).get(kids[0].id)[1] + ptToUnits(100) / 2
    // The first row's top edge sits at the viewport's top edge.
    expect(firstTop).toBeCloseTo(h / 2, 9)
  })

  it('still centres a stack that does not scroll', () => {
    const { col, items, kids } = column({ scrollable: false })
    const [, h] = computeSize(col, items)
    const firstTop = layoutStack(col, items).get(kids[0].id)[1] + ptToUnits(100) / 2
    // 600pt of content in a 300pt box, centred: the top overhangs by 150pt.
    expect(firstTop).toBeCloseTo(h / 2 + ptToUnits(150), 9)
    expect(firstTop).toBeGreaterThan(h / 2)
  })

  it('leaves the overflow reachable below the box, not above it', () => {
    const { col, items, kids } = column({ scrollable: true })
    const [, h] = computeSize(col, items)
    const lastBottom = layoutStack(col, items).get(kids[5].id)[1] - ptToUnits(100) / 2
    // 600pt of content measured down from the viewport top edge.
    expect(h / 2 - lastBottom).toBeCloseTo(ptToUnits(600), 9)
  })

  it('reads the declared axis literally, as the exporter does', () => {
    expect(scrollAxesOf(makeStack({ scrollable: true, scrollAxis: 'vertical' })))
      .toEqual({ vertical: true, horizontal: false })
    expect(scrollAxesOf(makeStack({ scrollable: true, scrollAxis: 'horizontal' })))
      .toEqual({ vertical: false, horizontal: true })
    expect(scrollAxesOf(makeStack({ scrollable: true, scrollAxis: 'both' })))
      .toEqual({ vertical: true, horizontal: true })
  })

  it('leading-anchors a horizontal scroller', () => {
    const row = makeStack({
      stackType: 'hstack', padding: 0, spacing: 0,
      scrollable: true, scrollAxis: 'horizontal',
      widthMode: 'fixed', fixedWidth: 300, heightMode: 'fixed', fixedHeight: 100
    })
    const kids = Array.from({ length: 6 }, () =>
      makePanel('rectangle', { parentId: row.id, size: [ptToUnits(100), ptToUnits(100)] }))
    const items = [row, ...kids]
    const [w] = computeSize(row, items)
    const firstLeft = layoutStack(row, items).get(kids[0].id)[0] - ptToUnits(100) / 2
    expect(firstLeft).toBeCloseTo(-w / 2, 9)
  })

  it('scrolls a scrollView stack without the flag being set', () => {
    expect(scrollAxesOf(makeStack({ stackType: 'scrollView' })).vertical).toBe(true)
  })

  it('never scrolls a container that brings its own scrolling', () => {
    // Each of these returns early in the exporter's renderStack and never
    // receives a ScrollView wrapper, so the canvas must not scroll it either.
    for (const stackType of ['section', 'disclosure', 'tab', 'toolbar', 'toolbarItem', 'toolbarItemGroup']) {
      const s = makeStack({ stackType, scrollable: true })
      expect(scrollAxesOf(s), `${stackType} should not scroll`)
        .toEqual({ vertical: false, horizontal: false })
    }
    const split = makeStack({ stackType: 'vstack', scrollable: true, splitStyle: 'joined' })
    expect(scrollAxesOf(split)).toEqual({ vertical: false, horizontal: false })
  })

  it('scrolls exactly the stacks the exporter wraps in a ScrollView', () => {
    // The agreement the audit is about, measured against the generator's
    // real output rather than against a mirrored list.
    for (const stackType of [
      'vstack', 'hstack', 'zstack', 'lazyvstack', 'lazyhstack', 'scrollView',
      'section', 'disclosure', 'tab', 'toolbar', 'toolbarItem', 'toolbarItemGroup',
      'grid', 'lazyVGrid', 'lazyHGrid', 'navigationStack', 'tabView', 'viewThatFits'
    ]) {
      const tab = makeTab({ name: 'T' })
      const win = makeWindow({ name: 'W', parentId: tab.id })
      const stack = makeStack({ stackType, parentId: win.id, scrollable: true, name: 'S' })
      const kid = makePanel('rectangle', { parentId: stack.id, size: [ptToUnits(50), ptToUnits(50)] })
      const swift = exportSwiftUI([tab, win, stack, kid], 'App', {}).map((f) => f.content).join('\n')
      const axes = scrollAxesOf(stack)
      expect(axes.vertical || axes.horizontal,
        `${stackType}: canvas scrolls=${axes.vertical || axes.horizontal} but ` +
        `export emits ScrollView=${swift.includes('ScrollView')}`
      ).toBe(swift.includes('ScrollView'))
    }
  })

  it('brings the title of the shipped scrolling templates back on screen', () => {
    // The regression in user terms: loading `settings` used to drop you
    // mid-page with the page title clipped off the top of the window.
    for (const key of ['settings', 'article']) {
      const { items } = TEMPLATES[key].build()
      const win = items.find((i) => i.type === 'window')
      const root = items.find((i) => i.parentId === win.id && i.scrollable)
      expect(root, `${key} no longer has a scrollable root`).toBeTruthy()

      // The window resolves a fill-mode child to its inner box, which is the
      // viewport the stack actually renders at.
      const padU = ptToUnits(win.padding ?? 14)
      const viewport = [win.size[0] - padU * 2, win.size[1] - padU * 2]
      const pos = layoutStack(root, items, viewport)
      const sizes = resolvedChildSizes(root, items, viewport)
      const kids = childrenOf(root, items)
      const tops = kids.map((c) => pos.get(c.id)[1] + sizes.get(c.id)[1] / 2)
      const highest = Math.max(...tops)

      // Nothing starts above the viewport's top edge any more.
      expect(highest, `${key}: content still overhangs the top of the window`)
        .toBeLessThanOrEqual(viewport[1] / 2 + EPS)
      // And it really does overflow, or the template would not be testing
      // anything - the content is taller than the box it sits in.
      const lowest = Math.min(...kids.map((c) => pos.get(c.id)[1] - sizes.get(c.id)[1] / 2))
      expect(highest - lowest).toBeGreaterThan(viewport[1])
    }
  })
})

// ---------------------------------------------------------------------------
// Modifiers that move the layout (AUDIT #5, #15)
//
// Most of the seventeen inert modifiers were renderer-only work — a mesh that
// was never drawn. Two of them change the geometry itself, so they land in the
// layout engine and have to be pinned here: `.aspectRatio` reshapes a frame,
// and `.layoutPriority` decides who gets a stack's slack.
//
// `.layoutPriority` is the sharper of the two. It wrote nothing into the
// modifier summary at all, which made it a no-op on BOTH sides — it emitted
// real Swift and changed neither the canvas nor the layout engine.
// ---------------------------------------------------------------------------
describe('aspectRatio reshapes the frame', () => {
  const boxWith = (mods) => {
    const p = makePanel('rectangle', { size: [ptToUnits(200), ptToUnits(100)], modifiers: mods })
    return computeSize(p, [p])
  }
  const mod = (args) => [{ id: 'm1', type: 'aspectRatio', ...args }]

  it('leaves a box alone when no ratio is set', () => {
    expect(boxWith([])).toEqual([ptToUnits(200), ptToUnits(100)])
    expect(boxWith(mod({ ratio: null, contentMode: 'fit' }))).toEqual([ptToUnits(200), ptToUnits(100)])
  })

  it('fit shrinks the box inside its proposal', () => {
    // 200x100 is 2:1. Asking for 1:1 with .fit keeps the height and narrows
    // the width — the result fits inside the original.
    const [w, h] = boxWith(mod({ ratio: 1, contentMode: 'fit' }))
    expect(w).toBeCloseTo(ptToUnits(100), 9)
    expect(h).toBeCloseTo(ptToUnits(100), 9)
    expect(w).toBeLessThanOrEqual(ptToUnits(200))
  })

  it('fill grows the box to cover its proposal', () => {
    const [w, h] = boxWith(mod({ ratio: 1, contentMode: 'fill' }))
    expect(w).toBeCloseTo(ptToUnits(200), 9)
    expect(h).toBeCloseTo(ptToUnits(200), 9)
    expect(h).toBeGreaterThanOrEqual(ptToUnits(100))
  })

  it('produces a frame at the ratio it was given', () => {
    for (const ratio of [0.5, 1, 16 / 9, 3]) {
      for (const contentMode of ['fit', 'fill']) {
        const [w, h] = boxWith(mod({ ratio, contentMode }))
        expect(w / h, `${ratio} ${contentMode}`).toBeCloseTo(ratio, 6)
      }
    }
  })

  it('ignores a ratio that is not a usable number', () => {
    for (const ratio of [0, -2, NaN]) {
      expect(boxWith(mod({ ratio, contentMode: 'fit' }))).toEqual([ptToUnits(200), ptToUnits(100)])
    }
  })
})

describe('layoutPriority decides who gets the slack', () => {
  // A fixed-height column of [Spacer, row, Spacer]. Where the row ends up is
  // the observable consequence of who absorbed the slack: if the top Spacer
  // takes it all, the row is pushed to the bottom, and vice versa.
  //
  // Measured through `layoutStack` rather than `resolvedChildSizes` because a
  // Spacer has no size of its own — the expansion shows up as position.
  const column = (priorities) => {
    const col = makeStack({
      stackType: 'vstack', padding: 0, spacing: 0,
      heightMode: 'fixed', fixedHeight: 300, widthMode: 'fixed', fixedWidth: 100
    })
    const spacer = (v, i) => makePanel('spacer', {
      parentId: col.id,
      isSpacer: true,
      modifiers: v == null ? [] : [{ id: `lp${i}`, type: 'layoutPriority', value: v }]
    })
    const top = spacer(priorities[0], 0)
    const row = makePanel('rectangle', { parentId: col.id, size: [ptToUnits(100), ptToUnits(100)] })
    const bottom = spacer(priorities[1], 1)
    return { col, row, items: [col, top, row, bottom] }
  }
  const rowY = (priorities) => {
    const { col, row, items } = column(priorities)
    return layoutStack(col, items, computeSize(col, items)).get(row.id)[1]
  }

  it('splits it evenly when nobody asks for more', () => {
    // 300pt box, 100pt row, 200pt of slack halved: the row lands centred.
    expect(rowY([null, null])).toBeCloseTo(0, 9)
  })

  it('gives it all to the higher priority, and collapses the loser', () => {
    // The top Spacer absorbs all 200pt, so the row is pushed to the bottom.
    expect(rowY([1, null])).toBeCloseTo(-ptToUnits(100), 9)
    // ...and the mirror.
    expect(rowY([null, 1])).toBeCloseTo(ptToUnits(100), 9)
  })

  it('splits evenly again between equals, whatever the level', () => {
    expect(rowY([2, 2])).toBeCloseTo(0, 9)
    expect(rowY([-1, -1])).toBeCloseTo(0, 9)
  })

  it('treats a higher number as higher priority, as SwiftUI does', () => {
    expect(rowY([2, 1])).toBeCloseTo(-ptToUnits(100), 9)
    expect(rowY([1, 2])).toBeCloseTo(ptToUnits(100), 9)
  })

  it('keeps every child inside the box it was given', () => {
    // The allocation runs in `layoutStack` and `resolvedChildSizes` alike, so
    // the space one reserves is the space the other draws into. The suite's
    // agreement tests cover that across every template; this pins the
    // priority path specifically.
    const { col, items } = column([1, null])
    const outer = computeSize(col, items)
    const pos = layoutStack(col, items, outer)
    const sizes = resolvedChildSizes(col, items, outer)
    for (const kid of childrenOf(col, items)) {
      const p = pos.get(kid.id)
      const sz = sizes.get(kid.id)
      expect(p, `${kid.name} positioned`).toBeTruthy()
      expect(sz, `${kid.name} sized`).toBeTruthy()
      expect(p[1] + sz[1] / 2).toBeLessThanOrEqual(outer[1] / 2 + EPS)
      expect(p[1] - sz[1] / 2).toBeGreaterThanOrEqual(-outer[1] / 2 - EPS)
    }
  })
})
