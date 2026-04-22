import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import {
  TextIcon, ImageIcon, LabelIcon, ButtonIcon, LinkIcon,
  ToggleIcon, SliderIcon, StepperIcon, PickerIcon, ProgressIcon, GaugeIcon,
  VStackIcon, SpacerIcon, DividerIcon, RectangleIcon,
  ListIcon, TableIcon, MenuIcon,
  SlideshowIcon, TickerIcon,
  SheetIcon, PopoverIcon, AlertIcon,
  WindowIcon, PlusIcon, ChevronRight,
  ToolbarIcon, TabViewIcon, NavStackIcon, PageTabIcon,
  SplitViewIcon
} from './icons'

// Each group shows as a row with a right-arrow. Hovering the row reveals a
// side-panel submenu with the items for that group.

const GROUP_ICONS = {
  Views:         TextIcon,
  Controls:      ToggleIcon,
  Layout:        VStackIcon,
  Collections:   ListIcon,
  Display:       SlideshowIcon,
  Presentations: SheetIcon,
  Windows:       WindowIcon
}

export default function AddDropdown({ variant = 'compact' }) {
  const [open, setOpen]               = useState(false)
  const [hoveredGroup, setHoveredGroup] = useState(null)
  const ref = useRef(null)
  // A small close delay means the mouse can cross the tiny gap between the
  // group row and its fly-out submenu without instantly dismissing it. The
  // timer is cancelled whenever the pointer enters *either* the row or the
  // submenu — that's what makes the interaction forgiving.
  const closeTimer = useRef(null)
  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => setHoveredGroup(null), 180)
  }
  const enterGroup = (gi) => {
    cancelClose()
    setHoveredGroup(gi)
  }

  const addPanel       = useStore((s) => s.addPanel)
  const addStack       = useStore((s) => s.addStack)
  const addWindow      = useStore((s) => s.addWindow)
  const addPresentation = useStore((s) => s.addPresentation)
  const addToolbar     = useStore((s) => s.addToolbar)
  const addTabView     = useStore((s) => s.addTabView)
  const addTab         = useStore((s) => s.addTab)
  const addSplitView   = useStore((s) => s.addSplitView)

  useEffect(() => {
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => { document.removeEventListener('mousedown', onDoc); cancelClose() }
  }, [])

  const choose = (fn) => { fn(); setOpen(false) }

  const groups = [
    {
      label: 'Views',
      items: [
        { label: 'Text',   Icon: TextIcon,   onSel: () => addPanel('text') },
        { label: 'Image',  Icon: ImageIcon,  onSel: () => addPanel('image') },
        { label: 'Label',  Icon: LabelIcon,  onSel: () => addPanel('label') },
        { label: 'Button', Icon: ButtonIcon, onSel: () => addPanel('button') },
        { label: 'Link',   Icon: LinkIcon,   onSel: () => addPanel('link') }
      ]
    },
    {
      label: 'Controls',
      items: [
        { label: 'Toggle',   Icon: ToggleIcon,   onSel: () => addPanel('toggle') },
        { label: 'Slider',   Icon: SliderIcon,   onSel: () => addPanel('slider') },
        { label: 'Stepper',  Icon: StepperIcon,  onSel: () => addPanel('stepper') },
        { label: 'Picker',   Icon: PickerIcon,   onSel: () => addPanel('picker') },
        { label: 'Progress', Icon: ProgressIcon, onSel: () => addPanel('progress') },
        { label: 'Gauge',    Icon: GaugeIcon,    onSel: () => addPanel('gauge') }
      ]
    },
    {
      label: 'Layout',
      items: [
        { label: 'Stack',            Icon: VStackIcon,  onSel: () => addStack('vstack') },
        { label: 'Tab View',         Icon: TabViewIcon, onSel: () => addTabView() },
        { label: 'Navigation Stack', Icon: NavStackIcon, onSel: () => addStack('navstack') },
        { label: 'Nav Split View · Joined',    Icon: SplitViewIcon, onSel: () => addSplitView({ style: 'joined' }) },
        { label: 'Nav Split View · Separated', Icon: SplitViewIcon, onSel: () => addSplitView({ style: 'separated' }) },
        { label: 'Toolbar',          Icon: ToolbarIcon, onSel: () => addToolbar({ placement: 'top', items: ['Action 1', 'Action 2', 'Action 3'] }) },
        { label: 'Spacer',         Icon: SpacerIcon,  onSel: () => addPanel('spacer') },
        { label: 'Divider',        Icon: DividerIcon, onSel: () => addPanel('divider') },
        { label: 'Shape',          Icon: RectangleIcon, onSel: () => addPanel('rectangle') }
      ]
    },
    {
      label: 'Collections',
      items: [
        { label: 'List',  Icon: ListIcon,  onSel: () => addPanel('list') },
        { label: 'Table', Icon: TableIcon, onSel: () => addPanel('table') },
        { label: 'Menu',  Icon: MenuIcon,  onSel: () => addPanel('menu') }
      ]
    },
    {
      label: 'Display',
      items: [
        { label: 'Slideshow', Icon: SlideshowIcon, onSel: () => addPanel('slideshow') },
        { label: 'Ticker',    Icon: TickerIcon,    onSel: () => addPanel('ticker') }
      ]
    },
    {
      label: 'Presentations',
      items: [
        { label: 'Sheet',   Icon: SheetIcon,   onSel: () => addPresentation('sheet') },
        { label: 'Alert',   Icon: AlertIcon,   onSel: () => addPresentation('alert') },
        { label: 'Popover', Icon: PopoverIcon, onSel: () => addPresentation('popover') }
      ]
    },
    {
      label: 'Windows',
      items: [
        { label: 'Tab (Page)', Icon: PageTabIcon, onSel: () => addTab() },
        { label: 'Window',     Icon: WindowIcon,  onSel: () => addWindow() }
      ]
    }
  ]

  return (
    <div ref={ref} className="relative">
      {variant === 'compact' ? (
        <button
          onClick={() => setOpen(!open)}
          className="btn btn-icon"
          title="Add element"
        >
          <PlusIcon />
        </button>
      ) : (
        <button
          onClick={() => setOpen(!open)}
          className="btn btn-primary"
        >
          <PlusIcon /> Add <ChevronRight size={8} />
        </button>
      )}

      {open && (
        <div
          className="popover absolute top-full mt-1 rounded z-50 py-1"
          style={{
            right: variant === 'compact' ? 0 : 'auto',
            left:  variant === 'compact' ? 'auto' : 0,
            minWidth: 180
          }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {groups.map((g, gi) => {
            const GroupIcon = GROUP_ICONS[g.label] || VStackIcon
            const isHovered = hoveredGroup === gi
            return (
              <div
                key={g.label}
                className="relative"
                onMouseEnter={() => enterGroup(gi)}
              >
                {/* Group row */}
                <div
                  className={`flex items-center gap-2.5 px-3 py-1.5 cursor-default text-[11px] transition-colors ${
                    isHovered ? 'bg-hover text-text' : 'text-text hover:bg-hover'
                  }`}
                >
                  <span className="text-textDim w-3.5 flex justify-center flex-shrink-0">
                    <GroupIcon />
                  </span>
                  <span className="flex-1">{g.label}</span>
                  <ChevronRight size={9} className="text-textMute flex-shrink-0" />
                </div>

                {/* Submenu — flies out to the right. The negative marginLeft
                    lets the submenu overlap the parent column by a pixel so
                    the pointer never enters a "no-hover" strip on the way
                    across. Combined with the close delay, this makes the
                    interaction feel forgiving instead of twitchy. */}
                {isHovered && g.items.length > 0 && (
                  <div
                    className="popover absolute rounded z-[60] py-1"
                    style={{
                      left: '100%',
                      top: -4,
                      marginLeft: -2,
                      paddingLeft: 2,
                      minWidth: 180
                    }}
                    onMouseEnter={cancelClose}
                    onMouseLeave={scheduleClose}
                  >
                    {g.items.map(({ label, Icon, onSel }) => (
                      <button
                        key={label}
                        onClick={() => choose(onSel)}
                        className="flex items-center gap-2.5 w-full text-left px-3 py-1.5 text-[11px] text-text hover:bg-hover transition-colors"
                      >
                        <span className="text-textDim w-3.5 flex justify-center flex-shrink-0">
                          <Icon />
                        </span>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
