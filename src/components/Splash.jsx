// Splash / project picker. Shown on every launch and reopenable from the
// "visionOS Designer" topbar title. Lets the user (a) pick a Scene Type
// (Window or Volume) and (b) seed the scene from a Template. Clicking a
// template applies it and dismisses; "Continue without changes" preserves
// whatever's already on screen.

import { useStore } from '../store'
import { TEMPLATES, templateOrderForMode } from '../templates'
import { WindowIcon, VolumeIcon } from './icons'

// Compact wireframe previews — drawn inline so we don't have to ship an
// asset bundle. Each thumbnail captures the essential silhouette of its
// template (sidebar+detail, list of rows, hero+button, etc.).
function TemplateThumb({ kind }) {
  const stroke = '#9ea1a2'
  const fill   = '#3a3a3c'
  const accent = '#007aff'
  const grey   = '#6b6e70'

  const common = {
    width: '100%', height: 78, viewBox: '0 0 160 80', fill: 'none',
    stroke, strokeWidth: 1, strokeLinecap: 'round', strokeLinejoin: 'round'
  }

  switch (kind) {
    case 'blank':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#2a2a2c" />
        </svg>
      )
    case 'musicPlayer':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#2a2a2c" />
          {/* artwork */}
          <rect x="62" y="10" width="36" height="36" rx="4" fill="#1e3a8a" stroke="none" />
          {/* track + artist */}
          <rect x="58" y="48" width="44" height="4" rx="1" fill={stroke} stroke="none" />
          <rect x="64" y="55" width="32" height="3" rx="1" fill={grey} stroke="none" />
          {/* transport */}
          <circle cx="64" cy="68" r="3" fill={grey} stroke="none" />
          <circle cx="80" cy="68" r="4" fill={accent} stroke="none" />
          <circle cx="96" cy="68" r="3" fill={grey} stroke="none" />
        </svg>
      )
    case 'smartHome':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#2a2a2c" />
          {/* greeting + status */}
          <rect x="14" y="12" width="60" height="6" rx="1" fill={stroke} stroke="none" />
          <rect x="14" y="22" width="80" height="3" rx="1" fill={grey} stroke="none" />
          {/* room cards */}
          {[14, 50, 86, 122].map((x, i) => (
            <rect key={i} x={x} y="32" width="28" height="22" rx="3"
                  fill={i === 0 ? accent : fill} opacity="0.9" stroke="none" />
          ))}
          {/* scene pills */}
          <rect x="14" y="60" width="22" height="8" rx="4" fill={grey} stroke="none" />
          <rect x="40" y="60" width="22" height="8" rx="4" fill={grey} stroke="none" />
          <rect x="66" y="60" width="22" height="8" rx="4" fill={grey} stroke="none" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#2a2a2c" />
          <rect x="14" y="14" width="40" height="6" rx="1" fill={stroke} stroke="none" />
          {[26, 38, 50, 62].map((y, i) => (
            <g key={i}>
              <rect x="14" y={y} width="100" height="6" rx="1.5" fill={fill} stroke="none" />
              <rect x="124" y={y} width="22" height="6" rx="3" fill={i === 0 ? accent : grey} stroke="none" />
            </g>
          ))}
        </svg>
      )
    case 'mailApp':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#2a2a2c" />
          {/* sidebar */}
          <rect x="6" y="6" width="50" height="68" rx="6" fill={grey} stroke="none" />
          {[14, 24, 34, 44, 54, 64].map((y, i) => (
            <rect key={i} x="12" y={y} width="38" height="6" rx="1.5"
                  fill={i === 1 ? accent : stroke} stroke="none" />
          ))}
          {/* detail header */}
          <rect x="64" y="14" width="50" height="5" rx="1" fill={stroke} stroke="none" />
          <rect x="64" y="22" width="36" height="3" rx="1" fill={grey} stroke="none" />
          <rect x="124" y="14" width="22" height="11" rx="3" fill={accent} stroke="none" />
          {/* subject + body lines */}
          <rect x="64" y="32" width="80" height="5" rx="1" fill={stroke} stroke="none" />
          {[42, 50, 58].map((y, i) => (
            <rect key={i} x="64" y={y} width={[80, 70, 50][i]} height="3" rx="1" fill={fill} stroke="none" />
          ))}
        </svg>
      )
    case 'tabBar':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#2a2a2c" />
          <rect x="14" y="14" width="40" height="6" rx="1" fill={stroke} stroke="none" />
          <rect x="14" y="26" width="132" height="30" rx="2" fill={fill} stroke="none" />
          <rect x="14" y="60" width="132" height="10" rx="5" fill={grey} stroke="none" />
          {[28, 56, 84, 112].map((cx, i) => (
            <circle key={i} cx={cx} cy={65} r="2.5" fill={i === 0 ? accent : '#ffffff'} stroke="none" />
          ))}
        </svg>
      )
    case 'emptyVolume':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#1c1c1e" />
          {/* wireframe cube to suggest a volumetric stage */}
          <g stroke={grey} strokeWidth="1" fill="none">
            <path d="M52 24L80 14L108 24L108 56L80 66L52 56Z" />
            <path d="M52 24L80 34L108 24" />
            <path d="M80 34L80 66" />
          </g>
          <circle cx="80" cy="60" r="2" fill={accent} stroke="none" />
        </svg>
      )
    case 'productShowcase':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#1c1c1e" />
          {/* plinth + sphere */}
          <ellipse cx="80" cy="56" rx="22" ry="3" fill="#000" stroke="none" opacity="0.5" />
          <ellipse cx="80" cy="55" rx="20" ry="3" fill="#1a1a1c" stroke="none" />
          <circle cx="80" cy="40" r="11" fill="#3a78ff" stroke="none" />
          {/* Title above */}
          <rect x="62" y="14" width="36" height="9" rx="2" fill="#0c0c0e" stroke="none" />
          <text x="80" y="21" fontSize="6" fill="#fff" textAnchor="middle">Globe Pro</text>
          <rect x="68" y="25" width="24" height="4" rx="1" fill="#1c1c1e" stroke="none" />
          {/* Buy CTA right + spec left */}
          <rect x="106" y="38" width="26" height="8" rx="2" fill={accent} stroke="none" />
          <rect x="28" y="35" width="28" height="14" rx="2" fill="#1c1c1e" stroke="none" />
        </svg>
      )
    case 'solarSystem':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#0a0a14" />
          {/* sun */}
          <circle cx="32" cy="40" r="9" fill="#ffb84a" stroke="none" />
          {/* labels */}
          <rect x="22" y="22" width="20" height="6" rx="1" fill="#1c1c1e" stroke="none" />
          {/* planets in row */}
          <circle cx="60" cy="40" r="3" fill="#a0a0a0" stroke="none" />
          <circle cx="80" cy="40" r="4" fill="#e0c47a" stroke="none" />
          <circle cx="102" cy="40" r="4" fill="#3a78ff" stroke="none" />
          <circle cx="124" cy="40" r="3.5" fill="#cf5530" stroke="none" />
          {/* tiny labels above */}
          {[60, 80, 102, 124].map((cx, i) => (
            <rect key={i} x={cx - 8} y="26" width="16" height="5" rx="1"
                  fill="#0c0c0e" stroke="none" />
          ))}
        </svg>
      )
    case 'diorama':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#1c1c1e" />
          <rect x="40" y="20" width="80" height="32" fill="#7a8aa0" stroke="none" opacity="0.7" />
          <rect x="50" y="36" width="14" height="16" fill="#e07a5f" stroke="none" />
          <rect x="74" y="28" width="14" height="24" fill="#81b29a" stroke="none" />
          <rect x="98" y="20" width="14" height="32" fill="#f2cc8f" stroke="none" />
          <rect x="36" y="52" width="88" height="3" fill="#3a3a3c" stroke="none" />
        </svg>
      )
    case 'gallery':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#1c1c1e" />
          <rect x="20" y="14" width="120" height="44" fill="#e9e6dd" stroke="none" />
          {/* three frames + matching colour pictures */}
          <rect x="28" y="20" width="28" height="22" fill="#1a1a1c" stroke="none" />
          <rect x="30" y="22" width="24" height="18" fill="#f4a261" stroke="none" />
          <rect x="66" y="20" width="28" height="22" fill="#1a1a1c" stroke="none" />
          <rect x="68" y="22" width="24" height="18" fill="#2a9d8f" stroke="none" />
          <rect x="104" y="20" width="28" height="22" fill="#1a1a1c" stroke="none" />
          <rect x="106" y="22" width="24" height="18" fill="#5a4fcf" stroke="none" />
          {/* captions */}
          <rect x="32" y="48" width="20" height="4" rx="1" fill="#0c0c0e" stroke="none" />
          <rect x="70" y="48" width="20" height="4" rx="1" fill="#0c0c0e" stroke="none" />
          <rect x="108" y="48" width="20" height="4" rx="1" fill="#0c0c0e" stroke="none" />
        </svg>
      )
    case 'cardStack':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#1c1c1e" />
          {/* three flat cards in a row */}
          <rect x="22" y="18" width="32" height="44" rx="3" fill="#0a84ff" stroke="none" />
          <rect x="64" y="18" width="32" height="44" rx="3" fill="#5e5ce6" stroke="none" />
          <rect x="106" y="18" width="32" height="44" rx="3" fill="#ff9f0a" stroke="none" />
          {/* card labels */}
          <rect x="26" y="22" width="24" height="4" rx="1" fill="#ffffff" opacity="0.85" stroke="none" />
          <rect x="68" y="22" width="24" height="4" rx="1" fill="#ffffff" opacity="0.85" stroke="none" />
          <rect x="110" y="22" width="24" height="4" rx="1" fill="#ffffff" opacity="0.85" stroke="none" />
        </svg>
      )
    case 'filesApp':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#2a2a2c" />
          {/* sidebar */}
          <rect x="6" y="6" width="46" height="68" fill="#1a1a1c" stroke="none" />
          <rect x="10" y="11" width="20" height="6" rx="1" fill="#ffffff" stroke="none" />
          {/* sidebar pinned rows */}
          <rect x="10" y="22" width="38" height="5" rx="1" fill={accent} stroke="none" />
          <rect x="10" y="30" width="34" height="5" rx="1" fill={grey} stroke="none" />
          {/* "Locations" header + rows */}
          <rect x="10" y="40" width="22" height="3" rx="0.5" fill={grey} stroke="none" />
          <rect x="10" y="46" width="36" height="4" rx="1" fill={grey} stroke="none" />
          <rect x="10" y="52" width="36" height="4" rx="1" fill={grey} stroke="none" />
          <rect x="10" y="58" width="30" height="4" rx="1" fill={grey} stroke="none" />
          {/* main: title + empty state */}
          <rect x="56" y="11" width="50" height="6" rx="1" fill={stroke} stroke="none" />
          <circle cx="100" cy="48" r="6" fill="none" stroke={grey} strokeWidth="1.4" />
          <path d="M100 45 V48 L102 50" stroke={grey} strokeWidth="1.2" />
          <rect x="86" y="58" width="28" height="4" rx="1" fill={stroke} stroke="none" />
          <rect x="80" y="64" width="40" height="3" rx="0.5" fill={grey} stroke="none" />
        </svg>
      )
    case 'moodLamps':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#0c0c0e" />
          {/* dark console slab */}
          <rect x="32" y="58" width="96" height="6" rx="1" fill="#1a1a1c" stroke="none" />
          {/* three lamps with stems and glowing bulbs */}
          {[
            { x: 50,  color: '#ff9a3c' },
            { x: 80,  color: '#3a78ff' },
            { x: 110, color: '#7be39c' }
          ].map((l, i) => (
            <g key={i}>
              <line x1={l.x} y1="46" x2={l.x} y2="58" stroke="#3a3a3c" strokeWidth="0.8" />
              <circle cx={l.x} cy="40" r="8" fill={l.color} opacity="0.18" stroke="none" />
              <circle cx={l.x} cy="40" r="5" fill={l.color} stroke="none" />
            </g>
          ))}
        </svg>
      )
    case 'spinningShowcase':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#1c1c1e" />
          {/* turntable orbit indicator */}
          <ellipse cx="80" cy="46" rx="34" ry="10" fill="none" stroke={grey} strokeWidth="0.8" strokeDasharray="2 3" />
          {/* three cubes on the turntable */}
          <rect x="48" y="42" width="12" height="12" fill="#e94e62" stroke="none" transform="rotate(-12 54 48)" />
          <rect x="74" y="48" width="12" height="12" fill="#3aab7a" stroke="none" />
          <rect x="100" y="42" width="12" height="12" fill="#3a78ff" stroke="none" transform="rotate(12 106 48)" />
          {/* arrows hinting rotation */}
          <path d="M120 28 q 8 -4 14 4" stroke={accent} strokeWidth="1" fill="none" markerEnd="" />
          <path d="M40 64 q -8 4 -14 -4" stroke={accent} strokeWidth="1" fill="none" />
        </svg>
      )
    case 'reactiveLights':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#0a0a14" />
          {/* master orb up top */}
          <circle cx="80" cy="22" r="6" fill="#ffffff" stroke="none" />
          <circle cx="80" cy="22" r="9" fill="#ffffff" opacity="0.18" stroke="none" />
          {/* five pucks rolling a wave (heights vary to imply motion) */}
          <ellipse cx="28" cy="56" rx="8" ry="3" fill="#e94e62" stroke="none" />
          <ellipse cx="54" cy="50" rx="8" ry="3" fill="#f5b14a" stroke="none" />
          <ellipse cx="80" cy="46" rx="8" ry="3" fill="#7be39c" stroke="none" />
          <ellipse cx="106" cy="50" rx="8" ry="3" fill="#3a78ff" stroke="none" />
          <ellipse cx="132" cy="56" rx="8" ry="3" fill="#a05dff" stroke="none" />
          {/* dotted line connecting master orb to pucks */}
          <path d="M80 32 V 42" stroke="#ffffff" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.4" />
        </svg>
      )
    default:
      return <svg {...common}><rect x="6" y="6" width="148" height="68" rx="6" fill="#2a2a2c" /></svg>
  }
}

