import { useRef, useState, useMemo, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Text, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { roundedRectShape, rimRingShape, ellipseShape, unevenRoundedRectShape } from '../shapes'
import { resolveSemantic, TEXT_STYLES, ptToUnits, SF_SYMBOLS } from '../appleSystem'
import { getInterFont } from '../fonts'

const DEG2RAD = Math.PI / 180

// Loads an image URL as a THREE.Texture and renders it on a plane.
function ImageTextureMesh({ url, size, cornerRadius }) {
  const [texture, setTexture] = useState(null)
  useEffect(() => {
    if (!url) { setTexture(null); return }
    const loader = new THREE.TextureLoader()
    loader.load(
      url,
      (tex) => { tex.colorSpace = THREE.SRGBColorSpace; setTexture(tex) },
      undefined,
      () => setTexture(null)
    )
    return () => { if (texture) texture.dispose() }
  }, [url])

  if (!texture) return null
  return (
    <mesh position={[0, 0, 0.003]}>
      <planeGeometry args={[size[0], size[1]]} />
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
  const setDragging = useStore((s) => s.setDragging)
  const isSelected = selectedId === id
  const isEditing = editingId === id

  const [hovered, setHovered] = useState(false)
  const { camera, gl, invalidate } = useThree()
  const dragData = useRef(null)

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
  const canDrag = true  // all panels are draggable

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
    if (!canDrag) return
    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    const worldPos = new THREE.Vector3()
    e.eventObject.getWorldPosition(worldPos)
    plane.setFromNormalAndCoplanarPoint(camDir, worldPos)
    if (e.ray.intersectPlane(plane, intersect)) {
      offset.copy(intersect).sub(worldPos)
      dragData.current = { dragging: true, parentPos: parent?.position || [0, 0, 0] }
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
      const pp = dragData.current.parentPos
      updateItem(id, { position: [p.x - pp[0], p.y - pp[1], p.z - pp[2]] })
      invalidate()
    }
  }
  const onPointerUp = (e) => {
    if (dragData.current?.dragging) {
      dragData.current = null
      setDragging(false)
      gl.domElement.style.cursor = hovered ? 'grab' : 'auto'
      try { e.target.releasePointerCapture(e.pointerId) } catch {}
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
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); gl.domElement.style.cursor = canDrag ? 'grab' : 'pointer' }}
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
  const listOverlay = panelType === 'list' && (() => {
    const rows = panel.rows || []
    const pad = ptToUnits(14)
    const rowH = ptToUnits(panel.rowHeight || 60)
    const innerW = size[0] - pad * 2
    const startY = size[1] / 2 - pad
    const primary = resolveSemantic('primary', scheme)
    const secondary = resolveSemantic('secondary', scheme)
    const separator = resolveSemantic('tertiary', scheme)
    return (
      <>
        {rows.map((r, i) => {
          const cy = startY - rowH / 2 - i * rowH
          return (
            <group key={i} position={[0, cy, 0.005]}>
              <Text
                position={[-innerW / 2, ptToUnits(8), 0]}
                fontSize={ptToUnits(15)}
                color={primary}
                anchorX="left"
                anchorY="middle"
                maxWidth={innerW * 0.85}
              >{r.title || ''}</Text>
              {r.subtitle && (
                <Text
                  position={[-innerW / 2, -ptToUnits(8), 0]}
                  fontSize={ptToUnits(12)}
                  color={secondary}
                  anchorX="left"
                  anchorY="middle"
                  maxWidth={innerW * 0.85}
                >{r.subtitle}</Text>
              )}
              <Text
                position={[innerW / 2, 0, 0]}
                fontSize={ptToUnits(14)}
                color={secondary}
                anchorX="right"
                anchorY="middle"
              >›</Text>
              {i < rows.length - 1 && (
                <mesh position={[0, -rowH / 2, -0.001]}>
                  <planeGeometry args={[innerW, 0.003]} />
                  <meshBasicMaterial color={separator} />
                </mesh>
              )}
            </group>
          )
        })}
      </>
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
    const iconR = ptToUnits(12)
    const sym = panel.symbolName ? SF_SYMBOLS[panel.symbolName] : null
    const iconGlyph = sym ? sym.glyph : (panel.iconName || 'A')
    return (
      <>
        <mesh position={[-size[0] / 2 + iconR + ptToUnits(4), 0, 0.005]}>
          <circleGeometry args={[iconR, 32]} />
          <meshBasicMaterial color={panel.iconColor || '#007aff'} />
        </mesh>
        <Text position={[-size[0] / 2 + iconR + ptToUnits(4), 0, 0.006]} fontSize={ptToUnits(14)} color="#ffffff" anchorX="center" anchorY="middle">
          {iconGlyph}
        </Text>
        <Text position={[-size[0] / 2 + iconR * 2 + ptToUnits(14), 0, 0.005]} font={fontUrl} fontSize={finalFontSize} color={resolvedTextColor} anchorX="left" anchorY="middle" maxWidth={size[0] * 0.65}>
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

  const borderRing = useMemo(
    () => hasBorder ? rimRingShape(size[0], size[1], cornerRadius, ptToUnits(mod.borderWidth)) : null,
    [hasBorder, size[0], size[1], cornerRadius, mod.borderWidth]
  )

  return (
    <group
      position={[
        (localPosition?.[0] || 0) + modOffX,
        (localPosition?.[1] || 0) + modOffY,
        localPosition?.[2] || 0
      ]}
      scale={[modScaleX, modScaleY, 1]}
      rotation={[0, 0, modRot]}
    >
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
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.85} />
        </mesh>
      )}
      {/* Text/Link/Label selection: subtle underline instead of bounding box */}
      {isSelected && !isEditing && (panelType === 'text' || panelType === 'link' || panelType === 'label') && (
        <mesh position={[0, -size[1] / 2 - ptToUnits(2), -0.001]}>
          <planeGeometry args={[size[0], ptToUnits(2)]} />
          <meshBasicMaterial color={scene.tintColor || '#007aff'} transparent opacity={0.9} />
        </mesh>
      )}

      {hasFill ? (
        <mesh
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={onDoubleClick}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); gl.domElement.style.cursor = canDrag ? 'grab' : 'pointer' }}
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
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); gl.domElement.style.cursor = canDrag ? 'grab' : 'text' }}
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
        <ImageTextureMesh url={panel.imageUrl} size={size} cornerRadius={cornerRadius} />
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
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); gl.domElement.style.cursor = canDrag ? 'grab' : 'pointer' }}
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
