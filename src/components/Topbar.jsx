import { useStore } from '../store'

export default function Topbar() {
  const count = useStore((s) => s.items.length)
  const mode = useStore((s) => s.scene.sceneMode)
  return (
    <div className="h-10 bg-surface border-b border-border flex items-center px-3 gap-3 flex-shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-accent flex items-center justify-center text-white text-[9px] font-bold">
          V
        </div>
        <span className="text-[12px] text-text font-semibold tracking-tight">
          visionOS Designer
        </span>
      </div>

      <div className="flex-1" />

      <span className="text-[10px] text-textMute uppercase tracking-wider">
        Shift + A to add
      </span>
      <div className="h-4 w-px bg-border mx-1" />
      <span className="text-[10px] text-textMute uppercase tracking-wider">
        {mode === 'window' ? 'Window Mode' : 'Volume Mode'} · {count} items
      </span>
    </div>
  )
}
