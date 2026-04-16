import { useState } from 'react'
import { useStore } from '../store'
import AddDropdown from './AddDropdown'
import {
  EyeOpen, EyeClosed,
  Folder, FolderPlus,
  ChevronRight, ChevronDown,
  CanvasIcon, TextIcon, ButtonIcon,
  VStackIcon, HStackIcon, ZStackIcon,
  WindowIcon, CloseIcon
} from './icons'

function rowIcon(item) {
  if (item.type === 'window') return <WindowIcon />
  if (item.type === 'stack') {
    if (item.stackType === 'hstack') return <HStackIcon />
    if (item.stackType === 'zstack') return <ZStackIcon />
    return <VStackIcon />
  }
  if (item.panelType === 'text') return <TextIcon />
  if (item.panelType === 'button') return <ButtonIcon />
  return <CanvasIcon />
}

function LayerRow({ item, depth }) {
  const items = useStore((s) => s.items)
  const selectedId = useStore((s) => s.selectedId)
  const select = useStore((s) => s.select)
  const removeItem = useStore((s) => s.removeItem)
  const renameItem = useStore((s) => s.renameItem)
  const toggleVisibility = useStore((s) => s.toggleVisibility)
  const toggleCollapse = useStore((s) => s.toggleCollapse)
  const moveItem = useStore((s) => s.moveItem)

  const [editing, setEditing] = useState(false)
  const [nameVal, setNameVal] = useState(item.name)
  const [dropMode, setDropMode] = useState(null)

  const isSel = item.id === selectedId
  const container = item.type === 'window' || item.type === 'stack'
  const children = container ? items.filter((it) => it.parentId === item.id) : []

  const commitRename = () => {
    const t = nameVal.trim()
    if (t) renameItem(item.id, t)
    else setNameVal(item.name)
    setEditing(false)
  }

  const onDragStart = (e) => {
    if (item.type === 'window') { e.preventDefault(); return }
    e.stopPropagation()
    e.dataTransfer.setData('text/plain', item.id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const h = rect.height
    if (container && y > h * 0.25 && y < h * 0.75) setDropMode('inside')
    else if (y < h / 2) setDropMode('before')
    else setDropMode('after')
  }
  const onDragLeave = () => setDropMode(null)
  const onDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const src = e.dataTransfer.getData('text/plain')
    setDropMode(null)
    if (!src || src === item.id) return
    moveItem(src, item.id, dropMode || 'after')
  }

  return (
    <>
      <div
        draggable={!editing && item.type !== 'window'}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => select(item.id)}
        className={`relative group flex items-center gap-1.5 pr-2 h-[22px] cursor-pointer text-[11px] transition-colors ${
          isSel ? 'bg-accentBg text-text' : 'text-text hover:bg-hover'
        } ${dropMode === 'inside' ? 'ring-1 ring-inset ring-accent' : ''}`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {isSel && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent" />}
        {dropMode === 'before' && <div className="absolute left-0 right-0 top-0 h-[1.5px] bg-accent pointer-events-none" />}
        {dropMode === 'after' && <div className="absolute left-0 right-0 bottom-0 h-[1.5px] bg-accent pointer-events-none" />}

        {container ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggleCollapse(item.id) }}
            className="w-3 h-3 flex items-center justify-center text-textMute hover:text-text flex-shrink-0"
          >
            {item.collapsed ? <ChevronRight /> : <ChevronDown />}
          </button>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        <span className={`flex-shrink-0 ${
          item.type === 'window' ? 'text-accent'
          : item.type === 'stack' ? 'text-amber-400'
          : 'text-textDim'
        }`}>
          {rowIcon(item)}
        </span>

        {editing ? (
          <input
            autoFocus
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              else if (e.key === 'Escape') { setNameVal(item.name); setEditing(false) }
            }}
            onClick={(e) => e.stopPropagation()}
            className="field flex-1 min-w-0 py-[1px]"
          />
        ) : (
          <span
            onDoubleClick={(e) => { e.stopPropagation(); setNameVal(item.name); setEditing(true) }}
            className="flex-1 truncate"
            title="Double-click to rename"
          >
            {item.name}
          </span>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); toggleVisibility(item.id) }}
          className={`flex-shrink-0 w-5 h-5 flex items-center justify-center transition-opacity ${
            item.visible
              ? 'opacity-0 group-hover:opacity-80 text-textDim hover:text-text'
              : 'opacity-100 text-accent'
          }`}
          title={item.visible ? 'Hide' : 'Show'}
        >
          {item.visible ? <EyeOpen /> : <EyeClosed />}
        </button>

        {item.type !== 'window' && (
          <button
            onClick={(e) => { e.stopPropagation(); removeItem(item.id) }}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-80 text-textDim hover:text-danger"
            title="Delete"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {container && !item.collapsed && children.map((c) => (
        <LayerRow key={c.id} item={c} depth={depth + 1} />
      ))}
      {container && !item.collapsed && children.length === 0 && (
        <div
          className="text-[10px] text-textMute italic py-0.5"
          style={{ paddingLeft: 8 + (depth + 1) * 12 + 16 }}
        >
          empty
        </div>
      )}
    </>
  )
}

export default function LayersPanel({ width = 240 }) {
  const items = useStore((s) => s.items)
  const addStack = useStore((s) => s.addStack)
  const roots = items.filter((it) => !it.parentId)

  return (
    <div
      style={{ width }}
      className="bg-surface border-r border-border flex flex-col h-full flex-shrink-0"
    >
      <div className="h-[34px] px-3 border-b border-border flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-textDim">
          Layers
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => addStack('vstack')}
            className="btn btn-icon btn-ghost"
            title="New stack"
          >
            <FolderPlus />
          </button>
          <AddDropdown variant="compact" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar py-1">
        {roots.map((it) => <LayerRow key={it.id} item={it} depth={0} />)}
      </div>

      <div className="h-[22px] px-3 border-t border-border text-textMute text-[10px] flex items-center">
        {items.length} items · drag to reorder
      </div>
    </div>
  )
}
