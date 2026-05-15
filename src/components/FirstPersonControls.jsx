// First-person look-around controls for preview mode.
//
// Preview mode swaps the editing OrbitControls for this: instead of
// orbiting around a target point, the camera rotates around its own
// position — closer to a real wearer turning their head than to a 3D
// editor flying around an object. Right-drag (or shift-left-drag)
// pans the camera in screen space, and the scroll wheel walks forward
// / back along the look direction. No pointer-lock — using mouse
// directly means the user can still hover their cursor over interactive
// panels exactly as they would on real hardware with gaze + pinch.
//
// WASD walks the camera in the yaw plane (forward/back/strafe) and
// Q/E lift or lower it in world space — UE5-style fly controls so the
// wearer can sim walking around their content. Keys are read from
// `e.code` so they stay on the WASD physical keys regardless of the
// user's keyboard layout.

import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function FirstPersonControls({
  enabled = true,
  lookSensitivity = 0.0035,
  panSensitivity = 0.005,
  walkSensitivity = 0.0025,
  // WASD / QE speed in metres/second. 1.5 reads as a relaxed walking
  // pace at the visionOS scale (windows are ~1m wide, room is ~6m).
  walkSpeed = 1.5
}) {
  const { camera, gl } = useThree()
  const stateRef = useRef({
    yaw: 0, pitch: 0,
    dragging: false, mode: 'rotate',
    lastX: 0, lastY: 0,
    // Physical-key flags (driven by `e.code`, so Dvorak / AZERTY users
    // still get WASD on the same physical keys).
    keys: { w: false, a: false, s: false, d: false, q: false, e: false }
  })

  useEffect(() => {
    if (!enabled) return
    const dom = gl.domElement
    const s = stateRef.current

    // Seed yaw/pitch from whatever the camera is currently doing so the
    // first drag doesn't snap. YXZ order keeps yaw rotation first
    // (turning) then pitch (looking up/down) — same convention used by
    // most FPS engines and the visionOS sim.
    const seedFromCamera = () => {
      const e = new THREE.Euler(0, 0, 0, 'YXZ')
      e.setFromQuaternion(camera.quaternion, 'YXZ')
      s.yaw = e.y
      s.pitch = e.x
    }
    seedFromCamera()

    // The Reset Camera button (and any external code that wants to snap
    // the camera) dispatches 'snap-camera-to-default' which the binder
    // in Canvas3D handles by setting camera.position + lookAt. We then
    // re-seed the FPS yaw/pitch so the next pointermove doesn't slam
    // back to the pre-snap orientation.
    const onResynced = () => {
      // Defer one frame: the binder updates camera in the same tick
      // this event fires, so reading the new orientation has to wait
      // for that side-effect to land.
      requestAnimationFrame(seedFromCamera)
    }
    window.addEventListener('snap-camera-to-default', onResynced)
    window.addEventListener('snap-camera-to-entity', onResynced)

    const onPointerDown = (e) => {
      // Only react to mouse buttons inside the canvas. Buttons on the
      // Topbar / pills float above the canvas and have their own
      // handlers — those events bubble up here too, but they fire on
      // the panel DOM, not on `gl.domElement`, so they don't trigger.
      if (e.target !== dom) return
      if (e.button === 0 && !e.shiftKey)      s.mode = 'rotate'
      else if (e.button === 2 || e.shiftKey)  s.mode = 'pan'
      else return
      s.dragging = true
      s.lastX = e.clientX
      s.lastY = e.clientY
      // Capture so we keep getting moves once the cursor strays out.
      try { dom.setPointerCapture(e.pointerId) } catch {}
    }

    const onPointerMove = (e) => {
      if (!s.dragging) return
      const dx = e.clientX - s.lastX
      const dy = e.clientY - s.lastY
      s.lastX = e.clientX
      s.lastY = e.clientY

      if (s.mode === 'rotate') {
        // Drag right → yaw left (camera looks more to the right, world
        // appears to slide left). Inverting dx matches every FPS / DCC
        // tool on the planet, so users don't have to relearn it.
        s.yaw   -= dx * lookSensitivity
        s.pitch -= dy * lookSensitivity
        // Clamp pitch just shy of straight up / down to avoid the
        // gimbal flip that makes the world appear to spin when the
        // user drags past vertical.
        const limit = Math.PI / 2 - 0.01
        if (s.pitch >  limit) s.pitch =  limit
        if (s.pitch < -limit) s.pitch = -limit
        const eul = new THREE.Euler(s.pitch, s.yaw, 0, 'YXZ')
        camera.quaternion.setFromEuler(eul)
      } else {
        // Pan: shift the camera position by the camera-local right /
        // up vectors so the screen-space drag direction matches the
        // resulting movement. This lets the user walk sideways /
        // strafe up by holding right-button and dragging.
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
        const up    = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
        camera.position.addScaledVector(right, -dx * panSensitivity)
        camera.position.addScaledVector(up,     dy * panSensitivity)
      }
    }

    const endDrag = (e) => {
      s.dragging = false
      try { dom.releasePointerCapture?.(e.pointerId) } catch {}
    }

    const onWheel = (e) => {
      // Wheel walks forward / back along the gaze direction. Negate
      // deltaY so spinning the wheel up moves the camera forward
      // (matches scrolling-as-zoom-in mental model in editors).
      e.preventDefault()
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
      camera.position.addScaledVector(fwd, -e.deltaY * walkSensitivity)
    }

    const onContextMenu = (e) => { e.preventDefault() }

    // WASD walks the camera; QE lifts / lowers it. Reading `e.code` keeps
    // the binding pinned to the physical WASD cluster on every layout.
    // Repeat events are ignored — we just need the "is held" flag.
    const codeToKey = {
      KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyQ: 'q', KeyE: 'e'
    }
    const onKeyDown = (ev) => {
      // Don't steal keys when the user is typing into the inspector,
      // command palette, or any text input that happens to have focus.
      const t = ev.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const k = codeToKey[ev.code]
      if (!k) return
      s.keys[k] = true
      // Block the browser from scrolling the page when the canvas isn't
      // the focused element (W/S would otherwise scroll the document).
      ev.preventDefault()
    }
    const onKeyUp = (ev) => {
      const k = codeToKey[ev.code]
      if (!k) return
      s.keys[k] = false
    }
    // Blur clears every held key so we don't keep flying after the user
    // tabs away from the window.
    const onBlur = () => {
      Object.keys(s.keys).forEach((k) => { s.keys[k] = false })
    }

    dom.addEventListener('pointerdown', onPointerDown)
    dom.addEventListener('pointermove', onPointerMove)
    dom.addEventListener('pointerup',   endDrag)
    dom.addEventListener('pointercancel', endDrag)
    dom.addEventListener('wheel', onWheel, { passive: false })
    dom.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown)
      dom.removeEventListener('pointermove', onPointerMove)
      dom.removeEventListener('pointerup',   endDrag)
      dom.removeEventListener('pointercancel', endDrag)
      dom.removeEventListener('wheel', onWheel)
      dom.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('snap-camera-to-default', onResynced)
      window.removeEventListener('snap-camera-to-entity', onResynced)
    }
  }, [enabled, camera, gl, lookSensitivity, panSensitivity, walkSensitivity])

  // Per-frame WASD / QE translation. Forward / strafe use a yaw-only
  // basis so looking down doesn't pitch the camera into the floor as
  // you walk — UE5's editor cam behaves the same way. Q / E always
  // move along world up so head height is intuitive.
  useFrame((_, dt) => {
    if (!enabled) return
    const s = stateRef.current
    const k = s.keys
    if (!k.w && !k.a && !k.s && !k.d && !k.q && !k.e) return

    const yawOnly = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw)
    const fwd   = new THREE.Vector3(0, 0, -1).applyQuaternion(yawOnly)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(yawOnly)
    const upW   = new THREE.Vector3(0, 1, 0)

    const step = walkSpeed * dt
    if (k.w) camera.position.addScaledVector(fwd,   step)
    if (k.s) camera.position.addScaledVector(fwd,  -step)
    if (k.d) camera.position.addScaledVector(right, step)
    if (k.a) camera.position.addScaledVector(right,-step)
    if (k.e) camera.position.addScaledVector(upW,   step)
    if (k.q) camera.position.addScaledVector(upW,  -step)
  })

  return null
}
