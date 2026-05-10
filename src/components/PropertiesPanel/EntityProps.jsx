// Entity inspector — RealityKit (visual / artifact pass).
//
// Renders sections matched to the entity's kind:
//
//   any kind   → Name, Kind switch, Transform, Components, Info
//   anchor     → Anchor (target + target-specific fields)
//   model      → Mesh (per-meshType fields), Materials (list of slots)
//   group      → (no kind-specific section)
//
// Mirrors the PanelProps pattern: small section components compose, the
// store action does the data work, the inspector stays declarative.

import { useRef, useState } from 'react'
import { useStore } from '../../store'
import {
  Row, Section, NumField, Slider, ColorRow, Select
} from './primitives'
import { BehaviorsSection } from './BehaviorsSection'
import { useScrub } from './useScrub'
import {
  ENTITY_KINDS, ENTITY_KIND_ORDER,
  ANCHOR_TARGETS, ANCHOR_TARGET_ORDER,
  HAND_CHIRALITIES, HAND_LOCATIONS,
  PLANE_ALIGNMENTS, PLANE_CLASSIFICATIONS,
  MESH_TYPES, MESH_TYPE_ORDER,
  TEXT_ALIGNMENTS, TEXT_LINE_BREAK_MODES,
  MATERIAL_TYPES, MATERIAL_TYPE_ORDER,
  BLENDING_MODES, FACE_CULLING_MODES,
  COMPONENT_TYPES, COMPONENT_TYPE_ORDER,
  ATTACHMENT_KINDS, ATTACHMENT_KIND_ORDER
} from '../../realityKit/registry'

// ---- numeric input that takes raw metres -----------------------------
//
// EntityProps stores positions / sizes in metres (RealityKit's native
// unit) rather than the SwiftUI-pt internal unit used everywhere else.
// `MeterField` is the metre-aware counterpart of `PtField`. The scrub
// hook lets the user drag the field horizontally to nudge the value
// (Blender / Figma style) at sensitivity 0.005 — 1 px ≈ 5 mm, so a
// 100-px drag covers 0.5 m, comfortable for furniture-scale tweaks.
// Pointer-down is intercepted so a still click still focuses the input
// for keyboard editing.
function MeterField({ value, onChange, step = 0.01, min }) {
  const v = Number.isFinite(value) ? value : 0
  const apply = (n) => {
    let next = n
    if (!Number.isFinite(next)) next = 0
    if (typeof min === 'number') next = Math.max(min, next)
    onChange(parseFloat(next.toFixed(4)))
  }
  const inputRef = useRef(null)
  const [draft, setDraft] = useState(null)
  const focusedRef = useRef(false)
  const scrub = useScrub(v, apply, 0.005)

  const formatted = v.toFixed(3)
  const display = focusedRef.current && draft !== null ? draft : formatted

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => {
          focusedRef.current = true
          setDraft(formatted)
          requestAnimationFrame(() => inputRef.current?.select?.())
        }}
        onBlur={() => {
          focusedRef.current = false
          if (draft !== null) {
            const n = parseFloat(draft)
            if (Number.isFinite(n)) apply(n)
          }
          setDraft(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.target.blur() }
          else if (e.key === 'Escape') { setDraft(null); e.target.blur() }
        }}
        onPointerDown={(e) => {
          // Defer to the scrub hook; native click flow still reaches
          // the input and focuses it for keyboard editing if the
          // cursor doesn't move.
          scrub.onPointerDown(e)
        }}
        className="field cursor-ew-resize"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-textMute pointer-events-none">m</span>
    </div>
  )
}

// ---- Compact transform block ----------------------------------------
//
// Three rows (Position / Rotation / Scale) with all three axes on a
// single line each — each axis gets a coloured X / Y / Z tag (red /
// green / blue, the conventional 3D mapping). Layout is a strict
// 3-column CSS grid so every input box is the same width across all
// three rows. The Uniform / Per-axis toggle lives at the row label
// (a small lock icon) so the row's input area stays unchanged.

const AXIS_COLORS = ['#e35d6a', '#67c97a', '#5b9efb']

function AxisTag({ axis, idx }) {
  return (
    <span
      style={{
        color: AXIS_COLORS[idx],
        width: 11,
        fontSize: 9,
        fontWeight: 700,
        textAlign: 'center',
        flexShrink: 0,
        userSelect: 'none'
      }}
    >{axis}</span>
  )
}

function TripletRow({ label, action, children }) {
  // children is exactly 3 field renderers — laid out in a 3-column grid
  // so each cell is mathematically identical, regardless of which row.
  // `action` is an optional tiny icon button shown in place of the
  // label text (used by the Scale row for the Uniform toggle).
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="flex items-center justify-between text-textMute text-[9px] uppercase tracking-wider"
        style={{ width: 32, flexShrink: 0 }}
      >
        <span>{label}</span>
        {action}
      </div>
      <div
        className="flex-1 min-w-0 grid gap-1"
        style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-0.5 min-w-0">
            <AxisTag axis={['X', 'Y', 'Z'][i]} idx={i} />
            {children[i]}
          </div>
        ))}
      </div>
    </div>
  )
}

