import { useRef, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useStore, isEffectivelyVisible } from '../store'
import { layoutStack, computeSize } from '../layout'
import { roundedRectShape, rimRingShape } from '../shapes'
import { resolveSemantic, ptToUnits, ORNAMENT_GAP, MATERIALS } from '../appleSystem'
import { getInterFont } from '../fonts'
import Panel3D from './Panel3D'

// ---- Liquid Glass ----
// A multi-layer approximation of visionOS Liquid Glass. True refraction
// would need MeshTransmissionMaterial + FBO passes which we skip for perf.
// We instead stack:
//
//   1. Drop shadow — slightly larger, soft, behind
//   2. Back tint fill — the base frosted color at tier opacity
//   3. Top gradient — extra light along the upper half (2x thin rects so the
//      cumulative alpha creates a soft falloff)
//   4. Outer rim glow — slightly larger than the glass, dimmer, to fake a
//      soft halo when the glass floats against a busy HDRI
//   5. Inner rim highlight — bright ring along the edge
//   6. Top specular strip — thin bright band near the top
//
// Ornament capsules skip the top gradient/specular since their shape is all
// curvature and the highlights look off on tiny pills.
function LiquidGlass({
  size,
  cornerRadius,
  color,
  material = 'regular',
  schemeDark = false,
  hitEvents = {},
  capsule = false
}) {
  const [w, h] = size
  const tier = MATERIALS[material] || MATERIALS.regular
  const fillOpacity = tier.opacity
  const rimOpacity = tier.rimOpacity
  const specOpacity = tier.specularOpacity
  const shadowOpacity = tier.shadowOpacity

  const fillShape = useMemo(() => roundedRectShape(w, h, cornerRadius), [w, h, cornerRadius])

  // Softer, larger shadow — two rects stacked to fake blur.
  const shadowShapeA = useMemo(
    () => roundedRectShape(w + 0.02, h + 0.02, cornerRadius + 0.01),
    [w, h, cornerRadius]
  )
  const shadowShapeB = useMemo(
    () => roundedRectShape(w + 0.05, h + 0.05, cornerRadius + 0.025),
    [w, h, cornerRadius]
  )

  // Rim is proportional to the short side so small capsules get a thin rim.
  const shortSide = Math.min(w, h)
  const rimThickness = Math.min(ptToUnits(2.2), shortSide * 0.04)
  const rimShape = useMemo(
    () => rimRingShape(w, h, cornerRadius, rimThickness),
    [w, h, cornerRadius, rimThickness]
  )

  // Outer halo: a wider rounded rect, slightly brighter, low opacity.
  const haloShape = useMemo(
    () => rimRingShape(w + 0.04, h + 0.04, cornerRadius + 0.02, 0.02),
    [w, h, cornerRadius]
  )

  // Top specular strip — a thin pill sitting just inside the top edge.
  const specH = Math.min(ptToUnits(8), h * 0.08)
  const specW = w * 0.82
  const specY = h / 2 - rimThickness - specH / 2 - ptToUnits(2)
  const specShape = useMemo(
    () => roundedRectShape(specW, specH, specH / 2),
    [specW, specH]
  )

  // Top-half gradient fill — two stacked translucent rects (top stronger,
  // middle weaker) that compound to fake a vertical light gradient.
  const gradientTopShape = useMemo(
    () => roundedRectShape(w - rimThickness * 2, h * 0.45, cornerRadius * 0.7),
    [w, h, cornerRadius, rimThickness]
  )
  const gradientMidShape = useMemo(
    () => roundedRectShape(w - rimThickness * 2, h * 0.22, cornerRadius * 0.5),
    [w, h, cornerRadius, rimThickness]
  )

  const shadowColor = schemeDark ? '#000000' : '#1a1a1a'
  const haloColor = schemeDark ? '#ffffff' : '#ffffff'
  const rimColor = schemeDark ? '#ffffff' : '#ffffff'
  const gradColor = schemeDark ? '#ffffff' : '#ffffff'
  const specColor = '#ffffff'

  return (
    <>
      {/* 1a. Softer outer shadow */}
      <mesh position={[0, -0.012, -0.022]}>
        <shapeGeometry args={[shadowShapeB]} />
        <meshBasicMaterial color={shadowColor} transparent opacity={shadowOpacity * 0.5} />
      </mesh>
      {/* 1b. Closer shadow */}
      <mesh position={[0, -0.005, -0.016]}>
        <shapeGeometry args={[shadowShapeA]} />
        <meshBasicMaterial color={shadowColor} transparent opacity={shadowOpacity} />
      </mesh>

      {/* 2. Frosted base fill (drag target) */}
      <mesh position={[0, 0, -0.010]} {...hitEvents}>
        <shapeGeometry args={[fillShape]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={fillOpacity}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 3. Top half gradient — two stacked soft rects */}
      {!capsule && specOpacity > 0 && (
        <>
          <mesh position={[0, h * 0.27, -0.009]}>
            <shapeGeometry args={[gradientTopShape]} />
            <meshBasicMaterial
              color={gradColor}
              transparent
              opacity={(schemeDark ? 0.12 : 0.14) * (specOpacity / 0.4)}
            />
          </mesh>
          <mesh position={[0, h * 0.12, -0.008]}>
            <shapeGeometry args={[gradientMidShape]} />
            <meshBasicMaterial
              color={gradColor}
              transparent
              opacity={(schemeDark ? 0.06 : 0.08) * (specOpacity / 0.4)}
            />
          </mesh>
        </>
      )}

      {/* 4. Outer halo ring */}
      {rimOpacity > 0 && (
        <mesh position={[0, 0, -0.012]}>
          <shapeGeometry args={[haloShape]} />
          <meshBasicMaterial color={haloColor} transparent opacity={rimOpacity * 0.18} />
        </mesh>
      )}

      {/* 5. Inner rim highlight */}
      {rimOpacity > 0 && (
        <mesh position={[0, 0, -0.007]}>
          <shapeGeometry args={[rimShape]} />
          <meshBasicMaterial color={rimColor} transparent opacity={rimOpacity} />
        </mesh>
      )}

      {/* 6. Top specular strip */}
      {specOpacity > 0 && !capsule && (
        <mesh position={[0, specY, -0.006]}>
          <shapeGeometry args={[specShape]} />
          <meshBasicMaterial color={specColor} transparent opacity={specOpacity} />
        </mesh>
      )}
    </>
  )
}