function SceneTypeCard({ icon: Icon, label, description, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-2 p-4 rounded-lg border text-left transition-all ${
        active
          ? 'bg-accent/10 border-accent text-text'
          : 'bg-surface2 border-border text-textDim hover:text-text hover:border-textDim'
      }`}
    >
      <div className={`w-10 h-10 rounded flex items-center justify-center ${active ? 'bg-accent text-white' : 'bg-surface3 text-textDim'}`}>
        <Icon size={20} />
      </div>
      <div className="font-semibold text-[12px]">{label}</div>
      <div className="text-[10px] text-textMute leading-relaxed">{description}</div>
    </button>
  )
}

export default function Splash({ open, onClose }) {
  const sceneMode = useStore((s) => s.scene.sceneMode)
  const switchSceneMode = useStore((s) => s.switchSceneMode)
  const applyTemplate = useStore((s) => s.applyTemplate)

  if (!open) return null

  const onPickTemplate = (key) => {
    applyTemplate(key)
    onClose()
  }
  // Picking a Scene Type on the splash seeds the appropriate default scene
  // so the user lands on a working setup whether or not they go on to pick
  // a template. switchSceneMode no-ops if the requested mode is already
  // active, so re-clicking the active card is harmless.
  const onPickSceneType = (mode) => {
    if (mode !== sceneMode) switchSceneMode(mode)
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-surface border border-border rounded-2xl shadow-2xl w-[760px] max-w-[92vw] max-h-[88vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-accent flex items-center justify-center text-white text-[11px] font-bold">V</div>
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-text leading-tight">visionOS Designer</div>
            <div className="text-[10px] text-textMute uppercase tracking-wider mt-0.5">Start a project</div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            title="Close (Esc)"
          >Close</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar p-6 space-y-6">
          {/* Scene Type */}
          <section>
            <div className="text-[10px] text-textMute uppercase tracking-wider mb-3">Scene Type</div>
            <div className="grid grid-cols-2 gap-3">
              <SceneTypeCard
                icon={WindowIcon}
                label="Window"
                description="A flat 2D scene that floats in space. Best for traditional UI: lists, forms, content pages."
                active={sceneMode === 'window'}
                onClick={() => onPickSceneType('window')}
              />
              <SceneTypeCard
                icon={VolumeIcon}
                label="Volume"
                description="A bounded 3D scene with depth. Best for spatial content: models, dioramas, 3D widgets."
                active={sceneMode === 'volume'}
                onClick={() => onPickSceneType('volume')}
              />
            </div>
          </section>

          {/* Templates */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-[10px] text-textMute uppercase tracking-wider">
                {sceneMode === 'volume' ? 'Volume Templates' : 'Window Templates'}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {templateOrderForMode(sceneMode).map((key) => {
                const t = TEMPLATES[key]
                return (
                  <button
                    key={key}
                    onClick={() => onPickTemplate(key)}
                    className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-surface2 hover:border-accent hover:bg-surface3 text-left transition-all"
                  >
                    <div className="rounded overflow-hidden bg-bg border border-border/40">
                      <TemplateThumb kind={key} />
                    </div>
                    <div className="font-semibold text-[11px] text-text">{t.label}</div>
                    <div className="text-[10px] text-textMute leading-snug min-h-[28px]">{t.description}</div>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <div className="text-[10px] text-textMute leading-relaxed">
            Tip: click <span className="text-text font-semibold">visionOS Designer</span> in the topbar any time to reopen this.
          </div>
          <button
            onClick={onClose}
            className="btn"
          >
            Continue without changes
          </button>
        </div>
      </div>
    </div>
  )
}
