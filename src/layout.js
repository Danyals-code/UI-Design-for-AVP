// Stack layout engine — mirrors SwiftUI's VStack/HStack/ZStack/Grid/Section/
// DisclosureGroup/NavigationStack semantics. Given a stack item and its children,
// returns a map of { childId -> [x, y, z] } in local coordinates.

import {
  ptToUnits, computeListHeightPt, computeButtonFramePt, TEXT_STYLES, textStyleDefaultWeight,
  applyAspectRatio, toolbarZoneOf
} from './appleSystem'
import { summarizeModifiers } from './modifiers/registry'
import { measureSwiftUIText, singleLineWidth } from './text'

// Pulls the text-relevant inputs off a panel + its summarized modifiers
// in scene-unit form. Centralised so layout.js and Panel3D.jsx feed
// `measureSwiftUIText` the same numbers — what's reserved must match
// what's rendered.
export function textMetrics(item, modSummary) {
  const fontSize = item.textStyle
    ? ptToUnits(TEXT_STYLES[item.textStyle]?.pt ?? 17)
    : (item.fontSize || ptToUnits(17))
  // Weight feeds the measurer: a bold heading is materially wider than the
  // same string at regular, so measuring everything as regular under-reserves
  // space and the canvas wraps a line later than the device. An explicit
  // `fontWeight` on the item wins; otherwise the text style's own default
  // applies (visionOS body resolves to medium, titles to bold).
  const fontWeight = item.fontWeight
    || (item.textStyle ? textStyleDefaultWeight(item.textStyle) : 'regular')
  // tracking + kerning both widen inter-character space in SwiftUI;
  // they're additive in the layout too so measurement matches render.
  const trackingPt    = (modSummary?.tracking || 0) + (modSummary?.kerning || 0)
  const lineSpacingPt = modSummary?.lineSpacing || 0
  const lineLimit     = modSummary?.lineLimit ?? null
  const truncationMode = modSummary?.truncationMode || 'tail'
  const minimumScaleFactor = modSummary?.minimumScaleFactor ?? 1
  const allowsTightening   = !!modSummary?.allowsTightening
  const fixedSizeH = !!modSummary?.fixedSizeH
  const fixedSizeV = !!modSummary?.fixedSizeV
  return {
    fontSize, fontWeight, trackingPt, lineSpacingPt, lineLimit, truncationMode,
    minimumScaleFactor, allowsTightening, fixedSizeH, fixedSizeV
  }
}

// SwiftUI's default `spacing: nil` resolves at runtime to a small,
// context-dependent gap. visionOS hovers around ~8 pt for typical body
// content. We use this constant in the canvas so a stack with a null
// `spacing` field previews close to what the simulator renders, while the
// SwiftUI exporter still elides the `spacing:` argument so the device
// keeps its system-adaptive value.
export const SYSTEM_SPACING_PT = 8

// Resolve a stack's `spacing` field for layout: explicit numbers win,
// `null`/`undefined` fall back to the visionOS-approximated default.
const stackSpacing = (s) =>
  ptToUnits(typeof s === 'number' ? s : SYSTEM_SPACING_PT)

// ---- padding helpers ----

// Per-edge padding in scene units, with the uniform `padding` as the
// fallback. Exported because the renderer needs the same four numbers to
// size a scroller's viewport, and a second copy of the `paddingEdges ??
// padding` fallback is exactly the kind of drift this codebase keeps
// finding.
export function resolvePadding(item) {
  if (item.paddingEdges) {
    const e = item.paddingEdges
    return {
      top:      ptToUnits(e.top ?? 0),
      bottom:   ptToUnits(e.bottom ?? 0),
      leading:  ptToUnits(e.leading ?? 0),
      trailing: ptToUnits(e.trailing ?? 0)
    }
  }
  const p = ptToUnits(item.padding ?? 0)
  return { top: p, bottom: p, leading: p, trailing: p }
}

// ---- layout priority (AUDIT #15) ------------------------------------------
//
// SwiftUI: "a view with a higher layout priority is allocated space before
// views with lower priority". Among the children that want to grow — Spacers
// and fill-axis stacks — the highest priority present takes the slack and the
// rest fall back to their intrinsic size. That is what happens on device when
// one of two Spacers carries `.layoutPriority(1)`: it absorbs the gap and the
// other collapses.
//
// `.layoutPriority` wrote nothing into the modifier summary until phase 1.1,
// so it emitted real Swift and changed neither side's layout — a no-op on
// BOTH. This is the one consumer, shared by `layoutStack` and
// `resolvedChildSizes` so the space one reserves is the space the other draws.
function layoutPriorityOf(item) {
  const mod = summarizeModifiers(item?.modifiers)
  return mod.layoutPriority ?? 0
}

// Who receives the slack on this axis, and how much each gets.
function resolveFlex(children, isFlex, remaining) {
  const flex = children.filter(isFlex)
  if (flex.length === 0) return { share: 0, takesSlack: () => false }
  const top = Math.max(...flex.map(layoutPriorityOf))
  const winners = flex.filter((c) => layoutPriorityOf(c) === top)
  const ids = new Set(winners.map((c) => c.id))
  return { share: remaining / winners.length, takesSlack: (c) => ids.has(c.id) }
}

function padW(pad) { return pad.leading + pad.trailing }
function padH(pad) { return pad.top + pad.bottom }

// Container types that bring their own scrolling semantics. Each one returns
// early in the exporter's `renderStack` and never gets a ScrollView wrapper,
// so none of them scrolls on the canvas either — the two sides have to agree
// about WHICH views scroll before they can agree about how far.
const SELF_SCROLLING_STACK_TYPES = new Set([
  'toolbar', 'toolbarItem', 'toolbarItemGroup', 'tab', 'section', 'disclosure'
])

// `.environment(\.layoutDirection, .rightToLeft)` mirrors leading and
// trailing. The canvas previews it on the container that declares it — the
// bulk of what a designer is checking when they flip to RTL — while SwiftUI
// inherits the value further down the tree than this mirrors. The limit is
// recorded in `parity.baseline.js` rather than left for someone to discover.
//
// The whole Environment section was editable in the inspector and read by
// NOBODY until phase 1.5; the other four values are export-only by nature.
// AUDIT #13.
export function mirroredAlignment(alignment, environment) {
  if (environment?.layoutDirection !== 'rightToLeft') return alignment
  if (alignment === 'leading') return 'trailing'
  if (alignment === 'trailing') return 'leading'
  return alignment
}

