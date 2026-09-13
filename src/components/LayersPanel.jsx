import { useState, useRef, useEffect, useMemo } from 'react'
import { useStore } from '../store'
import AddDropdown from './AddDropdown'
import { SF_SYMBOLS, SF_SYMBOL_ORDER } from '../appleSystem'
import { validateContainment } from '../containment'
import {
  EyeOpen,
  EyeClosed,
  ChevronRight,
  ChevronDown,
  CanvasIcon,
  TextIcon,
  ButtonIcon,
  LabelIcon,
  LinkIcon,
  ImageIcon,
  AsyncImageIcon,
  ToggleIcon,
  SliderIcon,
  StepperIcon,
  PickerIcon,
  ProgressIcon,
  GaugeIcon,
  DatePickerIcon,
  ColorPickerIcon,
  TextFieldIcon,
  SecureFieldIcon,
  TextEditorIcon,
  VStackIcon,
  HStackIcon,
  ZStackIcon,
  SpacerIcon,
  DividerIcon,
  RectangleIcon,
  CircleIcon,
  CapsuleIcon,
  EllipseIcon,
  UnevenRectIcon,
  PathIcon,
  LinearGradientIcon,
  RadialGradientIcon,
  AngularGradientIcon,
  ListIcon,
  TableIcon,
  MenuIcon,
  FormIcon,
  GroupBoxIcon,
  OutlineGroupIcon,
  SlideshowIcon,
  TickerIcon,
  SearchIcon,
  SegmentedIcon,
  SheetIcon,
  PopoverIcon,
  AlertIcon,
  ContentUnavailableIcon,
  WindowIcon,
  VolumeIcon,
  CloseIcon,
  TabViewIcon,
  TabIcon,
  NavStackIcon,
  PageTabIcon,
  SplitViewIcon,
  RealityViewIcon,
  AnchorIcon,
  EntityGroupIcon,
  ModelEntityIcon,
  LightIcon,
  SphereIcon,
  BoxIcon,
  PlaneIcon,
  ConeIcon,
  CylinderIcon,
  Text3DIcon,
  MeshIcon,
  SymbolIcon
} from './icons'

// Keep this map in sync with AddDropdown.jsx so the glyph in the layers
// panel matches the glyph shown when the element was added.
const PANEL_ICONS = {
  // Views
  text: TextIcon, image: ImageIcon, label: LabelIcon, button: ButtonIcon, link: LinkIcon,
  asyncimage: AsyncImageIcon,
  // Controls
  toggle: ToggleIcon, slider: SliderIcon, stepper: StepperIcon, picker: PickerIcon,
  progress: ProgressIcon, gauge: GaugeIcon,
  datepicker: DatePickerIcon, colorpicker: ColorPickerIcon,
  textfield: TextFieldIcon, securefield: SecureFieldIcon, texteditor: TextEditorIcon,
  segmented: SegmentedIcon, search: SearchIcon,
  // Layout primitives
  spacer: SpacerIcon, divider: DividerIcon,
  rectangle: RectangleIcon, circle: CircleIcon, capsule: CapsuleIcon,
  ellipse: EllipseIcon, unevenRoundedRect: UnevenRectIcon, path: PathIcon,
  linearGradient: LinearGradientIcon, radialGradient: RadialGradientIcon, angularGradient: AngularGradientIcon,
  // Collections
  list: ListIcon, table: TableIcon, menu: MenuIcon,
  form: FormIcon, groupbox: GroupBoxIcon, outlinegroup: OutlineGroupIcon,
  // Display
  slideshow: SlideshowIcon, ticker: TickerIcon,
  // Presentations
  sheet: SheetIcon, popover: PopoverIcon, alert: AlertIcon,
  contentUnavailable: ContentUnavailableIcon,
  // RealityKit bridge
  realityview: RealityViewIcon
}

