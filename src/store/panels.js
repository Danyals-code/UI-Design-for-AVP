// Panel-level actions: add, switch type, presentations (sheet/popover/alert),
// and the text-style applier.

import { TEXT_STYLES, ptToUnits } from '../appleSystem'
import { panelDefaults } from '../panels/registry'
import { undoable } from './undo'
import { makePanel } from './factories'
import { findTargetWindow } from './helpers'

export const createPanelsSlice = (set, get) => ({
  addPanel: (panelType) => undoable(set, get, (s) => {
    // New panels live inside the current selection's nearest stack, or the
    // first stack in the active tab's first window if nothing relevant is
    // selected. Tabs are not valid panel parents — they only hold windows.
    let parentId = null
    const sel = s.items.find((it) => it.id === s.selectedId)
    if (sel) {
      if (sel.type === 'stack') parentId = sel.id
      else if (sel.type === 'window') {
        const firstStack = s.items.find((it) => it.parentId === sel.id && it.type === 'stack')
        parentId = firstStack ? firstStack.id : sel.id
      } else if (sel.type === 'tab') {
        // fall through to window-lookup below
      } else {
        parentId = sel.parentId
      }
    }
    if (!parentId) {
      const firstWindow = s.items.find(
        (it) => it.type === 'window' && it.parentId === s.activeTabId
      ) ?? s.items.find((it) => it.type === 'window')
      const firstStack = firstWindow && s.items.find(
        (it) => it.parentId === firstWindow.id && it.type === 'stack'
      )
      parentId = firstStack ? firstStack.id : firstWindow?.id
    }
    if (!parentId) return s
    const p = makePanel(panelType, { parentId })
    return { items: [...s.items, p], selectedId: p.id }
  }),

  // Presentation: add a sheet/alert/popover as a child of the current Window.
  addPresentation: (panelType) => undoable(set, get, (s) => {
    const win = findTargetWindow(s)
    if (!win) return s
    const p = makePanel(panelType, { parentId: win.id })
    return { items: [...s.items, p], selectedId: p.id }
  }),

  // Switch a panel's panelType while preserving shared fields (position,
  // modifiers, etc.). Size is taken from the new type's default so each
  // variant gets sensible dimensions — the user can still resize afterwards.
  switchPanelType: (id, newType) => undoable(set, get, (s) => {
    const defaults = panelDefaults(newType)
    return {
      items: s.items.map((it) => {
        if (it.id !== id || it.type !== 'panel') return it
        // Start from the new type's defaults, then layer identity/placement/
        // meta from the original. Order matters: defaults first, identity last.
        return {
          ...defaults,
          id: it.id,
          type: 'panel',
          panelType: newType,
          name: it.name,
          parentId: it.parentId,
          visible: it.visible,
          position: it.position,
          modifiers: it.modifiers,
          styles: it.styles,
          animation: it.animation,
          accessibility: it.accessibility
        }
      })
    }
  }),

  applyTextStyle: (id, styleKey) => undoable(set, get, (s) => {
    const style = TEXT_STYLES[styleKey]
    if (!style) return s
    return {
      items: s.items.map((it) =>
        it.id === id
          ? {
              ...it,
              textStyle: styleKey,
              fontSize: ptToUnits(style.pt),
              fontWeight: style.weight
            }
          : it
      )
    }
  })
})
