// RealityKit registry — the single source of truth for every entity kind,
// anchor target, mesh primitive, material, and visual component the
// designer supports. Mirrors the SwiftUI panel registry pattern so that
// adding a new mesh / material / component means adding one entry here.
//
// Scope: this is the "visual & artifact" surface of RealityKit. Physics,
// collision, input targeting, audio, particles, gestures, and animation
// are intentionally out of scope until the designer grows interaction
// support — see the integration plan.

// ---- ENTITY KINDS -----------------------------------------------------
//
// Every entity item carries `entityKind ∈ ENTITY_KINDS`. The kind drives
// which RealityKit class is emitted (AnchorEntity / ModelEntity / Entity),
// which inspector sections appear, and which children are legal.

export const ENTITY_KINDS = {
  anchor: {
    label: 'Anchor',
    swift: 'AnchorEntity',
    // An anchor is always the root of an entity sub-tree — RealityKit anchors
    // its children into world / hand / plane / image space at runtime. We let
    // anchors live under any RealityView panel, volumetric window, or other
    // anchor (RealityKit re-anchors child anchors via their own target).
    canHaveChildren: true,
    description: 'Pins entities to world / head / hand / plane / image / object space.'
  },
  model: {
    label: 'Model',
    swift: 'ModelEntity',
    canHaveChildren: true,
    description: 'Renders a mesh with one or more materials.'
  },
  group: {
    label: 'Entity',
    swift: 'Entity',
    canHaveChildren: true,
    description: 'Empty transform node — useful as a parent for grouping.'
  }
}

export const ENTITY_KIND_ORDER = ['anchor', 'model', 'group']

// ---- ANCHOR TARGETS ---------------------------------------------------
//
// `AnchorEntity(.world / .head / .hand(...) / .plane(...) / .image(...) /
// .object(...))`. Each target carries a tiny schema of the extra fields it
// reads from the entity (hand chirality, plane classification, etc.).

export const ANCHOR_TARGETS = {
  world: {
    label: 'World',
    swift: '.world(transform: matrix_identity_float4x4)',
    description: 'Pins to a fixed world transform. Use the Transform section.'
  },
  head: {
    label: 'Head',
    swift: '.head',
    description: 'Tracks the wearer\'s head pose. Useful for HUD-style content.'
  },
  hand: {
    label: 'Hand',
    swift: '.hand',
    description: 'Tracks a specified hand joint.',
    fields: ['handChirality', 'handLocation']
  },
  plane: {
    label: 'Plane',
    swift: '.plane',
    description: 'Anchors to a detected horizontal or vertical plane.',
    fields: ['planeAlignment', 'planeClassification', 'planeMinimumBounds']
  },
  image: {
    label: 'Image',
    swift: '.image',
    description: 'Anchors to a recognized AR reference image.',
    fields: ['imageGroup', 'imageName']
  },
  object: {
    label: 'Object',
    swift: '.object',
    description: 'Anchors to a recognized AR reference object.',
    fields: ['objectGroup', 'objectName']
  }
}

export const ANCHOR_TARGET_ORDER = ['world', 'head', 'hand', 'plane', 'image', 'object']

export const HAND_CHIRALITIES = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'either', label: 'Either' }
]

// ARKit's `HandSkeleton.JointName` — the visually-meaningful subset.
// (Full skeleton has 27 joints; we surface the joints designers actually
// pin content to.)
export const HAND_LOCATIONS = [
  { value: 'palm',           label: 'Palm' },
  { value: 'wrist',          label: 'Wrist' },
  { value: 'thumbTip',       label: 'Thumb tip' },
  { value: 'indexFingerTip', label: 'Index finger tip' },
  { value: 'middleFingerTip',label: 'Middle finger tip' },
  { value: 'ringFingerTip',  label: 'Ring finger tip' },
  { value: 'littleFingerTip',label: 'Little finger tip' },
  { value: 'aboveHand',      label: 'Above hand' }
]

export const PLANE_ALIGNMENTS = [
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical',   label: 'Vertical' },
  { value: 'any',        label: 'Any' }
]

export const PLANE_CLASSIFICATIONS = [
  { value: 'any',     label: 'Any' },
  { value: 'floor',   label: 'Floor' },
  { value: 'ceiling', label: 'Ceiling' },
  { value: 'wall',    label: 'Wall' },
  { value: 'table',   label: 'Table' },
  { value: 'seat',    label: 'Seat' },
  { value: 'window',  label: 'Window' },
  { value: 'door',    label: 'Door' }
]

// ---- MESH PRIMITIVES --------------------------------------------------
//
// `MeshResource.generate*`. Each entry owns a `defaults` object spliced
// into the entity when the user picks that mesh, plus a `swift` hint for
// the future RealityKit exporter.

