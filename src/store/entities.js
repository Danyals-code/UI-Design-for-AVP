// Entity-specific store actions (RealityKit).
//
// Generic CRUD (selection, rename, visibility, remove, move) is shared
// with every other item type via the items slice — entities live in the
// same flat `items[]` array. This slice owns the actions that don't make
// sense on tabs / windows / stacks / panels:
//
//   addEntity            — append a new entity under any legal parent
//   setEntityKind        — switch anchor → model → group while keeping the
//                          tree wiring intact
//   setMeshType          — swap a model's mesh, splicing in new defaults
//   setAnchorTarget      — swap an anchor's target (world/head/hand/...)
//   addMaterial          — append a material slot to a model entity
//   removeMaterial       — remove a material slot
//   updateMaterial       — patch a single material in the list
//   reorderMaterial      — drag-style index swap inside materials[]
//   toggleComponent      — flip a visual component's `enabled` flag
//   updateComponent      — patch a single component's fields
//
// All actions are undoable. Selection moves to the new entity for the
// `add*` actions so the inspector shows it immediately.

import { undoable } from './undo'
import { findOwningTab, uniqueNameInTab } from './helpers'
import {
  makeEntity, makeMaterial, makeAnchorEntity, makePanel,
  makeWindow, makeTab
} from './factories'
import {
  meshDefaults, materialDefaults, ANCHOR_DEFAULTS,
  childKindsAllowedUnder
} from '../realityKit/registry'
import { ptToUnits, VOLUME_PRESETS } from '../appleSystem'

// Pick where a freshly-created RealityView panel should land. Mirrors the
// addPanel slice's parent resolution: prefer a stack inside the current
// selection's window, fall back to the first stack/window on the active
// tab. Returns null only if there's no window in the document at all.
function pickRealityViewParent(state) {
  const find = (id) => state.items.find((it) => it.id === id) || null
  const sel = find(state.selectedId)
  if (sel) {
    if (sel.type === 'stack')  return sel.id
    if (sel.type === 'window') {
      const firstStack = state.items.find(
        (it) => it.type === 'stack' && it.parentId === sel.id
      )
      return firstStack ? firstStack.id : sel.id
    }
    if (sel.type === 'panel' || sel.type === 'entity') {
      // Walk up to the nearest stack — that's the closest legal RV parent.
      let cur = sel
      while (cur && cur.type !== 'stack' && cur.type !== 'window') {
        cur = find(cur.parentId)
      }
      if (cur) return cur.id
    }
    // Tab selection falls through to active-tab lookup below.
  }
  const firstWindow = state.items.find(
    (it) => it.type === 'window' && it.parentId === state.activeTabId
  ) || state.items.find((it) => it.type === 'window')
  if (firstWindow) {
    const firstStack = state.items.find(
      (it) => it.type === 'stack' && it.parentId === firstWindow.id
    )
    return firstStack ? firstStack.id : firstWindow.id
  }
  return null
}

// Build a volumetric WindowGroup with sensible defaults. Used by
// `ensureEntityHost` when the user has deleted every host in volume mode
// (or never had one) — adding a volumetric window is the "any" entity's
// real prerequisite, since RealityKit needs a scene to live inside.
function buildVolumetricWindow(parentId) {
  const p = VOLUME_PRESETS.medium
  return makeWindow({
    name: 'Volume',
    parentId,
    windowStyle: 'volumetric',
    size: [ptToUnits(p.width), ptToUnits(p.height)],
    // Volume container sits AT the floor (world origin). That way the
    // World Anchor child — a designer-only floor pin — visibly lands
    // on the demo scene's floor rather than floating in mid-air. New
    // entities receive a chest-height offset themselves (see
    // `makeModelEntity` defaults) so they still spawn dead-centre of
    // the wearer's view.
    position: [0, 0, 0],
    color: '#202024',
    colorToken: null,
    cornerRadius: ptToUnits(24)
  })
}