// Which axes a stack scrolls on, mirroring `scrollViewOpener` in
// `export/swiftui.js` exactly: the `scrollView` stack TYPE always scrolls,
// any other plain stack scrolls when the `scrollable` FLAG is set, and the
// axis comes from `scrollAxis` on both sides (default `.vertical`).
//
// The axis is read literally rather than inferred from the stack's main
// axis. An HStack marked scrollable with the default vertical axis exports
// `ScrollView { HStack { … } }` — a vertical scroller — so that is what the
// canvas has to draw, however odd it looks. Guessing the "sensible" axis
// here would put the canvas back out of step with the file it generates.
export function scrollAxesOf(stack) {
  const none = { vertical: false, horizontal: false }
  if (!stack || stack.type !== 'stack') return none
  if (stack.splitStyle) return none
  if (SELF_SCROLLING_STACK_TYPES.has(stack.stackType)) return none
  const isScroller = stack.stackType === 'scrollView' || stack.scrollable === true
  if (!isScroller) return none
  const axis = stack.scrollAxis || 'vertical'
  return {
    vertical:   axis === 'vertical'   || axis === 'both',
    horizontal: axis === 'horizontal' || axis === 'both'
  }
}

// Column count for a `grid` stack. Mirrors SwiftUI's two `GridItem` flavours:
//   gridMode === 'fixed'    → `GridItem(.fixed(size), count: N)` — uses
//                              `stack.columns` directly.
//   gridMode === 'adaptive' → `GridItem(.adaptive(minimum: x))` — derives
//                              the count from the available inner width,
//                              packing as many min-width columns as fit.
// When innerW is unknown (intrinsic sizing pass), adaptive mode falls back
// to a conservative 2-column count so auto-sizing still produces a useful
// bounding box.
export function gridColumnCount(stack, innerW, gap) {
  const mode = stack.gridMode || 'fixed'
  if (mode === 'adaptive') {
    if (innerW == null) return Math.max(1, stack.columns || 2)
    const minW = ptToUnits(stack.minColumnWidth ?? 140)
    const safeGap = gap || 0
    const n = Math.floor((innerW + safeGap) / (minW + safeGap))
    return Math.max(1, n)
  }
  return Math.max(1, stack.columns || 2)
}

// ---- size computation ----

// Intrinsic (content-hug) size for a text-like panel. Honours the full
// SwiftUI Text measurement pipeline so the canvas reserves the right
// amount of space:
//
//   - hard newlines → multi-line at intrinsic width
//   - .fixedSize(horizontal: true) → single line at intrinsic width
//   - otherwise wraps to whatever bound the caller supplies (or the
//     longest hard-line if none is given — that's the SwiftUI "ideal"
//     proposal for content-hug parents)
//
// `wrapBound` is the wrap width (units) the caller intends to give us.
// Pass `null` when no parent has proposed a width yet; we return the
// content-hug intrinsic in that case.
function textIntrinsicSize(item, wrapBound = null) {
  const text = item.text || ''
  // Pull modifier-derived metrics straight off `item` for backwards
  // compatibility (older callsites set tracking / lineSpacing as direct
  // panel fields) AND off summarized modifiers when present. The modifier
  // values win when both are set since they're the source of truth.
  const mod = summarizeModifiers(item.modifiers)
  const m = textMetrics(item, {
    ...mod,
    tracking:    mod.tracking    ?? item.tracking ?? 0,
    lineSpacing: mod.lineSpacing ?? item.lineSpacing ?? 0,
    lineLimit:   mod.lineLimit   ?? item.lineLimit
  })

  // Hard-line content-hug width — used when there's no parent proposal
  // and as the fallback intrinsic width for fixedSizeH / fit modes.
  //
  // Measured through the text engine rather than estimated from character
  // count: the widest line is frequently not the longest one in a
  // proportional face, and hugging the wrong width shows up as a stack that
  // reserves too little room and clips, or too much and leaves a gap.
  const hardLines = text.split('\n')
  const intrinsicW = Math.max(
    ptToUnits(40),
    hardLines.reduce((acc, l) => Math.max(
      acc,
      singleLineWidth(l, m.fontSize, m.trackingPt || 0, 1, m.fontWeight)
    ), 0)
  )

  // If horizontal is fixed (or fit), don't wrap. Just measure at the
  // intrinsic width — height grows only with hard newlines.
  if (m.fixedSizeH || wrapBound == null) {
    const r = measureSwiftUIText(text, m.fontSize, intrinsicW, {
      ...m, fixedSizeH: true
    })
    return [Math.max(intrinsicW, r.width), r.height]
  }

  // Wrap to the proposed bound — height comes out of the measurement.
  const r = measureSwiftUIText(text, m.fontSize, wrapBound, m)
  return [Math.min(intrinsicW, wrapBound), r.height]
}