// Per-mesh entity icons. Falls back to ModelEntityIcon when the mesh type
// is unknown (covers usdz / future additions).
const MESH_ICONS = {
  box: BoxIcon, sphere: SphereIcon, cylinder: CylinderIcon, cone: ConeIcon,
  plane: PlaneIcon, text: Text3DIcon, usdz: MeshIcon
}

// ---- tree-row icon picker ----

function rowIcon(item) {
  if (item.type === 'tab') {
    // Render the tab's SF Symbol as a Lucide icon so it stays legible
    // in any font. Falls back to the page tab glyph when no icon is set.
    if (item.icon) return <SymbolIcon name={item.icon} size={13} />
    return <PageTabIcon />
  }
  if (item.type === 'window') return item.windowStyle === 'volumetric' ? <VolumeIcon /> : <WindowIcon />
  if (item.type === 'stack') {
    // NavigationSplitView is a special compound layout — not a plain stack —
    // so it gets its own icon regardless of the underlying stackType.
    if (item.splitStyle)               return <SplitViewIcon />
    if (item.stackType === 'hstack')   return <HStackIcon />
    if (item.stackType === 'zstack')   return <ZStackIcon />
    if (item.stackType === 'tabView')  return <TabViewIcon />
    if (item.stackType === 'tab')      return <TabIcon />
    if (item.stackType === 'navigationStack') return <NavStackIcon />
    return <VStackIcon />
  }
  if (item.type === 'entity') {
    if (item.entityKind === 'anchor') return <AnchorIcon />
    if (item.entityKind === 'group')  return <EntityGroupIcon />
    if (item.entityKind === 'camera') return (
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="9" height="7" rx="1" />
        <path d="M11 7l3-2v6l-3-2z" />
      </svg>
    )
    if (item.entityKind === 'attachment') return (
      // Speech-bubble silhouette — RealityView attachments are SwiftUI
      // views pinned in 3D space, so a "callout" shape reads more
      // accurately than the generic model glyph it used to share.
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 4.5C2 3.67 2.67 3 3.5 3h9c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5H7.5l-2.5 2.5V11H3.5C2.67 11 2 10.33 2 9.5v-5z" />
        <circle cx="6" cy="7" r="0.6" fill="currentColor" />
        <circle cx="8.5" cy="7" r="0.6" fill="currentColor" />
        <circle cx="11" cy="7" r="0.6" fill="currentColor" />
      </svg>
    )
    if (item.entityKind === 'light') return <LightIcon />
    // Model — use mesh-specific glyph when known, fall back to the
    // generic model entity icon.
    const MeshGlyph = MESH_ICONS[item.meshType] || ModelEntityIcon
    return <MeshGlyph />
  }
  const PanelIcon = PANEL_ICONS[item.panelType]
  if (PanelIcon) return <PanelIcon />
  return <CanvasIcon />
}

// ---- tab icon popover ----
// Compact SF-Symbol grid for picking a tab's icon.

function IconPickerPopover({ tab, onClose }) {
  const setTabIcon = useStore((s) => s.setTabIcon)
  const ref = useRef(null)
  useEffect(() => {
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) onClose() }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [onClose])
  return (
    <div
      ref={ref}
      className="popover absolute left-0 top-full mt-1 z-50 p-1.5 rounded"
      style={{ width: 208 }}
    >
      <div className="grid grid-cols-8 gap-0.5 max-h-[180px] overflow-y-auto scrollbar">
        {SF_SYMBOL_ORDER.map((name) => (
          <button
            key={name}
            onClick={() => { setTabIcon(tab.id, name); onClose() }}
            className={`w-6 h-6 flex items-center justify-center rounded leading-none hover:bg-hover ${
              tab.icon === name ? 'bg-accentBg text-text' : 'text-textDim'
            }`}
            title={SF_SYMBOLS[name].label}
          >
            <SymbolIcon name={name} size={14} />
          </button>
        ))}
      </div>
    </div>
  )
}

// ---- single layer row (recursive) ----

