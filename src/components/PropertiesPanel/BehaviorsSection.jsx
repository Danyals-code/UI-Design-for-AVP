// Behaviors inspector section — card-based editor for the per-entity
// trigger / action pairs. One card per behavior. Each card has a WHEN
// (trigger) block and a DO (action) block; multiple actions inside a
// card chain in order. Behaviors fire only when scene.previewMode is
// true; in edit mode they're inert metadata.

import { useStore } from '../../store'
import { Section, Row, Select, ColorRow } from './primitives'
import {
  TRIGGER_OPTIONS,
  getTriggerSchema,
  getActionSchema,
  getActionOptionGroups,
  defaultParamsFor
} from '../../behaviors/registry'
import { triggerGeneratesSwift, actionGeneratesSwift } from '../../export/behaviors'

let nextLocalId = 1
const newId = (prefix) => `${prefix}-${Date.now().toString(36)}-${nextLocalId++}`

// ---- Param row renderer ---------------------------------------------
//
// Picks the right primitive based on `param.type`. The `paramsHost`
// is the object whose key the row mutates ({ params } on a trigger or
// action). `onChange` writes the whole new params object back up.

function ParamRow({ param, value, onChange, items }) {
  const v = value === undefined ? param.default : value
  if (param.type === 'select') {
    return (
      <Row label={param.label}>
        <Select
          value={v}
          options={param.options}
          onChange={(nv) => onChange(param.key, nv)}
        />
      </Row>
    )
  }
  if (param.type === 'boolean') {
    return (
      <Row label={param.label}>
        <label className="flex items-center gap-1.5 cursor-pointer" title={param.hint}>
          <input
            type="checkbox"
            checked={!!v}
            onChange={(e) => onChange(param.key, e.target.checked)}
            className="w-3.5 h-3.5 cursor-pointer"
          />
          {param.hint && (
            <span className="text-[9px] text-textMute leading-tight">{param.hint}</span>
          )}
        </label>
      </Row>
    )
  }
  if (param.type === 'color') {
    return (
      <Row label={param.label}>
        <ColorRow value={v} onChange={(nv) => onChange(param.key, nv)} />
      </Row>
    )
  }
  if (param.type === 'vec3') {
    return (
      <Row label={param.label}>
        <Vec3Field value={v || [0, 0, 0]} onChange={(nv) => onChange(param.key, nv)} />
      </Row>
    )
  }
  if (param.type === 'targetEntity') {
    return (
      <Row label={param.label}>
        <TargetEntitySelect
          value={v}
          allowSelf={param.allowSelf}
          allowUser={param.allowUser}
          items={items}
          onChange={(nv) => onChange(param.key, nv)}
        />
      </Row>
    )
  }
  if (param.type === 'eventName') {
    return (
      <Row label={param.label}>
        <input
          type="text"
          value={v ?? ''}
          onChange={(e) => onChange(param.key, e.target.value)}
          placeholder="event-1"
          className="field flex-1"
        />
      </Row>
    )
  }
  if (param.type === 'text') {
    return (
      <Row label={param.label}>
        <input
          type="text"
          value={v ?? ''}
          onChange={(e) => onChange(param.key, e.target.value)}
          className="field flex-1"
        />
      </Row>
    )
  }
  // Numeric variants share a shell with a unit suffix.
  const suffix = param.type === 'meters' ? 'm'
              : param.type === 'seconds' ? 's'
              : param.type === 'degrees' ? '°'
              : param.type === 'percent' ? '%'
              : ''
  return (
    <Row label={param.label}>
      <NumberInput
        value={v ?? 0}
        onChange={(nv) => onChange(param.key, nv)}
        suffix={suffix}
        step={param.step}
        min={param.min}
      />
    </Row>
  )
}

