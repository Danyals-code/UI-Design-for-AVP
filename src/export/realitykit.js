// RealityKit exporter — the entity half of the scene graph.
//
// The SwiftUI exporter walks tabs, windows, stacks and panels. Entities
// (`type: 'entity'`) live in the same flat `items` array but form their own
// subtree, and until now nothing emitted them: every volume template
// exported an empty `ZStack { }`, discarding 16 to 27 entities per scene.
// This module fills that gap.
//
// Two hosts can own entities, and both route here:
//   • a volumetric window (the window IS the RealityView)
//   • a `realityview` panel sitting in a SwiftUI tree
//
// Output shape. Entities are created as locals, parented with `addChild`,
// and roots handed to `content.add`. Attachments are the exception: a
// SwiftUI view cannot be constructed inside the content closure, so each
// one is declared in the trailing `attachments:` builder and resolved back
// by id. That is why the two-parameter closure form appears only when the
// subtree actually contains an attachment.
//
//     RealityView { content, attachments in
//         let anchor1 = AnchorEntity(.world(transform: matrix_identity_float4x4))
//         content.add(anchor1)
//         let sun2 = ModelEntity(mesh: .generateSphere(radius: 0.06), materials: [material2])
//         anchor1.addChild(sun2)
//     } attachments: {
//         Attachment(id: "label3") { Text("Sun") }
//     }
//
// Units. The canvas is metres-native for entities, which is also
// RealityKit's unit, so transforms pass through unconverted. Attachment
// padding is the exception: it is stored in metres and SwiftUI wants
// points, so it goes through `metersToPt`.
//
// Scope. Static scene construction lives here: kinds, transforms, meshes,
// materials, visual components, lights and attachments. Behaviour codegen
// lives in ./behaviors.js, because gestures and lifecycle hooks are view
// modifiers rather than closure statements; this module calls its
// content-closure pieces and returns the plan for the caller to finish.

import {
  ATTACHMENT_KINDS,
  COMPONENT_TYPE_ORDER
} from '../realityKit/registry'
import { resolveAttachmentStyle, metersToPt } from '../appleSystem'
import {
  planBehaviors, behaviorComponentLines, emitCollisionSubscriptions
} from './behaviors'

// ---- small helpers ---------------------------------------------------

const f = (n) => {
  const v = Number(n) || 0
  // Swift infers Double from `0.5`; SIMD3<Float> and the component inits
  // want Float. Whole numbers still need a decimal point so the literal
  // reads as floating point rather than Int.
  return Number.isInteger(v) ? `${v}.0` : String(Number(v.toFixed(6)))
}

const vec3 = (a, fallback = [0, 0, 0]) => {
  const v = Array.isArray(a) ? a : fallback
  return `[${f(v[0])}, ${f(v[1])}, ${f(v[2])}]`
}

// Swift string-literal escaping. Newlines matter as much as quotes here:
// attachment copy is frequently multi-line ("Mercury\n4,879 km"), and a raw
// newline would split the literal across two lines, which does not compile.
const esc = (s) => String(s ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')
  .replace(/\r\n|\r|\n/g, '\\n')
  .replace(/\t/g, '\\t')

const DEG2RAD = Math.PI / 180

// UIColor from a #rrggbb or #rrggbbaa hex. RealityKit's material inits and
// light components take UIColor on visionOS.
function uiColor(hex, fallback = '#ffffff') {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(hex || '').trim()) ||
            /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(fallback)
  if (!m) return 'UIColor.white'
  const r = parseInt(m[1].slice(0, 2), 16) / 255
  const g = parseInt(m[1].slice(2, 4), 16) / 255
  const b = parseInt(m[1].slice(4, 6), 16) / 255
  const a = m[2] ? parseInt(m[2], 16) / 255 : 1
  return `UIColor(red: ${f(r)}, green: ${f(g)}, blue: ${f(b)}, alpha: ${f(a)})`
}

