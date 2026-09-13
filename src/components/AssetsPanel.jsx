// Assets panel — sits in the bottom half of the left sidebar. Lets the
// designer drag-drop or pick 3D meshes (USDZ / GLB / glTF / OBJ) and
// images, sort them into folders, and drag them into the scene as
// model entities.
//
// The panel is intentionally small in scope for v1:
//   * Browse one folder at a time, with a breadcrumb back to root.
//   * Drag-drop OS files OR click "Import" to pick.
//   * "+ New folder" creates a folder under the current path.
//   * Click an asset → opens a quick action menu (rename, delete).
//   * Drag an asset onto the canvas → spawns a model entity (handled
//     by Canvas3D's drop listener, which reads `pendingDropAsset`).
//
// Built-in starter meshes will live alongside user assets later; we
// surface the seam by treating folders / assets uniformly.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { TEMPLATES, TEMPLATE_ORDER_WINDOW, TEMPLATE_ORDER_VOLUME } from '../templates'
import { SearchIcon } from './icons'

// ---- Built-in templates folder -------------------------------------
//
// We surface the 12 packaged templates as a virtual folder tree right
// inside the Assets panel: `Templates → Window` (6 entries) and
// `Templates → Volume` (6 entries). These records aren't persisted in
// the `assets` array — they're synthesized at render time from the
// templates registry, so they always reflect whatever the codebase
// ships and never fall out of sync with the splash modal.
//
// IDs use a `tpl-` prefix to keep them out of the user-asset namespace.
// Clicking a template applies it via the store's `applyTemplate`
// action; clicking a folder navigates into it via `setCurrentFolder`.
const TPL_ROOT = 'tpl-root'
const TPL_WINDOW = 'tpl-window'
const TPL_VOLUME = 'tpl-volume'
const SAMP_ROOT   = 'samp-root'
const SAMP_IMAGES = 'samp-images'
const SAMP_MODELS = 'samp-models'

// Built-in sample media. The files live under `public/samples/...` so
// Vite serves them at a stable URL the panel can reference directly —
// no base64 inlining, no fetch on render. Adding a new sample is one
// line in this array (plus dropping the file in `public/samples/...`).
const SAMPLE_IMAGES = [
  { id: 'samp-img-1', name: 'Sample 01', url: '/samples/images/Sample 01.jpg', mimeType: 'image/jpeg' },
  { id: 'samp-img-2', name: 'Sample 02', url: '/samples/images/Sample 02.jpg', mimeType: 'image/jpeg' },
  { id: 'samp-img-3', name: 'Sample 03', url: '/samples/images/Sample 03.jpg', mimeType: 'image/jpeg' },
  { id: 'samp-img-4', name: 'Sample 04', url: '/samples/images/Sample 04.jpg', mimeType: 'image/jpeg' },
  { id: 'samp-img-5', name: 'Sample 05', url: '/samples/images/Sample 05.jpg', mimeType: 'image/jpeg' },
  { id: 'samp-img-6', name: 'Sample 06', url: '/samples/images/Sample 06.jpg', mimeType: 'image/jpeg' },
  { id: 'samp-img-7', name: 'Sample 07', url: '/samples/images/Sample 07.jpg', mimeType: 'image/jpeg' },
  { id: 'samp-img-8', name: 'Sample 08', url: '/samples/images/Sample 08.jpg', mimeType: 'image/jpeg' },
  { id: 'samp-img-9', name: 'Sample 09', url: '/samples/images/Sample 09.jpg', mimeType: 'image/jpeg' }
]
const SAMPLE_MODELS = []   // reserved — drop GLB/USDZ files in `public/samples/3d-models/` and add entries here.

function virtualTemplateRecord(key, parentId) {
  const t = TEMPLATES[key]
  if (!t) return null
  return {
    id: `tpl-${key}`,
    kind: 'template',
    name: t.label,
    description: t.description,
    parentId,
    templateKey: key,
    templateMode: t.mode
  }
}

