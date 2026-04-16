import { useState, useMemo } from 'react'
import { SF_SYMBOLS, SF_SYMBOL_ORDER } from '../appleSystem'

// A modal grid picker for SF Symbols. Opens as a popover-style overlay.
// `onSelect(symbolName)` fires when the user picks a symbol.
// `onClose()` dismisses the picker.

export default function SymbolPicker({ current, onSelect, onClose }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query) return SF_SYMBOL_ORDER
    const q = query.toLowerCase()
    return SF_SYMBOL_ORDER.filter((name) => {
      const sym = SF_SYMBOLS[name]
      return name.toLowerCase().includes(q) || sym.label.toLowerCase().includes(q)
    })
  }, [query])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-[380px] bg-[#1a1a1a] border border-borderHi rounded-lg shadow-pop overflow-hidden flex flex-col"
        style={{ boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 h-10 border-b border-border">
          <span className="text-textMute text-[11px]">SF Symbol</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
            placeholder="Search symbols..."
            className="flex-1 bg-transparent border-none outline-none text-[12px] text-text placeholder-textMute"
          />
          <button onClick={onClose} className="text-textMute hover:text-text text-[11px]">ESC</button>
        </div>

        {/* Grid */}
        <div className="flex-1 max-h-[320px] overflow-y-auto scrollbar p-2">
          {filtered.length === 0 && (
            <div className="p-6 text-center text-textMute text-[11px]">No symbols match</div>
          )}
          <div className="grid grid-cols-8 gap-1">
            {filtered.map((name) => {
              const sym = SF_SYMBOLS[name]
              const isCurrent = current === name
              return (
                <button
                  key={name}
                  onClick={() => { onSelect(name); onClose() }}
                  title={`${sym.label} (${name})`}
                  className={`w-10 h-10 flex items-center justify-center rounded text-[16px] transition-colors ${
                    isCurrent
                      ? 'bg-accent text-white'
                      : 'text-text hover:bg-hover'
                  }`}
                >
                  {sym.glyph}
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="h-7 px-3 border-t border-border flex items-center text-[9px] text-textMute uppercase tracking-wider">
          {filtered.length} symbols • click to select
        </div>
      </div>
    </div>
  )
}
