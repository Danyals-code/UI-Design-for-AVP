// Per-panel-type inspectors. Indexed by panelType, each entry returns a
// React fragment with the panel's type-specific sections. Generic
// scaffolding (Name, Modifiers, Symbol, Animation, Accessibility, Info)
// is rendered by PanelProps; this file handles only what's unique to each
// panel type.
//
// `INSPECTORS[type]` is called with a ctx object:
//   { item, scene, updateItem, applyTextStyle, switchPanelType }
// Per-type metadata lives in PANEL_META — keys: hasFill, frameMode,
// useTextModifiers, lockHeight, lockHeightHint.

import {
  Row, Section, IntField, PtField, Slider, ColorRow, Select
} from '../components/PropertiesPanel/primitives'
import {
  TextSection, LIST_STYLES, LIST_STYLE_ORDER, BUTTON_STYLES
} from '../components/PropertiesPanel/shared'

// ---- shared mini-inspectors -------------------------------------------

const ImageInspector = ({ item, updateItem, switchPanelType }) => (
  <Section title="Image">
    <Row label="Async">
      <div className="segmented flex-1">
        <button className={item.panelType === 'image' ? 'active' : ''} onClick={() => switchPanelType(item.id, 'image')}>Off</button>
        <button className={item.panelType === 'asyncimage' ? 'active' : ''} onClick={() => switchPanelType(item.id, 'asyncimage')}>On</button>
      </div>
    </Row>
    <Row label="Image">
      <label className="btn flex-1 justify-center cursor-pointer">
        {item.imageUrl ? 'Replace' : 'Upload'}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              const url = URL.createObjectURL(file)
              updateItem(item.id, { imageUrl: url })
            }
          }}
        />
      </label>
      {item.imageUrl && (
        <button className="btn btn-ghost" onClick={() => updateItem(item.id, { imageUrl: null })}>Clear</button>
      )}
    </Row>
    <Row label="URL">
      <input
        value={item.imageUrl || ''}
        onChange={(e) => updateItem(item.id, { imageUrl: e.target.value || null })}
        className="field flex-1"
        placeholder="https://..."
      />
    </Row>
    <Row label="Fit">
      <div className="segmented flex-1">
        <button className={(item.imageFit || 'fill') === 'fill' ? 'active' : ''} onClick={() => updateItem(item.id, { imageFit: 'fill' })} title="Scale to cover — crops edges (default)">Fill</button>
        <button className={item.imageFit === 'fit' ? 'active' : ''} onClick={() => updateItem(item.id, { imageFit: 'fit' })} title="Scale to fit — letterbox">Fit</button>
        <button className={item.imageFit === 'stretch' ? 'active' : ''} onClick={() => updateItem(item.id, { imageFit: 'stretch' })} title="Stretch to frame — ignores aspect">Stretch</button>
        <button className={item.imageFit === 'tile' ? 'active' : ''} onClick={() => updateItem(item.id, { imageFit: 'tile' })} title="Repeat image as tiles">Tile</button>
      </div>
    </Row>
  </Section>
)

const VariantSwitcher = ({ panelType, switchPanelType, item, label, options }) => (
  <Section title={label}>
    <Row label={label}>
      <Select value={panelType} options={options} onChange={(v) => switchPanelType(item.id, v)} />
    </Row>
  </Section>
)

const ShapeStrokeInspector = ({ item, updateItem }) => (
  <Section title="Stroke">
    <Row label="Color"><ColorRow value={item.strokeColor || '#000000'} onChange={(v) => updateItem(item.id, { strokeColor: v })} /></Row>
    <Row label="Width"><PtField value={item.strokeWidth ?? 0} onChange={(v) => updateItem(item.id, { strokeWidth: Math.max(0, v) })} /></Row>
  </Section>
)