function LayerRow({ item, depth, visibleIds, query }) {
  const items          = useStore((s) => s.items)
  const selectedId     = useStore((s) => s.selectedId)
  const activeTabId    = useStore((s) => s.activeTabId)
  const select         = useStore((s) => s.select)
  const selectTab      = useStore((s) => s.selectTab)
  const removeItem     = useStore((s) => s.removeItem)
  const renameItem     = useStore((s) => s.renameItem)
  const toggleVisibility = useStore((s) => s.toggleVisibility)
  const toggleCollapse = useStore((s) => s.toggleCollapse)
  const moveItem       = useStore((s) => s.moveItem)

  // Spec §1.27 containment check — non-blocking. We surface a yellow
  // warning chip when the current parent isn't on the list of legal
  // containers for this child shape (e.g. Section outside List/Form,
  // Tab outside TabView). The designer can still ship the design; the
  // chip just flags that the SwiftUI exporter may produce code Apple's
  // compiler will reject.
  const parent = items.find((p) => p.id === item.parentId) || null
  const containmentWarning = validateContainment(item, parent)

  const [editing, setEditing]     = useState(false)
  const [nameVal, setNameVal]     = useState(item.name)
  const [dropMode, setDropMode]   = useState(null)
  const [iconOpen, setIconOpen]   = useState(false)

  const isSel = item.id === selectedId
  // Containers: anything that holds other items in the layers tree.
  // Adds entities (which can host child entities under any kind) and
  // RealityView panels (whose children are the entity tree itself).
  const container =
    item.type === 'window' ||
    item.type === 'stack' ||
    item.type === 'tab' ||
    item.type === 'entity' ||
    (item.type === 'panel' && item.panelType === 'realityview')
  // Hide sidebar-slot children of a NavigationSplitView from the layer
  // tree. They're structural (Header, Section Headers, Group Lists)
  // and are managed from the NavSplitView's inspector instead — the
  // layer tree only shows the NavigationSplitView + its destination
  // stacks so the user's mental model matches SwiftUI's two-slot shape.
  const isNavSplit = item.type === 'stack' && !!item.splitStyle
  const children = container
    ? items.filter((it) => {
        if (it.parentId !== item.id) return false
        if (isNavSplit && it.slot === 'sidebar') return false
        return true
      })
    : []
  const isTab = item.type === 'tab'
  const isActiveTab = isTab && item.id === activeTabId

  const commitRename = () => {
    const t = nameVal.trim()
    if (t) renameItem(item.id, t)
    else setNameVal(item.name)
    setEditing(false)
  }

  // Search filtering — when a query is active, only render rows on the
  // path of a matching item. The header may have collected `visibleIds`
  // bottom-up (matches + ancestors); a row not in that set hides
  // entirely. The chevron also force-opens during search so matches
  // deep inside collapsed branches surface.
  const filtered = !!visibleIds
  if (filtered && !visibleIds.has(item.id)) return null
  const forceExpand = filtered

  const onClick = () => {
    // Clicking a tab row both selects it AND switches the active page —
    // that's how Apple's Finder / Xcode side-tabs behave.
    if (isTab) selectTab(item.id)
    select(item.id)
  }

  const onDragStart = (e) => {
    // Tabs stay at the top level — reorder them with a dedicated handle later
    // if needed. Windows move only between tabs, panels/stacks move freely.
    if (isTab) { e.preventDefault(); return }
    e.stopPropagation()
    e.dataTransfer.setData('text/plain', item.id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    // Tabs and windows reject asset drops — assets land on stacks /
    // panels / windows-content only. Sniff the asset wire and bail
    // when the row isn't a valid drop target for an asset drag.
    const isAssetDrag = !!useStore.getState().pendingDropAsset ||
      (e.dataTransfer && e.dataTransfer.types && (
        e.dataTransfer.types.includes('application/x-asset-id') ||
        e.dataTransfer.types.includes('application/x-asset-record')
      ))
    if (isAssetDrag) {
      e.dataTransfer.dropEffect = 'copy'
      // Per user spec: windows + tabs don't accept asset drops. Drop
      // anywhere on these rows is rejected so the asset doesn't end up
      // as a direct child of a window or tab.
      if (item.type === 'window' || item.type === 'tab') {
        setDropMode(null)
        return
      }
      setDropMode('inside')
      return
    }
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
    setDropMode(null)
    // ---- Asset drop from the Assets panel ------------------------
    let asset = useStore.getState().pendingDropAsset
    if (!asset || typeof asset === 'string') {
      const json = e.dataTransfer.getData('application/x-asset-record')
      if (json) { try { asset = JSON.parse(json) } catch { asset = null } }
    }
    if (!asset) {
      const id = e.dataTransfer.getData('application/x-asset-id')
      if (id) asset = id
    }
    if (asset) {
      // Asset rule: never under windows or tabs (per user spec). Find
      // the nearest stack / panel container; for any non-container row
      // we spawn alongside (parent = row's parent).
      if (item.type === 'window' || item.type === 'tab') {
        useStore.getState().clearPendingDropAsset?.()
        return
      }
      const parentId = container ? item.id : item.parentId
      useStore.getState().spawnAssetIntoScene?.(asset, { parentId })
      useStore.getState().clearPendingDropAsset?.()
      return
    }
    // ---- Layer-to-layer reorder (internal drag) ------------------
    const src = e.dataTransfer.getData('text/plain')
    if (!src || src === item.id) return
    moveItem(src, item.id, dropMode || 'after')
  }

  const canDelete = !isTab || items.filter((it) => it.type === 'tab').length > 1

  return (
    <>
      <div
        draggable={!editing && !isTab}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onClick}
        className={`relative group flex items-center gap-1.5 pr-2 h-[22px] cursor-pointer text-[11px] transition-colors ${
          isSel ? 'bg-accentBg text-text'
          : isActiveTab ? 'bg-[#1e1e20] text-text'
          : 'text-text hover:bg-hover'
        } ${isTab && !isActiveTab ? 'opacity-70' : ''} ${
          dropMode === 'inside' ? 'ring-1 ring-inset ring-accent' : ''
        }`}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {(isSel || isActiveTab) && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent" />}
        {dropMode === 'before' && <div className="absolute left-0 right-0 top-0 h-[1.5px] bg-accent pointer-events-none" />}
        {dropMode === 'after'  && <div className="absolute left-0 right-0 bottom-0 h-[1.5px] bg-accent pointer-events-none" />}

        {container && children.length > 0 ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggleCollapse(item.id) }}
            className="w-3 h-3 flex items-center justify-center text-textMute hover:text-text flex-shrink-0"
          >
            {(item.collapsed && !forceExpand) ? <ChevronRight /> : <ChevronDown />}
          </button>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}

        {/* Icon — for tabs this button opens the SF Symbol picker */}
        <span
          onClick={isTab ? (e) => { e.stopPropagation(); setIconOpen(!iconOpen) } : undefined}
          className={`flex-shrink-0 ${isTab ? 'cursor-pointer hover:text-accent' : ''} ${
            isTab              ? (isActiveTab ? 'text-accent' : 'text-textDim')
            : item.type === 'window' ? 'text-accent'
            : item.type === 'stack'  ? 'text-amber-400'
            : item.type === 'entity' ? 'text-teal-400'
            : (item.type === 'panel' && item.panelType === 'realityview') ? 'text-teal-300'
            : 'text-textDim'
          }`}
          title={isTab ? 'Click to change icon' : undefined}
        >
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
            className={`flex-1 truncate ${isTab ? 'font-semibold uppercase tracking-wide text-[10px]' : ''}`}
            title="Double-click to rename"
          >
            {item.name}
          </span>
        )}

        {containmentWarning && (
          <span
            className="flex-shrink-0 text-amber-400 text-[10px] font-bold cursor-help"
            title={containmentWarning}
          >⚠</span>
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

        {canDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); removeItem(item.id) }}
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-80 text-textDim hover:text-danger"
            title="Delete"
          >
            <CloseIcon />
          </button>
        )}

        {isTab && iconOpen && <IconPickerPopover tab={item} onClose={() => setIconOpen(false)} />}
      </div>

      {container && (!item.collapsed || forceExpand) && children.map((c) => (
        <LayerRow key={c.id} item={c} depth={depth + 1} visibleIds={visibleIds} query={query} />
      ))}
      {/* Empty containers used to render an "empty" placeholder line plus
          a disabled chevron — both wasted space when most containers
          start out empty. Now: no chevron (handled above), no
          placeholder, the row reads as a leaf. The user can still drop
          into the row via drag-and-drop. */}
    </>
  )
}

