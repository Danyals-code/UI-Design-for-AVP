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
    // ---- New HIG-aligned window templates ----
    case 'welcome':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#2a2a2c" />
          {/* hero icon */}
          <circle cx="80" cy="22" r="6" fill={accent} stroke="none" opacity="0.3" />
          <circle cx="80" cy="22" r="3.5" fill={accent} stroke="none" />
          {/* title + subtitle */}
          <rect x="50" y="34" width="60" height="6" rx="1.5" fill="#ffffff" stroke="none" />
          <rect x="40" y="44" width="80" height="3" rx="1" fill={grey} stroke="none" />
          <rect x="46" y="50" width="68" height="3" rx="1" fill={grey} stroke="none" />
          {/* primary CTA */}
          <rect x="64" y="60" width="32" height="8" rx="4" fill={accent} stroke="none" />
        </svg>
      )
    case 'browse':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#2a2a2c" />
          {/* large title */}
          <rect x="14" y="12" width="46" height="7" rx="1.5" fill="#ffffff" stroke="none" />
          {/* search field */}
          <rect x="14" y="24" width="132" height="7" rx="3.5" fill={fill} stroke="none" />
          {/* 2x2 category grid */}
          {[
            { x: 14, y: 36, c: '#bf5af2' },
            { x: 82, y: 36, c: '#ff375f' },
            { x: 14, y: 56, c: '#ff453a' },
            { x: 82, y: 56, c: '#40cbe0' }
          ].map((card, i) => (
            <g key={i}>
              <rect x={card.x} y={card.y} width="64" height="14" rx="2.5" fill={fill} stroke="none" />
              <circle cx={card.x + 7} cy={card.y + 7} r="3" fill={card.c} stroke="none" />
              <rect x={card.x + 14} y={card.y + 5} width="32" height="4" rx="1" fill={stroke} stroke="none" />
            </g>
          ))}
        </svg>
      )
    case 'player':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#2a2a2c" />
          {/* artwork */}
          <rect x="64" y="10" width="32" height="32" rx="4" fill="#1e3a8a" stroke="none" />
          <circle cx="80" cy="26" r="3" fill="#ffffff" stroke="none" opacity="0.85" />
          {/* track + artist */}
          <rect x="58" y="45" width="44" height="4" rx="1" fill="#ffffff" stroke="none" />
          <rect x="64" y="52" width="32" height="3" rx="1" fill={grey} stroke="none" />
          {/* scrubber */}
          <rect x="46" y="60" width="68" height="2" rx="1" fill={fill} stroke="none" />
          <rect x="46" y="60" width="28" height="2" rx="1" fill={accent} stroke="none" />
          <circle cx="74" cy="61" r="2" fill="#ffffff" stroke="none" />
          {/* transport */}
          <circle cx="62" cy="69" r="2.5" fill={grey} stroke="none" />
          <circle cx="80" cy="69" r="3.5" fill={accent} stroke="none" />
          <circle cx="98" cy="69" r="2.5" fill={grey} stroke="none" />
        </svg>
      )
    case 'profile':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#2a2a2c" />
          {/* avatar */}
          <circle cx="80" cy="22" r="9" fill={grey} stroke="none" />
          {/* name + role */}
          <rect x="60" y="34" width="40" height="5" rx="1" fill="#ffffff" stroke="none" />
          <rect x="50" y="42" width="60" height="3" rx="1" fill={grey} stroke="none" />
          {/* stat chips */}
          {[34, 64, 94].map((x, i) => (
            <g key={i}>
              <rect x={x} y="48" width="26" height="14" rx="2.5" fill={fill} stroke="none" />
              <rect x={x + 8} y="51" width="10" height="4" rx="1" fill="#ffffff" stroke="none" />
              <rect x={x + 5} y="57" width="16" height="2" rx="1" fill={grey} stroke="none" />
            </g>
          ))}
          {/* actions */}
          <rect x="56" y="65" width="22" height="5" rx="2.5" fill={accent} stroke="none" />
          <rect x="82" y="65" width="22" height="5" rx="2.5" fill={fill} stroke={stroke} strokeWidth="0.5" />
        </svg>
      )
    case 'article':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#2a2a2c" />
          {/* eyebrow */}
          <rect x="16" y="10" width="18" height="3" rx="0.5" fill={accent} stroke="none" />
          {/* headline (2 lines) */}
          <rect x="16" y="16" width="120" height="6" rx="1.5" fill="#ffffff" stroke="none" />
          <rect x="16" y="25" width="80" height="6" rx="1.5" fill="#ffffff" stroke="none" />
          {/* byline */}
          <rect x="16" y="35" width="62" height="2.5" rx="0.5" fill={grey} stroke="none" />
          {/* hero image */}
          <rect x="16" y="42" width="128" height="18" rx="2" fill={fill} stroke="none" />
          <circle cx="34" cy="51" r="2.5" fill={grey} stroke="none" />
          <path d="M16 60L40 50L60 56L88 46L120 56L144 60" stroke={grey} strokeWidth="0.8" fill="none" />
          {/* body lines */}
          <rect x="16" y="63" width="128" height="2" rx="0.5" fill={grey} stroke="none" />
          <rect x="16" y="68" width="96"  height="2" rx="0.5" fill={grey} stroke="none" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#2a2a2c" />
          {/* account header */}
          <rect x="12" y="11" width="136" height="14" rx="3" fill={fill} stroke="none" />
          <circle cx="22" cy="18" r="4.5" fill={grey} stroke="none" />
          <rect x="32" y="14" width="46" height="3" rx="0.5" fill="#ffffff" stroke="none" />
          <rect x="32" y="19" width="32" height="2.5" rx="0.5" fill={grey} stroke="none" />
          <path d="M138 16l3 2-3 2" stroke={grey} strokeWidth="0.8" fill="none" />
          {/* preferences (group of 3 toggles) */}
          <rect x="12" y="29" width="136" height="22" rx="3" fill={fill} stroke="none" />
          {[33, 40, 47].map((y, i) => (
            <g key={i}>
              <rect x="18" y={y - 1} width="3" height="3" rx="0.5" fill={['#ff453a','#ff9f0a','#0a84ff'][i]} stroke="none" />
              <rect x="24" y={y - 0.5} width="60" height="2.5" rx="0.5" fill="#ffffff" stroke="none" />
              <rect x="132" y={y - 1.5} width="10" height="3.5" rx="1.5" fill={i === 0 ? accent : grey} stroke="none" />
            </g>
          ))}
          {/* about (group of 3 info rows) */}
          <rect x="12" y="55" width="136" height="14" rx="3" fill={fill} stroke="none" />
          {[59, 64].map((y, i) => (
            <g key={i}>
              <rect x="18" y={y - 0.5} width="3" height="3" rx="0.5" fill={grey} stroke="none" />
              <rect x="24" y={y} width="60" height="2" rx="0.5" fill="#ffffff" stroke="none" />
              <path d={`M138 ${y}l2 1-2 1`} stroke={grey} strokeWidth="0.6" fill="none" />
            </g>
          ))}
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
    case 'cosmos':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#0a0a14" />
          {/* orbit rings — concentric ellipses centred on the sun */}
          {[14, 22, 32, 44].map((r, i) => (
            <ellipse
              key={i}
              cx="80" cy="42" rx={r} ry={r * 0.35}
              fill="none" stroke={i === 2 ? '#2a4a8a' : '#3a3a55'}
              strokeWidth="0.7"
            />
          ))}
          {/* sun */}
          <circle cx="80" cy="42" r="9" fill="#ffb84a" opacity="0.25" stroke="none" />
          <circle cx="80" cy="42" r="5" fill="#ffb84a" stroke="none" />
          {/* planets sitting on their rings */}
          <circle cx="93" cy="45" r="1.6" fill="#a8a29a" stroke="none" />
          <circle cx="61" cy="45" r="2.4" fill="#e0c47a" stroke="none" />
          <circle cx="108" cy="46" r="2.6" fill="#3a78ff" stroke="none" />
          <circle cx="42" cy="47" r="2.1" fill="#cf5530" stroke="none" />
          {/* title chip */}
          <rect x="66" y="14" width="28" height="6" rx="1.5" fill="#0c0c0e" stroke="none" />
          <text x="80" y="19" fontSize="4.5" fill="#fff" textAnchor="middle" fontWeight="600">COSMOS</text>
        </svg>
      )
    case 'anatomy':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#1c0c10" />
          {/* halo */}
          <ellipse cx="80" cy="58" rx="30" ry="4" fill="#e63a5a" opacity="0.2" stroke="none" />
          {/* plinth */}
          <ellipse cx="80" cy="60" rx="20" ry="3" fill="#2a2a2c" stroke="none" />
          {/* heart — two atria + two ventricles + aorta arch */}
          <circle cx="74" cy="40" r="7" fill="#5c86c9" stroke="none" />
          <circle cx="86" cy="40" r="7" fill="#c9425c" stroke="none" />
          <circle cx="76" cy="49" r="8" fill="#3d68a8" stroke="none" />
          <circle cx="86" cy="49" r="9" fill="#a02d47" stroke="none" />
          <path d="M86 32 Q92 22 96 26" fill="none" stroke="#e63a5a" strokeWidth="2.5" strokeLinecap="round" />
          {/* title chip */}
          <rect x="60" y="12" width="40" height="6" rx="1.5" fill="#0c0c0e" stroke="none" />
          <text x="80" y="17" fontSize="4.5" fill="#fff" textAnchor="middle" fontWeight="600">HUMAN HEART</text>
        </svg>
      )
    case 'engine':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#0e0e10" />
          {/* diag ring */}
          <ellipse cx="80" cy="58" rx="34" ry="4" fill="#3a78ff" opacity="0.25" stroke="none" />
          {/* stand */}
          <ellipse cx="80" cy="60" rx="32" ry="3" fill="#3a3a3c" stroke="none" />
          {/* engine block */}
          <rect x="48" y="42" width="64" height="14" rx="2" fill="#18181a" stroke="#2a2a2c" strokeWidth="0.5" />
          {/* pistons */}
          {[54, 66, 80, 94, 106].slice(0, 4).map((cx, i) => (
            <g key={i}>
              <rect x={cx - 4} y={30 + (i % 2 === 0 ? 0 : 2)} width="8" height="12" rx="1" fill="#8a8a90" stroke="none" />
              <polygon
                points={`${cx - 2},${28 + (i % 2 === 0 ? 0 : 2)} ${cx + 2},${28 + (i % 2 === 0 ? 0 : 2)} ${cx},${24 + (i % 2 === 0 ? 0 : 2)}`}
                fill="#e6b34a" stroke="none"
              />
            </g>
          ))}
          {/* exhaust glow */}
          <rect x="42" y="52" width="76" height="2" rx="1" fill="#ff5a1c" stroke="none" />
          {/* title chip */}
          <rect x="68" y="12" width="24" height="6" rx="1.5" fill="#0c0c0e" stroke="none" />
          <text x="80" y="17" fontSize="4.5" fill="#ffcc00" textAnchor="middle" fontWeight="600">INLINE-4</text>
        </svg>
      )
    case 'museum':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#1c1c1e" />
          {/* spotlight halo */}
          <ellipse cx="80" cy="60" rx="26" ry="4" fill="#e6a34a" opacity="0.35" stroke="none" />
          {/* marble plinth */}
          <rect x="66" y="34" width="28" height="26" rx="1" fill="#e8e5db" stroke="none" />
          {/* vase silhouette — foot, belly, neck, lip */}
          <rect x="74" y="52" width="12" height="3" fill="#a04030" stroke="none" />
          <ellipse cx="80" cy="42" rx="10" ry="9" fill="#a04030" stroke="none" />
          <rect x="76" y="30" width="8" height="10" fill="#a04030" stroke="none" />
          <rect x="73" y="26" width="14" height="4" fill="#a04030" stroke="none" />
          {/* black bands on belly */}
          <rect x="70" y="42" width="20" height="1.5" fill="#1a0a06" stroke="none" />
          <rect x="70" y="46" width="20" height="1.5" fill="#1a0a06" stroke="none" />
          {/* floating info card */}
          <rect x="112" y="30" width="26" height="14" rx="1.5" fill="#0c0c0e" stroke="none" />
          <rect x="115" y="34" width="20" height="2" rx="0.5" fill="#ffcc80" stroke="none" />
          <rect x="115" y="38" width="16" height="2" rx="0.5" fill="#e6d4b0" stroke="none" />
          {/* title chip */}
          <rect x="60" y="12" width="40" height="6" rx="1.5" fill="#0c0c0e" stroke="none" />
          <text x="80" y="17" fontSize="4.5" fill="#fff" textAnchor="middle" fontWeight="600">GREEK AMPHORA</text>
        </svg>
      )
    case 'cityBlock':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#0e0e10" />
          {/* asphalt block */}
          <rect x="26" y="26" width="108" height="42" fill="#2a2a2c" stroke="none" />
          {/* road cross */}
          <rect x="72" y="26" width="16" height="42" fill="#3a3a3c" stroke="none" />
          <rect x="26" y="42" width="108" height="10" fill="#3a3a3c" stroke="none" />
          {/* four towers */}
          <rect x="34" y="20" width="20" height="20" fill="#3a78ff" stroke="none" />
          <rect x="106" y="24" width="20" height="16" fill="#e0c47a" stroke="none" />
          <rect x="34" y="52" width="20" height="12" fill="#c04040" stroke="none" />
          <rect x="106" y="46" width="20" height="18" fill="#7ec8c8" stroke="none" />
          {/* traffic signal — three tiny dots */}
          <circle cx="83" cy="30" r="1.6" fill="#ff3b30" stroke="none" />
          <circle cx="83" cy="34" r="1.6" fill="#ffcc00" opacity="0.4" stroke="none" />
          <circle cx="83" cy="38" r="1.6" fill="#34c759" opacity="0.4" stroke="none" />
          {/* title chip */}
          <rect x="58" y="12" width="44" height="6" rx="1.5" fill="#0c0c0e" stroke="none" />
          <text x="80" y="17" fontSize="4.5" fill="#fff" textAnchor="middle" fontWeight="600">DOWNTOWN BLOCK</text>
        </svg>
      )
    case 'meadow':
      return (
        <svg {...common}>
          <rect x="6" y="6" width="148" height="68" rx="6" fill="#0a1a2a" />
          {/* meadow disc */}
          <ellipse cx="80" cy="62" rx="52" ry="8" fill="#4a7a3a" stroke="none" />
          {/* hills */}
          <ellipse cx="60" cy="50" rx="14" ry="10" fill="#3a6a2a" stroke="none" />
          <ellipse cx="100" cy="52" rx="12" ry="8" fill="#4a7a3a" stroke="none" />
          {/* sun in the sky arc */}
          <circle cx="112" cy="26" r="6" fill="#ffe08a" opacity="0.35" stroke="none" />
          <circle cx="112" cy="26" r="3.5" fill="#ffcc00" stroke="none" />
          {/* farmhouse */}
          <rect x="70" y="48" width="10" height="9" fill="#e6d4b0" stroke="none" />
          <polygon points="68,48 82,48 75,40" fill="#a03a2a" stroke="none" />
          {/* pine trees */}
          <polygon points="46,52 54,52 50,40" fill="#2a5a1a" stroke="none" />
          <polygon points="90,54 96,54 93,46" fill="#2a5a1a" stroke="none" />
          {/* cloud + rain */}
          <ellipse cx="42" cy="26" rx="10" ry="5" fill="#e6e6ea" stroke="none" />
          <ellipse cx="48" cy="24" rx="7" ry="4" fill="#e6e6ea" stroke="none" />
          {[38, 42, 46, 50].map((x, i) => (
            <line key={i} x1={x} y1="32" x2={x - 1} y2="36" stroke="#6a8ac0" strokeWidth="0.8" />
          ))}
          {/* title chip */}
          <rect x="66" y="12" width="28" height="6" rx="1.5" fill="#0c0c0e" stroke="none" />
          <text x="80" y="17" fontSize="4.5" fill="#ffe08a" textAnchor="middle" fontWeight="600">MEADOW</text>
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
