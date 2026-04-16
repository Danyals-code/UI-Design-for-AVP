import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { GridIcon, HandIcon, HdriIcon } from './icons'
import { HDRI_PRESETS } from '../appleSystem'

function HdriButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const hdri = useStore((s) => s.scene.hdri)
  const updateScene = useStore((s) => s.updateScene)

  useEffect(() => {
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const active = hdri != null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        title="Environment"
        className={`vp-btn ${active ? 'active' : ''}`}
      >
        <HdriIcon />
      </button>
      {open && (
        <div className="popover absolute right-0 top-full mt-1 rounded z-50 py-1 w-36">
          {Object.entries(HDRI_PRESETS).map(([key, v]) => (
            <button
              key={key}
              onClick={() => { updateScene({ hdri: v.preset }); setOpen(false) }}
              className={`block w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                hdri === v.preset ? 'bg-accentBg text-text' : 'text-text hover:bg-hover'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ZoomSlider() {
  const zoomDistance = useStore((s) => s.zoomDistance)
  const setZoomDistance = useStore((s) => s.setZoomDistance)
  // Slider goes from 1 (zoomed in) to 20 (zoomed out).
  // We show a percentage: default distance (~7) = 100%.
  const DEFAULT_DIST = 7.0
  const pct = Math.round((DEFAULT_DIST / Math.max(0.5, zoomDistance)) * 100)

  return (
    <div className="flex items-center gap-1 bg-[#151515]/90 border border-border rounded px-2 py-1 backdrop-blur">
      <span className="text-[9px] text-textMute w-7 text-right">{pct}%</span>
      <input
        type="range"
        min={1}
        max={18}
        step={0.1}
        value={zoomDistance}
        onChange={(e) => setZoomDistance(parseFloat(e.target.value))}
        className="w-20 accent-accent"
        title="Zoom"
      />
    </div>
  )
}

export default function ViewportOverlay() {
  const showGrid = useStore((s) => s.showGrid)
  const panMode = useStore((s) => s.panMode)
  const toggleGrid = useStore((s) => s.toggleGrid)
  const togglePanMode = useStore((s) => s.togglePanMode)
  const sceneMode = useStore((s) => s.scene.sceneMode)

  return (
    <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10 pointer-events-auto">
      <ZoomSlider />
      <button
        onClick={toggleGrid}
        title={showGrid ? 'Hide grid' : 'Show grid'}
        className={`vp-btn ${showGrid ? 'active' : ''}`}
      >
        <GridIcon />
      </button>
      <HdriButton />
      {sceneMode === 'volume' && (
        <button
          onClick={togglePanMode}
          title={panMode ? 'Orbit mode' : 'Pan mode'}
          className={`vp-btn ${panMode ? 'active' : ''}`}
        >
          <HandIcon />
        </button>
      )}
    </div>
  )
}
