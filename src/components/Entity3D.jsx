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

import { useEffect, useMemo, Suspense } from 'react'

import * as THREE from 'three'
import { Text, useGLTF, Billboard } from '@react-three/drei'
import { useStore } from '../store'
import { isLoadableMeshUrl } from '../store/assets'
import { getInterFont } from '../fonts'
import { roundedRectShape } from '../shapes'
import { resolveAttachmentStyle } from '../appleSystem'
import { ANCHOR_TARGETS } from '../realityKit/registry'
import { useBehaviorRuntime, registerEntity } from '../behaviors/runtime'
import { SymbolIcon3D } from './SymbolIcon3D'

const DEG2RAD = Math.PI / 180

// ---- material rendering --------------------------------------------------
//
// Returns a React node (a `<meshStandardMaterial>` / `<meshBasicMaterial>`
// / etc.) configured from the entity's material descriptor. Designed to
// be visually faithful for the simple cases — colour, roughness, metallic,
// emissive — and informative-but-approximate for the special materials
// (occlusion, portal, video, shader graph) where the canvas can't fully
// reproduce the device behaviour.

function materialNode(mat, effectiveOpacity = 1, iblBoost = 0) {
  // Force `transparent` whenever the entity carries any propagated alpha
  // — three.js needs the flag set or the meshStandardMaterial silently
  // ignores `opacity` and the user sees no visual change. The 1e-3
  // epsilon avoids flipping transparency on for fully opaque materials.
  const transparent = effectiveOpacity < 1 - 1e-3
  // Emissive bump from an active ImageBasedLightComponent — see the
  // entity-level comment for why this exists.
  const emissiveColor = iblBoost > 0 ? '#ffffff' : '#000000'
  const emissiveBoost = iblBoost

  if (!mat) {
    // ModelEntity always has at least one material slot; this is just a
    // safety fallback for legacy data with no materials list.
    return (
      <meshStandardMaterial
        color="#cccccc" roughness={0.5} metalness={0}
        opacity={effectiveOpacity} transparent={transparent}
        emissive={emissiveColor} emissiveIntensity={emissiveBoost}
      />
    )
  }

  if (mat.type === 'simple') {
    // MeshPhysicalMaterial is a strict superset of MeshStandardMaterial —
    // same baseColor/roughness/metalness, plus clearcoat / sheen / etc.
    // for free. Using it everywhere unifies the lighting equation so a
    // material upgraded from "simple" to "physicallyBased" renders
    // consistently.
    return (
      <meshPhysicalMaterial
        color={mat.baseColor || '#ffffff'}
        roughness={mat.roughness ?? 0.5}
        metalness={mat.isMetallic ? 1 : 0}
        opacity={effectiveOpacity}
        transparent={transparent}
        emissive={emissiveColor}
        emissiveIntensity={emissiveBoost}
        envMapIntensity={1}
      />
    )
  }

  if (mat.type === 'physicallyBased') {
    const blendingTransparent =
      mat.blending === 'transparent' || transparent
    const side = mat.faceCulling === 'none'
      ? THREE.DoubleSide
      : mat.faceCulling === 'front' ? THREE.BackSide : THREE.FrontSide
    // Combine the material's own emissive with the IBL boost — the
    // material's emissive intensity is in PBR units and tops out around
    // 1, so adding `iblBoost` (also bounded to ~2) reads correctly.
    const matEmissive = mat.emissiveColor || '#000000'
    const baseEmissiveIntensity = mat.emissiveIntensity ?? 0
    const finalEmissiveIntensity = baseEmissiveIntensity + emissiveBoost
    const finalEmissiveColor = emissiveBoost > 0 && baseEmissiveIntensity === 0
      ? '#ffffff'
      : matEmissive
    // MeshPhysicalMaterial unlocks clearcoat + sheen — the two PBR
    // extensions our material schema already carries data for. Useful
    // for car-paint / lacquered-wood / fabric finishes that designers
    // want to preview, not just store on the entity for export.
    return (
      <meshPhysicalMaterial
        color={mat.baseColor || '#ffffff'}
        roughness={mat.roughness ?? 0.5}
        metalness={mat.metallic ?? 0}
        emissive={finalEmissiveColor}
        emissiveIntensity={finalEmissiveIntensity}
        clearcoat={mat.clearcoat ?? 0}
        clearcoatRoughness={mat.clearcoatRoughness ?? 0}
        sheen={mat.sheenColor && mat.sheenColor !== '#000000' ? 1 : 0}
        sheenColor={mat.sheenColor || '#000000'}
        opacity={effectiveOpacity}
        transparent={blendingTransparent}
        side={side}
        envMapIntensity={1}
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
        emissiveIntensity={0.35 + emissiveBoost}
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
        emissive={emissiveColor}
        emissiveIntensity={emissiveBoost}
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

// RealityKit's GroundingShadowComponent projects a soft shadow onto
// the detected ground plane. Earlier we faked it with a black disc
// stamped under the entity — looked weird against the rest of the
// studio (the cyclorama receives a real PCF shadow from the
// directional key light). Now `castShadow` on the model mesh itself
// drops the disc and lets the same shadow path that handles the
// stool / painting handle the user's models too. The toggle still
// gates on `groundingShadow.enabled` (see `showShadow` below) so the
// component's semantics stay intact — disabling it in the inspector
// turns the cast shadow off.

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
  // Anchor sizes in metres — small enough to live inside a 0.1m primitive
  // without dwarfing it. Hide entirely when nothing's selected (the gizmo
  // is a designer aid; in a finished scene it would clutter the canvas).
  // Fades to a tiny dot when not selected.
  const size = isSelected ? 0.08 : 0.04
  const target = entity.anchorTarget || 'world'
  const meta = ANCHOR_TARGETS[target]
  return (
    <group>
      {/* X (red), Y (green), Z (blue) axes — Blender / RealityKit
          colour convention. Dimmed when this anchor isn't selected so
          it reads as scaffolding rather than scene content. */}
      <AxisLine start={[0, 0, 0]} end={[size, 0, 0]} color="#ff5252" />
      <AxisLine start={[0, 0, 0]} end={[0, size, 0]} color="#7ee787" />
      <AxisLine start={[0, 0, 0]} end={[0, 0, size]} color="#79c0ff" />
      <mesh>
        <sphereGeometry args={[isSelected ? 0.012 : 0.006, 16, 16]} />
        <meshBasicMaterial color={isSelected ? tint : '#cccccc'} />
      </mesh>
      {/* Target-name label appears only when the user has this anchor
          selected — keeps the canvas clean for everything else. */}
      {isSelected && (
        <Text
          position={[size + 0.02, 0, 0]}
          fontSize={0.022}
          color={tint}
          anchorX="left"
          anchorY="middle"
          font={getInterFont('medium')}
        >
          {meta?.label || target}
        </Text>
      )}
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

// LightGizmo — Blender-style light marker. A small unlit sphere at
// the entity's origin + type-specific extras (rays, cone, arrows) so
// the wearer sees where the light is and which direction it points.
// When selected, we also draw a proxy wireframe sphere at the light's
// falloff range — mirrors Blender's "Light distance" indicator so the
// user can eyeball how far the light reaches.
function LightGizmo({ entity, isSelected, scene }) {
  const tint = scene.tintColor || '#007aff'
  const lightColor = entity.lightColor || '#ffffff'
  const gizmoColor = isSelected ? tint : lightColor
  const type = entity.lightType || 'point'
  const range = entity.lightRange ?? 3
  const outerAngle = ((entity.lightOuterAngle || 45) * Math.PI) / 180

  return (
    <group>
      {/* Core bulb — a bit larger (0.028m) so a fresh light is
          unmistakably visible in the diorama. Unlit MeshBasic so it
          reads as a marker, not a shaded sphere. */}
      <mesh>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshBasicMaterial color={gizmoColor} />
      </mesh>
      {/* Halo — thin outline sphere so the bulb reads on any backdrop
          without depending on shading. */}
      <mesh>
        <sphereGeometry args={[0.032, 16, 16]} />
        <meshBasicMaterial color={gizmoColor} wireframe opacity={0.5} transparent />
      </mesh>

      {/* Point light: 6 short outward rays give the classic bulb icon. */}
      {type === 'point' && (
        <group>
          {[
            [ 0.06, 0, 0], [-0.06, 0, 0],
            [0,  0.06, 0], [0, -0.06, 0],
            [0, 0,  0.06], [0, 0, -0.06]
          ].map((p, i) => {
            const half = [p[0] / 2, p[1] / 2, p[2] / 2]
            return (
              <mesh key={i} position={half}>
                <boxGeometry args={[
                  Math.abs(p[0]) || 0.003,
                  Math.abs(p[1]) || 0.003,
                  Math.abs(p[2]) || 0.003
                ]} />
                <meshBasicMaterial color={gizmoColor} />
              </mesh>
            )
          })}
        </group>
      )}
      {/* Spot light: wireframe cone pointing along -Z, opening angle
          matches the outer angle so the user sees the cone shape they
          just dialled in. */}
      {type === 'spot' && (
        <mesh position={[0, 0, -0.10]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[
            Math.tan(outerAngle / 2) * 0.20,
            0.20,
            24,
            1,
            true
          ]} />
          <meshBasicMaterial color={gizmoColor} wireframe />
        </mesh>
      )}
      {/* Directional light: 5 parallel arrows pointing along -Z (sun
          direction). Bigger so the direction reads at a glance. */}
      {type === 'directional' && (
        <group>
          {[[-0.04, 0, 0], [0.04, 0, 0], [0, 0.04, 0], [0, -0.04, 0], [0, 0, 0]].map((p, i) => (
            <mesh key={i} position={[p[0], p[1], -0.08]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.012, 0.05, 8]} />
              <meshBasicMaterial color={gizmoColor} />
            </mesh>
          ))}
        </group>
      )}
      {/* IBL: nested wireframe rings signal "environment sphere". */}
      {type === 'ibl' && (
        <>
          <mesh>
            <torusGeometry args={[0.05, 0.003, 8, 32]} />
            <meshBasicMaterial color={gizmoColor} wireframe />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.05, 0.003, 8, 32]} />
            <meshBasicMaterial color={gizmoColor} wireframe />
          </mesh>
        </>
      )}

      {/* Range proxy — Blender-style falloff sphere shown when the
          light is selected. Point + spot share the same range field;
          spot renders the sphere at the cone tip. Directional + IBL
          have no falloff, so no proxy. */}
      {isSelected && type === 'point' && (
        <mesh>
          <sphereGeometry args={[range, 24, 24]} />
          <meshBasicMaterial color={gizmoColor} wireframe transparent opacity={0.22} />
        </mesh>
      )}
      {isSelected && type === 'spot' && (
        <mesh position={[0, 0, -range]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[
            Math.tan(outerAngle / 2) * range,
            range,
            32,
            1,
            true
          ]} />
          <meshBasicMaterial color={gizmoColor} wireframe transparent opacity={0.22} />
        </mesh>
      )}
    </group>
  )
}

// LightSource — the real R3F light node. Renders in both edit and
// preview mode so the designer sees the light's effect while tuning
// it. Colour + intensity + range come from the entity's fields so a
// scrub in the inspector updates the scene in real time.
function LightSource({ entity }) {
  const color = entity.lightColor || '#ffffff'
  const intensity = entity.lightIntensity ?? 3
  const range = entity.lightRange ?? 3.0
  const castShadow = !!entity.lightCastsShadow
  const type = entity.lightType || 'point'

  if (type === 'point') {
    return (
      <pointLight
        color={color}
        intensity={intensity}
        distance={range}
        decay={2}
        castShadow={castShadow}
      />
    )
  }
  if (type === 'spot') {
    // Spot light points down the entity's local -Z axis. R3F's
    // spotLight targets +Z by default; we invert with a target ref.
    const outer = ((entity.lightOuterAngle || 45) * Math.PI) / 180
    const inner = ((entity.lightInnerAngle || 30) * Math.PI) / 180
    const penumbra = Math.max(0, 1 - inner / outer)
    return (
      <spotLight
        color={color}
        intensity={intensity}
        distance={range}
        angle={outer}
        penumbra={penumbra}
        decay={2}
        castShadow={castShadow}
      />
    )
  }
  if (type === 'directional') {
    return (
      <directionalLight
        color={color}
        intensity={intensity}
        castShadow={castShadow}
      />
    )
  }
  // IBL is scene-level (Environment) in preview; no per-entity light node.
  return null
}

// CameraGizmo — wireframe pyramid pointing along -Z (camera look
// direction). Stand-in for the wearer's headset; the "Camera View"
// button on the toolbar snaps the orbit camera to this entity's
// transform when the user wants to preview the scene from here.
// AttachmentPanel3D — renders a SwiftUI-style panel as a small 3D
// plane in space. Optionally billboards toward the camera so the user
// can read it from any orbit angle. Mirrors how `Attachment(id:)
// { ... }` content reads inside a `RealityView`.
function AttachmentPanel3D({ entity, isSelected, scene }) {
  const tint = scene.tintColor || '#007aff'
  const kind = entity.attachmentKind || 'text'
  const billboard = entity.attachmentBillboard !== false

  // Resolve font size / horizontal-padding / vertical-padding / corner
  // radius from the entity's `attachmentTextStyle` (defaults to 'body').
  // Explicit `attachmentFontSize` / `attachmentHPadding` /
  // `attachmentVPadding` / `attachmentPadding` / `attachmentCornerRadius`
  // still win when set. The ramp gives hPadding ≈ 1.55 × vPadding so
  // fresh chips read as SwiftUI's `.padding(.horizontal, N).padding(.vertical, M)`
  // idiom rather than a uniform square around the text.
  const { fontSize, hPadding, vPadding, cornerRadius: styleRadius, weight } = resolveAttachmentStyle(entity)
  const fg          = entity.attachmentColor || '#ffffff'
  const bg          = entity.attachmentBackground || '#1c1c1e'

  // Estimate panel size based on text length. For image attachments use
  // the explicit size. SF Symbols attach as a separate Lucide-rasterised
  // icon to the leading edge of the label; reserve a square's worth of
  // inline space for it. Multi-line text is respected: longest line
  // drives width, line count drives height.
  //
  // Character-width estimate is intentionally generous (0.62) — Inter's
  // mixed-case advance width averages ~0.55-0.58 em for lowercase and
  // ~0.62-0.68 for uppercase / hero titles. Underestimating pushes text
  // right up to the visual edge of the panel and makes the padding read
  // as too tight, especially at largeTitle sizes.
  const text = entity.attachmentText || ''
  const lines = String(text).split('\n')
  const longestLineLen = lines.reduce((m, l) => Math.max(m, l.length), 0)
  const lineCount = Math.max(1, lines.length)
  const hasSymbol = !!entity.attachmentSymbol
  const charW = fontSize * 0.62
  const symbolReserveW = hasSymbol ? fontSize * 1.4 + hPadding * 0.5 : 0
  const estW = (kind === 'image')
    ? (entity.attachmentSize ?? 0.2)
    : Math.max(fontSize * 3, longestLineLen * charW + hPadding * 2 + symbolReserveW)
  const estH = (kind === 'image')
    ? (entity.attachmentSize ?? 0.2)
    : (fontSize * (1.4 + (lineCount - 1) * 1.15) + vPadding * 2)

  // Capsule shape (SwiftUI's `.background(_, in: Capsule())`) caps the
  // corner radius at half the short axis, giving a proper pill. Buttons
  // default to capsule via ATTACHMENT_KINDS.button; the designer can
  // switch to roundedRect for a shape-forward look.
  const shape = entity.attachmentShape || (kind === 'button' ? 'capsule' : 'roundedRect')
  const radius = shape === 'capsule'
    ? Math.min(estW, estH) / 2
    : styleRadius

  const fillShape = useMemo(() => roundedRectShape(estW, estH, radius), [estW, estH, radius])

  const panel = (
    <group>
      {isSelected && (
        <mesh position={[0, 0, -0.001]}>
          <shapeGeometry args={[roundedRectShape(estW + 0.012, estH + 0.012, radius + 0.006)]} />
          <meshBasicMaterial color={tint} transparent opacity={0.5} />
        </mesh>
      )}
      <mesh>
        <shapeGeometry args={[fillShape]} />
        <meshBasicMaterial color={bg} side={THREE.DoubleSide} />
      </mesh>
      {kind !== 'image' && hasSymbol && (
        <SymbolIcon3D
          name={entity.attachmentSymbol}
          sizeUnits={fontSize * 1.2}
          color={fg}
          weight={weight === 'regular' ? 'medium' : weight}
          position={[-estW / 2 + hPadding + (fontSize * 0.6), 0, 0.002]}
        />
      )}
      {kind !== 'image' && (
        <Text
          position={[hasSymbol ? symbolReserveW / 2 : 0, 0, 0.001]}
          fontSize={fontSize}
          color={fg}
          anchorX="center"
          anchorY="middle"
          font={getInterFont(weight)}
          maxWidth={estW - hPadding * 2 - symbolReserveW}
          textAlign="center"
        >
          {text || ' '}
        </Text>
      )}
      {kind === 'image' && (
        <Text
          position={[0, 0, 0.001]}
          fontSize={fontSize * 0.6}
          color={fg}
          anchorX="center"
          anchorY="middle"
          font={getInterFont('medium')}
          fillOpacity={0.6}
        >
          {entity.attachmentImageUrl ? '🖼' : 'Image'}
        </Text>
      )}
    </group>
  )

  return billboard ? <Billboard>{panel}</Billboard> : panel
}

function CameraGizmo({ entity, isSelected, scene }) {
  const tint = scene.tintColor || '#007aff'
  // Pyramid dimensions in metres — small enough to live alongside
  // sub-metre primitives without dominating, but visible from across
  // a 3m room.
  const w = 0.10, h = 0.07, d = 0.14
  return (
    <group>
      {/* Body — slim box approximating a headset volume. */}
      <mesh>
        <boxGeometry args={[w, h, d * 0.6]} />
        <meshBasicMaterial color={isSelected ? tint : '#cfcfd1'} wireframe />
      </mesh>
      {/* Frustum lens — cone pointing -Z (camera look-direction). */}
      <mesh position={[0, 0, -d * 0.55]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[w * 0.45, d * 0.5, 16, 1, true]} />
        <meshBasicMaterial color={isSelected ? tint : '#cfcfd1'} wireframe />
      </mesh>
      {/* Direction marker — small filled tip so the user knows which
          way the camera is "looking" at a glance. */}
      <mesh position={[0, 0, -d * 0.85]}>
        <sphereGeometry args={[0.008, 12, 12]} />
        <meshBasicMaterial color={tint} />
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

// drei's useGLTF caches by URL. `isLoadableMeshUrl` (src/store/assets.js)
// decides whether entity.usdzAsset names something we can actually load —
// a .glb/.gltf path or a glTF data URL from an imported asset. Anything
// else falls back to the wireframe placeholder so USDZ-named bundle
// resources still preview the entity's footprint.
const isLoadableMesh = isLoadableMeshUrl

function GltfModel({ url, opacity }) {
  const { scene: gltfScene } = useGLTF(url)
  // Clone so multiple entities pointing at the same URL don't share
  // the same Object3D instance (which would teleport materials around).
  const cloned = useMemo(() => gltfScene.clone(true), [gltfScene])
  // Apply opacity propagation to every material in the cloned tree —
  // matches the OpacityComponent semantics our flat primitives have.
  useMemo(() => {
    cloned.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) {
          m.transparent = opacity < 1
          m.opacity = opacity
        }
      }
    })
  }, [cloned, opacity])
  return <primitive object={cloned} />
}

