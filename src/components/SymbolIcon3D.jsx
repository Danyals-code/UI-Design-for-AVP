import { useEffect, useMemo, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import * as THREE from 'three'
import { Circle as LucideCircle } from 'lucide-react'
import {
  SF_TO_LUCIDE, SYMBOL_WEIGHT_STROKES, SYMBOL_IMAGE_SCALES,
  resolveSymbolName, symbolModeStyling
} from './icons'

// Cache rasterized Lucide SVGs as THREE.CanvasTextures keyed by
// `${name}|${color}|${stroke}|${pixelSize}`. Most labels reuse the
// same handful of symbols, so caching pays off immediately.
const _textureCache = new Map()

function rasterizeSymbol(name, color, strokeWidth, pixelSize) {
  const key = `${name}|${color}|${strokeWidth}|${pixelSize}`
  const cached = _textureCache.get(key)
  if (cached) return cached
  if (typeof document === 'undefined') return null

  const Icon = SF_TO_LUCIDE[name] || LucideCircle
  // renderToStaticMarkup returns a synchronous SVG string — Lucide
  // icons are plain SVG, so this is safe at module top-level.
  const svgString = renderToStaticMarkup(
    <Icon
      size={pixelSize}
      strokeWidth={strokeWidth}
      color={color}
      absoluteStrokeWidth
    />
  )
  const blob = new Blob([svgString], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)

  const canvas = document.createElement('canvas')
  canvas.width = pixelSize
  canvas.height = pixelSize
  const ctx = canvas.getContext('2d')
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  _textureCache.set(key, tex)

  const img = new Image()
  img.onload = () => {
    ctx.clearRect(0, 0, pixelSize, pixelSize)
    ctx.drawImage(img, 0, 0, pixelSize, pixelSize)
    tex.needsUpdate = true
    URL.revokeObjectURL(url)
  }
  img.onerror = () => URL.revokeObjectURL(url)
  img.src = url
  return tex
}

// Hook returning a CanvasTexture for the given symbol + settings.
// Re-rasterizes whenever any input changes; reused across mounts via
// the module-scoped cache.
export function useSymbolTexture({ name, color = '#000000', weight = 'regular', pixelSize = 64 }) {
  const strokeWidth = SYMBOL_WEIGHT_STROKES[weight] ?? 1.5
  return useMemo(
    () => rasterizeSymbol(name, color, strokeWidth, pixelSize),
    [name, color, strokeWidth, pixelSize]
  )
}

// Drop-in 3D symbol renderer. Wraps the rasterized texture in a
// transparent plane sized in SCENE UNITS (metres) so it slots into
// the existing layout/positioning code. `sizeUnits` is the square
// side length; `imageScale` multiplies it per SwiftUI's
// .imageScale(...) modifier.
//
//   <SymbolIcon3D name="info.circle" sizeUnits={ptToUnits(14)} color="#fff" weight="medium" />
//
// Tints are baked into the texture (SVG `stroke="..."`) so changing
// `color` invalidates the cache; that matches SwiftUI's hierarchical
// rendering where the foreground tint colours the glyph.
export function SymbolIcon3D({
  name,
  sizeUnits,
  color = '#000000',
  weight = 'regular',
  imageScale = 'medium',
  variant = null,
  renderingMode = 'monochrome',
  secondaryColor = null,
  position = [0, 0, 0],
  renderOrder = 1,
  pixelSize = 64,
  opacity = 1
}) {
  // Resolve variant suffix + paint adjustments before rasterising so
  // the cache key reflects the resolved glyph + final tint.
  const resolvedName = resolveSymbolName(name, variant)
  const mode = symbolModeStyling(renderingMode, color, secondaryColor)
  const effectiveWeight = weight
  const tex = useSymbolTexture({ name: resolvedName, color: mode.color, weight: effectiveWeight, pixelSize })
  const [, force] = useState(0)
  // Force a re-render once the async image load fires `needsUpdate`.
  useEffect(() => {
    if (!tex) return
    let cancelled = false
    const tick = () => { if (!cancelled) force((n) => n + 1) }
    const id = window.setTimeout(tick, 16)
    return () => { cancelled = true; window.clearTimeout(id) }
  }, [tex])
  if (!tex || !sizeUnits) return null
  const s = sizeUnits * (SYMBOL_IMAGE_SCALES[imageScale] ?? 1.0)
  return (
    <mesh position={position} renderOrder={renderOrder}>
      <planeGeometry args={[s, s]} />
      <meshBasicMaterial
        map={tex}
        transparent
        opacity={opacity * mode.opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}
