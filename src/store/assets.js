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

    // Tag a folder (or asset) with a colour swatch. Stored as a hex
    // string so the panel can paint the folder glyph + a thin label
    // accent. `null` clears the colour back to the neutral default.
    setAssetColor: (id, color) => set((s) => ({
      assets: s.assets.map((a) => a.id === id ? { ...a, color: color || null } : a)
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

    // Drop an asset into the scene. Routes by asset type:
    //   - mesh  → model entity (USDZ/GLB), parented under the active
    //     scene's anchor so it renders in the volumetric tree
    //   - image → image panel, parented under the explicit target
    //     (when dropped on a layer row) or the active stack (when
    //     dropped on the viewport)
    //
    // `options.parentId` lets callers override the default destination
    // — used by the layers-panel drop handler so the asset lands where
    // the user pointed.
    spawnAssetIntoScene: (assetIdOrRecord, options = {}) => {
      const state = get()
      // Accept either an id (real user asset) or a full record (virtual
      // built-in samples — their data isn't persisted in `state.assets`).
      const asset = typeof assetIdOrRecord === 'string'
        ? state.assets.find((a) => a.id === assetIdOrRecord)
        : assetIdOrRecord
      if (!asset || asset.kind !== 'asset') return null
      const items = state.items
      const activeTabId = state.activeTabId

      // ---- Image asset: spawn an image panel ------------------------
      if (asset.assetType === 'image') {
        // Default destination: the first content stack inside the
        // active window. Falling back to the window itself ensures the
        // image still lands somewhere visible even when no stack exists.
        const win = items.find(
          (it) => it.type === 'window' && it.parentId === activeTabId
        ) ?? items.find((it) => it.type === 'window')
        const firstStack = win && items.find(
          (it) => it.parentId === win.id && it.type === 'stack'
        )
        const parentId = options.parentId || firstStack?.id || win?.id
        if (!parentId) return null
        const addPanel = state.addPanel
        if (typeof addPanel !== 'function') return null
        // Use the existing addPanel/undoable plumbing by temporarily
        // selecting the target — keeps the flow consistent with Shift+A.
        const prevSelected = state.selectedId
        state.select?.(parentId)
        addPanel('image')
        // The new panel is now the last item; patch it with the asset
        // URL so the renderer can paint it immediately.
        const after = get()
        const created = after.items[after.items.length - 1]
        if (created && created.panelType === 'image') {
          after.updateItem(created.id, {
            imageUrl: asset.dataUrl,
            name: asset.name.replace(/\.[^.]+$/, '')
          })
        }
        // Restore the prior selection only if the user wasn't already
        // pointing at the parent (so we don't yank focus away from a
        // freshly-spawned panel they likely want to keep selected).
        if (prevSelected && prevSelected !== parentId && created) {
          state.select?.(created.id)
        }
        return created?.id || null
      }

      // ---- Mesh asset: spawn a model entity -------------------------
      const anchor = items.find((it) =>
        it.type === 'entity' && it.entityKind === 'anchor' &&
        descendantOfTab(items, it.id, activeTabId)
      )
      const parentId = options.parentId || anchor?.id || activeTabId
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
