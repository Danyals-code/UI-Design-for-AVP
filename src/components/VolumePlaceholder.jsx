import { useStore } from '../store'

// Shown in place of the 3D viewport while Volume mode is still under
// development. Entering the experimental 3D preview is done from the
// viewport toolbar (grid / zoom / "See in 3D" live there together).
export default function VolumePlaceholder() {
  const scene = useStore((s) => s.scene)
  const isDark = scene.colorScheme === 'dark'

  // Palette adapts to the viewport colorScheme so text stays legible on the
  // light (grey→white) or dark (near-black) gradient we paint below.
  const palette = isDark
    ? {
        bg: 'radial-gradient(ellipse at 50% 40%, #242428 0%, #1a1a1c 55%, #111113 100%)',
        grid: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
        heading: '#f5f5f7',
        body: '#a1a1a6',
        caption: '#6e6e73'
      }
    : {
        bg: 'radial-gradient(ellipse at 50% 40%, #ffffff 0%, #f0f0f3 55%, #dcdce0 100%)',
        grid: 'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)',
        heading: '#1d1d1f',
        body: '#3a3a3c',
        caption: '#8e8e93'
      }

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center select-none overflow-hidden"
      style={{ background: palette.bg }}
    >
      {/* soft depth hint — faint grid that fades out radially */}
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          backgroundImage: palette.grid,
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse at center, #000 40%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, #000 40%, transparent 80%)'
        }}
      />

      {/* floating glyph */}
      <div className="relative mb-6">
        <div
          className="absolute inset-0 rounded-3xl blur-2xl"
          style={{
            background: 'radial-gradient(circle, rgba(10,132,255,0.35) 0%, transparent 70%)',
            transform: 'scale(1.6)'
          }}
        />
        <svg width="88" height="88" viewBox="0 0 88 88" className="relative">
          <defs>
            <linearGradient id="volGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6aa9ff" />
              <stop offset="100%" stopColor="#0a63d9" />
            </linearGradient>
          </defs>
          {/* wire-cube */}
          <g fill="none" stroke="url(#volGrad)" strokeWidth="2" strokeLinejoin="round">
            <path d="M20 28 L44 16 L68 28 L68 60 L44 72 L20 60 Z" />
            <path d="M20 28 L44 40 L68 28" />
            <path d="M44 40 L44 72" />
          </g>
        </svg>
      </div>

      <div
        className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-2"
        style={{ color: '#0a84ff' }}
      >
        Volume Mode
      </div>
      <div
        className="text-[22px] font-semibold mb-2 tracking-tight"
        style={{ color: palette.heading }}
      >
        Under development
      </div>
      <div
        className="text-[12px] text-center max-w-xs leading-relaxed"
        style={{ color: palette.body }}
      >
        Volumetric preview is still being polished. All volume settings save
        correctly — continue designing here, or switch to Window mode for
        the 3D preview camera.
      </div>

      <div
        className="absolute bottom-4 text-[10px] tracking-wide"
        style={{ color: palette.caption }}
      >
        Preview is experimental — camera, gestures &amp; gizmos may change.
      </div>
    </div>
  )
}