// Build an asset record for a packaged sample. `kind: 'asset'` so the
// tile renders + drags like a real upload, but `virtual: true` blocks
// rename/delete on the UI side. The dataUrl/thumbnail point at the
// public-served URL so we never bake the bytes into the bundle.
function virtualSampleRecord(spec, parentId, assetType) {
  return {
    id: spec.id,
    kind: 'asset',
    name: spec.name,
    parentId,
    virtual: true,
    assetType,
    mimeType: spec.mimeType,
    fileName: spec.url.split('/').pop(),
    dataUrl: spec.url,
    thumbnailUrl: assetType === 'image' ? spec.url : null
  }
}

function getVirtualEntries(parentId) {
  if (parentId === null) {
    return [
      { id: TPL_ROOT,  kind: 'folder', name: 'Templates', parentId: null, virtual: true },
      { id: SAMP_ROOT, kind: 'folder', name: 'Samples',   parentId: null, virtual: true }
    ]
  }
  if (parentId === TPL_ROOT) {
    return [
      { id: TPL_WINDOW, kind: 'folder', name: 'Window', parentId: TPL_ROOT, virtual: true },
      { id: TPL_VOLUME, kind: 'folder', name: 'Volume', parentId: TPL_ROOT, virtual: true }
    ]
  }
  if (parentId === TPL_WINDOW) {
    return TEMPLATE_ORDER_WINDOW.map((k) => virtualTemplateRecord(k, TPL_WINDOW)).filter(Boolean)
  }
  if (parentId === TPL_VOLUME) {
    return TEMPLATE_ORDER_VOLUME.map((k) => virtualTemplateRecord(k, TPL_VOLUME)).filter(Boolean)
  }
  if (parentId === SAMP_ROOT) {
    return [
      { id: SAMP_IMAGES, kind: 'folder', name: 'Images',          parentId: SAMP_ROOT, virtual: true },
      { id: SAMP_MODELS, kind: 'folder', name: 'Sample 3D Models', parentId: SAMP_ROOT, virtual: true }
    ]
  }
  if (parentId === SAMP_IMAGES) {
    return SAMPLE_IMAGES.map((s) => virtualSampleRecord(s, SAMP_IMAGES, 'image'))
  }
  if (parentId === SAMP_MODELS) {
    return SAMPLE_MODELS.map((s) => virtualSampleRecord(s, SAMP_MODELS, 'mesh'))
  }
  return []
}

// Walk a virtual parent chain back to root for the breadcrumb.
function virtualCrumbs(folderId) {
  if (folderId === TPL_ROOT)    return [{ id: TPL_ROOT, name: 'Templates' }]
  if (folderId === TPL_WINDOW)  return [{ id: TPL_ROOT, name: 'Templates' }, { id: TPL_WINDOW, name: 'Window' }]
  if (folderId === TPL_VOLUME)  return [{ id: TPL_ROOT, name: 'Templates' }, { id: TPL_VOLUME, name: 'Volume' }]
  if (folderId === SAMP_ROOT)   return [{ id: SAMP_ROOT, name: 'Samples' }]
  if (folderId === SAMP_IMAGES) return [{ id: SAMP_ROOT, name: 'Samples' }, { id: SAMP_IMAGES, name: 'Images' }]
  if (folderId === SAMP_MODELS) return [{ id: SAMP_ROOT, name: 'Samples' }, { id: SAMP_MODELS, name: 'Sample 3D Models' }]
  return null
}

const VIRTUAL_FOLDER_IDS = new Set([
  TPL_ROOT, TPL_WINDOW, TPL_VOLUME,
  SAMP_ROOT, SAMP_IMAGES, SAMP_MODELS
])
const isVirtualFolder = (id) => VIRTUAL_FOLDER_IDS.has(id)

function ImportIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 1.5V8" />
      <path d="M3 5L6 8L9 5" />
      <path d="M2 10.5H10" />
    </svg>
  )
}

function FolderIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 3.5L1.5 11A1 1 0 002.5 12L11.5 12A1 1 0 0012.5 11L12.5 5.5A1 1 0 0011.5 4.5L6.5 4.5L5 3L2.5 3A1 1 0 001.5 4Z" />
    </svg>
  )
}

function MeshIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1.5L12 4L12 10L7 12.5L2 10L2 4Z" />
      <path d="M2 4L7 6.5L12 4" />
      <path d="M7 6.5L7 12.5" />
    </svg>
  )
}

function ImageIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2" width="11" height="10" rx="1.5" />
      <circle cx="5" cy="5.5" r="1" />
      <path d="M2 11L5.5 7.5L8 9.5L10 7.5L12.5 10" />
    </svg>
  )
}

// Template tile icon — distinct from folder/asset/image so users can
// see at a glance that a tile applies a packaged scene rather than
// imports a file. A simple stacked-rectangle "deck" glyph.
function TemplateIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="9" height="7" rx="1.2" />
      <path d="M2 6.5V10.5A1 1 0 003 11.5H10" />
      <path d="M5 6.5h5" />
      <path d="M5 8.5h3" />
    </svg>
  )
}

// Crumb component — clickable folder name plus separator chevron.
function Crumb({ label, onClick, isLast }) {
  return (
    <>
      <button
        onClick={onClick}
        className={`hover:text-textBase ${isLast ? 'text-textBase' : 'text-textDim'}`}
      >{label}</button>
      {!isLast && <span className="text-textMute">/</span>}
    </>
  )
}

// Folder colour palette — six saturated visionOS-system hues + neutral.
// Tiles tint the folder glyph + accent strip when one of these is set;
// `null` means "no colour" and the folder paints in the neutral grey.
const FOLDER_COLORS = [
  { value: null,       label: 'None',   swatch: 'transparent' },
  { value: '#ff453a',  label: 'Red',    swatch: '#ff453a' },
  { value: '#ff9f0a',  label: 'Orange', swatch: '#ff9f0a' },
  { value: '#ffd60a',  label: 'Yellow', swatch: '#ffd60a' },
  { value: '#30d158',  label: 'Green',  swatch: '#30d158' },
  { value: '#64d2ff',  label: 'Cyan',   swatch: '#64d2ff' },
  { value: '#0a84ff',  label: 'Blue',   swatch: '#0a84ff' },
  { value: '#bf5af2',  label: 'Purple', swatch: '#bf5af2' },
  { value: '#ff375f',  label: 'Pink',   swatch: '#ff375f' }
]

// Keyword → asset-type aliases. Lets the search match "image" against
// every image asset, "model"/"3d" against meshes, etc. — not just by
// the record's name.
const TYPE_ALIASES = {
  image:    'image',    images: 'image',  photo: 'image',  photos: 'image', picture: 'image', pictures: 'image',
  mesh:     'mesh',     meshes: 'mesh',   model: 'mesh',   models: 'mesh',  '3d': 'mesh',
  folder:   '__folder', folders: '__folder',
  template: '__template', templates: '__template',
  sample:   '__sample',  samples: '__sample'
}

