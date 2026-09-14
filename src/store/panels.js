// Panel-level actions: add, switch type, presentations (sheet/popover/alert),
// and the text-style applier.

import { TEXT_STYLES, ptToUnits } from '../appleSystem'
import { panelDefaults } from '../panels/registry'
import { filterModifiers } from '../modifiers/registry'
import { undoable } from './undo'
import { makePanel } from './factories'
import { findTargetWindow } from './helpers'

// 3D primitives live in space (RealityView / Model3D content), not inside a
// SwiftUI Stack — and visionOS treats them as free entities anchored to the
// window's volume. Routing them at window-level lets the user drag them
// freely; nesting inside a stack would force them into 1D stack layout and
// any drag offset would be discarded on the next layout pass. Mirrors how
// you'd write them in SwiftUI: `Model3D(...)` is a sibling of the content
// stack inside the WindowGroup body, not a child of it.
const PRIMITIVE_3D = new Set(['sphere', 'box', 'plane', 'cone', 'cylinder', 'text3d', 'mesh'])

// Chrome panels that always parent to the window directly. NavigationBar
// is exported as a `.toolbar { ... }` modifier on the window root; it
// would never sit inside a content stack in SwiftUI, so we mirror that
// in the editor — drops/adds always pin it to the active window and
// render it edge-to-edge across the top.
const WINDOW_LEVEL_PANELS = new Set(['navbar'])

export const createPanelsSlice = (set, get) => ({
  addPanel: (panelType) => undoable(set, get, (s) => {
    const is3D = PRIMITIVE_3D.has(panelType)
    const isWindowLevel = WINDOW_LEVEL_PANELS.has(panelType)
    let parentId = null
    const sel = s.items.find((it) => it.id === s.selectedId)
    if (is3D || isWindowLevel) {
      // 3D primitives + window chrome (navbar) always parent to the active
      // tab's first Window. They never sit inside a content stack — the
      // navbar exports as a `.toolbar { ... }` modifier on the window
      // root, and primitives are scene-level entities.
      const win = s.items.find(
        (it) => it.type === 'window' && it.parentId === s.activeTabId
      ) ?? s.items.find((it) => it.type === 'window')
      parentId = win?.id || null
    } else if (sel) {
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
      // Window-level chrome bypasses the auto-route-into-stack step so it
      // lands directly on the window even when nothing's selected.
      const firstStack = !is3D && !isWindowLevel && firstWindow && s.items.find(
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
          // Drop modifiers the new panel type doesn't accept (strict allow
          // list, e.g. `.disabled` only stays on interactive panels).
          modifiers: filterModifiers(it.modifiers, newType),
          styles: it.styles,
          animation: it.animation,
          accessibility: it.accessibility
        }
      })
    }
  }),

  // `fontSize` is deliberately NOT written here. Both the layout engine
  // (textMetrics) and the renderer resolve the point size from `textStyle`
  // whenever it is set, and it always is — so a stored `fontSize` was a
  // second copy of the same number that only the canvas read, while the
  // exporter emitted `.font(.<textStyle>)`. A divergent value would have
  // rendered and not exported. The read-side fallback stays for projects
  // saved before this, but nothing writes the field any more.
  applyTextStyle: (id, styleKey) => undoable(set, get, (s) => {
    const style = TEXT_STYLES[styleKey]
    if (!style) return s
    return {
      items: s.items.map((it) =>
        it.id === id
          ? { ...it, textStyle: styleKey, fontWeight: style.weight }
          : it
      )
    }
  })
})