// Tiny chain / link glyph for the uniform-scale toggle. Filled when
// uniform is on, broken when per-axis.
function ChainIcon({ linked }) {
  return linked ? (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M5 4.5h-1.2A1.8 1.8 0 0 0 2 6.3v0a1.8 1.8 0 0 0 1.8 1.8H5" />
      <path d="M7 4.5h1.2A1.8 1.8 0 0 1 10 6.3v0a1.8 1.8 0 0 1-1.8 1.8H7" />
      <path d="M4.5 6.3h3" />
    </svg>
  ) : (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M5 4.5h-1.2A1.8 1.8 0 0 0 2 6.3v0a1.8 1.8 0 0 0 1.8 1.8H5" />
      <path d="M7 4.5h1.2A1.8 1.8 0 0 1 10 6.3v0a1.8 1.8 0 0 1-1.8 1.8H7" />
    </svg>
  )
}

function CompactTransform({ item }) {
  const setEntityPosition = useStore((s) => s.setEntityPosition)
  const setEntityRotation = useStore((s) => s.setEntityRotation)
  const setEntityScale    = useStore((s) => s.setEntityScale)
  const setEntityScaleUniform = useStore((s) => s.setEntityScaleUniform)
  const updateItem = useStore((s) => s.updateItem)

  const pos = item.position || [0, 0, 0]
  const rot = item.rotation || [0, 0, 0]
  const scl = item.scale    || [1, 1, 1]
  const isUniform = scl[0] === scl[1] && scl[1] === scl[2]

  const posFields = [0, 1, 2].map((i) => (
    <MeterField key={i} value={pos[i]} onChange={(v) => setEntityPosition(item.id, i, v)} />
  ))
  const rotFields = [0, 1, 2].map((i) => (
    <NumField key={i} value={rot[i]} step={1} suffix="°" onChange={(v) => setEntityRotation(item.id, i, v)} />
  ))
  const sclFields = isUniform
    ? [0, 1, 2].map((i) => (
        <NumField key={i} value={scl[0]} step={0.05} onChange={(v) => setEntityScaleUniform(item.id, v)} />
      ))
    : [0, 1, 2].map((i) => (
        <NumField key={i} value={scl[i]} step={0.05} onChange={(v) => setEntityScale(item.id, i, v)} />
      ))

  const uniformToggle = (
    <button
      onClick={() => updateItem(item.id, { scale: isUniform ? [...scl] : [scl[0], scl[0], scl[0]] })}
      title={isUniform ? 'Linked — drag any axis to scale uniformly. Click to unlink.' : 'Per-axis. Click to link all axes.'}
      className={`w-3 h-3 flex items-center justify-center hover:text-text ${isUniform ? 'text-accent' : 'text-textMute'}`}
      style={{ flexShrink: 0 }}
    >
      <ChainIcon linked={isUniform} />
    </button>
  )

  return (
    <div className="space-y-1.5">
      <TripletRow label="Pos">{posFields}</TripletRow>
      <TripletRow label="Rot">{rotFields}</TripletRow>
      <TripletRow label="Scl" action={uniformToggle}>{sclFields}</TripletRow>
    </div>
  )
}

// ---- Kind switch -----------------------------------------------------
//
// Anchor/Model/Group segmented control. Lives at the top so its scope is
// obvious — switching Kind rewires the type-specific defaults via the
// store's `setEntityKind` action, preserving the entity id and tree
// position.
function KindSwitch({ item }) {
  const setEntityKind = useStore((s) => s.setEntityKind)
  return (
    <Row label="Kind">
      <div className="segmented flex-1">
        {ENTITY_KIND_ORDER.map((k) => (
          <button
            key={k}
            className={item.entityKind === k ? 'active' : ''}
            onClick={() => setEntityKind(item.id, k)}
            title={ENTITY_KINDS[k].description}
          >{ENTITY_KINDS[k].label}</button>
        ))}
      </div>
    </Row>
  )
}

// ---- Anchor fields ---------------------------------------------------
//
// Body of the Anchor inspector — target picker + per-target sub-fields.
// Returned as a fragment (no Section wrapper) so the new combined
// `ObjectSection` can compose it alongside the kind header + transform.

