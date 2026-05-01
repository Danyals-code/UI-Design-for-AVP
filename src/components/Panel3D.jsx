import { useRef, useState, useMemo, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Text, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { resolveHoverEffect } from '../store/helpers'
import { roundedRectShape, rimRingShape, ellipseShape, unevenRoundedRectShape } from '../shapes'
import { resolveSemantic, TEXT_STYLES, ptToUnits, SF_SYMBOLS, LIST_STYLES, computeListHeightPt } from '../appleSystem'
import { getInterFont } from '../fonts'

const DEG2RAD = Math.PI / 180

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

export default function Panel3D({ panel, localPosition, resolvedSize }) {
  const { id, panelType } = panel
  // Size resolution precedence:
  //   1. `resolvedSize` — width/height the parent stack handed us (honours
  //      `widthMode: 'fill'` expansions).
  //   2. For text/link with widthMode 'fit' and no explicit size — intrinsic.
  //   3. panel.size — explicit user-set frame.
  //   4. auto-estimate from text content (legacy fallback).
  const size = (() => {
    if (resolvedSize && Array.isArray(resolvedSize)) return resolvedSize
    const isTextLike = panelType === 'text' || panelType === 'link'
    if (isTextLike) {
      const mode = panel.widthMode || 'fit'
      if (mode === 'fixed' && Array.isArray(panel.size)) return panel.size
      // fit / fill without a parent (top-level text): intrinsic.
      const text = panel.text || ''
      const fontSize = panel.fontSize || ptToUnits(17)
      const glyphAdv = fontSize * 0.55 + ptToUnits(panel.tracking || 0)
      const w = Math.max(ptToUnits(40), text.length * glyphAdv)
      const h = fontSize * 1.5 + ptToUnits(panel.lineSpacing || 0)
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
    return [Math.max(ptToUnits(40), text.length * fontSize * 0.55), fontSize * 1.5]
  })()
  const cornerRadius = panel.cornerRadius ?? 0
  const scene = useStore((s) => s.scene)
  const selectedId = useStore((s) => s.selectedId)
  const editingId = useStore((s) => s.editingId)
  const select = useStore((s) => s.select)
  const setEditing = useStore((s) => s.setEditing)
  const clearEditing = useStore((s) => s.clearEditing)
  const updateItem = useStore((s) => s.updateItem)
  const moveItem = useStore((s) => s.moveItem)
  const items = useStore((s) => s.items)
  const setDragging = useStore((s) => s.setDragging)
  const isSelected = selectedId === id
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

  const fillColor = panel.colorToken
    ? resolveSemantic(panel.colorToken, scheme)
    : (panel.color || '#ffffff')

  const textColor = (() => {
    if (panelType === 'text') {
      return panel.colorToken
        ? resolveSemantic(panel.colorToken, scheme)
        : (panel.color || '#000000')
    }
    if (panel.textColorToken)
      return resolveSemantic(panel.textColorToken, scheme)
    return panel.textColor || '#000000'
  })()

  const fillShape = useMemo(
    () => roundedRectShape(size[0], size[1], cornerRadius),
    [size[0], size[1], cornerRadius]
  )
  const outlineShape = useMemo(() => {
    const pad = 0.02
    return roundedRectShape(size[0] + pad * 2, size[1] + pad * 2, cornerRadius + pad)
  }, [size[0], size[1], cornerRadius])

  const parent = useStore((s) => s.items.find((it) => it.id === panel.parentId))
  // A panel can be freely *positioned* only when not inside a stack (windows
  // or top-level). Inside a stack, the layout engine owns the position —
  // instead we allow drag-to-reorder: the user drags the panel up/down (or
  // left/right for HStack) and on release we swap slots via moveItem.
  const canDrag = !parent || parent.type === 'window'
  const parentStackType = parent?.type === 'stack' ? parent.stackType : null
  const reorderAxis =
    parentStackType === 'vstack' || parentStackType === 'lazyvstack' ||
    parentStackType === 'section' || parentStackType === 'disclosure' ||
    parentStackType === 'navigationStack'
      ? 'y'
      : (parentStackType === 'hstack' || parentStackType === 'lazyhstack')
        ? 'x'
        : null
  const canReorder = reorderAxis !== null

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
      gl.domElement.style.cursor = hovered ? 'grab' : 'auto'
      try { e.target.releasePointerCapture(e.pointerId) } catch {}
      invalidate()
    }
  }
  const onDoubleClick = (e) => {
    e.stopPropagation()
    if (panelType === 'text' || panelType === 'button') setEditing(id)
  }

  // Button style resolves final fill / opacity / fallback text color
  const buttonStyle = panel.buttonStyle || 'bordered'
  let resolvedFill = fillColor
  let resolvedFillOpacity = 0.98
  let resolvedTextColor = textColor
  if (panelType === 'button') {
    if (buttonStyle === 'plain') {
      resolvedFillOpacity = 0.0
      resolvedTextColor = scene.tintColor || textColor
    } else if (buttonStyle === 'borderedProminent') {
      resolvedFill = scene.tintColor || '#007aff'
      resolvedTextColor = '#ffffff'
    } else if (buttonStyle === 'destructive') {
      resolvedFill = resolveSemantic('systemRed', scheme)
      resolvedTextColor = '#ffffff'
    }
  }

  // Spacer: invisible flexible gap — render nothing
  if (panelType === 'spacer') {
    return <group position={localPosition || [0, 0, 0]} />
  }

  const isShape = ['rectangle', 'circle', 'capsule'].includes(panelType)
  const isDivider = panelType === 'divider'
  const isPresentation = ['sheet', 'popover', 'alert'].includes(panelType)
  const noFillTypes = ['text', 'divider', 'circle', 'capsule', 'ellipse', 'unevenRoundedRect', 'link', 'spacer', 'label', 'colorpicker', 'linearGradient', 'radialGradient', 'angularGradient']
  const hasFill = !noFillTypes.includes(panelType)
  const labelTypes = ['text', 'button', 'image', 'slideshow', 'sheet', 'path', 'groupbox']
  const showDefaultLabel = !isEditing && labelTypes.includes(panelType)
  const isComplex = ['list', 'table', 'menu', 'progress', 'slider', 'stepper', 'gauge', 'search'].includes(panelType)

  const baseFontSize = panel.textStyle
    ? ptToUnits(TEXT_STYLES[panel.textStyle]?.pt ?? 17)
    : (panel.fontSize || 0.15)
  const finalFontSize = baseFontSize
  // For text/link, swap to an italic font file when .italic() is on —
  // troika's `fontStyle` prop only takes effect if the font file itself
  // carries italic glyphs. For non-text panel kinds (button, picker, …)
  // italic isn't exposed in the UI so we stay on the upright face.
  const fontUrl = getInterFont(
    panel.fontWeight,
    (panelType === 'text' || panelType === 'link') && !!panel.italic
  )

  const anchorX = panel.textAlign === 'left' ? 'left'
    : panel.textAlign === 'right' ? 'right'
    : 'center'

  // For any text-rendering panel, put the text at the panel box's correct
  // edge so textAlign is visually honoured (not just anchored at the center
  // going outward). A tiny inset keeps the glyphs from kissing the border
  // on non-Text panels (button, picker etc.). Pure text/link panels have no
  // inset — the panel box already equals the text's bounds.
  const textInset = (panelType === 'text' || panelType === 'link') ? 0 : ptToUnits(4)
  const textX =
    panel.textAlign === 'left'  ? -size[0] / 2 + textInset
  : panel.textAlign === 'right' ?  size[0] / 2 - textInset
  : 0

  // Text-specific modifiers (.italic, .underline, .strikethrough, .lineLimit,
  // .lineSpacing, .tracking, .textCase). Kept on the panel itself — cleaner
  // than stuffing them inside the generic `modifiers` blob.
  const applyCase = (s) => {
    if (!s) return ''
    if (panel.textCase === 'uppercase') return s.toUpperCase()
    if (panel.textCase === 'lowercase') return s.toLowerCase()
    return s
  }
  const lineLimit = panel.lineLimit && panel.lineLimit > 0 ? panel.lineLimit : undefined
  const letterSpacing = panel.tracking ? ptToUnits(panel.tracking) : 0
  // SwiftUI .lineSpacing(pt) — the gap between baselines in addition to the
  // natural font line-height. We convert to a multiplier relative to the
  // text style's point size (troika takes `lineHeight` as a scalar).
  const lineHeight = panel.lineSpacing
    ? 1 + (panel.lineSpacing / Math.max(1, (TEXT_STYLES[panel.textStyle]?.pt ?? 17)))
    : undefined

  // ---- type-specific overlays ----

  const segments = panel.segments || []
  const selectedSeg = panel.selectedSegment ?? 0
  const segInnerW = size[0] - 0.02
  const segW = segments.length > 0 ? segInnerW / segments.length : segInnerW
  const segmentOverlay = panelType === 'segmented' && (
    <>
      {segments.map((seg, i) => {
        const x = -segInnerW / 2 + segW * (i + 0.5)
        const isSel = i === selectedSeg
        return (
          <group key={i} position={[x, 0, 0.004]}>
            {isSel && (
              <mesh>
                <shapeGeometry args={[roundedRectShape(segW - 0.02, size[1] - 0.02, ptToUnits(6))]} />
                <meshBasicMaterial color={scene.colorScheme === 'dark' ? '#3a3a3c' : '#ffffff'} />
              </mesh>
            )}
            <Text
              position={[0, 0, 0.002]}
              fontSize={ptToUnits(12)}
              color={resolveSemantic('primary', scheme)}
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
    </>
  )

  const toggleOverlay = panelType === 'toggle' && (
    <mesh position={[panel.toggleOn ? size[0] / 4 : -size[0] / 4, 0, 0.005]}>
      <circleGeometry args={[size[1] * 0.38, 32]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  )

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
  const circleRadius = Math.min(size[0], size[1]) / 2
  const circleOverlay = panelType === 'circle' && (
    <>
      <mesh
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); gl.domElement.style.cursor = (canDrag || canReorder) ? 'grab' : 'default' }}
        onPointerOut={() => { setHovered(false); if (!dragData.current?.dragging) gl.domElement.style.cursor = 'auto' }}
      >
        <circleGeometry args={[circleRadius, 64]} />
        <meshBasicMaterial color={fillColor} transparent opacity={0.98} side={THREE.DoubleSide} />
      </mesh>
      {panel.strokeColor && panel.strokeWidth > 0 && (
        <mesh position={[0, 0, -0.001]}>
          <ringGeometry args={[circleRadius - ptToUnits(panel.strokeWidth), circleRadius, 64]} />
          <meshBasicMaterial color={panel.strokeColor} />
        </mesh>
      )}
    </>
  )

  // ---- Capsule shape ----
  const capsuleRadius = Math.min(size[0], size[1]) / 2
  const capsuleShape = useMemo(
    () => panelType === 'capsule' ? roundedRectShape(size[0], size[1], capsuleRadius) : null,
    [panelType, size[0], size[1], capsuleRadius]
  )

  // ---- Alert overlay (title + message + buttons row) ----
  const alertOverlay = panelType === 'alert' && (() => {
    const primary = resolveSemantic('primary', scheme)
    const secondary = resolveSemantic('secondary', scheme)
    const msg = panel.alertMessage || ''
    const btns = panel.alertButtons || ['OK']
    const btnH = ptToUnits(36)
    const btnY = -size[1] / 2 + ptToUnits(20) + btnH / 2
    const btnW = (size[0] - ptToUnits(32)) / btns.length
    return (
      <>
        <Text position={[0, size[1] * 0.2, 0.005]} font={fontUrl} fontSize={ptToUnits(17)} color={primary} anchorX="center" anchorY="middle" maxWidth={size[0] * 0.85} textAlign="center" fontWeight="bold">
          {panel.text || 'Alert'}
        </Text>
        <Text position={[0, 0, 0.005]} font={fontUrl} fontSize={ptToUnits(13)} color={secondary} anchorX="center" anchorY="middle" maxWidth={size[0] * 0.85} textAlign="center">
          {msg}
        </Text>
        {/* Separator above buttons */}
        <mesh position={[0, btnY + btnH / 2 + ptToUnits(4), 0.003]}>
          <planeGeometry args={[size[0] * 0.92, ptToUnits(0.5)]} />
          <meshBasicMaterial color={resolveSemantic('tertiary', scheme)} />
        </mesh>
        {btns.map((label, i) => {
          const x = -size[0] / 2 + ptToUnits(16) + btnW * (i + 0.5)
          return (
            <Text key={i} position={[x, btnY, 0.005]} font={fontUrl} fontSize={ptToUnits(15)} color={i === btns.length - 1 ? (scene.tintColor || '#007aff') : primary} anchorX="center" anchorY="middle" fontWeight={i === btns.length - 1 ? 'bold' : 'regular'}>
              {label}
            </Text>
          )
        })}
      </>
    )
  })()

  // ---- Search field ----
  const searchOverlay = panelType === 'search' && (() => {
    const iconSize = ptToUnits(7)
    const iconCx = -size[0] / 2 + ptToUnits(18)
    return (
      <>
        <group position={[iconCx, 0, 0.005]}>
          <mesh>
            <ringGeometry args={[iconSize * 0.8, iconSize, 24]} />
            <meshBasicMaterial color={resolveSemantic('secondary', scheme)} />
          </mesh>
          <mesh position={[iconSize * 0.9, -iconSize * 0.9, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <planeGeometry args={[iconSize * 1.2, ptToUnits(1.5)]} />
            <meshBasicMaterial color={resolveSemantic('secondary', scheme)} />
          </mesh>
        </group>
        <Text
          position={[iconCx + ptToUnits(18), 0, 0.005]}
          fontSize={finalFontSize}
          color={resolveSemantic('secondary', scheme)}
          anchorX="left"
          anchorY="middle"
          maxWidth={size[0] - ptToUnits(50)}
        >
          {panel.text || 'Search'}
        </Text>
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
    const gap = ptToUnits(style.gap)
    const innerW = size[0] - inset * 2
    const startY = size[1] / 2 - padY
    const primary = resolveSemantic('primary', scheme)
    const secondary = resolveSemantic('secondary', scheme)
    const separator = resolveSemantic('tertiary', scheme)
    const tint = scene.tintColor || '#007aff'
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
            <meshBasicMaterial color={resolveSemantic('secondarySystemBackground', scheme)} transparent opacity={0.95} />
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
          const symbol = r.systemImage ? SF_SYMBOLS[r.systemImage] : null
          const iconTint = r.tint
            ? (r.tint.startsWith('#') ? r.tint : resolveSemantic(r.tint, scheme))
            : (scene.tintColor || '#007aff')
          const hasIcon = !!symbol
          const textStartX = -innerW / 2 + (hasIcon ? ptToUnits(42) : ptToUnits(12))
          // Optional row highlight pill (`.listRowBackground(...)` in SwiftUI).
          const hlColor = r.background
            ? (r.background.startsWith('#') ? r.background : resolveSemantic(r.background, scheme))
            : null
          const highlightShape = hlColor
            ? roundedRectShape(innerW - ptToUnits(8), rowH - ptToUnits(6), ptToUnits(10))
            : null
          return (
            <group key={i} position={[0, cy, 0]}>
              {rowCard && (
                <mesh position={[0, 0, -0.001]}>
                  <shapeGeometry args={[rowCard]} />
                  <meshBasicMaterial
                    color={resolveSemantic(
                      style.showBg ? 'tertiarySystemBackground' : 'secondarySystemBackground',
                      scheme
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
                <Text
                  position={[-innerW / 2 + ptToUnits(22), 0, 0]}
                  font={fontUrl}
                  fontSize={ptToUnits(17)}
                  color={iconTint}
                  anchorX="center"
                  anchorY="middle"
                >{symbol.glyph}</Text>
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
              {/* Trailing chevron — omitted on sidebar/carousel/elliptical where
                  rows look like cards, not navigation links. */}
              {!style.roundedRows && (
                <Text
                  position={[innerW / 2 - ptToUnits(8), 0, 0]}
                  fontSize={ptToUnits(14)}
                  color={secondary}
                  anchorX="right"
                  anchorY="middle"
                >›</Text>
              )}
              {/* Separator line (plain/inset/insetGrouped/grouped/bordered) */}
              {style.showSeparators && i < rows.length - 1 && (
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
  const tableOverlay = panelType === 'table' && (() => {
    const cols = panel.columns || []
    const rows = panel.rows || []
    const pad = ptToUnits(14)
    const innerW = size[0] - pad * 2
    const innerH = size[1] - pad * 2
    const headerH = ptToUnits(30)
    const rowH = rows.length > 0 ? (innerH - headerH) / rows.length : 0
    const colW = cols.length > 0 ? innerW / cols.length : innerW
    const primary = resolveSemantic('primary', scheme)
    const secondary = resolveSemantic('secondary', scheme)
    const sep = resolveSemantic('tertiary', scheme)
    const startX = -innerW / 2
    const startY = innerH / 2
    return (
      <group position={[0, 0, 0.005]}>
        {/* Header fill */}
        <mesh position={[0, startY - headerH / 2, -0.001]}>
          <planeGeometry args={[innerW, headerH]} />
          <meshBasicMaterial color={resolveSemantic('systemFill', scheme)} />
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
        {/* Vertical dividers */}
        {cols.slice(1).map((_, i) => (
          <mesh key={`v${i}`} position={[startX + colW * (i + 1), startY - headerH / 2 - (rows.length * rowH) / 2, 0]}>
            <planeGeometry args={[0.003, headerH + rows.length * rowH]} />
            <meshBasicMaterial color={sep} />
          </mesh>
        ))}
        {/* Data rows */}
        {rows.map((row, r) => (
          <group key={`r${r}`} position={[0, startY - headerH - rowH * (r + 0.5), 0]}>
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
  const menuOverlay = panelType === 'menu' && (() => {
    const items = panel.menuItems || []
    const pad = ptToUnits(8)
    const rowH = (size[1] - pad * 2) / Math.max(1, items.length)
    const innerW = size[0] - pad * 2
    const primary = resolveSemantic('primary', scheme)
    const sep = resolveSemantic('tertiary', scheme)
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
  const progressOverlay = panelType === 'progress' && (() => {
    const value = Math.max(0, Math.min(1, panel.value ?? 0.5))
    const fillW = size[0] * value
    return (
      <mesh position={[-size[0] / 2 + fillW / 2, 0, 0.005]}>
        <shapeGeometry args={[roundedRectShape(fillW, size[1], Math.min(cornerRadius, size[1] / 2))]} />
        <meshBasicMaterial color={scene.tintColor || '#007aff'} />
      </mesh>
    )
  })()

  // ---- Slider ----
  const sliderOverlay = panelType === 'slider' && (() => {
    const value = Math.max(0, Math.min(1, panel.sliderValue ?? 0.5))
    const trackH = ptToUnits(4)
    const thumbR = ptToUnits(13)
    const fillW = size[0] * value
    return (
      <>
        <mesh position={[0, 0, 0.003]}>
          <planeGeometry args={[size[0], trackH]} />
          <meshBasicMaterial color={resolveSemantic('tertiary', scheme)} />
        </mesh>
        <mesh position={[-size[0] / 2 + fillW / 2, 0, 0.004]}>
          <planeGeometry args={[fillW, trackH]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} />
        </mesh>
        <mesh position={[-size[0] / 2 + fillW, 0, 0.006]}>
          <circleGeometry args={[thumbR, 32]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </>
    )
  })()

  // ---- Stepper ----
  const stepperOverlay = panelType === 'stepper' && (() => {
    const primary = resolveSemantic('primary', scheme)
    const divW = 0.003
    return (
      <>
        <Text position={[-size[0] / 3, 0, 0.005]} fontSize={ptToUnits(18)} color={primary} anchorX="center" anchorY="middle">−</Text>
        <Text position={[0, 0, 0.005]} fontSize={ptToUnits(14)} color={primary} anchorX="center" anchorY="middle" fontWeight="semibold">{String(panel.stepperValue ?? 0)}</Text>
        <Text position={[size[0] / 3, 0, 0.005]} fontSize={ptToUnits(18)} color={primary} anchorX="center" anchorY="middle">+</Text>
        <mesh position={[-size[0] / 6, 0, 0.002]}>
          <planeGeometry args={[divW, size[1] * 0.6]} />
          <meshBasicMaterial color={resolveSemantic('tertiary', scheme)} />
        </mesh>
        <mesh position={[size[0] / 6, 0, 0.002]}>
          <planeGeometry args={[divW, size[1] * 0.6]} />
          <meshBasicMaterial color={resolveSemantic('tertiary', scheme)} />
        </mesh>
      </>
    )
  })()

  // ---- Gauge (linear bar with label) ----
  const gaugeOverlay = panelType === 'gauge' && (() => {
    const value = Math.max(0, Math.min(1, panel.value ?? 0.5))
    const primary = resolveSemantic('primary', scheme)
    const trackH = ptToUnits(6)
    const trackY = -size[1] * 0.25
    return (
      <>
        <mesh position={[0, trackY, 0.003]}>
          <planeGeometry args={[size[0] * 0.85, trackH]} />
          <meshBasicMaterial color={resolveSemantic('tertiary', scheme)} />
        </mesh>
        <mesh position={[-size[0] * 0.425 + size[0] * 0.85 * value / 2, trackY, 0.004]}>
          <planeGeometry args={[size[0] * 0.85 * value, trackH]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} />
        </mesh>
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
              color={active ? (scene.tintColor || '#007aff') : resolveSemantic('tertiary', scheme)}
            />
          </mesh>
        )
      })}
    </group>
  )

  // ---- Phase 3 overlays ----

  const labelOverlay = panelType === 'label' && (() => {
    const sym = panel.symbolName ? SF_SYMBOLS[panel.symbolName] : null
    const iconGlyph = sym ? sym.glyph : (panel.iconName || 'A')
    // Apple's sidebar Label pattern (Settings.app): a coloured rounded-rect
    // tile behind the glyph instead of a circle. Driven by:
    //   iconTileColor  — fill color; null ⇒ classic circle fallback
    //   iconTileRadius — pt, corner radius of the tile (default 6)
    //   iconTileSize   — pt, square side length (default 28)
    const tileColor = panel.iconTileColor
    const tileSize = ptToUnits(panel.iconTileSize ?? 28)
    const tileRadius = ptToUnits(panel.iconTileRadius ?? 6)
    const iconR = tileSize / 2
    const iconX = -size[0] / 2 + iconR + ptToUnits(4)
    const textX = -size[0] / 2 + tileSize + ptToUnits(12)
    const resolvedTile = tileColor
      ? (tileColor.startsWith('#') ? tileColor : resolveSemantic(tileColor, scheme))
      : null
    const tileShape = resolvedTile
      ? roundedRectShape(tileSize, tileSize, tileRadius)
      : null
    return (
      <>
        {tileShape ? (
          <mesh position={[iconX, 0, 0.005]}>
            <shapeGeometry args={[tileShape]} />
            <meshBasicMaterial color={resolvedTile} />
          </mesh>
        ) : (
          <mesh position={[iconX, 0, 0.005]}>
            <circleGeometry args={[iconR, 32]} />
            <meshBasicMaterial color={panel.iconColor || '#007aff'} />
          </mesh>
        )}
        <Text position={[iconX, 0, 0.006]} fontSize={ptToUnits(14)} color="#ffffff" anchorX="center" anchorY="middle">
          {iconGlyph}
        </Text>
        <Text position={[textX, 0, 0.005]} font={fontUrl} fontSize={finalFontSize} color={resolvedTextColor} anchorX="left" anchorY="middle" maxWidth={size[0] * 0.65}>
          {panel.text || 'Label'}
        </Text>
      </>
    )
  })()

  const textfieldOverlay = (panelType === 'textfield' || panelType === 'securefield') && (() => {
    const isSec = panelType === 'securefield'
    const displayText = isSec ? '\u2022'.repeat(panel.dotCount || 8) : (panel.text || 'Placeholder')
    return (
      <>
        <Text position={[-size[0] / 2 + ptToUnits(14), 0, 0.005]} font={fontUrl} fontSize={finalFontSize} color={resolvedTextColor} anchorX="left" anchorY="middle" maxWidth={size[0] * 0.85}>
          {displayText}
        </Text>
        {!isSec && <mesh position={[-size[0] / 2 + ptToUnits(14) + ptToUnits(displayText.length * 7), 0, 0.006]}>
          <planeGeometry args={[ptToUnits(1.5), size[1] * 0.55]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} />
        </mesh>}
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
            <meshBasicMaterial color={resolveSemantic('tertiary', scheme)} transparent opacity={0.5} />
          </mesh>
        ))}
      </>
    )
  })()

  const pickerOverlay = panelType === 'picker' && (() => {
    const primary = resolveSemantic('primary', scheme)
    return (
      <>
        <Text position={[-size[0] / 2 + ptToUnits(12), 0, 0.005]} font={fontUrl} fontSize={finalFontSize} color={resolvedTextColor} anchorX="left" anchorY="middle" maxWidth={size[0] * 0.45}>
          {panel.text || 'Selection'}
        </Text>
        <Text position={[size[0] / 2 - ptToUnits(24), 0, 0.005]} font={fontUrl} fontSize={ptToUnits(14)} color={primary} anchorX="right" anchorY="middle">
          {panel.pickerValue || ''}
        </Text>
        <Text position={[size[0] / 2 - ptToUnits(8), 0, 0.005]} fontSize={ptToUnits(10)} color={resolveSemantic('secondary', scheme)} anchorX="right" anchorY="middle">
          ▾
        </Text>
      </>
    )
  })()

  const datepickerOverlay = panelType === 'datepicker' && (
    <>
      <Text position={[-size[0] / 2 + ptToUnits(12), 0, 0.005]} font={fontUrl} fontSize={finalFontSize} color={resolvedTextColor} anchorX="left" anchorY="middle" maxWidth={size[0] * 0.4}>
        {panel.text || 'Date'}
      </Text>
      <Text position={[size[0] / 2 - ptToUnits(12), 0, 0.005]} font={getInterFont('medium')} fontSize={ptToUnits(14)} color={scene.tintColor || '#007aff'} anchorX="right" anchorY="middle">
        {panel.dateValue || '2026-04-16'}
      </Text>
    </>
  )

  const colorpickerOverlay = panelType === 'colorpicker' && (
    <>
      <Text position={[-size[0] / 2 + ptToUnits(4), 0, 0.005]} font={fontUrl} fontSize={finalFontSize} color={resolveSemantic('primary', scheme)} anchorX="left" anchorY="middle">
        {panel.text || 'Color'}
      </Text>
      <mesh position={[size[0] / 2 - ptToUnits(18), 0, 0.005]}>
        <circleGeometry args={[ptToUnits(11), 32]} />
        <meshBasicMaterial color={panel.pickedColor || '#ff0000'} />
      </mesh>
      <mesh position={[size[0] / 2 - ptToUnits(18), 0, 0.003]}>
        <ringGeometry args={[ptToUnits(11), ptToUnits(12.5), 32]} />
        <meshBasicMaterial color={resolveSemantic('tertiary', scheme)} />
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
        <meshBasicMaterial color={resolveSemantic('secondary', scheme)} />
      </mesh>
      <Text position={[0, -ptToUnits(28), 0.005]} fontSize={ptToUnits(11)} color={resolveSemantic('secondary', scheme)} anchorX="center" anchorY="middle">
        Loading...
      </Text>
    </>
  )

  const contentUnavailableOverlay = panelType === 'contentUnavailable' && (
    <>
      <mesh position={[0, size[1] * 0.15, 0.005]}>
        <circleGeometry args={[ptToUnits(24), 32]} />
        <meshBasicMaterial color={resolveSemantic('tertiary', scheme)} />
      </mesh>
      <Text position={[0, size[1] * 0.15, 0.006]} fontSize={ptToUnits(20)} color={resolveSemantic('secondary', scheme)} anchorX="center" anchorY="middle">
        !
      </Text>
      <Text position={[0, -size[1] * 0.05, 0.005]} font={getInterFont('semibold')} fontSize={ptToUnits(18)} color={resolveSemantic('primary', scheme)} anchorX="center" anchorY="middle" maxWidth={size[0] * 0.85}>
        {panel.text || 'No Results'}
      </Text>
      <Text position={[0, -size[1] * 0.2, 0.005]} font={fontUrl} fontSize={ptToUnits(14)} color={resolveSemantic('secondary', scheme)} anchorX="center" anchorY="middle" maxWidth={size[0] * 0.85}>
        {panel.alertMessage || ''}
      </Text>
    </>
  )

  // ---- Phase 4 overlays ----

  const groupboxOverlay = panelType === 'groupbox' && (
    <Text position={[-size[0] / 2 + ptToUnits(16), size[1] / 2 - ptToUnits(16), 0.005]} font={getInterFont('semibold')} fontSize={ptToUnits(15)} color={resolveSemantic('primary', scheme)} anchorX="left" anchorY="middle" maxWidth={size[0] * 0.85}>
      {panel.text || 'GroupBox'}
    </Text>
  )

  // ---- Phase 5 shape memos ----

  const ellipseMesh = useMemo(
    () => panelType === 'ellipse' ? ellipseShape(size[0], size[1]) : null,
    [panelType, size[0], size[1]]
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

  // ---- Modifier values ----
  const mod = panel.modifiers || {}
  const modOffX = ptToUnits(mod.offsetX || 0)
  const modOffY = ptToUnits(mod.offsetY || 0)
  const modRot = (mod.rotation || 0) * DEG2RAD
  const modScaleX = mod.scaleX ?? 1
  const modScaleY = mod.scaleY ?? 1
  const modOpacity = mod.opacity ?? 1
  const hasShadow = mod.shadowColor && mod.shadowRadius > 0
  const hasBorder = mod.borderColor && mod.borderWidth > 0

  // ---- Hover effect (visionOS .hoverEffect) ----
  // Resolved per-panel (own > inherit-from-window > automatic). When the
  // panel is being dragged we suppress hover so the lift doesn't fight the
  // drag offset. The 'highlight' effect renders an additive tint overlay
  // (rendered below); 'lift' and 'automatic' just nudge scale + Z.
  const effectiveHover = resolveHoverEffect(panel, items)
  const hoverActive = hovered && !dragData.current?.dragging && effectiveHover !== 'none'
  let hoverScale = 1, hoverLift = 0
  if (hoverActive) {
    if (effectiveHover === 'lift')         { hoverScale = 1.05; hoverLift = 0.06 }
    else if (effectiveHover === 'highlight'){ hoverScale = 1.00; hoverLift = 0.02 }
    else                                    { hoverScale = 1.02; hoverLift = 0.02 } // automatic
  }

  const borderRing = useMemo(
    () => hasBorder ? rimRingShape(size[0], size[1], cornerRadius, ptToUnits(mod.borderWidth)) : null,
    [hasBorder, size[0], size[1], cornerRadius, mod.borderWidth]
  )

  return (
    <group
      ref={groupRef}
      position={[
        (localPosition?.[0] || 0) + modOffX,
        (localPosition?.[1] || 0) + modOffY,
        (localPosition?.[2] || 0) + hoverLift
      ]}
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
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.18} />
        </mesh>
      )}
      {/* Lift effect: drop a soft shadow under the panel so the lift reads
          as 3D, not just a scale. */}
      {hoverActive && effectiveHover === 'lift' && hasFill && (
        <mesh position={[0, -0.015, -0.012]}>
          <shapeGeometry args={[fillShape]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.22} />
        </mesh>
      )}
      {/* Modifier: shadow — rect shadow only for panels with a visible fill.
          Pure Text / Link get their shadow rendered as a duplicate Text copy
          below. */}
      {hasShadow && panelType !== 'text' && panelType !== 'link' && (
        <mesh position={[ptToUnits(mod.shadowX || 0), -ptToUnits(mod.shadowY || 0), -0.01]}>
          <shapeGeometry args={[fillShape]} />
          <meshBasicMaterial color={mod.shadowColor} transparent opacity={0.35} />
        </mesh>
      )}

      {isSelected && !isEditing && panelType !== 'text' && panelType !== 'link' && panelType !== 'label' && (
        <mesh position={[0, 0, -0.002]}>
          <shapeGeometry args={[outlineShape]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.45} />
        </mesh>
      )}
      {/* Text/Link/Label selection: subtle underline instead of bounding box */}
      {isSelected && !isEditing && (panelType === 'text' || panelType === 'link' || panelType === 'label') && (
        <mesh position={[0, -size[1] / 2 - ptToUnits(2), -0.001]}>
          <planeGeometry args={[size[0], ptToUnits(2)]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.6} />
        </mesh>
      )}

      {hasFill ? (
        <mesh
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={onDoubleClick}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); gl.domElement.style.cursor = (canDrag || canReorder) ? 'grab' : 'default' }}
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
      ) : (
        <mesh
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={onDoubleClick}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); gl.domElement.style.cursor = (canDrag || canReorder) ? 'grab' : 'text' }}
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
            <meshBasicMaterial color={resolveSemantic('tertiary', scheme)} />
          </mesh>
          <mesh position={[0, 0, 0.001]} rotation={[0, 0, Math.PI / 2]}>
            <planeGeometry args={[size[1] - 0.02, 0.004]} />
            <meshBasicMaterial color={resolveSemantic('tertiary', scheme)} />
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
        const textY = panelType === 'slideshow' ? size[1] * 0.05 : 0
        const rendered = applyCase(panel.text || (panelType === 'image' ? 'Image' : panelType === 'slideshow' ? 'Slideshow' : ''))
        // For text/link, shadow is drawn as a second Text copy behind the main
        // one — a flat rectangle shadow looks wrong behind transparent glyphs.
        const textShadow = hasShadow && (panelType === 'text' || panelType === 'link') && (
          <Text
            position={[textX + ptToUnits(mod.shadowX || 0), textY - ptToUnits(mod.shadowY || 0), 0.004]}
            font={fontUrl}
            fontSize={finalFontSize}
            color={mod.shadowColor}
            fillOpacity={0.35 * modOpacity}
            anchorX={anchorX}
            anchorY="middle"
            maxWidth={size[0]}
            textAlign={panel.textAlign || 'center'}
            letterSpacing={letterSpacing}
            lineHeight={lineHeight}
            maxLines={lineLimit}
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
              fontSize={finalFontSize}
              color={resolvedTextColor}
              fillOpacity={modOpacity}
              anchorX={anchorX}
              anchorY="middle"
              maxWidth={size[0]}
              textAlign={panel.textAlign || 'center'}
              letterSpacing={letterSpacing}
              lineHeight={lineHeight}
              maxLines={lineLimit}
              overflowWrap="break-word"
            >
              {rendered}
            </Text>
            {/* .underline / .strikethrough: thin mesh lines under/through the
                text. Width tracks the glyph run (not the whole frame) so a
                left-aligned Text in a wide `fill` frame gets an underline that
                ends where the text ends. The mesh is offset so it stays flush
                with the text's anchor edge. */}
            {(panel.underline || panel.strikethrough) && (() => {
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
                  {panel.underline && (
                    <mesh position={[lineX, textY - finalFontSize * 0.55, 0.004]}>
                      <planeGeometry args={[glyphW, ptToUnits(1)]} />
                      <meshBasicMaterial color={resolvedTextColor} transparent opacity={modOpacity} />
                    </mesh>
                  )}
                  {panel.strikethrough && (
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

      {/* Button leading icon — renders an SF Symbol glyph on the left edge
          of the button label, matching SwiftUI's
          `Button { Label("Title", systemImage: "…") }` layout. */}
      {panelType === 'button' && panel.symbolName && SF_SYMBOLS[panel.symbolName] && (() => {
        const glyph = SF_SYMBOLS[panel.symbolName].glyph
        const padX = ptToUnits(12)
        // Icon pinned to leading edge; text stays centered in the button so
        // the combination reads as "icon-leading, title-centered" (Apple's
        // default for bordered buttons).
        return (
          <Text
            position={[-size[0] / 2 + padX, 0, 0.005]}
            font={fontUrl}
            fontSize={finalFontSize * 1.1}
            color={resolvedTextColor}
            fillOpacity={modOpacity}
            anchorX="left"
            anchorY="middle"
          >
            {glyph}
          </Text>
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
        <mesh onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
          onPointerOut={() => { setHovered(false) }}>
          <shapeGeometry args={[ellipseMesh]} />
          <meshBasicMaterial color={fillColor} transparent opacity={modOpacity * 0.98} side={THREE.DoubleSide} />
        </mesh>
      )}
      {unevenShape && panelType === 'unevenRoundedRect' && (
        <mesh onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
          onPointerOut={() => { setHovered(false) }}>
          <shapeGeometry args={[unevenShape]} />
          <meshBasicMaterial color={fillColor} transparent opacity={modOpacity * 0.98} side={THREE.DoubleSide} />
        </mesh>
      )}
      {panelType === 'path' && (
        <Text position={[0, 0, 0.005]} fontSize={ptToUnits(13)} color={resolveSemantic('secondary', scheme)} anchorX="center" anchorY="middle">Custom Path</Text>
      )}
      {/* Gradient overlays */}
      {panelType === 'linearGradient' && panel.gradientFrom && panel.gradientTo && (() => {
        const c1 = new THREE.Color(panel.gradientFrom)
        const c2 = new THREE.Color(panel.gradientTo)
        return (
          <mesh>
            <planeGeometry args={[size[0], size[1], 1, 16]} />
            <meshBasicMaterial vertexColors transparent opacity={modOpacity}>
              {/* vertex colors are set via onUpdate */}
            </meshBasicMaterial>
          </mesh>
        )
      })()}
      {(panelType === 'radialGradient' || panelType === 'angularGradient') && (
        <mesh>
          <circleGeometry args={[Math.min(size[0], size[1]) / 2, 64]} />
          <meshBasicMaterial color={panel.gradientFrom || fillColor} transparent opacity={modOpacity * 0.98} />
        </mesh>
      )}

      {dividerOverlay}
      {circleOverlay}
      {panelType === 'capsule' && capsuleShape && !circleOverlay && (
        <mesh
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); gl.domElement.style.cursor = (canDrag || canReorder) ? 'grab' : 'default' }}
          onPointerOut={() => { setHovered(false); if (!dragData.current?.dragging) gl.domElement.style.cursor = 'auto' }}
        >
          <shapeGeometry args={[capsuleShape]} />
          <meshBasicMaterial color={fillColor} transparent opacity={0.98} side={THREE.DoubleSide} />
        </mesh>
      )}
      {alertOverlay}
      {segmentOverlay}
      {toggleOverlay}
      {slideshowOverlay}
      {searchOverlay}
      {listOverlay}
      {tableOverlay}
      {menuOverlay}
      {progressOverlay}
      {sliderOverlay}
      {stepperOverlay}
      {gaugeOverlay}

      {/* Modifier: border ring */}
      {hasBorder && borderRing && (
        <mesh position={[0, 0, 0.008]}>
          <shapeGeometry args={[borderRing]} />
          <meshBasicMaterial color={mod.borderColor} />
        </mesh>
      )}

      {/* Modifier: disabled overlay */}
      {mod.disabled && (
        <mesh position={[0, 0, 0.009]}>
          <shapeGeometry args={[fillShape]} />
          <meshBasicMaterial color="#888888" transparent opacity={0.5} />
        </mesh>
      )}

      {isEditing && (
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
    </group>
  )
}
