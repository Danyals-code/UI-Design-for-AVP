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

export default function PreviewButton() {
  const previewMode = useStore((s) => s.scene.previewMode)
  const updateScene = useStore((s) => s.updateScene)
  const sceneMode   = useStore((s) => s.scene.sceneMode)
  const isVolume = sceneMode === 'volume'

  const enter = () => updateScene({ previewMode: true })
  const exit  = () => updateScene({ previewMode: false })

  // Shared shell so the entry / exit pill keep identical metrics — same
  // bottom-centre slot, same height, same padding. Only the icon, label,
  // and hover affordance differ between the two states.
  const PillShell = ({ onClick, title, children }) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 30,
        paddingLeft: 14, paddingRight: 14,
        border: '1px solid #2e2e2e',
        background: 'rgba(21, 21, 21, 0.92)',
        backdropFilter: 'blur(8px)',
        color: '#eaeaea',
        fontSize: 12, fontWeight: 500,
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

  if (previewMode) {
    // Same anchor as the Preview entry button so the user's mouse
    // doesn't have to travel — flipping in / out of preview is a single
    // click in one fixed spot. The Reset Camera button sits beside it
    // so the user can recover from any walk-around without leaving
    // preview.
    return (
      <>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-2">
          {isVolume && (
            <PillShell onClick={resetCamera} title="Snap back to the default VR spawn point">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                {/* Curved reset arrow */}
                <path d="M3 8a5 5 0 1 0 1.5-3.5" />
                <path d="M3 3v3h3" />
              </svg>
              Reset Camera
            </PillShell>
          )}
          <PillShell onClick={exit} title="Leave preview and return to editing">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
            Exit Preview
            <span style={{ opacity: 0.55, fontSize: 10, marginLeft: 4 }}>Esc</span>
          </PillShell>
        </div>

        {/* Interaction hints — sit just above the bottom edge, centred,
            non-interactive. Wording adjusts per-mode: volume mode runs
            the first-person look-around so we surface the camera
            controls; window mode is largely click-driven so we keep the
            hint short. */}
        <div
          className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none"
          style={{ bottom: 44 }}
        >
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,
              padding: '5px 10px',
              background: 'rgba(21, 21, 21, 0.72)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(70, 70, 70, 0.55)',
              borderRadius: 5,
              color: '#cfcfd1',
              fontSize: 10, lineHeight: 1.2,
              letterSpacing: 0.2
            }}
          >
            {isVolume ? (
              <>
                <span><kbd className="kbd">Drag</kbd> look around</span>
                <span style={{ opacity: 0.35 }}>·</span>
                <span><kbd className="kbd">Right-drag</kbd> pan</span>
                <span style={{ opacity: 0.35 }}>·</span>
                <span><kbd className="kbd">Scroll</kbd> move forward</span>
                <span style={{ opacity: 0.35 }}>·</span>
                <span><kbd className="kbd">Click</kbd> to interact</span>
              </>
            ) : (
              <>
                <span><kbd className="kbd">Click</kbd> buttons / panels to interact</span>
                <span style={{ opacity: 0.35 }}>·</span>
                <span><kbd className="kbd">Esc</kbd> exit preview</span>
              </>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
      <PillShell
        onClick={enter}
        title={`Run the ${isVolume ? 'volume' : 'window'} as a live preview`}
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