export const MESH_TYPES = {
  box: {
    label: 'Box',
    swift: 'MeshResource.generateBox',
    defaults: {
      boxSize: [0.1, 0.1, 0.1],     // metres — RealityKit native unit
      boxCornerRadius: 0
    }
  },
  sphere: {
    label: 'Sphere',
    swift: 'MeshResource.generateSphere',
    defaults: {
      sphereRadius: 0.05
    }
  },
  cylinder: {
    label: 'Cylinder',
    swift: 'MeshResource.generateCylinder',
    defaults: {
      cylinderHeight: 0.1,
      cylinderRadius: 0.05
    }
  },
  cone: {
    label: 'Cone',
    swift: 'MeshResource.generateCone',
    defaults: {
      coneHeight: 0.1,
      coneRadius: 0.05
    }
  },
  plane: {
    label: 'Plane',
    swift: 'MeshResource.generatePlane',
    defaults: {
      planeWidth: 0.1,
      planeDepth: 0.1,
      planeCornerRadius: 0
    }
  },
  text: {
    label: 'Text',
    swift: 'MeshResource.generateText',
    defaults: {
      textValue:           'Hello',
      textExtrusionDepth:  0.005,
      textFontSize:        0.05,
      textAlignment:       'center',     // 'left' | 'center' | 'right'
      textLineBreakMode:   'wordWrap',   // 'wordWrap' | 'truncatingTail' | 'charWrap'
      textContainerFrame:  [0.5, 0.2]    // metres — width × height of layout box
    }
  },
  usdz: {
    label: 'USDZ asset',
    swift: 'Entity.load(named:)',
    defaults: {
      usdzAsset:          '',           // bundle resource name (no extension)
      usdzAnimationName:  null          // optional named animation reference
    }
  }
}

export const MESH_TYPE_ORDER = ['box', 'sphere', 'cylinder', 'cone', 'plane', 'text', 'usdz']

