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
    case 'welcome':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#2a2a2c" />
          <rect x="40" y="22" width="80" height="6" rx="1" fill={stroke} stroke="none" />
          <rect x="50" y="34" width="60" height="4" rx="1" fill={grey} stroke="none" />
          <rect x="58" y="50" width="44" height="14" rx="7" fill={accent} stroke="none" />
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
    case 'onboarding':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#2a2a2c" />
          <rect x="44" y="12" width="72" height="28" rx="3" fill={grey} stroke="none" />
          <rect x="50" y="44" width="60" height="5" rx="1" fill={stroke} stroke="none" />
          <rect x="60" y="54" width="40" height="4" rx="1" fill={grey} stroke="none" />
          <rect x="60" y="62" width="40" height="10" rx="5" fill={accent} stroke="none" />
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
    case 'sidebar':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#2a2a2c" />
          <rect x="6" y="6" width="50" height="68" rx="6" fill={grey} stroke="none" />
          {[16, 26, 36, 46, 56].map((y, i) => (
            <rect key={i} x="12" y={y} width="38" height="6" rx="1.5"
                  fill={i === 0 ? accent : stroke} stroke="none" />
          ))}
          <rect x="80" y="22" width="48" height="6" rx="1" fill={stroke} stroke="none" />
          <rect x="72" y="34" width="64" height="4" rx="1" fill={grey} stroke="none" />
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
    case 'singleObject':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#1c1c1e" />
          <ellipse cx="80" cy="58" rx="22" ry="3" fill="#000" stroke="none" opacity="0.5" />
          <circle cx="80" cy="42" r="14" fill="#d0a060" stroke="none" />
          <ellipse cx="80" cy="58" rx="20" ry="3" fill={fill} stroke="none" />
        </svg>
      )
    case 'labelledHero':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#1c1c1e" />
          <ellipse cx="80" cy="58" rx="22" ry="3" fill="#000" stroke="none" opacity="0.5" />
          <circle cx="80" cy="42" r="13" fill="#3a78ff" stroke="none" />
          {/* Title attachment above */}
          <rect x="62" y="18" width="36" height="9" rx="2" fill="#0c0c0e" stroke="none" />
          <text x="80" y="25" fontSize="6" fill="#fff" textAnchor="middle">Sphere</text>
          {/* Button attachment */}
          <rect x="68" y="58" width="24" height="7" rx="3" fill={accent} stroke="none" />
        </svg>
      )
    case 'showcase':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#1c1c1e" />
          {/* three cubes */}
          <rect x="40" y="42" width="14" height="14" fill="#e63946" stroke="none" />
          <rect x="73" y="42" width="14" height="14" fill="#83a87a" stroke="none" />
          <rect x="106" y="42" width="14" height="14" fill="#e9c46a" stroke="none" />
          {/* labels */}
          <rect x="38" y="22" width="18" height="8" rx="2" fill="#0c0c0e" />
          <rect x="71" y="22" width="18" height="8" rx="2" fill="#0c0c0e" />
          <rect x="104" y="22" width="18" height="8" rx="2" fill="#0c0c0e" />
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
