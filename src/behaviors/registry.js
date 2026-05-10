// Behaviors registry — the locked vocabulary of triggers and actions
// that 3D entities can use. The card UI introspects these schemas to
// render parameter rows; the preview runtime keys executors off the
// `type` strings; the Swift exporter (later) translates each entry to
// its RealityKit / SwiftUI counterpart noted in the `swift` field.
//
// Every item here MUST map to a real visionOS API. If it can't be
// expressed in code, it doesn't belong in the dropdowns.

export const CURVE_OPTIONS = [
  { value: 'linear',  label: 'Linear' },
  { value: 'easeIn',  label: 'Ease in' },
  { value: 'easeOut', label: 'Ease out' },
  { value: 'easeInOut', label: 'Ease in/out' },
  { value: 'spring',  label: 'Spring' }
]

export const AXIS_OPTIONS = [
  { value: 'all', label: 'All axes' },
  { value: 'x',   label: 'X only' },
  { value: 'y',   label: 'Y only' },
  { value: 'z',   label: 'Z only' }
]

// ---- Triggers --------------------------------------------------------
//
// Each trigger declares a `kind` describing how the runtime hooks it
// up:
//   pointer  — attaches to the entity's mesh (tap/hover/drag/pinch/rotate)
//   lifecycle — fires on preview enter (sceneStart) or exit
//   timer    — uses setTimeout / setInterval
//   tick     — checked per-frame (proximity / inView / collision)
//   event    — subscribes to the broadcast bus
//   playback — fires when a Play-Animation action completes

export const TRIGGERS = [
  {
    type: 'tap',
    label: 'Tap',
    kind: 'pointer',
    swift: 'SpatialTapGesture / LongPressGesture',
    params: [
      { key: 'mode', label: 'Style', type: 'select', default: 'single', options: [
        { value: 'single', label: 'Single tap' },
        { value: 'double', label: 'Double tap' },
        { value: 'long',   label: 'Long press' }
      ]}
    ]
  },
  {
    type: 'hover',
    label: 'Hover',
    kind: 'pointer',
    swift: '.onHover { … } / HoverEffectComponent',
    params: [
      { key: 'mode', label: 'When', type: 'select', default: 'enter', options: [
        { value: 'enter', label: 'Pointer enters' },
        { value: 'leave', label: 'Pointer leaves' },
        { value: 'while', label: 'While hovering' }
      ]}
    ]
  },
  {
    type: 'drag',
    label: 'Drag',
    kind: 'pointer',
    swift: 'DragGesture().targetedToEntity()',
    params: [
      { key: 'mode', label: 'When', type: 'select', default: 'start', options: [
        { value: 'start', label: 'Drag begins' },
        { value: 'end',   label: 'Drag ends' },
        { value: 'while', label: 'While dragging' }
      ]}
    ]
  },
  {
    type: 'pinch',
    label: 'Pinch (scale gesture)',
    kind: 'pointer',
    swift: 'MagnifyGesture',
    deviceOnly: true,
    params: [
      { key: 'mode', label: 'When', type: 'select', default: 'change', options: [
        { value: 'start',  label: 'Begins' },
        { value: 'change', label: 'Changes' },
        { value: 'end',    label: 'Ends' }
      ]}
    ]
  },
  {
    type: 'rotateGesture',
    label: 'Rotate (two-handed)',
    kind: 'pointer',
    swift: 'RotateGesture3D',
    deviceOnly: true,
    params: [
      { key: 'mode', label: 'When', type: 'select', default: 'change', options: [
        { value: 'start',  label: 'Begins' },
        { value: 'change', label: 'Changes' },
        { value: 'end',    label: 'Ends' }
      ]}
    ]
  },
  {
    type: 'sceneStart',
    label: 'Scene start',
    kind: 'lifecycle',
    swift: '.onAppear / scene loaded',
    params: []
  },
  {
    type: 'timer',
    label: 'Timer',
    kind: 'timer',
    swift: 'Timer / DispatchQueue.asyncAfter',
    params: [
      { key: 'mode', label: 'Mode', type: 'select', default: 'once', options: [
        { value: 'once', label: 'Once after' },
        { value: 'loop', label: 'Repeat every' }
      ]},
      { key: 'seconds', label: 'Seconds', type: 'seconds', default: 1 }
    ]
  },
  {
    type: 'proximity',
    label: 'Proximity',
    kind: 'tick',
    swift: 'distance check in System update',
    params: [
      { key: 'mode', label: 'When', type: 'select', default: 'enter', options: [
        { value: 'enter', label: 'Enters within' },
        { value: 'leave', label: 'Moves outside' }
      ]},
      { key: 'meters', label: 'Distance', type: 'meters', default: 1.5 },
      { key: 'target', label: 'From', type: 'targetEntity', default: 'user', allowUser: true }
    ]
  },
  {
    type: 'collision',
    label: 'Collision',
    kind: 'tick',
    swift: 'CollisionEvents.Began.subscribe',
    params: [
      { key: 'mode', label: 'When', type: 'select', default: 'began', options: [
        { value: 'began', label: 'Collision begins' },
        { value: 'ended', label: 'Collision ends' }
      ]},
      { key: 'target', label: 'With', type: 'targetEntity', default: '' }
    ]
  },
  {
    type: 'inView',
    label: 'In user’s view',
    kind: 'tick',
    swift: 'forward-cone dot product in System',
    params: [
      { key: 'mode', label: 'When', type: 'select', default: 'enter', options: [
        { value: 'enter', label: 'Enters view' },
        { value: 'leave', label: 'Leaves view' }
      ]},
      { key: 'angleDeg', label: 'View cone', type: 'degrees', default: 30 }
    ]
  },
  {
    type: 'animationFinished',
    label: 'Animation finished',
    kind: 'playback',
    swift: 'AnimationPlaybackController completion',
    params: [
      { key: 'target', label: 'On', type: 'targetEntity', default: 'self', allowSelf: true }
    ]
  },
  {
    type: 'eventReceived',
    label: 'Event received',
    kind: 'event',
    swift: 'NotificationCenter.default.publisher',
    params: [
      { key: 'name', label: 'Event name', type: 'eventName', default: 'event-1' }
    ]
  }
]

