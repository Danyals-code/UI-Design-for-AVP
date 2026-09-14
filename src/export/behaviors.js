// Behavior exporter — the designer's trigger/action wiring as Swift.
//
// A behavior is `{ trigger, actions[] }` on an entity. The canvas runs these
// in preview mode; this module turns them into code.
//
// ---- Architecture ----
//
// Gestures are view modifiers on the RealityView, not per-entity callbacks,
// and lifecycle/timer/event triggers have no entity to start from. So the
// generated view keeps a scene root:
//
//     @State private var sceneRoot = Entity()
//
// every root entity becomes its child, and behaviour methods resolve targets
// with `sceneRoot.findEntity(named:)`. Lookup by name is safe because
// `uniqueNameInTab` already guarantees names are unique within a tab.
//
// One handler per gesture type switches on `entity.name`, so ten tappable
// entities still produce one `.gesture` modifier.
//
// Action lists are `async` and sleep for each animation's duration, which
// reproduces the sequential chaining the designer's runtime does.
//
// ---- What is generated, and what is not ----
//
// Generated: tap / drag / pinch / rotate / sceneStart / timer / event /
// collision triggers, and the moveTo / rotateTo / scaleTo / showHide /
// destroy / broadcast / wait / lookAt / playAnimation / setMaterial / spawn
// actions.
//
// Documented instead of generated, because faking them would produce code
// that compiles and silently misbehaves:
//
//   • hover logic - RealityKit has no per-entity hover callback. We DO add
//     the real HoverEffectComponent for the visual, and point at the options
//     for the logic.
//   • proximity / inView / follow / orbit - all need a per-frame System.
//     That is a different shape of code (a registered System struct), not a
//     line in a closure.
//   • animationFinished - needs an AnimationEvents subscription tied to a
//     specific playback controller.
//   • shaderEffect - needs a Reality Composer Pro shader graph asset.
//   • repeat - the designer's loop semantics are per-behaviour rather than
//     per-action, so generating a for-loop here would change meaning.
//
// Every one of those emits a comment naming the exact API to reach for, so
// the wiring is never silently dropped.

const POINTER_TRIGGERS = new Set(['tap', 'drag', 'pinch', 'rotateGesture', 'hover'])
const GENERATED_TRIGGERS = new Set([
  'tap', 'drag', 'pinch', 'rotateGesture', 'sceneStart', 'timer', 'eventReceived', 'collision'
])
const GENERATED_ACTIONS = new Set([
  'moveTo', 'rotateTo', 'scaleTo', 'showHide', 'destroy', 'broadcast',
  'wait', 'lookAt', 'playAnimation', 'setMaterial', 'spawn'
])

// The behaviour vocabulary is deliberately wider than what this file can
// generate: the rest is emitted as a documented "still to wire up" block
// naming the real RealityKit API. That is an honest place to land, but the
// designer only found out AFTER exporting. These two predicates let the
// Behaviors inspector say so up front, reading the same sets the emitter
// switches on so the warning cannot drift from the behaviour.
export const triggerGeneratesSwift = (type) => GENERATED_TRIGGERS.has(type)
export const actionGeneratesSwift = (type) => GENERATED_ACTIONS.has(type)

const CURVE_TO_SWIFT = {
  linear: '.linear',
  easeIn: '.easeIn',
  easeOut: '.easeOut',
  easeInOut: '.easeInOut',
  // RealityKit's AnimationTimingFunction has no spring case; easeInOut is the
  // closest of the four it does offer.
  spring: '.easeInOut'
}

const f = (n) => {
  const v = Number(n) || 0
  return Number.isInteger(v) ? `${v}.0` : String(Number(v.toFixed(6)))
}

const vec3 = (a, fallback = [0, 0, 0]) => {
  const v = Array.isArray(a) ? a : fallback
  return `[${f(v[0])}, ${f(v[1])}, ${f(v[2])}]`
}

