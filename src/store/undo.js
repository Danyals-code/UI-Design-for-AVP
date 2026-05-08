// Undo / redo + the `undoable` wrapper that every mutating slice uses.
//
// Snapshot captures the data that undoable mutations touch (items, selection,
// active tab, scene, idCounter). UI-only state (isDragging, clipboard,
// editingId) is excluded — undoing into a stale dragging/editing flag would
// be confusing.
//
// idCounter lives in factories.js as a module-scoped variable. We import
// getIdCounter/setIdCounter so undo can capture and restore it; without
// this, undoing a paste would leak ids and the next nextId() would clash.

import { getIdCounter, setIdCounter } from './factories'

export const MAX_UNDO = 50

const snapshot = (s) => ({
  items: s.items.map((it) => ({ ...it })),
  selectedId: s.selectedId,
  activeTabId: s.activeTabId,
  scene: { ...s.scene },
  // `sceneIsDirty` is captured so that undoing back to a template/seed
  // state restores the "pristine" flag — switching modes from there can
  // skip the destructive-action warning dialog.
  sceneIsDirty: !!s.sceneIsDirty,
  idCounter: getIdCounter()
})

// Wraps a zustand set() call so it pushes an undo snapshot first.
// During drags we skip snapshots — drag-start captures one instead.
//
// Sets `sceneIsDirty: true` by default; actions that *replace* the scene
// (applyTemplate, switchSceneMode) override this in their fn() return so
// the freshly seeded scene starts pristine.
export const undoable = (set, get, fn) => {
  const s = get()
  if (!s.isDragging) {
    const snap = snapshot(s)
    const past = [...s._past, snap].slice(-MAX_UNDO)
    set({ _past: past, _future: [], sceneIsDirty: true })
  }
  set(fn)
}

export const createUndoSlice = (set, get) => ({
  undo: () => set((s) => {
    if (s._past.length === 0) return s
    const prev = s._past[s._past.length - 1]
    const future = [snapshot(s), ...s._future].slice(0, MAX_UNDO)
    setIdCounter(prev.idCounter ?? getIdCounter())
    return {
      _past: s._past.slice(0, -1),
      _future: future,
      items: prev.items,
      selectedId: prev.selectedId,
      activeTabId: prev.activeTabId,
      scene: prev.scene,
      sceneIsDirty: !!prev.sceneIsDirty
    }
  }),

  redo: () => set((s) => {
    if (s._future.length === 0) return s
    const next = s._future[0]
    const past = [...s._past, snapshot(s)].slice(-MAX_UNDO)
    setIdCounter(next.idCounter ?? getIdCounter())
    return {
      _future: s._future.slice(1),
      _past: past,
      items: next.items,
      selectedId: next.selectedId,
      activeTabId: next.activeTabId,
      scene: next.scene,
      sceneIsDirty: !!next.sceneIsDirty
    }
  }),

  setDragging: (v) => {
    const s = get()
    // Capture one snapshot at drag-start so the whole drag is a single undo step.
    if (v && !s.isDragging) {
      const snap = snapshot(s)
      set({ isDragging: true, _past: [...s._past, snap].slice(-MAX_UNDO), _future: [] })
    } else {
      set({ isDragging: v })
    }
  }
})
