// Preview-mode behaviour runtime.
//
// All triggers and actions on a 3D entity ONLY do anything when the
// scene is in Preview mode (`scene.previewMode === true`). In edit
// mode the dropdowns and parameters are stored on the item but they're
// completely inert — clicks and hovers fall through to the normal
// "select this entity in the inspector" gesture.
//
// Architecture:
//
//   * `useBehaviorRuntime` — one instance per <Entity3D>. Owns the
//     mutable state for that entity (active tweens, continuous-motion
//     subscribers, hover/drag flags, toggle history). Returns the
//     pointer handlers the wrapper <group> should bind, plus a
//     `useFrame` per-entity tick.
//
//   * Module-level entity registry — every Entity3D registers its
//     `threeRef` so cross-entity actions (follow [other]), cross-
//     entity triggers (collide with [other], proximity to [other])
//     can resolve target IDs to live three.js objects.
//
//   * Module-level camera ref — populated by Canvas3D once mounted.
//     Stand-in for the user's head; "follow user" / "look at user"
//     / "proximity to user" / "in user's view" all read from it.
//
// Mutations during preview are written directly to the live three.js
// objects (group.position.set(...), material.color.setRGB(...)). They
// never touch the zustand store, so leaving Preview mode snaps the
// scene back to its authored state on the next render.

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getTriggerSchema, getActionSchema } from './registry'
import { ease, lerp, lerpVec3, hexToRgb, lerpColorHex } from './tween'
import * as bus from './eventBus'

// ---- Module-level registries ----------------------------------------

const entityRegistry = new Map()  // entityId → { groupRef, meshRef, entity, state? }

export function registerEntity(id, refs) {
  entityRegistry.set(id, refs)
  return () => { entityRegistry.delete(id) }
}

export function getEntityRefs(id) { return entityRegistry.get(id) }

let cameraRef = null
export function setRuntimeCamera(cam) { cameraRef = cam }
export function getRuntimeCamera()    { return cameraRef }

// ---- Helpers --------------------------------------------------------

function resolveTargetGroup(targetParam, ownEntityId) {
  if (!targetParam || targetParam === 'self') {
    return entityRegistry.get(ownEntityId)?.groupRef?.current || null
  }
  if (targetParam === 'user') {
    return cameraRef || null
  }
  return entityRegistry.get(targetParam)?.groupRef?.current || null
}

function targetWorldPosition(targetParam, ownEntityId, out = new THREE.Vector3()) {
  const obj = resolveTargetGroup(targetParam, ownEntityId)
  if (!obj) return null
  obj.getWorldPosition(out)
  return out
}

const _tmpV = new THREE.Vector3()
const _tmpV2 = new THREE.Vector3()

// ---- Action executors -----------------------------------------------
//
// Each executor receives a context with everything it might need, and
// either:
//   a) mutates state synchronously (set vars, broadcast),
//   b) registers a tween (transform / material), or
//   c) registers a continuous subscriber (follow / orbit / look at).
// Async sequencing (wait, repeat) is handled by `runActionList`.

// R3F's invalidate handle (set by the runtime hook on first mount).
// When a tween is queued or a transform mutated outside of useFrame,
// we call this so the demand-driven frameloop schedules a repaint.
let invalidate = null
export function setRuntimeInvalidate(fn) { invalidate = fn }

function startTween(ctx, kind, duration, curve, onTick, onComplete) {
  const tween = {
    kind,
    elapsed: 0,
    duration: Math.max(0.0001, duration),
    curve,
    onTick,
    onComplete,
    done: false
  }
  ctx.state.tweens.push(tween)
  invalidate?.()
  return tween
}

function tickTweens(state, dt) {
  if (!state.tweens.length) return
  const remaining = []
  for (const tw of state.tweens) {
    tw.elapsed += dt
    const raw = Math.min(1, tw.elapsed / tw.duration)
    const t = ease(tw.curve || 'easeOut', raw)
    tw.onTick(t)
    if (raw >= 1) {
      tw.done = true
      tw.onComplete?.()
    } else {
      remaining.push(tw)
    }
  }
  state.tweens = remaining
}

function tickContinuous(state, time, dt) {
  for (const fn of state.continuous.values()) fn(time, dt)
}

// Apply override transform to the wrapper group. We snapshot the
// authored base on first override so that exiting preview leaves no
// mutation behind (Entity3D's React render restores base values
// naturally).
function ensureBase(state, group) {
  if (state.basePosition) return
  state.basePosition = group.position.toArray()
  state.baseScale    = group.scale.toArray()
  state.baseRotation = [group.rotation.x, group.rotation.y, group.rotation.z]
}

function tweenScale(ctx, params) {
  const grp = ctx.groupRef.current
  if (!grp) return
  ensureBase(ctx.state, grp)
  const fromScale = grp.scale.toArray()
  const baseScale = ctx.state.baseScale
  const factor = Number(params.value) || 1
  const target = params.toggle && popToggle(ctx, 'scaleTo')
    ? baseScale
    : params.mode === 'relative'
      ? fromScale.map((s) => s * factor)
      : baseScale.map((s) => s * factor)
  startTween(ctx, 'scale', params.duration, params.curve, (t) => {
    const v = lerpVec3(fromScale, target, t)
    grp.scale.set(v[0], v[1], v[2])
  })
}

