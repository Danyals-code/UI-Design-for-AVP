import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { GridIcon, HandIcon, HdriIcon, VolumeIcon } from './icons'
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
  const DEFAULT_DIST = 7.0
  const pct = Math.round((DEFAULT_DIST / Math.max(0.5, zoomDistance)) * 100)

  // Height/border intentionally matches vp-btn (28px, border, dark tint)
  // so the toolbar row reads as a single aligned group.
  return (
    <div
      className="flex items-center gap-1 rounded px-2"
      style={{
        height: 28,
        border: '1px solid #2e2e2e',
        background: 'rgba(21, 21, 21, 0.88)',
        backdropFilter: 'blur(8px)'
      }}
    >
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
  const preview3D = useStore((s) => s.scene.preview3D)
  const updateScene = useStore((s) => s.updateScene)

  const isVolume = sceneMode === 'volume'
  const isWindow = sceneMode === 'window'
  // The 3D-only controls only make sense when a canvas is visible —
  // i.e. window mode (always has canvas) or volume + preview3D.
  const showSceneControls = isWindow || (isVolume && preview3D)

  return (
    <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10 pointer-events-auto">
      {showSceneControls && (
        <>
          <ZoomSlider />
          <button
            onClick={toggleGrid}
            title={showGrid ? 'Hide grid' : 'Show grid'}
            className={`vp-btn ${showGrid ? 'active' : ''}`}
          >
            <GridIcon />
          </button>
          <HdriButton />
          {preview3D && (
            <button
              onClick={togglePanMode}
              title={panMode ? 'Orbit mode' : 'Pan mode'}
              className={`vp-btn ${panMode ? 'active' : ''}`}
            >
              <HandIcon />
            </button>
          )}
        </>
      )}
      {/* "See in 3D" is a window-level action — it rotates to the angled
          preview camera. Hidden in volume mode because volume is still
          placeholder-only. */}
      {isWindow && (
        <button
          onClick={() => updateScene({ preview3D: !preview3D })}
          title={preview3D ? 'Exit 3D preview' : 'See in 3D (experimental)'}
          className={`vp-btn ${preview3D ? 'active' : ''}`}
          style={
            !preview3D
              ? {
                  width: 'auto',
                  paddingLeft: 10,
                  paddingRight: 10,
                  gap: 6,
                  fontSize: 11,
                  color: '#e4e4e4'
                }
              : undefined
          }
        >
          <VolumeIcon />
          {!preview3D && <span>See in 3D</span>}
        </button>
      )}
    </div>
  )
}
