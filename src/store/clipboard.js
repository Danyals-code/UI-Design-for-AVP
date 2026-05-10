// Copy / paste of subtrees. The clipboard stores a deep snapshot rooted at
// the copied item plus all descendants, so paste can reproduce the full
// hierarchy with fresh ids.

import { undoable } from './undo'
import { nextId } from './factories'
import { findOwningTab, uniqueNameInTab } from './helpers'

export const createClipboardSlice = (set, get) => ({
  // Stash a deep subtree snapshot on the clipboard so paste can reproduce the
  // full hierarchy (was previously losing children of a copied stack).
  copyItem: (id) => set((s) => {
    const root = s.items.find((it) => it.id === id)
    if (!root || root.type === 'tab' || root.type === 'window') return s
    const collect = (parentId) =>
      s.items.filter((it) => it.parentId === parentId).flatMap((c) => [c, ...collect(c.id)])
    const subtree = [root, ...collect(root.id)].map((it) => ({ ...it }))
    return { clipboard: { rootId: root.id, items: subtree } }
  }),

  pasteItem: () => undoable(set, get, (s) => {
    if (!s.clipboard) return s
    // Back-compat with the old single-item shape.
    if (!s.clipboard.items) {
      const c = s.clipboard
      const newItem = {
        ...c,
        id: nextId(c.type === 'panel' ? 'panel' : 'stack'),
        name: `${c.name} copy`
      }
      return { items: [...s.items, newItem], selectedId: newItem.id }
    }

    const { rootId, items: subtree } = s.clipboard
    const idMap = new Map()
    for (const it of subtree) {
      const prefix = it.type === 'panel' ? 'panel' : it.type === 'stack' ? 'stack' : it.type
      idMap.set(it.id, nextId(prefix))
    }

    // Drop the paste into the selection if it's a valid parent, otherwise
    // reparent to the original root's parent (usually its former sibling).
    const oldRoot = subtree.find((it) => it.id === rootId)
    const sel = s.items.find((it) => it.id === s.selectedId)
    let newRootParent = oldRoot?.parentId ?? null
    if (sel && (sel.type === 'stack' || sel.type === 'window')) {
      newRootParent = sel.id
    }

    const cloned = subtree.map((it) => ({
      ...it,
      id: idMap.get(it.id),
      parentId: it.id === rootId
        ? newRootParent
        : idMap.get(it.parentId) ?? it.parentId,
      name: it.name
    }))
    // Run the new subtree through `uniqueNameInTab` so a paste into
    // the same tab (or one that already has a same-named layer)
    // suffixes `.copy`, `.copy2`, etc. — same scheme as user renames.
    const newRootId = idMap.get(rootId)
    const tabId = findOwningTab([...s.items, ...cloned], newRootId)?.id
    if (tabId) {
      // Build the unique-name set incrementally so multiple new
      // siblings with the same name each get their own suffix.
      const working = [...s.items]
      for (const c of cloned) {
        const next = uniqueNameInTab(working, tabId, c.name)
        c.name = next
        working.push(c)
      }
    }
    return {
      items: [...s.items, ...cloned],
      selectedId: newRootId
    }
  })
})