function tweenMove(ctx, params) {
  const grp = ctx.groupRef.current
  if (!grp) return
  ensureBase(ctx.state, grp)
  const fromPos = grp.position.toArray()
  const basePos = ctx.state.basePosition
  const offset = params.position || [0, 0, 0]
  const target = params.toggle && popToggle(ctx, 'moveTo')
    ? basePos
    : params.mode === 'absolute'
      ? offset
      : [basePos[0] + offset[0], basePos[1] + offset[1], basePos[2] + offset[2]]
  startTween(ctx, 'move', params.duration, params.curve, (t) => {
    const v = lerpVec3(fromPos, target, t)
    grp.position.set(v[0], v[1], v[2])
  })
}

function tweenRotate(ctx, params) {
  const grp = ctx.groupRef.current
  if (!grp) return
  ensureBase(ctx.state, grp)
  const fromRot = [grp.rotation.x, grp.rotation.y, grp.rotation.z]
  const baseRot = ctx.state.baseRotation
  const deg = params.rotation || [0, 0, 0]
  const radDelta = deg.map((d) => d * Math.PI / 180)
  // `relative` mode accumulates from the CURRENT rotation, not from
  // the initial baseRotation. This is what makes looping rotations
  // work: each timer tick adds another delta to wherever the entity
  // has already rotated to. Without this, the second tick would tween
  // to `base + delta` — the same angle we just reached — and nothing
  // would move. `absolute` still targets the exact angle; `toggle:true`
  // returns to base (undoes the accumulated rotation).
  const target = params.toggle && popToggle(ctx, 'rotateTo')
    ? baseRot
    : params.mode === 'absolute'
      ? radDelta
      : [fromRot[0] + radDelta[0], fromRot[1] + radDelta[1], fromRot[2] + radDelta[2]]
  startTween(ctx, 'rotate', params.duration, params.curve, (t) => {
    const v = lerpVec3(fromRot, target, t)
    grp.rotation.set(v[0], v[1], v[2])
  })
}

function popToggle(ctx, key) {
  const cur = ctx.state.toggles.get(key) || false
  ctx.state.toggles.set(key, !cur)
  return cur  // true means "we're returning to base now"
}

function execShowHide(ctx, params) {
  const targetCtx = resolveTargetCtx(params.target, ctx)
  if (!targetCtx) return
  const grp = targetCtx.groupRef.current
  if (!grp) return
  const showing = grp.visible && (targetCtx.state.opacity ?? 1) > 0.5
  let goal
  if (params.mode === 'show') goal = true
  else if (params.mode === 'hide') goal = false
  else goal = !showing
  if (params.fade) {
    const fromO = targetCtx.state.opacity ?? 1
    const toO = goal ? 1 : 0
    if (goal) grp.visible = true
    startTween(targetCtx, 'opacity', params.duration, 'easeOut', (t) => {
      targetCtx.state.opacity = lerp(fromO, toO, t)
      applyOpacity(grp, targetCtx.state.opacity)
    }, () => { if (!goal) grp.visible = false })
  } else {
    grp.visible = goal
    targetCtx.state.opacity = goal ? 1 : 0
    applyOpacity(grp, targetCtx.state.opacity)
  }
}

function applyOpacity(group, opacity) {
  group.traverse((o) => {
    if (o.isMesh && o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of mats) {
        if (m._origTransparent === undefined) {
          m._origTransparent = m.transparent
          m._origOpacity = m.opacity
        }
        m.transparent = opacity < 1
        m.opacity = opacity
        m.needsUpdate = true
      }
    }
  })
}

function snapshotMaterial(mat) {
  if (mat._origColor === undefined && mat.color) {
    mat._origColor = [mat.color.r, mat.color.g, mat.color.b]
  }
  if (mat._origEmissive === undefined && mat.emissive) {
    mat._origEmissive = [mat.emissive.r, mat.emissive.g, mat.emissive.b]
  }
  if (mat._origRoughness === undefined && mat.roughness !== undefined) {
    mat._origRoughness = mat.roughness
  }
  if (mat._origMetalness === undefined && mat.metalness !== undefined) {
    mat._origMetalness = mat.metalness
  }
  if (mat._origEmissiveIntensity === undefined && mat.emissiveIntensity !== undefined) {
    mat._origEmissiveIntensity = mat.emissiveIntensity
  }
}