// SwiftUI Color, for attachment views.
function swiftUIColor(hex, fallback = '#ffffff') {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(hex || '').trim()) ||
            /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(fallback)
  if (!m) return 'Color.white'
  const r = parseInt(m[1].slice(0, 2), 16) / 255
  const g = parseInt(m[1].slice(2, 4), 16) / 255
  const b = parseInt(m[1].slice(4, 6), 16) / 255
  const a = m[2] ? parseInt(m[2], 16) / 255 : 1
  const base = `Color(red: ${f(r)}, green: ${f(g)}, blue: ${f(b)})`
  return a < 1 ? `${base}.opacity(${f(a)})` : base
}

// Unique, valid Swift identifier per entity, seeded from its name so the
// generated source is readable rather than a wall of `entity7`.
function makeNamer() {
  const used = new Set()
  let n = 0
  return (entity) => {
    n += 1
    let base = String(entity.name || entity.entityKind || 'entity')
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
      .join('')
    if (!base || !/^[A-Za-z_]/.test(base)) base = 'entity'
    let name = `${base}${n}`
    while (used.has(name)) { n += 1; name = `${base}${n}` }
    used.add(name)
    return name
  }
}

// ---- meshes ----------------------------------------------------------

// Returns { setup: string[], expr: string | null }. `expr` is null for
// kinds that are not a MeshResource at all (usdz loads a whole Entity).
function meshFor(entity, varName) {
  const t = entity.meshType || 'box'
  switch (t) {
    case 'box': {
      const s = Array.isArray(entity.boxSize) ? entity.boxSize : [0.1, 0.1, 0.1]
      return { setup: [], expr: `.generateBox(size: ${vec3(s)}, cornerRadius: ${f(entity.boxCornerRadius || 0)})` }
    }
    case 'sphere':
      return { setup: [], expr: `.generateSphere(radius: ${f(entity.sphereRadius ?? 0.05)})` }
    case 'cylinder':
      return { setup: [], expr: `.generateCylinder(height: ${f(entity.cylinderHeight ?? 0.1)}, radius: ${f(entity.cylinderRadius ?? 0.05)})` }
    case 'cone':
      return { setup: [], expr: `.generateCone(height: ${f(entity.coneHeight ?? 0.1)}, radius: ${f(entity.coneRadius ?? 0.05)})` }
    case 'plane':
      return { setup: [], expr: `.generatePlane(width: ${f(entity.planeWidth ?? 0.1)}, depth: ${f(entity.planeDepth ?? 0.1)}, cornerRadius: ${f(entity.planeCornerRadius || 0)})` }
    case 'text': {
      const frame = Array.isArray(entity.textContainerFrame) ? entity.textContainerFrame : [0.5, 0.2]
      const align = { left: 'left', center: 'center', right: 'right' }[entity.textAlignment || 'center'] || 'center'
      const lbm = {
        wordWrap: 'byWordWrapping',
        charWrap: 'byCharWrapping',
        truncatingTail: 'byTruncatingTail',
        truncatingHead: 'byTruncatingHead',
        truncatingMiddle: 'byTruncatingMiddle'
      }[entity.textLineBreakMode || 'wordWrap'] || 'byWordWrapping'
      const fontPt = metersToPt(entity.textFontSize ?? 0.05)
      const setup = [
        `let ${varName}Frame = CGRect(x: 0, y: 0, width: ${f(metersToPt(frame[0]))}, height: ${f(metersToPt(frame[1]))})`
      ]
      return {
        setup,
        expr: `.generateText(` +
          `"${esc(entity.textValue || 'Hello')}", ` +
          `extrusionDepth: ${f(entity.textExtrusionDepth ?? 0.005)}, ` +
          `font: .systemFont(ofSize: ${f(fontPt)}), ` +
          `containerFrame: ${varName}Frame, ` +
          `alignment: .${align}, ` +
          `lineBreakMode: .${lbm})`
      }
    }
    case 'usdz':
      return { setup: [], expr: null }
    default:
      return { setup: [], expr: `.generateBox(size: [0.1, 0.1, 0.1], cornerRadius: 0.0)` }
  }
}

