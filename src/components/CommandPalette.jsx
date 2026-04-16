import { useState, useEffect, useMemo, useRef } from 'react'
import { useStore } from '../store'
import {
  TextIcon, ButtonIcon, CanvasIcon, ImageIcon,
  ToggleIcon, SegmentedIcon, SliderIcon, StepperIcon,
  ProgressIcon, GaugeIcon,
  SearchIcon, ListIcon, TableIcon, MenuIcon,
  SlideshowIcon, TickerIcon,
  VStackIcon, HStackIcon, ZStackIcon,
  WindowIcon, SplitViewIcon,
  OrnamentLeading, OrnamentTrailing, OrnamentTop, OrnamentBottom,
  NavBarIcon, TabBarIcon, ToolbarIcon,
  SpacerIcon, DividerIcon,
  RectangleIcon, CircleIcon, CapsuleIcon,
  GridLayoutIcon, SectionIcon, DisclosureIcon, NavStackIcon,
  LazyVStackIcon, LazyHStackIcon,
  SheetIcon, PopoverIcon, AlertIcon,
  LabelIcon, TextFieldIcon, SecureFieldIcon, TextEditorIcon,
  PickerIcon, DatePickerIcon, ColorPickerIcon, LinkIcon,
  AsyncImageIcon, ContentUnavailableIcon,
  FormIcon, GroupBoxIcon, OutlineGroupIcon,
  EllipseIcon, UnevenRectIcon, PathIcon,
  LinearGradientIcon, RadialGradientIcon, AngularGradientIcon
} from './icons'

// Blender / Raycast / VSCode-style command palette. Shift+A opens it.
// The list is static; hits are filtered with a cheap subsequence fuzzy match.

