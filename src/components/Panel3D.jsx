import { useRef, useState, useMemo, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Text, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { resolveHoverEffect } from '../store/helpers'
import { roundedRectShape, rimRingShape, ellipseShape, unevenRoundedRectShape } from '../shapes'
import {
  resolveSemantic,
  resolveAnyMaterial,
  isGlassMaterialKey,
  TEXT_STYLES,
  ptToUnits,
  LIST_STYLES,
  computeListHeightPt,
  computeButtonFramePt,
  buttonSizePreset,
  buttonRadiusPt,
  applyAspectRatio,
  outlineVisibleRows,
  PICKER_STYLES_SHOWING_OPTIONS,
  MENU_STYLES_AS_BUTTON,
  dateComponentsParts,
  controlFraction,
  valueFromFraction,
  mixHex,
  NAVBAR_STYLE_SPECS,
  NAVBAR_SIDE_PADDING_PT,
  NAVBAR_ITEM_PT,
  NAVBAR_ITEM_GAP_PT,
  NAVBAR_AVATAR_PT,
  NAVBAR_SEARCH_W_PT,
  NAVBAR_BACK_CAPSULE_W_PT,
  NAVBAR_BACK_ICON_TEXT_GAP_PT,
  textStyleDefaultWeight
} from '../appleSystem'
import { getInterFont } from '../fonts'
import { summarizeModifiers } from '../modifiers/registry'
import { measureSwiftUIText, singleLineWidth } from '../text'
import { EntityChildren } from './Entity3D'
import { SymbolIcon3D } from './SymbolIcon3D'

const DEG2RAD = Math.PI / 180

// Paints a SwiftUI-style gradient into an offscreen canvas and returns it
// as a THREE.CanvasTexture. Used by the shape overlays to render
// LinearGradient / RadialGradient / AngularGradient in the canvas.
//
// `kind` ∈ 'linear' | 'radial' | 'angular' | null (null = skip; returns null)
// `angleDeg` is the SwiftUI start→end angle for linear (0° = top→bottom),
// matching the inspector's Angle field. For radial / angular it's ignored.
// The hook disposes the previous texture when its deps change so panels
// don't leak GPU memory across edits.
function useGradientTexture({ kind, from, to, angleDeg = 180 }) {
  const texRef = useRef(null)
  const tex = useMemo(() => {
    if (texRef.current) {
      texRef.current.dispose()
      texRef.current = null
    }
    if (!kind || typeof document === 'undefined') return null
    const canvas = document.createElement('canvas')
    const N = 256
    canvas.width = N
    canvas.height = N
    const ctx = canvas.getContext('2d')
    const a = from || '#007aff'
    const b = to   || '#af52de'
    if (kind === 'linear') {
      const rad = ((angleDeg ?? 180) * Math.PI) / 180
      // SwiftUI: 0° = startPoint .top (top→bottom). Match by rotating
      // the gradient vector from the canvas center.
      const cx = N / 2, cy = N / 2
      const dx = Math.sin(rad) * (N / 2)
      const dy = -Math.cos(rad) * (N / 2)
      const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy)
      g.addColorStop(0, a)
      g.addColorStop(1, b)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, N, N)
    } else if (kind === 'radial') {
      const cx = N / 2, cy = N / 2
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, N / 2)
      g.addColorStop(0, a)
      g.addColorStop(1, b)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, N, N)
    } else if (kind === 'angular') {
      // Conic gradient — fall back to manual pie slices if unsupported.
      if (typeof ctx.createConicGradient === 'function') {
        const g = ctx.createConicGradient(-Math.PI / 2, N / 2, N / 2)
        g.addColorStop(0, a)
        g.addColorStop(1, b)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, N, N)
      } else {
        const steps = 64
        for (let i = 0; i < steps; i++) {
          const t = i / steps
          const ang0 = -Math.PI / 2 + t * Math.PI * 2
          const ang1 = -Math.PI / 2 + ((i + 1) / steps) * Math.PI * 2
          const c1 = new THREE.Color(a).lerp(new THREE.Color(b), t).getStyle()
          ctx.beginPath()
          ctx.moveTo(N / 2, N / 2)
          ctx.arc(N / 2, N / 2, N, ang0, ang1)
          ctx.closePath()
          ctx.fillStyle = c1
          ctx.fill()
        }
      }
    }
    const next = new THREE.CanvasTexture(canvas)
    next.needsUpdate = true
    texRef.current = next
    return next
  }, [kind, from, to, angleDeg])
  // Unmount cleanup — drop the GPU resource when the panel goes away.
  useEffect(() => () => {
    if (texRef.current) { texRef.current.dispose(); texRef.current = null }
  }, [])
  return tex
}

// Builds a ShapeGeometry whose UVs map edge-to-edge across the shape's
// bounding box — same trick `ImageTextureMesh` uses so a CanvasTexture
// fills the shape cleanly regardless of its outline.
function buildUvShapeGeometry(shape, w, h) {
  const g = new THREE.ShapeGeometry(shape, 32)
  const pos = g.attributes.position
  const uvs = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2]     = (pos.getX(i) + w / 2) / w
    uvs[i * 2 + 1] = (pos.getY(i) + h / 2) / h
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  return g
}

// Renders an image onto a rounded-rect shape. We draw the image into an
// offscreen canvas first so we can apply the fit mode (stretch / fill (cover)
// / fit (contain) / tile) with correct aspect handling — the canvas is then
// used as a CanvasTexture on a shapeGeometry, giving us corner-radius
// clipping "for free" along with transparent letterboxing where appropriate.
function ImageTextureMesh({ url, size, cornerRadius, imageFit = 'fill' }) {
  const [texture, setTexture] = useState(null)
  const [w, h] = size

  useEffect(() => {
    if (!url) { setTexture(null); return }
    let disposed = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (disposed) return
      const CANVAS_W = 1024
      const CANVAS_H = Math.max(16, Math.round(CANVAS_W * (h / Math.max(0.001, w))))
      const canvas = document.createElement('canvas')
      canvas.width = CANVAS_W
      canvas.height = CANVAS_H
      const ctx = canvas.getContext('2d')
      const iw = img.naturalWidth || img.width
      const ih = img.naturalHeight || img.height
      const ra = iw / ih
      const rm = CANVAS_W / CANVAS_H

      if (imageFit === 'stretch') {
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H)
      } else if (imageFit === 'fit') {
        // contain — letterbox with transparent background
        let dw, dh
        if (ra > rm) { dw = CANVAS_W; dh = CANVAS_W / ra }
        else         { dh = CANVAS_H; dw = CANVAS_H * ra }
        const dx = (CANVAS_W - dw) / 2
        const dy = (CANVAS_H - dh) / 2
        ctx.drawImage(img, dx, dy, dw, dh)
      } else if (imageFit === 'tile') {
        // Repeat the image at a modest tile size relative to the shape's
        // short side so several copies are visible.
        const pattern = ctx.createPattern(img, 'repeat')
        if (pattern) {
          const shortCanvas = Math.min(CANVAS_W, CANVAS_H)
          const scale = (shortCanvas / 3) / Math.max(iw, ih)
          ctx.save()
          ctx.scale(scale, scale)
          ctx.fillStyle = pattern
          ctx.fillRect(0, 0, CANVAS_W / scale, CANVAS_H / scale)
          ctx.restore()
        }
      } else {
        // 'fill' / default — cover, center-crop
        let sw, sh
        if (ra > rm) { sh = ih; sw = ih * rm }
        else         { sw = iw; sh = iw / rm }
        const sx = (iw - sw) / 2
        const sy = (ih - sh) / 2
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, CANVAS_W, CANVAS_H)
      }

      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.needsUpdate = true
      setTexture(tex)
    }
    img.onerror = () => setTexture(null)
    img.src = url
    return () => { disposed = true }
  }, [url, imageFit, w, h])

  // Dispose textures when replaced.
  useEffect(() => {
    return () => { if (texture) texture.dispose() }
  }, [texture])

  // Rounded-rect geometry clips the image to the panel's corner radius.
  const geometry = useMemo(() => {
    const r = Math.max(0, Math.min(cornerRadius || 0, Math.min(w, h) / 2 - 0.0001))
    const shape = roundedRectShape(w, h, r)
    const g = new THREE.ShapeGeometry(shape, 16)
    // ShapeGeometry's default UVs are the vertex XY — normalize to 0..1 so
    // the canvas texture maps edge-to-edge across the shape's bounding box.
    const pos = g.attributes.position
    const uvs = new Float32Array(pos.count * 2)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      uvs[i * 2]     = (x + w / 2) / w
      uvs[i * 2 + 1] = (y + h / 2) / h
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    return g
  }, [w, h, cornerRadius])

  if (!texture) return null
  return (
    <mesh position={[0, 0, 0.003]} geometry={geometry}>
      <meshBasicMaterial map={texture} transparent side={THREE.DoubleSide} />
    </mesh>
  )
}

// RealityView panel — bridge to the RealityKit entity tree. The panel
// itself is just a SwiftUI view (a flat frame in the canvas), but its
// child entities render inside it. Drawn invisibly by default so the
// 3D content reads cleanly; selection bumps it to a soft outline so
// the user can see the panel's bounds when editing.
function RealityViewPanel3D({ panel, localPosition, resolvedSize }) {
  const scene = useStore((s) => s.scene)

  const items = useStore((s) => s.items)
  const select = useStore((s) => s.select)
  const selectedId = useStore((s) => s.selectedId)
  // Selection halos are an editor affordance — suppress them entirely
  // in preview so the wearer sees just the app chrome they're meant to.
  const isSelected = !scene.previewMode && selectedId === panel.id
  // The frame also shows when the user has any descendant of this RV
  // selected — that's when they care about the bounds the most. In
  // preview we suppress the frame entirely so the wearer doesn't see
  // a stale "this thing was selected" tint.
  const isContextActive = useMemo(() => {
    if (scene.previewMode) return false
    if (isSelected) return true
    if (!selectedId) return false
    let cur = items.find((it) => it.id === selectedId)
    while (cur && cur.parentId) {
      if (cur.parentId === panel.id) return true
      cur = items.find((it) => it.id === cur.parentId)
    }
    return false
  }, [scene.previewMode, isSelected, selectedId, items, panel.id])

  const size = (resolvedSize && Array.isArray(resolvedSize))
    ? resolvedSize
    : (Array.isArray(panel.size) ? panel.size : [ptToUnits(360), ptToUnits(360)])
  const [w, h] = size
  const cornerRadius = panel.cornerRadius ?? 0
  const fillShape = useMemo(
    () => roundedRectShape(w, h, cornerRadius),
    [w, h, cornerRadius]
  )
  // Outline padding — same hairline metric as windows/stacks so a
  // selected panel reads as a thin tint ring rather than a fat halo.
  const rvOutlinePad = Math.max(w, h) * 0.0025
  const outlineShape = useMemo(
    () => roundedRectShape(w + rvOutlinePad, h + rvOutlinePad, cornerRadius + rvOutlinePad / 2),
    [w, h, cornerRadius, rvOutlinePad]
  )
  const tint = scene.tintColor || '#007aff'

  const onPointerDown = (e) => { e.stopPropagation(); select(panel.id) }

  return (
    <group position={localPosition || [0, 0, 0]}>
      {isSelected && (
        <mesh position={[0, 0, -0.012]}>
          <shapeGeometry args={[outlineShape]} />
          <meshBasicMaterial color={tint} transparent opacity={0.28} />
        </mesh>
      )}

      {/* Frame outline — only shows when the RV (or one of its
          descendants) is actively being edited. Dimmed strokes when a
          descendant is the focus; brighter when the panel itself is
          selected. The hit target stays full-size + invisible so
          clicking inside an "empty" RV always works. */}
      {isContextActive && (
        <mesh position={[0, 0, -0.004]}>
          <shapeGeometry args={[fillShape]} />
          <meshBasicMaterial color={tint} transparent opacity={isSelected ? 0.08 : 0.04} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Always-on, completely transparent hit target so the panel is
          still clickable / draggable even when its frame is hidden. */}
      <mesh position={[0, 0, -0.005]} onPointerDown={onPointerDown} visible={false}>
        <shapeGeometry args={[fillShape]} />
        <meshBasicMaterial color="#000000" transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>

      {/* "RealityView" tag — only shown while the user is editing this
          RV (selected or has a descendant selected) so it doesn't
          permanently overlay the design. */}
      {isContextActive && (
        <Text
          position={[-w / 2 + ptToUnits(10), h / 2 - ptToUnits(10), 0.001]}
          fontSize={ptToUnits(9)}
          color={tint}
          anchorX="left"
          anchorY="middle"
          font={getInterFont('semibold')}
          fillOpacity={0.7}
        >
          RealityView
        </Text>
      )}

      {/* Optional XYZ axes gizmo at the RealityView origin — designer
          aid only; doesn't affect Swift export. */}
      {panel.showAnchorAxes && (
        <group>
          <mesh position={[0.04, 0, 0]}>
            <boxGeometry args={[0.08, 0.001, 0.001]} />
            <meshBasicMaterial color="#ff5252" />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <boxGeometry args={[0.001, 0.08, 0.001]} />
            <meshBasicMaterial color="#7ee787" />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.001, 0.001, 0.08]} />
            <meshBasicMaterial color="#79c0ff" />
          </mesh>
        </group>
      )}

      {/* Entity tree — child entities render at their own metres-native
          positions in the local space of this RealityView. */}
      <EntityChildren hostId={panel.id} items={items} scene={scene} />
    </group>
  )
}

// Dispatcher between the two panel renderers. It calls no hooks itself, so a
// panel switching between `realityview` and anything else swaps one component
// type for another: React unmounts one and mounts the other, and the hook
// order inside each stays fixed.
//
// The branch used to live inside the single component below, above all of its
// hooks. That is a rules-of-hooks violation — every hook after it is called
// conditionally, and React throws the moment a mounted panel crosses the
// branch. It was latent only because `realityview` is not a
// `switchPanelType` target today.
// Canvas placeholder for the raw-Swift escape hatch.
//
// There is no honest way to draw a view whose source we never parse, so the
// node renders as a labelled slab at the frame the real view will occupy.
// That keeps the surrounding stack laying out against the right box while
// being unmistakably not-a-preview: a designer should never have to wonder
// whether what they see here is what the device will draw.
function CustomSwift3D({ panel, localPosition, resolvedSize }) {
  const scene = useStore((s) => s.scene)
  const select = useStore((s) => s.select)
  const selectedId = useStore((s) => s.selectedId)
  const isSelected = !scene.previewMode && selectedId === panel.id

  const size = (resolvedSize && Array.isArray(resolvedSize))
    ? resolvedSize
    : (Array.isArray(panel.size) ? panel.size : [ptToUnits(240), ptToUnits(80)])
  const [w, h] = size
  const cornerRadius = panel.cornerRadius ?? ptToUnits(12)
  const fillShape = useMemo(() => roundedRectShape(w, h, cornerRadius), [w, h, cornerRadius])

  const outlinePad = Math.max(w, h) * 0.0025
  const outlineShape = useMemo(
    () => roundedRectShape(w + outlinePad, h + outlinePad, cornerRadius + outlinePad / 2),
    [w, h, cornerRadius, outlinePad]
  )

  const tint = scene.tintColor || '#007aff'
  const fontUrl = getInterFont('medium')
  const monoUrl = getInterFont('regular')

  // First non-blank source line, trimmed and clipped — enough to tell two
  // custom nodes apart in the layers tree without trying to render the body.
  const preview = useMemo(() => {
    const first = String(panel.code ?? '')
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0) || 'empty'
    return first.length > 34 ? `${first.slice(0, 33)}…` : first
  }, [panel.code])

  const onPointerDown = (e) => { e.stopPropagation(); select(panel.id) }

  return (
    <group position={localPosition || [0, 0, 0]}>
      {isSelected && (
        <mesh position={[0, 0, -0.012]}>
          <shapeGeometry args={[outlineShape]} />
          <meshBasicMaterial color={tint} transparent opacity={0.28} />
        </mesh>
      )}
      <mesh position={[0, 0, -0.001]} onPointerDown={onPointerDown}>
        <shapeGeometry args={[fillShape]} />
        <meshBasicMaterial color={panel.color || '#2a2f3a'} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
      <Text
        position={[0, ptToUnits(7), 0.004]}
        font={fontUrl}
        fontSize={ptToUnits(12)}
        color={resolveSemantic('primary', scene)}
        anchorX="center"
        anchorY="middle"
        maxWidth={w * 0.9}
      >
        {panel.label || 'Custom Swift'}
      </Text>
      <Text
        position={[0, -ptToUnits(8), 0.004]}
        font={monoUrl}
        fontSize={ptToUnits(9)}
        color={tint}
        anchorX="center"
        anchorY="middle"
        maxWidth={w * 0.9}
      >
        {preview}
      </Text>
    </group>
  )
}

export default function Panel3D(props) {
  const { panelType } = props.panel
  if (panelType === 'realityview') {
    return <RealityViewPanel3D {...props} />
  }
  // Raw Swift is never interpreted — it draws a placeholder at its frame.
  if (panelType === 'custom') {
    return <CustomSwift3D {...props} />
  }
  // A Spacer is an invisible flexible gap: the layout engine reserves its
  // space, and there is nothing to draw. Handled here so the renderer below
  // never has to return before its hooks.
  if (panelType === 'spacer') {
    return <group position={props.localPosition || [0, 0, 0]} />
  }
  return <PanelSurface3D {...props} />
}

