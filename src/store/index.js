// Root store. Composes the per-domain slices into a single zustand store.
//
// Each slice is `(set, get) => ({ ...actions })`. Slices share state on the
// root via set/get — no slice owns its own subtree. This keeps the public
// API identical to the pre-split monolithic store: every consumer keeps
// using `useStore((s) => s.someAction)` exactly as before.

import { create } from 'zustand'
import { seedScene, DEFAULT_SCENE } from './factories'
import { createUndoSlice } from './undo'
import { createTabsSlice } from './tabs'
import { createSceneSlice } from './scene'
import { createWindowsSlice } from './windows'
import { createStacksSlice } from './stacks'
import { createPanelsSlice } from './panels'
import { createItemsSlice } from './items'
import { createClipboardSlice } from './clipboard'
import { createEntitiesSlice } from './entities'

export { isEffectivelyVisible } from './helpers'

const _seed = seedScene()

export const useStore = create((set, get) => ({
  // ---- state ----
  items:        _seed.items,
  activeTabId:  _seed.activeTabId,
  selectedId:   null,
  editingId:    null,
  isDragging:   false,
  clipboard:    null,
  // Grid is per-axis — each entry toggles a grid plane perpendicular to that
  // axis (e.g. `gridY` is the floor, `gridZ` is the back wall, `gridX` is a
  // side wall). Mirrors Blender's "Floor / X / Y" axis toggles in the overlay
  // popover. The legacy `showGrid` boolean is retained as a coarse off-switch
  // (false = hide all grids).
  gridAxes:     { x: false, y: true, z: false },
  panMode:      false,
  showAxes:     true,    // Overlay → Axes (the 3D-preview gizmo)
  showSceneInfo: false,  // Overlay → Scene Info (Blender-style stats panel)
  scene:        { ...DEFAULT_SCENE },
  // 1.4m default camera distance — comfortable framing for a 1.2m
  // window plate or a 1m volumetric stage at the new metres scale.
  zoomDistance: 1.4,
  // template apply, or scene-mode switch. Drives whether the
  // "switching modes resets your scene" warning fires when the viewport
  // mode toggle is clicked. Marked `true` by `undoable`; reset to
  // `false` by template/mode-switch actions in their own fn() return.
  sceneIsDirty: false,
  // Persistent open/closed state for collapsible inspector sections,
  // keyed by section title. Without this, every time the user clicks
  // a different layer the inspector remounts and Sections lose their
  // local open state — surprising when the user expected the section
  // they opened to stay open. Non-undoable: it's UI state, not document.
  inspectorSectionOpen: {},
  setInspectorSectionOpen: (key, open) => set((s) => ({
    inspectorSectionOpen: { ...s.inspectorSectionOpen, [key]: open }
  })),
  // Transform-gizmo mode for the selected entity. Mirrors Blender's
  // G / R / S muscle memory — picks which `<TransformControls>` mode
  // (translate / rotate / scale) is rendered on the canvas. `none`
  // hides the gizmo (default — the gizmo would otherwise occlude the
  // mesh when the user is just inspecting). Non-undoable.
  transformMode: 'none',  // 'none' | 'translate' | 'rotate' | 'scale'
  // 'gizmo'  — clicked the toolbar button: render a drei
  //            <TransformControls> handle on the entity and let the
  //            user drag the visible gizmo. Camera orbit stays usable
  //            because the gizmo eats only the handle pointer events.
  // 'modal'  — pressed G / R / S on the keyboard: cursor-driven
  //            Blender-style modal (no visible handle, every cursor
  //            move updates the transform until click-to-confirm or
  //            Esc to revert).
  transformKind: 'gizmo',
  // Axis constraint while in modal mode (Blender-style chord). Null
  // means free; 'x' / 'y' / 'z' clamps the modal delta to that axis.
  // Reset on each modal entry; toggled by pressing the X / Y / Z keys
  // after picking a tool.
  transformAxis: null,
  setTransformMode: (mode, kind = 'gizmo') => set({
    transformMode: mode,
    transformKind: kind,
    // Re-entering a tool clears the prior axis constraint — keeps the
    // chord stateless across tool switches.
    transformAxis: null
  }),
  setTransformAxis: (axis) => set({ transformAxis: axis }),
  // (zoomDistance defined above at metres scale)

  // Undo / redo stacks (internal, not rendered directly)
  _past:   [],
  _future: [],

  // ---- actions (composed from slices) ----
  ...createUndoSlice(set, get),
  ...createSceneSlice(set, get),
  ...createTabsSlice(set, get),
  ...createWindowsSlice(set, get),
  ...createStacksSlice(set, get),
  ...createPanelsSlice(set, get),
  ...createItemsSlice(set, get),
  ...createClipboardSlice(set, get),
  ...createEntitiesSlice(set, get)
}))
