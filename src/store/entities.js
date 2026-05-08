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
import {
  makeEntity, makeMaterial
} from './factories'
import {
  meshDefaults, materialDefaults, ANCHOR_DEFAULTS,
  childKindsAllowedUnder
} from '../realityKit/registry'

// Pick the first legal parent for a new entity if no `parentId` is
// supplied. Tries the current selection first, then walks up to the
// nearest ancestor that accepts entity children, then falls back to the
// first RealityView panel under the active tab.
function resolveDefaultParent(state) {
  const items = state.items
  const find = (id) => items.find((it) => it.id === id) || null

  // 1. current selection — or its first ancestor that accepts entities
  let cursor = find(state.selectedId)
  while (cursor) {
    if (childKindsAllowedUnder(cursor).length > 0) return cursor.id
    cursor = find(cursor.parentId)
  }

  // 2. first RealityView panel anywhere on the active tab
  const onActiveTab = (it) => {
    let p = it
    while (p && p.parentId) p = find(p.parentId)
    return p && p.id === state.activeTabId
  }
  const rv = items.find(
    (it) => it.type === 'panel' && it.panelType === 'realityview' && onActiveTab(it)
  )
  if (rv) return rv.id

  // 3. first volumetric window on the active tab
  const vol = items.find(
    (it) => it.type === 'window' && it.windowStyle === 'volumetric' && onActiveTab(it)
  )
  if (vol) return vol.id

  return null
}

export const createEntitiesSlice = (set, get) => ({
  // ---- creation -------------------------------------------------------

  addEntity: (entityKind, opts = {}) => undoable(set, get, (s) => {
    const parentId = opts.parentId ?? resolveDefaultParent(s)
    if (!parentId) return s
    const ent = makeEntity(entityKind, { parentId, ...opts.overrides })
    return {
      items: [...s.items, ent],
      selectedId: ent.id
    }
  }),

  // Convenience wrappers — match the addStack/addWindow ergonomics in
  // the existing slices.
  addAnchorEntity: (opts) => get().addEntity('anchor', opts),
  addModelEntity:  (meshType, opts = {}) =>
    get().addEntity('model', { ...opts, overrides: { meshType, ...opts.overrides } }),
  addGroupEntity:  (opts) => get().addEntity('group', opts),

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

      const next = { ...stripped, entityKind: nextKind }
      if (nextKind === 'anchor') Object.assign(next, ANCHOR_DEFAULTS)
      if (nextKind === 'model') {
        Object.assign(next, { meshType: 'box', ...meshDefaults('box') })
        next.materials = [makeMaterial('simple')]
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
