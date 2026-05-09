// Blender-style modal transforms.
//
// When the user picks a tool (Move / Rotate / Scale) — either by
// clicking the toolbar or pressing G / R / S — the entity follows the
// cursor in real time:
//
//   pointer move   → entity transform updates (live preview)
//   left click     → confirm, return to Select
//   Esc / right    → cancel, revert to the original transform
//
// The whole modal is one undo step (we use `setDragging(true)` at start
// so updateItem inside skips the per-keystroke snapshot, matching the
// drag-window behaviour used everywhere else).
//
// Math: translate projects the cursor onto the camera's view plane at
// the entity's depth; rotate measures the angle change between the
// cursor → entity-on-screen vector at start vs now and rotates around
// the camera-axis closest to "up" (Y); scale takes the distance ratio
// from the entity centre. Identical to Blender's defaults — designers
// who already have G/R/S muscle memory will be productive immediately.

import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store'

const RAD2DEG = 180 / Math.PI

// Compute an entity's world position by walking up its ancestor chain
// and accumulating local positions. Cheap enough to run per-frame on a
// single selected entity.
function entityWorldPosition(items, entity) {
  const out = new THREE.Vector3()
  let cur = entity
  while (cur) {
    if (Array.isArray(cur.position)) {
      out.x += cur.position[0] || 0
      out.y += cur.position[1] || 0
      out.z += cur.position[2] || 0
    }
    cur = items.find((it) => it.id === cur.parentId) || null
  }
  return out
}