function AnchorFields({ item }) {
  const updateItem = useStore((s) => s.updateItem)
  const setAnchorTarget = useStore((s) => s.setAnchorTarget)
  const target = item.anchorTarget || 'world'
  const meta = ANCHOR_TARGETS[target]
  return (
    <>
      <Row label="Target">
        <Select
          value={target}
          options={ANCHOR_TARGET_ORDER.map((k) => ({ value: k, label: ANCHOR_TARGETS[k].label }))}
          onChange={(v) => setAnchorTarget(item.id, v)}
        />
      </Row>
      {meta?.description && (
        <div className="text-[10px] text-textMute leading-snug">{meta.description}</div>
      )}

      {/* World — no extra fields. Position / rotation in Transform. */}

      {/* Hand — chirality + joint */}
      {target === 'hand' && (
        <>
          <Row label="Hand">
            <Select
              value={item.handChirality || 'right'}
              options={HAND_CHIRALITIES}
              onChange={(v) => updateItem(item.id, { handChirality: v })}
            />
          </Row>
          <Row label="Joint">
            <Select
              value={item.handLocation || 'palm'}
              options={HAND_LOCATIONS}
              onChange={(v) => updateItem(item.id, { handLocation: v })}
            />
          </Row>
        </>
      )}

      {/* Plane — alignment, classification, minimum bounds */}
      {target === 'plane' && (
        <>
          <Row label="Plane">
            <Select
              value={item.planeAlignment || 'horizontal'}
              options={PLANE_ALIGNMENTS}
              onChange={(v) => updateItem(item.id, { planeAlignment: v })}
            />
          </Row>
          <Row label="Class">
            <Select
              value={item.planeClassification || 'any'}
              options={PLANE_CLASSIFICATIONS}
              onChange={(v) => updateItem(item.id, { planeClassification: v })}
            />
          </Row>
          <Row label="Min W">
            <MeterField
              value={(item.planeMinimumBounds || [0.1, 0.1])[0]}
              min={0}
              onChange={(v) => {
                const h = (item.planeMinimumBounds || [0.1, 0.1])[1]
                updateItem(item.id, { planeMinimumBounds: [v, h] })
              }}
            />
          </Row>
          <Row label="Min H">
            <MeterField
              value={(item.planeMinimumBounds || [0.1, 0.1])[1]}
              min={0}
              onChange={(v) => {
                const w = (item.planeMinimumBounds || [0.1, 0.1])[0]
                updateItem(item.id, { planeMinimumBounds: [w, v] })
              }}
            />
          </Row>
        </>
      )}

      {/* Image — group + name (AR Resources) */}
      {target === 'image' && (
        <>
          <Row label="Group">
            <input
              value={item.imageGroup || ''}
              onChange={(e) => updateItem(item.id, { imageGroup: e.target.value })}
              className="field flex-1"
              placeholder="AR Resources"
            />
          </Row>
          <Row label="Name">
            <input
              value={item.imageName || ''}
              onChange={(e) => updateItem(item.id, { imageName: e.target.value })}
              className="field flex-1"
              placeholder="reference-image"
            />
          </Row>
        </>
      )}

      {/* Object — group + name */}
      {target === 'object' && (
        <>
          <Row label="Group">
            <input
              value={item.objectGroup || ''}
              onChange={(e) => updateItem(item.id, { objectGroup: e.target.value })}
              className="field flex-1"
              placeholder="AR Resources"
            />
          </Row>
          <Row label="Name">
            <input
              value={item.objectName || ''}
              onChange={(e) => updateItem(item.id, { objectName: e.target.value })}
              className="field flex-1"
              placeholder="reference-object"
            />
          </Row>
        </>
      )}
    </>
  )
}

// ---- Mesh fields -----------------------------------------------------
//
// Body of the Model inspector — mesh type chooser + per-type
// dimensions. Returned as a fragment so the combined ObjectSection can
// compose it alongside the kind header + transform.
function MeshFields({ item }) {
  const updateItem = useStore((s) => s.updateItem)
  const setMeshType = useStore((s) => s.setMeshType)
  const m = item.meshType || 'box'
  return (
    <>
      <Row label="Mesh">
        <Select
          value={m}
          options={MESH_TYPE_ORDER.map((k) => ({ value: k, label: MESH_TYPES[k].label }))}
          onChange={(v) => setMeshType(item.id, v)}
        />
      </Row>

      {m === 'box' && (() => {
        const [w, h, d] = item.boxSize || [0.1, 0.1, 0.1]
        return (
          <>
            <Row label="W"><MeterField value={w} min={0} onChange={(v) => updateItem(item.id, { boxSize: [v, h, d] })} /></Row>
            <Row label="H"><MeterField value={h} min={0} onChange={(v) => updateItem(item.id, { boxSize: [w, v, d] })} /></Row>
            <Row label="D"><MeterField value={d} min={0} onChange={(v) => updateItem(item.id, { boxSize: [w, h, v] })} /></Row>
            <Row label="Radius"><MeterField value={item.boxCornerRadius ?? 0} min={0} onChange={(v) => updateItem(item.id, { boxCornerRadius: v })} /></Row>
          </>
        )
      })()}

      {m === 'sphere' && (
        <Row label="Radius">
          <MeterField value={item.sphereRadius ?? 0.05} min={0.0001} onChange={(v) => updateItem(item.id, { sphereRadius: v })} />
        </Row>
      )}

      {m === 'cylinder' && (
        <>
          <Row label="Height"><MeterField value={item.cylinderHeight ?? 0.1} min={0} onChange={(v) => updateItem(item.id, { cylinderHeight: v })} /></Row>
          <Row label="Radius"><MeterField value={item.cylinderRadius ?? 0.05} min={0} onChange={(v) => updateItem(item.id, { cylinderRadius: v })} /></Row>
        </>
      )}

      {m === 'cone' && (
        <>
          <Row label="Height"><MeterField value={item.coneHeight ?? 0.1} min={0} onChange={(v) => updateItem(item.id, { coneHeight: v })} /></Row>
          <Row label="Radius"><MeterField value={item.coneRadius ?? 0.05} min={0} onChange={(v) => updateItem(item.id, { coneRadius: v })} /></Row>
        </>
      )}

      {m === 'plane' && (
        <>
          <Row label="W"><MeterField value={item.planeWidth ?? 0.1} min={0} onChange={(v) => updateItem(item.id, { planeWidth: v })} /></Row>
          <Row label="D"><MeterField value={item.planeDepth ?? 0.1} min={0} onChange={(v) => updateItem(item.id, { planeDepth: v })} /></Row>
          <Row label="Radius"><MeterField value={item.planeCornerRadius ?? 0} min={0} onChange={(v) => updateItem(item.id, { planeCornerRadius: v })} /></Row>
        </>
      )}

      {m === 'text' && (() => {
        const [fw, fh] = item.textContainerFrame || [0.5, 0.2]
        return (
          <>
            <Row label="Text">
              <input
                value={item.textValue ?? 'Hello'}
                onChange={(e) => updateItem(item.id, { textValue: e.target.value })}
                className="field flex-1"
              />
            </Row>
            <Row label="Size"   ><MeterField value={item.textFontSize ?? 0.05} min={0.001} onChange={(v) => updateItem(item.id, { textFontSize: v })} /></Row>
            <Row label="Extrude"><MeterField value={item.textExtrusionDepth ?? 0.005} min={0} onChange={(v) => updateItem(item.id, { textExtrusionDepth: v })} /></Row>
            <Row label="Align">
              <Select
                value={item.textAlignment || 'center'}
                options={TEXT_ALIGNMENTS}
                onChange={(v) => updateItem(item.id, { textAlignment: v })}
              />
            </Row>
            <Row label="Wrap">
              <Select
                value={item.textLineBreakMode || 'wordWrap'}
                options={TEXT_LINE_BREAK_MODES}
                onChange={(v) => updateItem(item.id, { textLineBreakMode: v })}
              />
            </Row>
            <div className="text-[9px] text-textMute uppercase tracking-wider mt-2 mb-1">Container frame</div>
            <Row label="W"><MeterField value={fw} min={0} onChange={(v) => updateItem(item.id, { textContainerFrame: [v, fh] })} /></Row>
            <Row label="H"><MeterField value={fh} min={0} onChange={(v) => updateItem(item.id, { textContainerFrame: [fw, v] })} /></Row>
          </>
        )
      })()}

      {m === 'usdz' && (
        <>
          <Row label="Asset">
            <input
              value={item.usdzAsset ?? ''}
              onChange={(e) => updateItem(item.id, { usdzAsset: e.target.value })}
              className="field flex-1"
              placeholder="MyModel"
            />
          </Row>
          <Row label="Anim">
            <input
              value={item.usdzAnimationName ?? ''}
              onChange={(e) => updateItem(item.id, { usdzAnimationName: e.target.value || null })}
              className="field flex-1"
              placeholder="(optional clip)"
            />
          </Row>
          <div className="text-[10px] text-textMute leading-snug mt-1">
            Bundle resource name (no extension). Loaded with
            <code> Entity.load(named:)</code> at runtime.
          </div>
        </>
      )}
    </>
  )
}