function execSetMaterial(ctx, params) {
  const grp = ctx.groupRef.current
  if (!grp) return
  const mesh = findFirstMesh(grp)
  if (!mesh || !mesh.material) return
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  // Stash baselines on first mutation so the preview-exit cleanup can
  // snap colour / roughness / metallic / emission back to the
  // authored values.
  snapshotMaterial(mat)

  const prop = params.property
  const dur = params.duration
  const curve = params.curve

  const isToggle = params.toggle
  const remembered = ctx.state.materialOverrides.get(prop)

  if (prop === 'color' || prop === 'emission') {
    const targetHex = isToggle && remembered ? remembered.from : params.colorValue
    const fromHex = currentMaterialColorHex(mat, prop)
    if (!isToggle) ctx.state.materialOverrides.set(prop, { from: fromHex })
    else ctx.state.materialOverrides.delete(prop)
    startTween(ctx, `mat-${prop}`, dur, curve, (t) => {
      const hex = lerpColorHex(fromHex, targetHex, t)
      const rgb = hexToRgb(hex)
      const targetCol = prop === 'color' ? mat.color : mat.emissive
      if (targetCol && targetCol.setRGB) targetCol.setRGB(rgb[0], rgb[1], rgb[2])
    })
  } else {
    const fromVal = currentMaterialNumber(mat, prop)
    const targetVal = isToggle && remembered ? remembered.from : params.numberValue
    if (!isToggle) ctx.state.materialOverrides.set(prop, { from: fromVal })
    else ctx.state.materialOverrides.delete(prop)
    startTween(ctx, `mat-${prop}`, dur, curve, (t) => {
      const v = lerp(fromVal, targetVal, t)
      applyMaterialNumber(mat, prop, v)
      if (prop === 'opacity') applyOpacity(grp, v)
    })
  }
}

