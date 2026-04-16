// Stack layout engine — mirrors SwiftUI's VStack/HStack/ZStack/Grid/Section/
// DisclosureGroup/NavigationStack semantics. Given a stack item and its children,
// returns a map of { childId -> [x, y, z] } in local coordinates.

import { ptToUnits } from './appleSystem'

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

// ---- size computation ----

export function computeSize(item, items) {
  if (!item) return [0, 0]

  // Spacer: minimal size (layout engine expands it later).
  if (item.type === 'panel' && item.isSpacer) return [0, 0]

  if (item.type !== 'stack' && item.type !== 'window') {
    // Text auto-sizing: if size is null, estimate from content.
    if (item.size === null || item.size === undefined) {
      const text = item.text || ''
      const fontSize = item.fontSize || ptToUnits(17)
      const w = Math.max(ptToUnits(40), text.length * fontSize * 0.55)
      const h = fontSize * 1.5
      return [w, h]
    }
    return item.size || [0, 0]
  }

  if (item.type === 'window') return item.size || [2, 1]

  // Stack
  const fixedW = item.fixedWidth != null ? ptToUnits(item.fixedWidth) : null
  const fixedH = item.fixedHeight != null ? ptToUnits(item.fixedHeight) : null
  const pad = resolvePadding(item)

  const children = items.filter((c) => c.parentId === item.id && c.visible !== false)

  // Disclosure collapsed: only header height
  if (item.stackType === 'disclosure' && !item.expanded) {
    const headerH = ptToUnits(36)
    return [fixedW ?? ptToUnits(200), fixedH ?? (headerH + padH(pad))]
  }

  // Navstack: size of the active child only
  if (item.stackType === 'navstack') {
    const active = children[Math.min(item.activeChild ?? 0, children.length - 1)]
    if (!active) return [fixedW ?? padW(pad), fixedH ?? padH(pad)]
    const [cw, ch] = computeSize(active, items)
    const titleH = item.navTitle ? ptToUnits(40) : 0
    return [fixedW ?? (cw + padW(pad)), fixedH ?? (ch + titleH + padH(pad))]
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
  const gap = ptToUnits(item.spacing ?? 0)

  // Section: add header + footer height
  const headerH = (item.stackType === 'section' && item.sectionHeader) ? ptToUnits(28) : 0
  const footerH = (item.stackType === 'section' && item.sectionFooter) ? ptToUnits(22) : 0

  let w, h

  if (item.stackType === 'hstack' || item.stackType === 'lazyhstack') {
    w = sizes.reduce((s, [cw]) => s + cw, 0) + gap * Math.max(0, fixedChildren.length - 1) + padW(pad)
    h = (sizes.length ? Math.max(...sizes.map(([, ch]) => ch)) : 0) + padH(pad)
  } else if (item.stackType === 'zstack') {
    w = (sizes.length ? Math.max(...sizes.map(([cw]) => cw)) : 0) + padW(pad)
    h = (sizes.length ? Math.max(...sizes.map(([, ch]) => ch)) : 0) + padH(pad)
  } else if (item.stackType === 'grid') {
    const cols = item.columns || 2
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

// ---- child positioning ----

export function layoutStack(stack, items) {
  const children = items.filter((c) => c.parentId === stack.id && c.visible !== false)
  if (children.length === 0) return new Map()

  const pad = resolvePadding(stack)
  const [sw, sh] = computeSize(stack, items)
  const innerW = sw - padW(pad)
  const innerH = sh - padH(pad)
  const gap = ptToUnits(stack.spacing ?? 0)

  // Disclosure collapsed: no children rendered
  if (stack.stackType === 'disclosure' && !stack.expanded) return new Map()

  // Navstack: only the active child
  if (stack.stackType === 'navstack') {
    const idx = Math.min(stack.activeChild ?? 0, children.length - 1)
    const active = children[idx]
    if (!active) return new Map()
    const titleH = stack.navTitle ? ptToUnits(40) : 0
    const out = new Map()
    out.set(active.id, [0, -titleH / 2, 0])
    return out
  }

  const sizes = children.map((c) => computeSize(c, items))
  const out = new Map()

  // Section header/footer heights
  const headerH = (stack.stackType === 'section' && stack.sectionHeader) ? ptToUnits(28) : 0
  const footerH = (stack.stackType === 'section' && stack.sectionFooter) ? ptToUnits(22) : 0

  // ---- Grid ----
  if (stack.stackType === 'grid') {
    const cols = stack.columns || 2
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
    // Spacer expansion
    const spacerCount = children.filter((c) => c.isSpacer).length
    const fixedW = sizes.reduce((s, [cw], i) => s + (children[i].isSpacer ? 0 : cw), 0)
    const totalGap = gap * Math.max(0, children.length - 1)
    const remaining = Math.max(0, innerW - fixedW - totalGap)
    const spacerW = spacerCount > 0 ? remaining / spacerCount : 0

    const effectiveSizes = sizes.map(([cw, ch], i) =>
      children[i].isSpacer ? [spacerW, ch] : [cw, ch]
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

  // Spacer expansion
  const spacerCount = children.filter((c) => c.isSpacer).length
  const fixedH = sizes.reduce((s, [, ch], i) => s + (children[i].isSpacer ? 0 : ch), 0)
  const totalGap = gap * Math.max(0, children.length - 1)
  const available = innerH - headerH - footerH
  const remaining = Math.max(0, available - fixedH - totalGap)
  const spacerH = spacerCount > 0 ? remaining / spacerCount : 0

  const effectiveSizes = sizes.map(([cw, ch], i) =>
    children[i].isSpacer ? [cw, spacerH] : [cw, ch]
  )
  const totalH = effectiveSizes.reduce((s, [, ch]) => s + ch, 0) + totalGap
  let y = totalH / 2 + headerH / 2 - footerH / 2

  // Offset for asymmetric padding
  const padOffsetX = (pad.leading - pad.trailing) / 2
  const padOffsetY = (pad.top - pad.bottom) / 2

  for (let i = 0; i < children.length; i++) {
    const [cw, ch] = effectiveSizes[i]
    let x = padOffsetX
    // SwiftUI: leading = child's left edge at stack's left padding boundary
    if (stack.alignment === 'leading') x = -innerW / 2 + cw / 2 + padOffsetX
    else if (stack.alignment === 'trailing') x = innerW / 2 - cw / 2 + padOffsetX
    y -= ch / 2
    out.set(children[i].id, [x, y + padOffsetY, 0])
    y -= ch / 2 + gap
  }
  return out
}
