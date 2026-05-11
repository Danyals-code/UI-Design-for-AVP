import { useState } from 'react'
import { useStore } from '../store'
import { SearchIcon } from './icons'
import HelpDialog from './HelpDialog'

export default function Topbar({ onTitleClick, previewMode = false }) {
  const count = useStore((s) => s.items.length)
  const mode = useStore((s) => s.scene.sceneMode)
  const [helpOpen, setHelpOpen] = useState(false)

  // Search button reuses the existing command palette so we keep a
  // single search/runner surface. CommandPalette already listens for
  // the `open-add-palette` event the layers-panel + button uses; we
  // hook into it here so the topbar magnifier behaves identically.
  const openSearch = () => {
    window.dispatchEvent(new CustomEvent('open-add-palette'))
  }
  return (
    <div className="h-10 bg-surface border-b border-border flex items-center px-3 gap-3 flex-shrink-0">
      <button
        type="button"
        onClick={onTitleClick}
        className="flex items-center gap-2 px-2 py-1 -ml-2 rounded-md text-text hover:bg-hover/50 transition-colors cursor-pointer"
        title="Open project picker"
      >
        <div className="w-5 h-5 rounded bg-accent flex items-center justify-center text-white text-[9px] font-bold shadow-sm">
          V
        </div>
        <span className="text-[12px] font-semibold tracking-tight">
          visionOS Designer
        </span>
      </button>

      <div className="flex-1" />

      {/* "Shift + A to add" hint hides in preview — there's no Add
          menu on the preview canvas, so the hint would be misleading. */}
      {!previewMode && (
        <>
          <span className="text-[10px] text-textMute uppercase tracking-wider">
            Shift + A to add
          </span>
          <div className="h-4 w-px bg-border mx-1" />
        </>
      )}
      <span className="text-[10px] text-textMute uppercase tracking-wider">
        {previewMode ? 'Preview' : mode === 'window' ? 'Window Mode' : 'Volume Mode'} · {count} items
      </span>

      {/* Topbar trailing actions — Search opens the command palette
          (same surface as ⇧A), Help opens a longform breakdown of the
          app. Both are kept off the preview chrome so the wearer's
          view stays uncluttered. */}
      {!previewMode && (
        <>
          <div className="h-4 w-px bg-border mx-1" />
          <button
            type="button"
            onClick={openSearch}
            title="Search (⇧A)"
            className="w-7 h-7 flex items-center justify-center rounded-md text-textMute hover:text-text hover:bg-hover/60 transition-colors"
          >
            <SearchIcon size={13} />
          </button>
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            title="Help & app guide"
            className="w-7 h-7 flex items-center justify-center rounded-full text-textMute hover:text-text hover:bg-hover/60 border border-border/60 hover:border-accent/60 transition-colors text-[12px] font-semibold"
          >
            ?
          </button>
        </>
      )}

      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </div>
  )
}
