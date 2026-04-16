import * as THREE from 'three'

// Circular rounded rectangle using THREE.Path.absarc for true quarter-circle
// corners — matches iOS/visionOS visuals closely.
export function roundedRectShape(w, h, r) {
  const shape = new THREE.Shape()
  const rad = Math.max(0, Math.min(r, w / 2, h / 2))
  const x = -w / 2
  const y = -h / 2

  if (rad === 0) {
    shape.moveTo(x, y)
    shape.lineTo(x + w, y)
    shape.lineTo(x + w, y + h)
    shape.lineTo(x, y + h)
    shape.lineTo(x, y)
    return shape
  }

  shape.moveTo(x + rad, y)
  shape.lineTo(x + w - rad, y)
  shape.absarc(x + w - rad, y + rad, rad, -Math.PI / 2, 0, false)
  shape.lineTo(x + w, y + h - rad)
  shape.absarc(x + w - rad, y + h - rad, rad, 0, Math.PI / 2, false)
  shape.lineTo(x + rad, y + h)
  shape.absarc(x + rad, y + h - rad, rad, Math.PI / 2, Math.PI, false)
  shape.lineTo(x, y + rad)
  shape.absarc(x + rad, y + rad, rad, Math.PI, Math.PI * 1.5, false)
  return shape
}

// Ellipse shape from THREE.EllipseCurve.
export function ellipseShape(w, h) {
  const shape = new THREE.Shape()
  const curve = new THREE.EllipseCurve(0, 0, w / 2, h / 2, 0, Math.PI * 2, false, 0)
  const pts = curve.getPoints(64)
  shape.setFromPoints(pts)
  return shape
}

// Rounded rect with independent per-corner radii.
export function unevenRoundedRectShape(w, h, tl, tr, bl, br) {
  const shape = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  const clamp = (r) => Math.max(0, Math.min(r, w / 2, h / 2))
  const rtl = clamp(tl)
  const rtr = clamp(tr)
  const rbl = clamp(bl)
  const rbr = clamp(br)

  shape.moveTo(x + rbl, y)
  shape.lineTo(x + w - rbr, y)
  if (rbr > 0) shape.absarc(x + w - rbr, y + rbr, rbr, -Math.PI / 2, 0, false)
  else shape.lineTo(x + w, y)
  shape.lineTo(x + w, y + h - rtr)
  if (rtr > 0) shape.absarc(x + w - rtr, y + h - rtr, rtr, 0, Math.PI / 2, false)
  else shape.lineTo(x + w, y + h)
  shape.lineTo(x + rtl, y + h)
  if (rtl > 0) shape.absarc(x + rtl, y + h - rtl, rtl, Math.PI / 2, Math.PI, false)
  else shape.lineTo(x, y + h)
  shape.lineTo(x, y + rbl)
  if (rbl > 0) shape.absarc(x + rbl, y + rbl, rbl, Math.PI, Math.PI * 1.5, false)
  else shape.lineTo(x, y)
  return shape
}

// Builds a rounded-rect ring: outer rounded rect minus an inset inner one.
// Used for the bright edge highlight on liquid-glass windows.
export function rimRingShape(w, h, r, thickness) {
  const outer = roundedRectShape(w, h, r)
  const innerW = Math.max(0.02, w - thickness * 2)
  const innerH = Math.max(0.02, h - thickness * 2)
  const innerR = Math.max(0, r - thickness)
  const holePath = new THREE.Path()
  const rad = Math.max(0, Math.min(innerR, innerW / 2, innerH / 2))
  const x = -innerW / 2
  const y = -innerH / 2
  if (rad === 0) {
    holePath.moveTo(x, y)
    holePath.lineTo(x + innerW, y)
    holePath.lineTo(x + innerW, y + innerH)
    holePath.lineTo(x, y + innerH)
    holePath.lineTo(x, y)
  } else {
    holePath.moveTo(x + rad, y)
    holePath.lineTo(x + innerW - rad, y)
    holePath.absarc(x + innerW - rad, y + rad, rad, -Math.PI / 2, 0, false)
    holePath.lineTo(x + innerW, y + innerH - rad)
    holePath.absarc(x + innerW - rad, y + innerH - rad, rad, 0, Math.PI / 2, false)
    holePath.lineTo(x + rad, y + innerH)
    holePath.absarc(x + rad, y + innerH - rad, rad, Math.PI / 2, Math.PI, false)
    holePath.lineTo(x, y + rad)
    holePath.absarc(x + rad, y + rad, rad, Math.PI, Math.PI * 1.5, false)
  }
  outer.holes.push(holePath)
  return outer
}