// Resolve the parent for a new entity AND create any missing
// prerequisites so a cold click on "Sphere Entity" always lands somewhere
// visible. The chain we materialise (when missing):
//
//   active tab → window → (RealityView panel or use volumetric window
//                          directly) → AnchorEntity → entity
//
// In volume mode we'd rather drop entities directly under a volumetric
// window than wrap them in a RealityView (the window IS a RealityView in
// volumetric scenes). In window mode we wrap in a RealityView panel so
// the SwiftUI tree retains its bridge.
//
// Returns:
//   { items, parentId } — the working items array (with prerequisites
//   appended in order) and the id of the entity's immediate parent.
//   Always succeeds in volume mode (a tab + volumetric window will be
//   synthesised if needed). Falls back to `parentId: null` only if
//   window mode has no window at all and we genuinely can't seed one.
//
// Selection takes precedence: if the user is editing inside an existing
// entity tree, we drop the new entity in there without rewriting it.
function ensureEntityHost(state, entityKind) {
  const items = state.items
  const findIn = (list, id) => list.find((it) => it.id === id) || null
  const isVolumeMode = state.scene?.sceneMode === 'volume'

  // 1. Selection-aware: walk up from the current selection until we find
  //    an item that accepts entity children. This is the existing-tree
  //    case — no prerequisites needed.
  let cursor = findIn(items, state.selectedId)
  while (cursor && childKindsAllowedUnder(cursor).length === 0) {
    cursor = findIn(items, cursor.parentId)
  }
  let parentId = cursor ? cursor.id : null
  let working = items
  let activeTabId = state.activeTabId

  // 2. No selection-based host: hunt for any RealityView panel or
  //    volumetric window already on the active tab.
  if (!parentId) {
    const onActiveTab = (it) => {
      let p = it
      while (p && p.parentId) p = findIn(working, p.parentId)
      return p && p.id === activeTabId
    }
    // Volume mode prefers volumetric windows; window mode prefers RV panels.
    if (isVolumeMode) {
      const vol = working.find(
        (it) => it.type === 'window' && it.windowStyle === 'volumetric' && onActiveTab(it)
      )
      if (vol) parentId = vol.id
      if (!parentId) {
        const rv = working.find(
          (it) => it.type === 'panel' && it.panelType === 'realityview' && onActiveTab(it)
        )
        if (rv) parentId = rv.id
      }
    } else {
      const rv = working.find(
        (it) => it.type === 'panel' && it.panelType === 'realityview' && onActiveTab(it)
      )
      if (rv) parentId = rv.id
      if (!parentId) {
        const vol = working.find(
          (it) => it.type === 'window' && it.windowStyle === 'volumetric' && onActiveTab(it)
        )
        if (vol) parentId = vol.id
      }
    }
  }

  // 3. Still no host. In volume mode synthesise a volumetric window
  //    directly (and a tab if needed). In window mode create a
  //    RealityView panel inside the active tab's first stack/window.
  if (!parentId) {
    if (isVolumeMode) {
      // Make sure there's a tab to hang the window off of.
      let tab = working.find((it) => it.type === 'tab' && it.id === activeTabId)
      if (!tab) {
        tab = working.find((it) => it.type === 'tab')
        if (!tab) {
          tab = makeTab({ name: 'Volume', icon: 'cube' })
          working = [...working, tab]
        }
        activeTabId = tab.id
      }
      const vol = buildVolumetricWindow(tab.id)
      working = [...working, vol]
      parentId = vol.id
    } else {
      const rvParent = pickRealityViewParent({ ...state, items: working })
      if (!rvParent) return { items: working, parentId: null, activeTabId }
      const rv = makePanel('realityview', { parentId: rvParent })
      working = [...working, rv]
      parentId = rv.id
    }
  }

  // 4. For non-anchor entity kinds, ensure the parent chain contains an
  //    AnchorEntity. Anchors are RealityKit's spatial roots — a model
  //    sitting outside any anchor has no world reference. We either
  //    reuse an existing anchor child of the chosen host or insert a
  //    fresh `.world` anchor and parent the entity to that.
  if (entityKind !== 'anchor') {
    let cur = findIn(working, parentId)
    let hasAnchor = false
    while (cur) {
      if (cur.type === 'entity' && cur.entityKind === 'anchor') {
        hasAnchor = true
        break
      }
      cur = findIn(working, cur.parentId)
    }
    if (!hasAnchor) {
      const existingAnchor = working.find(
        (it) => it.type === 'entity' && it.entityKind === 'anchor' && it.parentId === parentId
      )
      if (existingAnchor) {
        parentId = existingAnchor.id
      } else {
        const anchor = makeAnchorEntity({ parentId })
        working = [...working, anchor]
        parentId = anchor.id
      }
    }
  }

  return { items: working, parentId, activeTabId }
}

