import { useState, useMemo } from 'react'
import { useStore } from '../store'
import { exportSwiftUI } from '../export/swiftui'

// Full-screen overlay that renders the SwiftUI export for every Tab in the
// scene plus an App.swift file for top-level navigation. Each file has its
// own tab button at the top so designers can copy them into Xcode one at a
// time. The body text area is read-only — copy is the primary action.

export default function SwiftExportDialog({ onClose }) {
  const items = useStore((s) => s.items)
  const scene = useStore((s) => s.scene)
  const [appName, setAppName] = useState('MyApp')
  // Pass `scene` so the App-level Scene picks the right shape:
  // WindowGroup / volumetric WindowGroup / ImmersiveSpace per spec §3.1.
  const files = useMemo(() => exportSwiftUI(items, appName || 'MyApp', scene), [items, appName, scene])
  const [activeIdx, setActiveIdx] = useState(0)
  const active = files[activeIdx] || files[0]

  const copy = async (content) => {
    try { await navigator.clipboard.writeText(content) } catch {}
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-surface border border-border rounded-lg flex flex-col"
        style={{ width: '80vw', maxWidth: 960, height: '80vh' }}
      >
        {/* Header — title + app-name field + close */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-textDim">
            Export SwiftUI
          </div>
          <div className="flex items-center gap-2 ml-4">
            <span className="text-[10px] text-textMute">App name</span>
            <input
              className="field"
              value={appName}
              onChange={(e) => setAppName(e.target.value.replace(/[^A-Za-z0-9]/g, ''))}
              style={{ width: 140 }}
            />
          </div>
          <div className="flex-1" />
          <button className="btn" onClick={() => copy(active.content)}>Copy file</button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        {/* File tabs */}
        <div className="flex gap-1 px-3 py-1 border-b border-border overflow-x-auto">
          {files.map((f, i) => (
            <button
              key={f.filename}
              onClick={() => setActiveIdx(i)}
              className={`px-3 py-1 text-[11px] rounded transition-colors whitespace-nowrap ${
                i === activeIdx ? 'bg-accentBg text-text' : 'text-textDim hover:bg-hover'
              }`}
            >
              {f.filename}
            </button>
          ))}
        </div>

        {/* Code body — read-only textarea; select-all + copy work natively */}
        <textarea
          readOnly
          value={active?.content || ''}
          className="flex-1 font-mono text-[11px] leading-[1.45] p-3 bg-[#0f0f10] text-[#e4e4e4] resize-none focus:outline-none"
          style={{ whiteSpace: 'pre', tabSize: 4 }}
          onClick={(e) => e.currentTarget.select()}
        />

        <div className="px-4 py-2 border-t border-border text-[10px] text-textMute">
          {files.length} file{files.length === 1 ? '' : 's'} · paste each one into a separate .swift file in Xcode. Coverage is pragmatic — TODO comments flag types the exporter can't yet emit.
        </div>
      </div>
    </div>
  )
}
