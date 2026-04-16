import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import {
  TextIcon, ImageIcon, LabelIcon, ButtonIcon, LinkIcon,
  ToggleIcon, SliderIcon, StepperIcon, PickerIcon, ProgressIcon, GaugeIcon,
  VStackIcon, SpacerIcon, DividerIcon, RectangleIcon,
  ListIcon, TableIcon, MenuIcon,
  SlideshowIcon, TickerIcon,
  SheetIcon, PopoverIcon, AlertIcon,
  WindowIcon, PlusIcon, ChevronDown
} from './icons'

// Restructured to match SwiftUI's ~15 fundamental concepts.
// Everything else (circle vs rectangle, date picker vs color picker, etc.)
// is configured via Properties after adding the base type.

export default function AddDropdown({ variant = 'compact' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const addPanel = useStore((s) => s.addPanel)
  const addStack = useStore((s) => s.addStack)
  const addWindow = useStore((s) => s.addWindow)
  const addPresentation = useStore((s) => s.addPresentation)

  useEffect(() => {
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
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
        { label: 'Stack',   Icon: VStackIcon,     onSel: () => addStack('vstack') },
        { label: 'Spacer',  Icon: SpacerIcon,     onSel: () => addPanel('spacer') },
        { label: 'Divider', Icon: DividerIcon,    onSel: () => addPanel('divider') },
        { label: 'Shape',   Icon: RectangleIcon,  onSel: () => addPanel('rectangle') }
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
        { label: 'Window', Icon: WindowIcon, onSel: () => addWindow() }
      ]
    }
  ]

  return (
    <div ref={ref} className="relative">
      {variant === 'compact' ? (
        <button onClick={() => setOpen(!open)} className="btn btn-icon" title="Add element"><PlusIcon /></button>
      ) : (
        <button onClick={() => setOpen(!open)} className="btn btn-primary"><PlusIcon /> Add <ChevronDown /></button>
      )}
      {open && (
        <div className="popover absolute top-full mt-1 rounded z-50 py-1 max-h-[72vh] overflow-y-auto scrollbar"
          style={{ right: variant === 'compact' ? 0 : 'auto', left: variant === 'compact' ? 'auto' : 0, minWidth: 190 }}>
          {groups.map((g, gi) => (
            <div key={g.label}>
              {gi > 0 && <div className="h-px bg-border my-1" />}
              <div className="px-3 py-1 text-[9px] uppercase tracking-wider text-textMute font-semibold">{g.label}</div>
              {g.items.map(({ label, Icon, onSel }) => (
                <button key={label} onClick={() => choose(onSel)} className="flex items-center gap-2.5 w-full text-left px-3 py-1.5 text-[11px] text-text hover:bg-hover transition-colors">
                  <span className="text-textDim w-3.5 flex justify-center"><Icon /></span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