export default function AssetsPanel() {
  const assets = useStore((s) => s.assets)
  const importAssets = useStore((s) => s.importAssets)
  const createAssetFolder = useStore((s) => s.createAssetFolder)
  const renameAsset = useStore((s) => s.renameAsset)
  const deleteAsset = useStore((s) => s.deleteAsset)
  const setAssetColor = useStore((s) => s.setAssetColor)
  const setPendingDropAsset = useStore((s) => s.setPendingDropAsset)
  const clearPendingDropAsset = useStore((s) => s.clearPendingDropAsset)
  const applyTemplate = useStore((s) => s.applyTemplate)
  const spawnAssetIntoScene = useStore((s) => s.spawnAssetIntoScene)
  const [contextMenu, setContextMenu] = useState(null)   // { x, y, asset }

  const [currentFolder, setCurrentFolder] = useState(null)  // null = root
  const [dragOver, setDragOver] = useState(false)
  const [renamingId, setRenamingId] = useState(null)
  const [renameDraft, setRenameDraft] = useState('')
  // Search: mirrors the LayersPanel pattern — hidden by default, click
  // the magnifier to reveal a filter input that filters by asset /
  // template / folder name. When a query is active we flatten the
  // current folder's listing AND surface any nested matches so the
  // user can find a template living inside `Templates → Window` from
  // the top-level Assets folder without navigating in.
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const fileInputRef = useRef(null)
  const searchInputRef = useRef(null)
  useEffect(() => {
    if (searchOpen) requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [searchOpen])

  // Build the breadcrumb path back to root by walking parentId.
  // Virtual template folders use a separate breadcrumb chain since
  // they aren't in the `assets` array.
  const crumbs = useMemo(() => {
    if (isVirtualFolder(currentFolder)) {
      return [{ id: null, name: 'Assets' }, ...virtualCrumbs(currentFolder)]
    }
    const out = [{ id: null, name: 'Assets' }]
    let cur = currentFolder ? assets.find((a) => a.id === currentFolder) : null
    const trail = []
    while (cur) {
      trail.unshift({ id: cur.id, name: cur.name })
      cur = cur.parentId ? assets.find((a) => a.id === cur.parentId) : null
    }
    return [...out, ...trail]
  }, [currentFolder, assets])

  // Items shown at the current folder level. We always show the
  // virtual `Templates` folder at root, and switch the listing to
  // synthesized template records when the user is inside the
  // virtual subtree. A non-empty search query flattens the listing
  // to all matches anywhere in the asset tree + every template.
  const q = query.trim().toLowerCase()
  const visible = useMemo(() => {
    if (q) {
      // Token-aware matcher. A query matches if its tokens collectively
      // satisfy ANY of:
      //   1. The token is a substring of the record name
      //   2. The token resolves to an asset-type alias and the record
      //      has that type/kind (lets "image" surface every image,
      //      "model"/"3d" every mesh, "template" all templates)
      const tokens = q.split(/\s+/).filter(Boolean)
      const matchesRecord = (rec) => {
        const name = (rec.name || '').toLowerCase()
        // Every token must hit on either the name or a type alias.
        return tokens.every((tok) => {
          if (name.includes(tok)) return true
          const alias = TYPE_ALIASES[tok]
          if (!alias) return false
          if (alias === '__folder')   return rec.kind === 'folder'
          if (alias === '__template') return rec.kind === 'template'
          if (alias === '__sample')   return !!rec.virtual && rec.kind === 'asset'
          return rec.assetType === alias
        })
      }
      // Real assets (any depth) — flat array so nested user folders /
      // contents are reachable from any starting folder.
      const realMatches = assets
        .filter(matchesRecord)
        .sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      const tplMatches = [
        ...TEMPLATE_ORDER_WINDOW.map((k) => virtualTemplateRecord(k, TPL_WINDOW)),
        ...TEMPLATE_ORDER_VOLUME.map((k) => virtualTemplateRecord(k, TPL_VOLUME))
      ].filter((t) => t && matchesRecord(t))
      const sampMatches = [
        ...SAMPLE_IMAGES.map((s) => virtualSampleRecord(s, SAMP_IMAGES, 'image')),
        ...SAMPLE_MODELS.map((s) => virtualSampleRecord(s, SAMP_MODELS, 'mesh'))
      ].filter(matchesRecord)
      return [...tplMatches, ...sampMatches, ...realMatches]
    }
    if (isVirtualFolder(currentFolder)) {
      return getVirtualEntries(currentFolder)
    }
    const real = assets
      .filter((a) => a.parentId === currentFolder)
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    if (currentFolder === null) {
      return [...getVirtualEntries(null), ...real]
    }
    return real
  }, [assets, currentFolder, q])

  const onPickFiles = () => fileInputRef.current?.click()
  const onFileInputChange = async (e) => {
    const files = [...(e.target.files || [])]
    if (files.length) await importAssets(files, currentFolder)
    e.target.value = ''  // allow picking the same file again
  }

  const onPanelDrop = async (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = [...(e.dataTransfer.files || [])]
    if (files.length) await importAssets(files, currentFolder)
  }

  const onAssetDragStart = (asset, e) => {
    if (asset.kind !== 'asset') return
    // Pin the full asset record on `pendingDropAsset` so the canvas
    // and layers-panel drop handlers can spawn the asset directly —
    // important for virtual sample records, which never enter the
    // real `state.assets` array (an id-lookup would miss them).
    setPendingDropAsset(asset)
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('application/x-asset-id', asset.id)
    // Carry the record JSON too so a cross-frame / refresh drop can
    // recover it without the store wire.
    try { e.dataTransfer.setData('application/x-asset-record', JSON.stringify(asset)) } catch {}
  }
  const onAssetDragEnd = () => clearPendingDropAsset()

  const startRename = (asset) => {
    setRenamingId(asset.id)
    setRenameDraft(asset.name)
  }
  const commitRename = () => {
    if (renamingId && renameDraft.trim()) {
      renameAsset(renamingId, renameDraft.trim())
    }
    setRenamingId(null)
  }

  return (
    <div
      className="h-full flex flex-col bg-panel border-t border-border"
      onDragOver={(e) => { e.preventDefault(); if (!dragOver) setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onPanelDrop}
    >
      {/* Header: title + actions */}
      <div className="flex items-center justify-between h-[34px] px-2 border-b border-border flex-shrink-0">
        <span className="text-[11px] uppercase tracking-wider text-textDim">Assets</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setSearchOpen((o) => !o)
              if (searchOpen) setQuery('')
            }}
            className={`btn btn-icon btn-ghost ${searchOpen ? 'text-accent' : ''}`}
            title="Search assets"
          >
            <SearchIcon size={12} />
          </button>
          <button
            onClick={() => {
              const id = createAssetFolder('New Folder', currentFolder)
              startRename({ id, name: 'New Folder' })
            }}
            className="p-1 text-textMute hover:text-textBase rounded hover:bg-surface2"
            title="New folder"
          >
            <FolderIcon size={13} />
          </button>
          <button
            onClick={onPickFiles}
            className="p-1 text-textMute hover:text-textBase rounded hover:bg-surface2"
            title="Import asset"
          >
            <ImportIcon size={13} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".usdz,.glb,.gltf,.obj,image/*"
            onChange={onFileInputChange}
            className="hidden"
          />
        </div>
      </div>

      {searchOpen && (
        <div className="px-2 py-1.5 border-b border-border">
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            placeholder="Filter assets"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setQuery(''); setSearchOpen(false) }
            }}
            className="field w-full"
          />
        </div>
      )}

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 px-2 py-1 text-[10px] flex-shrink-0">
        {crumbs.map((c, i) => (
          <Crumb
            key={c.id ?? 'root'}
            label={c.name}
            onClick={() => setCurrentFolder(c.id)}
            isLast={i === crumbs.length - 1}
          />
        ))}
      </div>

      {/* Asset grid (scrolls). Drop zone covers the entire flex-1
          region so the user can drop anywhere. */}
      <div className={`flex-1 overflow-y-auto scrollbar p-1.5 ${dragOver ? 'bg-accent/10 outline outline-1 outline-dashed outline-accent/60' : ''}`}>
        {visible.length === 0 && !dragOver && (
          <div className="text-center text-[10px] text-textMute leading-snug pt-4 px-3">
            Drop USDZ / GLB / images here, or click <span className="text-textBase">↑</span> to import.
            <div className="mt-2 text-textDim">Use <span className="text-textBase">📁</span> to create folders.</div>
          </div>
        )}
        {/* Fixed-size tile grid — every tile is a 64pt square regardless
            of sidebar width, so folders never stretch into rectangles or
            shrink when the panel is dragged. Adding more tiles just lays
            out additional columns up to whatever fits in the row. */}
        <div
          className="grid gap-1.5 justify-start"
          style={{ gridTemplateColumns: 'repeat(auto-fill, 64px)' }}
        >
          {visible.map((a) => (
            <AssetTile
              key={a.id}
              asset={a}
              isRenaming={renamingId === a.id}
              renameDraft={renameDraft}
              onRenameDraft={setRenameDraft}
              onRenameCommit={commitRename}
              onOpen={() => {
                if (a.kind === 'folder') return setCurrentFolder(a.id)
                if (a.kind === 'template') return applyTemplate(a.templateKey)
                // Image assets — double-click adds them to the active stack
                if (a.kind === 'asset') return spawnAssetIntoScene?.(a)
                return null
              }}
              onDelete={a.virtual || a.kind === 'template' ? null : () => deleteAsset(a.id)}
              onStartRename={a.virtual || a.kind === 'template' ? null : () => startRename(a)}
              onContextMenu={(e) => {
                if (a.kind === 'template' || a.virtual) return
                e.preventDefault()
                setContextMenu({ x: e.clientX, y: e.clientY, asset: a })
              }}
              onDragStart={(e) => onAssetDragStart(a, e)}
              onDragEnd={onAssetDragEnd}
            />
          ))}
        </div>
      </div>

      {/* Footer hint: shows a count when populated. */}
      {visible.length > 0 && (
        <div className="text-[9px] text-textMute px-2 py-1 border-t border-border flex-shrink-0">
          {(() => {
            const tpl = visible.filter(v => v.kind === 'template').length
            const ass = visible.filter(v => v.kind === 'asset').length
            const fld = visible.filter(v => v.kind === 'folder').length
            const parts = []
            if (tpl) parts.push(`${tpl} template${tpl !== 1 ? 's' : ''}`)
            if (ass) parts.push(`${ass} asset${ass !== 1 ? 's' : ''}`)
            if (fld) parts.push(`${fld} folder${fld !== 1 ? 's' : ''}`)
            return parts.join(' · ')
          })()}
        </div>
      )}
      {/* Right-click context menu. Folders get the colour swatch row;
          everything user-owned gets Rename + Delete. F2 also starts a
          rename when a tile is focused. */}
      {contextMenu && (
        <AssetContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          asset={contextMenu.asset}
          onClose={() => setContextMenu(null)}
          onRename={() => { startRename(contextMenu.asset); setContextMenu(null) }}
          onDelete={() => { deleteAsset(contextMenu.asset.id); setContextMenu(null) }}
          onColor={(c) => { setAssetColor(contextMenu.asset.id, c); setContextMenu(null) }}
        />
      )}
    </div>
  )
}