// ---- materials -------------------------------------------------------

// Returns { setup: string[], expr: string }.
function materialFor(mat, varName) {
  const type = mat?.type || 'simple'
  switch (type) {
    case 'simple':
      return {
        setup: [],
        expr: `SimpleMaterial(color: ${uiColor(mat.baseColor)}, roughness: ${f(mat.roughness ?? 0.5)}, isMetallic: ${mat.isMetallic ? 'true' : 'false'})`
      }

    case 'unlit':
      return { setup: [], expr: `UnlitMaterial(color: ${uiColor(mat.unlitColor)})` }

    case 'occlusion':
      return { setup: [], expr: `OcclusionMaterial()` }

    case 'portal':
      return { setup: [], expr: `PortalMaterial()` }

    case 'physicallyBased': {
      const s = [`var ${varName} = PhysicallyBasedMaterial()`]
      s.push(`${varName}.baseColor = .init(tint: ${uiColor(mat.baseColor)})`)
      s.push(`${varName}.roughness = ${f(mat.roughness ?? 0.5)}`)
      s.push(`${varName}.metallic = ${f(mat.metallic ?? 0)}`)
      const emissive = String(mat.emissiveColor || '#000000').toLowerCase()
      if ((mat.emissiveIntensity ?? 0) > 0 && emissive !== '#000000') {
        s.push(`${varName}.emissiveColor = .init(color: ${uiColor(mat.emissiveColor)})`)
        s.push(`${varName}.emissiveIntensity = ${f(mat.emissiveIntensity)}`)
      }
      if ((mat.clearcoat ?? 0) > 0) {
        s.push(`${varName}.clearcoat = ${f(mat.clearcoat)}`)
        s.push(`${varName}.clearcoatRoughness = ${f(mat.clearcoatRoughness ?? 0)}`)
      }
      const sheen = String(mat.sheenColor || '#000000').toLowerCase()
      if (sheen !== '#000000') {
        s.push(`${varName}.sheen = .init(tint: ${uiColor(mat.sheenColor)})`)
      }
      if (mat.blending === 'transparent') {
        s.push(`${varName}.blending = .transparent(opacity: 1.0)`)
      }
      if (mat.faceCulling && mat.faceCulling !== 'back') {
        s.push(`${varName}.faceCulling = .${mat.faceCulling}`)
      }
      return { setup: s, expr: varName }
    }

    case 'video':
      // VideoMaterial needs a live AVPlayer, which cannot be built as a
      // synchronous expression inside the content closure. Emit the recipe
      // and a stand-in so the file still compiles.
      return {
        setup: [
          `// "${esc(mat.videoAssetName || 'video')}" is a VideoMaterial. Wire it up with your asset:`,
          `//   import AVFoundation`,
          `//   let player = AVPlayer(url: Bundle.main.url(forResource: "${esc(mat.videoAssetName || 'video')}", withExtension: "mp4")!)`,
          `//   let ${varName} = VideoMaterial(avPlayer: player)`,
          `//   player.play()`
        ],
        expr: `SimpleMaterial(color: .darkGray, isMetallic: false)`
      }

    case 'shaderGraph':
      // ShaderGraphMaterial(named:from:) is async throwing, so it belongs in
      // a task rather than here.
      return {
        setup: [
          `// "${esc(mat.shaderGraphAssetName || 'Material')}" is a Reality Composer Pro shader graph.`,
          `// Load it asynchronously, then assign to the model component:`,
          `//   let ${varName} = try await ShaderGraphMaterial(named: "${esc(mat.shaderGraphAssetName || 'Material')}", from: "${esc(mat.shaderGraphFromBundle || 'main')}")`
        ],
        expr: `SimpleMaterial(color: .gray, isMetallic: false)`
      }

    default:
      return { setup: [], expr: `SimpleMaterial(color: .white, isMetallic: false)` }
  }
}

// ---- anchors ---------------------------------------------------------