// Intrinsic size, before `.aspectRatio` reshapes it. Not exported: every
// caller goes through `computeSize` so the ratio is applied exactly once and
// in exactly one place.
function computeIntrinsicSize(item, items) {
  if (!item) return [0, 0]

  // Spacer: minimal size (layout engine expands it later).
  if (item.type === 'panel' && item.isSpacer) return [0, 0]

  if (item.type !== 'stack' && item.type !== 'window') {
    // Text / Link: honour `widthMode` (fit / fixed / fill) plus an
    // optional `heightMode: 'fixed'` for multi-paragraph blocks where
    // the intrinsic single-line count would underestimate the slot.
    // For `fill`, layoutStack overrides the width with the parent's
    // innerW — here we return the intrinsic height but fall back to
    // intrinsic width so a `fill` child in a free-sizing parent still
    // has a sensible default.
    const isTextLike = item.type === 'panel' && (item.panelType === 'text' || item.panelType === 'link')
    if (isTextLike) {
      const mode = item.widthMode || 'fit'
      const hMode = item.heightMode || 'fit'
      // Frame modifier wins as the source of truth for the wrap bound —
      // that's what the user edits in the Modifiers section after
      // clicking the Fit/Fixed/Fill picker.
      const mod = summarizeModifiers(item.modifiers)
      const wrapHintFromMod = (typeof mod.frameWidth === 'number')
        ? ptToUnits(mod.frameWidth)
        : null
      const [iw, ih] = textIntrinsicSize(item, wrapHintFromMod)
      const fixedH = hMode === 'fixed' && Array.isArray(item.size) && item.size[1] ? item.size[1] : null
      if (mode === 'fixed') {
        const widthU = wrapHintFromMod ?? (Array.isArray(item.size) ? item.size[0] : iw)
        // Height has to be measured AT that width. A string wider than its
        // fixed frame wraps when rendered, so reporting the unwrapped
        // single-line height here would under-reserve by every extra line —
        // and `resolvedChildSizes` (which the renderer uses) already measures
        // at the bound, so the two paths would disagree and siblings would
        // overlap. See the agreement tests in layout.test.js.
        const [, measuredH] = textIntrinsicSize(item, widthU)
        return [widthU, fixedH ?? measuredH]
      }
      // fit and fill both start from intrinsic at this stage. fill gets
      // resized later inside layoutStack once innerW is known. `fixed`
      // heightMode wins over the intrinsic guess when present.
      return [iw, fixedH ?? ih]
    }
    // Button: the frame comes from the `controlSize` preset plus the label
    // width, exactly as `Panel3D` draws it. Both call the same function, so
    // the space the layout engine reserves and the box the renderer paints
    // cannot disagree — they used to, because the layout read a stored
    // `size` while the renderer computed its own.
    if (item.type === 'panel' && item.panelType === 'button') {
      const [wPt, hPt] = computeButtonFramePt(item)
      return [ptToUnits(wPt), ptToUnits(hPt)]
    }
    // List: height is driven by (row count × style row height) + style pad.
    // Width uses the stored frame or a sensible default — Apple lets Lists
    // fill their parent, so width stays user-editable.
    if (item.type === 'panel' && item.panelType === 'list') {
      const w = Array.isArray(item.size) && item.size[0] ? item.size[0] : ptToUnits(360)
      const h = ptToUnits(computeListHeightPt(item))
      return [w, h]
    }
    // Legacy text auto-sizing: if size is null, estimate from content.
    if (item.size === null || item.size === undefined) {
      return textIntrinsicSize(item)
    }
    return item.size || [0, 0]
  }

  if (item.type === 'window') return item.size || [2, 1]

  // Stack
  // Resolve `widthMode` / `heightMode` (fit / fixed / fill). For backwards-
  // compatibility, if the mode is undefined but `fixedWidth` / `fixedHeight`
  // is set, we treat the axis as 'fixed'. `fill` is handled by the parent
  // (via resolvedChildSizes / layoutStack) — at intrinsic time we return the
  // 'fit' size so a fill-mode stack still has sensible defaults if
  // orphaned.
  const wMode = item.widthMode  || (item.fixedWidth  != null ? 'fixed' : 'fit')
  const hMode = item.heightMode || (item.fixedHeight != null ? 'fixed' : 'fit')
  const fixedW = wMode === 'fixed' && item.fixedWidth  != null ? ptToUnits(item.fixedWidth)  : null
  const fixedH = hMode === 'fixed' && item.fixedHeight != null ? ptToUnits(item.fixedHeight) : null
  const pad = resolvePadding(item)

  const children = items.filter((c) => c.parentId === item.id && c.visible !== false)

  // Disclosure collapsed: only header height
  if (item.stackType === 'disclosure' && !item.expanded) {
    const headerH = ptToUnits(36)
    return [fixedW ?? ptToUnits(200), fixedH ?? (headerH + padH(pad))]
  }

  // Navstack: size of the active child only
  if (item.stackType === 'navigationStack') {
    const active = children[Math.min(item.activeChild ?? 0, children.length - 1)]
    if (!active) return [fixedW ?? padW(pad), fixedH ?? padH(pad)]
    const [cw, ch] = computeSize(active, items)
    const titleH = item.navTitle ? ptToUnits(40) : 0
    return [fixedW ?? (cw + padW(pad)), fixedH ?? (ch + titleH + padH(pad))]
  }

  // TabView: size of active tab + auto tab bar (at bottom, 64pt tall).
  // Tab bar width scales with number of tabs: 80pt per tab + 24pt padding.
  if (item.stackType === 'tabView') {
    const active = children[Math.min(item.activeTab ?? 0, children.length - 1)]
    const tabBarH = ptToUnits(64)
    if (!active) return [fixedW ?? ptToUnits(children.length * 80 + 24), fixedH ?? tabBarH]
    const [cw, ch] = computeSize(active, items)
    const barW = ptToUnits(children.length * 80 + 24)
    return [fixedW ?? Math.max(cw, barW) + padW(pad), fixedH ?? (ch + tabBarH + padH(pad))]
  }

  if (children.length === 0) {
    return [
      fixedW ?? Math.max(0.2, padW(pad)),
      fixedH ?? Math.max(0.2, padH(pad))
    ]
  }

  // Filter out spacers from fixed-size calculation (they expand later).
  const fixedChildren = children.filter((c) => !c.isSpacer)
  // For VStack-likes with a known fixed width, we can give text children
  // the actual wrap bound when measuring their intrinsic size. Without
  // this the column reserves single-line height and the wrapped text
  // overflows the column at render time. The wrap bound is the stack's
  // inner width — fixed - padding, or for fill stacks the upstream
  // proposal (still unknown here, so we fall back to the longest
  // non-text child's intrinsic width as a best-effort proposal).
  const isVStackLike = item.stackType === 'vstack' || item.stackType === 'lazyvstack' ||
                       item.stackType === 'section' || item.stackType === 'disclosure' ||
                       (item.stackType === 'scrollView' && (item.scrollAxis || 'vertical') !== 'horizontal')
  let knownWrapBound = null
  if (isVStackLike) {
    if (fixedW != null) {
      knownWrapBound = Math.max(0, fixedW - padW(pad))
    } else if (item.size && Array.isArray(item.size) && (item.widthMode === 'fixed' || (item.fixedWidth != null))) {
      knownWrapBound = Math.max(0, item.size[0] - padW(pad))
    }
  }
  const sizes = fixedChildren.map((c) => {
    const isTextLike = c.type === 'panel' && (c.panelType === 'text' || c.panelType === 'link')
    if (isTextLike && knownWrapBound != null && c.widthMode === 'fill') {
      const [iw, ih] = textIntrinsicSize(c, knownWrapBound)
      return [Math.min(iw, knownWrapBound), ih]
    }
    return computeSize(c, items)
  })
  const gap = stackSpacing(item.spacing)

  // Section: add header + footer height
  const headerH = (item.stackType === 'section' && item.sectionHeader) ? ptToUnits(28) : 0
  const footerH = (item.stackType === 'section' && item.sectionFooter) ? ptToUnits(22) : 0

  let w, h

  // A ToolbarItem's closure and a ToolbarItemGroup both hand the bar a run of
  // views, and a bar draws a run side by side. They used to fall through to
  // the VStack default and stack into a column. AUDIT #33.
  if (item.stackType === 'hstack' || item.stackType === 'lazyhstack' ||
      item.stackType === 'toolbarItem' || item.stackType === 'toolbarItemGroup') {
    w = sizes.reduce((s, [cw]) => s + cw, 0) + gap * Math.max(0, fixedChildren.length - 1) + padW(pad)
    h = (sizes.length ? Math.max(...sizes.map(([, ch]) => ch)) : 0) + padH(pad)
  } else if (item.stackType === 'zstack') {
    w = (sizes.length ? Math.max(...sizes.map(([cw]) => cw)) : 0) + padW(pad)
    h = (sizes.length ? Math.max(...sizes.map(([, ch]) => ch)) : 0) + padH(pad)
  } else if (item.stackType === 'viewThatFits') {
    // A ViewThatFits is the size of the branch it chose, not the union of
    // every branch it considered. With no proposal from above, each axis is
    // unconstrained and everything fits, so the first candidate wins — which
    // is also what the runtime does with an unconstrained proposal. A fixed
    // frame on either axis IS the proposal for that axis, so a stack sized
    // 200pt wide measures (and later draws) the branch that fits in 200pt.
    const propW = fixedW != null ? fixedW - padW(pad) : Infinity
    const propH = fixedH != null ? fixedH - padH(pad) : Infinity
    const pick = viewThatFitsIndex(item.fitsAxes, sizes, propW, propH)
    const [cw, ch] = sizes[pick] || [0, 0]
    w = cw + padW(pad)
    h = ch + padH(pad)
  } else if (item.stackType === 'toolbar') {
    // A bar is as wide as its three runs side by side and as tall as the
    // tallest item in each row it draws. AUDIT #33.
    const spans = toolbarZoneSpans(fixedChildren, sizes, gap)
    const { barH, bottomH } = toolbarRowHeights(spans)
    const runs = [spans.leading, spans.principal, spans.trailing].filter((r) => r.indices.length)
    const barW = runs.reduce((acc, r) => acc + r.w, 0) + gap * Math.max(0, runs.length - 1)
    const rows = [barH, bottomH].filter((x) => x > 0)
    w = Math.max(barW, spans.bottom.w) + padW(pad)
    h = rows.reduce((acc, x) => acc + x, 0) + gap * Math.max(0, rows.length - 1) + padH(pad)
  } else if (item.stackType === 'scrollView') {
    // ScrollView's intrinsic size mirrors its content along the cross axis
    // and 0 on the scroll axis (the parent decides). For canvas we treat
    // it like a VStack/HStack of children based on the chosen axis.
    const axis = item.scrollAxis || 'vertical'
    if (axis === 'horizontal') {
      w = sizes.reduce((s, [cw]) => s + cw, 0) + gap * Math.max(0, fixedChildren.length - 1) + padW(pad)
      h = (sizes.length ? Math.max(...sizes.map(([, ch]) => ch)) : 0) + padH(pad)
    } else {
      w = (sizes.length ? Math.max(...sizes.map(([cw]) => cw)) : 0) + padW(pad)
      h = sizes.reduce((s, [, ch]) => s + ch, 0) + gap * Math.max(0, fixedChildren.length - 1) + padH(pad)
    }
  } else if (item.stackType === 'grid' || item.stackType === 'lazyVGrid' || item.stackType === 'lazyHGrid') {
    // Adaptive grid mirrors `LazyVGrid(columns: [GridItem(.adaptive(minimum: x))])`:
    // columns are derived from the parent's inner width once we know it.
    // Without that knowledge here (intrinsic path), use declared columns as
    // a starting estimate — the resolvedChildSizes pass recomputes once the
    // real inner width is known.
    const cols = gridColumnCount(item, null, gap)
    const colW = sizes.length ? Math.max(...sizes.map(([cw]) => cw)) : ptToUnits(80)
    const rowH = sizes.length ? Math.max(...sizes.map(([, ch]) => ch)) : ptToUnits(80)
    const rowCount = Math.ceil(fixedChildren.length / cols)
    w = cols * colW + gap * (cols - 1) + padW(pad)
    h = rowCount * rowH + gap * Math.max(0, rowCount - 1) + padH(pad) + headerH + footerH
  } else {
    // vstack, lazyvstack, section, disclosure
    w = (sizes.length ? Math.max(...sizes.map(([cw]) => cw)) : 0) + padW(pad)
    h = sizes.reduce((s, [, ch]) => s + ch, 0) + gap * Math.max(0, fixedChildren.length - 1) + padH(pad) + headerH + footerH
  }

  return [fixedW ?? w, fixedH ?? h]
}

