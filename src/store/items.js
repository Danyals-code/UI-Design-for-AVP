// Generic item operations: selection, edit, update, remove, rename, visibility,
// collapse, move. Type-specific behaviour (tab semantics, panel switching,
// stack wizards) lives in their respective slices.

import { undoable } from './undo'
import { isDescendantOf, findOwningTab, uniqueNameInTab } from './helpers'
import { childKindsAllowedUnder } from '../realityKit/registry'

// NavigationSplitView's sidebar-slot children (Header, section headers,
// Group lists) and their descendants are managed via the NavSplitView's
// inspector instead of the layer tree. Selecting one of them routes
// back to the owning NavSplitView so the user always edits the whole
// shell together — never an individual Header HStack or list item.
function resolveSelectId(items, id) {
  const target = items.find((it) => it.id === id)
  if (!target) return id
  // Walk up until we hit either the NavSplitView root or run out of
  // ancestors. Any sidebar-slot ancestor (or the item itself) tells us
  // the click should target the NavSplitView.
  let cursor = target
  let foundSlot = cursor.slot === 'sidebar'
  let nav = null
  while (cursor) {
    if (cursor.type === 'stack' && cursor.splitStyle) { nav = cursor; break }
    if (cursor.slot === 'sidebar') foundSlot = true
    cursor = items.find((it) => it.id === cursor.parentId) || null
  }
  if (foundSlot && nav) return nav.id
  return id
}