function anchorTargetExpr(entity, notes) {
  switch (entity.anchorTarget || 'world') {
    case 'head':
      return '.head'
    case 'hand': {
      // RealityKit takes a single chirality; 'either' has no direct
      // equivalent, so it resolves to the left hand and says so.
      const c = entity.handChirality || 'right'
      if (c === 'either') notes.push('// Anchor chirality "either" has no RealityKit equivalent; using .left.')
      const chirality = c === 'right' ? 'right' : 'left'
      return `.hand(.${chirality}, location: .${entity.handLocation || 'palm'})`
    }
    case 'plane': {
      const bounds = Array.isArray(entity.planeMinimumBounds) ? entity.planeMinimumBounds : [0.1, 0.1]
      return `.plane(.${entity.planeAlignment || 'horizontal'}, ` +
             `classification: .${entity.planeClassification || 'any'}, ` +
             `minimumBounds: [${f(bounds[0])}, ${f(bounds[1])}])`
    }
    case 'image':
      return `.image(group: "${esc(entity.imageGroup || 'AR Resources')}", name: "${esc(entity.imageName || '')}")`
    case 'object':
      // visionOS tracks reference objects through ARKit's
      // ObjectTrackingProvider, not through an AnchorEntity target, so a
      // world anchor plus a pointer to the real API is the honest output.
      notes.push(`// "${esc(entity.objectName || '')}" is an object anchor. On visionOS, drive it with`)
      notes.push('// ARKitSession + ObjectTrackingProvider and set this entity\'s transform from the')
      notes.push('// tracked anchor; AnchorEntity has no object target.')
      return '.world(transform: matrix_identity_float4x4)'
    default:
      return '.world(transform: matrix_identity_float4x4)'
  }
}

// ---- lights ----------------------------------------------------------

// Our intensity is a diorama-scale 0-10 dial; RealityKit's light
// components are in lumens/lux, which run in the thousands.
const LIGHT_INTENSITY_SCALE = 1000

function lightComponentExpr(entity, notes) {
  const color = uiColor(entity.lightColor)
  const intensity = f((entity.lightIntensity ?? 1) * LIGHT_INTENSITY_SCALE)
  switch (entity.lightType || 'point') {
    case 'spot':
      return `SpotLightComponent(color: ${color}, intensity: ${intensity}, ` +
             `innerAngleInDegrees: ${f(entity.lightInnerAngle ?? 30)}, ` +
             `outerAngleInDegrees: ${f(entity.lightOuterAngle ?? 45)}, ` +
             `attenuationRadius: ${f(entity.lightRange ?? 3)})`
    case 'directional':
      return `DirectionalLightComponent(color: ${color}, intensity: ${intensity})`
    case 'ibl':
      notes.push('// An image-based light needs an EnvironmentResource loaded asynchronously:')
      notes.push('//   let resource = try await EnvironmentResource(named: "YourHDRI")')
      notes.push('//   entity.components.set(ImageBasedLightComponent(source: .single(resource)))')
      return null
    default:
      return `PointLightComponent(color: ${color}, intensity: ${intensity}, ` +
             `attenuationRadius: ${f(entity.lightRange ?? 3)})`
  }
}

// ---- visual components ----------------------------------------------

function componentLines(entity, varName) {
  const out = []
  const comps = entity.components || {}
  for (const key of COMPONENT_TYPE_ORDER) {
    const c = comps[key]
    if (!c || !c.enabled) continue
    if (key === 'groundingShadow') {
      out.push(`${varName}.components.set(GroundingShadowComponent(castsShadow: ${c.castsShadow ? 'true' : 'false'}))`)
    } else if (key === 'opacity') {
      out.push(`${varName}.components.set(OpacityComponent(opacity: ${f(c.value ?? 1)}))`)
    } else if (key === 'imageBasedLight') {
      out.push(`// Image-based light on "${esc(entity.name)}" needs an async EnvironmentResource:`)
      out.push(`//   let resource = try await EnvironmentResource(named: "${esc(c.resourceName || 'YourHDRI')}")`)
      out.push(`//   ${varName}.components.set(ImageBasedLightComponent(source: .single(resource)))`)
    } else if (key === 'imageBasedLightReceiver') {
      out.push(`// IBL receiver: point this at the entity that carries the ImageBasedLightComponent.`)
      out.push(`//   ${varName}.components.set(ImageBasedLightReceiverComponent(imageBasedLight: iblEntity))`)
    }
  }
  return out
}

