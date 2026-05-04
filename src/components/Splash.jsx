// Splash / project picker. Shown on every launch and reopenable from the
// "visionOS Designer" topbar title. Lets the user (a) pick a Scene Type
// (Window or Volume) and (b) seed the scene from a Template. Clicking a
// template applies it and dismisses; "Continue without changes" preserves
// whatever's already on screen.

import { useStore } from '../store'
import { TEMPLATES, TEMPLATE_ORDER } from '../templates'
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
  const updateScene = useStore((s) => s.updateScene)
  const applyTemplate = useStore((s) => s.applyTemplate)

  if (!open) return null

  const onPickTemplate = (key) => {
    applyTemplate(key)
    onClose()
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
                onClick={() => updateScene({ sceneMode: 'window' })}
              />
              <SceneTypeCard
                icon={VolumeIcon}
                label="Volume"
                description="A bounded 3D scene with depth. Best for spatial content: models, dioramas, 3D widgets."
                active={sceneMode === 'volume'}
                onClick={() => updateScene({ sceneMode: 'volume' })}
              />
            </div>
          </section>

          {/* Templates */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-[10px] text-textMute uppercase tracking-wider">Templates</div>
              {sceneMode === 'volume' && (
                <div className="text-[10px] text-textMute italic">Window-only for now — switch to Window to use a template.</div>
              )}
            </div>
            <div className={`grid grid-cols-3 gap-3 ${sceneMode === 'volume' ? 'opacity-40 pointer-events-none' : ''}`}>
              {TEMPLATE_ORDER.map((key) => {
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