export const createItemsSlice = (set, get) => ({
  select: (id) => {
    const state = get()
    const next = id ? resolveSelectId(state.items, id) : id
    set({ selectedId: next, editingId: null })
  },
  setEditing:    (id) => set({ editingId: id, selectedId: id }),
  clearEditing:  ()   => set({ editingId: null }),

  updateItem: (id, patch) => undoable(set, get, (s) => ({
    items: s.items.map((it) => (it.id === id ? { ...it, ...patch } : it))
  })),

  renameItem: (id, name) => undoable(set, get, (s) => {
    // Tabs are top-level namespaces — they don't get the .copy
    // suffixing because tab names ARE the namespace.
    const target = s.items.find((it) => it.id === id)
    if (!target) return s
    let next = name
    if (target.type !== 'tab') {
      const tab = findOwningTab(s.items, id)
      if (tab) next = uniqueNameInTab(s.items, tab.id, name, id)
    }
    return {
      items: s.items.map((it) => (it.id === id ? { ...it, name: next } : it))
    }
  }),

  toggleVisibility: (id) => undoable(set, get, (s) => ({
    items: s.items.map((it) => (it.id === id ? { ...it, visible: !it.visible } : it))
  })),

  // toggleCollapse is non-undoable on purpose — flipping a layers row open
  // is UI state, not document state.
  toggleCollapse: (id) => set((s) => ({
    items: s.items.map((it) => (it.id === id ? { ...it, collapsed: !it.collapsed } : it))
  })),

  removeItem: (id) => undoable(set, get, (s) => {
    const target = s.items.find((it) => it.id === id)
    if (!target) return s
    // Block individual deletes of NavSplitView sidebar-slot structure
    // (Header, section headers, Group lists, and their descendants).
    // The user manages these from the NavSplitView inspector; removing
    // one piecemeal would orphan the rest. Returning unchanged state
    // is the safest no-op since `undoable` will then skip a history
    // entry for the failed delete.
    if (resolveSelectId(s.items, id) !== id) return s
    // Tab removal preserves the "keep at least one tab" invariant.
    if (target.type === 'tab') {
      const tabs = s.items.filter((it) => it.type === 'tab')
      if (tabs.length <= 1) return s
      const toRemove = new Set([id])
      let changed = true
      while (changed) {
        changed = false
        for (const it of s.items) {
          if (!toRemove.has(it.id) && it.parentId && toRemove.has(it.parentId)) {
            toRemove.add(it.id); changed = true
          }
        }
      }
      const nextItems = s.items.filter((it) => !toRemove.has(it.id))
      const nextTabs = nextItems.filter((it) => it.type === 'tab')
      return {
        items: nextItems,
        activeTabId: s.activeTabId === id ? nextTabs[0]?.id ?? null : s.activeTabId,
        selectedId: toRemove.has(s.selectedId) ? null : s.selectedId
      }
    }

    const toRemove = new Set([id])
    let changed = true
    while (changed) {
      changed = false
      for (const it of s.items) {
        if (!toRemove.has(it.id) && it.parentId && toRemove.has(it.parentId)) {
          toRemove.add(it.id)
          changed = true
        }
      }
    }
    // Repair `activeTab`/`activeChild` on any container whose indexed child
    // is being removed, so nothing renders past the end of the visible set.
    const items = s.items
      .filter((it) => !toRemove.has(it.id))
      .map((it) => {
        if (it.type !== 'stack') return it
        if (it.stackType === 'tabView') {
          const tabs = s.items.filter(
            (c) => c.parentId === it.id && !toRemove.has(c.id)
          )
          if (tabs.length > 0 && (it.activeTab ?? 0) >= tabs.length) {
            return { ...it, activeTab: Math.max(0, tabs.length - 1) }
          }
        }
        if (it.stackType === 'navigationStack') {
          const kids = s.items.filter(
            (c) => c.parentId === it.id && !toRemove.has(c.id)
          )
          if (kids.length > 0 && (it.activeChild ?? 0) >= kids.length) {
            return { ...it, activeChild: Math.max(0, kids.length - 1) }
          }
        }
        return it
      })
    return {
      items,
      selectedId: toRemove.has(s.selectedId) ? null : s.selectedId
    }
  }),

  moveItem: (sourceId, targetId, mode) => undoable(set, get, (s) => {
    if (!sourceId || !targetId || sourceId === targetId) return s
    const src = s.items.find((it) => it.id === sourceId)
    const tgt = s.items.find((it) => it.id === targetId)
    if (!src || !tgt) return s
    if (src.type === 'tab') return s  // tabs stay top-level
    if (isDescendantOf(s.items, tgt.id, src.id)) return s

    // A Window can only be re-parented to a Tab.
    if (src.type === 'window') {
      if (mode === 'inside' && tgt.type !== 'tab') return s
      if (mode !== 'inside' && tgt.type !== 'window') return s
    }

    // An Entity can only land where childKindsAllowedUnder permits its
    // entityKind. For 'inside' drops we check the target directly; for
    // 'before'/'after' we check the target's parent (the entity becomes
    // a sibling of the target).
    if (src.type === 'entity') {
      const allowedHost = mode === 'inside'
        ? tgt
        : s.items.find((it) => it.id === tgt.parentId) || null
      const allowed = childKindsAllowedUnder(allowedHost)
      if (!allowed.includes(src.entityKind)) return s
    }

    const items = s.items.filter((it) => it.id !== sourceId)
    let newParentId
    let insertIdx
    // Allowed "inside" targets: stack, window, or tab (the latter only for
    // windows). Entity hosts (RealityView panel / volumetric window /
    // entity) are also valid — childKindsAllowedUnder is the source of
    // truth and was already checked above for entity sources.
    const canDropInside =
      (tgt.type === 'stack' || tgt.type === 'window' || tgt.type === 'tab' ||
       tgt.type === 'entity' ||
       (tgt.type === 'panel' && tgt.panelType === 'realityview'))
    if (mode === 'inside' && canDropInside) {
      newParentId = tgt.id
      let last = items.findIndex((it) => it.id === targetId)
      for (let i = last + 1; i < items.length; i++) {
        if (items[i].parentId === tgt.id) last = i
      }
      insertIdx = last + 1
    } else {
      newParentId = tgt.parentId
      const tIdx = items.findIndex((it) => it.id === targetId)
      insertIdx = mode === 'before' ? tIdx : tIdx + 1
    }
    if (!newParentId) return s  // can't orphan (windows must live under a tab)
    const moved = { ...src, parentId: newParentId }
    items.splice(insertIdx, 0, moved)

    // Auto-expand the destination container so the moved row doesn't appear
    // to vanish into a collapsed folder.
    const items2 = items.map((it) =>
      it.id === newParentId && it.collapsed ? { ...it, collapsed: false } : it
    )
    return { items: items2 }
  })
})
