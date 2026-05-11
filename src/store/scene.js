// Scene-level settings: design vs viewport color scheme, window/volume preset,
// HDRI, grid + pan-mode toggles, zoom distance.

import { WINDOW_PRESETS, VOLUME_PRESETS, ptToUnits } from '../appleSystem'
import { undoable } from './undo'
import { buildTemplate, TEMPLATES } from '../templates'

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
