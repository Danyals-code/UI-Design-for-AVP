// Tiny tween + easing helpers for the preview-mode behaviour runtime.
// We don't reach for an external library because every easing curve we
// expose in the Curve dropdown collapses to a one-liner here, and the
// runtime only needs progress 0…1 → eased value.

export const easings = {
  linear:    (t) => t,
  easeIn:    (t) => t * t,
  easeOut:   (t) => 1 - (1 - t) * (1 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  // A perceptual spring without a real ODE — overshoot then settle.
  spring:    (t) => 1 - Math.cos(t * Math.PI * 1.6) * Math.exp(-t * 4)
}

export function ease(name, t) {
  const fn = easings[name] || easings.easeOut
  return fn(Math.max(0, Math.min(1, t)))
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function lerpVec3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ]
}

// #RRGGBB hex → [r, g, b] normalised 0…1.
export function hexToRgb(hex) {
  const h = String(hex || '#000000').replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [
    ((n >> 16) & 0xff) / 255,
    ((n >> 8)  & 0xff) / 255,
    (n & 0xff) / 255
  ]
}

export function rgbToHex(rgb) {
  const c = (x) => {
    const n = Math.max(0, Math.min(255, Math.round(x * 255)))
    return n.toString(16).padStart(2, '0')
  }
  return `#${c(rgb[0])}${c(rgb[1])}${c(rgb[2])}`
}

export function lerpColorHex(a, b, t) {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return rgbToHex([
    lerp(ca[0], cb[0], t),
    lerp(ca[1], cb[1], t),
    lerp(ca[2], cb[2], t)
  ])
}
