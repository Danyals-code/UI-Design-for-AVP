// Entity3D — RealityKit entity rendering for the designer canvas.
//
// Entities live in the same flat `items[]` array as everything else but
// have their own subtree: an entity's children are other entities. This
// component walks that subtree, renders the appropriate three.js mesh
// for each model entity, draws gizmos for anchors / empty groups, and
// applies the entity's transform / material / visual components.
//
// Coordinate system: RealityKit is metres-native and the existing
// canvas uses pt-derived units where roughly 1 unit ≈ 0.2m. We bridge
// with a fixed scale (1m = 1 canvas unit) — close enough that a 0.1m
// sphere reads as a small object inside a RealityView panel without
// requiring designers to think about the conversion. Refining this when
// volumetric windows render is a future tuning pass.

import { useMemo } from 'react'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import { useStore, isEffectivelyVisible } from '../store'
import { getInterFont } from '../fonts'
import { roundedRectShape } from '../shapes'
import { resolveSemantic } from '../appleSystem'
import { ANCHOR_TARGETS } from '../realityKit/registry'

const DEG2RAD = Math.PI / 180

// ---- material rendering --------------------------------------------------
//
// Returns a React node (a `<meshStandardMaterial>` / `<meshBasicMaterial>`
// / etc.) configured from the entity's material descriptor. Designed to
// be visually faithful for the simple cases — colour, roughness, metallic,
// emissive — and informative-but-approximate for the special materials
// (occlusion, portal, video, shader graph) where the canvas can't fully
// reproduce the device behaviour.

function materialNode(mat, effectiveOpacity = 1) {
  if (!mat) {
    // ModelEntity always has at least one material slot; this is just a
    // safety fallback for legacy data with no materials list.
    return <meshStandardMaterial color="#cccccc" roughness={0.5} metalness={0} />
  }
  const opaque = effectiveOpacity >= 1 - 1e-3
  const transparent = !opaque

  if (mat.type === 'simple') {
    return (
      <meshStandardMaterial
        color={mat.baseColor || '#ffffff'}
        roughness={mat.roughness ?? 0.5}
        metalness={mat.isMetallic ? 1 : 0}
        opacity={effectiveOpacity}
        transparent={transparent}
      />
    )
  }

  if (mat.type === 'physicallyBased') {
    const blendingTransparent =
      mat.blending === 'transparent' || transparent
    const side = mat.faceCulling === 'none'
      ? THREE.DoubleSide
      : mat.faceCulling === 'front' ? THREE.BackSide : THREE.FrontSide
    return (
      <meshStandardMaterial
        color={mat.baseColor || '#ffffff'}
        roughness={mat.roughness ?? 0.5}
        metalness={mat.metallic ?? 0}
        emissive={mat.emissiveColor || '#000000'}
        emissiveIntensity={mat.emissiveIntensity ?? 0}
        opacity={effectiveOpacity}
        transparent={blendingTransparent}
        side={side}
      />
    )
  }

  if (mat.type === 'unlit') {
    const blendingTransparent =
      mat.blending === 'transparent' || transparent
    const side = mat.faceCulling === 'none'
      ? THREE.DoubleSide
      : mat.faceCulling === 'front' ? THREE.BackSide : THREE.FrontSide
    return (
      <meshBasicMaterial
        color={mat.unlitColor || '#ffffff'}
        opacity={effectiveOpacity}
        transparent={blendingTransparent}
        side={side}
      />
    )
  }

  if (mat.type === 'occlusion') {
    // RealityKit's OcclusionMaterial writes depth without colour, hiding
    // entities behind real-world geometry. The canvas doesn't have real
    // geometry to occlude against, so we approximate the look with a
    // dark, semi-transparent "ghost" so designers can see the shape.
    return (
      <meshBasicMaterial color="#1a1a1a" transparent opacity={0.55 * effectiveOpacity} />
    )
  }

  if (mat.type === 'portal') {
    // Stylised: a deep-purple translucent surface signalling "portal here".
    return (
      <meshStandardMaterial
        color="#5b3aa8"
        emissive="#9b6dff"
        emissiveIntensity={0.35}
        roughness={0.3}
        metalness={0.05}
        transparent
        opacity={0.55 * effectiveOpacity}
        side={THREE.DoubleSide}
      />
    )
  }

  if (mat.type === 'video') {
    // No texture sampling in the designer — show a flat dark surface so
    // it reads as "video target" without pretending to play media.
    return (
      <meshBasicMaterial color="#0a0a0a" opacity={effectiveOpacity} transparent={transparent} />
    )
  }

  if (mat.type === 'shaderGraph') {
    // Magenta/UV checker stand-in so unloaded shader graphs are obvious.
    return (
      <meshStandardMaterial
        color="#ff2eb4"
        roughness={0.4}
        metalness={0.1}
        opacity={effectiveOpacity}
        transparent={transparent}
      />
    )
  }

  return <meshStandardMaterial color="#cccccc" roughness={0.5} />
}