// ---- root panel ----

export default function LayersPanel({ width = 240 }) {
  const items    = useStore((s) => s.items)
  const addStack = useStore((s) => s.addStack)
  const addTab   = useStore((s) => s.addTab)
  const addWindow = useStore((s) => s.addWindow)

  // Tabs are top-level; their windows/stacks nest beneath them. The active
  // tab is highlighted — click any tab row to switch pages.
  const tabs = items.filter((it) => it.type === 'tab')

  // Search box is hidden by default — clicking the search icon expands a
  // single-line filter under the toolbar. Filter matches against the
  // layer's `name`, case-insensitive. When a filter is active, every
  // ancestor of a matching item is expanded so the row is visible; rows
  // that don't match (and don't have a matching descendant) hide.
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInputRef = useRef(null)
  useEffect(() => {
    if (searchOpen) requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [searchOpen])

  const q = query.trim().toLowerCase()
  // Set of ids that should remain visible while a filter is active.
  // Built bottom-up: any matching item, plus all its ancestors so the
  // tree path stays intact.
  const visibleIds = useMemo(() => {
    if (!q) return null
    const matches = new Set()
    for (const it of items) {
      if ((it.name || '').toLowerCase().includes(q)) matches.add(it.id)
    }
    const out = new Set(matches)
    const byId = new Map(items.map((it) => [it.id, it]))
    for (const id of matches) {
      let cur = byId.get(id)
      while (cur && cur.parentId) {
        out.add(cur.parentId)
        cur = byId.get(cur.parentId)
      }
    }
    return out
  }, [items, q])

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
            onClick={() => {
              setSearchOpen((o) => !o)
              if (searchOpen) setQuery('')
            }}
            className={`btn btn-icon btn-ghost ${searchOpen ? 'text-accent' : ''}`}
            title="Search layers"
          >
            <SearchIcon />
          </button>
          <button
            onClick={() => addTab()}
            className="btn btn-icon btn-ghost"
            title="New tab (page)"
          >
            <PageTabIcon />
          </button>
          <button
            onClick={() => addWindow()}
            className="btn btn-icon btn-ghost"
            title="New window"
          >
            <WindowIcon />
          </button>
          <button
            onClick={() => addStack('vstack')}
            className="btn btn-icon btn-ghost"
            title="New stack"
          >
            <VStackIcon />
          </button>
          <AddDropdown variant="compact" />
        </div>
      </div>

      {searchOpen && (
        <div className="px-2 py-1.5 border-b border-border">
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            placeholder="Filter layers"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setQuery(''); setSearchOpen(false) }
            }}
            className="field w-full"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar py-1">
        {tabs.length === 0
          ? <div className="px-3 py-2 text-[10px] text-textMute italic">No tabs — click the page icon to add one.</div>
          : tabs.map((t) => (
              <LayerRow key={t.id} item={t} depth={0} visibleIds={visibleIds} query={q} />
            ))
        }
      </div>

      <div className="h-[22px] px-3 border-t border-border text-textMute text-[10px] flex items-center">
        {items.length} items · {tabs.length} tab{tabs.length === 1 ? '' : 's'}
      </div>
    </div>
  )
}