function NumberInput({ value, onChange, suffix, step, min }) {
  return (
    <div className="relative flex-1">
      <input
        type="number"
        value={value}
        step={step ?? 0.1}
        min={min}
        onChange={(e) => {
          const n = parseFloat(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
        className="field w-full"
      />
      {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-textMute pointer-events-none">{suffix}</span>}
    </div>
  )
}

function Vec3Field({ value, onChange }) {
  return (
    <div className="flex gap-1 flex-1">
      {['x', 'y', 'z'].map((axis, i) => (
        <input
          key={axis}
          type="number"
          step={0.05}
          value={value[i] ?? 0}
          onChange={(e) => {
            const n = parseFloat(e.target.value)
            const next = [...value]
            next[i] = Number.isFinite(n) ? n : 0
            onChange(next)
          }}
          className="field flex-1 min-w-0"
        />
      ))}
    </div>
  )
}

function TargetEntitySelect({ value, items, allowSelf, allowUser, onChange }) {
  const opts = []
  if (allowSelf) opts.push({ value: 'self', label: '— Self —' })
  if (allowUser) opts.push({ value: 'user', label: '— User (head) —' })
  opts.push({ value: '', label: '— Pick entity —' })
  for (const it of items) {
    if (it.type !== 'entity') continue
    if (it.entityKind !== 'model' && it.entityKind !== 'group' && it.entityKind !== 'attachment') continue
    opts.push({ value: it.id, label: it.name || it.id })
  }
  return <Select value={value || ''} options={opts} onChange={onChange} />
}

// ---- Trigger / action editors --------------------------------------

// Not everything in the behaviour vocabulary reaches the Swift export. The
// ones that don't are emitted as a documented "still to wire up" block naming
// the real RealityKit API — which is honest, but the designer used to find out
// only after exporting. `export/behaviors.js` owns the two predicates, so this
// warning and the generator cannot disagree about which is which.
function ExportNote({ generates, what }) {
  if (generates) return null
  return (
    <div className="text-[9px] text-amber-400/80 leading-snug pl-14">
      Previews here, but the Swift export documents this {what} rather than
      generating it — the file names the RealityKit API to finish it with.
    </div>
  )
}

function TriggerEditor({ trigger, onChange, items }) {
  const schema = getTriggerSchema(trigger?.type)
  const setType = (type) => {
    onChange({
      type,
      params: defaultParamsFor(getTriggerSchema(type))
    })
  }
  const setParam = (key, val) => {
    onChange({ ...trigger, params: { ...(trigger.params || {}), [key]: val } })
  }
  return (
    <div className="space-y-1.5">
      <Row label="Trigger">
        <Select
          value={trigger?.type || 'tap'}
          options={TRIGGER_OPTIONS}
          onChange={setType}
        />
      </Row>
      {schema?.params?.map((p) => {
        if (p.showWhen && !p.showWhen(trigger?.params || {})) return null
        return (
          <ParamRow
            key={p.key}
            param={p}
            value={(trigger?.params || {})[p.key]}
            onChange={setParam}
            items={items}
          />
        )
      })}
      {schema?.deviceOnly && (
        <div className="text-[9px] text-amber-400/80 leading-snug pl-14">
          Device-only gesture — preview maps it to a pointer fallback.
        </div>
      )}
      <ExportNote generates={triggerGeneratesSwift(trigger?.type || 'tap')} what="trigger" />
    </div>
  )
}

function ActionEditor({ action, onChange, onRemove, items, isOnly }) {
  const schema = getActionSchema(action?.type)
  const groups = getActionOptionGroups()
  const setType = (type) => {
    onChange({
      ...action,
      type,
      params: defaultParamsFor(getActionSchema(type))
    })
  }
  const setParam = (key, val) => {
    onChange({ ...action, params: { ...(action.params || {}), [key]: val } })
  }
  return (
    <div className="space-y-1.5 border-l border-border/60 pl-2">
      <Row label="Action">
        <select
          value={action?.type || 'scaleTo'}
          onChange={(e) => setType(e.target.value)}
          className="field flex-1 cursor-pointer"
        >
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {!isOnly && (
          <button
            onClick={onRemove}
            className="text-textMute hover:text-textBase text-[11px] px-1"
            title="Remove this action"
          >×</button>
        )}
      </Row>
      {schema?.params?.map((p) => {
        if (p.showWhen && !p.showWhen(action?.params || {})) return null
        return (
          <ParamRow
            key={p.key}
            param={p}
            value={(action?.params || {})[p.key]}
            onChange={setParam}
            items={items}
          />
        )
      })}
      <ExportNote generates={actionGeneratesSwift(action?.type || 'scaleTo')} what="action" />
    </div>
  )
}

// ---- Behavior card --------------------------------------------------

function BehaviorCard({ behavior, items, onChange, onRemove, index }) {
  const setTrigger = (trigger) => onChange({ ...behavior, trigger })
  const setAction = (i, action) => {
    const next = [...(behavior.actions || [])]
    next[i] = action
    onChange({ ...behavior, actions: next })
  }
  const removeAction = (i) => {
    const next = (behavior.actions || []).filter((_, idx) => idx !== i)
    onChange({ ...behavior, actions: next })
  }
  const addAction = () => {
    const fresh = {
      id: newId('act'),
      type: 'scaleTo',
      params: defaultParamsFor(getActionSchema('scaleTo'))
    }
    onChange({ ...behavior, actions: [...(behavior.actions || []), fresh] })
  }
  return (
    <div className="rounded border border-border/70 bg-surface2/40 p-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-textMute">
          Behavior {index + 1}
        </span>
        <button
          onClick={onRemove}
          className="text-textMute hover:text-rose-400 text-[11px] px-1"
          title="Remove behavior"
        >×</button>
      </div>
      <div className="space-y-1.5">
        <div className="text-[9px] uppercase tracking-wider text-textMute">When</div>
        <TriggerEditor
          trigger={behavior.trigger}
          onChange={setTrigger}
          items={items}
        />
      </div>
      <div className="space-y-1.5">
        <div className="text-[9px] uppercase tracking-wider text-textMute">Do</div>
        {(behavior.actions || []).map((a, i) => (
          <ActionEditor
            key={a.id || i}
            action={a}
            onChange={(na) => setAction(i, na)}
            onRemove={() => removeAction(i)}
            items={items}
            isOnly={(behavior.actions || []).length === 1}
          />
        ))}
        <button
          onClick={addAction}
          className="text-[10px] text-accent hover:underline pl-2"
        >+ Add another action</button>
      </div>
    </div>
  )
}

// ---- Section wrapper -----------------------------------------------

export function BehaviorsSection({ item }) {
  const updateItem = useStore((s) => s.updateItem)
  const items = useStore((s) => s.items)
  const previewMode = useStore((s) => !!s.scene?.previewMode)
  const behaviors = item.behaviors || []

  const setBehaviors = (next) => updateItem(item.id, { behaviors: next })

  const addBehavior = () => {
    const fresh = {
      id: newId('beh'),
      trigger: { type: 'tap', params: defaultParamsFor(getTriggerSchema('tap')) },
      actions: [{
        id: newId('act'),
        type: 'scaleTo',
        params: defaultParamsFor(getActionSchema('scaleTo'))
      }]
    }
    setBehaviors([...behaviors, fresh])
  }

  return (
    <Section title="Behaviors" defaultOpen={false}>
      <div className="space-y-2">
        <div className="text-[9px] text-textMute leading-snug">
          Triggers and actions only fire in <span className={previewMode ? 'text-emerald-400' : 'text-textBase'}>Preview mode</span>.
          {previewMode ? '' : ' Toggle Preview to test.'}
        </div>
        {behaviors.map((b, i) => (
          <BehaviorCard
            key={b.id || i}
            index={i}
            behavior={b}
            items={items}
            onChange={(nb) => {
              const next = [...behaviors]
              next[i] = nb
              setBehaviors(next)
            }}
            onRemove={() => setBehaviors(behaviors.filter((_, idx) => idx !== i))}
          />
        ))}
        <button
          onClick={addBehavior}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-dashed border-border/70 bg-surface2/30 hover:bg-surface2/60 hover:border-accent/60 text-[11px] text-textBase transition-colors"
        >
          <span className="text-accent text-[13px] leading-none">+</span>
          <span>Add behavior</span>
        </button>
      </div>
    </Section>
  )
}