// ---- Stack renderer ----

function Stack3D({ stack, localPosition, items }) {
  const scene = useStore((s) => s.scene)
  const selectedId = useStore((s) => s.selectedId)
  const select = useStore((s) => s.select)
  const isSelected = selectedId === stack.id

  const [w, h] = computeSize(stack, items)
  const childPositions = useMemo(() => layoutStack(stack, items), [stack, items])
  const children = items.filter((c) => c.parentId === stack.id && isEffectivelyVisible(items, c.id))

  const hasBackground = stack.ornament != null || stack.background != null
  const bgRadius = stack.ornament ? Math.min(w, h) / 2 : ptToUnits(12)

  const outlineShape = useMemo(
    () => roundedRectShape(w + 0.025, h + 0.025, (stack.ornament ? bgRadius : ptToUnits(12)) + 0.012),
    [w, h, bgRadius, stack.ornament]
  )

  const bgColor = (() => {
    if (!hasBackground) return null
    const token = stack.background || 'glassThick'
    if (token.startsWith('#')) return token
    return resolveSemantic(token, scene.designScheme || 'light')
  })()

  const onDown = (e) => { e.stopPropagation(); select(stack.id) }

  return (
    <group position={localPosition || [0, 0, 0]}>
      {isSelected && (
        <mesh position={[0, 0, -0.02]}>
          <shapeGeometry args={[outlineShape]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.8} />
        </mesh>
      )}

      {hasBackground && (
        <LiquidGlass
          size={[w, h]}
          cornerRadius={bgRadius}
          color={bgColor}
          material={stack.material || 'regular'}
          schemeDark={scene.designScheme === 'dark'}
          hitEvents={{ onPointerDown: onDown }}
          capsule={stack.ornament != null}
        />
      )}

      {/* Scrollbar indicator for scrollable stacks */}
      {stack.scrollable && (
        <mesh position={[w / 2 - 0.02, 0, 0.003]}>
          <planeGeometry args={[0.02, h * 0.5]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.5} />
        </mesh>
      )}

      {/* Section header/footer text */}
      {stack.stackType === 'section' && stack.sectionHeader && (
        <Text
          position={[-w / 2 + ptToUnits(16), h / 2 - ptToUnits(16), 0.003]}
          font={getInterFont('semibold')}
          fontSize={ptToUnits(13)}
          color={resolveSemantic('secondary', scene.designScheme || 'light')}
          anchorX="left"
          anchorY="middle"
          maxWidth={w * 0.9}
          textAlign="left"
        >
          {stack.sectionHeader.toUpperCase()}
        </Text>
      )}
      {stack.stackType === 'section' && stack.sectionFooter && (
        <Text
          position={[-w / 2 + ptToUnits(16), -h / 2 + ptToUnits(12), 0.003]}
          font={getInterFont('regular')}
          fontSize={ptToUnits(11)}
          color={resolveSemantic('secondary', scene.designScheme || 'light')}
          anchorX="left"
          anchorY="middle"
          maxWidth={w * 0.9}
          textAlign="left"
        >
          {stack.sectionFooter}
        </Text>
      )}

      {/* Disclosure label + chevron */}
      {stack.stackType === 'disclosure' && (
        <group position={[0, h / 2 - ptToUnits(18), 0.003]}>
          <Text
            position={[-w / 2 + ptToUnits(28), 0, 0]}
            font={getInterFont('semibold')}
            fontSize={ptToUnits(15)}
            color={resolveSemantic('primary', scene.designScheme || 'light')}
            anchorX="left"
            anchorY="middle"
          >
            {stack.disclosureLabel || 'Section'}
          </Text>
          <Text
            position={[-w / 2 + ptToUnits(10), 0, 0]}
            fontSize={ptToUnits(12)}
            color={resolveSemantic('secondary', scene.designScheme || 'light')}
            anchorX="left"
            anchorY="middle"
          >
            {stack.expanded ? '▾' : '▸'}
          </Text>
        </group>
      )}

      {/* NavStack title */}
      {stack.stackType === 'navstack' && stack.navTitle && (
        <Text
          position={[0, h / 2 - ptToUnits(24), 0.003]}
          font={getInterFont('bold')}
          fontSize={ptToUnits(20)}
          color={resolveSemantic('primary', scene.designScheme || 'light')}
          anchorX="center"
          anchorY="middle"
          maxWidth={w * 0.85}
        >
          {stack.navTitle}
        </Text>
      )}

      {children.map((c) => {
        const pos = childPositions.get(c.id) || [0, 0, 0]
        if (c.type === 'stack') {
          return <Stack3D key={c.id} stack={c} localPosition={pos} items={items} />
        }
        return <Panel3D key={c.id} panel={c} localPosition={pos} />
      })}
    </group>
  )
}