function UsdzPlaceholder({ entity, mat, opacity, isSelected, scene }) {
  const tint = scene.tintColor || '#007aff'
  const size = 0.1
  const loadable = isLoadableMesh(entity.usdzAsset)
  return (
    <group>
      {loadable ? (
        <Suspense fallback={
          <mesh>
            <boxGeometry args={[size, size, size]} />
            <meshBasicMaterial color="#444" transparent opacity={0.3} wireframe />
          </mesh>
        }>
          <GltfModel url={entity.usdzAsset} opacity={opacity} />
        </Suspense>
      ) : (
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
      )}
      {isSelected && (
        <mesh>
          <boxGeometry args={[size * 1.06, size * 1.06, size * 1.06]} />
          <meshBasicMaterial color={tint} transparent opacity={0.18} wireframe />
        </mesh>
      )}
      {!loadable && (
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
      )}
    </group>
  )
}

// ---- root ------------------------------------------------------------
//
// Recurses into entity children — entities can host other entities under
// any kind (anchor → model, model → group, group → anchor, etc.).
// Visibility is honoured at every level.
//
// `parentOpacity` propagates RealityKit's OpacityComponent semantics:
// the component multiplies through the entity's descendants. We pass
// the running product down so a 0.5 opacity on a group dims every child
// even if those children don't carry an OpacityComponent themselves.