export const TEXT_ALIGNMENTS = [
  { value: 'left',   label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right',  label: 'Right' }
]

export const TEXT_LINE_BREAK_MODES = [
  { value: 'wordWrap',       label: 'Word wrap' },
  { value: 'charWrap',       label: 'Character wrap' },
  { value: 'truncatingTail', label: 'Truncate tail' },
  { value: 'truncatingHead', label: 'Truncate head' },
  { value: 'truncatingMiddle', label: 'Truncate middle' }
]

// ---- MATERIALS --------------------------------------------------------
//
// RealityKit ships several material classes; we model the "visual" subset.
// Each material entry is *additive* — the entity carries an array
// `materials[]` so multi-material meshes (e.g. USDZ with sub-meshes) work.

export const MATERIAL_TYPES = {
  simple: {
    label: 'Simple',
    swift: 'SimpleMaterial',
    description: 'Diffuse colour + optional metallic. The pragmatic default.',
    defaults: {
      baseColor:    '#ffffff',
      baseColorTextureName: null,
      roughness:    0.5,
      isMetallic:   false
    }
  },
  physicallyBased: {
    label: 'Physically based',
    swift: 'PhysicallyBasedMaterial',
    description: 'Full PBR — base, roughness, metallic, normal, emissive, AO, sheen, clearcoat.',
    defaults: {
      baseColor:                  '#ffffff',
      baseColorTextureName:       null,
      roughness:                  0.5,
      roughnessTextureName:       null,
      metallic:                   0.0,
      metallicTextureName:        null,
      normalTextureName:          null,
      ambientOcclusionTextureName: null,
      emissiveColor:              '#000000',
      emissiveIntensity:          0.0,
      emissiveTextureName:        null,
      clearcoat:                  0.0,
      clearcoatRoughness:         0.0,
      sheenColor:                 '#000000',
      blending:                   'opaque',  // 'opaque' | 'transparent'
      opacityThreshold:           null,      // null = no alpha-test cutoff
      faceCulling:                'back',    // 'back' | 'front' | 'none'
      textureCoordinateTransform: { offsetU: 0, offsetV: 0, scaleU: 1, scaleV: 1, rotation: 0 }
    }
  },
  unlit: {
    label: 'Unlit',
    swift: 'UnlitMaterial',
    description: 'Constant colour — ignores scene lighting. Use for HUD / icons.',
    defaults: {
      unlitColor:           '#ffffff',
      unlitTextureName:     null,
      blending:             'opaque',
      faceCulling:          'back',
      opacityThreshold:     null
    }
  },
  occlusion: {
    label: 'Occlusion',
    swift: 'OcclusionMaterial',
    description: 'Renders nothing visible but writes depth — hides entities behind real-world geometry.',
    defaults: {}
  },
  portal: {
    label: 'Portal',
    swift: 'PortalMaterial',
    description: 'Reveals a paired portal world through this surface.',
    defaults: {}
  },
  video: {
    label: 'Video',
    swift: 'VideoMaterial',
    description: 'Plays a video resource as the surface texture.',
    defaults: {
      videoAssetName:   '',
      autoplay:         true,
      loops:            true,
      audioGain:        1.0
    }
  },
  shaderGraph: {
    label: 'Shader graph',
    swift: 'ShaderGraphMaterial',
    description: 'Custom material authored in Reality Composer Pro.',
    defaults: {
      shaderGraphAssetName: '',
      shaderGraphFromBundle: 'main'
    }
  }
}

export const MATERIAL_TYPE_ORDER = [
  'simple', 'physicallyBased', 'unlit', 'occlusion', 'portal', 'video', 'shaderGraph'
]

export const BLENDING_MODES = [
  { value: 'opaque',      label: 'Opaque' },
  { value: 'transparent', label: 'Transparent' }
]

export const FACE_CULLING_MODES = [
  { value: 'back',  label: 'Back (default)' },
  { value: 'front', label: 'Front' },
  { value: 'none',  label: 'None (double-sided)' }
]

// Returns a fresh defaults object (shallow-cloned) for the given material
// type. Unknown types yield an empty object.
export const materialDefaults = (type) => {
  const entry = MATERIAL_TYPES[type]
  return entry ? JSON.parse(JSON.stringify(entry.defaults)) : {}
}

// ---- VISUAL COMPONENTS -----------------------------------------------
//
// Components are RealityKit's ECS pieces attached to an entity. We expose
// only the components that change *visual* output. Physics, audio, input,
// particles, gestures and accessibility are deferred until the interaction
// pass.
//
// Each entry stores its toggle defaults in `defaults` and the entity
// carries the same shape under `components.<key>`. Designers enable a
// component via the Components section in EntityProps.

export const COMPONENT_TYPES = {
  groundingShadow: {
    label: 'Grounding shadow',
    swift: 'GroundingShadowComponent',
    description: 'Soft contact shadow projected onto detected real-world geometry.',
    defaults: {
      enabled:      false,
      castsShadow:  true
    }
  },
  opacity: {
    label: 'Opacity',
    swift: 'OpacityComponent',
    description: 'Multiplies the entity\'s alpha — affects this entity and its descendants.',
    defaults: {
      enabled:  false,
      value:    1.0
    }
  },
  imageBasedLight: {
    label: 'Image-based light',
    swift: 'ImageBasedLightComponent',
    description: 'Provides an environment map (cubemap / HDRI) as a lighting source.',
    defaults: {
      enabled:           false,
      resourceName:      '',         // bundle name of an .exr / .hdr / cubemap
      intensityExponent: 0.0,        // EV bias (RealityKit default 0)
      inheritsRotation:  true
    }
  },
  imageBasedLightReceiver: {
    label: 'IBL receiver',
    swift: 'ImageBasedLightReceiverComponent',
    description: 'Marks this entity (and descendants) as receivers of a referenced IBL.',
    defaults: {
      enabled:           false,
      referenceEntity:   null
    }
  }
}

export const COMPONENT_TYPE_ORDER = [
  'groundingShadow', 'opacity', 'imageBasedLight', 'imageBasedLightReceiver'
]

// ---- DEFAULT ENTITY SHAPE --------------------------------------------
//
// Returns the concrete defaults the entity factory mixes onto the new
// item. Splitting per-kind keeps the factories readable.

export const ANCHOR_DEFAULTS = {
  anchorTarget:          'world',
  // hand-target params (read when anchorTarget === 'hand')
  handChirality:         'right',
  handLocation:          'palm',
  // plane-target params
  planeAlignment:        'horizontal',
  planeClassification:   'any',
  planeMinimumBounds:    [0.1, 0.1],
  // image-target params
  imageGroup:            'AR Resources',
  imageName:             '',
  // object-target params
  objectGroup:           'AR Resources',
  objectName:            ''
}

export const TRANSFORM_DEFAULTS = {
  // RealityKit native units — metres.
  position:  [0, 0, 0],
  rotation:  [0, 0, 0],   // pitch / yaw / roll, degrees (converted on export)
  scale:     [1, 1, 1]
}

// Shallow-clone every component's default block — gives the factory a
// fresh `components: { ... }` hash without aliasing the registry.
export const buildDefaultComponents = () => {
  const out = {}
  for (const key of COMPONENT_TYPE_ORDER) {
    out[key] = { ...COMPONENT_TYPES[key].defaults }
  }
  return out
}

// Returns a fresh defaults object for the given mesh type. Unknown types
// yield an empty object.
export const meshDefaults = (type) => {
  const entry = MESH_TYPES[type]
  return entry ? JSON.parse(JSON.stringify(entry.defaults)) : {}
}

// ---- HELPERS ----------------------------------------------------------

// Legal child kinds for the given parent. Used by LayersPanel containment
// hints + by future drag-and-drop validation. Stays in this file so that
// adding a new entity kind doesn't require touching containment.js.
export const childKindsAllowedUnder = (parent) => {
  if (!parent) return []
  // RealityView panel — top-level entity host.
  if (parent.type === 'panel' && parent.panelType === 'realityview') {
    return ENTITY_KIND_ORDER
  }
  // Volumetric window — entities can live directly under it (the window's
  // RealityView is implicit).
  if (parent.type === 'window' && parent.windowStyle === 'volumetric') {
    return ENTITY_KIND_ORDER
  }
  // Entity → entity. RealityKit lets any entity host children, including
  // anchors hosting other anchors.
  if (parent.type === 'entity') {
    return ENTITY_KIND_ORDER
  }
  return []
}
