import { useState, useEffect, useRef } from 'react'
import Topbar from './components/Topbar'
import LayersPanel from './components/LayersPanel'
import PropertiesPanel from './components/PropertiesPanel'
import Canvas3D from './components/Canvas3D'
import ViewportOverlay from './components/ViewportOverlay'
import SceneInfoOverlay from './components/SceneInfoOverlay'
import CommandPalette from './components/CommandPalette'
import VolumePlaceholder from './components/VolumePlaceholder'
import Splash from './components/Splash'
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
  // Splash opens on every launch (per user preference) and is reopenable
  // by clicking the "visionOS Designer" title in the topbar.
  const [splashOpen, setSplashOpen] = useState(true)
  const [leftWidth, startLeft] = useResizer(240, 'left')
  const [rightWidth, startRight] = useResizer(280, 'right')
  const selectedId = useStore((s) => s.selectedId)
  const copyItem = useStore((s) => s.copyItem)
  const pasteItem = useStore((s) => s.pasteItem)
  const removeItem = useStore((s) => s.removeItem)
  const updateItem = useStore((s) => s.updateItem)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const scene = useStore((s) => s.scene)
  // Volume mode is under development — the 3D scene only shows when the user
  // opts in via "See in 3D" (preview3D). Otherwise we render the placeholder.
  const showViewport = scene.sceneMode === 'window' || scene.preview3D

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

      // Shift+A is now owned by CommandPalette (registers its own listener).

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
          // Arrow keys nudge an `.offset(x:y:)` modifier on the panel — that's
          // how SwiftUI shifts a view without disturbing the parent layout.
          // The modifier stack is an ordered array, so we find the first
          // existing `offset` entry and bump it; if none, we append one.
          const arr = Array.isArray(item.modifiers) ? item.modifiers : []
          const ptStep = e.shiftKey ? 10 : 1
          let dx = 0, dy = 0
          if (e.key === 'ArrowLeft')  dx -= ptStep
          if (e.key === 'ArrowRight') dx += ptStep
          if (e.key === 'ArrowUp')    dy -= ptStep
          if (e.key === 'ArrowDown')  dy += ptStep
          const idx = arr.findIndex((m) => m.type === 'offset')
          let next
          if (idx >= 0) {
            next = arr.slice()
            const cur = next[idx]
            next[idx] = { ...cur, x: (cur.x || 0) + dx, y: (cur.y || 0) + dy }
          } else {
            next = [...arr, { id: `mod-arrow-${Date.now()}`, type: 'offset', x: dx, y: dy }]
          }
          updateItem(item.id, { modifiers: next })
          e.preventDefault()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, copyItem, pasteItem, removeItem, updateItem, undo, redo])

  return (
    <div className="h-screen w-screen flex flex-col bg-bg text-text overflow-hidden">
      <Splash open={splashOpen} onClose={() => setSplashOpen(false)} />
      <CommandPalette />
      <Topbar onTitleClick={() => setSplashOpen(true)} />
      <div className="flex-1 flex min-h-0">
        <LayersPanel width={leftWidth} />
        <div onMouseDown={startLeft} className="resize-gutter" title="Drag to resize" />
        <div className="flex-1 relative min-w-0">
          {showViewport ? <Canvas3D /> : <VolumePlaceholder />}
          {/* Toolbar renders on top of both the 3D canvas and the placeholder
              so "See in 3D" can live alongside zoom/grid. */}
          <ViewportOverlay />
          <SceneInfoOverlay />
          {showViewport && (
            <div className="absolute bottom-3 left-3 text-[9px] text-textMute bg-[#151515]/70 backdrop-blur px-2.5 py-1.5 rounded-md border border-border/60 pointer-events-none tracking-wide">
              Double-click text to edit · <kbd className="kbd">⌘Z</kbd> undo · <kbd className="kbd">⇧A</kbd> add · arrows to nudge
            </div>
          )}
        </div>
        <div onMouseDown={startRight} className="resize-gutter" title="Drag to resize" />
        <PropertiesPanel width={rightWidth} />
      </div>
    </div>
  )
}