// ---------------------------------------------------------------------------
// ViewThatFits: which branch the runtime would show (AUDIT #33)
//
// `ViewThatFits(in:)` proposes the available space to each candidate in turn
// and takes the FIRST whose ideal size fits along the declared axes; if none
// fit, the last one is used anyway. The canvas used to Z-stack every candidate
// so the designer could see them all, which meant a container built to show
// one of three layouts drew all three on top of each other and nothing on the
// canvas answered the only question the container exists to ask: which one
// ships at this size.
//
// An axis the `in:` set leaves out is not measured, so everything fits on it —
// that is what `in: .horizontal` means, and it is why the parameter is worth
// having at all.
export function viewThatFitsIndex(fitsAxes, sizes, proposalW, proposalH) {
  if (sizes.length === 0) return -1
  const axes = fitsAxes || 'both'
  const checksW = axes === 'both' || axes === 'horizontal'
  const checksH = axes === 'both' || axes === 'vertical'
  for (let i = 0; i < sizes.length; i++) {
    const [cw, ch] = sizes[i]
    if (checksW && cw > proposalW + 1e-9) continue
    if (checksH && ch > proposalH + 1e-9) continue
    return i
  }
  return sizes.length - 1
}

// ---------------------------------------------------------------------------
// Toolbar zones: where each item sits in the bar (AUDIT #33)
//
// Groups a toolbar's children by the zone their `toolbarPlacement` names and
// measures each group as a run. The bar draws leading | principal | trailing
// on one row and the off-bar placements on a second; see `TOOLBAR_PLACEMENTS`
// for why that second row exists.
function toolbarZoneSpans(children, sizes, gap) {
  const of = { leading: [], principal: [], trailing: [], bottom: [] }
  children.forEach((c, i) => { of[toolbarZoneOf(c.toolbarPlacement)].push(i) })
  const span = (idx) => ({
    indices: idx,
    w: idx.reduce((s, i) => s + sizes[i][0], 0) + gap * Math.max(0, idx.length - 1),
    h: idx.length ? Math.max(...idx.map((i) => sizes[i][1])) : 0
  })
  return {
    leading: span(of.leading),
    principal: span(of.principal),
    trailing: span(of.trailing),
    bottom: span(of.bottom)
  }
}

// The two rows a toolbar reserves: the bar itself, and anything placed off it.
function toolbarRowHeights(spans) {
  const barH = Math.max(spans.leading.h, spans.principal.h, spans.trailing.h)
  return { barH, bottomH: spans.bottom.h }
}

// The size every caller should use: intrinsic, reshaped by `.aspectRatio`.
//
// SwiftUI applies the ratio to whatever frame the view would otherwise have,
// so it belongs after the type-specific measurement rather than inside it.
// Both the layout engine and the renderer run this — a box the stack reserves
// and a box the panel paints have to be the same box, which is the agreement
// `layout.test.js` exists to pin.
export function computeSize(item, items) {
  const mod = summarizeModifiers(item?.modifiers)
  return applyAspectRatio(computeIntrinsicSize(item, items), mod.aspectRatio)
}

