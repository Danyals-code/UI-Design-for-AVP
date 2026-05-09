import { useStore } from '../store'

export default function Topbar({ onTitleClick, previewMode = false }) {
  const count = useStore((s) => s.items.length)
  const mode = useStore((s) => s.scene.sceneMode)
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
    </div>
  )
}
