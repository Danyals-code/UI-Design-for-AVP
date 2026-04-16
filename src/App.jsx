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
  const updateItem = useStore((s) => s.updateItem)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)

  useEffect(() => {
    // Read the current selection + item list fresh on every key so we always
    // nudge the currently-selected item, not a stale one.
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (mod && key === 'z' && !e.shiftKey) { undo(); e.preventDefault(); return }
      if (mod && key === 'z' && e.shiftKey) { redo(); e.preventDefault(); return }
      if (mod && key === 'c') { if (selectedId) { copyItem(selectedId); e.preventDefault() } return }
      if (mod && key === 'v') { pasteItem(); e.preventDefault(); return }
      if (mod && key === 'd') { if (selectedId) { copyItem(selectedId); pasteItem(); e.preventDefault() } return }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        removeItem(selectedId); e.preventDefault(); return
      }

      // Shift+A — open the layers-panel Add menu (mirrors Blender's add shortcut).
      if (e.shiftKey && key === 'a' && !mod) {
        const btn = document.querySelector('button[title="Add element"]')
        if (btn) { btn.click(); e.preventDefault(); return }
      }

      // Arrow-key nudge — move the selected window's position (visionOS is
      // a 3D scene, so we nudge in world X/Y). Shift = larger step.
      if (selectedId && !mod && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        const step = e.shiftKey ? 0.1 : 0.02   // scene units (~10pt vs ~2pt)
        const item = useStore.getState().items.find((it) => it.id === selectedId)
        if (!item) return
        if (item.type === 'window') {
          const [x, y, z] = item.position
          let nx = x, ny = y
          if (e.key === 'ArrowLeft')  nx -= step
          if (e.key === 'ArrowRight') nx += step
          if (e.key === 'ArrowUp')    ny += step
          if (e.key === 'ArrowDown')  ny -= step
          updateItem(item.id, { position: [nx, ny, z] })
          e.preventDefault()
        } else if (item.type === 'panel') {
          // For panels inside a stack, nudge modifiers.offset — that's how
          // SwiftUI .offset(x:y:) works without disturbing layout.
          const m = item.modifiers || {}
          const ox = m.offsetX ?? 0
          const oy = m.offsetY ?? 0
          let nx = ox, ny = oy
          const ptStep = e.shiftKey ? 10 : 1
          if (e.key === 'ArrowLeft')  nx -= ptStep
          if (e.key === 'ArrowRight') nx += ptStep
          if (e.key === 'ArrowUp')    ny -= ptStep
          if (e.key === 'ArrowDown')  ny += ptStep
          updateItem(item.id, { modifiers: { ...m, offsetX: nx, offsetY: ny } })
          e.preventDefault()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, copyItem, pasteItem, removeItem, updateItem, undo, redo])

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
            Double-click text to edit · Ctrl+Z undo · Shift+A add · Arrows nudge
          </div>
        </div>
        <div onMouseDown={startRight} className="resize-gutter" title="Drag to resize" />
        <PropertiesPanel width={rightWidth} />
      </div>
    </div>
  )
}