// ---- Material slot ---------------------------------------------------

function MaterialSlot({ item, mat, index }) {
  const updateMaterial   = useStore((s) => s.updateMaterial)
  const setMaterialType  = useStore((s) => s.setMaterialType)
  const removeMaterial   = useStore((s) => s.removeMaterial)
  const reorderMaterial  = useStore((s) => s.reorderMaterial)
  const set = (patch) => updateMaterial(item.id, mat.id, patch)
  const meta = MATERIAL_TYPES[mat.type] || MATERIAL_TYPES.simple

  return (
    <div className="border border-border rounded mb-1.5 bg-surface2/30">
      <div className="flex items-center gap-1 px-1.5 py-1 border-b border-border">
        <span className="text-[10px] text-textDim w-4 text-center font-mono">{index}</span>
        <span className="flex-1 text-[10px] text-text truncate">{meta.label}</span>
        <button
          className="btn btn-ghost text-[10px] px-1"
          title="Move up"
          disabled={index === 0}
          onClick={() => reorderMaterial(item.id, index, index - 1)}
        >▲</button>
        <button
          className="btn btn-ghost text-[10px] px-1"
          title="Move down"
          onClick={() => reorderMaterial(item.id, index, index + 1)}
        >▼</button>
        <button
          className="btn btn-ghost text-[10px] px-1 text-danger"
          title="Remove material"
          onClick={() => removeMaterial(item.id, mat.id)}
        >×</button>
      </div>

      <div className="px-2 py-1.5 space-y-1.5">
        <Row label="Type">
          <Select
            value={mat.type || 'simple'}
            options={MATERIAL_TYPE_ORDER.map((k) => ({ value: k, label: MATERIAL_TYPES[k].label }))}
            onChange={(v) => setMaterialType(item.id, mat.id, v)}
          />
        </Row>
        <div className="text-[10px] text-textMute leading-snug">{meta.description}</div>

        {/* Simple — colour + roughness + metallic toggle */}
        {mat.type === 'simple' && (
          <>
            <Row label="Color"><ColorRow value={mat.baseColor || '#ffffff'} onChange={(v) => set({ baseColor: v })} /></Row>
            <Row label="Texture">
              <input value={mat.baseColorTextureName || ''} onChange={(e) => set({ baseColorTextureName: e.target.value || null })} className="field flex-1" placeholder="(none) — bundle resource" />
            </Row>
            <Row label="Roughness"><Slider value={mat.roughness ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => set({ roughness: v })} /></Row>
            <Row label="Metallic">
              <div className="segmented flex-1">
                <button className={mat.isMetallic ? 'active' : ''} onClick={() => set({ isMetallic: true })}>On</button>
                <button className={!mat.isMetallic ? 'active' : ''} onClick={() => set({ isMetallic: false })}>Off</button>
              </div>
            </Row>
          </>
        )}

        {/* Physically Based — full PBR knobs */}
        {mat.type === 'physicallyBased' && (
          <>
            <Row label="Base"><ColorRow value={mat.baseColor || '#ffffff'} onChange={(v) => set({ baseColor: v })} /></Row>
            <Row label="Base Tex">
              <input value={mat.baseColorTextureName || ''} onChange={(e) => set({ baseColorTextureName: e.target.value || null })} className="field flex-1" placeholder="(optional)" />
            </Row>
            <Row label="Roughness"><Slider value={mat.roughness ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => set({ roughness: v })} /></Row>
            <Row label="Rough Tex">
              <input value={mat.roughnessTextureName || ''} onChange={(e) => set({ roughnessTextureName: e.target.value || null })} className="field flex-1" placeholder="(optional)" />
            </Row>
            <Row label="Metallic"><Slider value={mat.metallic ?? 0} min={0} max={1} step={0.01} onChange={(v) => set({ metallic: v })} /></Row>
            <Row label="Metal Tex">
              <input value={mat.metallicTextureName || ''} onChange={(e) => set({ metallicTextureName: e.target.value || null })} className="field flex-1" placeholder="(optional)" />
            </Row>
            <Row label="Normal Tex">
              <input value={mat.normalTextureName || ''} onChange={(e) => set({ normalTextureName: e.target.value || null })} className="field flex-1" placeholder="(optional)" />
            </Row>
            <Row label="AO Tex">
              <input value={mat.ambientOcclusionTextureName || ''} onChange={(e) => set({ ambientOcclusionTextureName: e.target.value || null })} className="field flex-1" placeholder="(optional)" />
            </Row>
            <div className="text-[9px] text-textMute uppercase tracking-wider mt-2 mb-1">Emissive</div>
            <Row label="Color"><ColorRow value={mat.emissiveColor || '#000000'} onChange={(v) => set({ emissiveColor: v })} /></Row>
            <Row label="Intensity"><Slider value={mat.emissiveIntensity ?? 0} min={0} max={10} step={0.1} onChange={(v) => set({ emissiveIntensity: v })} /></Row>
            <Row label="Emissive Tex">
              <input value={mat.emissiveTextureName || ''} onChange={(e) => set({ emissiveTextureName: e.target.value || null })} className="field flex-1" placeholder="(optional)" />
            </Row>
            <div className="text-[9px] text-textMute uppercase tracking-wider mt-2 mb-1">Clearcoat / sheen</div>
            <Row label="Clearcoat"><Slider value={mat.clearcoat ?? 0} min={0} max={1} step={0.01} onChange={(v) => set({ clearcoat: v })} /></Row>
            <Row label="Cc Rough"><Slider value={mat.clearcoatRoughness ?? 0} min={0} max={1} step={0.01} onChange={(v) => set({ clearcoatRoughness: v })} /></Row>
            <Row label="Sheen"><ColorRow value={mat.sheenColor || '#000000'} onChange={(v) => set({ sheenColor: v })} /></Row>
            <div className="text-[9px] text-textMute uppercase tracking-wider mt-2 mb-1">Blending</div>
            <Row label="Mode">
              <Select value={mat.blending || 'opaque'} options={BLENDING_MODES} onChange={(v) => set({ blending: v })} />
            </Row>
            <Row label="Cutoff">
              <NumField value={mat.opacityThreshold ?? 0} step={0.01} onChange={(v) => set({ opacityThreshold: v <= 0 ? null : v })} />
            </Row>
            <Row label="Cull">
              <Select value={mat.faceCulling || 'back'} options={FACE_CULLING_MODES} onChange={(v) => set({ faceCulling: v })} />
            </Row>
            <div className="text-[9px] text-textMute uppercase tracking-wider mt-2 mb-1">UV transform</div>
            <Row label="Off U"><NumField value={mat.textureCoordinateTransform?.offsetU ?? 0} step={0.01} onChange={(v) => set({ textureCoordinateTransform: { ...mat.textureCoordinateTransform, offsetU: v } })} /></Row>
            <Row label="Off V"><NumField value={mat.textureCoordinateTransform?.offsetV ?? 0} step={0.01} onChange={(v) => set({ textureCoordinateTransform: { ...mat.textureCoordinateTransform, offsetV: v } })} /></Row>
            <Row label="Sc U"><NumField value={mat.textureCoordinateTransform?.scaleU ?? 1} step={0.05} onChange={(v) => set({ textureCoordinateTransform: { ...mat.textureCoordinateTransform, scaleU: v } })} /></Row>
            <Row label="Sc V"><NumField value={mat.textureCoordinateTransform?.scaleV ?? 1} step={0.05} onChange={(v) => set({ textureCoordinateTransform: { ...mat.textureCoordinateTransform, scaleV: v } })} /></Row>
            <Row label="Rot"><NumField value={mat.textureCoordinateTransform?.rotation ?? 0} step={1} onChange={(v) => set({ textureCoordinateTransform: { ...mat.textureCoordinateTransform, rotation: v } })} suffix="°" /></Row>
          </>
        )}

        {/* Unlit — flat colour */}
        {mat.type === 'unlit' && (
          <>
            <Row label="Color"><ColorRow value={mat.unlitColor || '#ffffff'} onChange={(v) => set({ unlitColor: v })} /></Row>
            <Row label="Texture">
              <input value={mat.unlitTextureName || ''} onChange={(e) => set({ unlitTextureName: e.target.value || null })} className="field flex-1" placeholder="(optional)" />
            </Row>
            <Row label="Mode">
              <Select value={mat.blending || 'opaque'} options={BLENDING_MODES} onChange={(v) => set({ blending: v })} />
            </Row>
            <Row label="Cutoff">
              <NumField value={mat.opacityThreshold ?? 0} step={0.01} onChange={(v) => set({ opacityThreshold: v <= 0 ? null : v })} />
            </Row>
            <Row label="Cull">
              <Select value={mat.faceCulling || 'back'} options={FACE_CULLING_MODES} onChange={(v) => set({ faceCulling: v })} />
            </Row>
          </>
        )}

        {mat.type === 'occlusion' && (
          <div className="text-[10px] text-textMute leading-snug">
            No parameters. The mesh draws to the depth buffer only — useful
            for hiding entities behind real-world geometry.
          </div>
        )}

        {mat.type === 'portal' && (
          <div className="text-[10px] text-textMute leading-snug">
            Pair this material with an entity carrying a
            <code> PortalComponent</code> referencing the world to reveal.
          </div>
        )}

        {mat.type === 'video' && (
          <>
            <Row label="Asset">
              <input value={mat.videoAssetName || ''} onChange={(e) => set({ videoAssetName: e.target.value })} className="field flex-1" placeholder="MyClip.mov" />
            </Row>
            <Row label="Auto">
              <div className="segmented flex-1">
                <button className={mat.autoplay ? 'active' : ''} onClick={() => set({ autoplay: true })}>On</button>
                <button className={!mat.autoplay ? 'active' : ''} onClick={() => set({ autoplay: false })}>Off</button>
              </div>
            </Row>
            <Row label="Loop">
              <div className="segmented flex-1">
                <button className={mat.loops ? 'active' : ''} onClick={() => set({ loops: true })}>On</button>
                <button className={!mat.loops ? 'active' : ''} onClick={() => set({ loops: false })}>Off</button>
              </div>
            </Row>
            <Row label="Gain"><Slider value={mat.audioGain ?? 1} min={0} max={1} step={0.01} onChange={(v) => set({ audioGain: v })} /></Row>
          </>
        )}

        {mat.type === 'shaderGraph' && (
          <>
            <Row label="Asset">
              <input value={mat.shaderGraphAssetName || ''} onChange={(e) => set({ shaderGraphAssetName: e.target.value })} className="field flex-1" placeholder="MyMaterial" />
            </Row>
            <Row label="Bundle">
              <input value={mat.shaderGraphFromBundle || 'main'} onChange={(e) => set({ shaderGraphFromBundle: e.target.value })} className="field flex-1" placeholder="main" />
            </Row>
            <div className="text-[10px] text-textMute leading-snug">
              References a Reality Composer Pro shader graph asset.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---- Camera section --------------------------------------------------
//
// Camera entities are designer-only — a stand-in for the wearer's
// headset. Position / rotation come from the shared TransformSection;
// this section just exposes lens parameters + a "Snap orbit camera
// here" affordance. Hitting the button is the same as the viewport
// overlay's "Camera View" button (kept here too for muscle memory).

function CameraFields({ item }) {
  const updateItem = useStore((s) => s.updateItem)
  return (
    <>
      <Row label="FOV">
        <Slider
          value={item.fovDegrees ?? 60}
          min={20} max={120} step={1}
          suffix="°"
          onChange={(v) => updateItem(item.id, { fovDegrees: v })}
        />
      </Row>
      <Row label="Near">
        <NumField
          value={item.near ?? 0.1} step={0.01}
          onChange={(v) => updateItem(item.id, { near: Math.max(0.001, v) })}
        />
      </Row>
      <Row label="Far">
        <NumField
          value={item.far ?? 50} step={1}
          onChange={(v) => updateItem(item.id, { far: Math.max(0.5, v) })}
        />
      </Row>
      <button
        className="btn w-full justify-center mt-2"
        onClick={() => window.dispatchEvent(new CustomEvent('snap-camera-to-entity', { detail: { entityId: item.id } }))}
        title="Move the orbit camera to this entity's transform"
      >Snap orbit camera here</button>
      <div className="text-[10px] text-textMute leading-snug mt-1">
        Stand-in for the wearer's headset — designer only, never exported.
      </div>
    </>
  )
}

// ---- Attachment fields ----------------------------------------------
//
// Attachments are SwiftUI views (Text / Label / Button / Image) anchored
// at a 3D position inside a RealityView. The user picks the kind, then
// edits the kind-specific fields (text, color, font size, etc.).

function AttachmentFields({ item }) {
  const updateItem = useStore((s) => s.updateItem)
  const kind = item.attachmentKind || 'text'
  const meta = ATTACHMENT_KINDS[kind] || ATTACHMENT_KINDS.text
  const onChangeKind = (next) => {
    if (next === kind) return
    const defaults = ATTACHMENT_KINDS[next]?.defaults || {}
    updateItem(item.id, { attachmentKind: next, ...defaults })
  }
  return (
    <>
      <Row label="Subkind">
        <Select
          value={kind}
          options={ATTACHMENT_KIND_ORDER.map((k) => ({ value: k, label: ATTACHMENT_KINDS[k].label }))}
          onChange={onChangeKind}
        />
      </Row>
      <div className="text-[10px] text-textMute leading-snug">{meta.description}</div>

      {(kind === 'text' || kind === 'label' || kind === 'button') && (
        <Row label="Text">
          <input
            value={item.attachmentText || ''}
            onChange={(e) => updateItem(item.id, { attachmentText: e.target.value })}
            className="field flex-1"
          />
        </Row>
      )}

      {kind === 'label' && (
        <Row label="Symbol">
          <input
            value={item.attachmentSymbol || ''}
            onChange={(e) => updateItem(item.id, { attachmentSymbol: e.target.value })}
            className="field flex-1"
            placeholder="info.circle"
          />
        </Row>
      )}

      {kind === 'image' && (
        <Row label="URL">
          <input
            value={item.attachmentImageUrl || ''}
            onChange={(e) => updateItem(item.id, { attachmentImageUrl: e.target.value })}
            className="field flex-1"
            placeholder="(bundle name or URL)"
          />
        </Row>
      )}

      <Row label="FG"><ColorRow value={item.attachmentColor || '#ffffff'} onChange={(v) => updateItem(item.id, { attachmentColor: v })} /></Row>
      <Row label="BG"><ColorRow value={item.attachmentBackground || '#1c1c1e'} onChange={(v) => updateItem(item.id, { attachmentBackground: v })} /></Row>

      {kind !== 'image' && (
        <Row label="Font">
          <Slider
            value={item.attachmentFontSize ?? 0.05}
            min={0.02} max={0.20} step={0.005}
            onChange={(v) => updateItem(item.id, { attachmentFontSize: v })}
          />
        </Row>
      )}
      {kind === 'image' && (
        <Row label="Size">
          <Slider
            value={item.attachmentSize ?? 0.20}
            min={0.05} max={0.6} step={0.01}
            onChange={(v) => updateItem(item.id, { attachmentSize: v })}
          />
        </Row>
      )}
      <Row label="Pad">
        <Slider
          value={item.attachmentPadding ?? 0.02}
          min={0} max={0.10} step={0.005}
          onChange={(v) => updateItem(item.id, { attachmentPadding: v })}
        />
      </Row>
      <Row label="Radius">
        <Slider
          value={item.attachmentCornerRadius ?? 0.02}
          min={0} max={0.10} step={0.005}
          onChange={(v) => updateItem(item.id, { attachmentCornerRadius: v })}
        />
      </Row>
      <Row label="Billboard">
        <div className="segmented flex-1">
          <button className={item.attachmentBillboard !== false ? 'active' : ''} onClick={() => updateItem(item.id, { attachmentBillboard: true })}>On</button>
          <button className={item.attachmentBillboard === false ? 'active' : ''} onClick={() => updateItem(item.id, { attachmentBillboard: false })}>Off</button>
        </div>
      </Row>
      <div className="text-[10px] text-textMute leading-snug mt-1">
        Exports as <code>Attachment(id:)</code> inside the RealityView's
        <code> attachments:</code> closure. <code>attachments.entity(for:)</code>
        attaches it at this entity's transform.
      </div>
    </>
  )
}

// ---- Materials list --------------------------------------------------

function MaterialsSection({ item }) {
  const addMaterial = useStore((s) => s.addMaterial)
  const list = item.materials || []
  return (
    <Section
      title={`Materials (${list.length})`}
      defaultOpen={false}
      action={
        <button
          onClick={() => addMaterial(item.id, 'simple')}
          className="btn btn-ghost text-[10px] px-1.5"
          title="Append material slot"
        >+</button>
      }
    >
      {list.length === 0 && (
        <div className="text-[10px] text-textMute leading-snug">
          No material slots — RealityKit needs at least one. Click + to add.
        </div>
      )}
      {list.map((mat, i) => (
        <MaterialSlot key={mat.id} item={item} mat={mat} index={i} />
      ))}
    </Section>
  )
}

// ---- Components section ---------------------------------------------
//
// One row per visual component: a toggle to enable/disable, plus
// component-specific fields when enabled. Currently visual-only:
// GroundingShadow, Opacity, ImageBasedLight, ImageBasedLightReceiver.

function ComponentsSection({ item }) {
  const toggleComponent = useStore((s) => s.toggleComponent)
  const updateComponent = useStore((s) => s.updateComponent)
  const comps = item.components || {}
  return (
    <Section title="Components" defaultOpen={false}>
      {COMPONENT_TYPE_ORDER.map((key) => {
        const meta = COMPONENT_TYPES[key]
        const c = comps[key] || meta.defaults
        return (
          <div key={key} className="border-b border-border last:border-b-0 py-1.5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleComponent(item.id, key)}
                className={`flex-shrink-0 w-4 h-4 rounded border ${
                  c.enabled ? 'bg-accent border-accent' : 'bg-surface3 border-border'
                }`}
                title={c.enabled ? 'Disable' : 'Enable'}
              >
                {c.enabled && (
                  <svg viewBox="0 0 16 16" className="w-3 h-3 m-0.5 text-white"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </button>
              <span className="text-[10px] text-text flex-1">{meta.label}</span>
            </div>
            <div className="text-[10px] text-textMute leading-snug mt-1 pl-6">{meta.description}</div>

            {c.enabled && key === 'groundingShadow' && (
              <div className="pl-6 mt-1.5 space-y-1.5">
                <Row label="Casts">
                  <div className="segmented flex-1">
                    <button className={c.castsShadow ? 'active' : ''} onClick={() => updateComponent(item.id, key, { castsShadow: true })}>On</button>
                    <button className={!c.castsShadow ? 'active' : ''} onClick={() => updateComponent(item.id, key, { castsShadow: false })}>Off</button>
                  </div>
                </Row>
              </div>
            )}

            {c.enabled && key === 'opacity' && (
              <div className="pl-6 mt-1.5 space-y-1.5">
                <Row label="Value"><Slider value={c.value ?? 1} min={0} max={1} step={0.01} onChange={(v) => updateComponent(item.id, key, { value: v })} /></Row>
              </div>
            )}

            {c.enabled && key === 'imageBasedLight' && (
              <div className="pl-6 mt-1.5 space-y-1.5">
                <Row label="Asset">
                  <input value={c.resourceName || ''} onChange={(e) => updateComponent(item.id, key, { resourceName: e.target.value })} className="field flex-1" placeholder="environment.exr" />
                </Row>
                <Row label="EV"><Slider value={c.intensityExponent ?? 0} min={-4} max={4} step={0.1} onChange={(v) => updateComponent(item.id, key, { intensityExponent: v })} /></Row>
                <Row label="Inherit Rot">
                  <div className="segmented flex-1">
                    <button className={c.inheritsRotation ? 'active' : ''} onClick={() => updateComponent(item.id, key, { inheritsRotation: true })}>On</button>
                    <button className={!c.inheritsRotation ? 'active' : ''} onClick={() => updateComponent(item.id, key, { inheritsRotation: false })}>Off</button>
                  </div>
                </Row>
              </div>
            )}

            {c.enabled && key === 'imageBasedLightReceiver' && (
              <div className="pl-6 mt-1.5 space-y-1.5">
                <Row label="Source">
                  <input value={c.referenceEntity || ''} onChange={(e) => updateComponent(item.id, key, { referenceEntity: e.target.value || null })} className="field flex-1" placeholder="(entity name carrying IBL)" />
                </Row>
                <div className="text-[10px] text-textMute leading-snug">
                  Names another entity in the scene whose <code>ImageBasedLightComponent</code> lights this one.
                </div>
              </div>
            )}
          </div>
        )
      })}
    </Section>
  )
}

// ---- Object section --------------------------------------------------
//
// One section to rule them all — the entity's identity (name + kind),
// kind-specific fields (anchor target, mesh + dimensions, camera FOV,
// attachment kind + content), and the transform triplet, in that
// order. Replaces the old per-kind sections + standalone Transform
// section. Materials, Components, and Interaction get their own
// collapsible sections below.
function ObjectSection({ item }) {
  const renameItem = useStore((s) => s.renameItem)
  const meta = ENTITY_KINDS[item.entityKind] || ENTITY_KINDS.group
  return (
    <Section title="Object" defaultOpen={true}>
      <Row label="Name">
        <input
          value={item.name}
          onChange={(e) => renameItem(item.id, e.target.value)}
          className="field flex-1"
        />
      </Row>
      <KindSwitch item={item} />

      {item.entityKind === 'anchor'     && <AnchorFields item={item} />}
      {item.entityKind === 'model'      && <MeshFields item={item} />}
      {item.entityKind === 'camera'     && <CameraFields item={item} />}
      {item.entityKind === 'attachment' && <AttachmentFields item={item} />}

      {/* Transform sits at the bottom of the section — most-edited
          triplet stays in the same place across every entity kind. */}
      <div className="border-t border-border my-2" />
      <CompactTransform item={item} />

      <div className="text-[10px] text-textMute leading-snug mt-2">
        {meta.description} <code className="text-textDim">{meta.swift}</code>
      </div>
    </Section>
  )
}

// ---- Interaction section --------------------------------------------
//
// Trigger → Action wiring. Currently both dropdowns hold placeholder
// option lists; the real options will be derived from the selected
// entity's kind, the panels in scope, and the cross-tab namespace
// once the interaction graph backend lands. Storing the picks under
// `item.interaction` so they survive selection changes and exports.
const TRIGGER_OPTIONS = [
  { value: 'none',    label: '— None —' },
  { value: 'tap',     label: 'Tap' },
  { value: 'longTap', label: 'Long tap' },
  { value: 'hover',   label: 'Hover' },
  { value: 'gaze',    label: 'Gaze' },
  { value: 'pinch',   label: 'Pinch' },
  { value: 'drag',    label: 'Drag' },
  { value: 'onAppear', label: 'On appear' }
]
const ACTION_OPTIONS = [
  { value: 'none',        label: '— None —' },
  { value: 'showWindow',  label: 'Open window' },
  { value: 'closeWindow', label: 'Close window' },
  { value: 'navigate',    label: 'Navigate to tab' },
  { value: 'play',        label: 'Play animation' },
  { value: 'toggle',      label: 'Toggle visibility' },
  { value: 'highlight',   label: 'Highlight entity' },
  { value: 'message',     label: 'Send message' }
]

function InteractionSection({ item }) {
  const updateItem = useStore((s) => s.updateItem)
  const interaction = item.interaction || {}
  const trigger = interaction.trigger || 'none'
  const action  = interaction.action  || 'none'
  const setField = (patch) =>
    updateItem(item.id, { interaction: { ...interaction, ...patch } })
  return (
    <Section title="Interaction" defaultOpen={false}>
      <Row label="Trigger">
        <Select
          value={trigger}
          options={TRIGGER_OPTIONS}
          onChange={(v) => setField({ trigger: v })}
        />
      </Row>
      <Row label="Action">
        <Select
          value={action}
          options={ACTION_OPTIONS}
          onChange={(v) => setField({ action: v })}
        />
      </Row>
      <div className="text-[10px] text-textMute leading-snug mt-2">
        Stub options — the real list will be derived from your scene's
        entities and tabs once interactions are wired up.
      </div>
    </Section>
  )
}

// ---- root ------------------------------------------------------------

export function EntityProps({ item }) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar">
      <ObjectSection item={item} />

      {item.entityKind === 'model' && <MaterialsSection item={item} />}

      {/* Components only apply to kinds that render geometry — hiding
          them on Camera (designer-only marker) and Attachment (already
          a SwiftUI overlay) avoids exposing knobs that can't take
          effect. Anchor + Group keep them: opacity propagates through
          the children, GroundingShadow falls onto descendant models. */}
      {(item.entityKind === 'anchor' ||
        item.entityKind === 'model' ||
        item.entityKind === 'group') && (
        <ComponentsSection item={item} />
      )}

      <BehaviorsSection item={item} />
    </div>
  )
}

export default EntityProps
