// Tree-walk helpers shared across slices.
//
// Pure functions over `items[]`. No store or set/get coupling — slices import
// them as needed. Kept tiny on purpose: anything more complex belongs in the
// slice that owns the mutation.

import { isInteractivePanel } from '../panels/registry'

export const isDescendantOf = (items, parentId, candidateId) => {
  if (!parentId) return false
  if (parentId === candidateId) return true
  const p = items.find((it) => it.id === parentId)
  return p ? isDescendantOf(items, p.parentId, candidateId) : false
}

export const findParent = (items, id) => items.find((it) => it.id === id)?.parentId

// Walks up from the current selection to find the owning Window. Falls back
// to the first Window in the active tab so "add ornament/toolbar" targets the
// page the user is actually editing.
export const findTargetWindow = (state) => {
  let cur = state.items.find((it) => it.id === state.selectedId)
  while (cur && cur.type !== 'window' && cur.parentId) {
    cur = state.items.find((it) => it.id === cur.parentId)
  }
  if (cur?.type === 'window') return cur
  return state.items.find((it) => it.type === 'window' && it.parentId === state.activeTabId)
      ?? state.items.find((it) => it.type === 'window')
}

// Walks up from any item to find the Tab it belongs to.
export const findOwningTab = (items, id) => {
  let cur = items.find((it) => it.id === id)
  while (cur) {
    if (cur.type === 'tab') return cur
    if (!cur.parentId) return null
    cur = items.find((it) => it.id === cur.parentId)
  }
  return null
}

// ---- name uniqueness within a tab ------------------------------------
//
// Each tab is its own namespace. Two layers in the SAME tab can't share
// a name — the second one is suffixed with `.copy`, `.copy2`, etc.
// Across tabs the names are free to collide, so a `Title` panel in a
// "Window" tab and a `Title` attachment in a "Volume" tab can later be
// linked by interaction wiring.
//
// `targetId` (when given) is excluded from the uniqueness check so a
// rename that doesn't actually change the name (or just changes case)
// doesn't trigger a self-collision.
export const uniqueNameInTab = (items, tabId, desired, targetId = null) => {
  if (!desired) return desired
  const taken = new Set()
  for (const it of items) {
    if (it.id === targetId) continue
    if (it.type === 'tab') continue
    if (findOwningTab(items, it.id)?.id !== tabId) continue
    if (it.name) taken.add(it.name)
  }
  if (!taken.has(desired)) return desired
  // Strip an existing `.copy` / `.copyN` suffix so renaming
  // "Sphere.copy" → "Sphere" inside a tab that has another "Sphere"
  // produces "Sphere.copy2" rather than "Sphere.copy.copy".
  const base = desired.replace(/\.copy(\d*)$/, '')
  let n = 1
  while (true) {
    const candidate = n === 1 ? `${base}.copy` : `${base}.copy${n}`
    if (!taken.has(candidate)) return candidate
    n += 1
  }
}

// Resolves a panel's effective hover effect. `inherit` walks up to the
// owning window's `spatial.hoverEffect`. Falls back to `automatic` (Apple's
// default for visionOS interactive views) when no window is found.
//
// Returns one of: 'automatic' | 'highlight' | 'lift' | 'none'.
//
// Non-interactive panels (Text, Image, Divider, shapes, gradients,
// presentations, indicators) always resolve to 'none' — visionOS doesn't
// apply hover affordances to them, so neither do we. This keeps the design
// preview honest with what SwiftUI actually does.
export const resolveHoverEffect = (panel, items) => {
  if (!panel || !isInteractivePanel(panel.panelType)) return 'none'
  const own = panel.hoverEffect
  if (own && own !== 'inherit') return own
  let cur = items.find((it) => it.id === panel.parentId)
  while (cur && cur.type !== 'window') {
    cur = items.find((it) => it.id === cur.parentId)
  }
  return cur?.spatial?.hoverEffect || 'automatic'
}

// Public — re-exported from the store entrypoint. An item is effectively
// visible only if it AND every ancestor are visible.
export const isEffectivelyVisible = (items, id) => {
  let cur = items.find((it) => it.id === id)
  while (cur) {
    if (!cur.visible) return false
    if (!cur.parentId) return true
    cur = items.find((it) => it.id === cur.parentId)
  }
  return true
}