// ---- Context menu ---------------------------------------------------
//
// Floating pop-up anchored at the cursor position. Folders get the
// colour-swatch row so users can colour-code their library; assets
// fall back to a Rename + Delete pair. Dismisses on outside click /
// Escape, matching the visionOS / macOS right-click menu pattern.
function AssetContextMenu({ x, y, asset, onClose, onRename, onDelete, onColor }) {
  const ref = useRef(null)
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    const onKey  = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  const isFolder = asset.kind === 'folder'
  // Anchor near the cursor but keep the menu inside the viewport on
  // the right + bottom edges so it doesn't get clipped.
  const W = 168
  const H = isFolder ? 134 : 76
  const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1024) - W - 4)
  const top  = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 768) - H - 4)
  return (
    <div
      ref={ref}
      role="menu"
      style={{ position: 'fixed', left, top, width: W, zIndex: 100 }}
      className="bg-panel border border-border rounded-md shadow-xl py-1 text-[11px]"
    >
      <button
        className="w-full text-left px-3 py-1.5 hover:bg-hover"
        onClick={onRename}
      >Rename… <span className="text-textMute ml-1">F2</span></button>
      {isFolder && (
        <>
          <div className="border-t border-border my-1" />
          <div className="text-[9px] text-textMute uppercase tracking-wider px-3 pt-1 pb-1">Color</div>
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            {FOLDER_COLORS.map((c) => (
              <button
                key={c.label}
                onClick={() => onColor(c.value)}
                title={c.label}
                className={`w-5 h-5 rounded-full border ${asset.color === c.value ? 'border-accent ring-1 ring-accent' : 'border-border'}`}
                style={{
                  background: c.value || 'transparent',
                  backgroundImage: c.value ? undefined : 'linear-gradient(45deg, transparent 45%, #6e6e72 45%, #6e6e72 55%, transparent 55%)'
                }}
              />
            ))}
          </div>
        </>
      )}
      <div className="border-t border-border my-1" />
      <button
        className="w-full text-left px-3 py-1.5 hover:bg-hover text-rose-400"
        onClick={onDelete}
      >Delete</button>
    </div>
  )
}