function fuzzyMatch(query, text) {
  if (!query) return true
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let qi = 0
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++
  }
  return qi === q.length
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const listRef = useRef(null)

  const addPanel    = useStore((s) => s.addPanel)
  const addStack    = useStore((s) => s.addStack)
  const addWindow   = useStore((s) => s.addWindow)
  const addOrnament = useStore((s) => s.addOrnament)
  const addSplitView = useStore((s) => s.addSplitView)
  const addNavBar   = useStore((s) => s.addNavBar)
  const addTabBar   = useStore((s) => s.addTabBar)
  const addToolbar  = useStore((s) => s.addToolbar)
  const addPresentation = useStore((s) => s.addPresentation)

  // Restructured to match SwiftUI's fundamental concepts.
  // Variants (circle vs rectangle, date picker etc.) are configured in Properties.
  const commands = useMemo(() => [
    // Views
    { id: 'text',      label: 'Text',      group: 'Views',      Icon: TextIcon,      run: () => addPanel('text') },
    { id: 'image',     label: 'Image',     group: 'Views',      Icon: ImageIcon,     run: () => addPanel('image') },
    { id: 'label',     label: 'Label',     group: 'Views',      Icon: LabelIcon,     run: () => addPanel('label') },
    { id: 'button',    label: 'Button',    group: 'Views',      Icon: ButtonIcon,    run: () => addPanel('button') },
    { id: 'link',      label: 'Link',      group: 'Views',      Icon: LinkIcon,      run: () => addPanel('link') },
    // Controls
    { id: 'toggle',    label: 'Toggle',    group: 'Controls',   Icon: ToggleIcon,    run: () => addPanel('toggle') },
    { id: 'slider',    label: 'Slider',    group: 'Controls',   Icon: SliderIcon,    run: () => addPanel('slider') },
    { id: 'stepper',   label: 'Stepper',   group: 'Controls',   Icon: StepperIcon,   run: () => addPanel('stepper') },
    { id: 'picker',    label: 'Picker',    group: 'Controls',   Icon: PickerIcon,    run: () => addPanel('picker') },
    { id: 'progress',  label: 'Progress',  group: 'Controls',   Icon: ProgressIcon,  run: () => addPanel('progress') },
    { id: 'gauge',     label: 'Gauge',     group: 'Controls',   Icon: GaugeIcon,     run: () => addPanel('gauge') },
    // Layout
    { id: 'stack',     label: 'Stack',     group: 'Layout',     Icon: VStackIcon,    run: () => addStack('vstack') },
    { id: 'spacer',    label: 'Spacer',    group: 'Layout',     Icon: SpacerIcon,    run: () => addPanel('spacer') },
    { id: 'divider',   label: 'Divider',   group: 'Layout',     Icon: DividerIcon,   run: () => addPanel('divider') },
    { id: 'shape',     label: 'Shape',     group: 'Layout',     Icon: RectangleIcon, run: () => addPanel('rectangle') },
    // Collections
    { id: 'list',      label: 'List',      group: 'Collections', Icon: ListIcon,     run: () => addPanel('list') },
    { id: 'table',     label: 'Table',     group: 'Collections', Icon: TableIcon,    run: () => addPanel('table') },
    { id: 'menu',      label: 'Menu',      group: 'Collections', Icon: MenuIcon,     run: () => addPanel('menu') },
    // Display
    { id: 'slideshow', label: 'Slideshow', group: 'Display',    Icon: SlideshowIcon, run: () => addPanel('slideshow') },
    { id: 'ticker',    label: 'Ticker',    group: 'Display',    Icon: TickerIcon,    run: () => addPanel('ticker') },
    // Overlay
    { id: 'sheet',     label: 'Sheet',     group: 'Presentations',    Icon: SheetIcon,     run: () => addPresentation('sheet') },
    { id: 'alert',     label: 'Alert',     group: 'Presentations',    Icon: AlertIcon,     run: () => addPresentation('alert') },
    { id: 'popover',   label: 'Popover',   group: 'Presentations',    Icon: PopoverIcon,   run: () => addPresentation('popover') },
    // Scene
    { id: 'window',    label: 'Window',    group: 'Windows',      Icon: WindowIcon,    run: () => addWindow() },
    { id: 'split',     label: 'Split View', group: 'Windows',     Icon: SplitViewIcon, run: () => addSplitView() },
    // Chrome (still searchable but grouped under Scene)
    { id: 'navbar',    label: 'Navigation Bar', group: 'Ornaments', Icon: NavBarIcon,   run: () => addNavBar() },
    { id: 'tabbar',    label: 'Tab Bar',   group: 'Ornaments',     Icon: TabBarIcon,    run: () => addTabBar() },
    { id: 'toolbar',   label: 'Toolbar',   group: 'Ornaments',     Icon: ToolbarIcon,   run: () => addToolbar() }
  ], [addPanel, addStack, addWindow, addOrnament, addSplitView, addNavBar, addTabBar, addToolbar, addPresentation])

  const filtered = useMemo(
    () => commands.filter((c) => fuzzyMatch(query, c.label) || fuzzyMatch(query, c.group)),
    [query, commands]
  )

  useEffect(() => { setSelected(0) }, [query])

  // Global hotkey
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA'
      if (!open && !inField && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault()
        setOpen(true)
        setQuery('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Auto-scroll selected into view
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [selected, open])

  if (!open) return null

  const run = (cmd) => {
    try { cmd.run() } finally { setOpen(false); setQuery('') }
  }

  // Group rendering: walk filtered list in order and emit group labels.
  const rows = []
  let lastGroup = null
  filtered.forEach((c, i) => {
    if (c.group !== lastGroup) {
      rows.push({ kind: 'label', label: c.group })
      lastGroup = c.group
    }
    rows.push({ kind: 'cmd', cmd: c, idx: i })
  })

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[18vh] bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      <div
        className="w-[460px] bg-[#1a1a1a] border border-borderHi rounded-lg shadow-pop overflow-hidden flex flex-col"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)' }}
      >
        <div className="flex items-center gap-2 px-4 h-11 border-b border-border">
          <span className="text-textMute"><SearchIcon size={14} /></span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setOpen(false); setQuery('') }
              else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelected((s) => Math.min(filtered.length - 1, s + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelected((s) => Math.max(0, s - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                if (filtered[selected]) run(filtered[selected])
              }
            }}
            placeholder="Add element, stack, chrome…"
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-text placeholder-textMute"
          />
          <span className="text-[9px] text-textMute uppercase tracking-wider font-semibold">ESC</span>
        </div>
        <div ref={listRef} className="flex-1 max-h-[50vh] overflow-y-auto scrollbar py-1">
          {rows.length === 0 && (
            <div className="p-6 text-center text-textMute text-[11px]">No matches</div>
          )}
          {rows.map((row, i) =>
            row.kind === 'label' ? (
              <div key={`l${i}`} className="px-4 py-1 text-[9px] uppercase tracking-wider text-textMute font-semibold">
                {row.label}
              </div>
            ) : (
              <button
                key={`c${row.cmd.id}`}
                data-idx={row.idx}
                onMouseEnter={() => setSelected(row.idx)}
                onClick={() => run(row.cmd)}
                className={`flex items-center gap-3 w-full text-left px-4 py-1.5 text-[12px] transition-colors ${
                  row.idx === selected
                    ? 'bg-accent text-white'
                    : 'text-text hover:bg-hover'
                }`}
              >
                <span className={row.idx === selected ? 'text-white' : 'text-textDim'}>
                  <row.cmd.Icon size={14} />
                </span>
                <span className="flex-1">{row.cmd.label}</span>
                <span className={`text-[9px] uppercase tracking-wider ${
                  row.idx === selected ? 'text-white/70' : 'text-textMute'
                }`}>{row.cmd.group}</span>
              </button>
            )
          )}
        </div>
        <div className="flex items-center justify-between h-8 px-4 border-t border-border text-[9px] uppercase tracking-wider text-textMute font-semibold">
          <span>↑↓ Navigate</span>
          <span>↵ Add</span>
          <span>Shift+A toggle</span>
        </div>
      </div>
    </div>
  )
}
