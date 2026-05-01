// Tabs (top-level pages). A Tab owns one or more Windows. The scene always
// keeps at least one Tab — `removeTab` is a no-op on the last one.

import { undoable } from './undo'
import { makeTab } from './factories'

export const createTabsSlice = (set, get) => ({
  // Switch the active tab. Clears selection so the Properties panel doesn't
  // keep pointing at an item in a now-hidden tab.
  selectTab: (id) => set((s) => {
    if (!s.items.find((it) => it.id === id && it.type === 'tab')) return s
    return { activeTabId: id, selectedId: null, editingId: null }
  }),

  addTab: ({ name, icon } = {}) => undoable(set, get, (s) => {
    const count = s.items.filter((it) => it.type === 'tab').length
    const tab = makeTab({
      name: name || `Tab ${count + 1}`,
      icon: icon || 'folder'
    })
    return {
      items: [...s.items, tab],
      activeTabId: tab.id,
      selectedId: tab.id
    }
  }),

  // Remove a tab and every window/stack/panel it owns. Keeps at least one tab
  // in the scene — if the user tries to remove the last one, we leave it.
  removeTab: (id) => undoable(set, get, (s) => {
    const tabs = s.items.filter((it) => it.type === 'tab')
    if (tabs.length <= 1) return s
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
    const nextItems = s.items.filter((it) => !toRemove.has(it.id))
    const nextTabs = nextItems.filter((it) => it.type === 'tab')
    const nextActive = s.activeTabId === id ? nextTabs[0]?.id ?? null : s.activeTabId
    return {
      items: nextItems,
      activeTabId: nextActive,
      selectedId: toRemove.has(s.selectedId) ? null : s.selectedId
    }
  }),

  renameTab: (id, name) => undoable(set, get, (s) => ({
    items: s.items.map((it) =>
      it.id === id && it.type === 'tab' ? { ...it, name } : it
    )
  })),

  setTabIcon: (id, icon) => undoable(set, get, (s) => ({
    items: s.items.map((it) =>
      it.id === id && it.type === 'tab' ? { ...it, icon } : it
    )
  }))
})