function currentMaterialColorHex(mat, prop) {
  const col = prop === 'color' ? mat.color : mat.emissive
  if (!col) return '#000000'
  const r = Math.round(col.r * 255).toString(16).padStart(2, '0')
  const g = Math.round(col.g * 255).toString(16).padStart(2, '0')
  const b = Math.round(col.b * 255).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

function currentMaterialNumber(mat, prop) {
  if (prop === 'roughness') return mat.roughness ?? 0.5
  if (prop === 'metallic')  return mat.metalness ?? 0
  if (prop === 'opacity')   return mat.opacity ?? 1
  if (prop === 'emissionIntensity') return mat.emissiveIntensity ?? 1
  return 0
}

function applyMaterialNumber(mat, prop, v) {
  if (prop === 'roughness') mat.roughness = v
  else if (prop === 'metallic') mat.metalness = v
  else if (prop === 'opacity') { mat.opacity = v; mat.transparent = v < 1; mat.needsUpdate = true }
  else if (prop === 'emissionIntensity') mat.emissiveIntensity = v
}

function findFirstMesh(group) {
  let found = null
  group.traverse((o) => { if (!found && o.isMesh) found = o })
  return found
}

function execShader(ctx, params) {
  // Browser preview can't load Reality Composer Pro shader graphs; we
  // translate each preset into a simple visual stand-in so the
  // designer can validate intent. Swift export will swap to the real
  // ShaderGraphMaterial.
  const grp = ctx.groupRef.current
  if (!grp) return
  const mesh = findFirstMesh(grp)
  if (!mesh || !mesh.material) return
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  const intensity = Number(params.intensity) || 1
  const e = params.effect
  if (e === 'none') {
    mat.emissiveIntensity = 0
    mat.opacity = 1
    mat.transparent = false
    return
  }
  if (e === 'outline' || e === 'hologram') {
    mat.emissive?.setRGB(0.4 * intensity, 0.7 * intensity, 1.0 * intensity)
    mat.emissiveIntensity = intensity
  }
  if (e === 'dissolve') {
    const fromO = mat.opacity ?? 1
    startTween(ctx, 'shader-dissolve', params.duration, 'easeOut', (t) => {
      const v = lerp(fromO, 0.15, t)
      mat.transparent = true
      mat.opacity = v
    })
  }
  if (e === 'xray') {
    mat.transparent = true
    mat.opacity = Math.max(0.15, 0.4 / Math.max(0.1, intensity))
  }
  mat.needsUpdate = true
}

function resolveTargetCtx(targetParam, ownCtx) {
  if (!targetParam || targetParam === 'self') return ownCtx
  if (targetParam === 'user') return null
  const refs = entityRegistry.get(targetParam)
  if (!refs) return null
  // Build a minimal ctx that reuses our state container so cross-
  // entity tweens still get ticked. Cleaner is per-entity state, but
  // for the common case (act on self) we don't pay for that.
  return {
    ...ownCtx,
    groupRef: refs.groupRef,
    meshRef:  refs.meshRef,
    entityId: targetParam
  }
}

// ---- Continuous-motion executors -----------------------------------

function execLookAt(ctx, params, actionId) {
  if (!params.enabled) { ctx.state.continuous.delete(actionId); return }
  const grp = ctx.groupRef.current
  if (!grp) return
  ctx.state.continuous.set(actionId, () => {
    const tgt = targetWorldPosition(params.target, ctx.entityId, _tmpV)
    if (tgt) grp.lookAt(tgt)
  })
}

function execFollow(ctx, params, actionId) {
  if (!params.enabled) { ctx.state.continuous.delete(actionId); return }
  const grp = ctx.groupRef.current
  if (!grp) return
  const offset = params.offset || [0, 0, 0]
  const lag = Math.max(0.001, Number(params.lag) || 0.2)
  ctx.state.continuous.set(actionId, (_, dt) => {
    const tgt = targetWorldPosition(params.target, ctx.entityId, _tmpV)
    if (!tgt) return
    const goal = _tmpV2.set(tgt.x + offset[0], tgt.y + offset[1], tgt.z + offset[2])
    const k = 1 - Math.exp(-dt / lag)
    grp.position.lerp(goal, k)
  })
}

function execOrbit(ctx, params, actionId) {
  if (!params.enabled) { ctx.state.continuous.delete(actionId); return }
  const grp = ctx.groupRef.current
  if (!grp) return
  const radius = Number(params.radius) || 0.6
  const speed = (Number(params.speed) || 60) * Math.PI / 180
  const axis = params.axis || 'y'
  let angle = 0
  ctx.state.continuous.set(actionId, (_, dt) => {
    angle += speed * dt
    const tgt = targetWorldPosition(params.target, ctx.entityId, _tmpV)
    if (!tgt) return
    if (axis === 'y') {
      grp.position.set(tgt.x + Math.cos(angle) * radius, tgt.y, tgt.z + Math.sin(angle) * radius)
    } else if (axis === 'x') {
      grp.position.set(tgt.x, tgt.y + Math.cos(angle) * radius, tgt.z + Math.sin(angle) * radius)
    } else {
      grp.position.set(tgt.x + Math.cos(angle) * radius, tgt.y + Math.sin(angle) * radius, tgt.z)
    }
  })
}

// ---- Spawn / destroy ------------------------------------------------

function execSpawn(ctx, params) {
  const grp = ctx.groupRef.current
  if (!grp) return
  const tplRefs = params.template === 'self'
    ? entityRegistry.get(ctx.entityId)
    : entityRegistry.get(params.template)
  if (!tplRefs?.groupRef?.current) return
  const tplMesh = findFirstMesh(tplRefs.groupRef.current)
  if (!tplMesh) return
  const where = params.at === 'target'
    ? entityRegistry.get(params.targetEntity)?.groupRef?.current?.position
    : grp.position
  const count = Math.max(1, Number(params.count) || 1)
  const stagger = Number(params.stagger) || 0
  for (let i = 0; i < count; i++) {
    const fire = () => {
      const clone = tplMesh.clone()
      clone.material = tplMesh.material.clone()
      if (where) clone.position.copy(where)
      // Slight random offset so a multi-spawn doesn't z-fight.
      clone.position.x += (Math.random() - 0.5) * 0.1
      clone.position.y += (Math.random() - 0.5) * 0.1
      clone.position.z += (Math.random() - 0.5) * 0.1
      grp.parent?.add(clone)
      ctx.state.spawned.push(clone)
    }
    if (stagger > 0) setTimeout(fire, i * stagger * 1000)
    else fire()
  }
}

function execDestroy(ctx, params) {
  const targetCtx = resolveTargetCtx(params.target, ctx)
  if (!targetCtx) return
  const grp = targetCtx.groupRef.current
  if (!grp) return
  if (params.fade) {
    const fromO = targetCtx.state.opacity ?? 1
    startTween(targetCtx, 'destroy-fade', params.duration, 'easeOut', (t) => {
      const v = lerp(fromO, 0, t)
      targetCtx.state.opacity = v
      applyOpacity(grp, v)
    }, () => { grp.visible = false })
  } else {
    grp.visible = false
  }
}

// ---- Action dispatcher ---------------------------------------------

async function runActionList(ctx, actions) {
  if (!actions?.length) return
  let i = 0
  while (i < actions.length) {
    const a = actions[i]
    const schema = getActionSchema(a.type)
    if (!schema) { i++; continue }
    const params = a.params || {}
    if (a.type === 'wait') {
      await new Promise((r) => setTimeout(r, (params.seconds || 0) * 1000))
      i++
      continue
    }
    if (a.type === 'repeat') {
      const next = actions[i + 1]
      if (!next) { i++; continue }
      if (params.mode === 'forever') {
        // Forever-repeat in preview: cap at 100 to avoid runaway loops.
        for (let k = 0; k < 100; k++) {
          await runActionList(ctx, [next])
          if (!ctx.state.alive) return
        }
      } else {
        const n = Math.max(1, Number(params.count) || 1)
        for (let k = 0; k < n; k++) {
          await runActionList(ctx, [next])
          if (!ctx.state.alive) return
        }
      }
      i += 2
      continue
    }
    runSingleAction(ctx, a, schema)
    i++
  }
}

function runSingleAction(ctx, action, schema) {
  const p = action.params || {}
  switch (schema.kind) {
    case 'transform':
      if (action.type === 'scaleTo')  tweenScale(ctx, p)
      else if (action.type === 'moveTo') tweenMove(ctx, p)
      else if (action.type === 'rotateTo') tweenRotate(ctx, p)
      break
    case 'visibility':
      execShowHide(ctx, p)
      break
    case 'material':
      execSetMaterial(ctx, p)
      break
    case 'shader':
      execShader(ctx, p)
      break
    case 'continuous':
      if (action.type === 'lookAt') execLookAt(ctx, p, action.id)
      else if (action.type === 'follow') execFollow(ctx, p, action.id)
      else if (action.type === 'orbit')  execOrbit(ctx, p, action.id)
      break
    case 'spawn':
      execSpawn(ctx, p)
      break
    case 'destroy':
      execDestroy(ctx, p)
      break
    case 'playback':
      // Fire animation-finished trigger on completion. Browser preview
      // has no clip library, so we treat 'play' as a 0.4 s no-op tween
      // whose only purpose is to let chained 'animationFinished'
      // triggers fire. Swift export uses the real clip.
      startTween(ctx, 'play-anim', 0.4, 'linear', () => {}, () => {
        bus.emit(`__animfinished__:${ctx.entityId}`)
      })
      break
    case 'flow':
      if (action.type === 'broadcast') {
        bus.emit(`event:${p.name}`, { from: ctx.entityId })
      }
      // wait / repeat are handled by runActionList's loop
      break
  }
}

// ---- Trigger setup --------------------------------------------------

function setupTrigger(ctx, behavior, scheduleRun) {
  const t = behavior.trigger
  if (!t) return () => {}
  const schema = getTriggerSchema(t.type)
  if (!schema) return () => {}
  const params = t.params || {}

  // Lifecycle
  if (schema.kind === 'lifecycle' && t.type === 'sceneStart') {
    // Fire on next microtask so all entities are registered first.
    const id = setTimeout(() => scheduleRun(behavior), 0)
    return () => clearTimeout(id)
  }

  // Timer. `mode: 'loop'` fires at t=0 (via a next-microtask setTimeout
  // so the entity is fully registered first) and then every N seconds.
  // Without the immediate fire, orbits and pulses feel dead for the
  // first N seconds after preview starts. `mode: 'once'` still waits
  // its full delay before firing.
  if (schema.kind === 'timer') {
    if (params.mode === 'loop') {
      const kickoff = setTimeout(() => scheduleRun(behavior), 0)
      const interval = setInterval(() => scheduleRun(behavior), Math.max(50, (params.seconds || 1) * 1000))
      return () => { clearTimeout(kickoff); clearInterval(interval) }
    } else {
      const id = setTimeout(() => scheduleRun(behavior), Math.max(0, (params.seconds || 0) * 1000))
      return () => clearTimeout(id)
    }
  }

  // Event received
  if (schema.kind === 'event') {
    return bus.on(`event:${params.name}`, () => scheduleRun(behavior))
  }

  // Animation finished
  if (schema.kind === 'playback' && t.type === 'animationFinished') {
    const tgt = params.target === 'self' ? ctx.entityId : params.target
    return bus.on(`__animfinished__:${tgt}`, () => scheduleRun(behavior))
  }

  // Pointer / tick triggers register intent on the runtime state so
  // the per-entity useFrame and pointer handlers can match against
  // them.
  ctx.state.activeTriggers.push({ behavior, schema, params })
  return () => {
    const idx = ctx.state.activeTriggers.findIndex((x) => x.behavior === behavior)
    if (idx >= 0) ctx.state.activeTriggers.splice(idx, 1)
  }
}

// ---- Public hook ----------------------------------------------------

export function useBehaviorRuntime({ entity, scene, items }) {
  const previewMode = !!scene?.previewMode
  const groupRef = useRef(null)
  const meshRef  = useRef(null)
  const stateRef = useRef(null)
  const { camera, invalidate: r3fInvalidate } = useThree()

  // Capture camera + invalidate handle for cross-entity / non-frame
  // mutations (tween starts, action wake-ups). Treats the runtime
  // camera as the user's head proxy.
  useEffect(() => {
    if (camera) setRuntimeCamera(camera)
    if (r3fInvalidate) setRuntimeInvalidate(r3fInvalidate)
  }, [camera, r3fInvalidate])

  // Reset / build runtime state when previewMode flips.
  useEffect(() => {
    if (!previewMode) {
      // Clean exit: kill timers, listeners, continuous subs, spawns,
      // AND undo every transform / material mutation we made in
      // preview. R3F doesn't re-set position/scale/rotation on the
      // wrapper group when the prop arrays keep their identity, so
      // without this restore the entity sticks at whatever state the
      // last tween / continuous action left it in.
      const prevState = stateRef.current
      if (prevState) {
        prevState.alive = false
        prevState.disposers.forEach((d) => { try { d() } catch {} })
        prevState.spawned.forEach((s) => { try { s.removeFromParent?.() } catch {} })
      }
      stateRef.current = null
      const grp = groupRef.current
      if (grp) {
        // Snap transform back to the snapshot we took the first time
        // a tween touched it. Falls back to entity props for entities
        // never touched by preview.
        const basePos = prevState?.basePosition || (entity.position || [0, 0, 0])
        const baseScl = prevState?.baseScale    || (entity.scale    || [1, 1, 1])
        const baseRot = prevState?.baseRotation || ((entity.rotation || [0, 0, 0]).map((d) => d * Math.PI / 180))
        grp.position.set(basePos[0], basePos[1], basePos[2])
        grp.scale.set(baseScl[0], baseScl[1], baseScl[2])
        grp.rotation.set(baseRot[0], baseRot[1], baseRot[2])
        grp.visible = entity.visible !== false
        grp.traverse((o) => {
          if (o.isMesh && o.material) {
            const mats = Array.isArray(o.material) ? o.material : [o.material]
            for (const m of mats) {
              if (m._origTransparent !== undefined) {
                m.transparent = m._origTransparent
                m.opacity     = m._origOpacity
                delete m._origTransparent
                delete m._origOpacity
              }
              if (m._origColor && m.color?.setRGB) {
                m.color.setRGB(m._origColor[0], m._origColor[1], m._origColor[2])
                delete m._origColor
              }
              if (m._origEmissive && m.emissive?.setRGB) {
                m.emissive.setRGB(m._origEmissive[0], m._origEmissive[1], m._origEmissive[2])
                delete m._origEmissive
              }
              if (m._origRoughness !== undefined) { m.roughness = m._origRoughness; delete m._origRoughness }
              if (m._origMetalness !== undefined) { m.metalness = m._origMetalness; delete m._origMetalness }
              if (m._origEmissiveIntensity !== undefined) { m.emissiveIntensity = m._origEmissiveIntensity; delete m._origEmissiveIntensity }
              m.needsUpdate = true
            }
          }
        })
        if (r3fInvalidate) r3fInvalidate()
      }
      return
    }

    // Preview entry: build state container and wire triggers. Mirror
    // a reference to the state on the cross-entity registry so debug
    // helpers / external invocations (Swift bridge later) can reach it.
    if (entityRegistry.has(entity.id)) {
      entityRegistry.get(entity.id).state = null  // placeholder; assigned below
    }
    stateRef.current = {
      alive: true,
      tweens: [],
      continuous: new Map(),
      toggles: new Map(),
      activeTriggers: [],
      disposers: [],
      hovering: false,
      dragging: false, dragStart: null,
      // Open wheel-driven gesture bursts, keyed by gesture kind. See
      // `pumpWheelGesture`.
      wheelBursts: new Map(),
      proxState: new Map(),
      inViewState: new Map(),
      collisionState: new Map(),
      opacity: 1,
      materialOverrides: new Map(),
      spawned: []
    }

    const ctx = {
      entityId: entity.id,
      entity, scene, items,
      groupRef, meshRef,
      state: stateRef.current
    }

    // Mirror state onto the registry entry so cross-entity debug /
    // external triggers can reach it without a hook context.
    const registered = entityRegistry.get(entity.id)
    if (registered) registered.state = stateRef.current

    const scheduleRun = (behavior) => {
      if (!ctx.state.alive) return
      runActionList(ctx, behavior.actions || [])
    }

    for (const behavior of (entity.behaviors || [])) {
      const dispose = setupTrigger(ctx, behavior, scheduleRun)
      stateRef.current.disposers.push(dispose)
    }

    return () => {
      if (stateRef.current) {
        stateRef.current.alive = false
        stateRef.current.disposers.forEach((d) => { try { d() } catch {} })
        // A gesture burst left open would fire its `end` after the entity is
        // gone, into a dead action context.
        for (const t of stateRef.current.wheelBursts.values()) clearTimeout(t)
        stateRef.current.wheelBursts.clear()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewMode, entity.id, JSON.stringify(entity.behaviors || [])])

  // Per-frame tick: tweens, continuous subs, proximity / in-view checks.
  // R3F's useFrame fires every frame the Canvas renders. Canvas3D
  // uses `frameloop="always"`, so this runs at ~60fps in preview.
  useFrame((threeState, dt) => {
    if (!previewMode) return
    const state = stateRef.current
    if (!state || !state.alive) return
    tickTweens(state, dt)
    tickContinuous(state, threeState.clock.elapsedTime, dt)
    for (const at of state.activeTriggers) {
      if (at.schema.kind !== 'tick') continue
      const tri = at.behavior.trigger
      const fire = () => runActionList(
        { entityId: entity.id, entity, scene, items, groupRef, meshRef, state },
        at.behavior.actions || []
      )
      if (tri.type === 'proximity') checkProximity(at, tri.params, entity.id, state, fire)
      else if (tri.type === 'inView') checkInView(at, tri.params, entity.id, state, fire)
      else if (tri.type === 'collision') checkCollision(at, tri.params, entity.id, state, fire)
    }
  })

  // Pointer handlers — wrappers that fire matching triggers.
  const handlers = useMemo(() => {
    if (!previewMode) return null
    return {
      onPointerDown: (e) => {
        const state = stateRef.current
        if (!state) return
        e.stopPropagation()
        state.lastPointerDownTime = performance.now()
        state.dragStart = [e.point?.x ?? 0, e.point?.y ?? 0, e.point?.z ?? 0]
        state.dragging = false
        // Long-press detection
        state.longPressTimer = setTimeout(() => {
          fireTaps(state, 'long', entity, scene, items, groupRef, meshRef)
        }, 500)
      },
      onPointerUp: (e) => {
        const state = stateRef.current
        if (!state) return
        e.stopPropagation()
        if (state.longPressTimer) { clearTimeout(state.longPressTimer); state.longPressTimer = null }
        const now = performance.now()
        const heldFor = now - (state.lastPointerDownTime || 0)
        if (state.dragging) {
          fireDrags(state, 'end', entity, scene, items, groupRef, meshRef)
          state.dragging = false
          return
        }
        if (heldFor >= 500) return  // long-press already fired
        // Single vs double tap
        if (state.lastTapTime && (now - state.lastTapTime) < 280) {
          fireTaps(state, 'double', entity, scene, items, groupRef, meshRef)
          state.lastTapTime = 0
        } else {
          state.lastTapTime = now
          // Delay single-tap so a follow-up tap can upgrade it.
          state.singleTapTimer = setTimeout(() => {
            fireTaps(state, 'single', entity, scene, items, groupRef, meshRef)
            state.lastTapTime = 0
          }, 280)
        }
      },
      onPointerOver: (e) => {
        const state = stateRef.current
        if (!state) return
        e.stopPropagation()
        if (state.hovering) return
        state.hovering = true
        fireHover(state, 'enter', entity, scene, items, groupRef, meshRef)
      },
      onPointerOut: (e) => {
        const state = stateRef.current
        if (!state) return
        e.stopPropagation()
        if (!state.hovering) return
        state.hovering = false
        if (state.singleTapTimer) { clearTimeout(state.singleTapTimer); state.singleTapTimer = null }
        if (state.longPressTimer) { clearTimeout(state.longPressTimer); state.longPressTimer = null }
        fireHover(state, 'leave', entity, scene, items, groupRef, meshRef)
      },
      onPointerMove: (e) => {
        const state = stateRef.current
        if (!state || state.lastPointerDownTime == null) return
        if (!state.dragStart) return
        const dx = (e.point?.x ?? 0) - state.dragStart[0]
        const dy = (e.point?.y ?? 0) - state.dragStart[1]
        const dz = (e.point?.z ?? 0) - state.dragStart[2]
        const moved = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (!state.dragging && moved > 0.02) {
          state.dragging = true
          if (state.longPressTimer) { clearTimeout(state.longPressTimer); state.longPressTimer = null }
          fireDrags(state, 'start', entity, scene, items, groupRef, meshRef)
        }
        if (state.dragging) {
          fireDrags(state, 'while', entity, scene, items, groupRef, meshRef)
        }
      },
      onWheel: (e) => {
        // Browser stand-ins for the two-handed device gestures. A mouse has
        // neither, so the wheel carries both: plain wheel magnifies, and
        // SHIFT + wheel twists. Shift is the discriminator because the two
        // have to be mutually exclusive — one wheel event must not fire a
        // pinch behaviour and a rotate behaviour at once.
        //
        // `rotateGesture` had no stand-in at all: it is in the vocabulary,
        // sits in the inspector, and generates real `RotateGesture3D` Swift,
        // but the runtime matched only 'drag' and 'pinch'. Authoring one gave
        // a preview that did nothing and code that worked. AUDIT #12.
        const state = stateRef.current
        if (!state) return
        e.stopPropagation()
        const rotating = !!(e.shiftKey || e.nativeEvent?.shiftKey)
        const fire = rotating ? fireRotate : firePinch
        pumpWheelGesture(state, rotating ? 'rotate' : 'pinch', (mode) => {
          fire(state, mode, entity, scene, items, groupRef, meshRef)
        })
      }
    }
  }, [previewMode, entity.id])

  return {
    groupRef,
    meshRef,
    handlers,
    previewMode
  }
}

// ---- Trigger-match firing helpers ----------------------------------

function fireTaps(state, mode, entity, scene, items, groupRef, meshRef) {
  const ctx = { entityId: entity.id, entity, scene, items, groupRef, meshRef, state }
  for (const at of state.activeTriggers) {
    if (at.behavior.trigger.type !== 'tap') continue
    const want = at.params.mode || 'single'
    if (want !== mode) continue
    runActionList(ctx, at.behavior.actions || [])
  }
}

function fireHover(state, mode, entity, scene, items, groupRef, meshRef) {
  const ctx = { entityId: entity.id, entity, scene, items, groupRef, meshRef, state }
  for (const at of state.activeTriggers) {
    if (at.behavior.trigger.type !== 'hover') continue
    const want = at.params.mode || 'enter'
    if (mode === 'enter' && (want === 'enter' || want === 'while')) runActionList(ctx, at.behavior.actions || [])
    else if (mode === 'leave' && want === 'leave') runActionList(ctx, at.behavior.actions || [])
  }
}

function fireDrags(state, mode, entity, scene, items, groupRef, meshRef) {
  const ctx = { entityId: entity.id, entity, scene, items, groupRef, meshRef, state }
  for (const at of state.activeTriggers) {
    if (at.behavior.trigger.type !== 'drag') continue
    const want = at.params.mode || 'start'
    if (want === mode) runActionList(ctx, at.behavior.actions || [])
  }
}

function firePinch(state, mode, entity, scene, items, groupRef, meshRef) {
  const ctx = { entityId: entity.id, entity, scene, items, groupRef, meshRef, state }
  for (const at of state.activeTriggers) {
    if (at.behavior.trigger.type !== 'pinch') continue
    const want = at.params.mode || 'change'
    if (want === mode) runActionList(ctx, at.behavior.actions || [])
  }
}

function fireRotate(state, mode, entity, scene, items, groupRef, meshRef) {
  const ctx = { entityId: entity.id, entity, scene, items, groupRef, meshRef, state }
  for (const at of state.activeTriggers) {
    if (at.behavior.trigger.type !== 'rotateGesture') continue
    const want = at.params.mode || 'change'
    if (want === mode) runActionList(ctx, at.behavior.actions || [])
  }
}

// How long a wheel stream may go quiet before its gesture counts as finished.
// Long enough to bridge the gaps in a trackpad flick, short enough that `end`
// still reads as part of the same interaction.
const WHEEL_GESTURE_END_MS = 140

// Turn a stream of discrete wheel ticks into the begin / change / end phases
// a continuous device gesture has.
//
// `MagnifyGesture` and `RotateGesture3D` each carry all three, and all three
// sit in the inspector's "When" picker — but the old handler hard-coded
// 'change' (via a ternary whose branches were identical), so a behaviour
// wired to Begins or Ends could never run on the canvas. The first tick of a
// burst now opens the gesture and changes it, later ticks change it, and an
// idle timeout closes it.
export function pumpWheelGesture(state, kind, fire) {
  const open = state.wheelBursts.get(kind)
  if (open) clearTimeout(open)
  else fire('start')
  fire('change')
  state.wheelBursts.set(kind, setTimeout(() => {
    state.wheelBursts.delete(kind)
    if (state.alive) fire('end')
  }, WHEEL_GESTURE_END_MS))
}

// ---- Tick-based trigger checks ------------------------------------

function checkProximity(at, params, ownId, state, fire) {
  const own = entityRegistry.get(ownId)?.groupRef?.current
  if (!own) return
  const ownPos = own.getWorldPosition(_tmpV)
  const tgtPos = params.target === 'user'
    ? cameraRef && cameraRef.getWorldPosition(_tmpV2)
    : entityRegistry.get(params.target)?.groupRef?.current?.getWorldPosition(_tmpV2)
  if (!tgtPos) return
  const d = ownPos.distanceTo(tgtPos)
  const m = Number(params.meters) || 1.5
  const wasInside = state.proxState.get(at.behavior.id) || false
  const inside = d <= m
  if (inside !== wasInside) {
    state.proxState.set(at.behavior.id, inside)
    if (params.mode === 'enter' && inside) fire()
    if (params.mode === 'leave' && !inside) fire()
  }
}

function checkInView(at, params, ownId, state, fire) {
  if (!cameraRef) return
  const own = entityRegistry.get(ownId)?.groupRef?.current
  if (!own) return
  const ownPos = own.getWorldPosition(_tmpV)
  const camPos = cameraRef.getWorldPosition(_tmpV2)
  const camDir = new THREE.Vector3()
  cameraRef.getWorldDirection(camDir)
  const toEntity = ownPos.clone().sub(camPos).normalize()
  const dot = camDir.dot(toEntity)
  const cone = Math.cos((Number(params.angleDeg) || 30) * Math.PI / 180)
  const inside = dot >= cone
  const was = state.inViewState.get(at.behavior.id) || false
  if (inside !== was) {
    state.inViewState.set(at.behavior.id, inside)
    if (params.mode === 'enter' && inside) fire()
    if (params.mode === 'leave' && !inside) fire()
  }
}

function checkCollision(at, params, ownId, state, fire) {
  const own = entityRegistry.get(ownId)?.groupRef?.current
  const tgt = entityRegistry.get(params.target)?.groupRef?.current
  if (!own || !tgt) return
  // Cheap AABB overlap via bounding boxes.
  if (!state._boxA) state._boxA = new THREE.Box3()
  if (!state._boxB) state._boxB = new THREE.Box3()
  state._boxA.setFromObject(own)
  state._boxB.setFromObject(tgt)
  const overlap = state._boxA.intersectsBox(state._boxB)
  const was = state.collisionState.get(at.behavior.id) || false
  if (overlap !== was) {
    state.collisionState.set(at.behavior.id, overlap)
    if (params.mode === 'began' && overlap) fire()
    if (params.mode === 'ended' && !overlap) fire()
  }
}