export const createEntitiesSlice = (set, get) => ({
  // ---- creation -------------------------------------------------------

  addEntity: (entityKind, opts = {}) => undoable(set, get, (s) => {
    // Explicit parent (drag-drop, programmatic adds) skips prerequisite
    // creation — the caller knows where they want the entity.
    if (opts.parentId) {
      const ent = makeEntity(entityKind, { parentId: opts.parentId, ...opts.overrides })
      const tab = findOwningTab(s.items, opts.parentId)
      if (tab) ent.name = uniqueNameInTab(s.items, tab.id, ent.name)
      return { items: [...s.items, ent], selectedId: ent.id }
    }
    // Cold-click path: ensure RealityView + Anchor exist, then drop the
    // entity at the leaf. All in one undoable transaction. activeTabId
    // is also returned so a freshly-synthesised tab takes focus.
    const { items: working, parentId, activeTabId } = ensureEntityHost(s, entityKind)
    if (!parentId) return s
    const ent = makeEntity(entityKind, { parentId, ...opts.overrides })
    const tab = findOwningTab(working, parentId)
    if (tab) ent.name = uniqueNameInTab(working, tab.id, ent.name)
    return {
      items: [...working, ent],
      selectedId: ent.id,
      activeTabId: activeTabId ?? s.activeTabId
    }
  }),

  // Convenience wrappers — match the addStack/addWindow ergonomics in
  // the existing slices.
  addAnchorEntity: (opts) => get().addEntity('anchor', opts),
  addModelEntity:  (meshType, opts = {}) =>
    get().addEntity('model', { ...opts, overrides: { meshType, ...opts.overrides } }),
  addGroupEntity:  (opts) => get().addEntity('group', opts),
  addCameraEntity: (opts) => get().addEntity('camera', opts),
  addAttachmentEntity: (attachmentKind, opts = {}) =>
    get().addEntity('attachment', { ...opts, overrides: { attachmentKind, ...opts.overrides } }),

  // ---- kind / mesh / anchor switches ---------------------------------

  // Switch an entity from one kind to another, preserving id, name,
  // parent, transform, and components. Used by the Kind segmented
  // control in EntityProps.
  setEntityKind: (id, nextKind) => undoable(set, get, (s) => ({
    items: s.items.map((it) => {
      if (it.id !== id || it.type !== 'entity' || it.entityKind === nextKind) return it
      // Strip kind-specific fields the new kind won't read; splice in
      // the new kind's defaults.
      const stripped = { ...it }
      // Anchor fields
      delete stripped.anchorTarget
      delete stripped.handChirality
      delete stripped.handLocation
      delete stripped.planeAlignment
      delete stripped.planeClassification
      delete stripped.planeMinimumBounds
      delete stripped.imageGroup
      delete stripped.imageName
      delete stripped.objectGroup
      delete stripped.objectName
      // Model fields
      delete stripped.meshType
      delete stripped.materials
      // Mesh-specific dimensional fields
      delete stripped.boxSize
      delete stripped.boxCornerRadius
      delete stripped.sphereRadius
      delete stripped.cylinderHeight
      delete stripped.cylinderRadius
      delete stripped.coneHeight
      delete stripped.coneRadius
      delete stripped.planeWidth
      delete stripped.planeDepth
      delete stripped.planeCornerRadius
      delete stripped.textValue
      delete stripped.textExtrusionDepth
      delete stripped.textFontSize
      delete stripped.textAlignment
      delete stripped.textLineBreakMode
      delete stripped.textContainerFrame
      delete stripped.usdzAsset
      delete stripped.usdzAnimationName
      // Camera fields
      delete stripped.fovDegrees
      delete stripped.near
      delete stripped.far
      // Attachment fields
      delete stripped.attachmentKind
      delete stripped.attachmentText
      delete stripped.attachmentSymbol
      delete stripped.attachmentColor
      delete stripped.attachmentBackground
      delete stripped.attachmentFontSize
      delete stripped.attachmentPadding
      delete stripped.attachmentCornerRadius
      delete stripped.attachmentSize
      delete stripped.attachmentImageUrl
      delete stripped.attachmentBillboard

      const next = { ...stripped, entityKind: nextKind }
      if (nextKind === 'anchor') Object.assign(next, ANCHOR_DEFAULTS)
      if (nextKind === 'model') {
        Object.assign(next, { meshType: 'box', ...meshDefaults('box') })
        next.materials = [makeMaterial('simple')]
      }
      if (nextKind === 'camera') {
        Object.assign(next, { fovDegrees: 60, near: 0.1, far: 50 })
      }
      if (nextKind === 'attachment') {
        Object.assign(next, {
          attachmentKind: 'text',
          attachmentText: 'Hello',
          attachmentColor: '#ffffff',
          attachmentBackground: '#1c1c1e',
          attachmentFontSize: 0.05,
          attachmentPadding: 0.02,
          attachmentCornerRadius: 0.02,
          attachmentBillboard: true
        })
      }
      return next
    })
  })),

  setMeshType: (id, meshType) => undoable(set, get, (s) => ({
    items: s.items.map((it) => {
      if (it.id !== id || it.type !== 'entity' || it.entityKind !== 'model') return it
      if (it.meshType === meshType) return it
      // Strip the previous mesh's dimensional fields so stale values
      // don't leak across mesh switches (a Box's `boxSize` makes no
      // sense on a Sphere).
      const next = { ...it }
      delete next.boxSize
      delete next.boxCornerRadius
      delete next.sphereRadius
      delete next.cylinderHeight
      delete next.cylinderRadius
      delete next.coneHeight
      delete next.coneRadius
      delete next.planeWidth
      delete next.planeDepth
      delete next.planeCornerRadius
      delete next.textValue
      delete next.textExtrusionDepth
      delete next.textFontSize
      delete next.textAlignment
      delete next.textLineBreakMode
      delete next.textContainerFrame
      delete next.usdzAsset
      delete next.usdzAnimationName
      return { ...next, meshType, ...meshDefaults(meshType) }
    })
  })),

  setAnchorTarget: (id, target) => undoable(set, get, (s) => ({
    items: s.items.map((it) =>
      it.id === id && it.type === 'entity' && it.entityKind === 'anchor'
        ? { ...it, anchorTarget: target }
        : it
    )
  })),

  // ---- materials ------------------------------------------------------

  addMaterial: (entityId, materialType = 'simple') => undoable(set, get, (s) => ({
    items: s.items.map((it) => {
      if (it.id !== entityId || it.type !== 'entity' || it.entityKind !== 'model') return it
      const list = Array.isArray(it.materials) ? it.materials : []
      return { ...it, materials: [...list, makeMaterial(materialType)] }
    })
  })),

  removeMaterial: (entityId, materialId) => undoable(set, get, (s) => ({
    items: s.items.map((it) => {
      if (it.id !== entityId || it.type !== 'entity' || it.entityKind !== 'model') return it
      const list = (it.materials || []).filter((m) => m.id !== materialId)
      // Always keep at least one slot — RealityKit needs >=1 material on
      // a ModelEntity. The next-best UX is to swap to a default Simple
      // rather than ship an entity with no materials.
      const next = list.length === 0 ? [makeMaterial('simple')] : list
      return { ...it, materials: next }
    })
  })),

  updateMaterial: (entityId, materialId, patch) => undoable(set, get, (s) => ({
    items: s.items.map((it) => {
      if (it.id !== entityId || it.type !== 'entity' || it.entityKind !== 'model') return it
      return {
        ...it,
        materials: (it.materials || []).map((m) => (m.id === materialId ? { ...m, ...patch } : m))
      }
    })
  })),

  // Switch a material's *type* (Simple → PBR / Unlit / etc). Like
  // `setMeshType`, this strips type-specific keys and splices in the
  // new type's defaults so the inspector and exporter never read fields
  // that don't belong to the active material class.
  setMaterialType: (entityId, materialId, nextType) => undoable(set, get, (s) => ({
    items: s.items.map((it) => {
      if (it.id !== entityId || it.type !== 'entity' || it.entityKind !== 'model') return it
      return {
        ...it,
        materials: (it.materials || []).map((m) => {
          if (m.id !== materialId || m.type === nextType) return m
          return { id: m.id, type: nextType, ...materialDefaults(nextType) }
        })
      }
    })
  })),

  reorderMaterial: (entityId, fromIndex, toIndex) => undoable(set, get, (s) => ({
    items: s.items.map((it) => {
      if (it.id !== entityId || it.type !== 'entity' || it.entityKind !== 'model') return it
      const list = [...(it.materials || [])]
      if (fromIndex < 0 || fromIndex >= list.length) return it
      const [moved] = list.splice(fromIndex, 1)
      const dest = Math.max(0, Math.min(list.length, toIndex))
      list.splice(dest, 0, moved)
      return { ...it, materials: list }
    })
  })),

  // ---- components -----------------------------------------------------

  toggleComponent: (entityId, componentKey) => undoable(set, get, (s) => ({
    items: s.items.map((it) => {
      if (it.id !== entityId || it.type !== 'entity') return it
      const cur = it.components?.[componentKey]
      if (!cur) return it
      return {
        ...it,
        components: {
          ...it.components,
          [componentKey]: { ...cur, enabled: !cur.enabled }
        }
      }
    })
  })),

  updateComponent: (entityId, componentKey, patch) => undoable(set, get, (s) => ({
    items: s.items.map((it) => {
      if (it.id !== entityId || it.type !== 'entity') return it
      const cur = it.components?.[componentKey]
      if (!cur) return it
      return {
        ...it,
        components: {
          ...it.components,
          [componentKey]: { ...cur, ...patch }
        }
      }
    })
  })),

  // ---- transform ------------------------------------------------------
  //
  // Convenience wrappers around updateItem for the inspector's transform
  // section. Splitting axes from the array makes useScrub-style numeric
  // scrubbing painless to wire (one onChange per axis instead of array
  // gymnastics in every callback).

  setEntityPosition: (id, axis, value) => undoable(set, get, (s) => ({
    items: s.items.map((it) => {
      if (it.id !== id || it.type !== 'entity') return it
      const next = [...(it.position || [0, 0, 0])]
      next[axis] = value
      return { ...it, position: next }
    })
  })),

  setEntityRotation: (id, axis, value) => undoable(set, get, (s) => ({
    items: s.items.map((it) => {
      if (it.id !== id || it.type !== 'entity') return it
      const next = [...(it.rotation || [0, 0, 0])]
      next[axis] = value
      return { ...it, rotation: next }
    })
  })),

  setEntityScale: (id, axis, value) => undoable(set, get, (s) => ({
    items: s.items.map((it) => {
      if (it.id !== id || it.type !== 'entity') return it
      const next = [...(it.scale || [1, 1, 1])]
      next[axis] = value
      return { ...it, scale: next }
    })
  })),

  setEntityScaleUniform: (id, value) => undoable(set, get, (s) => ({
    items: s.items.map((it) =>
      it.id === id && it.type === 'entity'
        ? { ...it, scale: [value, value, value] }
        : it
    )
  }))
})
