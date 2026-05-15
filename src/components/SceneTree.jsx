import { useRef, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useStore, isEffectivelyVisible } from '../store'
import { layoutStack, computeSize, resolvedChildSizes } from '../layout'
import { roundedRectShape, unevenRoundedRectShape } from '../shapes'
import { resolveSemantic, ptToUnits, ORNAMENT_GAP, SF_SYMBOLS } from '../appleSystem'

const getSymbolGlyph = (name) => SF_SYMBOLS[name]?.glyph || '\u25CF'
import { getInterFont } from '../fonts'
import Panel3D from './Panel3D'
import { EntityChildren } from './Entity3D'

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
  // Optional per-corner radii — `[topLeft, topRight, bottomRight, bottomLeft]`
  // matching SwiftUI's `UnevenRoundedRectangle(_:_:_:_:)`. When set the
  // even `cornerRadius` is ignored and the plate is cut with the four
  // distinct radii instead. Used by the joined NavigationSplitView
  // sidebar so its right edge butts flush against the detail pane.
  cornerRadii,
  color,
  fillOpacity = 0.92,
  hitEvents = {}
  // `material`, `schemeDark`, `capsule` are accepted (but unused) for
  // call-site compatibility with the previous glass implementation.
}) {
  const [w, h] = size
  const fillShape = useMemo(() => {
    if (Array.isArray(cornerRadii)) {
      const [tl, tr, br, bl] = cornerRadii
      return unevenRoundedRectShape(w, h, tl, tr, bl, br)
    }
    return roundedRectShape(w, h, cornerRadius)
  }, [w, h, cornerRadius, cornerRadii?.[0], cornerRadii?.[1], cornerRadii?.[2], cornerRadii?.[3]])
  // No drop shadow — visionOS glass plates rely on translucency and
  // the environment lighting for their depth cue, not a contact
  // shadow. The earlier rectangular shadow also bulged past uneven-
  // corner sidebars (joined NavigationSplitView) creating a visible
  // "ghost" silhouette. Dropping it cleans up the chrome and matches
  // the HIG.
  return (
    <mesh position={[0, 0, -0.001]} renderOrder={-1} {...hitEvents}>
      <shapeGeometry args={[fillShape]} />
      <meshBasicMaterial
        color={color}
        side={THREE.DoubleSide}
        transparent={fillOpacity < 1}
        opacity={fillOpacity}
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
    </mesh>
  )
}

// ---- Stack renderer ----