// ---- mesh geometry --------------------------------------------------
//
// Returns the appropriate `<*Geometry>` node for a model entity's mesh
// type. Sizes are in metres; the surrounding `<group>` carries the
// 1m-per-unit scale so we feed three.js metres directly.

function meshGeometry(entity) {
  const m = entity.meshType || 'box'
  if (m === 'box') {
    const [w, h, d] = entity.boxSize || [0.1, 0.1, 0.1]
    // boxCornerRadius is intentionally not modelled by three.js
    // BoxGeometry — we accept the slight visual mismatch for now.
    return <boxGeometry args={[w, h, d]} />
  }
  if (m === 'sphere') {
    return <sphereGeometry args={[entity.sphereRadius ?? 0.05, 32, 32]} />
  }
  if (m === 'cylinder') {
    const r = entity.cylinderRadius ?? 0.05
    const h = entity.cylinderHeight ?? 0.1
    return <cylinderGeometry args={[r, r, h, 32]} />
  }
  if (m === 'cone') {
    const r = entity.coneRadius ?? 0.05
    const h = entity.coneHeight ?? 0.1
    return <coneGeometry args={[r, h, 32]} />
  }
  if (m === 'plane') {
    const w = entity.planeWidth ?? 0.1
    const d = entity.planeDepth ?? 0.1
    return <planeGeometry args={[w, d]} />
  }
  // text and usdz are handled separately (they don't return a single
  // geometry node — Text uses a drei <Text> primitive, USDZ shows a
  // wireframe-box placeholder).
  return null
}

// ---- selection halo (per mesh) -------------------------------------

function SelectionHalo({ entity, scene }) {
  const m = entity.meshType || 'box'
  const tint = scene.tintColor || '#007aff'
  const k = 1.06   // slightly larger than the geometry
  const op = 0.22
  if (m === 'box') {
    const [w, h, d] = entity.boxSize || [0.1, 0.1, 0.1]
    return (
      <mesh>
        <boxGeometry args={[w * k, h * k, d * k]} />
        <meshBasicMaterial color={tint} transparent opacity={op} wireframe />
      </mesh>
    )
  }
  if (m === 'sphere') {
    const r = (entity.sphereRadius ?? 0.05) * k
    return (
      <mesh>
        <sphereGeometry args={[r, 24, 24]} />
        <meshBasicMaterial color={tint} transparent opacity={op} wireframe />
      </mesh>
    )
  }
  if (m === 'cylinder') {
    const r = (entity.cylinderRadius ?? 0.05) * k
    const h = (entity.cylinderHeight ?? 0.1) * k
    return (
      <mesh>
        <cylinderGeometry args={[r, r, h, 24]} />
        <meshBasicMaterial color={tint} transparent opacity={op} wireframe />
      </mesh>
    )
  }
  if (m === 'cone') {
    const r = (entity.coneRadius ?? 0.05) * k
    const h = (entity.coneHeight ?? 0.1) * k
    return (
      <mesh>
        <coneGeometry args={[r, h, 24]} />
        <meshBasicMaterial color={tint} transparent opacity={op} wireframe />
      </mesh>
    )
  }
  if (m === 'plane') {
    const w = (entity.planeWidth ?? 0.1) * k
    const d = (entity.planeDepth ?? 0.1) * k
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color={tint} transparent opacity={op * 1.4} wireframe side={THREE.DoubleSide} />
      </mesh>
    )
  }
  // Text / USDZ — a simple bracket box around the bounds.
  return (
    <mesh>
      <boxGeometry args={[0.18, 0.06, 0.04]} />
      <meshBasicMaterial color={tint} transparent opacity={op} wireframe />
    </mesh>
  )
}

// ---- ground shadow disc ---------------------------------------------
//
// RealityKit's GroundingShadowComponent projects a soft shadow onto the
// detected ground plane. We approximate with a flat disc placed
// underneath the entity, sized to the entity's footprint.