// ---- Single asset tile (folder or asset) ---------------------------

function AssetTile({
  asset, isRenaming, renameDraft, onRenameDraft, onRenameCommit,
  onOpen, onDelete, onStartRename, onDragStart, onDragEnd, onContextMenu
}) {
  const isFolder = asset.kind === 'folder'
  const isTemplate = asset.kind === 'template'
  const isImage = !isFolder && !isTemplate && asset.assetType === 'image'
  const isMesh  = !isFolder && !isTemplate && asset.assetType === 'mesh'
  // Folder colour tint — applied to the glyph + a thin underline strip
  // so the label area picks up the colour without the full thumbnail
  // turning into a coloured rectangle.
  const folderColor = isFolder && asset.color ? asset.color : null

  return (
    <div
      tabIndex={0}
      className={`group flex flex-col items-center gap-0.5 p-1 rounded hover:bg-surface2 cursor-pointer relative outline-none focus:bg-surface2 ${isTemplate ? 'hover:ring-1 hover:ring-accent/40' : ''}`}
      draggable={!isFolder && !isTemplate && !isRenaming}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      onKeyDown={(e) => {
        if (e.key === 'F2' && onStartRename) {
          e.preventDefault()
          onStartRename()
        } else if (e.key === 'Enter' && !isRenaming) {
          e.preventDefault()
          onOpen()
        }
      }}
      onClick={(e) => {
        // Folders + templates: click-to-open / click-to-apply.
        // Regular assets: single click does nothing (drag is the
        // primary affordance; double-click handled separately).
        if (e.detail === 1 && (isFolder || isTemplate) && !isRenaming) onOpen()
      }}
      title={isTemplate ? `${asset.name} — ${asset.description}` : asset.name}
    >
      {/* Thumbnail */}
      <div
        className={`w-full aspect-square rounded border flex items-center justify-center overflow-hidden ${isTemplate ? 'bg-gradient-to-br from-accent/15 to-surface3' : 'bg-surface3'}`}
        style={{ borderColor: folderColor || undefined }}
      >
        {isImage && asset.thumbnailUrl
          ? <img src={asset.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          : isFolder
            ? <span style={{ color: folderColor || undefined }} className={folderColor ? '' : 'text-textDim'}><FolderIcon size={20} /></span>
            : isTemplate
              ? <span className="text-accent"><TemplateIcon size={20} /></span>
              : isMesh
                ? <span className="text-textDim"><MeshIcon size={20} /></span>
                : <span className="text-textDim"><ImageIcon size={20} /></span>
        }
      </div>
      {/* Label */}
      {isRenaming
        ? <input
            autoFocus
            type="text"
            value={renameDraft}
            onChange={(e) => onRenameDraft(e.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameCommit()
              else if (e.key === 'Escape') onRenameCommit()
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-[9px] w-full text-center bg-surface3 border border-accent/60 rounded px-0.5"
          />
        : <span className="text-[9px] text-textBase text-center truncate w-full leading-tight">
            {asset.name}
          </span>
      }
      {/* Actions on hover (rename, delete) — hidden for built-in
          template tiles since they're read-only. */}
      {(onStartRename || onDelete) && (
        <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onStartRename && (
            <button
              onClick={(e) => { e.stopPropagation(); onStartRename() }}
              className="w-4 h-4 rounded bg-surface3/90 text-[8px] text-textMute hover:text-textBase"
              title="Rename"
            >✎</button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="w-4 h-4 rounded bg-surface3/90 text-[8px] text-textMute hover:text-rose-400"
              title="Delete"
            >×</button>
          )}
        </div>
      )}
    </div>
  )
}