// Returns a Map<childId, [width, height]> of the *resolved* child sizes this
// stack hands out — i.e. after `widthMode: 'fill'` is expanded to the parent's
// inner width. Used by Panel3D so it can render the text at the width the
// layout engine reserved for it (important for left/right alignment: the text
// anchor point depends on the frame width, not just the intrinsic glyph run).
export function resolvedChildSizes(stack, items, outerSize = null) {
  const out = new Map()
  const children = items.filter((c) => c.parentId === stack.id && c.visible !== false)
  if (children.length === 0) return out
  const pad = resolvePadding(stack)
  const [sw, sh] = outerSize || computeSize(stack, items)
  const innerW = Math.max(0, sw - padW(pad))
  const innerH = Math.max(0, sh - padH(pad))
  const gap = stackSpacing(stack.spacing)

  // ---- NavigationSplitView slot-based sizing ----
  // Mirrors the `layoutStack` slot branch: sidebar children claim a
  // 320pt column (minus inset), detail children claim the remaining
  // width across the full inner height. Anything with `widthMode: 'fill'`
  // expands to the column it sits in.
  if (children.some((c) => c.slot === 'sidebar' || c.slot === 'detail')) {
    const sideW = ptToUnits(320)
    const SECTION_PAD_X = ptToUnits(24)
    const detailW = Math.max(0, innerW - sideW)
    const isSectionHeader = (c) =>
      c.type === 'panel' && c.panelType === 'text' && c.slot === 'sidebar' &&
      typeof c.name === 'string' && /Section .* Header/.test(c.name)
    for (const c of children) {
      const slot = c.slot || 'sidebar'
      const [cw, ch] = computeSize(c, items)
      const isFillW = (c.type === 'stack' || c.type === 'panel') && c.widthMode === 'fill'
      const isFillH = c.type === 'stack' && c.heightMode === 'fill'
      let rw = cw
      let rh = ch
      if (slot === 'sidebar') {
        // Section headers carry pl-24/pr-24 inset → effective width is
        // sideW minus the 24pt inset (applied on the leading edge only;
        // the trailing edge crops naturally inside the sidebar bounds).
        if (isFillW) {
          rw = isSectionHeader(c) ? Math.max(0, sideW - SECTION_PAD_X) : sideW
        }
      } else {
        rw = isFillW ? detailW : Math.max(cw, detailW)
        rh = isFillH ? innerH : Math.max(ch, innerH)
      }
      out.set(c.id, [rw, rh])
    }
    return out
  }
  // ScrollView contributes to fill-resolution along its scroll axis only.
  // A toolbar is a horizontal bar, so a fill-width item in it takes a share of
  // the slack rather than the whole width and flattening the other zones.
  const isHStack = stack.stackType === 'hstack' || stack.stackType === 'lazyhstack' ||
                   stack.stackType === 'toolbar' || stack.stackType === 'toolbarItem' ||
                   stack.stackType === 'toolbarItemGroup' ||
                   (stack.stackType === 'scrollView' && (stack.scrollAxis || 'vertical') === 'horizontal')
  const isVStack = stack.stackType === 'vstack' || stack.stackType === 'lazyvstack' ||
                   stack.stackType === 'section' || stack.stackType === 'disclosure' ||
                   (stack.stackType === 'scrollView' && (stack.scrollAxis || 'vertical') !== 'horizontal')

  // Compute per-axis flex share so main-axis fill stack children get the
  // correct width/height here (matches what layoutStack hands them).
  const intrinsicSizes = children.map((c) => computeSize(c, items))
  // A `fill` child on the stack's MAIN axis behaves like a Spacer: it shares
  // the leftover space with its siblings. Giving it the whole inner extent
  // would push every sibling out of the stack — which is what a fill-width
  // Text in an HStack used to do to the button beside it.
  const isTextLikeItem = (c) =>
    c.type === 'panel' && (c.panelType === 'text' || c.panelType === 'link')
  let flexShareW = 0, flexShareH = 0
  // A flex child that loses the priority contest keeps its intrinsic size —
  // a Spacer collapses to nothing, which is what SwiftUI does to the loser.
  let takesSlackW = () => true, takesSlackH = () => true
  if (isHStack) {
    const isFlex = (c) => c.isSpacer ||
      ((c.type === 'stack' || isTextLikeItem(c)) && c.widthMode === 'fill')
    const fixedW = intrinsicSizes.reduce((s, [cw], i) => s + (isFlex(children[i]) ? 0 : cw), 0)
    const totalGap = gap * Math.max(0, children.length - 1)
    const remaining = Math.max(0, innerW - fixedW - totalGap)
    const flex = resolveFlex(children, isFlex, remaining)
    flexShareW = flex.share
    takesSlackW = flex.takesSlack
  }
  if (isVStack) {
    const isFlex = (c) => c.isSpacer || (c.type === 'stack' && c.heightMode === 'fill')
    const fixedH = intrinsicSizes.reduce((s, [, ch], i) => s + (isFlex(children[i]) ? 0 : ch), 0)
    const totalGap = gap * Math.max(0, children.length - 1)
    const remaining = Math.max(0, innerH - fixedH - totalGap)
    const flex = resolveFlex(children, isFlex, remaining)
    flexShareH = flex.share
    takesSlackH = flex.takesSlack
  }

  for (let i = 0; i < children.length; i++) {
    const c = children[i]
    const [cw, ch] = intrinsicSizes[i]
    let rw = cw
    let rh = ch
    const isTextLike = c.type === 'panel' && (c.panelType === 'text' || c.panelType === 'link')
    const isStack    = c.type === 'stack'
    if (isTextLike && c.widthMode === 'fill') {
      // Cross-axis fill (a VStack column) stretches to the full inner width;
      // main-axis fill (an HStack row) takes only its share of the leftover.
      rw = isHStack ? (takesSlackW(c) ? flexShareW : cw) : innerW
    }
    if (isStack) {
      // Main-axis fill gets the flex share; cross-axis fill stretches fully.
      if (c.widthMode === 'fill') {
        rw = isHStack ? (takesSlackW(c) ? flexShareW : cw) : innerW
      }
      if (c.heightMode === 'fill') {
        rh = isVStack ? (takesSlackH(c) ? flexShareH : ch) : innerH
      }
    }
    // Text height honours the wrap bound once it's known. Without this,
    // a long string in a `fill`-width Text would only reserve the
    // single-line intrinsic height — the wrap would happen at render
    // time and clip into the sibling below. By feeding `rw` (minus any
    // ancestor padding the modifier stack adds to this view itself) back
    // into the measurement, the parent stack reserves the right amount
    // of vertical space for every wrapped line.
    if (isTextLike) {
      const mod = summarizeModifiers(c.modifiers)
      // Respect `frame(width:)` and `.fixedSize(horizontal: true)` —
      // those override the proposed width with the intrinsic instead.
      let wrapBound = rw
      if (typeof mod.frameWidth === 'number') {
        wrapBound = ptToUnits(mod.frameWidth)
        rw = wrapBound
      }
      if (typeof mod.frameMaxWidth === 'number' && Number.isFinite(mod.frameMaxWidth)) {
        wrapBound = Math.min(wrapBound, ptToUnits(mod.frameMaxWidth))
      }
      if (typeof mod.frameMinWidth === 'number') {
        wrapBound = Math.max(wrapBound, ptToUnits(mod.frameMinWidth))
        rw = Math.max(rw, ptToUnits(mod.frameMinWidth))
      }
      // The view's own `.padding(_)` shrinks the proposal the inner Text
      // sees — subtract it from the wrap bound but add it back into the
      // reserved height.
      const pp = mod.padding
      const padX = pp ? ptToUnits((pp.left || 0) + (pp.right  || 0)) : 0
      const padY = pp ? ptToUnits((pp.top  || 0) + (pp.bottom || 0)) : 0
      wrapBound = Math.max(0.0001, wrapBound - padX)
      const [, measuredH] = textIntrinsicSize(c, wrapBound)
      rh = measuredH + padY
      if (typeof mod.frameHeight === 'number') rh = ptToUnits(mod.frameHeight)
    }
    out.set(c.id, [rw, rh])
  }
  return out
}

