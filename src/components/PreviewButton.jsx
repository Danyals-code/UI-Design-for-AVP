// "Preview" toggle pinned to the bottom-centre of the viewport.
//
// When pressed, hides the side panels (layers + properties) and
// repurposes the canvas as a live preview — Topbar stays so the user
// can see project / mode context. Mouse pointer + clicks substitute
// for the wearer's gaze + pinch on real hardware.
//
// While preview is on, the same bottom-centre slot becomes the
// "Exit Preview" pill, and a compact instruction strip sits just
// below it explaining how to drive the first-person camera.

import { useStore } from '../store'

// Single row in the top-right preview hint panel — one or more keycap
// chips on the left, the human-readable action label on the right. Kept
// as a tiny helper so future hand-gesture combos (Click + Hold + W, etc)
// can be expressed by passing more chips into `keys`.
function HintRow({ keys, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {keys.map((k) => (
          <span
            key={k}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 18, height: 18, padding: '0 5px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: 4,
              color: '#f0f0f1',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 9.5, fontWeight: 600,
              letterSpacing: 0.4,
              boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.25)'
            }}
          >
            {k}
          </span>
        ))}
      </div>
      <span style={{ color: '#cfcfd1' }}>{label}</span>
    </div>
  )
}

export default function PreviewButton() {
  const previewMode = useStore((s) => s.scene.previewMode)
  const updateScene = useStore((s) => s.updateScene)
  const sceneMode   = useStore((s) => s.scene.sceneMode)
  const isVolume = sceneMode === 'volume'

  // Entering preview always slams the camera back to the wearer's
  // default eye-line pose. Without this the user keeps whatever orbit
  // pose they were authoring with — including weird angles — and the
  // preview reads as "broken" before they even start interacting.
  // Defer the snap a frame so previewMode flips first; OrbitControls
  // disables itself in preview, so the snap targets the FPS rig.
  //
  // Window mode: seed `activeWindowId` with the configured primary
  // (or the first window in document order) so preview opens to a
  // known plate. A Button's tapAction can mutate it from there.
  const enter = () => {
    const state = useStore.getState()
    const isWindow = state.scene.sceneMode === 'window'
    let activeWindowId = state.scene.activeWindowId
    if (isWindow) {
      const wins = state.items.filter((it) => it.type === 'window')
      const primary = state.scene.primaryWindowId
      activeWindowId = (primary && wins.some((w) => w.id === primary))
        ? primary
        : (wins[0]?.id || null)
    }
    updateScene({ previewMode: true, activeWindowId })
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('snap-camera-to-default'))
    })
  }
  // Exit clears `activeWindowId` so the editor's multi-window layout
  // shows every plate again at its stored editor position.
  const exit  = () => updateScene({ previewMode: false, activeWindowId: null })

  // Shared shell so the entry / exit pill keep identical metrics — same
  // bottom-centre slot, same height, same padding. `tinted` flips the
  // pill into a solid accent colour so the Preview entry button reads
  // as the primary action in the viewport rather than blending into the
  // other dark chrome.
  const PillShell = ({ onClick, title, children, tinted = false }) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 30,
        paddingLeft: 14, paddingRight: 14,
        border: tinted ? '1px solid #0a84ff' : '1px solid #2e2e2e',
        background: tinted ? '#0a84ff' : 'rgba(21, 21, 21, 0.92)',
        backdropFilter: 'blur(8px)',
        color: tinted ? '#ffffff' : '#eaeaea',
        boxShadow: tinted ? '0 6px 16px rgba(10, 132, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)' : 'none',
        fontSize: 12, fontWeight: tinted ? 600 : 500,
        borderRadius: 6,
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      }}
    >
      {children}
    </button>
  )

  const resetCamera = () => {
    // Same hook the editing-mode "VR View" pill uses; the binder lives
    // inside Canvas3D and snaps the camera back to VOLUME_VR_POS /
    // VOLUME_VR_TARGET regardless of where the FirstPerson rig has
    // walked the camera off to.
    window.dispatchEvent(new CustomEvent('snap-camera-to-default'))
  }

  // Screenshot capture. The actual readback lives inside the Canvas
  // (ScreenshotBinder in Canvas3D.jsx) so it can pull the GL buffer via
  // useThree; this just kicks the event. DOM overlays (this button, the
  // top-right hint panel, the Topbar) sit outside the canvas element
  // and are automatically excluded from the PNG.
  const takeScreenshot = () => {
    window.dispatchEvent(new CustomEvent('request-preview-screenshot'))
  }

  if (previewMode) {
    // Same anchor as the Preview entry button so the user's mouse
    // doesn't have to travel — flipping in / out of preview is a single
    // click in one fixed spot. The Reset View button sits beside it
    // so the user can recover from any walk-around without leaving
    // preview. Shown for window mode too — the wearer can also
    // walk/orbit out of frame and may need a way back.
    return (
      <>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-2">
          <PillShell onClick={takeScreenshot} title="Save a PNG of the preview canvas (UI overlays are excluded automatically)">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {/* Camera body + lens */}
              <path d="M2 5h2.5l1-1.5h5L11.5 5H14v8H2z" />
              <circle cx="8" cy="9" r="2.5" />
            </svg>
            Screenshot
          </PillShell>
          <PillShell onClick={resetCamera} title={isVolume ? 'Snap back to the default VR spawn point' : 'Re-centre the camera on the window'}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {/* Curved reset arrow */}
              <path d="M3 8a5 5 0 1 0 1.5-3.5" />
              <path d="M3 3v3h3" />
            </svg>
            Reset View
          </PillShell>
          <PillShell onClick={exit} title="Leave preview and return to editing">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
            Exit Preview
            <span style={{ opacity: 0.55, fontSize: 10, marginLeft: 4 }}>Esc</span>
          </PillShell>
        </div>

        {/* Interaction hints — top-right panel listing the keyboard / mouse
            mapping. Designed to scale with future hand-gesture combos
            (the user explicitly called this out as the seed for keyboard
            + mouse compounds), so we lay it out as a small key/action
            table rather than a single one-line strip. */}
        <div
          className="absolute top-3 right-3 z-20 pointer-events-none"
        >
          <div
            style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              padding: '10px 12px',
              minWidth: 196,
              background: 'rgba(21, 21, 21, 0.78)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(70, 70, 70, 0.55)',
              borderRadius: 6,
              color: '#cfcfd1',
              fontSize: 10.5, lineHeight: 1.25,
              letterSpacing: 0.2
            }}
          >
            <div style={{ fontWeight: 600, color: '#eaeaea', fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.7, marginBottom: 2 }}>
              Preview Controls
            </div>
            <HintRow keys={['Click']} label="Interact (pinch)" />
            <HintRow keys={['Mouse']} label="Gaze" />
            <HintRow keys={['Drag']} label="Look around" />
            <HintRow keys={['W', 'A', 'S', 'D']} label="Move" />
            <HintRow keys={['Q', 'E']} label="Up / Down" />
            <HintRow keys={['Scroll']} label="Forward / back" />
            <HintRow keys={['Esc']} label="Exit preview" />
          </div>
        </div>
      </>
    )
  }

  // z-30 keeps the tinted Preview entry above the bottom-left edit
  // hint on narrow viewports — the hint sits at z-20 and would
  // otherwise overlap the button when the canvas area gets compressed.
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
      <PillShell
        onClick={enter}
        title={`Run the ${isVolume ? 'volume' : 'window'} as a live preview`}
        tinted
      >
        {/* Play triangle */}
        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 3l9 5-9 5V3z" />
        </svg>
        Preview
      </PillShell>
    </div>
  )
}
