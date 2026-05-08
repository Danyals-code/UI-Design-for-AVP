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
  // DEFAULT_DIST (7) is treated as the 100%-zoom reference. Initial 85%
  // pct → zoomDistance = 7 / 0.85 ≈ 8.235, giving a comfortable framing
  // where the window takes most of the viewport without crowding the edges.
  zoomDistance: 7.0 / 0.85,

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