// ---- Actions ---------------------------------------------------------
//
// Action `kind` drives runtime dispatch:
//   transform    — animates entity position / scale / rotation
//   visibility   — show / hide with optional fade
//   material     — animates a material property
//   shader       — applies a pre-built shader-graph effect
//   continuous   — runs every frame until cancelled (look-at / follow / orbit)
//   spawn / destroy — entity-graph mutations
//   playback     — triggers a stored animation clip
//   flow         — wait / repeat / broadcast / sequence helpers

export const ACTIONS = [
  // ----- Transform -----
  {
    type: 'scaleTo',
    label: 'Scale to',
    group: 'Transform',
    kind: 'transform',
    swift: 'FromToByAnimation<Transform>',
    params: [
      { key: 'mode', label: 'Mode', type: 'select', default: 'absolute', options: [
        { value: 'absolute', label: 'Absolute' },
        { value: 'relative', label: 'Relative (× current)' }
      ]},
      { key: 'value',    label: 'Factor',   type: 'number',   default: 1.5, step: 0.05 },
      { key: 'duration', label: 'Duration', type: 'seconds',  default: 0.3 },
      { key: 'curve',    label: 'Curve',    type: 'select',   default: 'easeOut', options: CURVE_OPTIONS },
      { key: 'toggle',   label: 'Auto-reverse',   type: 'boolean',  default: false, hint: 'Next time this trigger fires, snap back to the original value.' }
    ]
  },
  {
    type: 'moveTo',
    label: 'Move to',
    group: 'Transform',
    kind: 'transform',
    swift: 'entity.move(to:relativeTo:duration:)',
    params: [
      { key: 'mode', label: 'Mode', type: 'select', default: 'offset', options: [
        { value: 'absolute', label: 'World position' },
        { value: 'offset',   label: 'Offset from start' }
      ]},
      { key: 'position', label: 'Position', type: 'vec3',    default: [0, 0.2, 0] },
      { key: 'duration', label: 'Duration', type: 'seconds', default: 0.3 },
      { key: 'curve',    label: 'Curve',    type: 'select',  default: 'easeOut', options: CURVE_OPTIONS },
      { key: 'toggle',   label: 'Auto-reverse', type: 'boolean', default: false, hint: 'Next time this trigger fires, snap back to the original value.' }
    ]
  },
  {
    type: 'rotateTo',
    label: 'Rotate to',
    group: 'Transform',
    kind: 'transform',
    swift: 'transform.rotation animated',
    params: [
      { key: 'mode', label: 'Mode', type: 'select', default: 'absolute', options: [
        { value: 'absolute', label: 'Set angles' },
        { value: 'relative', label: 'Add to current' }
      ]},
      { key: 'rotation', label: 'Degrees',  type: 'vec3',    default: [0, 90, 0] },
      { key: 'duration', label: 'Duration', type: 'seconds', default: 0.3 },
      { key: 'curve',    label: 'Curve',    type: 'select',  default: 'easeOut', options: CURVE_OPTIONS },
      { key: 'toggle',   label: 'Auto-reverse', type: 'boolean', default: false, hint: 'Next time this trigger fires, snap back to the original value.' }
    ]
  },

  // ----- Continuous motion -----
  {
    type: 'lookAt',
    label: 'Look at',
    group: 'Continuous motion',
    kind: 'continuous',
    swift: 'entity.look(at:from:relativeTo:)',
    params: [
      { key: 'target',  label: 'Target',  type: 'targetEntity', default: 'user', allowUser: true },
      { key: 'enabled', label: 'Enable',  type: 'boolean',      default: true }
    ]
  },
  {
    type: 'follow',
    label: 'Follow',
    group: 'Continuous motion',
    kind: 'continuous',
    swift: 'System per-frame position update',
    params: [
      { key: 'target', label: 'Target', type: 'targetEntity', default: 'user', allowUser: true },
      { key: 'offset', label: 'Offset', type: 'vec3',         default: [0, 0, 0.5] },
      { key: 'lag',    label: 'Lag',    type: 'number',       default: 0.2, step: 0.05 },
      { key: 'enabled', label: 'Enable', type: 'boolean',     default: true }
    ]
  },
  {
    type: 'orbit',
    label: 'Orbit',
    group: 'Continuous motion',
    kind: 'continuous',
    swift: 'System per-frame angular update',
    params: [
      { key: 'target', label: 'Target', type: 'targetEntity', default: 'user', allowUser: true },
      { key: 'radius', label: 'Radius', type: 'meters',       default: 0.6 },
      { key: 'speed',  label: 'Deg / s', type: 'number',      default: 60, step: 5 },
      { key: 'axis',   label: 'Axis',   type: 'select',       default: 'y', options: AXIS_OPTIONS },
      { key: 'enabled', label: 'Enable', type: 'boolean',     default: true }
    ]
  },

  // ----- Material & visibility -----
  {
    type: 'showHide',
    label: 'Show / Hide',
    group: 'Material & visibility',
    kind: 'visibility',
    swift: 'isEnabled / animated opacity',
    params: [
      { key: 'mode', label: 'Mode', type: 'select', default: 'show', options: [
        { value: 'show',   label: 'Show' },
        { value: 'hide',   label: 'Hide' },
        { value: 'toggle', label: 'Toggle' }
      ]},
      { key: 'fade',     label: 'Fade',     type: 'boolean', default: true },
      { key: 'duration', label: 'Duration', type: 'seconds', default: 0.2 },
      { key: 'target',   label: 'Target',   type: 'targetEntity', default: 'self', allowSelf: true }
    ]
  },
  {
    type: 'setMaterial',
    label: 'Set material property',
    group: 'Material & visibility',
    kind: 'material',
    swift: 'PhysicallyBasedMaterial property tween',
    params: [
      { key: 'property', label: 'Property', type: 'select', default: 'color', options: [
        { value: 'color',     label: 'Base color' },
        { value: 'emission',  label: 'Emission color' },
        { value: 'emissionIntensity', label: 'Emission intensity' },
        { value: 'roughness', label: 'Roughness' },
        { value: 'metallic',  label: 'Metallic' },
        { value: 'opacity',   label: 'Opacity' }
      ]},
      { key: 'colorValue',  label: 'Color',    type: 'color',   default: '#FFD27A',
        showWhen: (p) => p.property === 'color' || p.property === 'emission' },
      { key: 'numberValue', label: 'Value',    type: 'number',  default: 1, step: 0.1,
        showWhen: (p) => p.property !== 'color' && p.property !== 'emission' },
      { key: 'duration',    label: 'Duration', type: 'seconds', default: 0.2 },
      { key: 'curve',       label: 'Curve',    type: 'select',  default: 'easeOut', options: CURVE_OPTIONS },
      { key: 'toggle',      label: 'Auto-reverse', type: 'boolean', default: false, hint: 'Next time this trigger fires, snap back to the original value.' }
    ]
  },
  {
    type: 'shaderEffect',
    label: 'Apply shader effect',
    group: 'Material & visibility',
    kind: 'shader',
    swift: 'HoverEffectComponent / ShaderGraphMaterial',
    params: [
      { key: 'effect', label: 'Effect', type: 'select', default: 'outline', options: [
        { value: 'outline',  label: 'Outline' },
        { value: 'dissolve', label: 'Dissolve' },
        { value: 'hologram', label: 'Hologram' },
        { value: 'xray',     label: 'X-ray' },
        { value: 'none',     label: '— Off —' }
      ]},
      { key: 'intensity', label: 'Intensity', type: 'number',  default: 1, step: 0.1 },
      { key: 'duration',  label: 'Duration',  type: 'seconds', default: 0.2 }
    ]
  },

  // ----- Spawn / destroy -----
  {
    type: 'spawn',
    label: 'Spawn',
    group: 'Spawn & destroy',
    kind: 'spawn',
    swift: 'entity.clone(recursive:) + addChild',
    params: [
      { key: 'template', label: 'Template', type: 'targetEntity', default: 'self', allowSelf: true },
      { key: 'at',       label: 'At',       type: 'select',       default: 'self', options: [
        { value: 'self',   label: 'My position' },
        { value: 'target', label: 'Target position' }
      ]},
      { key: 'targetEntity', label: 'Target', type: 'targetEntity', default: '',
        showWhen: (p) => p.at === 'target' },
      { key: 'count',  label: 'Count',  type: 'number', default: 1, step: 1, min: 1 },
      { key: 'stagger', label: 'Stagger (s)', type: 'seconds', default: 0 }
    ]
  },
  {
    type: 'destroy',
    label: 'Destroy',
    group: 'Spawn & destroy',
    kind: 'destroy',
    swift: 'animated opacity → removeFromParent()',
    params: [
      { key: 'target', label: 'Target', type: 'targetEntity', default: 'self', allowSelf: true },
      { key: 'fade',     label: 'Fade out', type: 'boolean', default: true },
      { key: 'duration', label: 'Duration', type: 'seconds', default: 0.3 }
    ]
  },

  // ----- Playback -----
  {
    type: 'playAnimation',
    label: 'Play animation',
    group: 'Playback',
    kind: 'playback',
    swift: 'entity.playAnimation(_:)',
    params: [
      { key: 'target', label: 'Target', type: 'targetEntity', default: 'self', allowSelf: true },
      { key: 'clip',   label: 'Clip',   type: 'text', default: 'default' }
    ]
  },

  // ----- Flow -----
  {
    type: 'wait',
    label: 'Wait',
    group: 'Flow',
    kind: 'flow',
    swift: 'Task.sleep / asyncAfter',
    params: [
      { key: 'seconds', label: 'Seconds', type: 'seconds', default: 0.5 }
    ]
  },
  {
    type: 'repeat',
    label: 'Repeat next action',
    group: 'Flow',
    kind: 'flow',
    swift: 'for-loop in generated Swift',
    params: [
      { key: 'mode',  label: 'Mode',  type: 'select', default: 'count', options: [
        { value: 'count',   label: 'N times' },
        { value: 'forever', label: 'Forever' }
      ]},
      { key: 'count', label: 'Count', type: 'number', default: 3, step: 1, min: 1,
        showWhen: (p) => p.mode === 'count' }
    ]
  },
  {
    type: 'broadcast',
    label: 'Broadcast event',
    group: 'Flow',
    kind: 'flow',
    swift: 'NotificationCenter.default.post',
    params: [
      { key: 'name', label: 'Event name', type: 'eventName', default: 'event-1' }
    ]
  }
]

