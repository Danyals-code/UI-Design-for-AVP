import { useState, useEffect, useRef } from 'react'
import Topbar from './components/Topbar'
import LayersPanel from './components/LayersPanel'
import AssetsPanel from './components/AssetsPanel'
import PropertiesPanel from './components/PropertiesPanel'
import Canvas3D from './components/Canvas3D'
import ViewportOverlay from './components/ViewportOverlay'
import TransformToolbar from './components/TransformToolbar'
import SceneInfoOverlay from './components/SceneInfoOverlay'
import CommandPalette from './components/CommandPalette'
import AddWizardDialog from './components/AddWizardDialog'
import Splash from './components/Splash'
import PreviewButton from './components/PreviewButton'
import { useStore } from './store'

function useResizer(initial, side, { min = 200, max = 520 } = {}) {
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
      setWidth(Math.max(min, Math.min(max, newW)))
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
  return [width, start, setWidth]
}

// Vertical splitter — used inside the left sidebar to size the top
// (LayersPanel) and bottom (AssetsPanel) sections. Stores a percentage
// of the available height for the top half so the split scales with
// the viewport rather than freezing at a pixel value.
function useVerticalResizer(initialPct = 60) {
  const [topPct, setTopPct] = useState(initialPct)
  const pctRef = useRef(initialPct)
  pctRef.current = topPct
  const start = (e) => {
    e.preventDefault()
    const container = e.currentTarget.parentElement
    const rect = container?.getBoundingClientRect()
    if (!rect) return
    const startY = e.clientY
    const startPct = pctRef.current
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev) => {
      const dy = ev.clientY - startY
      const newPct = startPct + (dy / rect.height) * 100
      setTopPct(Math.max(20, Math.min(85, newPct)))
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
  return [topPct, start]
}

// Local-storage key used to skip the splash on subsequent launches.
// Set on the first dismissal so returning users land straight in the
// editor; cleared when the user explicitly re-opens the splash via
// the topbar title (giving them an obvious way to start a fresh
// project later).
const SPLASH_SEEN_KEY = 'visionos-designer:splash-seen-v1'

export default function App() {
  // Restore the autosaved project before first paint, so a refresh lands
  // the user back where they were instead of on a fresh seed. Runs once:
  // the ref guards React 18's double-invoke in StrictMode, which would
  // otherwise restore twice and clobber the history we just cleared.
  const restoredRef = useRef(false)
  const [restored] = useState(() => {
    if (restoredRef.current) return false
    restoredRef.current = true
    try { return useStore.getState().restoreAutosave() } catch { return false }
  })

  // Splash opens only on the FIRST launch (or when explicitly
  // re-opened from the topbar). Returning users skip the splash and
  // land in the editor immediately — way less friction than the
  // previous "show on every launch" behaviour. A restored project also
  // suppresses it: the user already has work on screen, and a template
  // picker over the top of it invites destroying it by accident.
  const [splashOpen, setSplashOpen] = useState(() => {
    if (restored) return false
    try { return !localStorage.getItem(SPLASH_SEEN_KEY) } catch { return true }
  })
  const closeSplash = () => {
    setSplashOpen(false)
    try { localStorage.setItem(SPLASH_SEEN_KEY, '1') } catch {}
  }
  const openSplash = () => {
    setSplashOpen(true)
    try { localStorage.removeItem(SPLASH_SEEN_KEY) } catch {}
  }
  // Left sidebar can auto-grow with the asset library — capped at 420
  // so a runaway folder doesn't eat half the screen. The user can still
  // drag past the cap via the gutter (up to 520) and shrink back any
  // time; auto-grow only nudges in the "give me more room" direction
  // and never overrides a manual choice that's already wider.
  const [leftWidth, startLeft, setLeftWidth] = useResizer(240, 'left', { min: 200, max: 520 })
  const [rightWidth, startRight] = useResizer(280, 'right')
  const [leftTopPct, startLeftSplit] = useVerticalResizer(62)
  const selectedId = useStore((s) => s.selectedId)
  const copyItem = useStore((s) => s.copyItem)
  const pasteItem = useStore((s) => s.pasteItem)
  const removeItem = useStore((s) => s.removeItem)
  const updateItem = useStore((s) => s.updateItem)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const scene = useStore((s) => s.scene)
  const assetCount = useStore((s) => s.assets.length)

  // Auto-grow the sidebar with the asset library. We compute a "needed"
  // width by reasoning about how many tile rows the asset count
  // produces in the 3-column grid, then bump the sidebar up to fit
  // (capped at 420 — leaves the user 100px of headroom before the hard
  // max). Only ever grows: a user who manually dragged wider keeps
  // their choice. We guard on `assetCount` only, so adding assets
  // grows the sidebar but folder navigation doesn't shrink it back.
  useEffect(() => {
    const AUTO_MAX = 420
    // 3 cols at ~64px per tile, plus ~32px of header + padding chrome.
    // Each additional row of items (after the first 9) effectively
    // wants ~24px more horizontal room so labels don't truncate.
    const rows = Math.max(1, Math.ceil((assetCount + 4) / 3))
    const target = Math.min(AUTO_MAX, 240 + rows * 12)
    setLeftWidth((w) => (target > w ? target : w))
  }, [assetCount, setLeftWidth])

  // Autosave. Subscribing to the store rather than calling save from each
  // action keeps persistence out of every slice: any change to the document
  // schedules one debounced write. Selection and drag state are excluded so
  // merely clicking around does not churn localStorage.
  useEffect(() => {
    let prev = useStore.getState()
    const unsub = useStore.subscribe((s) => {
      const documentChanged =
        s.items !== prev.items ||
        s.scene !== prev.scene ||
        s.assets !== prev.assets ||
        s.activeTabId !== prev.activeTabId ||
        s.projectName !== prev.projectName
      prev = s
      if (documentChanged) s.scheduleAutosave()
    })
    // A pending debounce would be lost on close, so flush the last edit.
    const onLeave = () => { try { useStore.getState().flushAutosave() } catch {} }
    window.addEventListener('beforeunload', onLeave)
    return () => {
      unsub()
      window.removeEventListener('beforeunload', onLeave)
    }
  }, [])

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
      // Save the project file. Intercepted so the browser's own
      // "save this page" dialog never opens over the editor.
      if (mod && key === 's') {
        useStore.getState().saveProjectToFile()
        e.preventDefault()
        return
      }
      if (mod && key === 'c') { if (selectedId) { copyItem(selectedId); e.preventDefault() } return }
      if (mod && key === 'v') { pasteItem(); e.preventDefault(); return }
      if (mod && key === 'd') { if (selectedId) { copyItem(selectedId); pasteItem(); e.preventDefault() } return }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        removeItem(selectedId); e.preventDefault(); return
      }

      // Esc exits preview mode — same UX as Framer / Figma's preview.
      if (e.key === 'Escape' && useStore.getState().scene.previewMode) {
        useStore.getState().updateScene({ previewMode: false })
        e.preventDefault()
        return
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

  const isPreview = scene.previewMode

  // Layout: Canvas3D is mounted in a fixed absolute layer that fills
  // the full viewport area below the Topbar. Side panels float over
  // it as absolute-positioned columns. Toggling preview removes the
  // panel columns without reflowing — the canvas's WebGL backbuffer,
  // its camera aspect, and what's drawn at the centre of the screen
  // stay byte-for-byte identical, so the scene appears "constant"
  // through the transition.
  return (
    <div className="h-screen w-screen flex flex-col bg-bg text-text overflow-hidden">
      <Splash open={splashOpen && !isPreview} onClose={closeSplash} />
      {!isPreview && <CommandPalette />}
      {!isPreview && <AddWizardDialog />}
      <Topbar onTitleClick={openSplash} previewMode={isPreview} />

      <div className="flex-1 relative min-h-0">
        {/* Always-on canvas layer. Sits beneath the editing chrome.
            The wrapper div catches asset drops out of the AssetsPanel
            so we can spawn entities on drop. R3F's <Canvas> doesn't
            handle DOM drag-events, hence the outer div. */}
        <div
          className="absolute inset-0"
          onDragOver={(e) => {
            // Only swallow the drop if the drag started in our
            // assets panel — let unrelated drags fall through.
            if (useStore.getState().pendingDropAsset) e.preventDefault()
          }}
          onDrop={(e) => {
            e.preventDefault()
            // Resolve the asset record. `pendingDropAsset` carries the
            // full record (set on dragstart); the JSON dataTransfer is
            // the cross-frame fallback. ID-only is the last-resort path.
            let asset = useStore.getState().pendingDropAsset
            if (!asset || typeof asset === 'string') {
              const json = e.dataTransfer.getData('application/x-asset-record')
              if (json) {
                try { asset = JSON.parse(json) } catch { asset = null }
              }
            }
            if (!asset) {
              const id = e.dataTransfer.getData('application/x-asset-id')
              if (id) asset = id   // spawnAssetIntoScene falls back to id-lookup
            }
            if (!asset) return
            useStore.getState().spawnAssetIntoScene?.(asset)
            useStore.getState().clearPendingDropAsset?.()
          }}
        >
          <Canvas3D />
        </div>

        {/* Editing chrome — left panel, right panel, gutters, overlays. */}
        {!isPreview && (
          <>
            <div className="absolute top-0 left-0 bottom-0 z-10 flex">
              {/* Left sidebar split vertically: Layers up top, Assets
                  in the bottom half, with a draggable horizontal
                  splitter between them. The split is stored as a
                  percentage so the two halves scale with viewport
                  height instead of freezing at a pixel value. */}
              <div className="flex flex-col bg-panel" style={{ width: leftWidth }}>
                <div className="overflow-hidden flex-shrink-0" style={{ height: `${leftTopPct}%` }}>
                  <LayersPanel width={leftWidth} />
                </div>
                <div
                  onMouseDown={startLeftSplit}
                  className="h-1 cursor-ns-resize bg-border hover:bg-accent/60 transition-colors flex-shrink-0"
                  title="Drag to resize"
                />
                <div className="flex-1 min-h-0 overflow-hidden">
                  <AssetsPanel />
                </div>
              </div>
              <div onMouseDown={startLeft} className="resize-gutter" title="Drag to resize" />
            </div>
            <div className="absolute top-0 right-0 bottom-0 z-10 flex">
              <div onMouseDown={startRight} className="resize-gutter" title="Drag to resize" />
              <PropertiesPanel width={rightWidth} />
            </div>
          </>
        )}

        {/* Viewport overlays. Constrained to the visible canvas area
            between the side panels — without the inset wrapper their
            `top-3 right-3` would resolve against the full row and
            slide behind the right panel (and the same on the left
            with the transform toolbar). 2 px on each side accounts
            for the resize-gutter; the 3-px tailwind padding lives
            inside each overlay. Preview drops the inset entirely. */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: isPreview ? 0 : leftWidth + 2,
            right: isPreview ? 0 : rightWidth + 2
          }}
        >
          {!isPreview && <TransformToolbar />}
          {!isPreview && <ViewportOverlay />}
          {!isPreview && <SceneInfoOverlay />}
          <PreviewButton />
        </div>
        {/* Edit hint. Anchored to the left edge but capped at the
            viewport's left half so it never bleeds under the centred
            Preview pill on narrow monitors. The preview button sits at
            z-30 — even if a wider future hint slips this guard, the
            button still paints over it instead of disappearing. */}
        {!isPreview && (
          <div
            className="absolute bottom-3 text-[9px] text-textMute bg-[#151515]/70 backdrop-blur px-2.5 py-1.5 rounded-md border border-border/60 pointer-events-none tracking-wide z-20 truncate"
            style={{ left: leftWidth + 16, maxWidth: 'calc(50vw - 120px)' }}
          >
            Double-click text to edit · <kbd className="kbd">⌘Z</kbd> undo · <kbd className="kbd">⇧A</kbd> add · arrows to nudge
          </div>
        )}
      </div>
    </div>
  )
}
