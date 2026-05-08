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
      scene: { ...s.scene, sceneMode: tplMode, preview3D: false },
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
      scene: { ...s.scene, sceneMode: nextMode, preview3D: false },
      sceneIsDirty: false
    }
  }),

  updateScene: (patch) => undoable(set, get, (s) => {
    const next = { ...s.scene, ...patch }
    // Switching sceneMode always resets the experimental 3D preview so the
    // user lands on the placeholder next time they open Volume mode.
    if (patch.sceneMode !== undefined && patch.sceneMode !== s.scene.sceneMode) {
      next.preview3D = false
    }
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