const esc = (s) => String(s ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')
  .replace(/\r\n|\r|\n/g, '\\n')
  .replace(/\t/g, '\\t')

// A valid Swift identifier fragment from an arbitrary string.
const ident = (s, fallback = 'x') => {
  const out = String(s ?? '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('')
  return /^[A-Za-z_]/.test(out) ? out : fallback
}

const uiColorFrom = (hex, fallback = '#ffffff') => {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(hex || '').trim()) ||
            /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(fallback)
  if (!m) return 'UIColor.white'
  const r = parseInt(m[1].slice(0, 2), 16) / 255
  const g = parseInt(m[1].slice(2, 4), 16) / 255
  const b = parseInt(m[1].slice(4, 6), 16) / 255
  const a = m[2] ? parseInt(m[2], 16) / 255 : 1
  return `UIColor(red: ${f(r)}, green: ${f(g)}, blue: ${f(b)}, alpha: ${f(a)})`
}

// ---- planning --------------------------------------------------------

function entitiesUnder(hostId, items, acc = []) {
  for (const child of items.filter((it) => it.type === 'entity' && it.parentId === hostId)) {
    acc.push(child)
    entitiesUnder(child.id, items, acc)
  }
  return acc
}

const behaviorsOf = (entity) => (Array.isArray(entity.behaviors) ? entity.behaviors : [])

// Build everything the emitters need in one pass, so the caller can ask
// "is there anything to do?" before changing the shape of the scene setup.
export function planBehaviors(hostId, items) {
  const entities = entitiesUnder(hostId, items)
  const nameById = new Map(items.map((it) => [it.id, it.name]))

  const plan = {
    any: false,
    // entity id -> { input: bool, hover: bool } components to add
    componentsByEntity: new Map(),
    // one entry per behavior: { id, entity, trigger, actions, method }
    units: [],
    // trigger buckets for the view modifiers
    tap: [], doubleTap: [], longPress: [], drag: [], pinch: [], rotate: [],
    sceneStart: [], timers: [], events: [], collisions: [],
    // behaviours we describe rather than generate
    unsupported: [],
    needsToggleState: false,
    stats: { total: 0, generatedTriggers: 0, generatedActions: 0, documentedTriggers: 0, documentedActions: 0 }
  }

  let n = 0
  for (const entity of entities) {
    for (const b of behaviorsOf(entity)) {
      n += 1
      const trigger = b.trigger || {}
      const tType = trigger.type
      const actions = Array.isArray(b.actions) ? b.actions : []
      const unit = {
        id: b.id || `beh${n}`,
        method: `behavior${n}`,
        entity,
        trigger,
        actions,
        nameById
      }
      plan.stats.total += 1
      plan.units.push(unit)

      if (POINTER_TRIGGERS.has(tType)) {
        const cur = plan.componentsByEntity.get(entity.id) || { input: false, hover: false }
        if (tType === 'hover') cur.hover = true
        else cur.input = true
        plan.componentsByEntity.set(entity.id, cur)
      }

      if (!GENERATED_TRIGGERS.has(tType)) {
        plan.unsupported.push(unit)
        plan.stats.documentedTriggers += 1
        continue
      }
      plan.stats.generatedTriggers += 1

      const mode = trigger.params?.mode
      if (tType === 'tap') {
        if (mode === 'double') plan.doubleTap.push(unit)
        else if (mode === 'long') plan.longPress.push(unit)
        else plan.tap.push(unit)
      } else if (tType === 'drag') plan.drag.push(unit)
      else if (tType === 'pinch') plan.pinch.push(unit)
      else if (tType === 'rotateGesture') plan.rotate.push(unit)
      else if (tType === 'sceneStart') plan.sceneStart.push(unit)
      else if (tType === 'timer') plan.timers.push(unit)
      else if (tType === 'eventReceived') plan.events.push(unit)
      else if (tType === 'collision') plan.collisions.push(unit)

      for (const a of actions) {
        if (GENERATED_ACTIONS.has(a.type)) plan.stats.generatedActions += 1
        else plan.stats.documentedActions += 1
        if (a.params?.toggle) plan.needsToggleState = true
      }
    }
  }

  plan.any = plan.stats.total > 0
  return plan
}

// ---- content-closure components -------------------------------------

// Components a behaviour needs on its entity for the trigger to fire at all.
// A gesture against an entity with no InputTargetComponent and no collision
// shape silently never hits, which is the kind of bug that looks like the
// gesture code being wrong.
export function behaviorComponentLines(entity, varName, plan) {
  const need = plan.componentsByEntity.get(entity.id)
  if (!need) return []
  const out = []
  if (need.input) {
    out.push(`// Gesture target: input + collision are both required, or taps never hit.`)
    out.push(`${varName}.components.set(InputTargetComponent())`)
    out.push(`${varName}.generateCollisionShapes(recursive: true)`)
  }
  if (need.hover) {
    out.push(`${varName}.components.set(HoverEffectComponent())`)
  }
  return out
}

// ---- action emission -------------------------------------------------

// `target` params accept 'self', 'user' or an entity id.
function resolveTargetExpr(param, unit, notes) {
  if (!param || param === 'self') return 'entity'
  if (param === 'user') {
    notes.push('// Target "user" is the wearer. On visionOS, read the head pose from an')
    notes.push('// ARKitSession + WorldTrackingProvider queryDeviceAnchor(atTimestamp:).')
    return null
  }
  const name = unit.nameById.get(param)
  if (!name) return null
  return `sceneRoot.findEntity(named: "${esc(name)}")`
}

// Auto-reverse ("toggle") means: next time this trigger fires, snap back.
// The value to snap back TO is knowable at export time - it is whatever the
// designer authored on the entity - so each toggling action emits a single
// code path with a ternary rather than an if/else whose else branch would
// have nothing to put in it.
function authoredMaterialValue(entity, property) {
  const mat = Array.isArray(entity.materials) ? entity.materials[0] : null
  if (!mat) return null
  switch (property) {
    case 'emissionIntensity':
    case 'emissiveIntensity': return mat.emissiveIntensity ?? 0
    case 'roughness': return mat.roughness ?? 0.5
    case 'metallic': return mat.metallic ?? 0
    case 'opacity': return 1
    default: return null
  }
}

// One action -> Swift statements. Returns { lines, sleep } where `sleep` is
// the duration to wait before the next action so the chain stays sequential.
// `toggleVar` is the name of the Bool local when this action auto-reverses.
function emitAction(a, unit, push, toggleVar = null) {
  const p = a.params || {}
  const curve = CURVE_TO_SWIFT[p.curve] || '.easeOut'
  const dur = Number(p.duration) || 0
  const notes = []
  const relative = p.mode !== 'absolute'

  // Resolve a non-self target into a local, since every use needs unwrapping.
  const targetFor = (key = 'target') => {
    const raw = p[key]
    if (!raw || raw === 'self') return { expr: 'entity', pre: [] }
    const expr = resolveTargetExpr(raw, unit, notes)
    if (!expr) return null
    const local = `${ident(unit.nameById.get(raw) || 'target', 'target')}Target`
    return { expr: local, pre: [`guard let ${local} = ${expr} else { return }`] }
  }

  switch (a.type) {
    case 'moveTo': {
      const t = targetFor()
      if (!t) break
      for (const l of t.pre) push(l)
      const v = `move${ident(a.id || 'T', 'a')}`
      const delta = vec3(p.position)
      push(`var ${v} = ${t.expr}.transform`)
      if (!relative) {
        // Absolute: reverse is the pose the designer authored.
        const home = vec3(unit.entity.position)
        push(`${v}.translation = ${toggleVar ? `${toggleVar} ? ${delta} : ${home}` : delta}`)
      } else {
        push(`${v}.translation += ${toggleVar ? `(${toggleVar} ? ${delta} : -(${delta} as SIMD3<Float>))` : delta}`)
      }
      push(`${t.expr}.move(to: ${v}, relativeTo: ${t.expr}.parent, duration: ${f(dur)}, timingFunction: ${curve})`)
      return { sleep: dur }
    }

    case 'scaleTo': {
      const t = targetFor()
      if (!t) break
      for (const l of t.pre) push(l)
      const v = `scale${ident(a.id || 'T', 'a')}`
      const factor = f(p.value)
      push(`var ${v} = ${t.expr}.transform`)
      if (!relative) {
        const home = vec3(unit.entity.scale, [1, 1, 1])
        push(`${v}.scale = ${toggleVar ? `${toggleVar} ? [${factor}, ${factor}, ${factor}] : ${home}` : `[${factor}, ${factor}, ${factor}]`}`)
      } else {
        // Relative: the reverse of multiplying by n is dividing by n.
        push(`${v}.scale *= ${toggleVar ? `(${toggleVar} ? ${factor} : 1.0 / ${factor})` : factor}`)
      }
      push(`${t.expr}.move(to: ${v}, relativeTo: ${t.expr}.parent, duration: ${f(dur)}, timingFunction: ${curve})`)
      return { sleep: dur }
    }

    case 'rotateTo': {
      const t = targetFor()
      if (!t) break
      for (const l of t.pre) push(l)
      const r = Array.isArray(p.rotation) ? p.rotation : [0, 0, 0]
      const v = `rotate${ident(a.id || 'T', 'a')}`
      const quatFor = (angles) => {
        const parts = []
        if (angles[1]) parts.push(`simd_quatf(angle: ${f(angles[1] * Math.PI / 180)}, axis: [0, 1, 0])`)
        if (angles[0]) parts.push(`simd_quatf(angle: ${f(angles[0] * Math.PI / 180)}, axis: [1, 0, 0])`)
        if (angles[2]) parts.push(`simd_quatf(angle: ${f(angles[2] * Math.PI / 180)}, axis: [0, 0, 1])`)
        return parts.length ? parts.join(' * ') : 'simd_quatf(angle: 0.0, axis: [0, 1, 0])'
      }
      const q = quatFor(r)
      push(`var ${v} = ${t.expr}.transform`)
      if (!relative) {
        const home = quatFor(Array.isArray(unit.entity.rotation) ? unit.entity.rotation : [0, 0, 0])
        push(`${v}.rotation = ${toggleVar ? `${toggleVar} ? (${q}) : (${home})` : `(${q})`}`)
      } else {
        // Relative: the reverse of a rotation is its conjugate.
        const step = toggleVar ? `(${toggleVar} ? (${q}) : (${q}).conjugate)` : `(${q})`
        push(`${v}.rotation = ${v}.rotation * ${step}`)
      }
      push(`${t.expr}.move(to: ${v}, relativeTo: ${t.expr}.parent, duration: ${f(dur)}, timingFunction: ${curve})`)
      return { sleep: dur }
    }

    case 'showHide': {
      const t = targetFor()
      if (!t) break
      for (const l of t.pre) push(l)
      if (p.mode === 'toggle') push(`${t.expr}.isEnabled.toggle()`)
      else push(`${t.expr}.isEnabled = ${p.mode === 'hide' ? 'false' : 'true'}`)
      if (p.fade) {
        push(`// Fade requested. For a cross-fade, animate OpacityComponent instead`)
        push(`// of flipping isEnabled: ${t.expr}.components.set(OpacityComponent(opacity: 0))`)
      }
      return { sleep: 0 }
    }

    case 'destroy': {
      const t = targetFor()
      if (!t) break
      for (const l of t.pre) push(l)
      push(`${t.expr}.removeFromParent()`)
      return { sleep: 0 }
    }

    case 'broadcast': {
      push(`NotificationCenter.default.post(name: Notification.Name("${esc(p.name || 'event')}"), object: nil)`)
      return { sleep: 0 }
    }

    case 'wait': {
      const secs = Number(p.seconds) || 0
      push(`try? await Task.sleep(for: .seconds(${f(secs)}))`)
      return { sleep: 0 }
    }

    case 'lookAt': {
      const t = targetFor()
      if (!t) break
      for (const l of t.pre) push(l)
      if (p.target === 'user' || !p.target) {
        push(`// Continuous look-at needs a per-frame System. This orients once toward`)
        push(`// the wearer's last known position; swap in a queried device anchor.`)
      }
      push(`entity.look(at: ${t.expr}.position(relativeTo: nil), from: entity.position(relativeTo: nil), relativeTo: nil)`)
      return { sleep: 0 }
    }

    case 'playAnimation': {
      const t = targetFor()
      if (!t) break
      for (const l of t.pre) push(l)
      const clip = p.clip
      if (clip) {
        push(`if let clip = ${t.expr}.availableAnimations.first(where: { $0.name == "${esc(clip)}" }) {`)
        push(`    ${t.expr}.playAnimation(clip.repeat(count: 1), transitionDuration: 0.2)`)
        push(`}`)
      } else {
        push(`if let clip = ${t.expr}.availableAnimations.first {`)
        push(`    ${t.expr}.playAnimation(clip.repeat(count: 1), transitionDuration: 0.2)`)
        push(`}`)
      }
      return { sleep: 0 }
    }

    case 'setMaterial': {
      const t = targetFor()
      if (!t) break
      for (const l of t.pre) push(l)
      const prop = p.property || 'color'
      // Auto-reverse snaps back to the value authored on the entity, which we
      // know here, so the toggle is a ternary rather than a second branch.
      const home = authoredMaterialValue(unit.entity, prop)
      const num = (v) => (toggleVar && home !== null
        ? `(${toggleVar} ? ${f(v)} : ${f(home)})`
        : f(v))
      push(`if var model = ${t.expr}.components[ModelComponent.self] {`)
      push(`    model.materials = model.materials.map { existing in`)
      push(`        guard var pbr = existing as? PhysicallyBasedMaterial else { return existing }`)
      if (prop === 'color' || prop === 'baseColor') {
        const homeColor = Array.isArray(unit.entity.materials) ? unit.entity.materials[0]?.baseColor : null
        const tint = toggleVar && homeColor
          ? `(${toggleVar} ? ${uiColorFrom(p.colorValue)} : ${uiColorFrom(homeColor)})`
          : uiColorFrom(p.colorValue)
        push(`        pbr.baseColor = .init(tint: ${tint})`)
      } else if (prop === 'emissionIntensity' || prop === 'emissiveIntensity') {
        push(`        pbr.emissiveColor = .init(color: ${uiColorFrom(p.colorValue)})`)
        push(`        pbr.emissiveIntensity = ${num(p.numberValue ?? 1)}`)
      } else if (prop === 'roughness') {
        push(`        pbr.roughness = ${num(p.numberValue ?? 0.5)}`)
      } else if (prop === 'metallic') {
        push(`        pbr.metallic = ${num(p.numberValue ?? 0)}`)
      } else if (prop === 'opacity') {
        push(`        pbr.blending = .transparent(opacity: .init(floatLiteral: ${num(p.numberValue ?? 1)}))`)
      } else {
        push(`        // Material property "${esc(prop)}" has no direct PhysicallyBasedMaterial field.`)
      }
      push(`        return pbr`)
      push(`    }`)
      push(`    ${t.expr}.components.set(model)`)
      push(`}`)
      if (dur > 0) {
        push(`// Set instantly. PhysicallyBasedMaterial properties are not animatable by`)
        push(`// move(to:); for a ${f(dur)}s ramp, drive it from a per-frame System or use a`)
        push(`// ShaderGraphMaterial parameter.`)
      }
      return { sleep: 0 }
    }

    case 'spawn': {
      const src = p.template && p.template !== 'self'
        ? resolveTargetExpr(p.template, unit, notes)
        : 'entity'
      if (!src) break
      const count = Math.max(1, Number(p.count) || 1)
      push(`// Spawn ${count} clone(s)`)
      if (src !== 'entity') push(`guard let spawnSource = ${src} else { return }`)
      const srcVar = src === 'entity' ? 'entity' : 'spawnSource'
      push(`for i in 0..<${count} {`)
      push(`    let clone = ${srcVar}.clone(recursive: true)`)
      push(`    clone.name = "\\(${srcVar}.name) Clone \\(i)"`)
      push(`    ${srcVar}.parent?.addChild(clone)`)
      if (Number(p.stagger) > 0) {
        push(`    try? await Task.sleep(for: .seconds(${f(p.stagger)}))`)
      }
      push(`}`)
      return { sleep: 0 }
    }

    default:
      break
  }

  // Not generated: say what to reach for instead of emitting something wrong.
  for (const l of notes) push(l)
  const why = {
    follow: 'needs a per-frame System that updates position toward the target each tick',
    orbit: 'needs a per-frame System that advances an angle each tick',
    shaderEffect: 'needs a ShaderGraphMaterial authored in Reality Composer Pro',
    repeat: 'loops the enclosing behaviour, which is per-behaviour state rather than a statement here'
  }[a.type] || 'has no direct RealityKit equivalent'
  push(`// DO ${a.type}: ${why}.`)
  const args = Object.entries(p)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(', ')
  if (args) push(`//    configured as ${args}`)
  return { sleep: 0 }
}

// ---- method bodies ---------------------------------------------------

// `entityParam` is true when the method receives the triggering entity (the
// gesture handlers); otherwise it resolves its own entity by name.
function emitMethod(unit, pad, out) {
  const ind = '    '.repeat(pad)
  const push = (l) => out.push(l === '' ? '' : `${ind}${l}`)
  const inner = (l) => out.push(l === '' ? '' : `${ind}    ${l}`)
  const t = unit.trigger
  const fromGesture = POINTER_TRIGGERS.has(t.type) || t.type === 'collision'

  push('')
  push(`// ${t.type}${t.params?.mode ? ` (${t.params.mode})` : ''} on "${esc(unit.entity.name)}"`)
  if (fromGesture) {
    push(`private func ${unit.method}(_ entity: Entity) async {`)
  } else {
    push(`private func ${unit.method}() async {`)
    inner(`guard let entity = sceneRoot.findEntity(named: "${esc(unit.entity.name)}") else { return }`)
  }

  if (unit.actions.length === 0) {
    inner(`// No actions configured.`)
  }

  // Auto-reverse: one Bool per toggling action, carried across invocations so
  // the next fire snaps back. The action emitters fold it into a ternary, so
  // there is exactly one code path per action.
  const toggles = unit.actions.filter((a) => a.params?.toggle)
  for (const a of toggles) {
    const v = `${ident(a.id, 'tog')}On`
    inner(`// Auto-reverse: alternates between the configured value and the authored one.`)
    inner(`let ${v} = !(toggleState["${esc(a.id)}"] ?? false)`)
    inner(`toggleState["${esc(a.id)}"] = ${v}`)
  }

  for (const a of unit.actions) {
    const toggleVar = a.params?.toggle ? `${ident(a.id, 'tog')}On` : null
    const res = emitAction(a, unit, inner, toggleVar)
    if (res && res.sleep > 0) {
      inner(`try? await Task.sleep(for: .seconds(${f(res.sleep)}))`)
    }
  }

  push(`}`)
}

// ---- public emitters -------------------------------------------------

export function behaviorStateDecls(plan) {
  if (!plan.any) return []
  const out = [
    `    // Scene root, so behaviour methods can resolve entities by name after`,
    `    // the RealityView closure has returned. Names are unique per tab.`,
    `    @State private var sceneRoot = Entity()`
  ]
  if (plan.needsToggleState) {
    out.push(`    // Auto-reverse state, keyed by action id.`)
    out.push(`    @State private var toggleState: [String: Bool] = [:]`)
  }
  return out
}

// Gesture / lifecycle / subscription modifiers, appended after the
// RealityView's closing brace.
export function emitBehaviorModifiers(plan, pad, out) {
  if (!plan.any) return
  const ind = `${'    '.repeat(pad)}    `

  const gestureBlock = (units, gestureExpr, handler, comment) => {
    if (units.length === 0) return
    out.push(`${ind}// ${comment}`)
    out.push(`${ind}.gesture(`)
    out.push(`${ind}    ${gestureExpr}`)
    out.push(`${ind}        .targetedToAnyEntity()`)
    out.push(`${ind}        .onEnded { value in`)
    out.push(`${ind}            ${handler}(value.entity)`)
    out.push(`${ind}        }`)
    out.push(`${ind})`)
  }

  gestureBlock(plan.tap, 'SpatialTapGesture()', 'handleTap', 'Single tap')
  gestureBlock(plan.doubleTap, 'SpatialTapGesture(count: 2)', 'handleDoubleTap', 'Double tap')
  gestureBlock(plan.longPress, 'LongPressGesture()', 'handleLongPress', 'Long press')
  gestureBlock(plan.drag, 'DragGesture()', 'handleDrag', 'Drag')
  gestureBlock(plan.pinch, 'MagnifyGesture()', 'handlePinch', 'Pinch / magnify')
  gestureBlock(plan.rotate, 'RotateGesture3D()', 'handleRotate', 'Two-handed rotate')

  if (plan.sceneStart.length > 0) {
    out.push(`${ind}.task {`)
    for (const u of plan.sceneStart) out.push(`${ind}    await ${u.method}()`)
    out.push(`${ind}}`)
  }

  for (const u of plan.timers) {
    const secs = Number(u.trigger.params?.seconds) || 1
    const loop = u.trigger.params?.mode === 'loop'
    out.push(`${ind}// Timer on "${esc(u.entity.name)}": ${loop ? `every ${f(secs)}s` : `once after ${f(secs)}s`}`)
    out.push(`${ind}.task {`)
    if (loop) {
      // Fires immediately, then on the interval, matching the canvas runtime.
      out.push(`${ind}    while !Task.isCancelled {`)
      out.push(`${ind}        await ${u.method}()`)
      out.push(`${ind}        try? await Task.sleep(for: .seconds(${f(secs)}))`)
      out.push(`${ind}    }`)
    } else {
      out.push(`${ind}    try? await Task.sleep(for: .seconds(${f(secs)}))`)
      out.push(`${ind}    await ${u.method}()`)
    }
    out.push(`${ind}}`)
  }

  for (const u of plan.events) {
    const name = u.trigger.params?.name || 'event'
    out.push(`${ind}.onReceive(NotificationCenter.default.publisher(for: Notification.Name("${esc(name)}"))) { _ in`)
    out.push(`${ind}    Task { await ${u.method}() }`)
    out.push(`${ind}}`)
  }
}

// Collision subscriptions live inside the content closure, because that is
// where `content` is in scope.
export function emitCollisionSubscriptions(plan, varNameFor, push) {
  for (const u of plan.collisions) {
    const varName = varNameFor(u.entity.id)
    if (!varName) continue
    const began = (u.trigger.params?.mode || 'began') === 'began'
    const eventType = began ? 'CollisionEvents.Began' : 'CollisionEvents.Ended'
    push(`// Collision ${began ? 'began' : 'ended'} on "${esc(u.entity.name)}"`)
    push(`${varName}.generateCollisionShapes(recursive: true)`)
    push(`_ = content.subscribe(to: ${eventType}.self, on: ${varName}) { event in`)
    push(`    Task { await ${u.method}(event.entityA) }`)
    push(`}`)
  }
}

// The generated methods, plus the dispatch switches for gesture handlers.
export function emitBehaviorMethods(plan, pad, out) {
  if (!plan.any) return
  const ind = '    '.repeat(pad)

  out.push('')
  out.push(`${ind}// MARK: - Behaviors`)

  // Group by entity name. Two behaviours on the same entity must BOTH fire;
  // emitting one `case` per behaviour would leave the second unreachable, so
  // the entity gets one case that spawns every matching behaviour. Separate
  // Tasks rather than sequential awaits, so a long animation in the first does
  // not delay the second - matching how the canvas runtime fires them.
  const dispatch = (units, handler) => {
    if (units.length === 0) return
    const byEntity = new Map()
    for (const u of units) {
      const key = u.entity.name
      if (!byEntity.has(key)) byEntity.set(key, [])
      byEntity.get(key).push(u)
    }
    out.push('')
    out.push(`${ind}private func ${handler}(_ entity: Entity) {`)
    out.push(`${ind}    switch entity.name {`)
    for (const [name, group] of byEntity) {
      out.push(`${ind}    case "${esc(name)}":`)
      for (const u of group) out.push(`${ind}        Task { await ${u.method}(entity) }`)
    }
    out.push(`${ind}    default: break`)
    out.push(`${ind}    }`)
    out.push(`${ind}}`)
  }

  dispatch(plan.tap, 'handleTap')
  dispatch(plan.doubleTap, 'handleDoubleTap')
  dispatch(plan.longPress, 'handleLongPress')
  dispatch(plan.drag, 'handleDrag')
  dispatch(plan.pinch, 'handlePinch')
  dispatch(plan.rotate, 'handleRotate')

  for (const u of plan.units) {
    if (plan.unsupported.includes(u)) continue
    emitMethod(u, pad, out)
  }

  // Triggers we describe rather than generate, each naming its real API.
  if (plan.unsupported.length > 0) {
    out.push('')
    out.push(`${ind}// MARK: - Behaviors still to wire up`)
    out.push(`${ind}//`)
    for (const u of plan.unsupported) {
      const t = u.trigger
      const how = {
        hover: 'HoverEffectComponent is already attached for the visual. For logic, drive it from a SpatialEventGesture or a hover-aware ShaderGraphMaterial parameter.',
        proximity: 'Register a System and compare distances in its update(context:), or subscribe to SceneEvents.Update.',
        inView: 'Register a System and compare the entity direction against the device anchor forward vector.',
        animationFinished: 'Subscribe to AnimationEvents.PlaybackCompleted for the playback controller you started.'
      }[t.type] || 'No direct RealityKit equivalent.'
      out.push(`${ind}// "${esc(u.entity.name)}" - WHEN ${t.type}${t.params?.mode ? ` (${t.params.mode})` : ''}`)
      out.push(`${ind}//   ${how}`)
      for (const a of u.actions) {
        out.push(`${ind}//   DO ${a.type}`)
      }
    }
  }
}