// ---- transform -------------------------------------------------------

function transformLines(entity, varName) {
  const out = []
  const p = Array.isArray(entity.position) ? entity.position : [0, 0, 0]
  if (p[0] || p[1] || p[2]) out.push(`${varName}.position = ${vec3(p)}`)

  const r = Array.isArray(entity.rotation) ? entity.rotation : [0, 0, 0]
  if (r[0] || r[1] || r[2]) {
    // Composed in the same YXZ order the canvas uses, so the exported pose
    // matches what the designer saw. Quaternions multiply right-to-left, so
    // yaw is written first and applied last.
    const parts = []
    if (r[1]) parts.push(`simd_quatf(angle: ${f(r[1] * DEG2RAD)}, axis: [0, 1, 0])`)
    if (r[0]) parts.push(`simd_quatf(angle: ${f(r[0] * DEG2RAD)}, axis: [1, 0, 0])`)
    if (r[2]) parts.push(`simd_quatf(angle: ${f(r[2] * DEG2RAD)}, axis: [0, 0, 1])`)
    out.push(`${varName}.orientation = ${parts.join(' * ')}`)
  }

  const s = Array.isArray(entity.scale) ? entity.scale : [1, 1, 1]
  if (s[0] !== 1 || s[1] !== 1 || s[2] !== 1) out.push(`${varName}.scale = ${vec3(s, [1, 1, 1])}`)

  if (entity.visible === false) {
    out.push(`${varName}.isEnabled = false`)
  }
  return out
}

// ---- attachments -----------------------------------------------------

// The SwiftUI view for one attachment, as lines for the `attachments:`
// builder. Sizing comes from the shared ATTACHMENT_TEXT_STYLES ramp so the
// exported chip matches the canvas.
function attachmentViewLines(entity, _attachId) {
  const style = resolveAttachmentStyle(entity)
  const kind = entity.attachmentKind || 'text'
  const label = esc(entity.attachmentText || ATTACHMENT_KINDS[kind]?.defaults?.attachmentText || '')
  const fg = swiftUIColor(entity.attachmentColor, '#ffffff')
  const bg = swiftUIColor(entity.attachmentBackground, '#1c1c1e')
  const styleKey = entity.attachmentTextStyle || 'body'
  const hPad = Math.round(metersToPt(style.hPadding))
  const vPad = Math.round(metersToPt(style.vPadding))
  const radius = Math.round(metersToPt(style.cornerRadius))
  const shape = (entity.attachmentShape || 'roundedRect') === 'capsule'
    ? '.capsule'
    : `.rect(cornerRadius: ${radius})`

  const body = []
  if (kind === 'label') {
    body.push(`Label("${label}", systemImage: "${esc(entity.attachmentSymbol || 'info.circle')}")`)
  } else if (kind === 'button') {
    body.push(`Button("${label}") {`)
    body.push(`    // Wire this to your app's action.`)
    body.push(`}`)
  } else if (kind === 'image') {
    const url = entity.attachmentImageUrl || ''
    const side = Math.round(metersToPt(entity.attachmentSize ?? 0.2))
    if (/^https?:/i.test(url)) {
      body.push(`AsyncImage(url: URL(string: "${esc(url)}"))`)
    } else {
      body.push(`Image("${esc(url || 'Placeholder')}")`)
      body.push(`    .resizable()`)
      body.push(`    .scaledToFill()`)
    }
    body.push(`    .frame(width: ${side}, height: ${side})`)
    body.push(`    .clipShape(${shape})`)
    return { lines: body, isImage: true }
  } else {
    body.push(`Text("${label}")`)
  }

  if (kind !== 'button') body.push(`    .font(.${styleKey})`)
  body.push(`    .foregroundStyle(${fg})`)
  body.push(`    .padding(.horizontal, ${hPad})`)
  body.push(`    .padding(.vertical, ${vPad})`)
  body.push(`    .background(${bg}, in: ${shape})`)
  return { lines: body, isImage: false }
}