// ---- Lookup helpers --------------------------------------------------

const triggerById = new Map(TRIGGERS.map((t) => [t.type, t]))
const actionById  = new Map(ACTIONS.map((a) => [a.type, a]))

export const getTriggerSchema = (type) => triggerById.get(type)
export const getActionSchema  = (type) => actionById.get(type)

export const TRIGGER_OPTIONS = TRIGGERS.map((t) => ({
  value: t.type,
  label: t.deviceOnly ? `${t.label}  • device only` : t.label
}))

// Action options grouped by `group` field, suitable for an <optgroup>-
// rendering Select. We keep group order as the order the actions
// appear in the ACTIONS array.
export function getActionOptionGroups() {
  const groups = []
  const seen = new Map()
  for (const a of ACTIONS) {
    if (!seen.has(a.group)) {
      const g = { label: a.group, options: [] }
      seen.set(a.group, g)
      groups.push(g)
    }
    seen.get(a.group).options.push({ value: a.type, label: a.label })
  }
  return groups
}

// Build a default param object for a freshly-picked trigger / action.
// Skips `showWhen`-gated params (they materialise when their condition
// becomes true via the inspector — keeps stored shape minimal).
export function defaultParamsFor(schema) {
  const out = {}
  if (!schema) return out
  for (const p of schema.params || []) {
    out[p.key] = Array.isArray(p.default) ? [...p.default] : p.default
  }
  return out
}
