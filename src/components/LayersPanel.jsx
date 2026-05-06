import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import AddDropdown from './AddDropdown'
import { SF_SYMBOLS, SF_SYMBOL_ORDER } from '../appleSystem'
import { validateContainment } from '../containment'
import {
  EyeOpen, EyeClosed,
  FolderPlus,
  ChevronRight, ChevronDown,
  CanvasIcon, TextIcon, ButtonIcon, LabelIcon, LinkIcon,
  ImageIcon, AsyncImageIcon,
  ToggleIcon, SliderIcon, StepperIcon, PickerIcon, ProgressIcon, GaugeIcon,
  DatePickerIcon, ColorPickerIcon, TextFieldIcon, SecureFieldIcon, TextEditorIcon,
  VStackIcon, HStackIcon, ZStackIcon,
  SpacerIcon, DividerIcon, RectangleIcon, CircleIcon, CapsuleIcon,
  EllipseIcon, UnevenRectIcon, PathIcon,
  LinearGradientIcon, RadialGradientIcon, AngularGradientIcon,
  ListIcon, TableIcon, MenuIcon, FormIcon, GroupBoxIcon, OutlineGroupIcon,
  SlideshowIcon, TickerIcon, SearchIcon, SegmentedIcon,
  SheetIcon, PopoverIcon, AlertIcon, ContentUnavailableIcon,
  WindowIcon, CloseIcon, PlusIcon,
  TabViewIcon, TabIcon, NavStackIcon,
  PageTabIcon, SplitViewIcon
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
  contentUnavailable: ContentUnavailableIcon
}

// ---- tree-row icon picker ----

function rowIcon(item) {
  if (item.type === 'tab') {
    // Render the tab's SF Symbol glyph so you can tell tabs apart at a glance.
    const glyph = SF_SYMBOLS[item.icon]?.glyph
    if (glyph) return <span className="inline-block w-[13px] h-[13px] text-[12px] leading-none text-center">{glyph}</span>
    return <PageTabIcon />
  }
  if (item.type === 'window') return <WindowIcon />
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
            className={`w-6 h-6 flex items-center justify-center rounded text-[14px] leading-none hover:bg-hover ${
              tab.icon === name ? 'bg-accentBg text-text' : 'text-textDim'
            }`}
            title={SF_SYMBOLS[name].label}
          >
            {SF_SYMBOLS[name].glyph}
          </button>
        ))}
      </div>
    </div>
  )
}

// ---- single layer row (recursive) ----

function LayerRow({ item, depth }) {
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
  const container = item.type === 'window' || item.type === 'stack' || item.type === 'tab'
  const children = container ? items.filter((it) => it.parentId === item.id) : []
  const isTab = item.type === 'tab'
  const isActiveTab = isTab && item.id === activeTabId

  const commitRename = () => {
    const t = nameVal.trim()
    if (t) renameItem(item.id, t)
    else setNameVal(item.name)
    setEditing(false)
  }

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

  const canDelete = !isTab || items.filter((it) => it.type === 'tab').length > 1
  const tabsCount = items.filter((it) => it.type === 'tab').length

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

        {/* Icon — for tabs this button opens the SF Symbol picker */}
        <span
          onClick={isTab ? (e) => { e.stopPropagation(); setIconOpen(!iconOpen) } : undefined}
          className={`flex-shrink-0 ${isTab ? 'cursor-pointer hover:text-accent' : ''} ${
            isTab              ? (isActiveTab ? 'text-accent' : 'text-textDim')
            : item.type === 'window' ? 'text-accent'
            : item.type === 'stack'  ? 'text-amber-400'
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

// ---- root panel ----

export default function LayersPanel({ width = 240 }) {
  const items    = useStore((s) => s.items)
  const addStack = useStore((s) => s.addStack)
  const addTab   = useStore((s) => s.addTab)
  const addWindow = useStore((s) => s.addWindow)

  // Tabs are top-level; their windows/stacks nest beneath them. The active
  // tab is highlighted — click any tab row to switch pages.
  const tabs = items.filter((it) => it.type === 'tab')

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

      <div className="flex-1 overflow-y-auto scrollbar py-1">
        {tabs.length === 0
          ? <div className="px-3 py-2 text-[10px] text-textMute italic">No tabs — click the page icon to add one.</div>
          : tabs.map((t) => <LayerRow key={t.id} item={t} depth={0} />)
        }
      </div>

      <div className="h-[22px] px-3 border-t border-border text-textMute text-[10px] flex items-center">
        {items.length} items · {tabs.length} tab{tabs.length === 1 ? '' : 's'}
      </div>
    </div>
  )
}