export default function ModalTransform() {
  const { camera, gl } = useThree()
  const transformMode = useStore((s) => s.transformMode)
  const transformKind = useStore((s) => s.transformKind)
  const selectedId    = useStore((s) => s.selectedId)
  const items         = useStore((s) => s.items)
  const updateItem    = useStore((s) => s.updateItem)
  const setTransformMode = useStore((s) => s.setTransformMode)
  const setDragging   = useStore((s) => s.setDragging)

  const stateRef = useRef(null)

  const selected = items.find((it) => it.id === selectedId)
  const active = transformMode !== 'none'
              && !!selected
              && selected.type === 'entity'

  useEffect(() => {
    if (!active) {
      stateRef.current = null
      return
    }

    // Capture the entity's current transform + the world position we'll
    // project against. setDragging fires the single undo snapshot for
    // the whole modal — every updateItem after this is dirty-tracked
    // but doesn't push another past entry.
    const worldPos = entityWorldPosition(items, selected)
    stateRef.current = {
      mode: transformMode,
      origPos:   [...(selected.position || [0, 0, 0])],
      origRot:   [...(selected.rotation || [0, 0, 0])],
      origScale: [...(selected.scale    || [1, 1, 1])],
      startCursorNDC: null,    // captured on first pointermove
      worldPos,
      // Two parent-frame basis vectors (right & up) the translate
      // handler projects cursor delta onto. Capturing them once at
      // start means the live drag stays stable even if the camera
      // jitters slightly during damping.
      camRight: new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0),
      camUp:    new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1),
      // Pixel-to-world conversion factor at this depth — see translate
      // handler for derivation.
      worldPerNDC: (() => {
        const dist = camera.position.distanceTo(worldPos)
        const fov = (camera.fov * Math.PI) / 180
        const visibleHeight = 2 * Math.tan(fov / 2) * dist
        // visible width = visibleHeight * aspect; we apply X/Y separately
        return { y: visibleHeight / 2, x: visibleHeight * camera.aspect / 2 }
      })()
    }
    setDragging(true)

    const canvas = gl.domElement
    const ndcFromEvent = (e) => {
      const rect = canvas.getBoundingClientRect()
      return new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
    }

    const exitModal = ({ revert }) => {
      if (revert && stateRef.current && selected) {
        updateItem(selected.id, {
          position: stateRef.current.origPos,
          rotation: stateRef.current.origRot,
          scale:    stateRef.current.origScale
        })
      }
      stateRef.current = null
      setDragging(false)
      setTransformMode('none')
    }

    const onPointerMove = (e) => {
      const st = stateRef.current
      if (!st) return
      const ndc = ndcFromEvent(e)
      if (!st.startCursorNDC) {
        st.startCursorNDC = ndc
        return
      }
      const dx = ndc.x - st.startCursorNDC.x
      const dy = ndc.y - st.startCursorNDC.y

      // Read the axis chord live so a press of X / Y / Z mid-drag
      // re-clamps the next frame to that axis (Blender behaviour).
      const axis = useStore.getState().transformAxis  // 'x' | 'y' | 'z' | null

      if (st.mode === 'translate') {
        const offsetX = dx * st.worldPerNDC.x
        const offsetY = dy * st.worldPerNDC.y
        // Free translate projects to camera right/up. With a chord
        // constraint we instead measure how far the cursor moved along
        // the chosen world axis projected to screen, and apply that
        // directly so the entity slides only on X / Y / Z.
        let nx = st.origPos[0]
        let ny = st.origPos[1]
        let nz = st.origPos[2]
        if (!axis) {
          const offset = new THREE.Vector3()
            .addScaledVector(st.camRight, offsetX)
            .addScaledVector(st.camUp,    offsetY)
          nx += offset.x; ny += offset.y; nz += offset.z
        } else {
          // Project the world-axis basis vector onto the screen and
          // dot the cursor delta with that 2-D direction to get the
          // signed delta along the axis.
          const worldAxis = new THREE.Vector3(
            axis === 'x' ? 1 : 0,
            axis === 'y' ? 1 : 0,
            axis === 'z' ? 1 : 0
          )
          const tip = st.worldPos.clone().add(worldAxis).project(camera)
          const tail = st.worldPos.clone().project(camera)
          const screenAxis = new THREE.Vector2(tip.x - tail.x, tip.y - tail.y)
          const len2 = Math.max(1e-6, screenAxis.x * screenAxis.x + screenAxis.y * screenAxis.y)
          const t = (dx * screenAxis.x + dy * screenAxis.y) / len2
          if (axis === 'x') nx += t
          else if (axis === 'y') ny += t
          else nz += t
        }
        updateItem(selected.id, { position: [nx, ny, nz] })
      } else if (st.mode === 'rotate') {
        // Project the entity centre onto NDC and compute the angle the
        // cursor has swept around it. Axis constraint picks WHICH world
        // axis the rotation is applied to; "free" defaults to Y (the
        // most common visionOS rotation).
        const screen = st.worldPos.clone().project(camera)
        const a0 = Math.atan2(st.startCursorNDC.y - screen.y, st.startCursorNDC.x - screen.x)
        const a1 = Math.atan2(ndc.y - screen.y, ndc.x - screen.x)
        const deltaDeg = (a1 - a0) * RAD2DEG
        const axisIdx = axis === 'x' ? 0 : axis === 'z' ? 2 : 1  // default Y
        const next = [...st.origRot]
        next[axisIdx] = st.origRot[axisIdx] + deltaDeg
        updateItem(selected.id, { rotation: next })
      } else if (st.mode === 'scale') {
        // Uniform scale based on the cursor's distance ratio from the
        // entity centre. Threshold at 0.01 to avoid division blow-up
        // near the centre. Axis chord scales only that axis (Blender
        // `S X` etc.); free `S` scales all three uniformly.
        const screen = st.worldPos.clone().project(camera)
        const d0 = Math.hypot(st.startCursorNDC.x - screen.x, st.startCursorNDC.y - screen.y)
        const d1 = Math.hypot(ndc.x - screen.x, ndc.y - screen.y)
        const ratio = d1 / Math.max(0.01, d0)
        const sx = axis && axis !== 'x' ? st.origScale[0] : Math.max(0.001, st.origScale[0] * ratio)
        const sy = axis && axis !== 'y' ? st.origScale[1] : Math.max(0.001, st.origScale[1] * ratio)
        const sz = axis && axis !== 'z' ? st.origScale[2] : Math.max(0.001, st.origScale[2] * ratio)
        updateItem(selected.id, { scale: [sx, sy, sz] })
      }
    }

    // Confirm with left click; cancel with right click or Esc. We
    // listen on pointerdown (not click) so the modal exits before the
    // canvas's own click handlers fire — the entity stays selected
    // either way.
    const onPointerDown = (e) => {
      const st = stateRef.current
      if (!st || !st.startCursorNDC) return  // wait for first move
      if (e.button === 2) {
        e.preventDefault()
        exitModal({ revert: true })
      } else {
        // Left or middle click commits.
        e.preventDefault()
        exitModal({ revert: false })
      }
    }

    const onContextMenu = (e) => {
      // Suppress browser context menu while the modal is active.
      if (stateRef.current) e.preventDefault()
    }

    const onKeyDown = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'Escape') {
        e.preventDefault()
        exitModal({ revert: true })
      } else if (e.key === 'Enter') {
        e.preventDefault()
        exitModal({ revert: false })
      }
    }

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('keydown', onKeyDown)
      // If the effect tears down without an explicit exit, drop the
      // dragging flag so OrbitControls can resume.
      if (stateRef.current) {
        setDragging(false)
        stateRef.current = null
      }
    }
  // We intentionally re-run only when the modal state really changes —
  // re-running on every store change (every pointermove updates items)
  // would tear down and recreate the listeners every frame.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, transformMode, selectedId])

  return null
}