// ---- behaviors -------------------------------------------------------
//
// Behaviour codegen lives in ./behaviors.js. It needs view scope (gesture
// modifiers, @State, methods), so this module only calls its content-closure
// pieces and hands the plan back to the caller.

// ---- public API ------------------------------------------------------

export function entityChildrenOf(hostId, items) {
  return items.filter((it) => it.type === 'entity' && it.parentId === hostId)
}

export function hasEntityChildren(hostId, items) {
  return entityChildrenOf(hostId, items).length > 0
}

// Every attachment entity in the subtree rooted at `hostId`, in document
// order. Used to decide the closure form before emitting anything.
function collectAttachments(hostId, items, acc = []) {
  for (const child of items.filter((it) => it.type === 'entity' && it.parentId === hostId)) {
    if (child.entityKind === 'attachment') acc.push(child)
    collectAttachments(child.id, items, acc)
  }
  return acc
}

// Emit the whole `RealityView { ... }` block for the entities under
// `hostId`. Returns the behavior plan (so the caller can emit the gesture
// modifiers and methods that belong at view scope), or null when there are
// no entities at all.
export function emitRealityView(hostId, items, pad, out, opts = {}) {
  const indentStr = '    '.repeat(pad)
  const roots = entityChildrenOf(hostId, items)
  if (roots.length === 0) return null

  // Behaviours change the shape of the setup: their methods need to resolve
  // entities after the closure returns, so roots hang off a `@State`
  // sceneRoot instead of going straight into `content`. A purely static
  // scene skips that indirection entirely.
  const plan = planBehaviors(hostId, items)
  const rootTarget = plan.any ? 'sceneRoot' : 'content'

  const attachmentEntities = collectAttachments(hostId, items)
  const useAttachments = attachmentEntities.length > 0
  const nameFor = makeNamer()
  // entity id -> swift local name, so children can parent themselves.
  const varNames = new Map()
  // entity id -> attachment id string.
  const attachIds = new Map()
  let attachN = 0
  for (const a of attachmentEntities) {
    attachN += 1
    attachIds.set(a.id, `attachment${attachN}`)
  }

  const body = []
  const bodyIndent = `${indentStr}${'    '}`
  const push = (l) => body.push(l === '' ? '' : `${bodyIndent}${l}`)

  const emitEntity = (entity, parentVar) => {
    // A camera entity is a designer-only viewpoint marker. The registry is
    // explicit that it never exports, so say why rather than dropping it
    // without a trace.
    if (entity.entityKind === 'camera') {
      push(`// "${esc(entity.name)}" is a designer-only camera marker and is not exported.`)
      return
    }

    const varName = nameFor(entity)
    varNames.set(entity.id, varName)
    const notes = []

    if (entity.entityKind === 'attachment') {
      const aid = attachIds.get(entity.id)
      push('')
      push(`// ${esc(entity.name)} (SwiftUI attachment)`)
      push(`if let ${varName} = attachments.entity(for: "${aid}") {`)
      for (const l of transformLines(entity, varName)) push(`    ${l}`)
      if (entity.attachmentBillboard) {
        push(`    // Billboarded in the designer preview. On device, add a`)
        push(`    // BillboardComponent if you want it to face the wearer.`)
      }
      push(`    ${parentVar ? `${parentVar}.addChild(${varName})` : `${rootTarget}.addChild(${varName})`}`)
      push(`}`)
      return
    }

    push('')
    push(`// ${esc(entity.name)}`)

    if (entity.entityKind === 'anchor') {
      const target = anchorTargetExpr(entity, notes)
      for (const n of notes) push(n)
      push(`let ${varName} = AnchorEntity(${target})`)
    } else if (entity.entityKind === 'light') {
      const comp = lightComponentExpr(entity, notes)
      push(`let ${varName} = Entity()`)
      for (const n of notes) push(n)
      if (comp) push(`${varName}.components.set(${comp})`)
      if (entity.lightCastsShadow && (entity.lightType === 'spot' || entity.lightType === 'directional')) {
        const shadowType = entity.lightType === 'spot' ? 'SpotLightComponent' : 'DirectionalLightComponent'
        push(`${varName}.components.set(${shadowType}.Shadow())`)
      }
    } else if (entity.entityKind === 'model') {
      if ((entity.meshType || 'box') === 'usdz') {
        const asset = entity.usdzFileName || entity.usdzAsset || ''
        const bundleName = /^data:/i.test(asset)
          ? (entity.usdzFileName || 'Model')
          : asset
        const stem = String(bundleName).replace(/\.[^.]+$/, '') || 'Model'
        push(`// Add "${esc(stem)}" to your Xcode target for this to resolve.`)
        push(`let ${varName} = (try? Entity.load(named: "${esc(stem)}")) ?? Entity()`)
      } else {
        const mesh = meshFor(entity, varName)
        for (const l of mesh.setup) push(l)
        const mats = Array.isArray(entity.materials) && entity.materials.length > 0
          ? entity.materials
          : [{ type: 'simple', baseColor: '#ffffff', roughness: 0.5, isMetallic: false }]
        const exprs = []
        mats.forEach((m, i) => {
          const built = materialFor(m, `${varName}Material${i + 1}`)
          for (const l of built.setup) push(l)
          exprs.push(built.expr)
        })
        push(`let ${varName} = ModelEntity(mesh: ${mesh.expr}, materials: [${exprs.join(', ')}])`)
      }
    } else {
      // group / empty — a pure transform node.
      push(`let ${varName} = Entity()`)
    }

    push(`${varName}.name = "${esc(entity.name)}"`)
    for (const l of transformLines(entity, varName)) push(l)
    for (const l of componentLines(entity, varName)) push(l)
    // Input target + collision shapes, so gestures on this entity can hit.
    for (const l of behaviorComponentLines(entity, varName, plan)) push(l)
    push(parentVar ? `${parentVar}.addChild(${varName})` : `${rootTarget}.addChild(${varName})`)

    for (const child of items.filter((it) => it.type === 'entity' && it.parentId === entity.id)) {
      emitEntity(child, varName)
    }
  }

  for (const root of roots) emitEntity(root, null)

  if (plan.any) {
    push('')
    push(`content.add(sceneRoot)`)
    // Collision subscriptions need `content`, so they belong in here rather
    // than with the gesture modifiers outside.
    emitCollisionSubscriptions(plan, (id) => varNames.get(id), push)
  }

  // ---- assemble ----
  const closureArgs = useAttachments ? 'content, attachments in' : 'content in'
  out.push(`${indentStr}RealityView { ${closureArgs}`)
  // Drop a leading blank so the block does not open on an empty line.
  const trimmed = body[0] === '' ? body.slice(1) : body
  for (const l of trimmed) out.push(l)
  if (useAttachments) {
    out.push(`${indentStr}} attachments: {`)
    for (const a of attachmentEntities) {
      const aid = attachIds.get(a.id)
      out.push(`${bodyIndent}Attachment(id: "${aid}") {`)
      const { lines } = attachmentViewLines(a, aid)
      for (const l of lines) out.push(`${bodyIndent}    ${l}`)
      out.push(`${bodyIndent}}`)
    }
    out.push(`${indentStr}}`)
  } else {
    out.push(`${indentStr}}`)
  }
  if (opts.frameDepth) {
    out.push(`${indentStr}    .frame(depth: ${opts.frameDepth})`)
  }
  return plan
}
