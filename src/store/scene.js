// Scene-level settings: design vs viewport color scheme, window/volume preset,
// HDRI, grid + pan-mode toggles, zoom distance.

import { WINDOW_PRESETS, VOLUME_PRESETS, ptToUnits } from '../appleSystem'
import { undoable } from './undo'

export const createSceneSlice = (set, get) => ({
  setZoomDistance: (d) => set({ zoomDistance: d }),
  toggleGrid:    () => set((s) => ({ showGrid: !s.showGrid })),
  togglePanMode: () => set((s) => ({ panMode: !s.panMode })),

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
