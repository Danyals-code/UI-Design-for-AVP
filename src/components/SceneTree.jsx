import { useRef, useMemo, useState, createContext, useContext } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useStore, isEffectivelyVisible } from '../store'
import { layoutStack, computeSize, resolvedChildSizes, scrollAxesOf, resolvePadding } from '../layout'
import { summarizeModifiers } from '../modifiers/registry'
import { roundedRectShape, unevenRoundedRectShape, rimRingShape, ellipseShape } from '../shapes'
import { resolveSemantic, ptToUnits, unitsToPt, ORNAMENT_GAP, NAVBAR_HEIGHT_PT, MATERIALS, resolveAnyMaterial, isPresentationPanel, inspectorColumnWidth } from '../appleSystem'

import { getInterFont } from '../fonts'
import Panel3D from './Panel3D'
import { EntityChildren } from './Entity3D'
import { SymbolIcon3D } from './SymbolIcon3D'

// ---------------------------------------------------------------------------
// Clipping
//
// A window clips its content to the plate; a scrolling stack clips its
// content to its own viewport. Both do it the same way — four world-space
// half-spaces assigned to every material in the subtree — and a scroller
// inside a window has to obey BOTH rects, so the plane lists compose rather
// than replace. `three` already gives us that: with `clipIntersection` off,
// a fragment survives only if it is inside every plane in the array.
//
// The rule that keeps it deterministic is single ownership. `ClipContext`
// carries the ancestor's plane list down; each clipper concatenates its own,
// assigns the combined list across its subtree, and marks its group
// `userData.ownsClip` so the ancestor's walk stops at that boundary instead
// of overwriting the combination with its own shorter list. Without the
// prune the two walks would fight, and which one won would depend on
// `useFrame` registration order.
// ---------------------------------------------------------------------------
const ClipContext = createContext(null)

// Four half-spaces (left / right / bottom / top) bounding an axis-aligned
// rect. Allocated once per clipper and mutated in place every frame: the
// array identity is what every material in the subtree holds, so
// re-allocating would strand them all on last frame's planes.
function makeClipPlanes() {
  return [
    new THREE.Plane(new THREE.Vector3( 1, 0, 0), 0),   // x >= leftEdge
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),   // x <= rightEdge
    new THREE.Plane(new THREE.Vector3(0,  1, 0), 0),   // y >= bottomEdge
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),   // y <= topEdge
  ]
}

// Plane equation: dot(normal, p) + constant >= 0 means "keep". So for the
// left edge (normal +X) the constant is the negative of the leftmost
// world-x, and the same shape holds for the other three sides.
function updateClipPlanes(planes, wx, wy, halfW, halfH) {
  planes[0].constant = -(wx - halfW)
  planes[1].constant =  (wx + halfW)
  planes[2].constant = -(wy - halfH)
  planes[3].constant =  (wy + halfH)
}

// Assign `planes` to every material under `root`, stopping at any descendant
// that owns a composed clip of its own. `Object3D.traverse` can't prune a
// branch, hence the hand-rolled walk.
function applyClipPlanes(root, planes) {
  const visit = (obj) => {
    const m = obj.material
    if (Array.isArray(m)) {
      for (const mm of m) { mm.clippingPlanes = planes; mm.clipIntersection = false }
    } else if (m) {
      m.clippingPlanes = planes
      m.clipIntersection = false
    }
    // Prune at the next clipper down: it assigns this list plus its own,
    // and descending past it would replace that combination.
    for (const child of obj.children) {
      if (!child.userData?.ownsClip) visit(child)
    }
  }
  visit(root)
}

// ---------------------------------------------------------------------------
// Presentations (AUDIT #7)
// ---------------------------------------------------------------------------

// The little triangle a popover hangs from. `popoverArrowEdge` names the side
// it comes out of, and `popoverAnchor` says whether SwiftUI anchors to the
// source's bounds or to a point — the point anchor draws a narrower arrow,
// since it is pinned to a spot rather than spanning an edge. Both were
// export-only; `popoverAnchor` was read by neither side.
function PopoverArrow3D({ panel, centre, size, scene }) {
  const edge = panel.popoverArrowEdge || 'automatic'
  if (edge === 'automatic') return null
  const pointAnchored = panel.popoverAnchor === 'point'
  const half = ptToUnits(pointAnchored ? 6 : 10)
  const depth = ptToUnits(pointAnchored ? 8 : 10)
  const [cx, cy] = centre
  const [pw, ph] = size
  const fill = resolveAnyMaterial(panel.material || 'thick', scene)?.color
    || resolveSemantic('secondarySystemBackground', scene)

  // Tip sits just outside the body on the named edge; the base spans it.
  const shape = new THREE.Shape()
  let pos = [cx, cy]
  if (edge === 'top' || edge === 'bottom') {
    const dir = edge === 'top' ? 1 : -1
    pos = [cx, cy + dir * ph / 2]
    shape.moveTo(-half, 0)
    shape.lineTo(half, 0)
    shape.lineTo(0, dir * depth)
  } else {
    const dir = edge === 'leading' ? -1 : 1
    pos = [cx + dir * pw / 2, cy]
    shape.moveTo(0, -half)
    shape.lineTo(0, half)
    shape.lineTo(dir * depth, 0)
  }
  shape.closePath()
  return (
    <mesh position={[pos[0], pos[1], 0.051]}>
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial color={fill} transparent opacity={0.98} side={THREE.DoubleSide} />
    </mesh>
  )
}

// Build a real soft shadow as a CanvasTexture. The canvas 2D `shadowBlur`
// gives a true Gaussian falloff (not the old hard inflated-rect / ring),
// and `shadowOffsetX/Y` make the X/Y offsets actually move the shadow.
// `inner` casts the shadow inside the shape (inner shadow); otherwise it's
// a drop shadow with the shape itself knocked out so only the halo shows.
// Dimensions are in points; the returned plane size is in world units.
function makeShadowCanvas(wPt, hPt, radiusPt, shadow, inner) {
  if (typeof document === 'undefined') return null
  const w = Math.max(1, Math.round(wPt))
  const h = Math.max(1, Math.round(hPt))
  const r = Math.max(0, Math.min(radiusPt, w / 2, h / 2))
  const blur = Math.max(0, shadow.blur ?? 12)
  const ox = shadow.offsetX ?? 0
  const oy = shadow.offsetY ?? 0
  const color = shadow.color || '#000000'
  const pad = Math.ceil(blur * 3 + Math.max(Math.abs(ox), Math.abs(oy)) + 8)
  const cw = w + pad * 2
  const ch = h + pad * 2
  const cnv = document.createElement('canvas')
  cnv.width = cw
  cnv.height = ch
  const ctx = cnv.getContext('2d')
  // Append a rounded-rect subpath to the current path (no beginPath) so we
  // can compose multi-subpath fills (e.g. even-odd for the inner shadow).
  const addRR = (x, y, ww, hh, rr) => {
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + ww, y, x + ww, y + hh, rr)
    ctx.arcTo(x + ww, y + hh, x, y + hh, rr)
    ctx.arcTo(x, y + hh, x, y, rr)
    ctx.arcTo(x, y, x + ww, y, rr)
    ctx.closePath()
  }
  const sx = pad, sy = pad
  if (!inner) {
    // Drop shadow: stamp the shape with a canvas shadow, then punch the
    // shape itself out so only the soft halo remains.
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = blur
    ctx.shadowOffsetX = ox
    ctx.shadowOffsetY = oy
    ctx.fillStyle = '#000'
    ctx.beginPath(); addRR(sx, sy, w, h, r); ctx.fill()
    ctx.restore()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath(); addRR(sx, sy, w, h, r); ctx.fill()
  } else {
    // Inner shadow: clip to the shape, then fill the region *outside* it
    // (even-odd) with a canvas shadow so the blur bleeds inward.
    ctx.save()
    ctx.beginPath(); addRR(sx, sy, w, h, r); ctx.clip()
    ctx.shadowColor = color
    ctx.shadowBlur = blur
    ctx.shadowOffsetX = ox
    ctx.shadowOffsetY = oy
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.rect(0, 0, cw, ch)
    addRR(sx, sy, w, h, r)
    ctx.fill('evenodd')
    ctx.restore()
  }
  const tex = new THREE.CanvasTexture(cnv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return { tex, wUnits: ptToUnits(cw), hUnits: ptToUnits(ch) }
}