function GroundingShadow({ entity }) {
  // Estimate footprint from the mesh so the shadow doesn't look pasted on.
  const m = entity.meshType || 'box'
  let r = 0.06
  if (m === 'box') {
    const [w, , d] = entity.boxSize || [0.1, 0.1, 0.1]
    r = Math.max(w, d) * 0.6
  } else if (m === 'sphere') {
    r = (entity.sphereRadius ?? 0.05) * 1.1
  } else if (m === 'cylinder') {
    r = (entity.cylinderRadius ?? 0.05) * 1.2
  } else if (m === 'cone') {
    r = (entity.coneRadius ?? 0.05) * 1.2
  } else if (m === 'plane') {
    const w = entity.planeWidth ?? 0.1
    const d = entity.planeDepth ?? 0.1
    r = Math.max(w, d) * 0.6
  }
  // Position the shadow at the entity's local Y=−bbHalf (below the
  // mesh) — but since we don't know the precise lower bound for every
  // mesh, place it slightly below origin and trust the entity's own
  // position to put it in the right place.
  return (
    <mesh position={[0, -0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[r, 32]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.32} />
    </mesh>
  )
}

// ---- gizmos ---------------------------------------------------------
//
// AnchorGizmo — a small XYZ frame to mark an anchor's local origin.
// GroupGizmo — a tiny octahedron so empty groups show in the canvas.

function AxisLine({ start, end, color }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([...start, ...end], 3))
    return g
  }, [start.join(','), end.join(',')])
  return (
    <line>
      <primitive object={geom} attach="geometry" />
      <lineBasicMaterial color={color} />
    </line>
  )
}

function AnchorGizmo({ entity, isSelected, scene }) {
  const tint = scene.tintColor || '#007aff'
  const size = 0.08
  const target = entity.anchorTarget || 'world'
  const meta = ANCHOR_TARGETS[target]
  return (
    <group>
      {/* X (red), Y (green), Z (blue) axes — Blender / RealityKit
          colour convention. */}
      <AxisLine start={[0, 0, 0]} end={[size, 0, 0]} color="#ff5252" />
      <AxisLine start={[0, 0, 0]} end={[0, size, 0]} color="#7ee787" />
      <AxisLine start={[0, 0, 0]} end={[0, 0, size]} color="#79c0ff" />
      {/* A subtle dot at the origin so the gizmo is selectable on click. */}
      <mesh>
        <sphereGeometry args={[0.012, 16, 16]} />
        <meshBasicMaterial color={isSelected ? tint : '#cccccc'} />
      </mesh>
      {/* Label — anchor target name. */}
      <Text
        position={[size + 0.02, 0, 0]}
        fontSize={0.022}
        color={isSelected ? tint : '#888888'}
        anchorX="left"
        anchorY="middle"
        font={getInterFont('medium')}
      >
        {meta?.label || target}
      </Text>
    </group>
  )
}

function GroupGizmo({ isSelected, scene }) {
  const tint = scene.tintColor || '#007aff'
  return (
    <group>
      <mesh>
        <octahedronGeometry args={[0.018, 0]} />
        <meshBasicMaterial color={isSelected ? tint : '#888888'} wireframe />
      </mesh>
    </group>
  )
}

// ---- text 3D --------------------------------------------------------
//
// RealityKit's MeshResource.generateText produces an extruded mesh; the
// canvas approximates with drei's <Text>, plus a back-shadow copy so the
// extrusion reads visually. Container frame is consulted for maxWidth.

function Text3DEntity({ entity, mat, opacity }) {
  const value = entity.textValue || 'Hello'
  const fontSize = entity.textFontSize ?? 0.05
  const ext = (entity.textExtrusionDepth ?? 0.005) * 0.6
  const align = entity.textAlignment || 'center'
  const [maxW] = entity.textContainerFrame || [0.5, 0.2]
  const color = mat?.type === 'unlit' ? (mat.unlitColor || '#ffffff')
              : mat?.type === 'physicallyBased' ? (mat.baseColor || '#ffffff')
              : mat?.type === 'simple' ? (mat.baseColor || '#ffffff')
              : '#ffffff'
  return (
    <group>
      {/* Back-shadow to suggest extrusion depth */}
      <Text
        position={[ext * 0.6, -ext * 0.6, -ext]}
        fontSize={fontSize}
        color="#000000"
        fillOpacity={opacity * 0.6}
        anchorX={align}
        anchorY="middle"
        font={getInterFont('semibold')}
        maxWidth={maxW}
      >
        {value}
      </Text>
      <Text
        position={[0, 0, 0]}
        fontSize={fontSize}
        color={color}
        fillOpacity={opacity}
        anchorX={align}
        anchorY="middle"
        font={getInterFont('semibold')}
        maxWidth={maxW}
      >
        {value}
      </Text>
    </group>
  )
}

// ---- USDZ placeholder -----------------------------------------------
//
// Browsers can't load USDZ in three.js without converting first. We
// render a wireframe box with the asset name above it so designers can
// place / scale / rotate the entity even though the model is missing
// from the canvas preview.