// Every other panel type: text, controls, shapes, gradients, images, 3D
// primitives and presentation overlays.
function PanelSurface3D({ panel, localPosition, resolvedSize }) {
  const { id, panelType } = panel
  // SwiftUI modifiers live in `panel.modifiers` as an ordered array. Reduce
  // it to a flat preview struct (last-write-wins per visual prop) so the
  // canvas can approximate what SwiftUI will render. The exporter walks the
  // array in order to preserve true chain semantics.
  const modSummary = summarizeModifiers(panel.modifiers)
  // Size resolution precedence:
  //   1. `resolvedSize` — width/height the parent stack handed us (honours
  //      `widthMode: 'fill'` expansions).
  //   2. For text/link with widthMode 'fit' and no explicit size — intrinsic.
  //   3. panel.size — explicit user-set frame.
  //   4. auto-estimate from text content (legacy fallback).
  const rawSize = (() => {
    // Button: height locked to the Size preset, width grows with the label
    // so a longer string still fits on one line with 12pt side padding.
    // Runs BEFORE the resolvedSize check so the parent stack's auto-layout
    // doesn't crush a long-label button back down to the preset width.
    // See computeButtonFramePt in appleSystem.js for the math.
    if (panelType === 'button') {
      const [wPt, hPt] = computeButtonFramePt(panel)
      return [ptToUnits(wPt), ptToUnits(hPt)]
    }
    if (resolvedSize && Array.isArray(resolvedSize)) return resolvedSize
    const isTextLike = panelType === 'text' || panelType === 'link'
    if (isTextLike) {
      const mode = panel.widthMode || 'fit'
      // SwiftUI Text without a parent proposal sizes to its content. Run
      // the same measurement pipeline the layout engine uses so wrapped /
      // hard-line / fixedSize cases all reserve the right vertical space.
      // When the user has dialed in a `.frame(width:)` modifier we honour
      // it as the wrap bound — that's the value they see in the modifier
      // stack after picking "Fixed".
      const text = panel.text || ''
      const baseFontSize = panel.textStyle
        ? ptToUnits(TEXT_STYLES[panel.textStyle]?.pt ?? 17)
        : (panel.fontSize || ptToUnits(17))
      const frameWidthU = (typeof modSummary.frameWidth === 'number')
        ? ptToUnits(modSummary.frameWidth)
        : null
      const wrapBound = frameWidthU != null
        ? frameWidthU
        : (mode === 'fixed' && Array.isArray(panel.size)
            ? panel.size[0]
            : Number.POSITIVE_INFINITY)
      const m = measureSwiftUIText(text, baseFontSize, wrapBound, {
        trackingPt:    modSummary.tracking    || 0,
        lineSpacingPt: modSummary.lineSpacing || 0,
        lineLimit:     modSummary.lineLimit ?? null,
        truncationMode: modSummary.truncationMode || 'tail',
        minimumScaleFactor: modSummary.minimumScaleFactor ?? 1,
        allowsTightening:   !!modSummary.allowsTightening,
        fixedSizeH:         mode === 'fit' || !!modSummary.fixedSizeH,
        fixedSizeV:         !!modSummary.fixedSizeV,
        // Must match what layout.js reserved for this panel, or the box the
        // stack set aside and the text drawn into it disagree.
        fontWeight: panel.fontWeight
          || (panel.textStyle ? textStyleDefaultWeight(panel.textStyle) : 'regular')
      })
      const w = frameWidthU != null
        ? frameWidthU
        : (mode === 'fixed' && Array.isArray(panel.size)
            ? panel.size[0]
            : Math.max(ptToUnits(40), m.width))
      const h = mode === 'fixed' && panel.heightMode === 'fixed' && Array.isArray(panel.size)
        ? panel.size[1]
        : m.height
      return [w, h]
    }
    // List: height auto-derived from (row count × style row height) + style
    // pad. Apple doesn't let you set List row height or total height manually;
    // the list grows with its rows. Width stays user-editable.
    if (panelType === 'list') {
      const w = Array.isArray(panel.size) && panel.size[0] ? panel.size[0] : ptToUnits(360)
      const h = ptToUnits(computeListHeightPt(panel))
      return [w, h]
    }
    if (Array.isArray(panel.size)) return panel.size
    const text = panel.text || ''
    const fontSize = panel.fontSize || ptToUnits(17)
    // Legacy fallback for a panel carrying neither a resolved size nor an
    // explicit frame. Measured rather than estimated from character count so
    // it agrees with every other sizing path in the app.
    return [
      Math.max(ptToUnits(40), singleLineWidth(text, fontSize, 0, 1, panel.fontWeight)),
      fontSize * 1.5
    ]
  })()
  // `.aspectRatio` reshapes whatever frame the branches above produced. A
  // panel inside a stack already had it applied by `computeSize`, so this
  // matters for the free-placed case — and running the same helper on both
  // paths means a ratio can never mean one box here and another there.
  const size = applyAspectRatio(rawSize, modSummary.aspectRatio)
  // Input fields (text / secure / search) render a pill (capsule) by
  // default — the radius tracks the field height so it stays a true pill
  // at any size. The Edge toggle sets `fieldShape: 'rounded'` to fall back
  // to the stored corner radius.
  const isInputField = panelType === 'textfield' || panelType === 'securefield' || panelType === 'search'
  // Segmented controls are always a full pill (radius tracks the height),
  // matching SwiftUI's `.pickerStyle(.segmented)` track on visionOS.
  // A button's radius is derived from `buttonBorderShape` — the field the
  // exporter emits — rather than from a stored `cornerRadius` the inspector
  // had to keep in sync. `automatic` is visionOS's capsule default.
  const cornerRadius = ((isInputField && (panel.fieldShape || 'pill') === 'pill') || panelType === 'segmented')
    ? Math.min(size[0], size[1]) / 2
    : panelType === 'button'
      ? ptToUnits(buttonRadiusPt(panel.buttonBorderShape))
      : (panel.cornerRadius ?? 0)
  // Shape stroke (Rectangle / Circle / Capsule / Ellipse / UnevenRoundedRect)
  // — rendered as a slightly larger copy of the shape in `strokeColor`
  // placed BEHIND the fill. Half the width sits outside the shape's
  // visual edge, matching SwiftUI's `.stroke(_, lineWidth:)` semantics
  // closely enough for the editor preview.
  const strokeColor = panel.strokeColor || null
  const strokeWidth = strokeColor ? Math.max(0, ptToUnits(panel.strokeWidth || 0)) : 0
  const hasStroke   = !!strokeColor && strokeWidth > 0
  const scene = useStore((s) => s.scene)
  // `.tint` is the control accent — the colour sliders, toggles, progress
  // bars and gauges fill with. Every one of them read `scene.tintColor`
  // unconditionally before, so the modifier emitted correct Swift and the
  // canvas ignored it. Resolved here because the fill / text resolution
  // below needs it too. AUDIT #5.
  const accentColor = modSummary.tint || scene.tintColor || '#007aff'
  // `.foregroundStyle` is SwiftUI's own spelling for the content colour, so
  // it wins over the stored `textColor` the inspector's colour well writes.
  // The canvas read only the latter, which meant the two disagreed the moment
  // the designer reached for the modifier stack.
  const modForeground = modSummary.foregroundStyle || null
  const selectedId = useStore((s) => s.selectedId)
  const editingId = useStore((s) => s.editingId)
  const select = useStore((s) => s.select)
  const setEditing = useStore((s) => s.setEditing)
  const clearEditing = useStore((s) => s.clearEditing)
  const updateItem = useStore((s) => s.updateItem)
  const moveItem = useStore((s) => s.moveItem)
  const items = useStore((s) => s.items)
  const setDragging = useStore((s) => s.setDragging)
  // Selection halos hide entirely in preview — they're a designer
  // affordance and would read as "this UI is glowing blue" to a wearer.
  const isSelected = !scene.previewMode && selectedId === id
  const isEditing = editingId === id

  const [hovered, setHovered] = useState(false)
  const { camera, gl, invalidate } = useThree()
  const dragData = useRef(null)
  // Ref on the outer group so we can imperatively offset the panel while
  // it's being drag-reordered inside a stack — avoids re-renders during
  // the high-frequency pointer move stream.
  const groupRef = useRef()

  const plane = useMemo(() => new THREE.Plane(), [])
  const intersect = useMemo(() => new THREE.Vector3(), [])
  const offset = useMemo(() => new THREE.Vector3(), [])

  // Resolve colors against the *design* scheme (not the viewport bg).
  const scheme = scene.designScheme || 'light'

  // Resolve the panel's fill from the unified material library so a
  // detailed-settings edit in Scene → Materials (colour, and for glass
  // tiers the opacity / blur set) propagates here. Panels carrying a raw
  // hex `color` (no token) keep their exact legacy look. `fillSpec` is the
  // full material spec when a token/material drives the fill, else null.
  const fillSpec = panel.colorToken
    ? resolveAnyMaterial(panel.colorToken, scene)
    : null
  const fillColor = fillSpec
    ? (fillSpec.color || '#ffffff')
    : (panel.color || '#ffffff')

  const textColor = (() => {
    if (panelType === 'text') {
      return panel.colorToken
        ? resolveSemantic(panel.colorToken, scene)
        : (panel.color || '#000000')
    }
    if (panel.textColorToken)
      return resolveSemantic(panel.textColorToken, scene)
    return panel.textColor || '#000000'
  })()

  const fillShape = useMemo(
    () => roundedRectShape(size[0], size[1], cornerRadius),
    [size[0], size[1], cornerRadius]
  )
  // Slightly enlarged copies of the shape, used as the stroke layer
  // (rendered behind the fill in strokeColor). Only built when the shape
  // actually has stroke set — keeps non-stroked shapes cheap.
  const rectStrokeShape = useMemo(
    () => panelType === 'rectangle' && hasStroke
      ? roundedRectShape(size[0] + strokeWidth * 2, size[1] + strokeWidth * 2, cornerRadius + strokeWidth)
      : null,
    [panelType, hasStroke, size[0], size[1], cornerRadius, strokeWidth]
  )
  // Hair-thin selection ring — same metric as Window3D / Stack3D so
  // every selectable thing on the canvas reads as a single discreet
  // tint outline, not a fat halo. 0.25% of the longer side keeps the
  // ring visible at distance without overpowering small buttons.
  const outlineShape = useMemo(() => {
    const pad = Math.max(size[0], size[1]) * 0.0025
    return roundedRectShape(size[0] + pad * 2, size[1] + pad * 2, cornerRadius + pad)
  }, [size[0], size[1], cornerRadius])

  const parent = useStore((s) => s.items.find((it) => it.id === panel.parentId))
  // NavigationSplitView sidebar-slot pieces (Header, Section Headers,
  // Group Lists, and their descendants) must NOT be individually drag-
  // gable or reorderable — they're owned by the NavSplitView inspector.
  // Walk up the parent chain; if any ancestor is slot='sidebar' or this
  // panel itself sits inside the sidebar slot, lock all canvas drag.
  const isSidebarStructural = (() => {
    let cursor = panel
    while (cursor) {
      if (cursor.slot === 'sidebar') return true
      cursor = items.find((it) => it.id === cursor.parentId) || null
    }
    return false
  })()
  // A panel can be freely *positioned* only when not inside a stack (windows
  // or top-level). Inside a stack, the layout engine owns the position —
  // instead we allow drag-to-reorder: the user drags the panel up/down (or
  // left/right for HStack) and on release we swap slots via moveItem.
  const canDrag = !isSidebarStructural && (!parent || parent.type === 'window')
  const parentStackType = parent?.type === 'stack' ? parent.stackType : null
  const reorderAxis =
    parentStackType === 'vstack' || parentStackType === 'lazyvstack' ||
    parentStackType === 'section' || parentStackType === 'disclosure' ||
    parentStackType === 'navigationStack'
      ? 'y'
      : (parentStackType === 'hstack' || parentStackType === 'lazyhstack')
        ? 'x'
        : null
  const canReorder = reorderAxis !== null && !isSidebarStructural

  // Hover cursor — picks the right shape for the current mode. In
  // preview, interactive controls (buttons with a tapAction, toggles,
  // sliders, steppers) get a pointer; everything else stays as the
  // default arrow so a wearer doesn't see a "grab" hand over plain
  // text. In editor, draggable / reorderable items show "grab" so the
  // designer knows they can move them. Centralised so every
  // onPointerOver in the file picks the same shape.
  const interactiveInPreview = (
    (panelType === 'button' && panel.tapAction) ||
    panelType === 'toggle' ||
    panelType === 'slider' ||
    panelType === 'stepper' ||
    panelType === 'link'
  )
  const hoverCursor = scene.previewMode
    ? (interactiveInPreview ? 'pointer' : 'default')
    : ((canDrag || canReorder) ? 'grab' : 'default')

  // -- ticker scroll animation --
  const tickerRef = useRef()
  useFrame((_, delta) => {
    if (panelType !== 'ticker' || !tickerRef.current) return
    tickerRef.current.position.x -= delta * 0.6
    const textWidth = size[0] * 2
    if (tickerRef.current.position.x < -textWidth) {
      tickerRef.current.position.x = size[0]
    }
    // Keep the frame loop spinning in demand mode so the ticker keeps moving.
    invalidate()
  })

  const onPointerDown = (e) => {
    e.stopPropagation()
    if (isEditing) return
    // Preview runs the canvas as the deployed app — the wearer can't
    // physically drag panels around to "design" mid-preview, so we
    // suppress both selection and drag/reorder. Buttons with a
    // configured `tapAction` fire it here; toggles / sliders /
    // steppers have their own overlay hit-targets that mutate their
    // local state directly. Plain (action-less) buttons no-op.
    if (scene.previewMode) {
      if (panelType === 'button' && panel.tapAction) {
        useStore.getState().runTapAction(panel.tapAction)
      } else if (panelType === 'textfield' || panelType === 'securefield' || panelType === 'search') {
        // visionOS input fields focus on tap — render the live <Html>
        // input overlay so the wearer can actually type. Same `editingId`
        // flow used for inline text editing in edit mode, just allowed
        // here in preview too.
        setEditing(id)
      }
      return
    }
    select(id)
    if (!canDrag && !canReorder) return
    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    const worldPos = new THREE.Vector3()
    e.eventObject.getWorldPosition(worldPos)
    plane.setFromNormalAndCoplanarPoint(camDir, worldPos)
    if (e.ray.intersectPlane(plane, intersect)) {
      offset.copy(intersect).sub(worldPos)
      dragData.current = {
        dragging: true,
        mode: canDrag ? 'position' : 'reorder',
        parentPos: parent?.position || [0, 0, 0],
        startX: intersect.x,
        startY: intersect.y
      }
      setDragging(true)
      gl.domElement.style.cursor = 'grabbing'
      try { e.target.setPointerCapture(e.pointerId) } catch {}
    }
  }
  const onPointerMove = (e) => {
    if (!dragData.current?.dragging) return
    e.stopPropagation()
    if (e.ray.intersectPlane(plane, intersect)) {
      if (dragData.current.mode === 'position') {
        const p = intersect.clone().sub(offset)
        const pp = dragData.current.parentPos
        updateItem(id, { position: [p.x - pp[0], p.y - pp[1], p.z - pp[2]] })
        invalidate()
      } else {
        // Reorder: imperatively offset the group for visual feedback. We
        // don't touch panel.position — the layout engine owns that. On drop
        // we'll call moveItem to commit the slot swap.
        const dx = intersect.x - dragData.current.startX
        const dy = intersect.y - dragData.current.startY
        if (groupRef.current) {
          // Lift slightly forward in Z + raise opacity-feel so it looks
          // "picked up" without needing to poke every mesh material.
          groupRef.current.position.x = (localPosition?.[0] || 0) + modOffX + (reorderAxis === 'x' ? dx : 0)
          groupRef.current.position.y = (localPosition?.[1] || 0) + modOffY + (reorderAxis === 'y' ? dy : 0)
          groupRef.current.position.z = (localPosition?.[2] || 0) + 0.05
        }
        dragData.current.curX = intersect.x
        dragData.current.curY = intersect.y
        invalidate()
      }
    }
  }
  const onPointerUp = (e) => {
    if (dragData.current?.dragging) {
      const d = dragData.current
      if (d.mode === 'reorder' && parent) {
        const siblings = items.filter((it) => it.parentId === parent.id)
        const myIdx = siblings.findIndex((it) => it.id === id)
        const dx = (d.curX ?? d.startX) - d.startX
        const dy = (d.curY ?? d.startY) - d.startY
        // Average slot extent = own size + a small gap; good enough since
        // siblings in a stack tend to have comparable dimensions.
        const slot = reorderAxis === 'y' ? (size[1] + ptToUnits(8)) : (size[0] + ptToUnits(8))
        // In world space, Y up is positive — but in the stack list, earlier
        // items render higher (more positive Y). So dragging UP (dy>0) means
        // moving to a LOWER index. For X-axis, dragging right = higher index.
        const raw = reorderAxis === 'y' ? -(dy / slot) : (dx / slot)
        const shift = Math.round(raw)
        const targetIdx = Math.max(0, Math.min(siblings.length - 1, myIdx + shift))
        if (targetIdx !== myIdx) {
          const target = siblings[targetIdx]
          const mode = targetIdx > myIdx ? 'after' : 'before'
          moveItem(id, target.id, mode)
        }
        // Reset the imperative offset — layout will place us correctly next frame.
        if (groupRef.current) {
          groupRef.current.position.x = (localPosition?.[0] || 0) + modOffX
          groupRef.current.position.y = (localPosition?.[1] || 0) + modOffY
          groupRef.current.position.z = (localPosition?.[2] || 0)
        }
      }
      dragData.current = null
      setDragging(false)
      gl.domElement.style.cursor = hovered ? hoverCursor : 'auto'
      try { e.target.releasePointerCapture(e.pointerId) } catch {}
      invalidate()
    }
  }
  const onDoubleClick = (e) => {
    e.stopPropagation()
    if (panelType === 'text' || panelType === 'button') setEditing(id)
  }

  // Button style resolves final fill / opacity / fallback text color.
  //
  // `.plain` paints with whatever the user picked — `color` for the
  // fill, `textColor` for the label. Earlier this branch overrode
  // both: it set fill opacity to 0 (hiding any custom background) and
  // forced the text to the scene tint, which made templated rows
  // with a dark surface + white text render as transparent rows with
  // blue text — and produced the "all my buttons turned blue" bug.
  // Respecting the user-set color (and only tinting when no override
  // is in place via `colorToken`) restores the expected behaviour.
  const buttonStyle = panel.buttonStyle || 'bordered'
  let resolvedFill = fillColor
  // Solid token-material fills keep the established near-opaque 0.98 look.
  // A glass tier, or an explicit `opacity` override the user dialled into
  // the material in Scene → Materials, drives the plate's real
  // translucency through instead — that's how a detailed opacity edit
  // reaches every flat panel using the material.
  const fillOpacityOverridden = typeof scene.materialProps?.[panel.colorToken]?.opacity === 'number'
  let resolvedFillOpacity = (fillSpec && (isGlassMaterialKey(panel.colorToken) || fillOpacityOverridden))
    ? (typeof fillSpec.opacity === 'number' ? fillSpec.opacity : 0.98)
    : 0.98
  let resolvedTextColor = textColor
  // Buttons living inside an ornament/toolbar render as flat icons on
  // the ornament's shared capsule — the HIG pattern (see toolbar
  // comparison image: every icon shares ONE pill background, no
  // per-icon circles). Prominent / destructive buttons keep their
  // own fill because they're meant to stand out.
  const inOrnamentChrome = parent && parent.type === 'stack' && (
    parent.ornament != null || parent.stackType === 'toolbar' || parent.stackType === 'toolbarItem' || parent.stackType === 'toolbarItemGroup'
  )
  // Navbar is window chrome — it has no background fill of its own;
  // each chip inside the overlay draws its own glass capsule, and the
  // wrapping plate sits transparent over the window's glass.
  if (panelType === 'navbar') {
    resolvedFillOpacity = 0.0
  }
  if (panelType === 'button') {
    if (inOrnamentChrome && buttonStyle !== 'borderedProminent' && buttonStyle !== 'destructive') {
      resolvedFillOpacity = 0.0
      // Use the design scheme's primary text colour so the icon reads
      // on the ornament's glass without inheriting the button's own
      // fill colour.
      if (panel.textColorToken == null && panel.textColor == null) {
        resolvedTextColor = resolveSemantic('primary', scene)
      }
    } else if (buttonStyle === 'plain') {
      // If the template/user supplied an explicit color (hex literal,
      // colorToken: null), honour it. A bare `colorToken` like
      // `'designWindow'` defers to the system-pick path — those
      // buttons fade to transparent so just the label shows.
      const hasExplicitFill = panel.colorToken === null && !!panel.color
      if (!hasExplicitFill) {
        resolvedFillOpacity = 0.0
        if (panel.textColorToken == null && panel.textColor == null) {
          resolvedTextColor = accentColor
        }
      }
    } else if (buttonStyle === 'borderedProminent') {
      resolvedFill = accentColor
      resolvedTextColor = '#ffffff'
    } else if (buttonStyle === 'destructive') {
      resolvedFill = resolveSemantic('systemRed', scene)
      resolvedTextColor = '#ffffff'
    }
  }
  // `.foregroundStyle` is the last word on content colour, as it is in
  // SwiftUI — it overrides the per-type defaults resolved above.
  if (modForeground) resolvedTextColor = modForeground

  // Segmented control — the base pill is the raised *rim* that catches
  // light; the overlay paints a darker inset well inside it (the recess)
  // and a raised selection pill on top. A light rim + dark well is the
  // flat-shaded way to read as sunken without real lighting.
  if (panelType === 'segmented') {
    resolvedFill = scheme === 'dark' ? '#5c5c60' : '#e6e6ea'
    resolvedFillOpacity = 0.98
  }

  // Spacer is handled in the dispatcher above — it draws nothing and needs no
  // hooks, so returning here would make every hook below conditional.

  const isDivider = panelType === 'divider'
  // `toggle` and `stepper` don't paint a frame fill — their controls
  // are drawn as their own widgets by their overlays (track+knob for
  // toggle, ± circle buttons for stepper), and the row itself is just
  // a transparent label slot. Without this the row would render with
  // the control's fill stretched across the whole panel width.
  const noFillTypes = ['text', 'divider', 'circle', 'capsule', 'ellipse', 'unevenRoundedRect', 'path', 'link', 'spacer', 'label', 'colorpicker', 'linearGradient', 'radialGradient', 'angularGradient', 'toggle', 'stepper', 'slider']
  const hasFill = !noFillTypes.includes(panelType)
  // `toggle` + `stepper` belong here so the panel's leading-edge label
  // renders next to the trailing control — the SwiftUI shape of
  // `Toggle("Wi-Fi", isOn:)` and `Stepper("Count", value:)`. The label
  // sits left-aligned; each panel's overlay paints its widget on the
  // trailing edge, so the two don't overlap as long as the panel is
  // wider than the widget (default frame: 280×36).
  const labelTypes = ['text', 'button', 'image', 'slideshow', 'sheet', 'groupbox', 'toggle', 'stepper']
  // Image panels render their placeholder via the cross meshes above
  // (lines 1531-1538) — drawing "Image" as a text label on top of a
  // 48pt avatar swatch wraps one glyph per line and looks broken.
  // Hide the default label for `image` whenever there's no user-set
  // text (the cross is enough); `text` panels with an empty body keep
  // showing their type name as a hint.
  const imagePlaceholder = panelType === 'image' && !panel.imageUrl && !panel.text
  // Once an image is loaded, suppress the default "Image" label overlay —
  // the user dragged in real media, so painting the placeholder caption
  // on top would be noise. The empty-state path (no imageUrl yet) keeps
  // the label so the panel still reads as an Image affordance.
  const imageHasMedia = (panelType === 'image' || panelType === 'asyncimage') && !!panel.imageUrl
  const showDefaultLabel = !isEditing && labelTypes.includes(panelType) && !imagePlaceholder && !imageHasMedia

  // Buttons read their font size from the size preset `controlSize` selects
  // — the same field the exporter emits as `.controlSize(...)`, so the two
  // cannot disagree. The Label section's text-style picker doesn't apply to
  // buttons; the Size dropdown is the single control for the button's text
  // point size (15 / 17 / 19 pt at small / regular / large). Other panel
  // types resolve through `textStyle`, falling back to a legacy `fontSize`
  // that nothing writes any more.
  const baseFontSize = panelType === 'button'
    ? ptToUnits(buttonSizePreset(panel.controlSize).fontPt)
    : panel.textStyle
      ? ptToUnits(TEXT_STYLES[panel.textStyle]?.pt ?? 17)
      : (panel.fontSize || 0.15)
  const finalFontSize = baseFontSize
  // For text/link, swap to an italic font file when .italic() is on —
  // troika's `fontStyle` prop only takes effect if the font file itself
  // carries italic glyphs. For non-text panel kinds (button, picker, …)
  // italic isn't exposed in the UI so we stay on the upright face.
  const fontUrl = getInterFont(
    panel.fontWeight,
    (panelType === 'text' || panelType === 'link') && !!modSummary.italic
  )

  // Buttons are always centred on both axes — they have no alignment
  // control in the inspector. Every other panel honours `panel.textAlign`.
  const anchorX = panelType === 'button'
    ? 'center'
    : panel.textAlign === 'left'  ? 'left'
    : panel.textAlign === 'right' ? 'right'
    : 'center'

  // For any text-rendering panel, put the text at the panel box's correct
  // edge so textAlign is visually honoured (not just anchored at the center
  // going outward). A tiny inset keeps the glyphs from kissing the border
  // on non-Text panels (button, picker etc.). Pure text/link panels have no
  // inset — the panel box already equals the text's bounds. Buttons follow
  // the visionOS Figma kit spec: 12pt side padding on each edge (see
  // BUTTON_TEXT_INSET_PT in appleSystem.js).
  const textInset = (panelType === 'text' || panelType === 'link')
    ? 0
    : panelType === 'button'
      ? ptToUnits(12)
      : ptToUnits(4)
  // Buttons with a leading SF Symbol (`Label(_, systemImage:)`) need
  // the text shifted right past the icon so they don't overlap. The
  // icon sits at `-size[0]/2 + 12pt` and renders at ~`finalFontSize *
  // 1.1` wide — reserve 28pt of leading runway for left-aligned text,
  // and bias centered text by half that so the title stays optically
  // centred within the remaining width.
  // We render the leading symbol via SymbolIcon3D (Lucide-rasterised),
  // so the check just needs a non-empty name — any unknown name falls
  // back to a circle glyph rather than rendering nothing.
  const hasLeadingSymbol = panelType === 'button' && !!panel.symbolName
  const symbolOffset = hasLeadingSymbol ? ptToUnits(28) : 0
  const textX = panelType === 'button'
    ? symbolOffset / 2
    : panel.textAlign === 'left'  ? -size[0] / 2 + textInset + symbolOffset
    : panel.textAlign === 'right' ?  size[0] / 2 - textInset
    : symbolOffset / 2

  // Text-specific modifiers (.italic, .underline, .strikethrough, .lineLimit,
  // .lineSpacing, .tracking, .kerning, .baselineOffset, .textCase) come
  // from the ordered modifier stack — sourced via `summarizeModifiers`
  // above. tracking + kerning both widen inter-character space; SwiftUI
  // treats them as additive too. baselineOffset shifts the text up (+) or
  // down (−) in points so superscript / subscript callouts read.
  const applyCase = (s) => {
    if (!s) return ''
    if (modSummary.textCase === 'uppercase') return s.toUpperCase()
    if (modSummary.textCase === 'lowercase') return s.toLowerCase()
    return s
  }
  const letterSpacing = ptToUnits((modSummary.tracking || 0) + (modSummary.kerning || 0))
  const baselineOffsetY = modSummary.baselineOffset ? ptToUnits(modSummary.baselineOffset) : 0
  const lineHeight = modSummary.lineSpacing
    ? 1 + (modSummary.lineSpacing / Math.max(1, (TEXT_STYLES[panel.textStyle]?.pt ?? 17)))
    : undefined

  // ---- type-specific overlays ----

  // Segmented control — SwiftUI `.pickerStyle(.segmented)`. Equal-width
  // segments laid out on the recessed pill track with a 4pt edge inset and
  // 4pt gaps between segments; the selected segment carries a raised pill
  // thumb (88×36 at the default 188-wide / 2-segment frame). Labels are
  // 15pt semibold — selected reads in the primary colour, the rest dim to
  // secondary. Geometry derives from the panel frame so the control stays
  // correct if the user resizes it; the default frame and the inspector's
  // refit keep each segment at the spec'd 88pt.
  const segments = panel.segments || []
  const selectedSeg = Math.max(0, Math.min(segments.length - 1, panel.selectedSegment ?? 0))
  const SEG_PAD = ptToUnits(4)
  const segCount = Math.max(1, segments.length)
  const segTrackInnerW = size[0] - SEG_PAD * 2
  const segH = size[1] - SEG_PAD * 2
  const segW = (segTrackInnerW - SEG_PAD * (segCount - 1)) / segCount
  // The selection is a true pill — radius tracks its own height.
  const segRadius = segH / 2
  const segStartX = -segTrackInnerW / 2 + segW / 2
  // Recessed well: a darker pill inset 1.5pt inside the light base rim — the
  // light rim + dark well reads as sunken without real lighting.
  const SEG_WELL_INSET = ptToUnits(1.5)
  const segWellW = size[0] - SEG_WELL_INSET * 2
  const segWellH = size[1] - SEG_WELL_INSET * 2
  // Both surfaces read their colour straight from the scene's "Views" material
  // tokens (Scene → Materials & Colors), so retuning a material there updates
  // every segmented control. The long background tile defaults to the Recessed
  // Material View; the selected front tile defaults to the Thicker tier so it
  // reads as a raised pill against the recessed well.
  const segWellColor = resolveAnyMaterial(panel.colorToken || 'viewRecessed', scene).color
  const segThumbColor = resolveAnyMaterial(panel.selectedColorToken || 'viewThicker', scene).color
  const segmentOverlay = panelType === 'segmented' && (
    <group>
      {/* Recessed well — the sunken track the pill floats inside */}
      <mesh position={[0, 0, 0.001]}>
        <shapeGeometry args={[roundedRectShape(segWellW, segWellH, segWellH / 2)]} />
        <meshBasicMaterial color={segWellColor} />
      </mesh>
      {segments.map((seg, i) => {
        const x = segStartX + i * (segW + SEG_PAD)
        const isSel = i === selectedSeg
        return (
          <group key={i} position={[x, 0, 0.004]}>
            {isSel && (
              <>
                {/* Soft contact shadow under the pill — sells the lift */}
                <mesh position={[0, -ptToUnits(1.5), -0.001]}>
                  <shapeGeometry args={[roundedRectShape(segW, segH, segRadius)]} />
                  <meshBasicMaterial color="#000000" transparent opacity={0.2} />
                </mesh>
                {/* Raised selection pill */}
                <mesh>
                  <shapeGeometry args={[roundedRectShape(segW, segH, segRadius)]} />
                  <meshBasicMaterial color={segThumbColor} />
                </mesh>
              </>
            )}
            <Text
              position={[0, 0, 0.002]}
              font={getInterFont('semibold')}
              fontSize={ptToUnits(15)}
              fontWeight="semibold"
              color={isSel ? resolveSemantic('primary', scene) : resolveSemantic('secondary', scene)}
              anchorX="center"
              anchorY="middle"
              maxWidth={segW * 0.9}
              textAlign="center"
            >
              {seg}
            </Text>
          </group>
        )
      })}
    </group>
  )

  // Toggle: label on the leading edge, fixed 52×32 switch on the
  // trailing edge — the same shape SwiftUI's `Toggle("Wi-Fi", isOn:)`
  // renders. The full panel frame is the row; the switch is its own
  // rounded-rect track + knob anchored to size[0]/2.
  //
  // In preview the track + knob mesh listens for clicks and flips the
  // panel's `toggleOn` value, so the wearer can interact with the
  // switch the same way they would on-device. The handler bypasses
  // the regular drag/select gate above (which early-returns in
  // preview) by reading directly from the store.
  const toggleOverlay = panelType === 'toggle' && (() => {
    const TRACK_W = ptToUnits(52)
    const TRACK_H = ptToUnits(32)
    const trackX = size[0] / 2 - TRACK_W / 2 - ptToUnits(4)
    const trackColor = panel.toggleOn
      ? (panel.color || '#0a84ff')
      : (scheme === 'dark' ? '#3a3a3c' : '#d1d1d6')
    const knobX = panel.toggleOn
      ? TRACK_W / 2 - TRACK_H / 2
      : -TRACK_W / 2 + TRACK_H / 2
    const flip = (e) => {
      if (!scene.previewMode) return
      e.stopPropagation()
      useStore.getState().updateItem(id, { toggleOn: !panel.toggleOn })
    }
    return (
      <group onPointerDown={flip}>
        {/* Switch track */}
        <mesh position={[trackX, 0, 0.004]}>
          <shapeGeometry args={[roundedRectShape(TRACK_W, TRACK_H, TRACK_H / 2)]} />
          <meshBasicMaterial color={trackColor} />
        </mesh>
        {/* Switch knob */}
        <mesh position={[trackX + knobX, 0, 0.006]}>
          <circleGeometry args={[TRACK_H * 0.42, 32]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
    )
  })()

  // ---- Divider (thin hairline) ----
  const dividerOverlay = isDivider && (
    <mesh
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
      onPointerOut={() => { setHovered(false) }}
    >
      <planeGeometry args={[size[0], Math.max(size[1], ptToUnits(1))]} />
      <meshBasicMaterial
        color={fillColor}
        transparent opacity={0.7}
        side={THREE.DoubleSide}
      />
    </mesh>
  )

  // ---- Circle shape ----
  // SwiftUI's `Circle()` always inscribes the smaller frame dimension —
  // the circle fills its frame's square. Stroke is drawn behind the fill
  // as an enlarged circle of (radius + strokeWidth) so the visible ring
  // is `strokeWidth` thick around the rim.
  const circleRadius = Math.min(size[0], size[1]) / 2
  const circleOverlay = panelType === 'circle' && (
    <>
      {hasStroke && (
        <mesh position={[0, 0, -0.0005]}>
          <circleGeometry args={[circleRadius + strokeWidth, 64]} />
          <meshBasicMaterial color={strokeColor} transparent opacity={modOpacity} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); gl.domElement.style.cursor = hoverCursor }}
        onPointerOut={() => { setHovered(false); if (!dragData.current?.dragging) gl.domElement.style.cursor = 'auto' }}
      >
        <circleGeometry args={[circleRadius, 64]} />
        <meshBasicMaterial color={fillColor} transparent opacity={0.98} side={THREE.DoubleSide} />
      </mesh>
    </>
  )

  // ---- Capsule shape ----
  const capsuleRadius = Math.min(size[0], size[1]) / 2
  const capsuleShape = useMemo(
    () => panelType === 'capsule' ? roundedRectShape(size[0], size[1], capsuleRadius) : null,
    [panelType, size[0], size[1], capsuleRadius]
  )
  const capsuleStrokeShape = useMemo(() => {
    if (panelType !== 'capsule' || !hasStroke) return null
    const w = size[0] + strokeWidth * 2, h = size[1] + strokeWidth * 2
    return roundedRectShape(w, h, Math.min(w, h) / 2)
  }, [panelType, hasStroke, size[0], size[1], strokeWidth])

  // ---- Alert / confirmation-dialog overlay (title + message + buttons) ----
  // Both draw the same furniture, because SwiftUI presents them the same way:
  // a title, an optional message, and a row of roled buttons. The dialog had
  // no canvas rendering at all until phase 1.3 — it was laid out as an
  // ordinary child while the code emitted `.confirmationDialog(…)`. AUDIT #7.
  const alertOverlay = (panelType === 'alert' || panelType === 'confirmationdialog') && (() => {
    const primary = resolveSemantic('primary', scene)
    const secondary = resolveSemantic('secondary', scene)
    const msg = panel.alertMessage || ''
    const btns = panel.alertButtons || (panelType === 'confirmationdialog' ? ['Cancel'] : ['OK'])
    const btnH = ptToUnits(36)
    const btnY = -size[1] / 2 + ptToUnits(20) + btnH / 2
    const btnW = (size[0] - ptToUnits(32)) / btns.length
    // `.confirmationDialog(titleVisibility:)` — `.automatic` shows the title
    // only when there is a message body to caption, which is the platform
    // rule the exporter relies on; `.hidden` drops it outright.
    const tv = panel.titleVisibility || 'automatic'
    const showTitle = panelType !== 'confirmationdialog'
      ? true
      : (tv === 'visible' || (tv === 'automatic' && !!msg))
    // `.dialogIcon` / `.dialogSeverity` — a glyph above the title, tinted red
    // when the dialog is marked critical. Both reached the export only.
    const severity = panel.dialogSeverity || 'automatic'
    const iconColor = severity === 'critical'
      ? resolveSemantic('systemRed', scene)
      : accentColor
    const titleY = panel.dialogIcon ? size[1] * 0.12 : size[1] * 0.2
    return (
      <>
        {panel.dialogIcon && (
          <SymbolIcon3D
            name={panel.dialogIcon}
            sizeUnits={ptToUnits(28)}
            color={iconColor}
            position={[0, size[1] * 0.32, 0.005]}
          />
        )}
        {showTitle && (
        <Text position={[0, titleY, 0.005]} font={fontUrl} fontSize={ptToUnits(17)} color={primary} anchorX="center" anchorY="middle" maxWidth={size[0] * 0.85} textAlign="center" fontWeight="bold">
          {panel.text || (panelType === 'confirmationdialog' ? 'Confirm' : 'Alert')}
        </Text>
        )}
        <Text position={[0, 0, 0.005]} font={fontUrl} fontSize={ptToUnits(13)} color={secondary} anchorX="center" anchorY="middle" maxWidth={size[0] * 0.85} textAlign="center">
          {msg}
        </Text>
        {/* Separator above buttons */}
        <mesh position={[0, btnY + btnH / 2 + ptToUnits(4), 0.003]}>
          <planeGeometry args={[size[0] * 0.92, ptToUnits(0.5)]} />
          <meshBasicMaterial color={resolveSemantic('tertiary', scene)} />
        </mesh>
        {btns.map((label, i) => {
          const x = -size[0] / 2 + ptToUnits(16) + btnW * (i + 0.5)
          return (
            <Text key={i} position={[x, btnY, 0.005]} font={fontUrl} fontSize={ptToUnits(15)} color={i === btns.length - 1 ? (accentColor) : primary} anchorX="center" anchorY="middle" fontWeight={i === btns.length - 1 ? 'bold' : 'regular'}>
              {label}
            </Text>
          )
        })}
      </>
    )
  })()

  // ---- Search field ----
  // Magnifier glyph on the leading edge + the typed value (or
  // placeholder). Suppressed while the live <Html> input is mounted so
  // we don't double-render the caret.
  const searchOverlay = !isEditing && panelType === 'search' && (() => {
    const iconSize = ptToUnits(7)
    const iconCx = -size[0] / 2 + ptToUnits(18)
    const liveValue = panel.searchValue || ''
    const showPlaceholder = !liveValue
    const displayText = liveValue || (panel.text || 'Search')
    const textColor = showPlaceholder
      ? (panel.textColor || '#545454')
      : resolveSemantic('primary', scene)
    return (
      <>
        <group position={[iconCx, 0, 0.005]}>
          <mesh>
            <ringGeometry args={[iconSize * 0.8, iconSize, 24]} />
            <meshBasicMaterial color={resolveSemantic('secondary', scene)} />
          </mesh>
          <mesh position={[iconSize * 0.9, -iconSize * 0.9, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <planeGeometry args={[iconSize * 1.2, ptToUnits(1.5)]} />
            <meshBasicMaterial color={resolveSemantic('secondary', scene)} />
          </mesh>
        </group>
        <Text
          position={[iconCx + ptToUnits(18), 0, 0.005]}
          fontSize={finalFontSize}
          color={textColor}
          anchorX="left"
          anchorY="middle"
          maxWidth={size[0] - ptToUnits(50)}
        >
          {displayText}
        </Text>
      </>
    )
  })()

  // ---- Navigation Bar ----
  //
  // Six fixed styles (see NAVBAR_STYLE_SPECS). The bar is laid out in
  // pt with everything centred vertically:
  //   - Side padding: 24pt (clamped by NAVBAR_SIDE_PADDING_PT)
  //   - Items are 44pt tall, 16pt apart in a group
  //   - Title sits left-aligned next to the leading slot (or centred
  //     in the back/leadingTrailing variants).
  // Each interactive item draws a soft glass capsule + glyph; the
  // editor renders them as flat affordances (no live state — these are
  // chrome, not buttons the wearer pinches).
  const navbarOverlay = panelType === 'navbar' && (() => {
    const spec = NAVBAR_STYLE_SPECS[panel.navbarStyle] || NAVBAR_STYLE_SPECS.trailingButtons
    const pad      = ptToUnits(NAVBAR_SIDE_PADDING_PT)
    const itemSize = ptToUnits(NAVBAR_ITEM_PT)
    const gap      = ptToUnits(NAVBAR_ITEM_GAP_PT)
    const avatar   = ptToUnits(NAVBAR_AVATAR_PT)
    const searchW  = ptToUnits(NAVBAR_SEARCH_W_PT)
    const backCapW = ptToUnits(NAVBAR_BACK_CAPSULE_W_PT)
    const iconTextGap = ptToUnits(NAVBAR_BACK_ICON_TEXT_GAP_PT)
    const primary    = resolveSemantic('primary', scene)
    const controlBg  = resolveSemantic('controlIdle', scene)

    // ---- Glass-capsule chip helper ----
    const Chip = ({ x, w, h = itemSize, radius, children }) => (
      <group position={[x, 0, 0.005]}>
        <mesh>
          <shapeGeometry args={[roundedRectShape(w, h, radius ?? h / 2)]} />
          <meshBasicMaterial color={controlBg} transparent opacity={0.55} />
        </mesh>
        {children}
      </group>
    )

    // ---- Glyph helper (SF Symbol → Lucide texture, falls back to label) ----
    const Glyph = ({ name, label, position, fontSize = ptToUnits(18), color = primary }) => {
      if (name) {
        return (
          <SymbolIcon3D
            name={name}
            sizeUnits={fontSize}
            color={color}
            weight="medium"
            position={position}
          />
        )
      }
      return (
        <Text position={position} font={getInterFont('regular')} fontSize={fontSize} color={color} anchorX="center" anchorY="middle">
          {label || '•'}
        </Text>
      )
    }

    // ---- Leading slot ----
    const leadingItems = []
    let leadingRightEdge = -size[0] / 2 + pad        // x-coordinate where trailing-of-leading content ends
    if (spec.leading === 'avatar') {
      const cx = -size[0] / 2 + pad + avatar / 2
      leadingItems.push(
        <group key="avatar" position={[cx, 0, 0.005]}>
          <mesh>
            <circleGeometry args={[avatar / 2, 32]} />
            <meshBasicMaterial color={controlBg} transparent opacity={0.55} />
          </mesh>
          <Glyph name="person" label="A" position={[0, 0, 0.002]} />
        </group>
      )
      leadingRightEdge = cx + avatar / 2
    } else if (spec.leading === 'backCircle') {
      const cx = -size[0] / 2 + pad + itemSize / 2
      leadingItems.push(
        <group key="backC" position={[cx, 0, 0.005]}>
          <mesh>
            <circleGeometry args={[itemSize / 2, 32]} />
            <meshBasicMaterial color={controlBg} transparent opacity={0.55} />
          </mesh>
          <Glyph name="chevron.left" position={[0, 0, 0.002]} />
        </group>
      )
      leadingRightEdge = cx + itemSize / 2
    } else if (spec.leading === 'backCapsule') {
      const cx = -size[0] / 2 + pad + backCapW / 2
      // Icon + "Back" label, 2pt gap between glyph and text. The user
      // spec measures from the chevron-glyph centre to the text origin —
      // we approximate by anchoring both off the chip centre.
      leadingItems.push(
        <Chip key="backCap" x={cx} w={backCapW} radius={itemSize / 2}>
          <Glyph name="chevron.left" position={[-iconTextGap / 2 - ptToUnits(10), 0, 0.002]} fontSize={ptToUnits(15)} />
          <Text position={[iconTextGap / 2 + ptToUnits(2), 0, 0.002]} font={getInterFont('semibold')} fontSize={ptToUnits(15)} color={primary} anchorX="left" anchorY="middle">
            Back
          </Text>
        </Chip>
      )
      leadingRightEdge = cx + backCapW / 2
    } else if (spec.leading === 'buttons') {
      const arr = panel.leadingButtons || []
      let x = -size[0] / 2 + pad + itemSize / 2
      arr.forEach((btn, i) => {
        leadingItems.push(
          <group key={`l-${btn.id || i}`} position={[x, 0, 0.005]}>
            <mesh>
              <circleGeometry args={[itemSize / 2, 32]} />
              <meshBasicMaterial color={controlBg} transparent opacity={0.55} />
            </mesh>
            <Glyph name={btn.symbolName} label={btn.label} position={[0, 0, 0.002]} />
          </group>
        )
        x += itemSize + gap
      })
      leadingRightEdge = -size[0] / 2 + pad + (arr.length > 0 ? arr.length * itemSize + (arr.length - 1) * gap : 0)
    }

    // ---- Trailing slot ----
    const trailingItems = []
    let trailingLeftEdge = size[0] / 2 - pad
    if (spec.trailing === 'avatar') {
      const cx = size[0] / 2 - pad - avatar / 2
      trailingItems.push(
        <group key="t-avatar" position={[cx, 0, 0.005]}>
          <mesh>
            <circleGeometry args={[avatar / 2, 32]} />
            <meshBasicMaterial color={controlBg} transparent opacity={0.55} />
          </mesh>
          <Glyph name="person" label="A" position={[0, 0, 0.002]} />
        </group>
      )
      trailingLeftEdge = cx - avatar / 2
    } else if (spec.trailing === 'search') {
      const cx = size[0] / 2 - pad - searchW / 2
      trailingItems.push(
        <Chip key="t-search" x={cx} w={searchW} radius={itemSize / 2}>
          <Glyph name="magnifyingglass" position={[-searchW / 2 + ptToUnits(20), 0, 0.002]} fontSize={ptToUnits(15)} color={resolveSemantic('secondary', scene)} />
          <Text position={[-searchW / 2 + ptToUnits(38), 0, 0.002]} font={getInterFont('regular')} fontSize={ptToUnits(15)} color={resolveSemantic('secondary', scene)} anchorX="left" anchorY="middle">
            Search
          </Text>
        </Chip>
      )
      trailingLeftEdge = cx - searchW / 2
    } else if (spec.trailing === 'buttons') {
      const arr = panel.trailingButtons || []
      // Render right-to-left so the last button hugs the trailing pad.
      let x = size[0] / 2 - pad - itemSize / 2
      for (let i = arr.length - 1; i >= 0; i--) {
        const btn = arr[i]
        trailingItems.push(
          <group key={`t-${btn.id || i}`} position={[x, 0, 0.005]}>
            <mesh>
              <circleGeometry args={[itemSize / 2, 32]} />
              <meshBasicMaterial color={controlBg} transparent opacity={0.55} />
            </mesh>
            <Glyph name={btn.symbolName} label={btn.label} position={[0, 0, 0.002]} />
          </group>
        )
        x -= itemSize + gap
      }
      trailingLeftEdge = arr.length > 0
        ? size[0] / 2 - pad - (arr.length * itemSize + (arr.length - 1) * gap)
        : size[0] / 2 - pad
    }

    // ---- Title ---- bold, 29pt (visionOS NavBar spec). The renderer
    // uses Inter Bold and 29-pt sizing across every style; alignment
    // (left vs centre) is driven by spec.titleAlign.
    const titleColor = primary
    const TITLE_FONT_PT = 29
    const titleEl = spec.titleAlign === 'center'
      ? (
        <Text key="title" position={[0, 0, 0.005]} font={getInterFont('bold')} fontSize={ptToUnits(TITLE_FONT_PT)} color={titleColor} anchorX="center" anchorY="middle">
          {panel.title || 'Title'}
        </Text>
      )
      : (
        <Text
          key="title"
          position={[leadingRightEdge + (leadingItems.length > 0 ? ptToUnits(12) : 0), 0, 0.005]}
          font={getInterFont('bold')}
          fontSize={ptToUnits(TITLE_FONT_PT)}
          color={titleColor}
          anchorX="left"
          anchorY="middle"
          maxWidth={trailingLeftEdge - leadingRightEdge - ptToUnits(24)}
        >
          {panel.title || 'Title'}
        </Text>
      )

    return (
      <>
        {leadingItems}
        {trailingItems}
        {titleEl}
      </>
    )
  })()

  // ---- List ----
  // Style-aware rendering — visuals change with panel.listStyle. Row height,
  // padding, inset, group card, separators, etc. all come from LIST_STYLES.
  const listOverlay = panelType === 'list' && (() => {
    const rows = panel.rows || []
    const style = LIST_STYLES[panel.listStyle] || LIST_STYLES.default
    const padY = ptToUnits(style.pad)
    const inset = ptToUnits(style.inset)
    const rowH = ptToUnits(style.rowH)
    // `.listRowSpacing(n)` adds to whatever gap the style preset already
    // carries, the way SwiftUI stacks it on top of the list's own metrics.
    const gap = ptToUnits(style.gap) + ptToUnits(Number(panel.listRowSpacing) || 0)
    const innerW = size[0] - inset * 2
    const startY = size[1] / 2 - padY
    const primary = resolveSemantic('primary', scene)
    const secondary = resolveSemantic('secondary', scene)
    // `.listRowSeparator(.hidden)` takes the hairlines away, and
    // `.listRowSeparatorTint(_:)` recolours them. Both reached the export
    // only — the canvas drew whatever the style preset said and nothing
    // else. AUDIT #19.
    const separatorMode = panel.listRowSeparator || 'automatic'
    const showSeparators = style.showSeparators && separatorMode !== 'hidden'
    const separator = panel.listRowSeparatorTint
      ? (panel.listRowSeparatorTint.startsWith('#')
          ? panel.listRowSeparatorTint
          : resolveSemantic(panel.listRowSeparatorTint, scene))
      : resolveSemantic('tertiary', scene)
    // `.listItemTint(_:)` is the accent a row's content takes — the icon and
    // the chevron, not the label. A per-row `tint` still wins over it, the
    // way a row-level modifier beats a list-level one.
    const itemTint = panel.listItemTint
      ? (panel.listItemTint.startsWith('#')
          ? panel.listItemTint
          : resolveSemantic(panel.listItemTint, scene))
      : null
    const fontSizeTitle = ptToUnits(style.rowH <= 32 ? 13 : 15)
    const fontSizeSub   = ptToUnits(style.rowH <= 32 ? 11 : 12)

    // Optional rounded group card behind all rows (insetGrouped / default).
    const groupCardShape = style.showGroupCard
      ? roundedRectShape(innerW, rows.length * rowH, ptToUnits(style.groupRadius))
      : null

    // Optional bordered-list outer ring (macOS .bordered).
    const borderRingShape = style.bordered
      ? rimRingShape(size[0], size[1], ptToUnits(style.groupRadius), ptToUnits(1))
      : null

    return (
      <group position={[0, 0, 0.004]}>
        {/* Group card background (insetGrouped, default) */}
        {groupCardShape && (
          <mesh position={[0, startY - (rows.length * rowH) / 2, -0.001]}>
            <shapeGeometry args={[groupCardShape]} />
            <meshBasicMaterial color={resolveSemantic('secondarySystemBackground', scene)} transparent opacity={0.95} />
          </mesh>
        )}
        {/* Bordered-style outer ring */}
        {borderRingShape && (
          <mesh position={[0, 0, 0.001]}>
            <shapeGeometry args={[borderRingShape]} />
            <meshBasicMaterial color={separator} />
          </mesh>
        )}
        {rows.map((r, i) => {
          const cy = startY - rowH / 2 - i * (rowH + gap)
          const hasSub = !!r.subtitle
          // Preview-only: clicking a row carrying a `navTag` navigates
          // the parent NavigationSplitView to its matching destination.
          // Walks up from the List panel to find the NavSplitView root
          // (a stack with `splitStyle` set), then dispatches the
          // routing action against it.
          const onRowDown = (e) => {
            if (!scene.previewMode || !r.navTag) return
            let cursor = items.find((it) => it.id === panel.parentId)
            while (cursor && !(cursor.type === 'stack' && cursor.splitStyle)) {
              cursor = items.find((it) => it.id === cursor.parentId)
            }
            if (!cursor) return
            e.stopPropagation()
            useStore.getState().setActiveDestination(cursor.id, r.navTag)
          }
          // Per-row rounded card (sidebar / carousel / elliptical).
          const rowCard = style.roundedRows
            ? roundedRectShape(
                // elliptical: subtle horizontal taper for edge rows
                style.tapered ? innerW - Math.abs(i - (rows.length - 1) / 2) * ptToUnits(8) : innerW,
                rowH - (style.gap ? ptToUnits(2) : 0),
                ptToUnits(style.groupRadius)
              )
            : null
          // Leading SF Symbol (`Label(title, systemImage:)` in SwiftUI).
          // Each row may carry `systemImage` (SF Symbol name) and `tint`
          // (SYSTEM_COLORS token or direct #hex) — matches Apple's sidebar
          // conventions in Shortcuts / News / Settings.
          const iconTint = r.tint
            ? (r.tint.startsWith('#') ? r.tint : resolveSemantic(r.tint, scene))
            : (itemTint || accentColor)
          const hasIcon = !!r.systemImage
          const textStartX = -innerW / 2 + (hasIcon ? ptToUnits(42) : ptToUnits(12))
          // Optional row highlight pill (`.listRowBackground(...)` in SwiftUI).
          const hlColor = r.background
            ? (r.background.startsWith('#') ? r.background : resolveSemantic(r.background, scene))
            : null
          const highlightShape = hlColor
            ? roundedRectShape(innerW - ptToUnits(8), rowH - ptToUnits(6), ptToUnits(10))
            : null
          return (
            <group key={i} position={[0, cy, 0]} onPointerDown={onRowDown}>
              {/* Invisible click receiver so clicks anywhere on the row
                  (including the empty space between icon and chevron)
                  reach onRowDown — three.js only delivers pointer events
                  to descendants that own geometry, so an empty group
                  would only fire on the text glyphs / card mesh. */}
              {r.navTag && (
                <mesh position={[0, 0, 0.002]}>
                  <planeGeometry args={[innerW, rowH - (style.gap ? ptToUnits(2) : 0)]} />
                  <meshBasicMaterial transparent opacity={0} />
                </mesh>
              )}
              {rowCard && (
                <mesh position={[0, 0, -0.001]}>
                  <shapeGeometry args={[rowCard]} />
                  <meshBasicMaterial
                    color={resolveSemantic(
                      style.showBg ? 'tertiarySystemBackground' : 'secondarySystemBackground',
                      scene
                    )}
                    transparent
                    opacity={style.roundedRows ? 0.9 : 0.0}
                  />
                </mesh>
              )}
              {highlightShape && (
                <mesh position={[0, 0, -0.0005]}>
                  <shapeGeometry args={[highlightShape]} />
                  <meshBasicMaterial color={hlColor} transparent opacity={0.18} />
                </mesh>
              )}
              {hasIcon && (
                <SymbolIcon3D
                  name={r.systemImage}
                  sizeUnits={ptToUnits(20)}
                  color={iconTint}
                  weight={panel.listStyle === 'sidebar' ? 'medium' : 'regular'}
                  position={[-innerW / 2 + ptToUnits(22), 0, 0]}
                />
              )}
              {/* Title (and optional subtitle stacked) */}
              <Text
                position={[textStartX, hasSub ? ptToUnits(7) : 0, 0]}
                font={getInterFont(panel.listStyle === 'sidebar' ? 'medium' : 'regular')}
                fontSize={fontSizeTitle}
                color={primary}
                anchorX="left"
                anchorY="middle"
                maxWidth={innerW * 0.78}
              >{r.title || ''}</Text>
              {hasSub && (
                <Text
                  position={[textStartX, -ptToUnits(8), 0]}
                  fontSize={fontSizeSub}
                  color={secondary}
                  anchorX="left"
                  anchorY="middle"
                  maxWidth={innerW * 0.78}
                >{r.subtitle}</Text>
              )}
              {/* Trailing value (count badge / detail string). Apple's
                  visionOS sidebar shows a right-aligned secondary number
                  on inbox-like rows ("42"). When a row carries `value`,
                  we render it on the trailing edge and suppress the
                  chevron so the two don't fight. */}
              {r.value && (
                <Text
                  position={[innerW / 2 - ptToUnits(12), 0, 0]}
                  font={fontUrl}
                  fontSize={ptToUnits(15)}
                  color={secondary}
                  anchorX="right"
                  anchorY="middle"
                >{r.value}</Text>
              )}
              {/* Trailing chevron — omitted on sidebar/carousel/elliptical where
                  rows look like cards, not navigation links, and also when a
                  `value` is present so the two affordances don't overlap. */}
              {!style.roundedRows && !r.value && (
                <Text
                  position={[innerW / 2 - ptToUnits(8), 0, 0]}
                  fontSize={ptToUnits(14)}
                  color={itemTint || secondary}
                  anchorX="right"
                  anchorY="middle"
                >›</Text>
              )}
              {/* Separator line (plain/inset/insetGrouped/grouped/bordered) */}
              {showSeparators && i < rows.length - 1 && (
                <mesh
                  position={[
                    // Separator has a small leading inset on plain/inset so it
                    // visually aligns with the text — matches Apple.
                    (style.inset > 0 ? ptToUnits(6) : 0),
                    -rowH / 2,
                    -0.0005
                  ]}
                >
                  <planeGeometry args={[innerW - (style.inset > 0 ? ptToUnits(12) : 0), 0.003]} />
                  <meshBasicMaterial color={separator} />
                </mesh>
              )}
            </group>
          )
        })}
      </group>
    )
  })()

  // ---- Table ----

  // ---- Form ----
  // SwiftUI's `Form` is a grouped list of labelled rows. It exported every row
  // faithfully and drew an empty plate, so data the designer typed into the
  // inspector was invisible on the canvas until export. AUDIT #6.
  const formOverlay = panelType === 'form' && (() => {
    const rows = panel.rows || []
    const primary = resolveSemantic('primary', scene)
    const secondary = resolveSemantic('secondary', scene)
    const separator = resolveSemantic('tertiary', scene)
    // `.formStyle(.columns)` is a two-column layout — labels trailing-aligned
    // in a leading column, content leading-aligned in a trailing one.
    // `.grouped` (and `.automatic`, which resolves to grouped on visionOS) is
    // the inset card with hairline separators between rows.
    const columns = (panel.formStyle || 'automatic') === 'columns'
    const rowH = ptToUnits(panel.rowHeight ?? 48)
    const inset = ptToUnits(columns ? 0 : 12)
    const innerW = size[0] - inset * 2
    const padY = ptToUnits(columns ? 8 : 12)
    const startY = size[1] / 2 - padY
    // Apple's columns form puts the label gutter at ~40% of the width.
    const labelW = innerW * 0.4
    const gutter = ptToUnits(12)
    const cardShape = !columns && rows.length
      ? roundedRectShape(innerW, Math.min(rows.length * rowH, size[1] - padY * 2), ptToUnits(12))
      : null
    const visibleRows = Math.max(0, Math.floor((size[1] - padY * 2) / Math.max(rowH, 1e-6)))
    const shown = rows.slice(0, visibleRows)
    return (
      <group position={[0, 0, 0.004]}>
        {cardShape && (
          <mesh position={[0, startY - (shown.length * rowH) / 2, -0.001]}>
            <shapeGeometry args={[cardShape]} />
            <meshBasicMaterial color={resolveSemantic('secondarySystemBackground', scene)} transparent opacity={0.95} />
          </mesh>
        )}
        {shown.map((r, i) => {
          const cy = startY - rowH / 2 - i * rowH
          const label = r.title || ''
          const value = r.subtitle || r.value || ''
          return (
            <group key={i} position={[0, cy, 0]}>
              {columns ? (
                <>
                  <Text
                    position={[-innerW / 2 + labelW, 0, 0.002]}
                    font={fontUrl} fontSize={ptToUnits(15)} color={secondary}
                    anchorX="right" anchorY="middle" maxWidth={labelW}
                  >{label}</Text>
                  <Text
                    position={[-innerW / 2 + labelW + gutter, 0, 0.002]}
                    font={fontUrl} fontSize={ptToUnits(15)} color={primary}
                    anchorX="left" anchorY="middle" maxWidth={innerW - labelW - gutter}
                  >{value}</Text>
                </>
              ) : (
                <>
                  <Text
                    position={[-innerW / 2 + ptToUnits(14), 0, 0.002]}
                    font={fontUrl} fontSize={ptToUnits(15)} color={primary}
                    anchorX="left" anchorY="middle" maxWidth={innerW * 0.6}
                  >{label}</Text>
                  {value && (
                    <Text
                      position={[innerW / 2 - ptToUnits(14), 0, 0.002]}
                      font={fontUrl} fontSize={ptToUnits(14)} color={secondary}
                      anchorX="right" anchorY="middle" maxWidth={innerW * 0.35}
                    >{value}</Text>
                  )}
                  {/* Hairline between rows, inset from the leading edge the
                      way a grouped list insets its separators. */}
                  {i < shown.length - 1 && (
                    <mesh position={[ptToUnits(7), -rowH / 2, 0.001]}>
                      <planeGeometry args={[innerW - ptToUnits(14), ptToUnits(0.5)]} />
                      <meshBasicMaterial color={separator} />
                    </mesh>
                  )}
                </>
              )}
            </group>
          )
        })}
      </group>
    )
  })()

  // ---- OutlineGroup ----
  // A disclosure tree, flattened in the inspector to (title, indent,
  // expanded) rows. Same finding as `form`: the export built a whole
  // recursive `OutlineNode` model from this data while the canvas drew a bare
  // plate. AUDIT #6.
  //
  // `expanded` is honoured, so a collapsed row hides everything beneath it
  // until the next row at its own depth or shallower — which is what the
  // designer sees the tree doing. It is a preview affordance rather than a
  // document property: SwiftUI's OutlineGroup owns its own expansion state at
  // runtime, so the export carries the shape of the tree and not which parts
  // of it happen to be open.
  const outlineOverlay = panelType === 'outlinegroup' && (() => {
    const rows = panel.rows || []
    const primary = resolveSemantic('primary', scene)
    const separator = resolveSemantic('tertiary', scene)
    const rowH = ptToUnits(panel.rowHeight ?? 44)
    const inset = ptToUnits(12)
    const innerW = size[0] - inset * 2
    const padY = ptToUnits(10)
    const startY = size[1] / 2 - padY
    const indentStep = ptToUnits(18)

    const visible = outlineVisibleRows(rows)
    const maxRows = Math.max(0, Math.floor((size[1] - padY * 2) / Math.max(rowH, 1e-6)))
    const shown = visible.slice(0, maxRows)
    return (
      <group position={[0, 0, 0.004]}>
        {shown.map((r, i) => {
          const cy = startY - rowH / 2 - i * rowH
          const x0 = -innerW / 2 + r.level * indentStep
          return (
            <group key={i} position={[0, cy, 0]}>
              {/* Disclosure chevron — only on rows that have children, and
                  pointing down when open, as a DisclosureGroup draws it. */}
              {r.isParent && (
                <Text
                  position={[x0 + ptToUnits(6), 0, 0.002]}
                  fontSize={ptToUnits(11)} color={primary}
                  anchorX="center" anchorY="middle"
                >{r.expanded ? '▾' : '▸'}</Text>
              )}
              <Text
                position={[x0 + ptToUnits(18), 0, 0.002]}
                font={fontUrl} fontSize={ptToUnits(14)} color={primary}
                anchorX="left" anchorY="middle"
                maxWidth={innerW - r.level * indentStep - ptToUnits(18)}
              >{r.title || ''}</Text>
              {i < shown.length - 1 && (
                <mesh position={[ptToUnits(6), -rowH / 2, 0.001]}>
                  <planeGeometry args={[innerW - ptToUnits(12), ptToUnits(0.5)]} />
                  <meshBasicMaterial color={separator} transparent opacity={0.6} />
                </mesh>
              )}
            </group>
          )
        })}
      </group>
    )
  })()

  // `.tableStyle(.inset)` insets the table inside its container and drops the
  // grid rules for alternating row fills — Apple's "inset" look. `.automatic`
  // keeps the ruled grid. Exported correctly, drew the same grid either way.
  // AUDIT #19.
  const tableOverlay = panelType === 'table' && (() => {
    const cols = panel.columns || []
    const rows = panel.rows || []
    const inset = (panel.tableStyle || 'automatic') === 'inset'
    const pad = ptToUnits(inset ? 22 : 14)
    const innerW = size[0] - pad * 2
    const innerH = size[1] - pad * 2
    const headerH = ptToUnits(30)
    const rowH = rows.length > 0 ? (innerH - headerH) / rows.length : 0
    const colW = cols.length > 0 ? innerW / cols.length : innerW
    const primary = resolveSemantic('primary', scene)
    const secondary = resolveSemantic('secondary', scene)
    const sep = resolveSemantic('tertiary', scene)
    const startX = -innerW / 2
    const startY = innerH / 2
    return (
      <group position={[0, 0, 0.005]}>
        {/* Header fill */}
        <mesh position={[0, startY - headerH / 2, -0.001]}>
          <planeGeometry args={[innerW, headerH]} />
          <meshBasicMaterial color={resolveSemantic('systemFill', scene)} />
        </mesh>
        {/* Column headers */}
        {cols.map((c, i) => (
          <Text
            key={`c${i}`}
            position={[startX + colW * (i + 0.5), startY - headerH / 2, 0]}
            fontSize={ptToUnits(12)}
            color={secondary}
            fontWeight="semibold"
            anchorX="center"
            anchorY="middle"
            maxWidth={colW * 0.9}
          >{c.toUpperCase()}</Text>
        ))}
        {/* Header divider */}
        <mesh position={[0, startY - headerH, 0]}>
          <planeGeometry args={[innerW, 0.003]} />
          <meshBasicMaterial color={sep} />
        </mesh>
        {/* Vertical dividers — the ruled grid belongs to `.automatic`; the
            inset style separates columns by spacing alone. */}
        {!inset && cols.slice(1).map((_, i) => (
          <mesh key={`v${i}`} position={[startX + colW * (i + 1), startY - headerH / 2 - (rows.length * rowH) / 2, 0]}>
            <planeGeometry args={[0.003, headerH + rows.length * rowH]} />
            <meshBasicMaterial color={sep} />
          </mesh>
        ))}
        {/* Data rows */}
        {rows.map((row, r) => (
          <group key={`r${r}`} position={[0, startY - headerH - rowH * (r + 0.5), 0]}>
            {/* Alternating row fill — what the inset style uses in place of
                the rules it drops. */}
            {inset && r % 2 === 1 && (
              <mesh position={[0, 0, -0.001]}>
                <planeGeometry args={[innerW, rowH]} />
                <meshBasicMaterial color={resolveSemantic('systemFill', scene)} transparent opacity={0.5} />
              </mesh>
            )}
            {row.slice(0, cols.length).map((cell, i) => (
              <Text
                key={`cell${i}`}
                position={[startX + colW * (i + 0.5), 0, 0]}
                fontSize={ptToUnits(13)}
                color={primary}
                anchorX="center"
                anchorY="middle"
                maxWidth={colW * 0.9}
              >{cell}</Text>
            ))}
            {r < rows.length - 1 && (
              <mesh position={[0, -rowH / 2, -0.001]}>
                <planeGeometry args={[innerW, 0.002]} />
                <meshBasicMaterial color={sep} />
              </mesh>
            )}
          </group>
        ))}
      </group>
    )
  })()

  // ---- Menu ----
  // `.menuStyle` decides whether a Menu shows as an open list or as a button
  // that reveals one, and `.menuIndicator` whether that button carries a
  // chevron. Both exported correctly and drew the same open list either way.
  // AUDIT #19.
  const menuOverlay = panelType === 'menu' && (() => {
    const items = panel.menuItems || []
    const pad = ptToUnits(8)
    const innerW = size[0] - pad * 2
    const primary = resolveSemantic('primary', scene)
    const sep = resolveSemantic('tertiary', scene)
    const secondary = resolveSemantic('secondary', scene)
    const menuStyle = panel.menuStyle || 'automatic'
    // `.button` and `.borderlessButton` collapse the menu to its label; the
    // items only appear once it is opened, which a still canvas cannot show.
    const asButton = MENU_STYLES_AS_BUTTON.includes(menuStyle)
    const indicator = panel.menuIndicator || 'automatic'
    const showIndicator = indicator !== 'hidden'

    if (asButton) {
      return (
        <>
          <Text
            position={[-innerW / 2 + ptToUnits(10), 0, 0.005]}
            font={fontUrl} fontSize={ptToUnits(15)}
            color={menuStyle === 'borderlessButton' ? accentColor : primary}
            anchorX="left" anchorY="middle"
            maxWidth={innerW * 0.8}
          >{panel.text || 'Menu'}</Text>
          {showIndicator && (
            <Text
              position={[innerW / 2 - ptToUnits(4), 0, 0.005]}
              fontSize={ptToUnits(10)} color={secondary}
              anchorX="right" anchorY="middle"
            >▾</Text>
          )}
        </>
      )
    }

    const rowH = (size[1] - pad * 2) / Math.max(1, items.length)
    const startY = size[1] / 2 - pad
    return (
      <>
        {items.map((label, i) => (
          <group key={i} position={[0, startY - rowH * (i + 0.5), 0.005]}>
            <Text
              position={[-innerW / 2 + ptToUnits(10), 0, 0]}
              fontSize={ptToUnits(14)}
              color={primary}
              anchorX="left"
              anchorY="middle"
              maxWidth={innerW * 0.9}
            >{label}</Text>
            {i < items.length - 1 && (
              <mesh position={[0, -rowH / 2, -0.001]}>
                <planeGeometry args={[innerW, 0.002]} />
                <meshBasicMaterial color={sep} />
              </mesh>
            )}
          </group>
        ))}
      </>
    )
  })()

  // ---- Progress ----
  // `value` is measured against `total`, not against 1 — a ProgressView at
  // `value: 30, total: 100` is 30% full, and the canvas used to draw it
  // pinned at 100%. Indeterminate views have no fraction to show at all, and
  // `.circular` is a ring rather than a bar.
  const progressOverlay = panelType === 'progress' && (() => {
    const value = controlFraction(panel.value ?? 0.5, 0, panel.total ?? 1)
    const tint = accentColor
    const circular = panel.progressViewStyle === 'circular'

    if (panel.indeterminate) {
      // A spinner is a time-based affordance and the canvas is a still
      // frame, so draw the shape SwiftUI settles on rather than animating:
      // a ring arc for circular, and a part-width pill for linear, both in
      // the "position unknown" treatment the platform uses.
      const r = Math.min(size[0], size[1]) / 2
      if (circular) {
        return (
          <mesh position={[0, 0, 0.005]}>
            <ringGeometry args={[r * 0.72, r, 32, 1, 0, Math.PI * 1.35]} />
            <meshBasicMaterial color={tint} />
          </mesh>
        )
      }
      const barW = size[0] * 0.35
      return (
        <mesh position={[-size[0] / 2 + barW / 2, 0, 0.005]}>
          <shapeGeometry args={[roundedRectShape(barW, size[1], Math.min(cornerRadius, size[1] / 2))]} />
          <meshBasicMaterial color={tint} transparent opacity={0.75} />
        </mesh>
      )
    }

    if (circular) {
      const r = Math.min(size[0], size[1]) / 2
      return (
        <>
          <mesh position={[0, 0, 0.004]}>
            <ringGeometry args={[r * 0.72, r, 32]} />
            <meshBasicMaterial color={resolveSemantic('tertiary', scene)} />
          </mesh>
          {value > 0 && (
            <mesh position={[0, 0, 0.005]} rotation={[0, 0, Math.PI / 2]}>
              <ringGeometry args={[r * 0.72, r, 32, 1, 0, -Math.PI * 2 * value]} />
              <meshBasicMaterial color={tint} />
            </mesh>
          )}
        </>
      )
    }

    const fillW = size[0] * value
    return (
      <mesh position={[-size[0] / 2 + fillW / 2, 0, 0.005]}>
        <shapeGeometry args={[roundedRectShape(fillW, size[1], Math.min(cornerRadius, size[1] / 2))]} />
        <meshBasicMaterial color={tint} />
      </mesh>
    )
  })()

  // ---- Slider ----
  const sliderOverlay = panelType === 'slider' && (() => {
    // `sliderValue` lives in the slider's own range, not in 0…1 — see
    // `controlFraction`. The labels shrink the track the way SwiftUI's
    // `minimumValueLabel:` / `maximumValueLabel:` slots do.
    const value = controlFraction(panel.sliderValue ?? 0.5, panel.sliderMin, panel.sliderMax)
    const trackH = ptToUnits(4)
    const thumbR = ptToUnits(13)
    const minLabel = panel.sliderMinLabel || ''
    const maxLabel = panel.sliderMaxLabel || ''
    const labelPt = ptToUnits(13)
    const labelGap = ptToUnits(8)
    const leadInset  = minLabel ? ptToUnits(minLabel.length * 7) + labelGap : 0
    const trailInset = maxLabel ? ptToUnits(maxLabel.length * 7) + labelGap : 0
    const trackW = Math.max(ptToUnits(20), size[0] - leadInset - trailInset)
    const trackX0 = -size[0] / 2 + leadInset
    const fillW = trackW * value
    // Preview: click/drag along the track sets the slider value from
    // the local-X intersect. Editor-mode keeps the panel passive so
    // the regular drag-to-reposition pipeline still works.
    const setFromIntersect = (e) => {
      if (!scene.previewMode) return
      e.stopPropagation()
      const local = e.eventObject.worldToLocal(e.point.clone())
      const t = Math.max(0, Math.min(1, (local.x - trackX0) / trackW))
      useStore.getState().updateItem(id, {
        sliderValue: valueFromFraction(t, panel.sliderMin, panel.sliderMax, panel.sliderStep)
      })
    }
    return (
      <group
        onPointerDown={(e) => {
          if (!scene.previewMode) return
          setFromIntersect(e)
          try { e.target.setPointerCapture(e.pointerId) } catch {}
        }}
        onPointerMove={(e) => {
          if (!scene.previewMode || e.buttons === 0) return
          setFromIntersect(e)
        }}
        onPointerUp={(e) => {
          if (!scene.previewMode) return
          try { e.target.releasePointerCapture(e.pointerId) } catch {}
        }}
      >
        <mesh position={[trackX0 + trackW / 2, 0, 0.003]}>
          <planeGeometry args={[trackW, trackH]} />
          <meshBasicMaterial color={resolveSemantic('tertiary', scene)} />
        </mesh>
        <mesh position={[trackX0 + fillW / 2, 0, 0.004]}>
          <planeGeometry args={[fillW, trackH]} />
          <meshBasicMaterial color={accentColor} />
        </mesh>
        <mesh position={[trackX0 + fillW, 0, 0.006]}>
          <circleGeometry args={[thumbR, 32]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        {minLabel && (
          <Text
            position={[-size[0] / 2, 0, 0.005]}
            fontSize={labelPt}
            color={resolveSemantic('secondary', scene)}
            anchorX="left"
            anchorY="middle"
          >{minLabel}</Text>
        )}
        {maxLabel && (
          <Text
            position={[size[0] / 2, 0, 0.005]}
            fontSize={labelPt}
            color={resolveSemantic('secondary', scene)}
            anchorX="right"
            anchorY="middle"
          >{maxLabel}</Text>
        )}
      </group>
    )
  })()

  // Stepper — Apple HIG visionOS renders this as a label on the
  // leading edge, the current value next to it, and two *separate*
  // circular buttons for `−` and `+` on the trailing edge. That's
  // the shape in the reference screenshot the user shared. The
  // previous "one bar with two dividers" treatment came from iOS
  // UIKit and doesn't match the platform.
  const stepperOverlay = panelType === 'stepper' && (() => {
    const primary = resolveSemantic('primary', scene)
    const buttonBg = resolveSemantic('secondarySystemFill', scene) || '#e3e3e8'
    const CIRCLE_R = ptToUnits(14)
    // Trailing-edge button cluster: [-] [value] [+], 12pt gap.
    const xPlus  = size[0] / 2 - CIRCLE_R - ptToUnits(4)
    const xMinus = xPlus - (CIRCLE_R * 2 + ptToUnits(12))
    const xValue = xMinus - ptToUnits(18)
    // SwiftUI's Stepper moves by `step` and stops at the ends of `in:`.
    // The canvas bumped by ±1 and ran past both bounds, so a stepper
    // authored `0…10 by 5` counted 1, 2, 3 … here and 0, 5, 10 on device,
    // and the buttons never went inert at the ends. AUDIT #17.
    const lo = Number(panel.stepperMin ?? 0)
    const hi = Number(panel.stepperMax ?? 10)
    const stepBy = Number(panel.stepperStep) || 1
    const current = Math.max(lo, Math.min(hi, Number(panel.stepperValue ?? 0)))
    const bump = (delta) => (e) => {
      if (!scene.previewMode) return
      e.stopPropagation()
      const next = Math.max(lo, Math.min(hi, current + delta * stepBy))
      if (next !== current) useStore.getState().updateItem(id, { stepperValue: next })
    }
    // Apple dims the button that can no longer do anything.
    const atMin = current <= lo
    const atMax = current >= hi
    return (
      <>
        {/* Leading label uses the panel's text rendering path above; the
            stepper-specific glyph + value live here. */}
        <Text position={[xValue, 0, 0.005]} fontSize={ptToUnits(14)} color={primary} anchorX="right" anchorY="middle" fontWeight="semibold">
          {String(current)}
        </Text>
        {/* Minus button */}
        <group position={[xMinus, 0, 0.004]} onPointerDown={bump(-1)}>
          <mesh>
            <circleGeometry args={[CIRCLE_R, 32]} />
            <meshBasicMaterial color={buttonBg} transparent opacity={atMin ? 0.4 : 1} />
          </mesh>
          <Text position={[0, 0, 0.002]} fontSize={ptToUnits(16)} color={primary} fillOpacity={atMin ? 0.4 : 1} anchorX="center" anchorY="middle">−</Text>
        </group>
        {/* Plus button */}
        <group position={[xPlus, 0, 0.004]} onPointerDown={bump(+1)}>
          <mesh>
            <circleGeometry args={[CIRCLE_R, 32]} />
            <meshBasicMaterial color={buttonBg} transparent opacity={atMax ? 0.4 : 1} />
          </mesh>
          <Text position={[0, 0, 0.002]} fontSize={ptToUnits(16)} color={primary} fillOpacity={atMax ? 0.4 : 1} anchorX="center" anchorY="middle">+</Text>
        </group>
      </>
    )
  })()

  // ---- Gauge ----
  // `value` sits in `gaugeMin…gaugeMax` (which defaults to 0…100, not 0…1),
  // so the fraction has to be derived rather than read straight off the
  // field. `gaugeStyle` picks between the linear-capacity bar and the
  // accessory-circular dial, and `gaugeTintFrom/To` fills with the same
  // two-stop gradient the exporter hands to `.tint(Gradient(...))`.
  const gaugeOverlay = panelType === 'gauge' && (() => {
    const value = controlFraction(panel.value ?? 0.5, panel.gaugeMin, panel.gaugeMax)
    const primary = resolveSemantic('primary', scene)
    const track = resolveSemantic('tertiary', scene)
    const style = panel.gaugeStyle || 'automatic'
    const circular = style === 'accessoryCircular' || style === 'accessoryCircularCapacity'
    // A two-stop tint reads as a gradient on device; the canvas approximates
    // it with the colour at the value's own position, which is the stop the
    // eye lands on.
    const tint = (panel.gaugeTintFrom && panel.gaugeTintTo)
      ? mixHex(panel.gaugeTintFrom, panel.gaugeTintTo, value)
      : (accentColor)
    const minLabel = panel.gaugeMinLabel || ''
    const maxLabel = panel.gaugeMaxLabel || ''
    const labelPt = ptToUnits(11)

    if (circular) {
      const r = Math.min(size[0], size[1]) * 0.38
      // Accessory-circular sweeps a 270° dial from the lower-left; the
      // capacity variant closes the full ring.
      const sweep = style === 'accessoryCircularCapacity' ? Math.PI * 2 : Math.PI * 1.5
      const start = style === 'accessoryCircularCapacity' ? Math.PI / 2 : Math.PI * 1.25
      return (
        <>
          <mesh position={[0, 0, 0.003]} rotation={[0, 0, start]}>
            <ringGeometry args={[r * 0.74, r, 40, 1, 0, -sweep]} />
            <meshBasicMaterial color={track} />
          </mesh>
          {value > 0 && (
            <mesh position={[0, 0, 0.004]} rotation={[0, 0, start]}>
              <ringGeometry args={[r * 0.74, r, 40, 1, 0, -sweep * value]} />
              <meshBasicMaterial color={tint} />
            </mesh>
          )}
          <Text
            position={[0, 0, 0.005]}
            fontSize={ptToUnits(16)}
            color={primary}
            fontWeight="bold"
            anchorX="center"
            anchorY="middle"
          >{panel.text || ''}</Text>
        </>
      )
    }

    const trackH = ptToUnits(6)
    const trackY = -size[1] * 0.25
    // The value labels sit at the ends of the bar, so the bar gives way to
    // them rather than running underneath.
    const leadInset  = minLabel ? ptToUnits(minLabel.length * 6 + 6) : 0
    const trailInset = maxLabel ? ptToUnits(maxLabel.length * 6 + 6) : 0
    const barW = Math.max(ptToUnits(20), size[0] * 0.85 - leadInset - trailInset)
    const barX0 = -size[0] * 0.425 + leadInset
    return (
      <>
        <mesh position={[barX0 + barW / 2, trackY, 0.003]}>
          <planeGeometry args={[barW, trackH]} />
          <meshBasicMaterial color={track} />
        </mesh>
        <mesh position={[barX0 + barW * value / 2, trackY, 0.004]}>
          <planeGeometry args={[barW * value, trackH]} />
          <meshBasicMaterial color={tint} />
        </mesh>
        {minLabel && (
          <Text
            position={[-size[0] * 0.425, trackY, 0.005]}
            fontSize={labelPt} color={resolveSemantic('secondary', scene)}
            anchorX="left" anchorY="middle"
          >{minLabel}</Text>
        )}
        {maxLabel && (
          <Text
            position={[size[0] * 0.425, trackY, 0.005]}
            fontSize={labelPt} color={resolveSemantic('secondary', scene)}
            anchorX="right" anchorY="middle"
          >{maxLabel}</Text>
        )}
        <Text
          position={[0, size[1] * 0.1, 0.005]}
          fontSize={ptToUnits(22)}
          color={primary}
          fontWeight="bold"
          anchorX="center"
          anchorY="middle"
        >{panel.text || String(Math.round(value * 100))}</Text>
      </>
    )
  })()

  const slideCount = panel.slideCount || 3
  const slideshowOverlay = panelType === 'slideshow' && (
    <group position={[0, -size[1] * 0.35, 0.005]}>
      {Array.from({ length: slideCount }).map((_, i) => {
        const dotSize = ptToUnits(6)
        const gap = ptToUnits(10)
        const totalW = slideCount * dotSize + (slideCount - 1) * gap
        const x = -totalW / 2 + i * (dotSize + gap) + dotSize / 2
        const active = i === (panel.currentSlide || 0)
        return (
          <mesh key={i} position={[x, 0, 0.001]}>
            <circleGeometry args={[dotSize / 2, 16]} />
            <meshBasicMaterial
              color={active ? (accentColor) : resolveSemantic('tertiary', scene)}
            />
          </mesh>
        )
      })}
    </group>
  )

  // ---- Phase 3 overlays ----

  const labelOverlay = panelType === 'label' && (() => {
    const symbolName = panel.symbolName || 'info.circle'
    // Empty-text labels are "icon-only" — used in templates as room/
    // section glyphs without the SwiftUI `Label` text slot. We render
    // just the icon (no tile, no placeholder "Label" text) so the row
    // doesn't pick up an unintended blue chip + filler word.
    const iconOnly = !panel.text
    // Apple's sidebar Label pattern (Settings.app): a coloured rounded-rect
    // tile behind the glyph instead of a circle. Driven by:
    //   iconTileColor  — fill color; null ⇒ classic circle fallback
    //   iconTileRadius — pt, corner radius of the tile (default 6)
    //   iconTileSize   — pt, square side length (default 28)
    const tileColor = panel.iconTileColor
    const tileSize = ptToUnits(panel.iconTileSize ?? 28)
    const tileRadius = ptToUnits(panel.iconTileRadius ?? 6)
    const iconR = tileSize / 2
    const iconX = iconOnly ? 0 : -size[0] / 2 + iconR + ptToUnits(4)
    const textX = -size[0] / 2 + tileSize + ptToUnits(12)
    const resolvedTile = tileColor
      ? (tileColor.startsWith('#') ? tileColor : resolveSemantic(tileColor, scene))
      : null
    const tileShape = resolvedTile && !iconOnly
      ? roundedRectShape(tileSize, tileSize, tileRadius)
      : null
    // Icon-only labels drop the coloured chip and paint the glyph in
    // the panel's textColor — that lets a template author tint the
    // glyph via the standard `colorToken: 'primary'` knob. SwiftUI
    // .imageScale propagates to the symbol size; .fontWeight drives
    // stroke width via SymbolIcon3D's `weight` prop.
    const glyphColor = iconOnly ? resolvedTextColor : '#ffffff'
    const glyphUnits = iconOnly ? finalFontSize : ptToUnits(18)
    return (
      <>
        {!iconOnly && tileShape && (
          <mesh position={[iconX, 0, 0.005]}>
            <shapeGeometry args={[tileShape]} />
            <meshBasicMaterial color={resolvedTile} />
          </mesh>
        )}
        {!iconOnly && !tileShape && (
          <mesh position={[iconX, 0, 0.005]}>
            <circleGeometry args={[iconR, 32]} />
            <meshBasicMaterial color={panel.iconColor || '#007aff'} />
          </mesh>
        )}
        <SymbolIcon3D
          name={symbolName}
          sizeUnits={glyphUnits}
          color={glyphColor}
          weight={panel.fontWeight || 'medium'}
          imageScale={panel.imageScale || 'medium'}
          variant={panel.symbolVariant || null}
          renderingMode={panel.symbolRenderingMode || 'monochrome'}
          position={[iconX, 0, 0.006]}
        />
        {!iconOnly && (
          <Text position={[textX, 0, 0.005]} font={fontUrl} fontSize={finalFontSize} color={resolvedTextColor} anchorX="left" anchorY="middle" maxWidth={size[0] * 0.65}>
            {panel.text}
          </Text>
        )}
      </>
    )
  })()

  // TextField / SecureField rendering. Suppressed while the live HTML
  // <input> overlay is mounted (isEditing) so we don't paint the 3D
  // string on top of the input's caret. Otherwise:
  //   - TextField    \u2192 typed value if any, else greyer placeholder
  //   - SecureField  \u2192 '\u2022' per character of the typed value (legacy
  //                    `dotCount` placeholder when empty)
  const textfieldOverlay = !isEditing && (panelType === 'textfield' || panelType === 'securefield') && (() => {
    const isSec = panelType === 'securefield'
    const liveValue = isSec ? (panel.securefieldValue || '') : (panel.textfieldValue || '')
    const placeholder = panel.text || (isSec ? 'Password' : 'Placeholder')
    const showPlaceholder = !liveValue
    const displayText = isSec
      ? (liveValue ? '\u2022'.repeat(liveValue.length) : '\u2022'.repeat(panel.dotCount || 8))
      : (liveValue || placeholder)
    const textColor = showPlaceholder
      ? (panel.textColor || '#545454')
      : resolveSemantic('primary', scene)
    // `TextField(..., axis: .vertical)` grows down instead of scrolling
    // sideways, up to `lineLimit`. The canvas drew one clipped line whichever
    // axis the designer picked, so a field authored to wrap previewed as a
    // single-line field and grew on device. AUDIT #19.
    const vertical = panel.axis === 'vertical'
    const cap = Math.max(1, Number(panel.lineLimit) || 1)
    return (
      <>
        <Text
          position={[
            -size[0] / 2 + ptToUnits(14),
            vertical ? size[1] / 2 - ptToUnits(12) : 0,
            0.005
          ]}
          font={fontUrl} fontSize={finalFontSize} color={textColor}
          anchorX="left" anchorY={vertical ? 'top' : 'middle'}
          maxWidth={size[0] - ptToUnits(28)}
          {...(vertical ? { maxLines: cap } : {})}
        >
          {displayText}
        </Text>
      </>
    )
  })()

  const texteditorOverlay = panelType === 'texteditor' && (() => {
    const lines = panel.lineCount || 5
    const lineH = (size[1] - ptToUnits(20)) / lines
    return (
      <>
        <Text position={[-size[0] / 2 + ptToUnits(14), size[1] / 2 - ptToUnits(18), 0.005]} font={fontUrl} fontSize={finalFontSize} color={resolvedTextColor} anchorX="left" anchorY="top" maxWidth={size[0] * 0.9}>
          {panel.text || 'Type here...'}
        </Text>
        {Array.from({ length: lines }).map((_, i) => (
          <mesh key={i} position={[0, size[1] / 2 - ptToUnits(10) - lineH * (i + 1), 0.003]}>
            <planeGeometry args={[size[0] * 0.9, ptToUnits(0.5)]} />
            <meshBasicMaterial color={resolveSemantic('tertiary', scene)} transparent opacity={0.5} />
          </mesh>
        ))}
      </>
    )
  })()

  // A Picker only shows its options in the styles that lay them out — the
  // menu styles keep them behind a tap, which a still canvas cannot open. So
  // `.segmented`, `.wheel`, `.inline` and `.palette` draw `pickerOptions` and
  // the rest draw the selected value with a chevron, which is what the canvas
  // did for every style. AUDIT #19.
  const pickerOverlay = panelType === 'picker' && (() => {
    const primary = resolveSemantic('primary', scene)
    const secondary = resolveSemantic('secondary', scene)
    const opts = panel.pickerOptions || []
    const style = panel.pickerStyle || 'automatic'
    const laysOutOptions = PICKER_STYLES_SHOWING_OPTIONS.includes(style)

    if (laysOutOptions && opts.length) {
      const selected = panel.pickerValue
      if (style === 'segmented' || style === 'palette') {
        // A row of segments across the frame, the selected one raised.
        const segW = size[0] / opts.length
        return (
          <>
            {opts.map((o, i) => (
              <group key={i} position={[-size[0] / 2 + segW * (i + 0.5), 0, 0.005]}>
                {o === selected && (
                  <mesh position={[0, 0, -0.001]}>
                    <shapeGeometry args={[roundedRectShape(segW - ptToUnits(4), size[1] - ptToUnits(6), ptToUnits(7))]} />
                    <meshBasicMaterial color={resolveSemantic('systemBackground', scene)} transparent opacity={0.95} />
                  </mesh>
                )}
                <Text
                  font={fontUrl} fontSize={ptToUnits(13)}
                  color={o === selected ? primary : secondary}
                  anchorX="center" anchorY="middle" maxWidth={segW * 0.9}
                >{o}</Text>
              </group>
            ))}
          </>
        )
      }
      // `.wheel` and `.inline` stack the options vertically; the wheel dims
      // everything but the selection, the way a spinning drum does.
      const rowH = size[1] / Math.max(1, opts.length)
      return (
        <>
          {opts.map((o, i) => (
            <Text
              key={i}
              position={[0, size[1] / 2 - rowH * (i + 0.5), 0.005]}
              font={fontUrl} fontSize={ptToUnits(14)}
              color={o === selected ? primary : secondary}
              fillOpacity={style === 'wheel' && o !== selected ? 0.45 : 1}
              anchorX="center" anchorY="middle" maxWidth={size[0] * 0.9}
            >{o}</Text>
          ))}
        </>
      )
    }

    return (
      <>
        <Text position={[-size[0] / 2 + ptToUnits(12), 0, 0.005]} font={fontUrl} fontSize={finalFontSize} color={resolvedTextColor} anchorX="left" anchorY="middle" maxWidth={size[0] * 0.45}>
          {panel.text || 'Selection'}
        </Text>
        <Text position={[size[0] / 2 - ptToUnits(24), 0, 0.005]} font={fontUrl} fontSize={ptToUnits(14)} color={primary} anchorX="right" anchorY="middle">
          {panel.pickerValue || ''}
        </Text>
        <Text position={[size[0] / 2 - ptToUnits(8), 0, 0.005]} fontSize={ptToUnits(10)} color={resolveSemantic('secondary', scene)} anchorX="right" anchorY="middle">
          ▾
        </Text>
      </>
    )
  })()

  // `.datePickerStyle` and `displayedComponents` both reached the export
  // only: the canvas drew the compact row with the raw ISO value whatever
  // the designer picked, so a graphical picker previewed as a text field and
  // a date-only picker still showed a time. AUDIT #19.
  const datepickerOverlay = panelType === 'datepicker' && (() => {
    const iso = panel.dateValue || '2026-04-16'
    const comps = panel.displayedComponents || 'dateAndTime'
    const style = panel.dateStyle || 'automatic'
    const secondary = resolveSemantic('secondary', scene)
    const primary = resolveSemantic('primary', scene)
    // Show the parts `displayedComponents` asks for and no others. The stored
    // value is a date; the time half is a fixed sample, since the canvas has
    // no clock to read and the exported `Date()` has no literal either.
    const datePart = (() => {
      const d = new Date(`${iso}T00:00:00`)
      if (Number.isNaN(d.getTime())) return iso
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    })()
    const parts = dateComponentsParts(comps)
    const timePart = parts.seconds ? '9:41:07 AM' : '9:41 AM'
    const shown = [parts.date ? datePart : null, parts.time ? timePart : null]
      .filter(Boolean).join(', ')

    if (style === 'graphical') {
      // A month grid — six columns of day cells with the selected one marked.
      const cols = 7, rowsN = 5
      const gw = size[0] * 0.86, gh = size[1] * 0.66
      const cw = gw / cols, ch = gh / rowsN
      const day = Number(iso.slice(8, 10)) || 1
      return (
        <>
          <Text position={[0, size[1] / 2 - ptToUnits(14), 0.005]} font={getInterFont('semibold')} fontSize={ptToUnits(13)} color={primary} anchorX="center" anchorY="middle">
            {datePart}
          </Text>
          {Array.from({ length: cols * rowsN }, (_, i) => {
            const r = Math.floor(i / cols), c = i % cols
            const n = i + 1
            const on = n === day
            return (
              <group key={i} position={[-gw / 2 + cw * (c + 0.5), gh / 2 - ch * (r + 0.5) - ptToUnits(8), 0.005]}>
                {on && (
                  <mesh position={[0, 0, -0.001]}>
                    <circleGeometry args={[Math.min(cw, ch) * 0.42, 20]} />
                    <meshBasicMaterial color={accentColor} />
                  </mesh>
                )}
                <Text fontSize={ptToUnits(9)} color={on ? '#ffffff' : secondary} anchorX="center" anchorY="middle">
                  {n <= 31 ? String(n) : ''}
                </Text>
              </group>
            )
          })}
        </>
      )
    }

    if (style === 'wheel') {
      // Three drum columns, the middle band selected.
      const parts = shown.split(/[,\s]+/).filter(Boolean).slice(0, 3)
      const cw = size[0] / Math.max(1, parts.length)
      return (
        <>
          <mesh position={[0, 0, 0.004]}>
            <planeGeometry args={[size[0] * 0.94, ptToUnits(28)]} />
            <meshBasicMaterial color={resolveSemantic('systemFill', scene)} transparent opacity={0.6} />
          </mesh>
          {parts.map((p, i) => (
            <Text key={i} position={[-size[0] / 2 + cw * (i + 0.5), 0, 0.005]} font={fontUrl} fontSize={ptToUnits(14)} color={primary} anchorX="center" anchorY="middle" maxWidth={cw * 0.9}>
              {p}
            </Text>
          ))}
        </>
      )
    }

    // `.automatic` resolves to `.compact` on visionOS: label leading, the
    // value in a tinted capsule trailing.
    return (
      <>
        <Text position={[-size[0] / 2 + ptToUnits(12), 0, 0.005]} font={fontUrl} fontSize={finalFontSize} color={resolvedTextColor} anchorX="left" anchorY="middle" maxWidth={size[0] * 0.4}>
          {panel.text || 'Date'}
        </Text>
        <Text position={[size[0] / 2 - ptToUnits(12), 0, 0.005]} font={getInterFont('medium')} fontSize={ptToUnits(14)} color={accentColor} anchorX="right" anchorY="middle" maxWidth={size[0] * 0.55}>
          {shown}
        </Text>
      </>
    )
  })()

  const colorpickerOverlay = panelType === 'colorpicker' && (
    <>
      <Text position={[-size[0] / 2 + ptToUnits(4), 0, 0.005]} font={fontUrl} fontSize={finalFontSize} color={resolveSemantic('primary', scene)} anchorX="left" anchorY="middle">
        {panel.text || 'Color'}
      </Text>
      <mesh position={[size[0] / 2 - ptToUnits(18), 0, 0.005]}>
        <circleGeometry args={[ptToUnits(11), 32]} />
        <meshBasicMaterial color={panel.pickedColor || '#ff0000'} />
      </mesh>
      <mesh position={[size[0] / 2 - ptToUnits(18), 0, 0.003]}>
        <ringGeometry args={[ptToUnits(11), ptToUnits(12.5), 32]} />
        <meshBasicMaterial color={resolveSemantic('tertiary', scene)} />
      </mesh>
    </>
  )

  const linkOverlay = panelType === 'link' && (
    <>
      <Text position={[0, 0, 0.005]} font={fontUrl} fontSize={finalFontSize} color={fillColor} anchorX={anchorX} anchorY="middle" maxWidth={size[0]}>
        {panel.text || 'Link'}
      </Text>
      <mesh position={[0, -finalFontSize * 0.55, 0.004]}>
        <planeGeometry args={[Math.min(size[0], ptToUnits((panel.text || 'Link').length * 9)), ptToUnits(1)]} />
        <meshBasicMaterial color={fillColor} />
      </mesh>
    </>
  )

  const asyncimageOverlay = panelType === 'asyncimage' && (
    <>
      <mesh position={[0, 0, 0.005]}>
        <ringGeometry args={[ptToUnits(14), ptToUnits(17), 32, 1, 0, Math.PI * 1.5]} />
        <meshBasicMaterial color={resolveSemantic('secondary', scene)} />
      </mesh>
      <Text position={[0, -ptToUnits(28), 0.005]} fontSize={ptToUnits(11)} color={resolveSemantic('secondary', scene)} anchorX="center" anchorY="middle">
        Loading...
      </Text>
    </>
  )

  const contentUnavailableOverlay = panelType === 'contentUnavailable' && (
    <>
      <mesh position={[0, size[1] * 0.15, 0.005]}>
        <circleGeometry args={[ptToUnits(24), 32]} />
        <meshBasicMaterial color={resolveSemantic('tertiary', scene)} />
      </mesh>
      <Text position={[0, size[1] * 0.15, 0.006]} fontSize={ptToUnits(20)} color={resolveSemantic('secondary', scene)} anchorX="center" anchorY="middle">
        !
      </Text>
      <Text position={[0, -size[1] * 0.05, 0.005]} font={getInterFont('semibold')} fontSize={ptToUnits(18)} color={resolveSemantic('primary', scene)} anchorX="center" anchorY="middle" maxWidth={size[0] * 0.85}>
        {panel.text || 'No Results'}
      </Text>
      <Text position={[0, -size[1] * 0.2, 0.005]} font={fontUrl} fontSize={ptToUnits(14)} color={resolveSemantic('secondary', scene)} anchorX="center" anchorY="middle" maxWidth={size[0] * 0.85}>
        {panel.alertMessage || ''}
      </Text>
    </>
  )

  // ---- Phase 4 overlays ----

  const groupboxOverlay = panelType === 'groupbox' && (
    <Text position={[-size[0] / 2 + ptToUnits(16), size[1] / 2 - ptToUnits(16), 0.005]} font={getInterFont('semibold')} fontSize={ptToUnits(15)} color={resolveSemantic('primary', scene)} anchorX="left" anchorY="middle" maxWidth={size[0] * 0.85}>
      {panel.text || 'GroupBox'}
    </Text>
  )

  // ---- Phase 5 shape memos ----

  const ellipseMesh = useMemo(
    () => panelType === 'ellipse' ? ellipseShape(size[0], size[1]) : null,
    [panelType, size[0], size[1]]
  )
  const ellipseStrokeShape = useMemo(
    () => panelType === 'ellipse' && hasStroke
      ? ellipseShape(size[0] + strokeWidth * 2, size[1] + strokeWidth * 2)
      : null,
    [panelType, hasStroke, size[0], size[1], strokeWidth]
  )

  const unevenShape = useMemo(
    () => panelType === 'unevenRoundedRect'
      ? unevenRoundedRectShape(
          size[0], size[1],
          panel.topLeadingRadius ?? 0,
          panel.topTrailingRadius ?? 0,
          panel.bottomLeadingRadius ?? 0,
          panel.bottomTrailingRadius ?? 0
        )
      : null,
    [panelType, size[0], size[1], panel.topLeadingRadius, panel.topTrailingRadius, panel.bottomLeadingRadius, panel.bottomTrailingRadius]
  )
  const unevenStrokeShape = useMemo(
    () => panelType === 'unevenRoundedRect' && hasStroke
      ? unevenRoundedRectShape(
          size[0] + strokeWidth * 2, size[1] + strokeWidth * 2,
          (panel.topLeadingRadius ?? 0) + strokeWidth,
          (panel.topTrailingRadius ?? 0) + strokeWidth,
          (panel.bottomLeadingRadius ?? 0) + strokeWidth,
          (panel.bottomTrailingRadius ?? 0) + strokeWidth
        )
      : null,
    [panelType, hasStroke, size[0], size[1], strokeWidth, panel.topLeadingRadius, panel.topTrailingRadius, panel.bottomLeadingRadius, panel.bottomTrailingRadius]
  )

  // ---- Gradient texture ----
  // CanvasTexture sampled across the panel's frame for the three gradient
  // shape types. The hook is always called (rules of hooks) but only
  // consumed when the panel's actually a gradient.
  const gradientKind = panelType === 'linearGradient' ? 'linear'
                    : panelType === 'radialGradient' ? 'radial'
                    : panelType === 'angularGradient' ? 'angular'
                    : null
  const gradientTexture = useGradientTexture({
    kind: gradientKind,
    from: panel.gradientFrom,
    to:   panel.gradientTo,
    angleDeg: panel.gradientAngle ?? 180
  })
  const gradientGeometry = useMemo(() => {
    if (!gradientKind) return null
    return buildUvShapeGeometry(roundedRectShape(size[0], size[1], 0), size[0], size[1])
  }, [gradientKind, size[0], size[1]])

  // ---- Modifier preview values ----
  // Derived from the ordered modifier stack via summarizeModifiers above.
  // Order is preserved in the SwiftUI export; the canvas uses the reduced
  // last-write-wins values for an approximate preview.
  const modOffX = ptToUnits(modSummary.offsetX || 0)
  // NEGATED: `.offset(y:)` is stored in SwiftUI's coordinate space, where +y
  // points DOWN — that is what the arrow-key nudge writes and what the
  // exporter emits verbatim. The canvas is a 3D scene with +y UP, so adding
  // the stored value directly sent a panel the opposite way from the key the
  // user pressed: ArrowUp moved it down. X needs no flip; both spaces agree
  // that +x is right.
  const modOffY = -ptToUnits(modSummary.offsetY || 0)
  const modRot = (modSummary.rotation || 0) * DEG2RAD
  const modScaleX = modSummary.scaleX ?? 1
  const modScaleY = modSummary.scaleY ?? 1
  const modOpacity = modSummary.opacity ?? 1
  const shadowSummary = modSummary.shadow
  const borderSummary = modSummary.border
  const hasShadow = !!shadowSummary
  const hasBorder = !!borderSummary

  // ---- Decoration modifiers (AUDIT #5) ------------------------------------
  // These all emitted correct Swift and drew nothing: the summary carried the
  // values and no renderer read them, so `.background(.blue)` left the canvas
  // untouched until export. They are read here, in the order SwiftUI composes
  // them — background behind, then the view, then overlay in front.
  //
  // `.clipShape` decides the outline every one of them is painted into, which
  // is why it is resolved first.
  const modClipShape = modSummary.clipShape && modSummary.clipShape !== 'none'
    ? modSummary.clipShape
    : null
  const decorShape = useMemo(() => {
    const [w, h] = size
    if (modClipShape === 'circle') {
      const r = Math.min(w, h) / 2
      return ellipseShape(r * 2, r * 2)
    }
    if (modClipShape === 'capsule') return roundedRectShape(w, h, Math.min(w, h) / 2)
    if (modClipShape === 'roundedRect') return roundedRectShape(w, h, cornerRadius || ptToUnits(12))
    return null
  }, [modClipShape, size[0], size[1], cornerRadius])
  // The shape the decoration layers use: the clip outline when one is set,
  // otherwise the panel's own fill outline.
  const paintShape = decorShape || fillShape

  // `.background` takes a colour or a material tier; the summary stores
  // whichever the designer picked, so a leading '#' is the discriminator.
  const modBackground = (() => {
    const bg = modSummary.background
    if (!bg) return null
    if (typeof bg !== 'string') return null
    if (bg.startsWith('#')) return { color: bg, opacity: 1 }
    const mat = resolveAnyMaterial(bg, scene)
    return { color: mat?.color || resolveSemantic(bg, scene), opacity: mat?.opacity ?? 1 }
  })()

  // `.glassBackgroundEffect` is the app's signature material and was inert as
  // a modifier. `displayMode: 'never'` is the one case that draws nothing.
  const modGlass = (modSummary.glass && modSummary.glass.displayMode !== 'never')
    ? resolveAnyMaterial('glass', scene)
    : null

  const modOverlay = modSummary.overlay && modSummary.overlay.color
    ? modSummary.overlay
    : null

  // `.zIndex` is draw order. three.js sorts transparent meshes by depth, so a
  // small z nudge plus `renderOrder` gives the same front-to-back control
  // SwiftUI gets from the number, without disturbing the layout.
  const modZIndex = Number(modSummary.zIndex)
  const hasZIndex = Number.isFinite(modZIndex) && modZIndex !== 0

  // ---- Hover effect (visionOS .hoverEffect) ----
  // Resolved per-panel (own > inherit-from-window > automatic). When the
  // panel is being dragged we suppress hover so the lift doesn't fight the
  // drag offset. The 'highlight' effect renders an additive tint overlay
  // (rendered below); 'lift' and 'automatic' just nudge scale + Z.
  //
  // visionOS hover fires on gaze, not pointer-over. In edit mode the
  // designer's mouse moving across the canvas isn't a gaze event — it's
  // a layout cursor — so we suppress the hover lift/highlight outside
  // Preview. Inside Preview, hover *is* the gaze proxy and re-engages.
  // The modifier stack is the SwiftUI spelling, so `.hoverEffect(...)` wins
  // over the stored `panel.hoverEffect` the inspector writes, and
  // `.hoverEffectDisabled(true)` turns it off outright. Both used to be a
  // second, ignored source for a thing the canvas already had its own path
  // for — the pair diverged the moment the designer used the stack. AUDIT #5.
  const effectiveHover = modSummary.hoverEffectDisabled
    ? 'none'
    : (modSummary.hoverEffect || resolveHoverEffect(panel, items))
  const hoverActive = hovered
                   && !dragData.current?.dragging
                   && effectiveHover !== 'none'
                   && !!scene.previewMode
  // visionOS hover is soft — a subtle scale (~1%) and a few-millimetre
  // lift, not a 5% jump. The old numbers read as jittery cards
  // popping toward the camera when the gaze flicked. Reduced
  // amplitudes match the actual gaze-hover feel on device.
  let hoverScaleTarget = 1, hoverLiftTarget = 0
  if (hoverActive) {
    if (effectiveHover === 'lift')          { hoverScaleTarget = 1.015; hoverLiftTarget = 0.012 }
    else if (effectiveHover === 'highlight') { hoverScaleTarget = 1.000; hoverLiftTarget = 0.006 }
    else                                     { hoverScaleTarget = 1.008; hoverLiftTarget = 0.006 } // automatic
  }
  // Damp toward the target each frame so the hover reads as a glide,
  // not a hard snap. The animated state lives in refs (no re-renders
  // per frame) and the actual transform is applied imperatively to
  // the group's matrix below. 12% per-frame catch-up at 60fps maps to
  // ~120ms to reach 95% of the target — close to Apple's `easeOut`.
  const hoverAnimRef = useRef({ scale: 1, lift: 0 })
  useFrame(() => {
    const cur = hoverAnimRef.current
    const dScale = hoverScaleTarget - cur.scale
    const dLift  = hoverLiftTarget - cur.lift
    if (Math.abs(dScale) < 0.0002 && Math.abs(dLift) < 0.0002) return
    cur.scale += dScale * 0.12
    cur.lift  += dLift  * 0.12
    const g = groupRef.current
    if (g) {
      g.scale.x = modScaleX * cur.scale
      g.scale.y = modScaleY * cur.scale
      g.position.z = (localPosition?.[2] || 0) + cur.lift
    }
    invalidate()
  })
  const hoverScale = hoverAnimRef.current.scale
  const hoverLift = hoverAnimRef.current.lift

  const borderRing = useMemo(
    () => hasBorder ? rimRingShape(size[0], size[1], cornerRadius, ptToUnits(borderSummary.width)) : null,
    [hasBorder, size[0], size[1], cornerRadius, borderSummary?.width]
  )

  // ---- 3D primitives (RealityKit / Model3D) -------------------------
  // Render real three.js meshes so users get a 3D preview of what their
  // SwiftUI export will produce. Uses meshStandardMaterial for shading;
  // 2D panel types upstream stay on meshBasicMaterial and aren't affected.
  const is3DPrimitive = ['sphere', 'box', 'plane', 'cone', 'cylinder', 'text3d', 'mesh'].includes(panelType)
  if (is3DPrimitive) {
    const handlers = {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerOver: (e) => { e.stopPropagation(); setHovered(true); gl.domElement.style.cursor = hoverCursor },
      onPointerOut: () => { setHovered(false); if (!dragData.current?.dragging) gl.domElement.style.cursor = 'auto' }
    }
    // Z offset (`.offset(z:)`) + per-axis rotation (`.rotation3DEffect(...)`)
    // — both surfaced in the inspector's Transform section. Applied here
    // so the canvas preview matches what SwiftUI will render on device.
    const zOff = ptToUnits(panel.zOffset || 0)
    const rotX = (panel.rotX || 0) * DEG2RAD
    const rotY = (panel.rotY || 0) * DEG2RAD
    const rotZ = (panel.rotZ || 0) * DEG2RAD
    const groupPos = [
      (localPosition?.[0] || 0) + modOffX,
      (localPosition?.[1] || 0) + modOffY,
      (localPosition?.[2] || 0) + zOff
    ]
    const groupRot = [rotX, rotY, rotZ]
    let geometryNode = null
    let halo = null
    if (panelType === 'sphere') {
      const r = ptToUnits(panel.radius || 80)
      geometryNode = <sphereGeometry args={[r, 32, 32]} />
      halo = isSelected && (
        <mesh>
          <sphereGeometry args={[r * 1.04, 32, 32]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.18} wireframe />
        </mesh>
      )
    } else if (panelType === 'box') {
      const w = ptToUnits(panel.boxWidth  || 120)
      const h = ptToUnits(panel.boxHeight || 120)
      const d = ptToUnits(panel.boxDepth  || 120)
      geometryNode = <boxGeometry args={[w, h, d]} />
      halo = isSelected && (
        <mesh>
          <boxGeometry args={[w * 1.04, h * 1.04, d * 1.04]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.18} wireframe />
        </mesh>
      )
    } else if (panelType === 'plane') {
      const w = ptToUnits(panel.planeWidth || 200)
      const d = ptToUnits(panel.planeDepth || 140)
      geometryNode = <planeGeometry args={[w, d]} />
      halo = isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w * 1.04, d * 1.04]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.25} wireframe side={THREE.DoubleSide} />
        </mesh>
      )
    } else if (panelType === 'cone') {
      const r = ptToUnits(panel.coneRadius || 70)
      const h = ptToUnits(panel.coneHeight || 180)
      geometryNode = <coneGeometry args={[r, h, 32]} />
      halo = isSelected && (
        <mesh>
          <coneGeometry args={[r * 1.04, h * 1.04, 32]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.18} wireframe />
        </mesh>
      )
    } else if (panelType === 'cylinder') {
      const r = ptToUnits(panel.cylRadius || 70)
      const h = ptToUnits(panel.cylHeight || 180)
      geometryNode = <cylinderGeometry args={[r, r, h, 32]} />
      halo = isSelected && (
        <mesh>
          <cylinderGeometry args={[r * 1.04, r * 1.04, h * 1.04, 32]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.18} wireframe />
        </mesh>
      )
    } else if (panelType === 'text3d') {
      // Approximate Text3D with troika Text plus a back-shadow copy to
      // suggest extrusion. SwiftUI's Text3D handles the real geometry on
      // device — the export emits Text3D with the user's extrusionDepth.
      const fontSize = ptToUnits(TEXT_STYLES[panel.textStyle]?.pt ?? 34)
      const ed = ptToUnits(panel.extrusionDepth || 20) * 0.3
      return (
        <group ref={groupRef} position={groupPos} rotation={groupRot}>
          {isSelected && (
            <mesh position={[0, -ptToUnits(20), -0.001]}>
              <planeGeometry args={[ptToUnits(120), ptToUnits(2)]} />
              <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.6} />
            </mesh>
          )}
          <Text
            position={[ed * 0.4, -ed * 0.4, -ed]}
            fontSize={fontSize}
            color="#000000"
            anchorX="center" anchorY="middle"
            font={fontUrl}
          >
            {panel.text || 'Hello'}
          </Text>
          <Text
            position={[0, 0, 0]}
            fontSize={fontSize}
            color={fillColor}
            anchorX="center" anchorY="middle"
            font={fontUrl}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerOver={handlers.onPointerOver}
            onPointerOut={handlers.onPointerOut}
          >
            {panel.text || 'Hello'}
          </Text>
        </group>
      )
    } else if (panelType === 'mesh') {
      // Custom-mesh placeholder: a wireframe box with the asset name above.
      const w = ptToUnits(150), h = ptToUnits(150), d = ptToUnits(150)
      return (
        <group ref={groupRef} position={groupPos} rotation={groupRot}>
          {isSelected && (
            <mesh>
              <boxGeometry args={[w * 1.04, h * 1.04, d * 1.04]} />
              <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.18} wireframe />
            </mesh>
          )}
          <mesh {...handlers}>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial color={fillColor} metalness={0.1} roughness={0.6} wireframe />
          </mesh>
          <Text
            position={[0, h * 0.7, 0]}
            fontSize={ptToUnits(14)}
            color={resolveSemantic('secondary', scene)}
            anchorX="center" anchorY="middle"
            font={fontUrl}
          >
            {panel.meshAsset || 'Asset'}
          </Text>
        </group>
      )
    }

    return (
      <group ref={groupRef} position={groupPos} rotation={groupRot}>
        {halo}
        <mesh {...handlers}>
          {geometryNode}
          <meshStandardMaterial color={fillColor} metalness={0.1} roughness={0.55} />
        </mesh>
      </group>
    )
  }

  return (
    <group
      ref={groupRef}
      position={[
        (localPosition?.[0] || 0) + modOffX,
        (localPosition?.[1] || 0) + modOffY,
        // `.zIndex` lifts the view toward the viewer. A millimetre per unit
        // is enough to win the depth test against siblings without reading
        // as a physical offset, and `renderOrder` settles the transparent
        // meshes that three sorts by distance rather than by depth buffer.
        (localPosition?.[2] || 0) + hoverLift + (hasZIndex ? modZIndex * 0.001 : 0)
      ]}
      renderOrder={hasZIndex ? modZIndex : undefined}
      scale={[modScaleX * hoverScale, modScaleY * hoverScale, 1]}
      rotation={[0, 0, modRot]}
    >
      {/* Hover effect: highlight overlay — additive scene-tint wash on the
          fill shape. Rendered just above the fill so the underlying color
          shows through. Only meaningful for panels that actually have a
          fill bounds; pure-text panels still get scale + lift. */}
      {hoverActive && effectiveHover === 'highlight' && hasFill && (
        <mesh position={[0, 0, 0.0015]}>
          <shapeGeometry args={[fillShape]} />
          <meshBasicMaterial color={'#ffffff'} transparent opacity={0.06} />
        </mesh>
      )}
      {/* Lift effect: a soft contact shadow under the panel — kept
          gentle so the hover reads as a glide, not a slam. */}
      {hoverActive && effectiveHover === 'lift' && hasFill && (
        <mesh position={[0, -0.004, -0.012]}>
          <shapeGeometry args={[fillShape]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.12} />
        </mesh>
      )}
      {/* Modifier: .glassBackgroundEffect — the app's signature material,
          inert as a modifier until phase 1.1. Sits behind `.background` the
          way SwiftUI stacks them, and behind the view's own fill. */}
      {modGlass && (
        <mesh position={[0, 0, -0.0016]}>
          <shapeGeometry args={[paintShape]} />
          <meshBasicMaterial
            color={modGlass.color}
            transparent
            opacity={(modGlass.opacity ?? 0.5) * modOpacity}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {/* Modifier: .background — the most reached-for modifier in the list,
          and it drew nothing. Painted behind the view's own fill, clipped to
          `.clipShape` when one is set. */}
      {modBackground && (
        <mesh position={[0, 0, -0.0008]}>
          <shapeGeometry args={[paintShape]} />
          <meshBasicMaterial
            color={modBackground.color}
            transparent
            opacity={modBackground.opacity * modOpacity}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {/* Modifier: shadow — rect shadow only for panels with a visible fill.
          Pure Text / Link get their shadow rendered as a duplicate Text copy
          below. */}
      {hasShadow && panelType !== 'text' && panelType !== 'link' && (
        <mesh position={[ptToUnits(shadowSummary.x || 0), -ptToUnits(shadowSummary.y || 0), -0.01]}>
          <shapeGeometry args={[fillShape]} />
          <meshBasicMaterial color={shadowSummary.color} transparent opacity={0.35} />
        </mesh>
      )}

      {/* Editor-only selection halo. Doubled the previewMode guard so a
          stale `isSelected` (e.g. HMR scenarios where this Panel re-uses
          a memoised value across a preview toggle) cannot paint the
          ring while the wearer is in preview. */}
      {!scene.previewMode && isSelected && !isEditing && panelType !== 'text' && panelType !== 'link' && panelType !== 'label' && (
        <mesh position={[0, 0, -0.002]}>
          <shapeGeometry args={[outlineShape]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.28} />
        </mesh>
      )}
      {/* Text/Link/Label selection: subtle underline instead of bounding box */}
      {!scene.previewMode && isSelected && !isEditing && (panelType === 'text' || panelType === 'link' || panelType === 'label') && (
        <mesh position={[0, -size[1] / 2 - ptToUnits(2), -0.001]}>
          <planeGeometry args={[size[0], ptToUnits(2)]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.6} />
        </mesh>
      )}

      {hasFill ? (
        <>
          {/* Rectangle stroke — drawn behind the fill so its edge shows
              evenly around the rim. The shape is enlarged by strokeWidth
              on each side; we use Math.min so the stroke ring never
              exceeds the visible bound the user gave it. */}
          {panelType === 'rectangle' && hasStroke && rectStrokeShape && (
            <mesh position={[0, 0, -0.0005]}>
              <shapeGeometry args={[rectStrokeShape]} />
              <meshBasicMaterial color={strokeColor} transparent opacity={modOpacity} side={THREE.DoubleSide} />
            </mesh>
          )}
          <mesh
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDoubleClick={onDoubleClick}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); gl.domElement.style.cursor = hoverCursor }}
            onPointerOut={() => { setHovered(false); if (!dragData.current?.dragging) gl.domElement.style.cursor = 'auto' }}
          >
            <shapeGeometry args={[fillShape]} />
            <meshBasicMaterial
              color={resolvedFill}
              transparent
              opacity={resolvedFillOpacity * modOpacity}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      ) : (
        <mesh
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={onDoubleClick}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); gl.domElement.style.cursor = scene.previewMode ? hoverCursor : ((canDrag || canReorder) ? 'grab' : 'text') }}
          onPointerOut={() => { setHovered(false); if (!dragData.current?.dragging) gl.domElement.style.cursor = 'auto' }}
        >
          <planeGeometry args={[size[0], size[1]]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Image — texture if uploaded, placeholder cross if not */}
      {panelType === 'image' && !panel.imageUrl && (
        <>
          <mesh position={[0, 0, 0.001]}>
            <planeGeometry args={[size[0] - 0.02, 0.004]} />
            <meshBasicMaterial color={resolveSemantic('tertiary', scene)} />
          </mesh>
          <mesh position={[0, 0, 0.001]} rotation={[0, 0, Math.PI / 2]}>
            <planeGeometry args={[size[1] - 0.02, 0.004]} />
            <meshBasicMaterial color={resolveSemantic('tertiary', scene)} />
          </mesh>
        </>
      )}
      {(panelType === 'image' || panelType === 'asyncimage') && panel.imageUrl && (
        <ImageTextureMesh
          url={panel.imageUrl}
          size={size}
          cornerRadius={cornerRadius}
          imageFit={panel.imageFit || 'fill'}
        />
      )}

      {showDefaultLabel && (() => {
        const textY = (panelType === 'slideshow' ? size[1] * 0.05 : 0) + baselineOffsetY
        const rawText = applyCase(panel.text || (panelType === 'image' ? 'Image' : panelType === 'slideshow' ? 'Slideshow' : ''))
        // Run the full SwiftUI Text pipeline (tighten → scale → wrap →
        // truncate) on the resolved frame so the canvas reads exactly
        // like the device would. Modifier-derived values (lineLimit,
        // truncationMode, minimumScaleFactor, allowsTightening,
        // fixedSize, padding) all flow through `modSummary`.
        const measuredPad = modSummary.padding
        const innerPadX = measuredPad
          ? ptToUnits((measuredPad.left || 0) + (measuredPad.right  || 0))
          : 0
        const wrapBound = panelType === 'button'
          ? Number.POSITIVE_INFINITY
          : Math.max(0.0001, size[0] - textInset * 2 - innerPadX)
        const swiftMeasure = (panelType === 'text' || panelType === 'link' || panelType === 'label')
          ? measureSwiftUIText(rawText, finalFontSize, wrapBound, {
              // .tracking and .kerning both add to inter-character space
              // in SwiftUI; sum them so wrap measurement and rendering
              // agree on the glyph advance.
              trackingPt:    (modSummary.tracking || 0) + (modSummary.kerning || 0),
              lineSpacingPt: modSummary.lineSpacing || 0,
              lineLimit:     modSummary.lineLimit ?? null,
              truncationMode: modSummary.truncationMode || 'tail',
              minimumScaleFactor: modSummary.minimumScaleFactor ?? 1,
              allowsTightening:   !!modSummary.allowsTightening,
              fixedSizeH:         !!modSummary.fixedSizeH,
              fixedSizeV:         !!modSummary.fixedSizeV,
              fontWeight: panel.fontWeight
                || (panel.textStyle ? textStyleDefaultWeight(panel.textStyle) : 'regular')
            })
          : null
        // Join the post-pipeline lines back with '\n' so drei's <Text>
        // renders them as separate visual lines without re-wrapping
        // (the maxWidth bound stays in place to catch any rounding).
        const rendered = swiftMeasure ? swiftMeasure.lines.join('\n') : rawText
        const renderedFontSize = swiftMeasure ? swiftMeasure.fontSize : finalFontSize
        // .multilineTextAlignment beats .textAlign for wrapped text —
        // SwiftUI separates "which side glyphs anchor to" (textAlign,
        // .leading/.trailing on a hard-line view) from "which side
        // wrapped lines align to inside the frame" (multilineTextAlignment).
        const multilineAlign = modSummary.multilineTextAlignment
        const effectiveAlign = (panelType === 'button')
          ? 'center'
          : (multilineAlign === 'leading'  ? 'left'
            : multilineAlign === 'trailing' ? 'right'
            : multilineAlign === 'center'   ? 'center'
            : (panel.textAlign || 'center'))
        // For text/link, shadow is drawn as a second Text copy behind the main
        // one — a flat rectangle shadow looks wrong behind transparent glyphs.
        const textShadow = hasShadow && (panelType === 'text' || panelType === 'link') && (
          <Text
            position={[textX + ptToUnits(shadowSummary.x || 0), textY - ptToUnits(shadowSummary.y || 0), 0.004]}
            font={fontUrl}
            fontSize={renderedFontSize}
            color={shadowSummary.color}
            fillOpacity={0.35 * modOpacity}
            anchorX={anchorX}
            anchorY="middle"
            maxWidth={size[0] - textInset * 2 - innerPadX}
            textAlign={effectiveAlign}
            letterSpacing={letterSpacing * (swiftMeasure?.tightenFactor ?? 1)}
            lineHeight={lineHeight}
            overflowWrap="break-word"
          >
            {rendered}
          </Text>
        )
        return (
          <>
            {textShadow}
            <Text
              position={[textX, textY, 0.005]}
              font={fontUrl}
              fontSize={renderedFontSize}
              color={resolvedTextColor}
              fillOpacity={modOpacity}
              anchorX={anchorX}
              anchorY="middle"
              maxWidth={panelType === 'button' ? undefined : Math.max(0.0001, size[0] - textInset * 2 - innerPadX)}
              textAlign={effectiveAlign}
              letterSpacing={letterSpacing * (swiftMeasure?.tightenFactor ?? 1)}
              lineHeight={lineHeight}
              overflowWrap="break-word"
              whiteSpace={panelType === 'button' ? 'nowrap' : undefined}
            >
              {rendered}
            </Text>
            {/* .underline / .strikethrough: thin mesh lines under/through the
                text. Width tracks the glyph run (not the whole frame) so a
                left-aligned Text in a wide `fill` frame gets an underline that
                ends where the text ends. The mesh is offset so it stays flush
                with the text's anchor edge. */}
            {(modSummary.underline || modSummary.strikethrough) && (() => {
              const glyphW = Math.min(
                size[0],
                (rendered.length || 1) * (finalFontSize * 0.55 + letterSpacing)
              )
              // planeGeometry is centre-anchored — shift by ±glyphW/2 so the
              // line's edge matches the text's anchor (left/right/center).
              const lineX = panel.textAlign === 'left'
                ? textX + glyphW / 2
                : panel.textAlign === 'right'
                  ? textX - glyphW / 2
                  : textX
              return (
                <>
                  {modSummary.underline && (
                    <mesh position={[lineX, textY - finalFontSize * 0.55, 0.004]}>
                      <planeGeometry args={[glyphW, ptToUnits(1)]} />
                      <meshBasicMaterial color={resolvedTextColor} transparent opacity={modOpacity} />
                    </mesh>
                  )}
                  {modSummary.strikethrough && (
                    <mesh position={[lineX, textY + finalFontSize * 0.05, 0.004]}>
                      <planeGeometry args={[glyphW, ptToUnits(1)]} />
                      <meshBasicMaterial color={resolvedTextColor} transparent opacity={modOpacity} />
                    </mesh>
                  )}
                </>
              )
            })()}
          </>
        )
      })()}

      {/* Button leading icon — renders the SF Symbol (rasterized from
          Lucide) on the leading edge of the button label, matching
          SwiftUI's `Button { Label("Title", systemImage: "…") }`
          layout. Weight follows the button label's `fontWeight`. */}
      {panelType === 'button' && panel.symbolName && (() => {
        const padX = ptToUnits(12)
        const iconR = ptToUnits(14)
        return (
          <SymbolIcon3D
            name={panel.symbolName}
            sizeUnits={iconR * 2}
            color={resolvedTextColor}
            weight={panel.fontWeight || 'medium'}
            imageScale={panel.imageScale || 'medium'}
            variant={panel.symbolVariant || null}
            renderingMode={panel.symbolRenderingMode || 'monochrome'}
            position={[-size[0] / 2 + padX + iconR, 0, 0.005]}
            opacity={modOpacity}
          />
        )
      })()}

      {/* Ticker — scrolls the text horizontally */}
      {panelType === 'ticker' && (
        <group ref={tickerRef} position={[size[0] * 0.5, 0, 0.005]}>
          <Text
            font={fontUrl}
            fontSize={finalFontSize}
            color={resolvedTextColor}
            anchorX="left"
            anchorY="middle"
          >
            {panel.text || ''}
          </Text>
        </group>
      )}

      {/* Phase 3 overlays */}
      {labelOverlay}
      {textfieldOverlay}
      {texteditorOverlay}
      {pickerOverlay}
      {datepickerOverlay}
      {colorpickerOverlay}
      {linkOverlay}
      {asyncimageOverlay}
      {contentUnavailableOverlay}
      {/* Phase 4 */}
      {groupboxOverlay}
      {/* Phase 5 shapes */}
      {ellipseMesh && panelType === 'ellipse' && (
        <>
          {hasStroke && ellipseStrokeShape && (
            <mesh position={[0, 0, -0.0005]}>
              <shapeGeometry args={[ellipseStrokeShape]} />
              <meshBasicMaterial color={strokeColor} transparent opacity={modOpacity} side={THREE.DoubleSide} />
            </mesh>
          )}
          <mesh onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
            onPointerOut={() => { setHovered(false) }}>
            <shapeGeometry args={[ellipseMesh]} />
            <meshBasicMaterial color={fillColor} transparent opacity={modOpacity * 0.98} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
      {unevenShape && panelType === 'unevenRoundedRect' && (
        <>
          {hasStroke && unevenStrokeShape && (
            <mesh position={[0, 0, -0.0005]}>
              <shapeGeometry args={[unevenStrokeShape]} />
              <meshBasicMaterial color={strokeColor} transparent opacity={modOpacity} side={THREE.DoubleSide} />
            </mesh>
          )}
          <mesh onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
            onPointerOut={() => { setHovered(false) }}>
            <shapeGeometry args={[unevenShape]} />
            <meshBasicMaterial color={fillColor} transparent opacity={modOpacity * 0.98} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
      {panelType === 'path' && (
        <Text position={[0, 0, 0.005]} fontSize={ptToUnits(13)} color={resolveSemantic('secondary', scene)} anchorX="center" anchorY="middle">Custom Path</Text>
      )}
      {/* Gradient overlays — a CanvasTexture is painted with the
          SwiftUI gradient and sampled across the panel's frame. The
          texture is regenerated whenever the colors / angle change. */}
      {gradientKind && gradientGeometry && gradientTexture && (
        <mesh
          geometry={gradientGeometry}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); gl.domElement.style.cursor = hoverCursor }}
          onPointerOut={() => { setHovered(false); if (!dragData.current?.dragging) gl.domElement.style.cursor = 'auto' }}
        >
          <meshBasicMaterial map={gradientTexture} transparent opacity={modOpacity} side={THREE.DoubleSide} />
        </mesh>
      )}

      {dividerOverlay}
      {circleOverlay}
      {panelType === 'capsule' && capsuleShape && !circleOverlay && (
        <>
          {hasStroke && capsuleStrokeShape && (
            <mesh position={[0, 0, -0.0005]}>
              <shapeGeometry args={[capsuleStrokeShape]} />
              <meshBasicMaterial color={strokeColor} transparent opacity={modOpacity} side={THREE.DoubleSide} />
            </mesh>
          )}
          <mesh
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); gl.domElement.style.cursor = hoverCursor }}
            onPointerOut={() => { setHovered(false); if (!dragData.current?.dragging) gl.domElement.style.cursor = 'auto' }}
          >
            <shapeGeometry args={[capsuleShape]} />
            <meshBasicMaterial color={fillColor} transparent opacity={0.98} side={THREE.DoubleSide} />
          </mesh>
        </>
      )}
      {alertOverlay}
      {segmentOverlay}
      {toggleOverlay}
      {slideshowOverlay}
      {searchOverlay}
      {navbarOverlay}
      {listOverlay}
      {tableOverlay}
      {formOverlay}
      {outlineOverlay}
      {menuOverlay}
      {progressOverlay}
      {sliderOverlay}
      {stepperOverlay}
      {gaugeOverlay}

      {/* Modifier: border ring */}
      {hasBorder && borderRing && (
        <mesh position={[0, 0, 0.008]}>
          <shapeGeometry args={[borderRing]} />
          <meshBasicMaterial color={borderSummary.color} />
        </mesh>
      )}

      {/* Modifier: disabled overlay */}
      {modSummary.disabled && (
        <mesh position={[0, 0, 0.009]}>
          <shapeGeometry args={[fillShape]} />
          <meshBasicMaterial color="#888888" transparent opacity={0.5} />
        </mesh>
      )}

      {isEditing && (panelType === 'textfield' || panelType === 'securefield' || panelType === 'search') && (() => {
        // Live input overlay for the three field kinds. The HTML <input>
        // sits flush over the 3D field plate (so the visionOS glass shows
        // through) and writes back to the matching panel value:
        //   textfield   → textfieldValue
        //   securefield → securefieldValue   (masked as the user types)
        //   search      → searchValue
        // Submit (Enter / blur) commits the value and unfocuses. Escape
        // restores the previous value and unfocuses.
        const valueField = panelType === 'textfield'   ? 'textfieldValue'
                         : panelType === 'securefield' ? 'securefieldValue'
                         :                              'searchValue'
        const currentValue = panel[valueField] || ''
        const inputType = panelType === 'securefield' ? 'password' : 'text'
        const px = (u) => `${u * 1360}px` // units → pt → CSS px is 1:1 in our scene
        // Reserve space for the search field's leading icon (28pt of
        // padding) so the typed text doesn't overlap the magnifier.
        const padL = panelType === 'search' ? 36 : 14
        const padR = panelType === 'search' ? 36 : 14
        return (
          <Html
            position={[0, 0, 0.02]}
            // `transform` mode aligns the HTML element with the 3D
            // canvas's perspective so the input lines up at any camera
            // angle. `distanceFactor` keeps the text crisp at depth.
            transform
            distanceFactor={1}
            center
            style={{ pointerEvents: 'auto' }}
            zIndexRange={[100, 0]}
          >
            <input
              type={inputType}
              autoFocus
              defaultValue={currentValue}
              placeholder={panel.text || ''}
              onChange={(e) => updateItem(id, { [valueField]: e.target.value })}
              onBlur={() => clearEditing()}
              onKeyDown={(e) => {
                if (e.key === 'Enter')  { e.target.blur() }
                else if (e.key === 'Escape') {
                  updateItem(id, { [valueField]: currentValue })
                  e.target.blur()
                }
                e.stopPropagation()
              }}
              style={{
                font: '500 17px Inter, sans-serif',
                width:  px(size[0]),
                height: px(size[1]),
                paddingLeft:  `${padL}px`,
                paddingRight: `${padR}px`,
                color: '#000000',
                background: 'rgba(255,255,255,0.92)',
                border: `1.5px solid ${scene.tintColor || '#007aff'}`,
                borderRadius: `${(cornerRadius * 1360) || 12}px`,
                outline: 'none',
                boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
                boxSizing: 'border-box'
              }}
            />
          </Html>
        )
      })()}

      {isEditing && !(panelType === 'textfield' || panelType === 'securefield' || panelType === 'search') && (
        <Html
          position={[0, 0, 0.02]}
          center
          style={{ pointerEvents: 'auto' }}
          zIndexRange={[100, 0]}
        >
          <input
            type="text"
            autoFocus
            defaultValue={panel.text || ''}
            onBlur={(e) => { updateItem(id, { text: e.target.value }); clearEditing() }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { updateItem(id, { text: e.target.value }); clearEditing() }
              else if (e.key === 'Escape') clearEditing()
              e.stopPropagation()
            }}
            style={{
              font: '600 14px Inter, sans-serif',
              padding: '4px 10px',
              minWidth: 160,
              textAlign: panel.textAlign || 'center',
              color: resolvedTextColor,
              background: 'rgba(255,255,255,0.98)',
              border: `2px solid ${scene.tintColor || '#007aff'}`,
              borderRadius: 6,
              outline: 'none',
              boxShadow: '0 2px 12px rgba(0,0,0,0.25)'
            }}
          />
        </Html>
      )}

      {/* Modifier: .overlay — painted in FRONT of everything the view draws,
          which is the half of the pair `.background` does behind. Clipped to
          `.clipShape` when one is set, so the two agree about the outline. */}
      {modOverlay && (
        <mesh position={[0, 0, 0.03]}>
          <shapeGeometry args={[paintShape]} />
          <meshBasicMaterial
            color={modOverlay.color}
            transparent
            opacity={(modOverlay.opacity ?? 0.2) * modOpacity}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}
