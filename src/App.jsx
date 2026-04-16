import { useState, useEffect, useRef } from 'react'
import Topbar from './components/Topbar'
import LayersPanel from './components/LayersPanel'
import PropertiesPanel from './components/PropertiesPanel'
import Canvas3D from './components/Canvas3D'
import ViewportOverlay from './components/ViewportOverlay'
import CommandPalette from './components/CommandPalette'
import { useStore } from './store'

function useResizer(initial, side) {
  const [width, setWidth] = useState(initial)
  const widthRef = useRef(initial)
  widthRef.current = width
  const start = (e) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = widthRef.current
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev) => {
      const dx = ev.clientX - startX
      const newW = side === 'left' ? startW + dx : startW - dx
      setWidth(Math.max(200, Math.min(520, newW)))
    }
    const onUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  return [width, start]
}

export default function App() {
  const [leftWidth, startLeft] = useResizer(240, 'left')
  const [rightWidth, startRight] = useResizer(280, 'right')
  const selectedId = useStore((s) => s.selectedId)
  const copyItem = useStore((s) => s.copyItem)
  const pasteItem = useStore((s) => s.pasteItem)
  const removeItem = useStore((s) => s.removeItem)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z' && !e.shiftKey) { undo(); e.preventDefault() }
      else if (mod && key === 'z' && e.shiftKey) { redo(); e.preventDefault() }
      else if (mod && key === 'c') { if (selectedId) { copyItem(selectedId); e.preventDefault() } }
      else if (mod && key === 'v') { pasteItem(); e.preventDefault() }
      else if (mod && key === 'd') { if (selectedId) { copyItem(selectedId); pasteItem(); e.preventDefault() } }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        removeItem(selectedId); e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, copyItem, pasteItem, removeItem, undo, redo])

  return (
    <div className="h-screen w-screen flex flex-col bg-bg text-text overflow-hidden">
      <CommandPalette />
      <Topbar />
      <div className="flex-1 flex min-h-0">
        <LayersPanel width={leftWidth} />
        <div onMouseDown={startLeft} className="resize-gutter" title="Drag to resize" />
        <div className="flex-1 relative min-w-0">
          <Canvas3D />
          <ViewportOverlay />
          <div className="absolute bottom-3 left-3 text-[9px] text-textMute bg-[#151515]/80 backdrop-blur px-2 py-1 rounded border border-border pointer-events-none uppercase tracking-wider">
            Double-click text to edit · Ctrl+Z undo · Shift+A add
          </div>
        </div>
        <div onMouseDown={startRight} className="resize-gutter" title="Drag to resize" />
        <PropertiesPanel width={rightWidth} />
      </div>
    </div>
  )
}
