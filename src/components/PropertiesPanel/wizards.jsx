// Inspector wizards: ToolbarWizard, TabBarWizard, SplitViewWizard.
// Each wraps a small piece of stack-tree authoring behind a popover-style
// form so the inspector stays uncluttered.

import { useState } from 'react'
import { useStore } from '../../store'
import { Row, IntField } from './primitives'

// SwiftUI `.toolbar` — one bar per call, attached to `.topBar` or
// `.bottomBar`. Items split into three placements that mirror
// `ToolbarItem(placement: .topBarLeading / .principal / .topBarTrailing)`:
//   • leading  — pinned left
//   • principal — centered (typically the navigation title)
//   • trailing — pinned right
// We keep the inputs as comma-separated lists so users can seed several
// buttons without clicking +. Blank groups collapse — a toolbar with only
// a principal behaves like a classic navigation-title bar.
export function ToolbarWizard() {
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState('top')
  const [leading,   setLeading]   = useState('Edit')
  const [principal, setPrincipal] = useState('Title')
  const [trailing,  setTrailing]  = useState('Done')
  const addToolbar = useStore((s) => s.addToolbar)

  const parseList = (s) =>
    (s || '').split(',').map((x) => x.trim()).filter((x) => x.length > 0)

  if (!open) {
    return (
      <button className="btn w-full justify-center" onClick={() => setOpen(true)}>
        + Toolbar
      </button>
    )
  }
  return (
    <div className="flex flex-col gap-2 p-2 bg-surface2 border border-border rounded">
      <Row label="Placement">
        <div className="segmented flex-1">
          <button
            className={placement === 'top' ? 'active' : ''}
            onClick={() => setPlacement('top')}
            title=".toolbar(placement: .topBar)"
          >Top Bar</button>
          <button
            className={placement === 'bottom' ? 'active' : ''}
            onClick={() => setPlacement('bottom')}
            title=".toolbar(placement: .bottomBar)"
          >Bottom Bar</button>
        </div>
      </Row>
      <Row label="Leading">
        <input
          value={leading}
          onChange={(e) => setLeading(e.target.value)}
          placeholder="Edit, Cancel"
          className="field flex-1"
          title="Comma-separated button labels pinned to the left"
        />
      </Row>
      <Row label="Principal">
        <input
          value={principal}
          onChange={(e) => setPrincipal(e.target.value)}
          placeholder="Title"
          className="field flex-1"
          title="Centered title (leave blank to skip)"
        />
      </Row>
      <Row label="Trailing">
        <input
          value={trailing}
          onChange={(e) => setTrailing(e.target.value)}
          placeholder="Done, Save"
          className="field flex-1"
          title="Comma-separated button labels pinned to the right"
        />
      </Row>
      <div className="text-[9px] text-textMute leading-relaxed">
        Tip: Separate multiple labels with commas. Leave a slot blank to
        skip it. Principal accepts a single string (the title).
      </div>
      <div className="flex gap-1 mt-1">
        <button
          className="btn btn-primary flex-1 justify-center"
          onClick={() => {
            addToolbar({
              placement,
              leading:   parseList(leading),
              principal: principal,
              trailing:  parseList(trailing)
            })
            setOpen(false)
          }}
        >Add</button>
        <button className="btn flex-1 justify-center" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}

export function TabBarWizard() {
  const [open, setOpen] = useState(false)
  const [pages, setPages] = useState(4)
  const [labels, setLabels] = useState(['Home', 'Search', 'Library', 'Profile'])
  const addTabBar = useStore((s) => s.addTabBar)
  const setPagesClamped = (n) => {
    const p = Math.max(2, Math.min(5, n))
    setPages(p)
    if (labels.length < p) {
      setLabels([...labels, ...Array(p - labels.length).fill('').map((_, i) => `Tab ${labels.length + i + 1}`)])
    }
  }
  if (!open) {
    return (
      <button className="btn w-full justify-center" onClick={() => setOpen(true)}>
        + Tab Bar
      </button>
    )
  }
  return (
    <div className="flex flex-col gap-2 p-2 bg-surface2 border border-border rounded">
      <Row label="Pages">
        <IntField value={pages} min={2} max={5} onChange={setPagesClamped} />
      </Row>
      {Array.from({ length: pages }).map((_, i) => (
        <Row key={i} label={`Tab ${i + 1}`}>
          <input
            value={labels[i] || ''}
            onChange={(e) => {
              const next = [...labels]
              next[i] = e.target.value
              setLabels(next)
            }}
            className="field flex-1"
          />
        </Row>
      ))}
      <div className="flex gap-1 mt-1">
        <button
          className="btn btn-primary flex-1 justify-center"
          onClick={() => {
            addTabBar({ pages, labels: labels.slice(0, pages) })
            setOpen(false)
          }}
        >
          Add
        </button>
        <button className="btn flex-1 justify-center" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export function SplitViewWizard() {
  const addSplitView = useStore((s) => s.addSplitView)
  const [style, setStyle] = useState('joined')
  return (
    <div className="flex flex-col gap-2">
      <Row label="Style">
        <div className="segmented flex-1">
          <button
            className={style === 'joined' ? 'active' : ''}
            onClick={() => setStyle('joined')}
          >
            Joined
          </button>
          <button
            className={style === 'separated' ? 'active' : ''}
            onClick={() => setStyle('separated')}
          >
            Separated
          </button>
        </div>
      </Row>
      <div className="text-[10px] text-textMute">
        {style === 'joined'
          ? 'Flush two-column layout (SwiftUI default).'
          : 'Sidebar as a 623pt floating dialogue (r=30) inside the window.'}
      </div>
      <button className="btn w-full justify-center" onClick={() => addSplitView({ style })}>
        + Navigation Split View
      </button>
    </div>
  )
}
