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
  // Assets are part of the document, so importing, renaming, recolouring,
  // deleting or re-foldering one has to be undoable like every other edit.
  // The records are shallow-copied: `dataUrl` is an immutable string shared
  // by reference, so history costs one pointer per asset, not a copy of the
  // payload.
  assets: (s.assets || []).map((a) => ({ ...a })),
  selectedId: s.selectedId,
  activeTabId: s.activeTabId,
  scene: { ...s.scene },
  // `sceneIsDirty` is captured so that undoing back to a template/seed
  // state restores the "pristine" flag — switching modes from there can
  // skip the destructive-action warning dialog.
  sceneIsDirty: !!s.sceneIsDirty,
  idCounter: getIdCounter()
})

// The document fields a snapshot restores. A mutation that leaves every one
// of them untouched did not change the document, so it must not cost the
// user a history entry. `_past` / `_future` are excluded on purpose: they
// are the history itself, not part of the state being versioned.
const UNDOABLE_KEYS = ['items', 'assets', 'selectedId', 'activeTabId', 'scene']

// Did `patch` actually change anything worth undoing? Slice guards bail by
// returning the state object unchanged (`return s`), so the common no-op is
// caught by identity alone; comparing per-field as well covers a partial
// patch that happens to re-set a field to the value it already held. Keys
// absent from the patch are left alone by zustand's merge, so they cannot
// represent a change.
//
// This is an identity comparison, not a deep one, which is exactly right
// here: every slice builds new arrays and objects (`map` / `filter` /
// spread) rather than mutating in place, so a changed document always
// arrives as a fresh reference.
const changesDocument = (patch, before) =>
  UNDOABLE_KEYS.some((k) => k in patch && patch[k] !== before[k])

// Wraps a zustand set() call so a real edit pushes an undo snapshot.
// During drags we skip snapshots — drag-start captures one instead.
//
// The mutation runs BEFORE the snapshot is committed, because roughly forty
// guards across the slices refuse an illegal edit by returning state
// unchanged (deleting the last tab, reparenting a node into its own
// subtree, an unknown id). Snapshotting first recorded history for those
// too, which cost the user a phantom Cmd-Z that restored an identical state
// and appeared to do nothing — the next Cmd-Z was the one that finally
// reversed their last real edit. It also flipped `sceneIsDirty` on a scene
// nothing had touched, firing the "switching modes resets your scene"
// warning against a pristine document.
//
// Every slice action is a synchronous pure updater, so calling it here and
// handing the result to `set` is equivalent to `set(fn)`.
//
// Sets `sceneIsDirty: true` by default; actions that *replace* the scene
// (applyTemplate, switchSceneMode) override this in their fn() return —
// hence the patch spreading last — so the freshly seeded scene starts
// pristine.
export const undoable = (set, get, fn) => {
  const before = get()
  const patch = typeof fn === 'function' ? fn(before) : fn
  if (!patch) return

  // A refused edit still applies its patch (it may carry UI-only fields),
  // but leaves history and the dirty flag untouched.
  if (!changesDocument(patch, before) || before.isDragging) {
    set(patch)
    return
  }

  set({
    _past: [...before._past, snapshot(before)].slice(-MAX_UNDO),
    _future: [],
    sceneIsDirty: true,
    ...patch
  })
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
      assets: prev.assets ?? s.assets,
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
      assets: next.assets ?? s.assets,
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