// ---- Plane fill ----
// Earlier we layered a six-pass approximation of visionOS Liquid Glass
// (shadow, fill, gradient, halo, rim, specular). The multi-plane stack read
// well head-on but produced visible parallax banding in the 3D preview — a
// mix of z-fighting at tilted angles and layer edges that looked like
// artifacts. We've dropped it in favour of a flat plane fill with a single
// soft drop shadow, which is what the user asked for (plain colour, no
// glass). Semantic colour tokens still resolve per-scheme so the fill picks
// up the dark-mode palette.
// Paint a gradient fill texture for a material. The angle is in degrees
// (SwiftUI-style: 0° = top→bottom, 90° = leading→trailing). Cached by
// `${from}|${to}|${angle}` so flipping back and forth on the editor
// reuses the previous bake.
const _fillGradientCache = new Map()
function getFillGradientTexture(from, to, angleDeg) {
  const key = `${from}|${to}|${angleDeg}`
  const cached = _fillGradientCache.get(key)
  if (cached) return cached
  if (typeof document === 'undefined') return null
  const N = 256
  const canvas = document.createElement('canvas')
  canvas.width = N
  canvas.height = N
  const ctx = canvas.getContext('2d')
  const rad = ((angleDeg ?? 180) * Math.PI) / 180
  const cx = N / 2, cy = N / 2
  const dx = Math.sin(rad) * (N / 2)
  const dy = -Math.cos(rad) * (N / 2)
  const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy)
  g.addColorStop(0, from || '#808080')
  g.addColorStop(1, to || '#cccccc')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, N, N)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  _fillGradientCache.set(key, tex)
  return tex
}