const SHAPE_VARIANTS = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'unevenRoundedRect', label: 'Uneven Rounded' },
  { value: 'path', label: 'Path' },
  { value: 'linearGradient', label: 'Linear Gradient' },
  { value: 'radialGradient', label: 'Radial Gradient' },
  { value: 'angularGradient', label: 'Angular Gradient' }
]

const PICKER_VARIANTS = [
  { value: 'picker', label: 'Default' },
  { value: 'datepicker', label: 'Date Picker' },
  { value: 'colorpicker', label: 'Color Picker' }
]

const COLLECTION_VARIANTS = [
  { value: 'list', label: 'List' },
  { value: 'form', label: 'Form' },
  { value: 'groupbox', label: 'GroupBox' },
  { value: 'outlinegroup', label: 'Outline Group' }
]

// ---- registry ----------------------------------------------------------

export const INSPECTORS = {
  text: (ctx) => (
    <TextSection {...ctx} sectionTitle="Text" includeBody isText />
  ),

  link: (ctx) => (
    <TextSection {...ctx} sectionTitle="Text" includeBody isText />
  ),

  button: (ctx) => (
    <>
      <Section title="Button Style">
        <Row label="Style">
          <Select
            value={ctx.item.buttonStyle || 'bordered'}
            options={Object.entries(BUTTON_STYLES).map(([k, v]) => ({ value: k, label: v.label }))}
            onChange={(v) => ctx.updateItem(ctx.item.id, { buttonStyle: v })}
          />
        </Row>
      </Section>
      <TextSection {...ctx} sectionTitle="Label" includeBody />
    </>
  ),

  toggle: ({ item, updateItem }) => (
    <Section title="State">
      <Row label="Value">
        <div className="segmented flex-1">
          <button className={item.toggleOn ? 'active' : ''} onClick={() => updateItem(item.id, { toggleOn: true })}>On</button>
          <button className={!item.toggleOn ? 'active' : ''} onClick={() => updateItem(item.id, { toggleOn: false })}>Off</button>
        </div>
      </Row>
    </Section>
  ),

  segmented: ({ item, updateItem }) => (
    <Section title="Segments">
      <Row label="Items">
        <input
          value={(item.segments || []).join(', ')}
          onChange={(e) => updateItem(item.id, { segments: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          className="field flex-1"
        />
      </Row>
      <Row label="Selected">
        <IntField
          value={item.selectedSegment ?? 0}
          min={0}
          max={Math.max(0, (item.segments || []).length - 1)}
          onChange={(v) => updateItem(item.id, { selectedSegment: v })}
        />
      </Row>
    </Section>
  ),

  slideshow: (ctx) => (
    <>
      <Section title="Slides">
        <Row label="Count">
          <IntField value={ctx.item.slideCount || 3} min={1} max={10} onChange={(v) => ctx.updateItem(ctx.item.id, { slideCount: v })} />
        </Row>
        <Row label="Active">
          <IntField value={ctx.item.currentSlide ?? 0} min={0} max={(ctx.item.slideCount || 3) - 1} onChange={(v) => ctx.updateItem(ctx.item.id, { currentSlide: v })} />
        </Row>
        <Row label="Title">
          <input value={ctx.item.text || ''} onChange={(e) => ctx.updateItem(ctx.item.id, { text: e.target.value })} className="field flex-1" />
        </Row>
      </Section>
      <TextSection {...ctx} sectionTitle="Text" includeBody={false} />
    </>
  ),

  ticker: (ctx) => (
    <>
      <Section title="Ticker">
        <Row>
          <textarea
            value={ctx.item.text || ''}
            onChange={(e) => ctx.updateItem(ctx.item.id, { text: e.target.value })}
            rows={2}
            className="field resize-none"
          />
        </Row>
        <div className="text-[10px] text-textMute">Scrolls right-to-left during preview.</div>
      </Section>
      <TextSection {...ctx} sectionTitle="Text" includeBody={false} />
    </>
  ),

  image: ImageInspector,
  asyncimage: ImageInspector,

  search: ({ item, updateItem }) => (
    <Section title="Search">
      <Row label="Placeholder">
        <input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" />
      </Row>
    </Section>
  ),

  list: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="list" switchPanelType={switchPanelType} item={item} label="Collection" options={COLLECTION_VARIANTS} />
      <Section title="List">
        <Row label="Style">
          <Select
            value={item.listStyle || 'insetGrouped'}
            options={LIST_STYLE_ORDER.map((k) => ({ value: k, label: LIST_STYLES[k].label }))}
            onChange={(v) => updateItem(item.id, { listStyle: v })}
          />
        </Row>
        <div className="text-[10px] text-textMute leading-snug">
          Row height &amp; spacing are fixed by the list style. The list grows
          in height as you add rows; width stays user-editable.
        </div>
        <div className="text-[10px] text-textMute uppercase tracking-wider mt-2">Rows</div>
        {(item.rows || []).map((r, i) => (
          <div key={i} className="flex flex-col gap-1">
            <Row label={`#${i + 1}`}>
              <input
                value={r.title || ''}
                onChange={(e) => {
                  const next = [...item.rows]
                  next[i] = { ...r, title: e.target.value }
                  updateItem(item.id, { rows: next })
                }}
                placeholder="Title"
                className="field flex-1"
              />
            </Row>
            <Row label="">
              <input
                value={r.subtitle || ''}
                onChange={(e) => {
                  const next = [...item.rows]
                  next[i] = { ...r, subtitle: e.target.value }
                  updateItem(item.id, { rows: next })
                }}
                placeholder="Subtitle"
                className="field flex-1"
              />
              <button
                className="btn btn-icon btn-ghost"
                onClick={() => updateItem(item.id, { rows: item.rows.filter((_, j) => j !== i) })}
                title="Delete row"
              >×</button>
            </Row>
          </div>
        ))}
        <button
          className="btn w-full justify-center mt-1"
          onClick={() => updateItem(item.id, { rows: [...(item.rows || []), { title: `Item ${(item.rows?.length || 0) + 1}`, subtitle: '' }] })}
        >+ Add Row</button>
      </Section>
    </>
  ),

  table: ({ item, updateItem }) => (
    <Section title="Table">
      <Row label="Columns">
        <input
          value={(item.columns || []).join(', ')}
          onChange={(e) => updateItem(item.id, { columns: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          className="field flex-1"
        />
      </Row>
      <div className="text-[10px] text-textMute uppercase tracking-wider mt-1">Rows</div>
      {(item.rows || []).map((row, i) => (
        <Row key={i} label={`#${i + 1}`}>
          <input
            value={row.join(', ')}
            onChange={(e) => {
              const next = [...item.rows]
              next[i] = e.target.value.split(',').map(s => s.trim())
              updateItem(item.id, { rows: next })
            }}
            className="field flex-1"
          />
          <button
            className="btn btn-icon btn-ghost"
            onClick={() => updateItem(item.id, { rows: item.rows.filter((_, j) => j !== i) })}
          >×</button>
        </Row>
      ))}
      <button
        className="btn w-full justify-center"
        onClick={() => updateItem(item.id, { rows: [...(item.rows || []), (item.columns || []).map(() => '—')] })}
      >+ Add Row</button>
    </Section>
  ),

  menu: ({ item, updateItem }) => (
    <Section title="Menu">
      <Row label="Items">
        <textarea
          value={(item.menuItems || []).join('\n')}
          onChange={(e) => updateItem(item.id, { menuItems: e.target.value.split('\n').filter(Boolean) })}
          rows={4}
          className="field resize-none"
        />
      </Row>
      <div className="text-[10px] text-textMute">One item per line.</div>
    </Section>
  ),

  form: ({ item, switchPanelType }) => (
    <VariantSwitcher panelType="form" switchPanelType={switchPanelType} item={item} label="Collection" options={COLLECTION_VARIANTS} />
  ),

  groupbox: ({ item, switchPanelType }) => (
    <VariantSwitcher panelType="groupbox" switchPanelType={switchPanelType} item={item} label="Collection" options={COLLECTION_VARIANTS} />
  ),

  outlinegroup: ({ item, switchPanelType }) => (
    <VariantSwitcher panelType="outlinegroup" switchPanelType={switchPanelType} item={item} label="Collection" options={COLLECTION_VARIANTS} />
  ),

  progress: ({ item, updateItem }) => (
    <Section title="Progress">
      <Row label="Value">
        <Slider value={item.value ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => updateItem(item.id, { value: v })} />
      </Row>
    </Section>
  ),

  slider: ({ item, updateItem }) => (
    <Section title="Slider">
      <Row label="Value">
        <Slider value={item.sliderValue ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => updateItem(item.id, { sliderValue: v })} />
      </Row>
    </Section>
  ),

  stepper: ({ item, updateItem }) => (
    <Section title="Stepper">
      <Row label="Value"><IntField value={item.stepperValue ?? 0} min={item.stepperMin ?? 0} max={item.stepperMax ?? 100} onChange={(v) => updateItem(item.id, { stepperValue: v })} /></Row>
      <Row label="Min"><IntField value={item.stepperMin ?? 0} onChange={(v) => updateItem(item.id, { stepperMin: v })} /></Row>
      <Row label="Max"><IntField value={item.stepperMax ?? 100} onChange={(v) => updateItem(item.id, { stepperMax: v })} /></Row>
    </Section>
  ),

  gauge: ({ item, updateItem }) => (
    <Section title="Gauge">
      <Row label="Value"><Slider value={item.value ?? 0.5} min={0} max={1} step={0.01} onChange={(v) => updateItem(item.id, { value: v })} /></Row>
      <Row label="Label"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" placeholder="Displayed text" /></Row>
    </Section>
  ),

  // ---- Shapes ----
  rectangle: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="rectangle" switchPanelType={switchPanelType} item={item} label="Geometry" options={SHAPE_VARIANTS} />
      <ShapeStrokeInspector item={item} updateItem={updateItem} />
    </>
  ),
  circle: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="circle" switchPanelType={switchPanelType} item={item} label="Geometry" options={SHAPE_VARIANTS} />
      <ShapeStrokeInspector item={item} updateItem={updateItem} />
    </>
  ),
  capsule: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="capsule" switchPanelType={switchPanelType} item={item} label="Geometry" options={SHAPE_VARIANTS} />
      <ShapeStrokeInspector item={item} updateItem={updateItem} />
    </>
  ),
  ellipse: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="ellipse" switchPanelType={switchPanelType} item={item} label="Geometry" options={SHAPE_VARIANTS} />
      <ShapeStrokeInspector item={item} updateItem={updateItem} />
    </>
  ),
  path: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="path" switchPanelType={switchPanelType} item={item} label="Geometry" options={SHAPE_VARIANTS} />
      <ShapeStrokeInspector item={item} updateItem={updateItem} />
    </>
  ),
  unevenRoundedRect: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="unevenRoundedRect" switchPanelType={switchPanelType} item={item} label="Geometry" options={SHAPE_VARIANTS} />
      <Section title="Corner Radii">
        <Row label="Top L"><PtField value={item.topLeadingRadius ?? 0} onChange={(v) => updateItem(item.id, { topLeadingRadius: Math.max(0, v) })} /></Row>
        <Row label="Top R"><PtField value={item.topTrailingRadius ?? 0} onChange={(v) => updateItem(item.id, { topTrailingRadius: Math.max(0, v) })} /></Row>
        <Row label="Bot L"><PtField value={item.bottomLeadingRadius ?? 0} onChange={(v) => updateItem(item.id, { bottomLeadingRadius: Math.max(0, v) })} /></Row>
        <Row label="Bot R"><PtField value={item.bottomTrailingRadius ?? 0} onChange={(v) => updateItem(item.id, { bottomTrailingRadius: Math.max(0, v) })} /></Row>
      </Section>
      <ShapeStrokeInspector item={item} updateItem={updateItem} />
    </>
  ),

  // ---- Gradients ----
  linearGradient: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="linearGradient" switchPanelType={switchPanelType} item={item} label="Geometry" options={SHAPE_VARIANTS} />
      <Section title="Gradient">
        <Row label="From"><ColorRow value={item.gradientFrom || '#007aff'} onChange={(v) => updateItem(item.id, { gradientFrom: v })} /></Row>
        <Row label="To"><ColorRow value={item.gradientTo || '#af52de'} onChange={(v) => updateItem(item.id, { gradientTo: v })} /></Row>
        <Row label="Angle"><IntField value={item.gradientAngle || 180} min={0} max={360} onChange={(v) => updateItem(item.id, { gradientAngle: v })} /></Row>
      </Section>
    </>
  ),
  radialGradient: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="radialGradient" switchPanelType={switchPanelType} item={item} label="Geometry" options={SHAPE_VARIANTS} />
      <Section title="Gradient">
        <Row label="From"><ColorRow value={item.gradientFrom || '#007aff'} onChange={(v) => updateItem(item.id, { gradientFrom: v })} /></Row>
        <Row label="To"><ColorRow value={item.gradientTo || '#af52de'} onChange={(v) => updateItem(item.id, { gradientTo: v })} /></Row>
      </Section>
    </>
  ),
  angularGradient: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="angularGradient" switchPanelType={switchPanelType} item={item} label="Geometry" options={SHAPE_VARIANTS} />
      <Section title="Gradient">
        <Row label="From"><ColorRow value={item.gradientFrom || '#007aff'} onChange={(v) => updateItem(item.id, { gradientFrom: v })} /></Row>
        <Row label="To"><ColorRow value={item.gradientTo || '#af52de'} onChange={(v) => updateItem(item.id, { gradientTo: v })} /></Row>
      </Section>
    </>
  ),

  // ---- Presentations ----
  alert: ({ item, updateItem }) => (
    <Section title="Alert">
      <Row label="Title"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
      <Row label="Message"><textarea value={item.alertMessage || ''} onChange={(e) => updateItem(item.id, { alertMessage: e.target.value })} rows={2} className="field resize-none" /></Row>
      <Row label="Buttons">
        <input
          value={(item.alertButtons || []).join(', ')}
          onChange={(e) => updateItem(item.id, { alertButtons: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          className="field flex-1"
          placeholder="Cancel, OK"
        />
      </Row>
    </Section>
  ),

  sheet: ({ item, updateItem }) => (
    <Section title="Sheet">
      <Row label="Detent">
        <Select
          value={item.sheetDetent || 'large'}
          options={[
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' }
          ]}
          onChange={(v) => updateItem(item.id, { sheetDetent: v })}
        />
      </Row>
      <Row label="Content"><textarea value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} rows={2} className="field resize-none" /></Row>
    </Section>
  ),

  popover: ({ item, updateItem }) => (
    <Section title="Popover">
      <Row label="Content"><textarea value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} rows={2} className="field resize-none" /></Row>
    </Section>
  ),

  // ---- Phase 3 type editors ----
  label: ({ item, updateItem }) => (
    <Section title="Label">
      <Row label="Icon"><input value={item.iconName || ''} onChange={(e) => updateItem(item.id, { iconName: e.target.value })} className="field flex-1" placeholder="A" maxLength={2} /></Row>
      <Row label="Icon Color"><ColorRow value={item.iconColor || '#007aff'} onChange={(v) => updateItem(item.id, { iconColor: v })} /></Row>
    </Section>
  ),
  textfield: ({ item, updateItem }) => (
    <Section title="TextField">
      <Row label="Placeholder"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
    </Section>
  ),
  securefield: ({ item, updateItem }) => (
    <Section title="TextField">
      <Row label="Placeholder"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
      <Row label="Dots"><IntField value={item.dotCount || 8} min={1} max={20} onChange={(v) => updateItem(item.id, { dotCount: v })} /></Row>
    </Section>
  ),
  texteditor: ({ item, updateItem }) => (
    <Section title="TextEditor">
      <Row label="Lines"><IntField value={item.lineCount || 5} min={1} max={20} onChange={(v) => updateItem(item.id, { lineCount: v })} /></Row>
      <Row label="Placeholder"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
    </Section>
  ),
  picker: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="picker" switchPanelType={switchPanelType} item={item} label="Picker Type" options={PICKER_VARIANTS} />
      <Section title="Picker">
        <Row label="Label"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
        <Row label="Value"><input value={item.pickerValue || ''} onChange={(e) => updateItem(item.id, { pickerValue: e.target.value })} className="field flex-1" /></Row>
        <Row label="Options"><input value={(item.pickerOptions || []).join(', ')} onChange={(e) => updateItem(item.id, { pickerOptions: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} className="field flex-1" /></Row>
        <Row label="Style"><Select value={item.pickerStyle || 'menu'} options={[{value:'menu',label:'Menu'},{value:'segmented',label:'Segmented'},{value:'wheel',label:'Wheel'},{value:'inline',label:'Inline'}]} onChange={(v) => updateItem(item.id, { pickerStyle: v })} /></Row>
      </Section>
    </>
  ),
  datepicker: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="datepicker" switchPanelType={switchPanelType} item={item} label="Picker Type" options={PICKER_VARIANTS} />
      <Section title="DatePicker">
        <Row label="Label"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
        <Row label="Date"><input type="date" value={item.dateValue || ''} onChange={(e) => updateItem(item.id, { dateValue: e.target.value })} className="field flex-1" /></Row>
        <Row label="Style"><Select value={item.dateStyle || 'compact'} options={[{value:'compact',label:'Compact'},{value:'graphical',label:'Graphical'},{value:'wheel',label:'Wheel'}]} onChange={(v) => updateItem(item.id, { dateStyle: v })} /></Row>
      </Section>
    </>
  ),
  colorpicker: ({ item, updateItem, switchPanelType }) => (
    <>
      <VariantSwitcher panelType="colorpicker" switchPanelType={switchPanelType} item={item} label="Picker Type" options={PICKER_VARIANTS} />
      <Section title="ColorPicker">
        <Row label="Label"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
        <Row label="Color"><ColorRow value={item.pickedColor || '#ff0000'} onChange={(v) => updateItem(item.id, { pickedColor: v })} /></Row>
      </Section>
    </>
  ),
  contentUnavailable: ({ item, updateItem }) => (
    <Section title="Empty State">
      <Row label="Title"><input value={item.text || ''} onChange={(e) => updateItem(item.id, { text: e.target.value })} className="field flex-1" /></Row>
      <Row label="Subtitle"><input value={item.alertMessage || ''} onChange={(e) => updateItem(item.id, { alertMessage: e.target.value })} className="field flex-1" /></Row>
    </Section>
  )
}

// ---- per-type metadata ------------------------------------------------
//
// Used by PanelProps to decide which shared scaffolding to render:
//   hasFill          - render shared Appearance section
//   frameMode        - 'figma' (text/link), 'explicit' (default), 'none'
//   useTextModifiers - render TextModifiers vs UniversalModifiers
//   lockHeight       - hide Height field in explicit Frame
//   lockHeightHint   - replacement caption when lockHeight is set

const figmaFrame = { frameMode: 'figma', hasFill: false, useTextModifiers: true }
const explicitFrame = { frameMode: 'explicit', hasFill: true }

export const PANEL_META = {
  text: figmaFrame,
  link: figmaFrame,
  list: { ...explicitFrame, lockHeight: true, lockHeightHint: 'Height is auto — grows with the row count at the style\'s fixed row height.' },
  // Default for everything else: explicit frame + has fill + universal modifiers
}

export const getPanelMeta = (panelType) => PANEL_META[panelType] || explicitFrame