function Stack3D({ stack, localPosition, items, resolvedSize }) {
  const scene = useStore((s) => s.scene)
  const selectedId = useStore((s) => s.selectedId)
  const select = useStore((s) => s.select)
  // Hide the selection halo and suppress click-to-select while preview
  // is running — the wearer's view should read as the deployed app,
  // not the editor.
  const isSelected = !scene.previewMode && selectedId === stack.id

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
  const children = items.filter((c) => {
    if (c.parentId !== stack.id) return false
    if (!isEffectivelyVisible(items, c.id)) return false
    // Preview-mode NavigationSplitView routing: only the destination
    // whose `navTag` matches the parent's `activeDestination` renders.
    // Editor mode honours the user's per-destination visibility flags
    // so all toggled-on destinations stay visible side-by-side for
    // authoring. Sidebar-slot children are always shown.
    if (scene.previewMode && stack.splitStyle && c.slot === 'detail') {
      const active = stack.activeDestination
      if (active && c.navTag && c.navTag !== active) return false
    }
    return true
  })

  const hasBackground = stack.ornament != null || stack.background != null
  // Allow a stack to override its background corner radius (e.g. the
  // separated NavigationSplitView sidebar uses a 30pt dialogue radius).
  const bgRadius = stack.ornament
    ? Math.min(w, h) / 2
    : (stack.cornerRadius != null ? stack.cornerRadius : ptToUnits(12))

  // Same hair-thin selection ring metric as windows — keeps the
  // indicator readable on small stacks without the previous fat halo.
  const stackOutlinePad = Math.max(w, h) * 0.0025
  const outlineShape = useMemo(
    () => roundedRectShape(w + stackOutlinePad, h + stackOutlinePad, bgRadius + stackOutlinePad / 2),
    [w, h, bgRadius, stackOutlinePad]
  )

  const bgColor = (() => {
    if (!hasBackground) return null
    const token = stack.background || 'glassThick'
    if (token.startsWith('#')) return token
    return resolveSemantic(token, scene.designScheme || 'light')
  })()

  const onDown = (e) => {
    e.stopPropagation()
    if (scene.previewMode) return
    select(stack.id)
  }

  // NavigationSplitView wheel scroll. Total content height of the
  // sidebar slot vs available height (≈ inner window height) drives
  // the max scroll. Persisted on the stack so the user's scroll state
  // round-trips through undo and serialization. Wheel events bubble
  // from any descendant of the NavSplitView group up to this handler
  // — so row clicks still work because `onPointerDown` and `onWheel`
  // are separate event channels in three-fiber.
  const updateItem = useStore((s) => s.updateItem)
  const onSidebarWheel = (e) => {
    if (!stack.splitStyle) return
    // Only handle wheel when the pointer is over the sidebar half of
    // the NavSplitView. Sidebar is the leftmost 320pt.
    const localX = e.point.x - (localPosition?.[0] || 0)
    const sidebarRightEdge = -w / 2 + ptToUnits(320)
    if (localX > sidebarRightEdge) return
    // Compute total sidebar content height to clamp scroll.
    const sidebarKids = items.filter((c) => c.parentId === stack.id && (c.slot || 'sidebar') === 'sidebar' && isEffectivelyVisible(items, c.id))
    let total = 0
    let firstSection = true
    for (const c of sidebarKids) {
      const isSec = c.type === 'panel' && c.panelType === 'text' &&
                    typeof c.name === 'string' && /Section .* Header/.test(c.name)
      if (isSec && !firstSection) total += ptToUnits(12)
      if (isSec) firstSection = false
      const [, ch] = computeSize(c, items)
      total += ch
    }
    const maxScroll = Math.max(0, total - h)
    if (maxScroll === 0) return
    e.stopPropagation()
    const cur = Number(stack.sidebarScrollY) || 0
    const next = Math.max(0, Math.min(maxScroll, cur + e.deltaY * 0.0015))
    if (Math.abs(next - cur) > 0.0001) {
      updateItem(stack.id, { sidebarScrollY: next })
    }
  }

  return (
    <group position={localPosition || [0, 0, 0]} onWheel={stack.splitStyle ? onSidebarWheel : undefined}>
      {isSelected && (
        <mesh position={[0, 0, -0.02]}>
          <shapeGeometry args={[outlineShape]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.28} />
        </mesh>
      )}

      {hasBackground && (
        <LiquidGlass
          size={[w, h]}
          cornerRadius={bgRadius}
          cornerRadii={stack.cornerRadii}
          color={bgColor}
          material={stack.material || 'regular'}
          schemeDark={scene.designScheme === 'dark'}
          hitEvents={{ onPointerDown: onDown }}
          capsule={stack.ornament != null}
        />
      )}

      {/* NavigationSplitView sidebar plate. The wizard build dropped
          the wrapper Sidebar Stack (it carried this plate before), so
          we render the lighter-gray panel here. Joined rounds only the
          leading edges (`unevenRoundedRectShape(tl, tr, bl, br)` — not
          an array!); separated rounds all four. We sit it 0.005 above
          the NavSplitView's own z plane so it stacks cleanly above the
          window plate but well behind the sidebar items. */}
      {stack.splitStyle && (() => {
        const sideW = ptToUnits(320)
        const separated = stack.splitStyle === 'separated'
        const r = ptToUnits(30)
        // unevenRoundedRectShape takes (w, h, tl, tr, bl, br) — flat
        // args, NOT an array. Joined sidebar rounds the leading edges
        // (top-left + bottom-left), the trailing edges stay flush.
        const shape = separated
          ? roundedRectShape(sideW, h, r)
          : unevenRoundedRectShape(sideW, h, r, 0, r, 0)
        return (
          <mesh position={[-w / 2 + sideW / 2, 0, 0.002]} renderOrder={-1}>
            <shapeGeometry args={[shape]} />
            <meshBasicMaterial color="#d8d8dc" depthWrite={false} />
          </mesh>
        )
      })()}

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
  // Suppress the window's selection halo in preview mode — it's a
  // designer affordance and would render as a translucent blue panel
  // hovering inside the volume from the wearer's view.
  const isSelected = !scene.previewMode && selectedId === win.id
  const dragData = useRef(null)
  const plane = useMemo(() => new THREE.Plane(), [])
  const intersect = useMemo(() => new THREE.Vector3(), [])
  const offset = useMemo(() => new THREE.Vector3(), [])

  const [w, h] = win.size
  const cornerR = win.cornerRadius ?? 0
  const fillColor = win.colorToken
    ? resolveSemantic(win.colorToken, scene.designScheme || 'light')
    : (win.color || '#f2f2f7')

  // Outline padding scales with window size. Tuned to read as a thin
  // selection ring rather than a fat halo — 0.25% of the longer side
  // (instead of the previous 0.8%) keeps the indicator visible at a
  // distance without overpowering the plate.
  const outlinePad = Math.max(w, h) * 0.0025
  const outlineShape = useMemo(
    () => roundedRectShape(w + outlinePad, h + outlinePad, cornerR + outlinePad / 2),
    [w, h, cornerR, outlinePad]
  )

  const onPointerDown = (e) => {
    e.stopPropagation()
    // Preview mode runs the canvas as the deployed app — the wearer
    // can't physically reposition windows from a pointer drag, so we
    // suppress both selection and drag while previewMode is active.
    // Without this the user could "design" while previewing, which
    // defeats the purpose of the mode.
    if (scene.previewMode) return
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
  // Entities can land directly under a window when the window is volumetric
  // (the window itself acts as a RealityView container). Rendered after
  // content/ornaments at the window's own origin.
  const entityChildren = allChildren.filter((c) => c.type === 'entity')
  const contentChildren = allChildren.filter((c) =>
    c.type !== 'entity' &&
    !(c.type === 'stack' && c.ornament) &&
    !(c.type === 'panel' && presentationTypes.includes(c.panelType))
  )
  const ornamentChildren = allChildren.filter((c) => c.type === 'stack' && c.ornament)
  const presentationChildren = allChildren.filter((c) => c.type === 'panel' && presentationTypes.includes(c.panelType))
  // Per WWDC23 #10076, visionOS ornaments *overlap* the window plate
  // by 20pt rather than floating outside it with a gap. ORNAMENT_GAP
  // is the overlap distance, used as a NEGATIVE offset against the
  // edge so the ornament's near edge crosses 20pt into the window.
  const overlap = ptToUnits(ORNAMENT_GAP)

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

    // Each edge: position the ornament so its INNER edge crosses the
    // window edge by `overlap` (20pt). For a bottom ornament, its top
    // is `overlap` above the window's bottom edge; its center sits at
    // `-(h/2 - overlap + oh/2)`. Same idea for the other three edges.
    if (edge === 'leading') {
      ox = -(w / 2 - overlap + ow / 2) - edgeOffsets.leading
      edgeOffsets.leading += ow
    } else if (edge === 'trailing') {
      ox = (w / 2 - overlap + ow / 2) + edgeOffsets.trailing
      edgeOffsets.trailing += ow
    } else if (edge === 'top') {
      oy = (h / 2 - overlap + oh / 2) + edgeOffsets.top
      edgeOffsets.top += oh
    } else if (edge === 'bottom') {
      oy = -(h / 2 - overlap + oh / 2) - edgeOffsets.bottom
      edgeOffsets.bottom += oh
    }

    ornPositions.set(orn.id, [ox, oy, 0.015])
    ornSizes.set(orn.id, [ow, oh])
  }

  // Volumetric windows render as transparent containers in real visionOS
  // — the user sees their RealityKit content, not a glass baseplate. We
  // mirror that here: hide the plate by default, expose a tag in the
  // selection halo, and only render the plate at all when the user has
  // explicitly opted in via `volumeBaseplateVisibility: 'visible'`.
  const isVolumetric = win.windowStyle === 'volumetric'
  const showBaseplate = !isVolumetric || win.volumeBaseplateVisibility === 'visible'

  // Preview behaviour: only the active window/volume is shown, snapped
  // to the wearer's default frame. Non-active items hide entirely so a
  // multi-item editor layout doesn't show every plate at once. On
  // preview exit each item snaps back to its stored editor `position`.
  // Window mode snaps to chest height + 1m forward (the SwiftUI window
  // default). Volume mode snaps to chest height at world centre (the
  // volumetric stage default). Both modes are treated identically —
  // the user's mental model is "preview = experience the active item",
  // regardless of whether it's a window or a volume.
  const isPreviewActive = scene.previewMode
  let activeId = scene.activeWindowId
  if (!activeId) {
    // Fall back to the primary window, otherwise the first window in
    // document order — never null, so a fresh scene previews cleanly.
    const winItems = items.filter((it) => it.type === 'window')
    activeId = scene.primaryWindowId || (winItems[0]?.id ?? null)
  }
  const isActiveInPreview = isPreviewActive && activeId === win.id
  if (isPreviewActive && !isActiveInPreview) {
    return null
  }
  // Snap target differs per mode. Window plates sit 1m in front of the
  // wearer at chest height; volume stages sit at world origin (the
  // floor) and their child entities already carry chest-height local
  // Y, so an extra Y bump on the container would land the content
  // above the camera. Both match the camera pose in Canvas3D so the
  // active item lands dead-centre in the gaze.
  const isVolumeScene = scene.sceneMode === 'volume'
  const previewPos = isPreviewActive
    ? (isVolumeScene ? [0, 0, 0] : [0, 1.4, -1.0])
    : win.position

  return (
    <group position={previewPos}>
      {isSelected && (
        <mesh position={[0, 0, -0.02]}>
          <shapeGeometry args={[outlineShape]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.30} />
        </mesh>
      )}

      {/* Scrollable-window indicator. A thin pill on the trailing edge
          + a soft glass capsule behind it, drawn just inside the plate.
          Purely a visual cue that the SwiftUI ScrollView is in play
          at export time — the canvas itself doesn't actually scroll
          (the editor lets you see the full layout). */}
      {win.scrollable && (
        <mesh position={[w / 2 - 0.012, 0, 0.002]}>
          <planeGeometry args={[0.012, h * 0.32]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.55} />
        </mesh>
      )}

      {showBaseplate ? (
        <LiquidGlass
          size={[w, h]}
          cornerRadius={cornerR}
          color={fillColor}
          fillOpacity={typeof win.fillOpacity === 'number' ? win.fillOpacity : 0.92}
          material={win.material || 'regular'}
          schemeDark={scene.designScheme === 'dark'}
          hitEvents={{
            onPointerDown,
            onPointerMove,
            onPointerUp
          }}
        />
      ) : (
        // Volumetric window with hidden plate — keep an invisible hit
        // target so the user can still grab + drag the (otherwise
        // invisible) container.
        <mesh
          position={[0, 0, -0.005]}
          visible={false}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <shapeGeometry args={[outlineShape]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      )}

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
          // Content sits a few millimetres in front of the window plate
          // so it reads as "on the window" rather than orbiting in front
          // of it. The previous 8-18 cm offsets read as physically
          // detached when the camera moved in 3D, and the large
          // delta between content and the plate caused noticeable
          // z-fighting at oblique angles. 1-2 cm is enough for the
          // parallax cue without separating from the plate.
          const chromeStack = c.type === 'stack' && (c.stackType === 'tabView' || c.stackType === 'navigationStack')
          const zStack = scene.preview3D ? (chromeStack ? 0.020 : 0.012) : 0.005
          const zPanel = scene.preview3D ? 0.012 : 0.005
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

      {/* Ornaments — pinned to edges. Sit a touch in front of content
          (which is at 0.012-0.020) so toolbar items overlap content
          when they share screen space, without floating off the
          window in 3D space. */}
      {ornamentChildren.map((o) => {
        const basePos = ornPositions.get(o.id)
        const z = scene.preview3D ? 0.024 : 0.015
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

      {/* RealityKit entities sitting directly under the window. Volumetric
          windows are RealityView hosts implicitly; we render the entity
          tree at the window's local origin so designers see their
          spatial layout in the canvas. */}
      {entityChildren.length > 0 && (
        <EntityChildren hostId={win.id} items={items} scene={scene} />
      )}

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