// Paint the 3pt linear-grading stroke that wraps every main window
// plate. Stops mirror the Figma reference: white at 0% / 41% / 57% /
// 100% with alphas 40 / 0 / 0 / 10 percent — a bright top-left wash,
// a hollow midsection, and a soft bottom-right glow. The gradient
// runs at 45° (top-left → bottom-right corner of the square texture)
// so the highlight sweeps diagonally across the window's perimeter.
let _strokeTextureCache = null
function getStrokeGradientTexture() {
  if (_strokeTextureCache) return _strokeTextureCache
  if (typeof document === 'undefined') return null
  const N = 512
  const canvas = document.createElement('canvas')
  canvas.width = N
  canvas.height = N
  const ctx = canvas.getContext('2d')
  // 45° linear gradient — top-left corner to bottom-right corner of
  // the square canvas. The UV map on the ring shape samples this in
  // [0..1]² coordinates, so the gradient is read across the diagonal
  // of the window's bounding rectangle.
  const g = ctx.createLinearGradient(0, 0, N, N)
  g.addColorStop(0.00, 'rgba(255,255,255,0.40)')
  g.addColorStop(0.41, 'rgba(255,255,255,0.00)')
  g.addColorStop(0.57, 'rgba(255,255,255,0.00)')
  g.addColorStop(1.00, 'rgba(255,255,255,0.10)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, N, N)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  _strokeTextureCache = tex
  return tex
}

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
  // Liquid Glass material tier (key into MATERIALS). `viewsRegular`
  // (and any future tier that defines a `.layers` array) renders as a
  // multi-pass composite instead of the single `color` fill — bottom
  // layer first, top layers stacked on a tiny z offset. Flat tiers
  // ignore this entirely and draw the legacy single-plane fill.
  material = 'regular',
  // Merged material config (MATERIALS[key] + scene.materialProps[key]
  // overrides) — supplied by the call site so we don't re-resolve
  // inside the renderer. Carries `.layers`, `.innerShadow`,
  // `.dropShadow` etc. When omitted we fall back to MATERIALS[material].
  materialConfig = null,
  // Frosted-glass blur. Switches the plate's fill to a
  // `meshPhysicalMaterial` driven by three.js's transmission framebuffer,
  // which mip-blurs whatever is actually behind the plate — see the fill
  // mesh below for why `ior` is set and `transparent` deliberately is not.
  // `blurAmount` (pt) maps onto material roughness, which is what selects
  // the mip level, so a larger amount reads as a softer backdrop rather
  // than a brighter plate. Export maps this to SwiftUI's
  // `.background(.regularMaterial)` modifier with the right radius.
  blur = false,
  blurAmount = 12,
  // Paint the 1pt linear-grading stroke around the plate perimeter.
  // Off by default; the window renderer turns it on for the main
  // baseplate so stacks / ornaments stay free of the ring.
  strokeRing = false,
  hitEvents = {}
  // `schemeDark`, `capsule` are accepted (but unused) for call-site
  // compatibility with the previous glass implementation.
}) {
  const [w, h] = size
  const fillShape = useMemo(() => {
    if (Array.isArray(cornerRadii)) {
      const [tl, tr, br, bl] = cornerRadii
      return unevenRoundedRectShape(w, h, tl, tr, bl, br)
    }
    return roundedRectShape(w, h, cornerRadius)
  }, [w, h, cornerRadius, cornerRadii?.[0], cornerRadii?.[1], cornerRadii?.[2], cornerRadii?.[3]])
  // Geometry with UVs mapped to the bounding box — needed when the
  // fill is a gradient CanvasTexture so the gradient samples evenly
  // across the plate regardless of corner-radius cutouts.
  const fillGeometry = useMemo(() => {
    const g = new THREE.ShapeGeometry(fillShape, 32)
    const pos = g.attributes.position
    const uvs = new Float32Array(pos.count * 2)
    for (let i = 0; i < pos.count; i++) {
      uvs[i * 2]     = (pos.getX(i) + w / 2) / w
      uvs[i * 2 + 1] = (pos.getY(i) + h / 2) / h
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    return g
  }, [fillShape, w, h])
  // No drop shadow — visionOS glass plates rely on translucency and
  // the environment lighting for their depth cue, not a contact
  // shadow. The earlier rectangular shadow also bulged past uneven-
  // corner sidebars (joined NavigationSplitView) creating a visible
  // "ghost" silhouette. Dropping it cleans up the chrome and matches
  // the HIG.
  //
  // Blur overlay intensity scales the amount (in pt) into a 0..0.45
  // alpha range — enough to read as a frost without nuking the
  // backdrop contrast.
  // Multi-layer materials (e.g. viewsRegular) paint their `.layers`
  // composite over the base fill instead of using the single `color`
  // prop. Each layer gets its own thin mesh stacked above the base on
  // a 0.0002-unit z step so transparency composites cleanly.
  const materialSpec = materialConfig || MATERIALS[material] || {}
  const extraLayers = materialSpec.layers || null
  // Inner / drop shadow descriptors come from the merged material
  // config so the editor's overrides flow straight into the rendered
  // plate.
  const innerShadow = materialSpec.innerShadow || null
  const dropShadow = materialSpec.dropShadow || null
  // 3pt stroke ring metric — rimRingShape carves the inner hole; the
  // CanvasTexture is sampled across the bounding box so the 45°
  // gradient sweeps from the top-left corner to the bottom-right
  // corner of the window's perimeter.
  const strokeThickness = ptToUnits(3)
  const ringShape = useMemo(() => {
    if (!strokeRing) return null
    return rimRingShape(w, h, cornerRadius, strokeThickness)
  }, [strokeRing, w, h, cornerRadius, strokeThickness])
  const ringGeometry = useMemo(() => {
    if (!ringShape) return null
    const g = new THREE.ShapeGeometry(ringShape, 32)
    const pos = g.attributes.position
    const uvs = new Float32Array(pos.count * 2)
    for (let i = 0; i < pos.count; i++) {
      uvs[i * 2]     = (pos.getX(i) + w / 2) / w
      uvs[i * 2 + 1] = (pos.getY(i) + h / 2) / h
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    return g
  }, [ringShape, w, h])
  const strokeTexture = strokeRing ? getStrokeGradientTexture() : null
  // Drop / inner shadow as real soft-blur CanvasTextures (see
  // makeShadowCanvas). The offset is baked into the texture, so the
  // carrying plane stays centred on the plate. Deps cover only the
  // texture-relevant fields so dragging the Opacity slider (applied via
  // material opacity) doesn't rebuild the texture.
  const dropShadowTex = useMemo(
    () => dropShadow
      ? makeShadowCanvas(unitsToPt(w), unitsToPt(h), unitsToPt(cornerRadius), dropShadow, false)
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [!!dropShadow, dropShadow?.offsetX, dropShadow?.offsetY, dropShadow?.blur, dropShadow?.color, w, h, cornerRadius]
  )
  const innerShadowTex = useMemo(
    () => innerShadow
      ? makeShadowCanvas(unitsToPt(w), unitsToPt(h), unitsToPt(cornerRadius), innerShadow, true)
      : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [!!innerShadow, innerShadow?.offsetX, innerShadow?.offsetY, innerShadow?.blur, innerShadow?.color, w, h, cornerRadius]
  )
  return (
    <group>
      {dropShadowTex && (
        <mesh position={[0, 0, -0.003]} renderOrder={-3}>
          <planeGeometry args={[dropShadowTex.wUnits, dropShadowTex.hUnits]} />
          <meshBasicMaterial
            map={dropShadowTex.tex}
            transparent
            opacity={dropShadow.opacity ?? 0.2}
            depthWrite={false}
          />
        </mesh>
      )}
      <mesh position={[0, 0, -0.001]} renderOrder={-1} geometry={fillGeometry} {...hitEvents}>
        {blur ? (
          // Real backdrop blur via three.js's built-in transmission
          // feature. Mip-based blur driven by `roughness`; `ior=1.5`
          // and absence of `transparent` keep the mip sampling path
          // active (transparent materials skip transmission).
          <meshPhysicalMaterial
            color={color}
            transmission={Math.max(0.05, 1 - fillOpacity)}
            roughness={Math.min(0.85, Math.max(0, blurAmount) / 60)}
            thickness={0.2}
            ior={1.5}
            metalness={0}
            clearcoat={0}
            attenuationColor={color}
            attenuationDistance={20}
            side={THREE.DoubleSide}
          />
        ) : materialSpec.fillType === 'gradient' ? (
          <meshBasicMaterial
            map={getFillGradientTexture(
              materialSpec.gradientFrom || color,
              materialSpec.gradientTo || color,
              materialSpec.gradientAngle ?? 180
            )}
            side={THREE.DoubleSide}
            transparent={fillOpacity < 1}
            opacity={fillOpacity}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        ) : (
          <meshBasicMaterial
            color={color}
            side={THREE.DoubleSide}
            transparent={fillOpacity < 1}
            opacity={fillOpacity}
            polygonOffset
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        )}
      </mesh>
      {extraLayers && extraLayers.map((layer, i) => (
        <mesh key={`mat-layer-${i}`} position={[0, 0, -0.0008 + i * 0.0002]} renderOrder={-1 + (i + 1) * 0.01}>
          <shapeGeometry args={[fillShape]} />
          <meshBasicMaterial
            color={layer.color}
            side={THREE.DoubleSide}
            transparent
            opacity={layer.opacity}
            depthWrite={false}
          />
        </mesh>
      ))}
      {/* No frost overlay — when blur is on, the plate's
          `meshPhysicalMaterial` (above) handles the real backdrop
          blur via three.js's built-in transmission framebuffer. */}
      {strokeRing && ringGeometry && strokeTexture && (
        <mesh position={[0, 0, 0.001]} renderOrder={2} geometry={ringGeometry}>
          <meshBasicMaterial
            map={strokeTexture}
            side={THREE.DoubleSide}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}
      {innerShadowTex && (
        <mesh position={[0, 0, 0.0008]} renderOrder={1}>
          <planeGeometry args={[innerShadowTex.wUnits, innerShadowTex.hUnits]} />
          <meshBasicMaterial
            map={innerShadowTex.tex}
            transparent
            opacity={innerShadow.opacity ?? 0.25}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
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

  // ---- Scrolling ----------------------------------------------------------
  // Which axes scroll is decided by `scrollAxesOf` in layout.js, which
  // mirrors the exporter's routing, so the canvas scrolls exactly the views
  // that export a ScrollView. `.scrollDisabled(true)` in the modifier stack
  // turns it back off, the way it does on device.
  const modSummary = summarizeModifiers(stack.modifiers)
  const axes = scrollAxesOf(stack)
  const scrollsV = axes.vertical   && !modSummary.scrollDisabled
  const scrollsH = axes.horizontal && !modSummary.scrollDisabled
  const scrolls = scrollsV || scrollsH

  // The content extent, measured from the boxes the renderer is about to
  // draw rather than from `computeSize`. Same principle as the layout /
  // renderer agreement tests: derive the scroll range from what is on
  // screen and the two cannot disagree about how far there is to go.
  const pad = resolvePadding(stack)
  const contentSpan = useMemo(() => {
    if (!scrolls) return null
    let top = -Infinity, bottom = Infinity, left = Infinity, right = -Infinity
    for (const c of children) {
      const p = childPositions.get(c.id)
      if (!p) continue
      const [cw, ch] = childSizes.get(c.id) || computeSize(c, items)
      top    = Math.max(top,    p[1] + ch / 2)
      bottom = Math.min(bottom, p[1] - ch / 2)
      left   = Math.min(left,   p[0] - cw / 2)
      right  = Math.max(right,  p[0] + cw / 2)
    }
    if (top === -Infinity) return { width: 0, height: 0 }
    // Padding rides with the scrolling content, not the viewport — that is
    // where the exporter puts it (`ScrollView { VStack{}.padding(24) }`), so
    // the inset scrolls away with the first screenful on both sides.
    return {
      width:  (right - left) + pad.leading + pad.trailing,
      height: (top - bottom) + pad.top + pad.bottom
    }
  }, [scrolls, children, childPositions, childSizes, items, pad.top, pad.bottom, pad.leading, pad.trailing])

  const maxScrollY = scrollsV && contentSpan ? Math.max(0, contentSpan.height - h) : 0
  const maxScrollX = scrollsH && contentSpan ? Math.max(0, contentSpan.width  - w) : 0
  const scrollY = Math.min(Math.max(0, Number(stack.scrollY) || 0), maxScrollY)
  const scrollX = Math.min(Math.max(0, Number(stack.scrollX) || 0), maxScrollX)

  // Two inputs suppress the indicators, and the exporter reads both: the
  // ScrollView's own `showsIndicators:` argument and `.scrollIndicators()`
  // in the modifier stack. SwiftUI spells "off" as either `.hidden` or
  // `.never`; every other case shows.
  const indicatorMod = modSummary.scrollIndicators
  const showScrollIndicators = stack.scrollShowsIndicators !== false &&
                               indicatorMod !== 'hidden' && indicatorMod !== 'never'

  // ---- Container modifiers (AUDIT #5) -------------------------------------
  // `.containerBackground`, `.navigationTitle` and `.toolbarBackground` all
  // emitted correct Swift and drew nothing. The first two are read here; the
  // toolbar one is consulted where the toolbar plate is drawn.
  //
  // `.navigationTitle` is the sharp one: the canvas read `stack.navTitle`
  // instead, so the same concept had two sources and they disagreed the
  // moment the designer used the modifier stack. The modifier is the SwiftUI
  // spelling, so it wins.
  const navTitle = modSummary.navigationTitle || stack.navTitle
  const containerBg = modSummary.containerBg || null
  // `.background(...)` and `.overlay(...)` on a container, painted behind and
  // in front of its children — the same pair Panel3D draws for a view.
  const stackModBg = (() => {
    const bg = modSummary.background
    if (typeof bg !== 'string' || !bg) return null
    if (bg.startsWith('#')) return { color: bg, opacity: 1 }
    const mat = resolveAnyMaterial(bg, scene)
    return { color: mat?.color || resolveSemantic(bg, scene), opacity: mat?.opacity ?? 1 }
  })()
  const stackModOverlay = modSummary.overlay?.color ? modSummary.overlay : null
  const stackClip = modSummary.clipShape && modSummary.clipShape !== 'none'
    ? modSummary.clipShape : null
  const stackOpacity = modSummary.opacity ?? 1
  // `.toolbarBackground(.hidden, ...)` takes the toolbar's plate away; every
  // other visibility leaves it. Only meaningful on the toolbar stack types.
  const toolbarBgHidden = modSummary.toolbarBackground?.visibility === 'hidden'
  const isToolbarStack = stack.stackType === 'toolbar' ||
                         stack.stackType === 'toolbarItem' ||
                         stack.stackType === 'toolbarItemGroup' ||
                         stack.ornament != null

  const hasBackground = stack.ornament != null || stack.background != null
  // Allow a stack to override its background corner radius (e.g. the
  // separated NavigationSplitView sidebar uses a 30pt dialogue radius).
  const bgRadius = stack.ornament
    ? Math.min(w, h) / 2
    : (stack.cornerRadius != null ? stack.cornerRadius : ptToUnits(12))

  // The outline the container's modifier layers paint into: `.clipShape`
  // when the designer set one, otherwise the stack's own background shape.
  // Shared by `.containerBackground`, `.background` and `.overlay` so all
  // three agree about the edge.
  const stackPaintShape = useMemo(() => {
    if (stackClip === 'circle') {
      const r = Math.min(w, h) / 2
      return ellipseShape(r * 2, r * 2)
    }
    if (stackClip === 'capsule') return roundedRectShape(w, h, Math.min(w, h) / 2)
    return roundedRectShape(w, h, stackClip === 'roundedRect'
      ? (stack.cornerRadius ?? ptToUnits(12))
      : bgRadius)
  }, [stackClip, w, h, bgRadius, stack.cornerRadius])

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
    return resolveSemantic(token, scene)
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

  // ScrollView wheel handling. Same 0.0015 units-per-tick feel as the
  // window's, and the offset is persisted on the stack so it round-trips
  // through undo and serialization like every other preview affordance.
  // Wheel events bubble from any descendant, so a row inside the scroller
  // still takes clicks — `onPointerDown` and `onWheel` are separate event
  // channels in three-fiber.
  const onScrollWheel = (e) => {
    if (maxScrollY === 0 && maxScrollX === 0) return
    e.stopPropagation()
    // OrbitControls dollies the camera on wheel from its own DOM listener on
    // the same canvas element, so three-fiber's `stopPropagation` — which
    // only walks the scene graph — does not reach it, and scrolling a list
    // would zoom the viewport at the same time. R3F registers its listener
    // when the canvas mounts, before OrbitControls registers its own, so
    // stopping immediate propagation from here suppresses the dolly for
    // exactly the wheel events this scroller consumes and leaves every other
    // one alone.
    e.nativeEvent?.stopImmediatePropagation?.()
    const patch = {}
    if (maxScrollY > 0) {
      const next = Math.max(0, Math.min(maxScrollY, scrollY + e.deltaY * 0.0015))
      if (Math.abs(next - scrollY) > 0.0001) patch.scrollY = next
    }
    // Trackpads send deltaX; a wheel-only mouse gets the vertical delta
    // routed sideways when the view scrolls horizontally and nowhere else,
    // which is what a horizontal ScrollView does on device.
    if (maxScrollX > 0) {
      const dx = e.deltaX || (maxScrollY === 0 ? e.deltaY : 0)
      const next = Math.max(0, Math.min(maxScrollX, scrollX + dx * 0.0015))
      if (Math.abs(next - scrollX) > 0.0001) patch.scrollX = next
    }
    if (Object.keys(patch).length) updateItem(stack.id, patch)
  }

  // Clip the scrolling content to this stack's own viewport, composed with
  // whatever rect an ancestor already imposes (see the ClipContext note at
  // the top of the file). Without this the overflow would only be bounded
  // by the window, so a small scroller in the middle of a plate would spill
  // its content across everything around it.
  const inheritedClip = useContext(ClipContext)
  const ownClipPlanes = useMemo(makeClipPlanes, [])
  const composedClip = useMemo(
    () => (inheritedClip ? [...inheritedClip, ...ownClipPlanes] : ownClipPlanes),
    [inheritedClip, ownClipPlanes]
  )
  const viewportRef = useRef()
  const wasClippingRef = useRef(false)
  useFrame(() => {
    const vp = viewportRef.current
    if (!vp) return
    if (!scrolls) {
      // Hand the subtree back to the ancestor's rect on the frame after
      // scrolling is switched off, so materials don't keep a viewport that
      // no longer exists.
      if (wasClippingRef.current) {
        applyClipPlanes(vp, inheritedClip)
        wasClippingRef.current = false
      }
      return
    }
    vp.updateMatrixWorld()
    updateClipPlanes(
      ownClipPlanes,
      vp.matrixWorld.elements[12],
      vp.matrixWorld.elements[13],
      w / 2, h / 2
    )
    applyClipPlanes(vp, composedClip)
    wasClippingRef.current = true
  })

  return (
    <group
      position={localPosition || [0, 0, 0]}
      onWheel={stack.splitStyle ? onSidebarWheel : (scrolls ? onScrollWheel : undefined)}
    >
      {isSelected && (
        <mesh position={[0, 0, -0.02]}>
          <shapeGeometry args={[outlineShape]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.28} />
        </mesh>
      )}

      {/* Modifier: .containerBackground — a container-only backdrop that
          sits behind everything the stack draws, including its own plate.
          `.window` placement covers the whole box; the narrower placements
          all reduce to the same rectangle on a flat canvas. */}
      {containerBg && (
        <mesh position={[0, 0, -0.006]}>
          <shapeGeometry args={[stackPaintShape]} />
          <meshBasicMaterial
            color={containerBg.color}
            transparent
            opacity={0.9 * stackOpacity}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {/* Modifier: .background on the container itself. */}
      {stackModBg && (
        <mesh position={[0, 0, -0.004]}>
          <shapeGeometry args={[stackPaintShape]} />
          <meshBasicMaterial
            color={stackModBg.color}
            transparent
            opacity={stackModBg.opacity * stackOpacity}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {hasBackground && !(isToolbarStack && toolbarBgHidden) && (
        <LiquidGlass
          size={[w, h]}
          cornerRadius={bgRadius}
          cornerRadii={stack.cornerRadii}
          color={bgColor}
          material={stack.material || 'regular'}
          materialConfig={resolveAnyMaterial(stack.material || 'regular', scene)}
          blur={!!stack.blur}
          blurAmount={stack.blurAmount ?? 12}
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

      {/* Scroll indicators. The thumb is sized to the visible fraction of
          the content and tracks `scrollY` / `scrollX`, so it reads as a
          real position rather than the fixed decorative bar this used to
          draw. Hidden when there is nothing to scroll, and suppressed by
          either `scrollShowsIndicators` (the ScrollView's own argument) or
          `.scrollIndicators(.hidden)` in the modifier stack — the same two
          inputs the exporter reads. */}
      {showScrollIndicators && maxScrollY > 0 && (() => {
        const thumbH = Math.max(ptToUnits(24), h * Math.min(1, h / contentSpan.height))
        const travel = Math.max(0, h - thumbH)
        const t = maxScrollY > 0 ? scrollY / maxScrollY : 0
        return (
          <mesh position={[w / 2 - 0.012, h / 2 - thumbH / 2 - t * travel, 0.004]}>
            <planeGeometry args={[0.012, thumbH]} />
            <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.55} />
          </mesh>
        )
      })()}
      {showScrollIndicators && maxScrollX > 0 && (() => {
        const thumbW = Math.max(ptToUnits(24), w * Math.min(1, w / contentSpan.width))
        const travel = Math.max(0, w - thumbW)
        const t = maxScrollX > 0 ? scrollX / maxScrollX : 0
        return (
          <mesh position={[-w / 2 + thumbW / 2 + t * travel, -h / 2 + 0.012, 0.004]}>
            <planeGeometry args={[thumbW, 0.012]} />
            <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.55} />
          </mesh>
        )
      })()}

      {/* Section header/footer text */}
      {stack.stackType === 'section' && stack.sectionHeader && (
        <Text
          position={[-w / 2 + ptToUnits(16), h / 2 - ptToUnits(16), 0.003]}
          font={getInterFont('semibold')}
          fontSize={ptToUnits(13)}
          color={resolveSemantic('secondary', scene)}
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
          color={resolveSemantic('secondary', scene)}
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
            color={resolveSemantic('primary', scene)}
            anchorX="left"
            anchorY="middle"
          >
            {stack.disclosureLabel || 'Section'}
          </Text>
          <Text
            position={[-w / 2 + ptToUnits(10), 0, 0]}
            fontSize={ptToUnits(12)}
            color={resolveSemantic('secondary', scene)}
            anchorX="left"
            anchorY="middle"
          >
            {stack.expanded ? '▾' : '▸'}
          </Text>
        </group>
      )}

      {/* NavStack title */}
      {stack.stackType === 'navigationStack' && navTitle && (
        <Text
          position={[0, h / 2 - ptToUnits(24), 0.003]}
          font={getInterFont('bold')}
          fontSize={ptToUnits(20)}
          color={resolveSemantic('primary', scene)}
          anchorX="center"
          anchorY="middle"
          maxWidth={w * 0.85}
        >
          {navTitle}
        </Text>
      )}

      {/* TabView: auto-render bottom tab bar with clickable tabs */}
      {stack.stackType === 'tabView' && <TabBar3D stack={stack} childItems={children} w={w} h={h} scene={scene} />}

      {/* Viewport → scrolled content → children.
          The viewport group is the clip boundary and stays put, so the rect
          derived from its world matrix is stable; the offset lives on the
          group inside it. `ownsClip` tells an ancestor's clip walk to stop
          here, because this subtree needs the ancestor's planes AND these,
          and the walk that assigns both is the one above. */}
      <group ref={viewportRef} userData={{ ownsClip: scrolls }}>
      <group position={scrolls ? [-scrollX, scrollY, 0] : [0, 0, 0]}>
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
      </group>

      {/* Modifier: .overlay on the container — in front of every child, the
          mirror of `.background` behind them. */}
      {stackModOverlay && (
        <mesh position={[0, 0, 0.05]}>
          <shapeGeometry args={[stackPaintShape]} />
          <meshBasicMaterial
            color={stackModOverlay.color}
            transparent
            opacity={(stackModOverlay.opacity ?? 0.2) * stackOpacity}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

// Auto-rendered tab bar at the bottom of a TabView stack.
// Shows each Tab's label + icon, highlights the active one, clickable.
// `childItems` is the stack's child *store records*, not React children — the
// name matters, because passing them as `children` reads as JSX content and
// React reserves that prop.
function TabBar3D({ stack, childItems, w, h, scene }) {
  const updateItem = useStore((s) => s.updateItem)
  const tabs = childItems.filter((c) => c.stackType === 'tab')
  if (tabs.length === 0) return null

  const barH = ptToUnits(64)
  const barY = -h / 2 + barH / 2
  const tabW = ptToUnits(80)
  const activeIdx = stack.activeTab ?? 0
  const tint = scene.tintColor || '#007aff'
  const dimColor = resolveSemantic('secondary', scene)

  return (
    <group position={[0, barY, 0.01]}>
      {/* Bar background */}
      <mesh>
        <shapeGeometry args={[roundedRectShape(w, barH, barH / 2)]} />
        <meshBasicMaterial
          color={resolveSemantic('glassThick', scene)}
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
              <SymbolIcon3D
                name={tab.tabIcon}
                sizeUnits={ptToUnits(20)}
                color={active ? tint : dimColor}
                weight={active ? 'semibold' : 'regular'}
                position={[0, ptToUnits(8), 0.001]}
              />
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

function Window3D({ window: win, items, previewPosition }) {
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

  // Four world-space clipping planes (left / right / bottom / top) the
  // renderer uses to discard pixels outside the window's rectangular
  // bounds. Kept in a stable ref so we can update plane constants each
  // frame without re-allocating. Local clipping is turned on globally
  // in Canvas3D's `gl` config; without that flag the renderer ignores
  // every material's `clippingPlanes` array.
  const clipPlanes = useMemo(makeClipPlanes, [])
  const contentClipRef = useRef()

  const [w, h] = win.size
  const cornerR = win.cornerRadius ?? 0
  // Resolve the material's default color / opacity / blur set —
  // window-level overrides on the item take precedence, so a designer
  // can still tweak per-window without touching the shared material.
  const matCfg = resolveAnyMaterial(win.material || 'glass', scene)
  const fillColor = win.colorToken
    ? resolveSemantic(win.colorToken, scene)
    : (win.color || matCfg.color || '#f2f2f7')

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
  // The four `.inspectorColumnWidth(…)` inputs, spelled out here so the
  // precedence lives in one shared helper the exporter's own output can be
  // tested against.
  const inspectorWidth = (p) => inspectorColumnWidth({
    exact:  p.inspectorColumnWidth,
    ideal:  p.inspectorIdealWidth,
    min:    p.inspectorMinWidth,
    max:    p.inspectorMaxWidth,
    stored: Array.isArray(p.size) ? p.size[0] : null
  }, w)
  // Entities can land directly under a window when the window is volumetric
  // (the window itself acts as a RealityView container). Rendered after
  // content/ornaments at the window's own origin.
  const entityChildren = allChildren.filter((c) => c.type === 'entity')
  const contentChildren = allChildren.filter((c) =>
    c.type !== 'entity' &&
    !(c.type === 'stack' && c.ornament) &&
    !(c.type === 'panel' && isPresentationPanel(c.panelType))
  )
  const ornamentChildren = allChildren.filter((c) => c.type === 'stack' && c.ornament)
  const presentationChildren = allChildren.filter((c) => c.type === 'panel' && isPresentationPanel(c.panelType))
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

    // `ornamentOffset` nudges the ornament further out along the edge it
    // hangs from — read by NEITHER side until phase 1.5, so the number in the
    // inspector moved nothing and reached no file. Positive pushes away from
    // the window, which is the direction the field reads as. AUDIT #14.
    const off = ptToUnits(Number(orn.ornamentOffset) || 0)
    if (off) {
      if (edge === 'leading')       ox -= off
      else if (edge === 'trailing') ox += off
      else if (edge === 'top')      oy += off
      else if (edge === 'bottom')   oy -= off
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

  // Preview behaviour: the parent SceneTree filters the rendered set to
  // `scene.openWindowItemIds` and computes a side-by-side `previewPosition`
  // for each one. When that prop is null in preview the window is not in
  // the open set — render nothing. Hook calls happen BEFORE this early
  // return so React always sees the same hook order on every render
  // (rules-of-hooks).
  const isPreviewActive = scene.previewMode
  const isVolumeScene = scene.sceneMode === 'volume'
  const previewPos = isPreviewActive
    ? (isVolumeScene ? [0, 0, 0] : previewPosition)
    : win.position

  // Smoothly lerp the rendered position toward `previewPos` in preview
  // mode. When the open-window set changes (a button spawns a same-id
  // window, or the user clicks a different pill), the remaining windows
  // on the row glide into their new slots instead of snapping. Lerp is
  // imperative on the group ref so we don't pay a React re-render per
  // frame. Editor mode skips the lerp so dragging stays exact.
  const positionRef = useRef()
  const initialPosRef = useRef(null)
  useFrame((_, delta) => {
    if (!isPreviewActive) return
    const g = positionRef.current
    if (!g || !previewPos) return
    const [tx, ty, tz] = previewPos
    const cur = g.position
    const dist = Math.hypot(cur.x - tx, cur.y - ty, cur.z - tz)
    if (dist < 0.0005) {
      cur.set(tx, ty, tz)
      return
    }
    // ~140ms ease-out at 60fps.
    const k = Math.min(1, delta * 12)
    cur.set(
      cur.x + (tx - cur.x) * k,
      cur.y + (ty - cur.y) * k,
      cur.z + (tz - cur.z) * k
    )
  })

  // Per-frame: re-anchor the four clipping planes at the window's
  // current world bounds and patch every descendant material in the
  // content sub-group so the renderer discards pixels past those edges.
  // Walking the subtree each frame is cheap (≤ a few hundred meshes per
  // window) and means we never miss late-mounted descendants like text
  // glyphs or symbol textures that resolve asynchronously.
  //
  // Volumetric windows opt out entirely: they act as RealityView
  // containers and their children (RealityKit entities placed at
  // wearer-scale positions like Y=1.2m) live far outside the plate's
  // rectangular Y bounds. Clipping them would discard every pixel and
  // the volume would read as empty. visionOS bounds volumetric content
  // by the volume's own 3D envelope, not by the SwiftUI plate rect.
  useFrame(() => {
    if (isVolumetric) return
    const outer = positionRef.current
    const inner = contentClipRef.current
    if (!outer || !inner) return
    outer.updateMatrixWorld()
    const wx = outer.matrixWorld.elements[12]
    const wy = outer.matrixWorld.elements[13]
    updateClipPlanes(clipPlanes, wx, wy, w / 2, h / 2)
    // Stops at any scrolling stack inside: that stack assigns these planes
    // plus its own viewport's, and descending past it would drop its half
    // of the pair.
    applyClipPlanes(inner, clipPlanes)
  })

  if (isPreviewActive && !previewPosition) {
    // Reset the seed so the next preview-mount animates from scratch.
    initialPosRef.current = null
    return null
  }

  // Compute the seed position on first render only — gives the group's
  // <group position=...> a sensible starting point so the lerp animates
  // into place instead of teleporting on mount.
  if (initialPosRef.current === null) {
    if (isPreviewActive && previewPos) {
      // Slight offset to the right so the spawn-on-right action reads
      // as a slide-in from the trailing edge.
      initialPosRef.current = [previewPos[0] + 0.3, previewPos[1], previewPos[2]]
    } else {
      initialPosRef.current = previewPos
    }
  }
  // In editor mode we don't lerp — keep the group's position pinned to
  // `previewPos` (the stored design position) so dragging stays exact.
  const renderPos = isPreviewActive ? initialPosRef.current : previewPos

  return (
    <group ref={positionRef} position={renderPos}>
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
          fillOpacity={typeof win.fillOpacity === 'number' ? win.fillOpacity : (matCfg.opacity ?? 0.92)}
          material={win.material || 'glass'}
          materialConfig={matCfg}
          blur={typeof win.blur === 'boolean' ? win.blur : !!matCfg.blur}
          blurAmount={win.blurAmount ?? matCfg.blurAmount ?? 12}
          strokeRing
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

      {/* Clipped + (optionally) scrollable content layer. The four
          clipping planes anchored to the window's world bounds are
          attached to every descendant material via the useFrame walk
          above. `scrollY` shifts the content upward inside the plate;
          ornaments and chrome stay outside this group so they can
          overlap the edge. Wheel events on the plate's hit surface
          bubble up here when the window is marked scrollable. */}
      {/* Descendants inherit the window's clip rect: a scrolling stack
          inside composes its own viewport planes with these rather than
          replacing them, so its content stays inside BOTH boxes. A
          volumetric window publishes nothing, because it clips nothing. */}
      <ClipContext.Provider value={isVolumetric ? null : clipPlanes}>
      <group
        ref={contentClipRef}
        position={[0, win.scrollable ? (win.scrollY || 0) : 0, 0]}
        onWheel={!win.scrollable ? undefined : (e) => {
          e.stopPropagation()
          // Compute the cumulative content height so we can clamp the
          // scroll to the natural overflow. `computeSize` returns
          // intrinsic dims (units) so the math works in scene units.
          let total = 0
          for (const c of contentChildren) {
            const [, ch] = computeSize(c, items)
            total += ch
          }
          const padU = ptToUnits(win.padding ?? 14)
          const maxScroll = Math.max(0, total - (h - padU * 2))
          if (maxScroll === 0) return
          const cur = Number(win.scrollY) || 0
          const next = Math.max(0, Math.min(maxScroll, cur + e.deltaY * 0.0015))
          if (Math.abs(next - cur) > 0.0001) {
            updateItem(win.id, { scrollY: next })
          }
        }}
      >
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
          // Navigation Bar is window chrome — it pins to the top edge,
          // spans the full window width (bypassing the 14pt content
          // padding), and locks to 92pt tall. The chip sits just in
          // front of the window plate (~3mm) so it reads as flush with
          // the glass rather than floating above the content layer.
          if (c.type === 'panel' && c.panelType === 'navbar') {
            const navH = ptToUnits(NAVBAR_HEIGHT_PT)
            const topY = h / 2 - navH / 2
            const zNav = scene.preview3D ? 0.003 : 0.002
            return <Panel3D key={c.id} panel={c} localPosition={[0, topY, zNav]} resolvedSize={[w, navH]} />
          }
          return <Panel3D key={c.id} panel={c} localPosition={pos} />
        })
      })()}

      {/* RealityKit entities sitting directly under the window stay
          INSIDE the clipped content group so a too-large model doesn't
          spill past the plate. */}
      {entityChildren.length > 0 && (
        <EntityChildren hostId={win.id} items={items} scene={scene} />
      )}
      </group>
      </ClipContext.Provider>

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

      {/* Presentation overlays — rendered above the window content. In
          SwiftUI these attach to the parent as `.sheet(…)` / `.alert(…)` /
          `.confirmationDialog(…)` / `.popover(…)` / `.inspector(…)`
          modifiers, so they are presented over the view rather than flowing
          inside it. The canvas knew about only three of the five until phase
          1.3, which laid a `confirmationdialog` or an `inspector` out as an
          ordinary child on screen while the code emitted it as a modal — the
          wrong place, not merely the wrong pixels. AUDIT #7.

          They are placed by kind, because SwiftUI does not present them the
          same way: modals sit centred over a dimmed plate, a popover hangs
          off the edge its arrow points from, and an inspector is a trailing
          column in a split — no dimming, because it is not modal. */}
      {presentationChildren.length > 0 && (() => {
        const inspectorKids = presentationChildren.filter((p) => p.panelType === 'inspector')
        const modalKids = presentationChildren.filter((p) => p.panelType !== 'inspector')
        // The inspector column eats into the width the modals have to sit in,
        // the way a real split view would.
        const inspectorW = inspectorKids.reduce((acc, p) => acc + inspectorWidth(p), 0)
        const bodyW = Math.max(ptToUnits(40), w - inspectorW)
        return (
          <>
            {/* Dimming backdrop — only for the modal kinds, and only over the
                body, so an inspector column beside them stays legible. */}
            {modalKids.length > 0 && (
              <mesh position={[-inspectorW / 2, 0, 0.04]}>
                <planeGeometry args={[bodyW, h]} />
                <meshBasicMaterial color="#000000" transparent opacity={0.35} />
              </mesh>
            )}
            {modalKids.map((p) => {
              // SwiftUI modals get a small margin on every side rather than
              // pinning to the window edges. 8% inset reads as a comfortable
              // frame; the content still lays out at its declared size until
              // that exceeds the window minus insets, then we clamp.
              const maxW = bodyW * 0.92
              const maxH = h * 0.92
              const [pw, ph] = Array.isArray(p.size) ? p.size : [maxW, maxH]
              const clamped = [Math.min(pw, maxW), Math.min(ph, maxH)]
              let px = -inspectorW / 2
              let py = 0
              if (p.panelType === 'sheet') {
                // `.presentationDetents(.medium)` pushes the sheet toward the
                // bottom; otherwise sheets centre inside the window.
                py = p.sheetDetent === 'medium' ? -(h - clamped[1]) / 2 * 0.9 : 0
              } else if (p.panelType === 'popover') {
                // A popover is anchored to its source rather than centred, and
                // `arrowEdge` names the side the arrow comes OUT of — so the
                // body sits on the opposite side of the anchor. visionOS
                // ignores the argument, but the canvas is previewing a
                // document that also targets iPadOS and macOS, where it is the
                // difference between a menu above the button and below it.
                const gap = ptToUnits(12)
                const edge = p.popoverArrowEdge || 'automatic'
                if (edge === 'top')      py =  (h - clamped[1]) / 2 - gap
                if (edge === 'bottom')   py = -(h - clamped[1]) / 2 + gap
                if (edge === 'leading')  px += -(bodyW - clamped[0]) / 2 + gap
                if (edge === 'trailing') px +=  (bodyW - clamped[0]) / 2 - gap
              }
              return (
                <group key={p.id}>
                  <Panel3D
                    panel={p}
                    localPosition={[px, py, 0.05]}
                    resolvedSize={clamped}
                  />
                  {p.panelType === 'popover' && (
                    <PopoverArrow3D
                      panel={p}
                      centre={[px, py]}
                      size={clamped}
                      scene={scene}
                    />
                  )}
                </group>
              )
            })}
            {/* Inspector — a trailing column pinned to the full window
                height, at the width `.inspectorColumnWidth(…)` asks for. */}
            {inspectorKids.map((p, i) => {
              const iw = inspectorWidth(p)
              const offsetFromTrailing = inspectorKids
                .slice(0, i)
                .reduce((acc, q) => acc + inspectorWidth(q), 0)
              const px = w / 2 - iw / 2 - offsetFromTrailing
              return (
                <group key={p.id}>
                  {/* The split's divider, on the column's leading edge. */}
                  <mesh position={[px - iw / 2, 0, 0.049]}>
                    <planeGeometry args={[ptToUnits(1), h]} />
                    <meshBasicMaterial color={resolveSemantic('separator', scene)} transparent opacity={0.6} />
                  </mesh>
                  <Panel3D
                    panel={p}
                    localPosition={[px, 0, 0.05]}
                    resolvedSize={[iw, h]}
                  />
                </group>
              )
            })}
          </>
        )
      })()}
    </group>
  )
}

// ---- Page tab navigation bar (floating, left of the primary window) ----
// visionOS-style vertical pill of page tabs. Appears whenever there are two
// or more Tabs in the scene — clicking an icon switches the active page.
// Height scales with tab count so it never wastes space.

function PageTabBar3D({ tabs, activeTabId, anchorPosition, anchorWidth, scene, selectTab }) {
  const tabW = ptToUnits(56)
  const tabH = ptToUnits(56)
  const padding = ptToUnits(10)
  const gap = ptToUnits(6)
  const barW = tabW + padding * 2
  const barH = tabs.length * tabH + (tabs.length - 1) * gap + padding * 2
  const tint = scene.tintColor || '#007aff'
  const dimColor = resolveSemantic('secondary', scene)
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
          color={resolveSemantic('glassThick', scene)}
          transparent
          opacity={0.88}
        />
      </mesh>

      {/* Stack the tabs top → bottom so the order matches the layers panel. */}
      {tabs.map((tab, i) => {
        const yOffset = barH / 2 - padding - tabH / 2 - i * (tabH + gap)
        const active = tab.id === activeTabId
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
            <SymbolIcon3D
              name={tab.icon || 'folder'}
              sizeUnits={ptToUnits(22)}
              color={active ? tint : dimColor}
              weight={active ? 'semibold' : 'regular'}
              position={[0, ptToUnits(6), 0.001]}
            />
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

// ---- Window-group tab bar (floating, left of the active window) -------
//
// Vertical capsule of pills, one per unique `windowGroupId` in the active
// tab. The pill's icon comes from the *first* (representative) window of
// that group; its label is the representative window's name.
//
// Sizing (visionOS-style, per user spec):
//   - 44pt icon chip (collapsed default)
//   - 12pt outer padding on all sides
//   - 12pt gap between chips
//   - Total height = 2·pad + N·44 + (N-1)·12 = 12 + 56·N pt
//   - Collapsed width  = 44 + 2·pad = 68 pt
//   - Expanded width   = 150 pt (preview-mode hover only) — labels appear
//     to the right of each icon; the bar's left edge stays anchored.
//
// Click a pill to switch the active group: the open-window set resets to
// just that group's primary representative, so opened side-by-side
// instances from any other group disappear (matches the user's
// "switch tab and both disappear" expectation).

function WindowGroupTabBar3D({ groups, activeGroupId, anchorPosition, anchorWidth, scene, onSelect, lane = 'inner' }) {
  const [hovered, setHovered] = useState(false)
  // Hover-expand is preview-only. In editor mode the bar stays compact —
  // pill click switches the design view but expanding into labels would
  // crowd the chrome the user is positioning.
  const expandedTarget = hovered && !!scene.previewMode

  // Sizing constants (visionOS spec from the user):
  //   - 44×44pt icon chip
  //   - 12pt padding on all four sides
  //   - 12pt gap between chips
  //   - Outer corner radius = 34pt (matches the collapsed half-width so
  //     the bar reads as a true capsule; preserved when expanded so the
  //     left rim still looks like a half-circle next to the icons)
  //   - Collapsed bar width  = 44 + 24 = 68pt
  //   - Expanded bar width   = 150pt (preview-mode hover only)
  const TAB_SIZE_PT = 44
  const PAD_PT = 12
  const GAP_PT = 12
  const COLLAPSED_W_PT = TAB_SIZE_PT + PAD_PT * 2
  const EXPANDED_W_PT  = 150
  const CORNER_PT      = 34
  const tabH = ptToUnits(TAB_SIZE_PT)
  const tabW = ptToUnits(TAB_SIZE_PT)
  const padding = ptToUnits(PAD_PT)
  const gap = ptToUnits(GAP_PT)
  const collapsedBarW = ptToUnits(COLLAPSED_W_PT)
  const expandedBarW  = ptToUnits(EXPANDED_W_PT)
  const targetBarW = expandedTarget ? expandedBarW : collapsedBarW

  // Animated width — lerps toward the target every frame so the bar
  // glides between the 68pt and 150pt states instead of snapping. Same
  // pattern used by Panel3D for hover lift/scale. We only call setState
  // while the value is still travelling toward the target; once it
  // snaps to the target React stops re-rendering.
  const [animBarW, setAnimBarW] = useState(collapsedBarW)
  useFrame((_, delta) => {
    if (Math.abs(targetBarW - animBarW) < 0.0001) return
    setAnimBarW((prev) => {
      const diff = targetBarW - prev
      if (Math.abs(diff) < 0.0001) return targetBarW
      // Ease-out lerp tuned to ~120ms full travel at 60fps.
      const k = Math.min(1, delta * 14)
      const next = prev + diff * k
      // Snap when we're within half a pt of the target so we stop
      // re-rendering on the very last few frames.
      return Math.abs(targetBarW - next) < ptToUnits(0.5) ? targetBarW : next
    })
  })

  const barW = animBarW
  const barH = groups.length * tabH + Math.max(0, groups.length - 1) * gap + padding * 2
  const tint = scene.tintColor || '#007aff'
  const dimColor = resolveSemantic('secondary', scene)
  const gapFromWindow = ptToUnits(24)
  const laneOffset = lane === 'outer' ? collapsedBarW + ptToUnits(12) : 0

  // The bar's left edge stays anchored when it expands — the right edge
  // is the one that moves outward to reveal labels. So the centre shifts
  // right by (animBarW - collapsedBarW) / 2 as it grows.
  const xCenter = anchorPosition[0] - anchorWidth / 2 - gapFromWindow - collapsedBarW / 2 - laneOffset
  const x = xCenter + (barW - collapsedBarW) / 2
  const y = anchorPosition[1]
  const z = anchorPosition[2]

  // Fixed 34pt outer corner radius — keeps the left half a perfect
  // half-circle in both states (44pt chip + 12pt outer pad = 34pt
  // radius). Capped to half the bar height so a 1-pill bar still reads
  // as a capsule.
  const cornerRadius = Math.min(ptToUnits(CORNER_PT), barH / 2)
  const bgShape = useMemo(
    () => roundedRectShape(barW, barH, cornerRadius),
    [barW, barH, cornerRadius]
  )

  // Label fade-in: opacity tracks the bar's progress from collapsed to
  // expanded so labels swell in alongside the expansion instead of
  // popping when expanded toggles.
  const expandProgress = (barW - collapsedBarW) / (expandedBarW - collapsedBarW)
  const labelOpacity = Math.max(0, Math.min(1, expandProgress))

  return (
    <group
      position={[x, y, z]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => setHovered(false)}
    >
      <mesh position={[0, 0, -0.005]}>
        <shapeGeometry args={[bgShape]} />
        <meshBasicMaterial
          color={resolveSemantic('glassThick', scene)}
          transparent
          opacity={0.88}
        />
      </mesh>

      {groups.map((g, i) => {
        const yOffset = barH / 2 - padding - tabH / 2 - i * (tabH + gap)
        const active = g.id === activeGroupId
        // The active tint chip extends rightward as the bar expands so
        // it always sits behind the full icon+label run. Inner area =
        // animBarW - 2*padding (matches the inner gutter). When fully
        // collapsed the chip is exactly the 44pt icon square; when
        // expanded it covers icon + label with the same height + rounded
        // ends (a small capsule). Always centred at x=0 inside the bar.
        const chipW = Math.max(tabW, barW - padding * 2)
        const chipShape = roundedRectShape(chipW, tabH, tabH / 2)
        // Pin icon to the left of the bar; the label butts directly
        // against the icon's right edge (no horizontal gap).
        const iconX = -barW / 2 + padding + tabW / 2
        const labelX = iconX + tabW / 2  // right edge of icon
        return (
          <group
            key={g.id}
            position={[0, yOffset, 0.005]}
            onPointerDown={(e) => {
              e.stopPropagation()
              onSelect(g.id)
            }}
          >
            {active && (
              <mesh position={[0, 0, -0.001]}>
                <shapeGeometry args={[chipShape]} />
                <meshBasicMaterial color={tint} transparent opacity={0.18} />
              </mesh>
            )}
            <SymbolIcon3D
              name={g.icon || 'rectangle'}
              sizeUnits={ptToUnits(24)}
              color={active ? tint : dimColor}
              weight={active ? 'semibold' : 'regular'}
              position={[iconX, 0, 0.001]}
            />
            {labelOpacity > 0.01 && (
              <Text
                position={[labelX, 0, 0.001]}
                font={getInterFont('medium')}
                fontSize={ptToUnits(13)}
                color={active ? tint : dimColor}
                fillOpacity={labelOpacity}
                anchorX="left"
                anchorY="middle"
                maxWidth={ptToUnits(EXPANDED_W_PT - PAD_PT - TAB_SIZE_PT - PAD_PT)}
              >
                {g.label}
              </Text>
            )}
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
  const setActiveWindowGroup = useStore((s) => s.setActiveWindowGroup)

  // Only windows belonging to the active Tab render. Inactive tabs keep their
  // windows in the data but don't paint in the 3D scene.
  const windows = items.filter(
    (it) =>
      it.type === 'window' &&
      it.visible !== false &&
      it.parentId === activeTabId
  )
  const tabs = items.filter((it) => it.type === 'tab')

  // Dedupe by windowGroupId. Each unique id becomes one pill on the
  // navigation capsule; the first matching window in document order is
  // the "representative" and supplies the pill's icon + label.
  const groups = (() => {
    const seen = new Map()
    for (const w of windows) {
      const gid = w.windowGroupId || w.name || w.id
      if (!seen.has(gid)) {
        seen.set(gid, {
          id: gid,
          icon: w.tabIcon || 'rectangle',
          label: w.name || gid,
          firstItemId: w.id
        })
      }
    }
    return Array.from(seen.values())
  })()

  // Resolve the active group id. If the scene hasn't set one yet, fall
  // back to the first group's id so a fresh scene previews cleanly.
  const activeGroupId = scene.activeWindowGroupId || groups[0]?.id || null

  // Resolve the open-window set for preview mode.
  //   - If the scene has explicit `openWindowItemIds`, honour it.
  //   - Otherwise default to the primary representative of the active
  //     group (one window open, ready for openWindow() to extend it).
  const openIds = (() => {
    if (scene.openWindowItemIds && scene.openWindowItemIds.length > 0) {
      return scene.openWindowItemIds.filter((id) =>
        windows.some((w) => w.id === id)
      )
    }
    const primary = scene.primaryWindowId
      || groups.find((g) => g.id === activeGroupId)?.firstItemId
      || windows[0]?.id
      || null
    return primary ? [primary] : []
  })()

  // In preview, lay the open windows out as one centred row at chest
  // height, 60pt gap between plates. In editor, each window stays at its
  // stored design position so the canvas reads as the layout the user
  // is authoring. `previewPosByItem` is `{ [itemId]: [x, y, z] | null }`
  // — null entries get hidden in preview (Window3D returns null).
  const previewPosByItem = (() => {
    if (!scene.previewMode) return new Map()
    const openWindows = openIds
      .map((id) => windows.find((w) => w.id === id))
      .filter(Boolean)
    if (openWindows.length === 0) return new Map()
    const gap = ptToUnits(60)
    const totalW = openWindows.reduce((acc, w) => acc + w.size[0], 0)
                 + Math.max(0, openWindows.length - 1) * gap
    const baseY = 1.4
    const baseZ = -1.0
    const map = new Map()
    let cursor = -totalW / 2
    for (const w of openWindows) {
      map.set(w.id, [cursor + w.size[0] / 2, baseY, baseZ])
      cursor += w.size[0] + gap
    }
    return map
  })()

  // Anchor the navigation capsule to the leftmost rendered window:
  //   - In preview, that's the first window in the open set (already at
  //     a known x).
  //   - In editor, that's the leftmost design position.
  const anchor = scene.previewMode
    ? (() => {
        const firstId = openIds[0]
        const w = windows.find((x) => x.id === firstId)
        if (!w) return null
        const pos = previewPosByItem.get(w.id) || w.position
        return { position: pos, size: w.size }
      })()
    : windows.reduce(
        (acc, w) => (!acc || w.position[0] < acc.position[0] ? w : acc),
        null
      )

  const showWindowGroupBar = groups.length >= 2
  const showPageTabBar = tabs.length >= 2

  return (
    <>
      {windows.map((w) => (
        <Window3D
          key={w.id}
          window={w}
          items={items}
          previewPosition={previewPosByItem.get(w.id) || null}
        />
      ))}
      {showPageTabBar && anchor && (
        <PageTabBar3D
          tabs={tabs}
          activeTabId={activeTabId}
          anchorPosition={anchor.position}
          anchorWidth={anchor.size[0]}
          scene={scene}
          selectTab={selectTab}
        />
      )}
      {showWindowGroupBar && anchor && (
        <WindowGroupTabBar3D
          groups={groups}
          activeGroupId={activeGroupId}
          anchorPosition={anchor.position}
          anchorWidth={anchor.size[0]}
          scene={scene}
          onSelect={setActiveWindowGroup}
          lane={showPageTabBar ? 'outer' : 'inner'}
        />
      )}
    </>
  )
}