export default function Entity3D({ entity, items, scene, parentOpacity = 1 }) {
  const select = useStore((s) => s.select)
  const selectedId = useStore((s) => s.selectedId)
  // Preview mode is the deployed-app simulation: anchor markers,
  // group/camera/attachment debug gizmos, and selection halos are all
  // designer-only chrome and would break the illusion. Squash them by
  // forcing `isSelected` to false for the gizmo branches.
  const isSelected = !scene.previewMode && selectedId === entity.id
  const previewMode = !!scene.previewMode

  const opComp = entity.components?.opacity
  const ownOpacity = opComp?.enabled ? (opComp.value ?? 1) : 1
  const opacity = parentOpacity * ownOpacity
  const showShadow = entity.components?.groundingShadow?.enabled
                  && entity.components?.groundingShadow?.castsShadow !== false

  // ImageBasedLightComponent — RealityKit uses the named cubemap as the
  // entity's lighting source. The browser preview can't sample that
  // resource, so we lean on a small emissive boost so the entity reads
  // as "lit by an IBL" rather than the unloaded asset turning the mesh
  // dark. Receivers don't need anything special — the parent IBL
  // already affects them through the standard scene environment.
  const iblComp = entity.components?.imageBasedLight
  const iblBoost = iblComp?.enabled
    ? Math.max(0, Math.min(2, Math.pow(2, iblComp.intensityExponent ?? 0) - 1))
    : 0

  const pos = entity.position || [0, 0, 0]
  const rot = (entity.rotation || [0, 0, 0]).map((d) => d * DEG2RAD)
  const scl = entity.scale || [1, 1, 1]

  // Include hidden children too. Their group starts with visible=false
  // (set imperatively via ref in the useEffect below) but they still
  // mount and register with the entity registry so runtime showHide
  // targets can find them. If we filtered by isEffectivelyVisible
  // here, tap/hover reveal actions targeting hidden info cards would
  // silently no-op — the card would never be in the registry to
  // resolve.
  const children = items.filter(
    (c) => c.parentId === entity.id && c.type === 'entity'
  )

  // Behaviour runtime — owns pointer handlers + per-frame ticks for the
  // entity's trigger/action list. In edit mode the hook returns null
  // handlers; pointer events fall through to the normal "select this
  // entity" gesture. In preview mode the runtime takes over the gesture
  // surface and selection is suppressed.
  const runtime = useBehaviorRuntime({ entity, scene, items })

  // Cross-entity registry — exposes our group's three.js ref under the
  // entity ID so other entities' "follow [target]", "look at [target]",
  // collision and proximity triggers can resolve targets to live
  // objects. We always register, even in edit mode, because the cost
  // is a single Map slot per entity and it keeps the cross-entity
  // wiring consistent if preview is toggled mid-session.
  useEffect(() => registerEntity(entity.id, {
    groupRef: runtime.groupRef,
    meshRef:  runtime.meshRef,
    entity
  }), [entity.id])

  // Honour `entity.visible: false` imperatively — we mount all
  // entities so the registry can resolve `showHide` targets, but
  // authored-hidden ones start with their three.js group set
  // invisible. A runtime `showHide` action then flips group.visible
  // directly; React doesn't re-render this over the top because
  // entity.visible in the store doesn't change during preview.
  useEffect(() => {
    const g = runtime.groupRef.current
    if (g) g.visible = entity.visible !== false
  }, [entity.visible])

  const onPointerDown = (e) => { e.stopPropagation(); select(entity.id) }
  // In preview mode every pointer-handler-bearing inner group swaps to
  // the runtime's handlers; in edit mode they keep the selection
  // gesture. The runtime intentionally returns null while previewMode
  // is false so this collapses to the existing behaviour.
  const interactProps = runtime.handlers || { onPointerDown }

  // The first material drives the surface; multi-material multi-submesh
  // is RealityKit territory the designer can't preview without the
  // underlying USDZ — we surface it in the inspector instead.
  const mat = (entity.materials || [])[0]

  return (
    <group
      ref={runtime.groupRef}
      position={pos}
      rotation={rot}
      scale={scl}
      userData={{ entityId: entity.id }}
    >
      {/* Render mesh / gizmo for the entity's own kind */}
      {entity.entityKind === 'model' && entity.meshType === 'text' && (
        <group {...interactProps}>
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
        <group {...interactProps}>
          <UsdzPlaceholder entity={entity} mat={mat} opacity={opacity} isSelected={isSelected} scene={scene} />
        </group>
      )}

      {entity.entityKind === 'model' &&
        entity.meshType !== 'text' &&
        entity.meshType !== 'usdz' && (
        <group {...interactProps}>
          {isSelected && <SelectionHalo entity={entity} scene={scene} />}
          <mesh ref={runtime.meshRef} castShadow={showShadow} receiveShadow>
            {meshGeometry(entity)}
            {materialNode(mat, opacity, iblBoost)}
          </mesh>
          {/* PointLightComponent analog — visionOS RealityKit lets you
              attach a light directly to an entity so its glow lights
              surrounding surfaces, not just its own material. We
              approximate by adding a <pointLight> at the entity's
              origin when `castsLight` is on. Colour picks up the
              material's emissive tint so a warm sun casts warm light. */}
          {entity.castsLight && (
            <pointLight
              color={mat?.emissiveColor || mat?.baseColor || '#ffffff'}
              intensity={entity.lightIntensity ?? 4}
              distance={entity.lightRange ?? 3.0}
              decay={2}
              castShadow={false}
            />
          )}
        </group>
      )}

      {entity.entityKind === 'anchor' && !previewMode && (
        <group onPointerDown={onPointerDown}>
          <AnchorGizmo entity={entity} isSelected={isSelected} scene={scene} />
        </group>
      )}

      {entity.entityKind === 'light' && (
        <group onPointerDown={onPointerDown}>
          {!previewMode && <LightGizmo entity={entity} isSelected={isSelected} scene={scene} />}
          <LightSource entity={entity} />
        </group>
      )}

      {entity.entityKind === 'group' && !previewMode && (
        <group onPointerDown={onPointerDown}>
          <GroupGizmo isSelected={isSelected} scene={scene} />
        </group>
      )}

      {entity.entityKind === 'camera' && !previewMode && (
        <group onPointerDown={onPointerDown}>
          <CameraGizmo entity={entity} isSelected={isSelected} scene={scene} />
        </group>
      )}

      {entity.entityKind === 'attachment' && (
        <group {...interactProps}>
          <AttachmentPanel3D entity={entity} isSelected={isSelected} scene={scene} />
        </group>
      )}

      {/* GroundingShadow is now wired through the mesh's `castShadow`
          flag (see the model branch above) — the directional key
          light projects a real soft shadow onto whatever floor mesh
          sits underneath, matching the studio decor's own shadows. */}

      {/* Recurse into children — entities nest freely. Pass the
          accumulated opacity down so an OpacityComponent on this entity
          dims its descendants (RealityKit's actual semantics). */}
      {children.map((c) => (
        <Entity3D key={c.id} entity={c} items={items} scene={scene} parentOpacity={opacity} />
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
  // Include hidden entities (visible: false) too — they mount but
  // stay invisible. This is what lets a runtime `showHide` action
  // find them in the entity registry and reveal them on demand
  // (info cards that pop up when the wearer taps a model). If we
  // filtered them out here, they'd never register and taps would
  // silently no-op.
  const children = items.filter(
    (c) => c.parentId === hostId && c.type === 'entity'
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
