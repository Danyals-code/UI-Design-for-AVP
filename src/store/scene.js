// Scene-level settings: design vs viewport color scheme, window/volume preset,
// HDRI, grid + pan-mode toggles, zoom distance.

import { WINDOW_PRESETS, VOLUME_PRESETS, ptToUnits } from '../appleSystem'
import { undoable } from './undo'
import { buildTemplate, TEMPLATES } from '../templates'
import { WIZARDS, hasWizard } from '../wizards/registry'
import { findTargetWindow } from './helpers'

// Default seed used when switchSceneMode lands on a mode without an
// explicit template choice. Volume → empty stage, window → blank app.
const DEFAULT_SEED_FOR_MODE = {
  window: 'blank',
  volume: 'emptyVolume'
}

export const createSceneSlice = (set, get) => ({
  setZoomDistance: (d) => set({ zoomDistance: d }),
  toggleGridAxis: (axis) => set((s) => ({
    gridAxes: { ...s.gridAxes, [axis]: !s.gridAxes[axis] }
  })),
  togglePanMode: () => set((s) => ({ panMode: !s.panMode })),
  toggleAxes:    () => set((s) => ({ showAxes: !s.showAxes })),
  toggleSceneInfo: () => set((s) => ({ showSceneInfo: !s.showSceneInfo })),
  toggleDemoScene: () => set((s) => ({
    scene: { ...s.scene, showDemoScene: !s.scene.showDemoScene }
  })),

  // Replace the entire scene with a template's items. Undoable so the user
  // can recover their previous work by hitting ⌘Z. The template's `mode`
  // metadata drives sceneMode — picking a volume template auto-flips the
  // scene into volume mode. Selection + active tab reset to the seed.
  applyTemplate: (key) => undoable(set, get, (s) => {
    const seed = buildTemplate(key)
    if (!seed) return s
    const tplMode = TEMPLATES[key]?.mode || 'window'
    return {
      items: seed.items,
      activeTabId: seed.activeTabId,
      selectedId: null,
      editingId: null,
      // Both modes now share the same 3D studio experience by default,
      // so we leave `preview3D` alone — the user sees the wearer's VR
      // view of their window straight after picking a template,
      // matching the depth-rich preview volume mode offers.
      scene: { ...s.scene, sceneMode: tplMode },
      // Pristine — applying a template explicitly resets the dirty flag
      // so the user doesn't get prompted on the next mode switch.
      sceneIsDirty: false
    }
  }),

  // Hard-replace the scene with a fresh seed for the requested mode. Used
  // by the viewport's Window/Volume toggle. Always undoable so ⌘Z can
  // recover the prior scene; resets the dirty flag the same way template
  // application does.
  switchSceneMode: (nextMode) => undoable(set, get, (s) => {
    if (s.scene.sceneMode === nextMode) return s
    const seedKey = DEFAULT_SEED_FOR_MODE[nextMode] || 'blank'
    const seed = buildTemplate(seedKey)
    if (!seed) return s
    return {
      items: seed.items,
      activeTabId: seed.activeTabId,
      selectedId: null,
      editingId: null,
      // `preview3D` carries over — window mode opens in the wearer's VR
      // view by default (the new app-wide default), and we don't want a
      // mode switch to silently flip the camera back to a flat plate.
      scene: { ...s.scene, sceneMode: nextMode },
      sceneIsDirty: false
    }
  }),

  // Preview-only navigation: which window is presented at the camera
  // pose right now. Not undoable — preview clicks shouldn't pollute
  // the undo stack. Falls back gracefully if the requested id is not
  // a window in the current scene.
  setActiveWindow: (id) => set((s) => {
    const target = s.items.find((it) => it.id === id && it.type === 'window')
    if (!target) return s
    return { scene: { ...s.scene, activeWindowId: id } }
  }),

  // Click a pill in the WindowGroupTabBar: switch active group and
  // reset the open set to just the primary representative of that
  // group. All previously-open windows from other groups disappear
  // (matches the user's "switch to other tab and both disappear"
  // expectation). Not undoable — navigation isn't an editor edit.
  setActiveWindowGroup: (gid) => set((s) => {
    if (!gid) return s
    const primary = s.items.find(
      (it) => it.type === 'window' && it.windowGroupId === gid && it.parentId === s.activeTabId
    )
    if (!primary) return s
    return {
      scene: {
        ...s.scene,
        activeWindowGroupId: gid,
        openWindowItemIds: [primary.id],
        activeWindowId: primary.id
      }
    }
  }),

  // The `.openWindow(id:)` environment action. The button's tap action
  // stores the *item id* the user picked in the inspector; firing the
  // action looks up that item and:
  //   - if its windowGroupId matches the currently-active group, appends
  //     the item to `openWindowItemIds` (so it spawns alongside the
  //     existing windows on the right) — matches SwiftUI's "open another
  //     instance of this WindowGroup" behaviour.
  //   - if it belongs to a different group, switches the active group and
  //     replaces the open set with just that one item.
  // No-op if the item is already in the open set (a second tap on the
  // same button doesn't duplicate the window).
  openWindowByItem: (itemId) => set((s) => {
    const target = s.items.find((it) => it.id === itemId && it.type === 'window')
    if (!target) return s
    const targetGid = target.windowGroupId || target.name || target.id
    // Resolve the *effective* active group and open set. The scene
    // doesn't seed these on initial load (a fresh design has no notion
    // of "which group is active") — the renderer computes defaults
    // from the items each frame. The first tap action lands while the
    // scene fields are still null, so we mirror the renderer's
    // resolution here to ensure the very first openWindow call counts
    // the already-rendered main window as "already open" and APPENDS
    // the new item, rather than replacing it.
    const primary = s.items.find((it) => it.id === s.scene.primaryWindowId && it.type === 'window')
      || s.items.find((it) => it.type === 'window' && it.parentId === s.activeTabId)
    const activeGid = s.scene.activeWindowGroupId
      || primary?.windowGroupId
      || null
    let open = s.scene.openWindowItemIds && s.scene.openWindowItemIds.length > 0
      ? s.scene.openWindowItemIds
      : (primary ? [primary.id] : [])
    if (targetGid === activeGid) {
      if (open.includes(itemId)) return s
      return {
        scene: {
          ...s.scene,
          activeWindowGroupId: activeGid,
          openWindowItemIds: [...open, itemId],
          activeWindowId: itemId
        }
      }
    }
    return {
      scene: {
        ...s.scene,
        activeWindowGroupId: targetGid,
        openWindowItemIds: [itemId],
        activeWindowId: itemId
      }
    }
  }),

  // Preview-only: NavigationSplitView selection routing. Clicking a
  // sidebar row in preview dispatches this with the row's navTag; the
  // NavigationSplitView root's `activeDestination` updates and the
  // renderer hides every detail-slot child whose navTag doesn't match.
  // Not undoable — preview navigation shouldn't pollute the editor undo
  // stack.
  setActiveDestination: (navSplitId, navTag) => set((s) => ({
    items: s.items.map((it) =>
      (it.id === navSplitId && it.splitStyle)
        ? { ...it, activeDestination: navTag }
        : it
    )
  })),

  // Designer-set: which window opens first when the user enters
  // preview. Persisted on the scene so re-entering preview always
  // starts from the same plate.
  setPrimaryWindow: (id) => undoable(set, get, (s) => {
    return { scene: { ...s.scene, primaryWindowId: id } }
  }),

  // ---- SwiftUI action dispatcher --------------------------------
  //
  // Buttons / toggles can carry a `tapAction` whose `type` selects
  // one of the visual-navigation effects below. Mirrors the shape of
  // RealityKit behaviour actions but keeps the implementation small
  // — the editor wires up the action via the inspector, preview
  // dispatches it on click. The effect runs against the live store;
  // we don't push these to undo because they're preview-only state.
  //
  // Supported action types:
  //   - navigateWindow { windowId }            — swap active window
  //   - navigateTab    { stackId, tab }        — flip a TabView's tab
  //   - presentSheet   { panelId }             — show a sheet/popover/alert
  //   - dismiss        { panelId }             — hide a presentation panel
  //   - setToggle      { panelId, value }      — explicit on/off
  //   - flipToggle     { panelId }             — invert current value
  runTapAction: (action) => {
    if (!action || !action.type) return
    const state = get()
    switch (action.type) {
      case 'navigateWindow': {
        if (!action.windowId) return
        // Delegate to openWindowByItem so a tap on a button that targets
        // a same-group window spawns it alongside the existing windows
        // (instead of replacing). Different-group taps still switch.
        get().openWindowByItem(action.windowId)
        return
      }
      case 'navigateTab': {
        if (!action.stackId) return
        const stack = state.items.find((it) => it.id === action.stackId)
        if (!stack) return
        set((s) => ({
          items: s.items.map((it) => it.id === action.stackId ? { ...it, activeTab: action.tab ?? 0 } : it)
        }))
        return
      }
      case 'presentSheet':
      case 'dismiss': {
        if (!action.panelId) return
        set((s) => ({
          items: s.items.map((it) => it.id === action.panelId
            ? { ...it, visible: action.type === 'presentSheet' }
            : it
          )
        }))
        return
      }
      case 'setToggle': {
        if (!action.panelId) return
        set((s) => ({
          items: s.items.map((it) => it.id === action.panelId
            ? { ...it, toggleOn: !!action.value }
            : it
          )
        }))
        return
      }
      case 'flipToggle': {
        if (!action.panelId) return
        const cur = state.items.find((it) => it.id === action.panelId)
        if (!cur) return
        set((s) => ({
          items: s.items.map((it) => it.id === action.panelId
            ? { ...it, toggleOn: !it.toggleOn }
            : it
          )
        }))
        return
      }
      default:
        return
    }
  },

  // ---- Add-flow wizards -----------------------------------------------
  //
  // `pendingWizard` is the modal UI state. When non-null the
  // AddWizardDialog renders the schema in WIZARDS[kind] and the user
  // configures the structural properties (tab count, group/items
  // hierarchy, etc) up front. Submit calls `submitWizard(params)` which
  // runs the wizard's `build` or `proxy` to add the configured panels.
  pendingWizard: null,

  openWizard: (kind) => {
    if (!hasWizard(kind)) return
    const spec = WIZARDS[kind]
    // NavigationSplitView is a top-level shell: a window can host at
    // most one (SwiftUI's `NavigationSplitView` is a root container,
    // not a nestable view), and the wizard must place it directly
    // under the window — never nested inside an existing stack. Bail
    // here if the active window already has one so the user doesn't
    // end up with two split shells fighting for the same plate.
    if (kind === 'sidebar') {
      const state = get()
      const win = findTargetWindow(state)
      if (win) {
        const hasNavSplit = state.items.some(
          (it) => it.type === 'stack' && it.parentId === win.id && it.splitStyle
        )
        if (hasNavSplit) {
          // Surface via a window event so a future toast component can
          // render the message; for now this exits silently so the
          // wizard doesn't open in a broken state.
          window.dispatchEvent(new CustomEvent('wizard-blocked', {
            detail: { kind, reason: 'one-per-window' }
          }))
          return
        }
      }
    }
    set({ pendingWizard: { kind, values: spec.defaults } })
  },

  cancelWizard: () => set({ pendingWizard: null }),

  submitWizard: (values) => {
    const pending = get().pendingWizard
    if (!pending) return
    const spec = WIZARDS[pending.kind]
    if (!spec) { set({ pendingWizard: null }); return }
    // Proxy path: schema delegates entirely to an existing store action
    // (used by Toolbar — `addToolbar` already builds the slot layout).
    if (typeof spec.proxy === 'function') {
      spec.proxy(get(), values)
      set({ pendingWizard: null })
      return
    }
    // Build path: wizard builder constructs items keyed off the active
    // window. Wrapped in `undoable` so the user can hit ⌘Z to remove
    // the whole subtree if the configuration isn't what they wanted.
    //
    // `replace: true` from the builder signals a full items-array
    // rewrite (used by the sidebar wizard to reparent existing window
    // content into the new Detail column). Otherwise the returned
    // `items` is appended.
    undoable(set, get, (s) => {
      const win = findTargetWindow(s)
      if (!win) return s
      const result = spec.build(values, {
        windowId: win.id,
        parentId: win.id,
        items: s.items
      })
      if (!result || !result.items) return s
      const nextItems = result.replace ? result.items : [...s.items, ...result.items]
      return {
        items: nextItems,
        selectedId: result.selectedId || win.id
      }
    })
    set({ pendingWizard: null })
  },

  updateScene: (patch) => undoable(set, get, (s) => {
    const next = { ...s.scene, ...patch }
    // `preview3D` no longer gets reset on mode switches — both window
    // and volume modes render the same demo studio, and flipping
    // between them shouldn't silently take the wearer out of the VR
    // view they were just using.
    // Apply preset size changes to the root window.
    const items = s.items.map((it) => {
      if (it.type !== 'window') return it
      if (patch.windowPreset && next.sceneMode === 'window') {
        const p = WINDOW_PRESETS[patch.windowPreset]
        if (p) return { ...it, size: [ptToUnits(p.width), ptToUnits(p.height)] }
      }
      if (patch.volumePreset && next.sceneMode === 'volume') {
        const p = VOLUME_PRESETS[patch.volumePreset]
        if (p) return { ...it, size: [ptToUnits(p.width), ptToUnits(p.height)] }
      }
      return it
    })
    return { scene: next, items }
  })
})