// ---- Window renderer ----

function Window3D({ window: win, items }) {
  const scene = useStore((s) => s.scene)
  const selectedId = useStore((s) => s.selectedId)
  const select = useStore((s) => s.select)
  const updateItem = useStore((s) => s.updateItem)
  const setDragging = useStore((s) => s.setDragging)
  const { camera, gl, invalidate } = useThree()
  const isSelected = selectedId === win.id
  const dragData = useRef(null)
  const plane = useMemo(() => new THREE.Plane(), [])
  const intersect = useMemo(() => new THREE.Vector3(), [])
  const offset = useMemo(() => new THREE.Vector3(), [])

  const [w, h] = win.size
  const cornerR = win.cornerRadius ?? 0
  const fillColor = win.colorToken
    ? resolveSemantic(win.colorToken, scene.designScheme || 'light')
    : (win.color || '#f2f2f7')

  const outlineShape = useMemo(
    () => roundedRectShape(w + 0.025, h + 0.025, cornerR + 0.015),
    [w, h, cornerR]
  )

  const onPointerDown = (e) => {
    e.stopPropagation()
    select(win.id)
    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    plane.setFromNormalAndCoplanarPoint(camDir, new THREE.Vector3(...win.position))
    if (e.ray.intersectPlane(plane, intersect)) {
      offset.copy(intersect).sub(new THREE.Vector3(...win.position))
      dragData.current = { dragging: true }
      setDragging(true)
      gl.domElement.style.cursor = 'grabbing'
      try { e.target.setPointerCapture(e.pointerId) } catch {}
    }
  }
  const onPointerMove = (e) => {
    if (!dragData.current?.dragging) return
    e.stopPropagation()
    if (e.ray.intersectPlane(plane, intersect)) {
      const p = intersect.clone().sub(offset)
      updateItem(win.id, { position: [p.x, p.y, p.z] })
      invalidate()
    }
  }
  const onPointerUp = (e) => {
    if (dragData.current?.dragging) {
      dragData.current = null
      setDragging(false)
      gl.domElement.style.cursor = 'auto'
      try { e.target.releasePointerCapture(e.pointerId) } catch {}
    }
  }

  const allChildren = items.filter((c) => c.parentId === win.id && isEffectivelyVisible(items, c.id))
  const presentationTypes = ['sheet', 'popover', 'alert']
  const contentChildren = allChildren.filter((c) =>
    !(c.type === 'stack' && c.ornament) && !(c.type === 'panel' && presentationTypes.includes(c.panelType))
  )
  const ornamentChildren = allChildren.filter((c) => c.type === 'stack' && c.ornament)
  const presentationChildren = allChildren.filter((c) => c.type === 'panel' && presentationTypes.includes(c.panelType))
  const gap = ptToUnits(ORNAMENT_GAP)

  // Stack multiple ornaments on the same edge instead of overlapping.
  const edgeOffsets = { leading: 0, trailing: 0, top: 0, bottom: 0 }
  const ornPositions = new Map()
  for (const orn of ornamentChildren) {
    const [ow, oh] = computeSize(orn, items)
    const edge = orn.ornament
    let ox = 0, oy = 0

    if (edge === 'leading') {
      ox = -(w / 2 + gap + ow / 2) - edgeOffsets.leading
      edgeOffsets.leading += ow + gap * 0.5
    } else if (edge === 'trailing') {
      ox = (w / 2 + gap + ow / 2) + edgeOffsets.trailing
      edgeOffsets.trailing += ow + gap * 0.5
    } else if (edge === 'top') {
      oy = (h / 2 + gap + oh / 2) + edgeOffsets.top
      edgeOffsets.top += oh + gap * 0.5
    } else if (edge === 'bottom') {
      oy = -(h / 2 + gap + oh / 2) - edgeOffsets.bottom
      edgeOffsets.bottom += oh + gap * 0.5
    }

    ornPositions.set(orn.id, [ox, oy, 0.015])
  }

  return (
    <group position={win.position}>
      {isSelected && (
        <mesh position={[0, 0, -0.02]}>
          <shapeGeometry args={[outlineShape]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.9} />
        </mesh>
      )}

      <LiquidGlass
        size={[w, h]}
        cornerRadius={cornerR}
        color={fillColor}
        material={win.material || 'regular'}
        schemeDark={scene.designScheme === 'dark'}
        hitEvents={{
          onPointerDown,
          onPointerMove,
          onPointerUp
        }}
      />

      {/* Content stacks — centered in window */}
      {contentChildren.map((c) => {
        const pos = c.type === 'stack' ? [0, 0, 0.005] : (c.position || [0, 0, 0.005])
        if (c.type === 'stack') {
          return <Stack3D key={c.id} stack={c} localPosition={pos} items={items} />
        }
        return <Panel3D key={c.id} panel={c} localPosition={pos} />
      })}

      {/* Ornaments — pinned to edges */}
      {ornamentChildren.map((o) => (
        <Stack3D
          key={o.id}
          stack={o}
          localPosition={ornPositions.get(o.id)}
          items={items}
        />
      ))}

      {/* Presentation overlays (sheet / alert / popover) — render above everything */}
      {presentationChildren.length > 0 && (
        <>
          {/* Dimming backdrop */}
          <mesh position={[0, 0, 0.04]}>
            <planeGeometry args={[w * 1.2, h * 1.2]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.35} />
          </mesh>
          {/* Each presentation child */}
          {presentationChildren.map((p) => {
            let py = 0
            if (p.panelType === 'sheet') {
              py = p.sheetDetent === 'medium' ? -h * 0.15 : 0
            }
            return <Panel3D key={p.id} panel={p} localPosition={[0, py, 0.05]} />
          })}
        </>
      )}
    </group>
  )
}

// ---- Root ----

export default function SceneTree() {
  const items = useStore((s) => s.items)
  const windows = items.filter((it) => it.type === 'window' && it.visible !== false)
  return (
    <>
      {windows.map((w) => (
        <Window3D key={w.id} window={w} items={items} />
      ))}
    </>
  )
}
