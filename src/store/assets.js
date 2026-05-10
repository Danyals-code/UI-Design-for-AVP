// Assets slice — user-imported 3D meshes (USDZ / GLB) and images
// stored alongside the scene. Asset records live in a flat array
// like `items`, with `parentId` pointing into the asset folder
// hierarchy. The data itself (mesh / image bytes) is held inline as
// a base64 data URL so a project survives reloads without a backing
// server. For very large meshes this is heavy; we cap individual
// imports at ~25 MB to keep the store snappy.
//
// Each record looks like:
//   { id, kind: 'folder' | 'asset',
//     name, parentId,
//     // for kind === 'asset':
//     assetType: 'mesh' | 'image',
//     fileName, fileSize, mimeType,
//     dataUrl,           // base64 payload
//     thumbnailUrl }     // small preview (images only — meshes
//                        // get a generic icon in the panel UI)
//
// Drag-from-panel-into-scene is wired through `pendingDropAsset`:
// the panel sets it on dragstart, the canvas reads it on drop and
// instantiates a model entity referencing the asset.

let _idCounter = 1
const nextId = () => `asset-${Date.now().toString(36)}-${_idCounter++}`

const MAX_ASSET_BYTES = 25 * 1024 * 1024  // 25 MB

export const ASSET_LIMITS = { MAX_BYTES: MAX_ASSET_BYTES }

// Sniff the file's MIME type and intent (mesh vs image). Anything
// else is rejected with a console warning — the panel surfaces the
// rejection by simply not adding it to the list.
function classifyFile(file) {
  const name = (file.name || '').toLowerCase()
  const mime = file.type || ''
  if (mime.startsWith('image/')) return { assetType: 'image', mimeType: mime || 'image/*' }
  if (name.endsWith('.usdz')) return { assetType: 'mesh', mimeType: 'model/vnd.usdz+zip' }
  if (name.endsWith('.glb'))  return { assetType: 'mesh', mimeType: 'model/gltf-binary' }
  if (name.endsWith('.gltf')) return { assetType: 'mesh', mimeType: 'model/gltf+json' }
  if (name.endsWith('.obj'))  return { assetType: 'mesh', mimeType: 'model/obj' }
  return null
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

export function createAssetsSlice(set, get) {
  return {
    // ---- actions ----

    // Create a folder under `parentId` (null = root). Returns the new id.
    createAssetFolder: (name, parentId = null) => {
      const id = nextId()
      set((s) => ({
        assets: [...s.assets, { id, kind: 'folder', name: name || 'New Folder', parentId }]
      }))
      return id
    },

    renameAsset: (id, name) => set((s) => ({
      assets: s.assets.map((a) => a.id === id ? { ...a, name } : a)
    })),

    deleteAsset: (id) => set((s) => {
      // Cascade-delete: if it's a folder, drop everything under it
      // recursively. Cheaper than walking parents on every render.
      const toDelete = new Set([id])
      let grew = true
      while (grew) {
        grew = false
        for (const a of s.assets) {
          if (toDelete.has(a.parentId) && !toDelete.has(a.id)) {
            toDelete.add(a.id); grew = true
          }
        }
      }
      return { assets: s.assets.filter((a) => !toDelete.has(a.id)) }
    }),

    moveAsset: (id, parentId) => set((s) => {
      // Refuse moves that would orphan the parent inside one of its
      // own descendants — would create a cycle.
      const descendants = new Set([id])
      let grew = true
      while (grew) {
        grew = false
        for (const a of s.assets) {
          if (descendants.has(a.parentId) && !descendants.has(a.id)) {
            descendants.add(a.id); grew = true
          }
        }
      }
      if (parentId && descendants.has(parentId)) return s
      return { assets: s.assets.map((a) => a.id === id ? { ...a, parentId } : a) }
    }),

    // Import a list of File objects (from a drop event or file
    // picker). Skips unsupported types and over-sized files.
    importAssets: async (files, parentId = null) => {
      const records = []
      for (const file of files) {
        const klass = classifyFile(file)
        if (!klass) {
          console.warn('[assets] unsupported file skipped:', file.name)
          continue
        }
        if (file.size > MAX_ASSET_BYTES) {
          console.warn('[assets] file too large skipped:', file.name, file.size)
          continue
        }
        const dataUrl = await readAsDataURL(file)
        records.push({
          id: nextId(),
          kind: 'asset',
          name: file.name,
          parentId,
          assetType: klass.assetType,
          mimeType: klass.mimeType,
          fileName: file.name,
          fileSize: file.size,
          dataUrl,
          // Image previews are the data URL itself; meshes use a
          // generic placeholder rendered by the panel.
          thumbnailUrl: klass.assetType === 'image' ? dataUrl : null
        })
      }
      if (records.length) {
        set((s) => ({ assets: [...s.assets, ...records] }))
      }
      return records.map((r) => r.id)
    },

    // Drag-and-drop hand-off: the panel sets this when a drag begins,
    // the canvas reads it on drop, the canvas clears it on drop end.
    setPendingDropAsset: (assetId) => set({ pendingDropAsset: assetId }),
    clearPendingDropAsset: () => set({ pendingDropAsset: null }),

    // Drop an asset into the scene as a new model entity. We can't
    // ray-cast the canvas drop coordinates from the store (no camera
    // handle), so the entity lands at the default chest-height
    // position; the user can nudge afterwards. Mesh assets become
    // USDZ-typed model entities (the asset's data URL is recorded in
    // `usdzAssetUrl`). Image assets currently log a warning — image
    // import as a textured plane is a follow-up.
    spawnAssetIntoScene: (assetId) => {
      const state = get()
      const asset = state.assets.find((a) => a.id === assetId)
      if (!asset || asset.kind !== 'asset') return null
      // Find the active scene's seed anchor to parent under, falling
      // back to the active tab so we never orphan the entity.
      const items = state.items
      const activeTabId = state.activeTabId
      const anchor = items.find((it) =>
        it.type === 'entity' && it.entityKind === 'anchor' &&
        // walk-up: tab → window → anchor; we just match any anchor
        // descended from the active tab via parentId chain.
        descendantOfTab(items, it.id, activeTabId)
      )
      const parentId = anchor?.id || activeTabId
      if (asset.assetType === 'image') {
        console.warn('[assets] image-as-plane spawn not yet implemented; use a USDZ / GLB asset')
        return null
      }
      // Defer to the entities slice so the new item flows through the
      // same undo / selection / make-visible plumbing as a SHIFT+A add.
      // `addEntity(kind, { parentId, overrides })` is the established
      // contract — `overrides` becomes the per-entity field bundle.
      const addEntity = state.addEntity
      if (typeof addEntity !== 'function') {
        console.warn('[assets] addEntity action missing — cannot spawn')
        return null
      }
      return addEntity('model', {
        parentId,
        overrides: {
          meshType: 'usdz',
          name: asset.name.replace(/\.[^.]+$/, ''),
          usdzAssetName: asset.fileName,
          usdzAssetUrl: asset.dataUrl,
          usdzAssetId: asset.id
        }
      })
    }
  }
}

function descendantOfTab(items, id, tabId) {
  let cur = items.find((i) => i.id === id)
  while (cur && cur.parentId) {
    if (cur.parentId === tabId) return true
    cur = items.find((i) => i.id === cur.parentId)
  }
  return cur?.id === tabId
}

// Initial state for the assets slice — included alongside the slice
// actions in the root store. An empty assets list means the panel
// shows its empty-state CTA on first run.
export const ASSETS_INITIAL_STATE = {
  assets: [],
  pendingDropAsset: null
}