function UsdzPlaceholder({ entity, mat, opacity, isSelected, scene }) {
  const tint = scene.tintColor || '#007aff'
  const size = 0.1
  return (
    <group>
      <mesh>
        <boxGeometry args={[size, size, size]} />
        <meshStandardMaterial
          color={mat?.baseColor || mat?.unlitColor || '#666666'}
          roughness={0.7}
          metalness={0}
          wireframe
          opacity={opacity}
          transparent={opacity < 1}
        />
      </mesh>
      {isSelected && (
        <mesh>
          <boxGeometry args={[size * 1.06, size * 1.06, size * 1.06]} />
          <meshBasicMaterial color={tint} transparent opacity={0.18} wireframe />
        </mesh>
      )}
      <Text
        position={[0, size * 0.7, 0]}
        fontSize={0.022}
        color="#888888"
        anchorX="center"
        anchorY="middle"
        font={getInterFont('medium')}
      >
        {entity.usdzAsset ? `usdz: ${entity.usdzAsset}` : 'USDZ (no asset)'}
      </Text>
    </group>
  )
}

// ---- root ------------------------------------------------------------
//
// Recurses into entity children — entities can host other entities under
// any kind (anchor → model, model → group, group → anchor, etc.).
// Visibility is honoured at every level.

export default function Entity3D({ entity, items, scene }) {
  const select = useStore((s) => s.select)
  const selectedId = useStore((s) => s.selectedId)
  const isSelected = selectedId === entity.id

  const opComp = entity.components?.opacity
  const opacity = opComp?.enabled ? (opComp.value ?? 1) : 1
  const showShadow = entity.components?.groundingShadow?.enabled
                  && entity.components?.groundingShadow?.castsShadow !== false

  const pos = entity.position || [0, 0, 0]
  const rot = (entity.rotation || [0, 0, 0]).map((d) => d * DEG2RAD)
  const scl = entity.scale || [1, 1, 1]

  const children = items.filter(
    (c) => c.parentId === entity.id && c.type === 'entity' && isEffectivelyVisible(items, c.id)
  )

  const onPointerDown = (e) => { e.stopPropagation(); select(entity.id) }

  // The first material drives the surface; multi-material multi-submesh
  // is RealityKit territory the designer can't preview without the
  // underlying USDZ — we surface it in the inspector instead.
  const mat = (entity.materials || [])[0]

  return (
    <group position={pos} rotation={rot} scale={scl}>
      {/* Render mesh / gizmo for the entity's own kind */}
      {entity.entityKind === 'model' && entity.meshType === 'text' && (
        <group onPointerDown={onPointerDown}>
          <Text3DEntity entity={entity} mat={mat} opacity={opacity} />
          {isSelected && (
            <mesh position={[0, 0, -0.001]}>
              <planeGeometry args={[(entity.textContainerFrame || [0.5])[0] * 1.05, (entity.textFontSize ?? 0.05) * 2]} />
              <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.18} />
            </mesh>
          )}
        </group>
      )}

      {entity.entityKind === 'model' && entity.meshType === 'usdz' && (
        <group onPointerDown={onPointerDown}>
          <UsdzPlaceholder entity={entity} mat={mat} opacity={opacity} isSelected={isSelected} scene={scene} />
        </group>
      )}

      {entity.entityKind === 'model' &&
        entity.meshType !== 'text' &&
        entity.meshType !== 'usdz' && (
        <group onPointerDown={onPointerDown}>
          {isSelected && <SelectionHalo entity={entity} scene={scene} />}
          <mesh>
            {meshGeometry(entity)}
            {materialNode(mat, opacity)}
          </mesh>
        </group>
      )}

      {entity.entityKind === 'anchor' && (
        <group onPointerDown={onPointerDown}>
          <AnchorGizmo entity={entity} isSelected={isSelected} scene={scene} />
        </group>
      )}

      {entity.entityKind === 'group' && (
        <group onPointerDown={onPointerDown}>
          <GroupGizmo isSelected={isSelected} scene={scene} />
        </group>
      )}

      {/* Visual components (artifact-only — physics/audio/input excluded) */}
      {showShadow && entity.entityKind === 'model' && <GroundingShadow entity={entity} />}

      {/* Recurse into children — entities nest freely */}
      {children.map((c) => (
        <Entity3D key={c.id} entity={c} items={items} scene={scene} />
      ))}
    </group>
  )
}

// ---- helper exposed to other renderers ------------------------------
//
// Walk the entity children of any host (RealityView panel, volumetric
// window, or another entity). The host's own transform handles its
// position; the child entities use their own positions relative to the
// host's local space.

export function EntityChildren({ hostId, items, scene }) {
  const children = items.filter(
    (c) => c.parentId === hostId && c.type === 'entity' && isEffectivelyVisible(items, c.id)
  )
  if (children.length === 0) return null
  return (
    <>
      {children.map((c) => (
        <Entity3D key={c.id} entity={c} items={items} scene={scene} />
      ))}
    </>
  )
}
