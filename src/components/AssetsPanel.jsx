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

function getVirtualEntries(parentId) {
  if (parentId === null) {
    return [{
      id: TPL_ROOT, kind: 'folder', name: 'Templates', parentId: null,
      virtual: true
    }]
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
  return []
}

// Walk a virtual parent chain back to root for the breadcrumb.
function virtualCrumbs(folderId) {
  if (folderId === TPL_ROOT) return [{ id: TPL_ROOT, name: 'Templates' }]
  if (folderId === TPL_WINDOW) return [{ id: TPL_ROOT, name: 'Templates' }, { id: TPL_WINDOW, name: 'Window' }]
  if (folderId === TPL_VOLUME) return [{ id: TPL_ROOT, name: 'Templates' }, { id: TPL_VOLUME, name: 'Volume' }]
  return null
}

const isVirtualFolder = (id) => id === TPL_ROOT || id === TPL_WINDOW || id === TPL_VOLUME

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

function PlusIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M5.5 2V9" /><path d="M2 5.5H9" />
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

export default function AssetsPanel() {
  const assets = useStore((s) => s.assets)
  const importAssets = useStore((s) => s.importAssets)
  const createAssetFolder = useStore((s) => s.createAssetFolder)
  const renameAsset = useStore((s) => s.renameAsset)
  const deleteAsset = useStore((s) => s.deleteAsset)
  const setPendingDropAsset = useStore((s) => s.setPendingDropAsset)
  const clearPendingDropAsset = useStore((s) => s.clearPendingDropAsset)
  const applyTemplate = useStore((s) => s.applyTemplate)

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
      const matchesName = (n) => (n || '').toLowerCase().includes(q)
      // Real assets — match anywhere in the tree.
      const realMatches = assets
        .filter((a) => matchesName(a.name))
        .sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      // Templates — surface any whose label matches.
      const tplMatches = [
        ...TEMPLATE_ORDER_WINDOW.map((k) => virtualTemplateRecord(k, TPL_WINDOW)),
        ...TEMPLATE_ORDER_VOLUME.map((k) => virtualTemplateRecord(k, TPL_VOLUME))
      ].filter((t) => t && matchesName(t.name))
      return [...tplMatches, ...realMatches]
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
    setPendingDropAsset(asset.id)
    e.dataTransfer.effectAllowed = 'copy'
    // Carry the id in dataTransfer too so the canvas drop handler
    // can recover it even if the store wire is lost across iframes.
    e.dataTransfer.setData('application/x-asset-id', asset.id)
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
        {/* Auto-fit tile grid — uses minmax so columns flex as the
            sidebar grows. App.jsx widens the sidebar with the asset
            library; the grid responds by laying out more tiles per
            row instead of stretching individual tiles past readable. */}
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))' }}
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
                return null
              }}
              onDelete={a.virtual || a.kind === 'template' ? null : () => deleteAsset(a.id)}
              onStartRename={a.virtual || a.kind === 'template' ? null : () => startRename(a)}
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
    </div>
  )
}

// ---- Single asset tile (folder or asset) ---------------------------

function AssetTile({
  asset, isRenaming, renameDraft, onRenameDraft, onRenameCommit,
  onOpen, onDelete, onStartRename, onDragStart, onDragEnd
}) {
  const isFolder = asset.kind === 'folder'
  const isTemplate = asset.kind === 'template'
  const isImage = !isFolder && !isTemplate && asset.assetType === 'image'
  const isMesh  = !isFolder && !isTemplate && asset.assetType === 'mesh'

  return (
    <div
      className={`group flex flex-col items-center gap-0.5 p-1 rounded hover:bg-surface2 cursor-pointer relative ${isTemplate ? 'hover:ring-1 hover:ring-accent/40' : ''}`}
      draggable={!isFolder && !isTemplate && !isRenaming}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDoubleClick={onOpen}
      onClick={(e) => {
        // Folders + templates: click-to-open / click-to-apply.
        // Regular assets: single click does nothing (drag is the
        // primary affordance; double-click handled separately).
        if (e.detail === 1 && (isFolder || isTemplate) && !isRenaming) onOpen()
      }}
      title={isTemplate ? `${asset.name} — ${asset.description}` : asset.name}
    >
      {/* Thumbnail */}
      <div className={`w-full aspect-square rounded border border-border flex items-center justify-center overflow-hidden ${isTemplate ? 'bg-gradient-to-br from-accent/15 to-surface3' : 'bg-surface3'}`}>
        {isImage && asset.thumbnailUrl
          ? <img src={asset.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          : isFolder
            ? <span className="text-textDim"><FolderIcon size={20} /></span>
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