// ---- child positioning ----

export function layoutStack(stack, items, outerSize = null) {
  const children = items.filter((c) => c.parentId === stack.id && c.visible !== false)
  if (children.length === 0) return new Map()

  const pad = resolvePadding(stack)
  const [sw, sh] = outerSize || computeSize(stack, items)
  const innerW = sw - padW(pad)
  const innerH = sh - padH(pad)
  const gap = stackSpacing(stack.spacing)

  // ---- NavigationSplitView (slot-based layout) ----
  // Activated when any direct child carries a `slot` field — the user's
  // new sidebar wizard tags sidebar/detail children explicitly instead
  // of using wrapper "Sidebar" + "Detail" stacks. Lays out:
  //   - slot==='sidebar' children as a VStack on the left, 320pt wide
  //   - slot==='detail'  children stacked at the right column, sharing
  //     the same x/y (only one rendered at a time per visibility flag).
  // Backward compat: when no child has a slot field the parent falls
  // through to the regular HStack path, so existing addSplitView /
  // Mail / Files templates that use wrapper Sidebar+Detail stacks
  // keep their old layout.
  if (children.some((c) => c.slot === 'sidebar' || c.slot === 'detail')) {
    const sidebarChildren = children.filter((c) => (c.slot || 'sidebar') === 'sidebar')
    const detailChildren  = children.filter((c) => c.slot === 'detail')
    const sideW    = ptToUnits(320)            // Apple visionOS kit sidebar width
    const detailW  = Math.max(0, innerW - sideW)
    const out = new Map()

    // Sidebar column: flows top-down. Items now handle their own
    // horizontal padding (no outer inset on the slot) so they match
    // Apple's Figma metrics exactly:
    //   Header (HStack)         — 92pt high, pl-28 pr-20 (its own paddingEdges)
    //   Section Header (text)   — pt-12 px-24 — we add 12pt top gap + offset X
    //   Sidebar Item (list row) — px-12, 56pt rowH (handled by LIST_STYLES.sidebar)
    const sidebarX0 = -innerW / 2 + sideW / 2
    const SECTION_TOP_GAP = ptToUnits(12)
    const SECTION_PAD_X   = ptToUnits(24)

    // Per-item gap rules — Apple's spec has zero inter-item gap except
    // a 12pt breathing space above each section heading (after the
    // first one). The Header HStack already carries its own height so
    // it absorbs its own bottom spacing.
    const isSectionHeader = (c) =>
      c.type === 'panel' && c.panelType === 'text' && c.slot === 'sidebar' &&
      typeof c.name === 'string' && /Section .* Header/.test(c.name)

    // Apply scroll offset from the NavSplitView root. Clamped against
    // the overflow distance: total content height − available height.
    const scrollY = Math.max(0, Number(stack.sidebarScrollY) || 0)

    // Compute child sizes once.
    const sidebarSizes = sidebarChildren.map((c) => {
      const [cw, ch] = computeSize(c, items)
      return [cw, ch]
    })

    // First pass — total content height (without scroll).
    let total = 0
    for (let i = 0; i < sidebarChildren.length; i++) {
      const c = sidebarChildren[i]
      if (i > 0 && isSectionHeader(c)) total += SECTION_TOP_GAP
      total += sidebarSizes[i][1]
    }
    const maxScroll = Math.max(0, total - innerH)
    const effectiveScroll = Math.min(scrollY, maxScroll)

    // Second pass — emit positions; skip items that fall entirely
    // outside the visible band (above innerH/2 or below -innerH/2).
    // That gives a basic "auto-scroll" overflow clip — the user wheel
    // updates `sidebarScrollY` and items slide off the top/bottom.
    let sy = innerH / 2 + effectiveScroll
    for (let i = 0; i < sidebarChildren.length; i++) {
      const c = sidebarChildren[i]
      const [, ch] = sidebarSizes[i]
      if (i > 0 && isSectionHeader(c)) sy -= SECTION_TOP_GAP
      const itemTop = sy
      const itemBottom = sy - ch
      const cy = sy - ch / 2
      sy = itemBottom
      const visibleTop = innerH / 2
      const visibleBottom = -innerH / 2
      if (itemBottom > visibleTop || itemTop < visibleBottom) continue
      // Section headers honour Apple's pl-24 / pr-24 inset by nudging
      // their X anchor leftward (so the title hugs the 24pt-from-left
      // edge instead of centring inside the column).
      const xOffset = isSectionHeader(c) ? SECTION_PAD_X : 0
      // z=0.01 lifts items in front of the sidebar plate (which sits at
      // z=0.002 with depthWrite off). Without this lift the items
      // z-fight with the plate when both occupy the same plane.
      out.set(c.id, [sidebarX0 + xOffset, cy, 0.01])
    }

    // Detail column unchanged — single right-column anchor. Same z-lift
    // so the detail destination renders above the window plate plane.
    const detailX = innerW / 2 - detailW / 2
    for (const c of detailChildren) {
      out.set(c.id, [detailX, 0, 0.01])
    }

    return out
  }

  // Disclosure collapsed: no children rendered
  if (stack.stackType === 'disclosure' && !stack.expanded) return new Map()

  // Navstack: only the active child
  if (stack.stackType === 'navigationStack') {
    const idx = Math.min(stack.activeChild ?? 0, children.length - 1)
    const active = children[idx]
    if (!active) return new Map()
    const titleH = stack.navTitle ? ptToUnits(40) : 0
    const out = new Map()
    out.set(active.id, [0, -titleH / 2, 0])
    return out
  }

  // TabView: only the active Tab, shifted up to leave room for the bottom tab bar.
  if (stack.stackType === 'tabView') {
    const idx = Math.min(stack.activeTab ?? 0, children.length - 1)
    const active = children[idx]
    const out = new Map()
    if (active) {
      const tabBarH = ptToUnits(64)
      out.set(active.id, [0, tabBarH / 2, 0])
    }
    return out
  }

  // Resolve `fill` for text/link and stack children. In SwiftUI, a
  // `.frame(maxWidth: .infinity)` child pushes its cross-axis to the parent
  // stack's inner size; on the *main* axis it behaves like a Spacer (shares
  // remaining space with siblings). We mark main-axis-fill children here
  // and expand them later, the same way spacers are expanded.
  // ScrollView lays out like a VStack/HStack along its scroll axis — so
  // we treat it as one for child positioning. ViewThatFits and toolbar
  // stacks have branches of their own further down.
  const isHStack = stack.stackType === 'hstack' || stack.stackType === 'lazyhstack' ||
                   stack.stackType === 'toolbarItem' || stack.stackType === 'toolbarItemGroup' ||
                   (stack.stackType === 'scrollView' && (stack.scrollAxis || 'vertical') === 'horizontal')
  const isVStack = stack.stackType === 'vstack' || stack.stackType === 'lazyvstack' ||
                   stack.stackType === 'section' || stack.stackType === 'disclosure' ||
                   (stack.stackType === 'scrollView' && (stack.scrollAxis || 'vertical') !== 'horizontal')
  const isTextLikeItem = (c) =>
    c.type === 'panel' && (c.panelType === 'text' || c.panelType === 'link')
  const resolveChildSize = (c) => {
    const [cw, ch] = computeSize(c, items)
    const isTextLike = isTextLikeItem(c)
    const isStack    = c.type === 'stack'
    let rw = cw
    let rh = ch
    // Cross-axis fill stretches to the inner width. Main-axis fill (in an
    // HStack) is handled by the spacer/flex pass below, which knows how much
    // space is actually left over, so leave the intrinsic width here.
    if (isTextLike && c.widthMode === 'fill' && !isHStack) rw = Math.max(0, innerW)
    if (isStack) {
      // Cross-axis fill: stretch the dimension perpendicular to the stack's
      // main axis. Main-axis fill is handled below via the spacer pipeline.
      if (c.widthMode  === 'fill' && !isHStack) rw = Math.max(0, innerW)
      if (c.heightMode === 'fill' && !isVStack) rh = Math.max(0, innerH)
    }
    // Re-measure text height once the wrap bound is known. Mirrors the
    // logic in resolvedChildSizes (same numbers, same code path) so
    // positioning and rendering agree on each text panel's height.
    if (isTextLike) {
      const mod = summarizeModifiers(c.modifiers)
      let wrapBound = rw
      if (typeof mod.frameWidth === 'number') {
        wrapBound = ptToUnits(mod.frameWidth)
        rw = wrapBound
      }
      if (typeof mod.frameMaxWidth === 'number' && Number.isFinite(mod.frameMaxWidth)) {
        wrapBound = Math.min(wrapBound, ptToUnits(mod.frameMaxWidth))
      }
      if (typeof mod.frameMinWidth === 'number') {
        wrapBound = Math.max(wrapBound, ptToUnits(mod.frameMinWidth))
        rw = Math.max(rw, ptToUnits(mod.frameMinWidth))
      }
      const pp = mod.padding
      const padX = pp ? ptToUnits((pp.left || 0) + (pp.right  || 0)) : 0
      const padY = pp ? ptToUnits((pp.top  || 0) + (pp.bottom || 0)) : 0
      wrapBound = Math.max(0.0001, wrapBound - padX)
      const [, measuredH] = textIntrinsicSize(c, wrapBound)
      rh = measuredH + padY
      if (typeof mod.frameHeight === 'number') rh = ptToUnits(mod.frameHeight)
    }
    return [rw, rh]
  }
  const sizes = children.map((c) => resolveChildSize(c))
  const out = new Map()

  // Section header/footer heights
  const headerH = (stack.stackType === 'section' && stack.sectionHeader) ? ptToUnits(28) : 0
  const footerH = (stack.stackType === 'section' && stack.sectionFooter) ? ptToUnits(22) : 0

  // ---- Grid (Grid / LazyVGrid / LazyHGrid) ----
  // LazyVGrid mirrors Grid's column-flow layout. LazyHGrid flows rows
  // horizontally — we approximate with a single-axis HStack arrangement
  // (the canvas isn't a virtualised renderer, so the lazy semantics are
  // a no-op here; the layout matches what a single flush would render).
  if (stack.stackType === 'grid' || stack.stackType === 'lazyVGrid' || stack.stackType === 'lazyHGrid') {
    const cols = gridColumnCount(stack, innerW, gap)
    const colW = innerW / cols
    const rowHs = []
    for (let i = 0; i < children.length; i += cols) {
      const rowSizes = sizes.slice(i, i + cols)
      rowHs.push(Math.max(...rowSizes.map(([, ch]) => ch)))
    }
    const totalH = rowHs.reduce((s, rh) => s + rh, 0) + gap * Math.max(0, rowHs.length - 1)
    let y = totalH / 2 + headerH / 2 - footerH / 2
    for (let i = 0; i < children.length; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      if (col === 0 && row > 0) y -= rowHs[row - 1] + gap
      if (col === 0 && row === 0) y -= rowHs[0] / 2
      const x = -innerW / 2 + colW * (col + 0.5)
      out.set(children[i].id, [x, y, 0])
    }
    return out
  }

  // ---- HStack / LazyHStack / ToolbarItem / ToolbarItemGroup ----
  if (stack.stackType === 'hstack' || stack.stackType === 'lazyhstack' ||
      stack.stackType === 'toolbarItem' || stack.stackType === 'toolbarItemGroup') {
    // Spacer expansion — a fill-width stack OR Text child is flexible like a
    // spacer on this axis, sharing what is left rather than claiming it all.
    const isFlex = (c) => c.isSpacer ||
      ((c.type === 'stack' || isTextLikeItem(c)) && c.widthMode === 'fill')
    const fixedW = sizes.reduce((s, [cw], i) => s + (isFlex(children[i]) ? 0 : cw), 0)
    const totalGap = gap * Math.max(0, children.length - 1)
    const remaining = Math.max(0, innerW - fixedW - totalGap)
    // Same split `resolvedChildSizes` makes, from the same helper: the slack
    // goes to the highest layout priority among the flexible children.
    const { share: flexW, takesSlack } = resolveFlex(children, isFlex, remaining)

    const effectiveSizes = sizes.map(([cw, ch], i) => {
      const c = children[i]
      if (!isFlex(c) || !takesSlack(c)) return [cw, ch]
      // A Text narrowed to its flex share may wrap to more lines, so its
      // height has to be re-measured at the width it actually gets — the same
      // bound `resolvedChildSizes` hands the renderer.
      if (isTextLikeItem(c)) {
        const [, measuredH] = textIntrinsicSize(c, Math.max(0.0001, flexW))
        return [flexW, measuredH]
      }
      return [flexW, ch]
    })
    const totalW = effectiveSizes.reduce((s, [cw]) => s + cw, 0) + totalGap
    // Leading-anchor a horizontal scroller, for the same reason the vertical
    // path top-anchors: the content is wider than the box, so centring it
    // puts the first child off the leading edge. See the note there.
    let x = -(scrollAxesOf(stack).horizontal ? innerW : totalW) / 2
    for (let i = 0; i < children.length; i++) {
      const [cw, ch] = effectiveSizes[i]
      let y = 0
      // SwiftUI: top = child's top edge at stack's top padding boundary
      if (stack.alignment === 'top') y = innerH / 2 - ch / 2
      else if (stack.alignment === 'bottom') y = -innerH / 2 + ch / 2
      out.set(children[i].id, [x + cw / 2, y, 0])
      x += cw + gap
    }
    return out
  }

  // ---- ViewThatFits ----
  // One branch is drawn, the one the runtime would keep: the first whose ideal
  // size fits the space this stack was handed, measured only on the axes the
  // `in:` set names. The rest are not positioned, so they are not rendered.
  // AUDIT #33.
  if (stack.stackType === 'viewThatFits') {
    const ideals = children.map((c) => computeSize(c, items))
    const pick = viewThatFitsIndex(stack.fitsAxes, ideals, innerW, innerH)
    const chosen = children[pick]
    if (chosen) out.set(chosen.id, [0, 0, 0])
    return out
  }

  // ---- Toolbar ----
  // Items go where their placement says, not where the tree put them: the bar
  // runs leading | principal | trailing, and anything placed off the bar gets
  // the row underneath. AUDIT #33.
  if (stack.stackType === 'toolbar') {
    const spans = toolbarZoneSpans(children, sizes, gap)
    const { barH, bottomH } = toolbarRowHeights(spans)
    const rows = [barH, bottomH].filter((x) => x > 0)
    const totalH = rows.reduce((acc, x) => acc + x, 0) + gap * Math.max(0, rows.length - 1)
    // The content band centres in the box, so a bar given more height than it
    // needs sits in the middle of it rather than clinging to the top edge.
    const barY = totalH / 2 - barH / 2
    const bottomY = totalH / 2 - barH - gap - bottomH / 2
    const placeRun = (run, x0, rowY) => {
      let x = x0
      for (const i of run.indices) {
        const cw = sizes[i][0]
        out.set(children[i].id, [x + cw / 2, rowY, 0])
        x += cw + gap
      }
    }
    placeRun(spans.leading,   -innerW / 2,                   barY)
    placeRun(spans.principal, -spans.principal.w / 2,        barY)
    placeRun(spans.trailing,  innerW / 2 - spans.trailing.w, barY)
    placeRun(spans.bottom,    -spans.bottom.w / 2,           bottomY)
    return out
  }

  // ---- ZStack ----
  if (stack.stackType === 'zstack') {
    for (let i = 0; i < children.length; i++) {
      const [cw, ch] = sizes[i]
      let x = 0, y = 0
      const a = stack.alignment || 'center'
      if (a.includes('Leading') || a === 'leading') x = -(innerW - cw) / 2
      if (a.includes('Trailing') || a === 'trailing') x = (innerW - cw) / 2
      if (a.startsWith('top')) y = (innerH - ch) / 2
      if (a.startsWith('bottom')) y = -(innerH - ch) / 2
      out.set(children[i].id, [x, y, i * 0.002])
    }
    return out
  }

  // ---- VStack / LazyVStack / Section / Disclosure ----

  // Spacer expansion — fill-height stack children expand like spacers.
  const isFlexV = (c) => c.isSpacer || (c.type === 'stack' && c.heightMode === 'fill')
  const fixedH = sizes.reduce((s, [, ch], i) => s + (isFlexV(children[i]) ? 0 : ch), 0)
  const totalGap = gap * Math.max(0, children.length - 1)
  const available = innerH - headerH - footerH
  const remaining = Math.max(0, available - fixedH - totalGap)
  const { share: flexH, takesSlack: takesSlackV } = resolveFlex(children, isFlexV, remaining)

  const effectiveSizes = sizes.map(([cw, ch], i) =>
    (isFlexV(children[i]) && takesSlackV(children[i])) ? [cw, flexH] : [cw, ch]
  )
  const totalH = effectiveSizes.reduce((s, [, ch]) => s + ch, 0) + totalGap
  // A vertical scroller lays its content out from the TOP of the viewport
  // rather than around the viewport's centre. Centring is right for a stack
  // that hugs its children — the two heights are equal and the distinction
  // is invisible — but a ScrollView's content is taller than its box by
  // definition, and centring it hid the first screenful above the top edge
  // and the last below the bottom: the `settings` template opened mid-page
  // with its own title unreachable. Substituting the available height for
  // the content height pins the content's top edge to the box's top edge,
  // which is where SwiftUI puts it, and lets `scrollY` walk the rest into
  // view. Short content top-anchors too, which is also what a ScrollView
  // does. AUDIT #4.
  const anchorH = scrollAxesOf(stack).vertical ? available : totalH
  let y = anchorH / 2 + headerH / 2 - footerH / 2

  // Offset for asymmetric padding
  const padOffsetX = (pad.leading - pad.trailing) / 2
  const padOffsetY = (pad.top - pad.bottom) / 2
  // Leading and trailing swap under a right-to-left layout direction.
  const align = mirroredAlignment(stack.alignment, stack.environment)

  for (let i = 0; i < children.length; i++) {
    const c = children[i]
    const [cw, ch] = effectiveSizes[i]
    // Text & Link: `textAlign` overrides stack alignment for that child, so
    // .leading text inside a .center VStack still hugs the stack's left edge
    // (matches the user's mental model of "left-aligned text touches the left
    // side of the stack"). For every other child we fall back to the stack's
    // own alignment value.
    const isTextLike = c.type === 'panel' && (c.panelType === 'text' || c.panelType === 'link')
    const leftAnchored  = isTextLike && c.textAlign === 'left'
    const rightAnchored = isTextLike && c.textAlign === 'right'
    let x
    if (leftAnchored) {
      x = -innerW / 2 + cw / 2 + padOffsetX
    } else if (rightAnchored) {
      x = innerW / 2 - cw / 2 + padOffsetX
    } else if (align === 'leading') {
      x = -innerW / 2 + cw / 2 + padOffsetX
    } else if (align === 'trailing') {
      x = innerW / 2 - cw / 2 + padOffsetX
    } else {
      x = padOffsetX                                    // center (default)
    }
    y -= ch / 2
    out.set(c.id, [x, y + padOffsetY, 0])
    y -= ch / 2 + gap
  }
  return out
}
