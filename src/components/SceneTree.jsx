import { useRef, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useStore, isEffectivelyVisible } from '../store'
import { layoutStack, computeSize, resolvedChildSizes } from '../layout'
import { roundedRectShape } from '../shapes'
import { resolveSemantic, ptToUnits, ORNAMENT_GAP, SF_SYMBOLS } from '../appleSystem'

const getSymbolGlyph = (name) => SF_SYMBOLS[name]?.glyph || '\u25CF'
import { getInterFont } from '../fonts'
import Panel3D from './Panel3D'

// ---- Plane fill ----
// Earlier we layered a six-pass approximation of visionOS Liquid Glass
// (shadow, fill, gradient, halo, rim, specular). The multi-plane stack read
// well head-on but produced visible parallax banding in the 3D preview — a
// mix of z-fighting at tilted angles and layer edges that looked like
// artifacts. We've dropped it in favour of a flat plane fill with a single
// soft drop shadow, which is what the user asked for (plain colour, no
// glass). Semantic colour tokens still resolve per-scheme so the fill picks
// up the dark-mode palette.
function LiquidGlass({
  size,
  cornerRadius,
  color,
  hitEvents = {}
  // `material`, `schemeDark`, `capsule` are accepted (but unused) for
  // call-site compatibility with the previous glass implementation.
}) {
  const [w, h] = size
  const fillShape = useMemo(() => roundedRectShape(w, h, cornerRadius), [w, h, cornerRadius])
  const shadowShape = useMemo(
    () => roundedRectShape(w + 0.04, h + 0.04, cornerRadius + 0.02),
    [w, h, cornerRadius]
  )

  return (
    <>
      {/* Contact shadow to keep the plane readable against any background */}
      <mesh position={[0, -0.01, -0.02]}>
        <shapeGeometry args={[shadowShape]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} />
      </mesh>

      {/* Solid fill (drag / click target) */}
      <mesh position={[0, 0, -0.010]} {...hitEvents}>
        <shapeGeometry args={[fillShape]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}

// ---- Stack renderer ----

function Stack3D({ stack, localPosition, items, resolvedSize }) {
  const scene = useStore((s) => s.scene)
  const selectedId = useStore((s) => s.selectedId)
  const select = useStore((s) => s.select)
  const isSelected = selectedId === stack.id

  // `resolvedSize` comes from the parent's `resolvedChildSizes` — it already
  // accounts for `widthMode: 'fill'` / `heightMode: 'fill'` expansion. Fall
  // back to the stack's own intrinsic size when we're a top-level stack
  // (no parent resolving us). We pass the resolved size as an override to
  // the layout engine so fill children inside us get leftover space
  // relative to our actual rendered size, not our intrinsic one.
  const intrinsic = computeSize(stack, items)
  const w = resolvedSize?.[0] ?? intrinsic[0]
  const h = resolvedSize?.[1] ?? intrinsic[1]
  const outerSize = resolvedSize || null
  const childPositions = useMemo(() => layoutStack(stack, items, outerSize), [stack, items, outerSize?.[0], outerSize?.[1]])
  const childSizes     = useMemo(() => resolvedChildSizes(stack, items, outerSize), [stack, items, outerSize?.[0], outerSize?.[1]])
  const children = items.filter((c) => c.parentId === stack.id && isEffectivelyVisible(items, c.id))

  const hasBackground = stack.ornament != null || stack.background != null
  // Allow a stack to override its background corner radius (e.g. the
  // separated NavigationSplitView sidebar uses a 30pt dialogue radius).
  const bgRadius = stack.ornament
    ? Math.min(w, h) / 2
    : (stack.cornerRadius != null ? stack.cornerRadius : ptToUnits(12))

  const outlineShape = useMemo(
    () => roundedRectShape(w + 0.025, h + 0.025, bgRadius + 0.012),
    [w, h, bgRadius]
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
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.4} />
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
      {stack.stackType === 'navigationStack' && stack.navTitle && (
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

      {/* TabView: auto-render bottom tab bar with clickable tabs */}
      {stack.stackType === 'tabView' && <TabBar3D stack={stack} children={children} w={w} h={h} scene={scene} />}

      {children.map((c) => {
        // In a TabView, only the active Tab is positioned by layoutStack.
        const pos = childPositions.get(c.id)
        if (!pos) return null
        const resolved = childSizes.get(c.id)
        if (c.type === 'stack') {
          return <Stack3D key={c.id} stack={c} localPosition={pos} items={items} resolvedSize={resolved} />
        }
        // Pass the resolved size so fill-width text renders at the stack's
        // inner width rather than its intrinsic content width.
        return <Panel3D key={c.id} panel={c} localPosition={pos} resolvedSize={resolved} />
      })}
    </group>
  )
}

// Auto-rendered tab bar at the bottom of a TabView stack.
// Shows each Tab's label + icon, highlights the active one, clickable.
function TabBar3D({ stack, children, w, h, scene }) {
  const updateItem = useStore((s) => s.updateItem)
  const tabs = children.filter((c) => c.stackType === 'tab')
  if (tabs.length === 0) return null

  const barH = ptToUnits(64)
  const barY = -h / 2 + barH / 2
  const tabW = ptToUnits(80)
  const activeIdx = stack.activeTab ?? 0
  const tint = scene.tintColor || '#007aff'
  const dimColor = resolveSemantic('secondary', scene.designScheme || 'light')

  return (
    <group position={[0, barY, 0.01]}>
      {/* Bar background */}
      <mesh>
        <shapeGeometry args={[roundedRectShape(w, barH, barH / 2)]} />
        <meshBasicMaterial
          color={resolveSemantic('glassThick', scene.designScheme || 'light')}
          transparent
          opacity={0.88}
        />
      </mesh>
      {/* Tabs */}
      {tabs.map((tab, i) => {
        const xOffset = -((tabs.length - 1) * tabW) / 2 + i * tabW
        const active = i === activeIdx
        return (
          <group
            key={tab.id}
            position={[xOffset, 0, 0.005]}
            onPointerDown={(e) => {
              e.stopPropagation()
              updateItem(stack.id, { activeTab: i })
            }}
          >
            {tab.tabIcon && (
              <Text
                position={[0, ptToUnits(8), 0.001]}
                fontSize={ptToUnits(18)}
                color={active ? tint : dimColor}
                anchorX="center"
                anchorY="middle"
              >
                {getSymbolGlyph(tab.tabIcon)}
              </Text>
            )}
            <Text
              position={[0, -ptToUnits(14), 0.001]}
              font={getInterFont('medium')}
              fontSize={ptToUnits(10)}
              color={active ? tint : dimColor}
              anchorX="center"
              anchorY="middle"
              maxWidth={tabW * 0.9}
            >
              {tab.tabLabel || tab.name}
            </Text>
          </group>
        )
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

  // Stack multiple ornaments on the same edge instead of overlapping. Each
  // ornament may declare widthMode/heightMode 'fill' to match the window's
  // corresponding axis (e.g. a top toolbar that spans the full window width).
  const edgeOffsets = { leading: 0, trailing: 0, top: 0, bottom: 0 }
  const ornPositions = new Map()
  const ornSizes = new Map()
  for (const orn of ornamentChildren) {
    const intrinsic = computeSize(orn, items)
    const edge = orn.ornament
    const isHorizEdge = edge === 'top' || edge === 'bottom'
    const ow = (orn.widthMode  === 'fill' && isHorizEdge) ? w : intrinsic[0]
    const oh = (orn.heightMode === 'fill' && !isHorizEdge) ? h : intrinsic[1]
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
    ornSizes.set(orn.id, [ow, oh])
  }

  return (
    <group position={win.position}>
      {isSelected && (
        <mesh position={[0, 0, -0.02]}>
          <shapeGeometry args={[outlineShape]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.45} />
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

      {/* Depth layering for the 3D preview (volume mode only). visionOS
          parallaxes three tiers: the window sits at the back, content stacks
          float just in front, and chrome (ornaments, tab bars, nav bars) is
          furthest forward. In window mode we stay flat so the orthographic-
          feeling view doesn't shift. */}
      {(() => {
        // Window-level inner padding — fill children are clamped to the padded
        // area so content doesn't bleed to the window edge. Matches SwiftUI's
        // `.padding(window)`-style inset; default 14pt per Apple's 1636×1142
        // reference layout.
        const padU = ptToUnits(win.padding ?? 14)
        const innerW = Math.max(0, w - padU * 2)
        const innerH = Math.max(0, h - padU * 2)
        return contentChildren.map((c) => {
          const chromeStack = c.type === 'stack' && (c.stackType === 'tabView' || c.stackType === 'navigationStack')
          const zStack = scene.preview3D ? (chromeStack ? 0.18 : 0.08) : 0.005
          const zPanel = scene.preview3D ? 0.08 : 0.005
          const pos = c.type === 'stack' ? [0, 0, zStack] : (c.position || [0, 0, zPanel])
          if (c.type === 'stack') {
            const intrinsic = computeSize(c, items)
            const fillW = c.widthMode  === 'fill'
            const fillH = c.heightMode === 'fill'
            // A joined NavigationSplitView ignores the window's inner padding
            // so the sidebar runs flush with the window's left/top/bottom
            // edges — that's Apple's own default (the split view becomes the
            // window's chrome, not inset content).
            const bypassPadding = c.splitStyle === 'joined'
            const fitW = bypassPadding ? w : innerW
            const fitH = bypassPadding ? h : innerH
            const resolved = (fillW || fillH)
              ? [fillW ? fitW : intrinsic[0], fillH ? fitH : intrinsic[1]]
              : undefined
            return <Stack3D key={c.id} stack={c} localPosition={pos} items={items} resolvedSize={resolved} />
          }
          return <Panel3D key={c.id} panel={c} localPosition={pos} />
        })
      })()}

      {/* Ornaments — pinned to edges, top depth tier in 3D preview */}
      {ornamentChildren.map((o) => {
        const basePos = ornPositions.get(o.id)
        const z = scene.preview3D ? 0.18 : 0.015
        const pos = [basePos[0], basePos[1], z]
        return (
          <Stack3D
            key={o.id}
            stack={o}
            localPosition={pos}
            items={items}
            resolvedSize={ornSizes.get(o.id)}
          />
        )
      })}

      {/* Presentation overlays (sheet / alert / popover) — rendered above
          the window content. In SwiftUI these modals are always *contained*
          by their parent window, so we clamp both the dimming backdrop and
          the panel itself to the window bounds (minus a small inset) rather
          than letting them bleed past the edge. */}
      {presentationChildren.length > 0 && (
        <>
          {/* Dimming backdrop — covers exactly the window interior. */}
          <mesh position={[0, 0, 0.04]}>
            <planeGeometry args={[w, h]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.35} />
          </mesh>
          {/* Each presentation child */}
          {presentationChildren.map((p) => {
            // SwiftUI sheets get a small margin on every side rather than
            // pinning to the window edges. 8% inset reads as a comfortable
            // modal frame; the content still lays out at its declared size
            // until that exceeds the window minus insets, then we clamp.
            const maxW = w * 0.92
            const maxH = h * 0.92
            const [pw, ph] = Array.isArray(p.size) ? p.size : [maxW, maxH]
            const clamped = [Math.min(pw, maxW), Math.min(ph, maxH)]
            let py = 0
            if (p.panelType === 'sheet') {
              // `.presentationDetents(.medium)` pushes the sheet toward the
              // bottom; otherwise sheets center inside the window.
              py = p.sheetDetent === 'medium' ? -(h - clamped[1]) / 2 * 0.9 : 0
            }
            return (
              <Panel3D
                key={p.id}
                panel={p}
                localPosition={[0, py, 0.05]}
                resolvedSize={clamped}
              />
            )
          })}
        </>
      )}
    </group>
  )
}

// ---- Page tab navigation bar (floating, left of the primary window) ----
// visionOS-style vertical pill of page tabs. Appears whenever there are two
// or more Tabs in the scene — clicking an icon switches the active page.
// Height scales with tab count so it never wastes space.

function PageTabBar3D({ tabs, activeTabId, anchorPosition, anchorWidth, anchorHeight, scene, selectTab }) {
  const tabW = ptToUnits(56)
  const tabH = ptToUnits(56)
  const padding = ptToUnits(10)
  const gap = ptToUnits(6)
  const barW = tabW + padding * 2
  const barH = tabs.length * tabH + (tabs.length - 1) * gap + padding * 2
  const tint = scene.tintColor || '#007aff'
  const dimColor = resolveSemantic('secondary', scene.designScheme || 'light')
  const gapFromWindow = ptToUnits(24)

  // Pin to the left edge of the anchor window, vertically centered.
  const x = anchorPosition[0] - anchorWidth / 2 - gapFromWindow - barW / 2
  const y = anchorPosition[1]
  const z = anchorPosition[2]

  const bgShape = roundedRectShape(barW, barH, Math.min(barW, barH) / 2)

  return (
    <group position={[x, y, z]}>
      {/* Liquid glass background */}
      <mesh position={[0, 0, -0.005]}>
        <shapeGeometry args={[bgShape]} />
        <meshBasicMaterial
          color={resolveSemantic('glassThick', scene.designScheme || 'light')}
          transparent
          opacity={0.88}
        />
      </mesh>

      {/* Stack the tabs top → bottom so the order matches the layers panel. */}
      {tabs.map((tab, i) => {
        const yOffset = barH / 2 - padding - tabH / 2 - i * (tabH + gap)
        const active = tab.id === activeTabId
        const glyph = getSymbolGlyph(tab.icon)
        const chipShape = roundedRectShape(tabW, tabH, tabH / 2)
        return (
          <group
            key={tab.id}
            position={[0, yOffset, 0.005]}
            onPointerDown={(e) => {
              e.stopPropagation()
              selectTab(tab.id)
            }}
          >
            {active && (
              <mesh position={[0, 0, -0.001]}>
                <shapeGeometry args={[chipShape]} />
                <meshBasicMaterial color={tint} transparent opacity={0.18} />
              </mesh>
            )}
            <Text
              position={[0, ptToUnits(6), 0.001]}
              fontSize={ptToUnits(20)}
              color={active ? tint : dimColor}
              anchorX="center"
              anchorY="middle"
            >
              {glyph}
            </Text>
            <Text
              position={[0, -ptToUnits(14), 0.001]}
              font={getInterFont('medium')}
              fontSize={ptToUnits(9)}
              color={active ? tint : dimColor}
              anchorX="center"
              anchorY="middle"
              maxWidth={tabW * 0.92}
            >
              {tab.name}
            </Text>
          </group>
        )
      })}
    </group>
  )
}

// ---- Root ----

export default function SceneTree() {
  const items = useStore((s) => s.items)
  const activeTabId = useStore((s) => s.activeTabId)
  const scene = useStore((s) => s.scene)
  const selectTab = useStore((s) => s.selectTab)

  // Only windows belonging to the active Tab render. Inactive tabs keep their
  // windows in the data but don't paint in the 3D scene.
  const windows = items.filter(
    (it) =>
      it.type === 'window' &&
      it.visible !== false &&
      it.parentId === activeTabId
  )
  const tabs = items.filter((it) => it.type === 'tab')

  // Anchor the page-tab sidebar to the leftmost window of the active tab so
  // it reads as "attached to the window group" — matching the user's mental
  // model of "tab nav bar on the left of the window".
  const anchor = windows.reduce(
    (acc, w) => (!acc || w.position[0] < acc.position[0] ? w : acc),
    null
  )

  return (
    <>
      {windows.map((w) => (
        <Window3D key={w.id} window={w} items={items} />
      ))}
      {tabs.length >= 2 && anchor && (
        <PageTabBar3D
          tabs={tabs}
          activeTabId={activeTabId}
          anchorPosition={anchor.position}
          anchorWidth={anchor.size[0]}
          anchorHeight={anchor.size[1]}
          scene={scene}
          selectTab={selectTab}
        />
      )}
    </>
  )
}
