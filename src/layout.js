// Stack layout engine — mirrors SwiftUI's VStack/HStack/ZStack/Grid/Section/
// DisclosureGroup/NavigationStack semantics. Given a stack item and its children,
// returns a map of { childId -> [x, y, z] } in local coordinates.

import { ptToUnits, computeListHeightPt } from './appleSystem'

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

function resolvePadding(item) {
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

function padW(pad) { return pad.leading + pad.trailing }
function padH(pad) { return pad.top + pad.bottom }

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

// Intrinsic (content-hug) size for a text-like panel. Width grows with the
// character count (plus tracking), height grows with the font size (plus any
// extra .lineSpacing the user dialled in).
//
// Explicit newlines in the body bump the height proportionally so a
// multi-line block (Mail body, multi-paragraph hero copy) doesn't
// collapse to a single-line slot and overlap its siblings inside a
// VStack. Wrap-driven multi-line is still under-counted at this stage
// — the parent only knows the wrap width once layoutStack runs — but
// '\n' is information we have here, so we honour it.
function textIntrinsicSize(item) {
  const text = item.text || ''
  const fontSize = item.fontSize || ptToUnits(17)
  const glyphAdv = fontSize * 0.55 + ptToUnits(item.tracking || 0)
  const lines = Math.max(1, text.split('\n').length)
  const longestLine = text.split('\n').reduce((m, l) => Math.max(m, l.length), 1)
  const w = Math.max(ptToUnits(40), longestLine * glyphAdv)
  const h = fontSize * 1.5 * lines + ptToUnits((item.lineSpacing || 0) * lines)
  return [w, h]
}

export function computeSize(item, items) {
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
      const [iw, ih] = textIntrinsicSize(item)
      const fixedH = hMode === 'fixed' && Array.isArray(item.size) && item.size[1] ? item.size[1] : null
      if (mode === 'fixed' && Array.isArray(item.size)) {
        return [item.size[0], fixedH ?? item.size[1] ?? ih]
      }
      // fit and fill both start from intrinsic at this stage. fill gets
      // resized later inside layoutStack once innerW is known. `fixed`
      // heightMode wins over the intrinsic guess when present.
      return [iw, fixedH ?? ih]
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
  const sizes = fixedChildren.map((c) => computeSize(c, items))
  const gap = stackSpacing(item.spacing)

  // Section: add header + footer height
  const headerH = (item.stackType === 'section' && item.sectionHeader) ? ptToUnits(28) : 0
  const footerH = (item.stackType === 'section' && item.sectionFooter) ? ptToUnits(22) : 0

  let w, h

  if (item.stackType === 'hstack' || item.stackType === 'lazyhstack') {
    w = sizes.reduce((s, [cw]) => s + cw, 0) + gap * Math.max(0, fixedChildren.length - 1) + padW(pad)
    h = (sizes.length ? Math.max(...sizes.map(([, ch]) => ch)) : 0) + padH(pad)
  } else if (item.stackType === 'zstack' || item.stackType === 'viewThatFits') {
    // ViewThatFits behaves like a ZStack at design-time: we lay out the
    // first child at the parent size. Spec §1.24 — the runtime picks the
    // first child that fits; on a static canvas all children stack.
    w = (sizes.length ? Math.max(...sizes.map(([cw]) => cw)) : 0) + padW(pad)
    h = (sizes.length ? Math.max(...sizes.map(([, ch]) => ch)) : 0) + padH(pad)
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
  const isHStack = stack.stackType === 'hstack' || stack.stackType === 'lazyhstack' ||
                   (stack.stackType === 'scrollView' && (stack.scrollAxis || 'vertical') === 'horizontal')
  const isVStack = stack.stackType === 'vstack' || stack.stackType === 'lazyvstack' ||
                   stack.stackType === 'section' || stack.stackType === 'disclosure' ||
                   (stack.stackType === 'scrollView' && (stack.scrollAxis || 'vertical') !== 'horizontal')

  // Compute per-axis flex share so main-axis fill stack children get the
  // correct width/height here (matches what layoutStack hands them).
  const intrinsicSizes = children.map((c) => computeSize(c, items))
  let flexShareW = 0, flexShareH = 0
  if (isHStack) {
    const isFlex = (c) => c.isSpacer || (c.type === 'stack' && c.widthMode === 'fill')
    const flexCount = children.filter(isFlex).length
    const fixedW = intrinsicSizes.reduce((s, [cw], i) => s + (isFlex(children[i]) ? 0 : cw), 0)
    const totalGap = gap * Math.max(0, children.length - 1)
    const remaining = Math.max(0, innerW - fixedW - totalGap)
    flexShareW = flexCount > 0 ? remaining / flexCount : 0
  }
  if (isVStack) {
    const isFlex = (c) => c.isSpacer || (c.type === 'stack' && c.heightMode === 'fill')
    const flexCount = children.filter(isFlex).length
    const fixedH = intrinsicSizes.reduce((s, [, ch], i) => s + (isFlex(children[i]) ? 0 : ch), 0)
    const totalGap = gap * Math.max(0, children.length - 1)
    const remaining = Math.max(0, innerH - fixedH - totalGap)
    flexShareH = flexCount > 0 ? remaining / flexCount : 0
  }

  for (let i = 0; i < children.length; i++) {
    const c = children[i]
    const [cw, ch] = intrinsicSizes[i]
    let rw = cw
    let rh = ch
    const isTextLike = c.type === 'panel' && (c.panelType === 'text' || c.panelType === 'link')
    const isStack    = c.type === 'stack'
    if (isTextLike && c.widthMode === 'fill') {
      rw = innerW
    }
    if (isStack) {
      // Main-axis fill gets the flex share; cross-axis fill stretches fully.
      if (c.widthMode === 'fill') {
        rw = isHStack ? flexShareW : innerW
      }
      if (c.heightMode === 'fill') {
        rh = isVStack ? flexShareH : innerH
      }
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
      const isText = c.type === 'panel' && c.panelType === 'text'
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
  // we treat it as one for child positioning. ViewThatFits collapses to
  // its first child (we render it ZStack-style on the canvas).
  const isHStack = stack.stackType === 'hstack' || stack.stackType === 'lazyhstack' ||
                   (stack.stackType === 'scrollView' && (stack.scrollAxis || 'vertical') === 'horizontal')
  const isVStack = stack.stackType === 'vstack' || stack.stackType === 'lazyvstack' ||
                   stack.stackType === 'section' || stack.stackType === 'disclosure' ||
                   (stack.stackType === 'scrollView' && (stack.scrollAxis || 'vertical') !== 'horizontal')
  const mainAxisFill = (c) => {
    if (c.type !== 'stack') return false
    if (isHStack) return c.widthMode === 'fill'
    if (isVStack) return c.heightMode === 'fill'
    return false
  }
  const resolveChildSize = (c) => {
    const [cw, ch] = computeSize(c, items)
    const isTextLike = c.type === 'panel' && (c.panelType === 'text' || c.panelType === 'link')
    const isStack    = c.type === 'stack'
    let rw = cw
    let rh = ch
    if (isTextLike && c.widthMode === 'fill') rw = Math.max(0, innerW)
    if (isStack) {
      // Cross-axis fill: stretch the dimension perpendicular to the stack's
      // main axis. Main-axis fill is handled below via the spacer pipeline.
      if (c.widthMode  === 'fill' && !isHStack) rw = Math.max(0, innerW)
      if (c.heightMode === 'fill' && !isVStack) rh = Math.max(0, innerH)
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

  // ---- HStack / LazyHStack ----
  if (stack.stackType === 'hstack' || stack.stackType === 'lazyhstack') {
    // Spacer expansion — treat fill-width stack children as flexible like spacers.
    const isFlex = (c) => c.isSpacer || (c.type === 'stack' && c.widthMode === 'fill')
    const flexCount = children.filter(isFlex).length
    const fixedW = sizes.reduce((s, [cw], i) => s + (isFlex(children[i]) ? 0 : cw), 0)
    const totalGap = gap * Math.max(0, children.length - 1)
    const remaining = Math.max(0, innerW - fixedW - totalGap)
    const flexW = flexCount > 0 ? remaining / flexCount : 0

    const effectiveSizes = sizes.map(([cw, ch], i) =>
      isFlex(children[i]) ? [flexW, ch] : [cw, ch]
    )
    const totalW = effectiveSizes.reduce((s, [cw]) => s + cw, 0) + totalGap
    let x = -totalW / 2
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

  // ---- ZStack / ViewThatFits ----
  // ViewThatFits picks one child at runtime — we Z-stack on canvas so all
  // candidates remain visible to the designer.
  if (stack.stackType === 'zstack' || stack.stackType === 'viewThatFits') {
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
  const flexCount = children.filter(isFlexV).length
  const fixedH = sizes.reduce((s, [, ch], i) => s + (isFlexV(children[i]) ? 0 : ch), 0)
  const totalGap = gap * Math.max(0, children.length - 1)
  const available = innerH - headerH - footerH
  const remaining = Math.max(0, available - fixedH - totalGap)
  const flexH = flexCount > 0 ? remaining / flexCount : 0

  const effectiveSizes = sizes.map(([cw, ch], i) =>
    isFlexV(children[i]) ? [cw, flexH] : [cw, ch]
  )
  const totalH = effectiveSizes.reduce((s, [, ch]) => s + ch, 0) + totalGap
  let y = totalH / 2 + headerH / 2 - footerH / 2

  // Offset for asymmetric padding
  const padOffsetX = (pad.leading - pad.trailing) / 2
  const padOffsetY = (pad.top - pad.bottom) / 2

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
    } else if (stack.alignment === 'leading') {
      x = -innerW / 2 + cw / 2 + padOffsetX
    } else if (stack.alignment === 'trailing') {
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
