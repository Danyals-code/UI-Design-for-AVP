// Stack inspector. Geometry kind (V/H/Z), layout, frame, sections,
// disclosure, navigation/TabView/Tab metadata, ornament attachment,
// environment, modifiers — and the NavigationSplitView controls when
// `splitStyle` is set on the stack.

import { useStore } from '../../store'
import { VStackIcon, HStackIcon, ZStackIcon } from '../icons'
import {
  STACK_TYPES,
  TEXT_STYLES,
  TEXT_STYLE_ORDER,
  TOOLBAR_PLACEMENTS
} from '../../appleSystem'
import {
  Row,
  Section,
  IntField,
  Slider,
  Select,
  SemanticColorPicker,
  StackAlignmentPicker,
  MaterialField
} from './primitives'
import { ModifierStack } from './ModifierStack'

export function StackProps({ item }) {
  const updateItem = useStore((s) => s.updateItem)
  const renameItem = useStore((s) => s.renameItem)
  const setSplitStyle = useStore((s) => s.setSplitStyle)
  const setSplitColumnVisibility = useStore((s) => s.setSplitColumnVisibility)
  const setSplitSearchable = useStore((s) => s.setSplitSearchable)
  const isSplit = !!item.splitStyle
  return (
    <div className="flex-1 overflow-y-auto scrollbar">
      {/* One section for everything stack-related: identity, kind,
          alignment, spacing, padding, sizing, scroll. Previously
          split across "Stack" + "Layout" which made the user hunt
          between two dropdowns for related properties. */}
      <Section title={isSplit ? 'Navigation Split View' : 'Stack'} defaultOpen={true}>
        <Row label="Name">
          <input value={item.name} onChange={(e) => renameItem(item.id, e.target.value)} className="field flex-1" />
        </Row>
        {isSplit ? (
          <>
            <Row label="Style">
              <div className="segmented flex-1">
                <button
                  className={item.splitStyle === 'joined' ? 'active' : ''}
                  onClick={() => setSplitStyle(item.id, 'joined')}
                >Joined</button>
                <button
                  className={item.splitStyle === 'separated' ? 'active' : ''}
                  onClick={() => setSplitStyle(item.id, 'separated')}
                >Separated</button>
              </div>
            </Row>
            <div className="text-[10px] text-textMute leading-relaxed mt-1">
              {item.splitStyle === 'joined'
                ? 'Flush two-column layout — sidebar attached, 320pt wide.'
                : 'Sidebar as a 370pt floating dialogue (r=30) inside the window.'}
            </div>
            <Row label="Columns">
              <div className="segmented flex-1">
                <button
                  className={(item.columnVisibility || 'all') === 'all' ? 'active' : ''}
                  onClick={() => setSplitColumnVisibility(item.id, 'all')}
                >All</button>
                <button
                  className={item.columnVisibility === 'doubleColumn' ? 'active' : ''}
                  onClick={() => setSplitColumnVisibility(item.id, 'doubleColumn')}
                >Double</button>
                <button
                  className={item.columnVisibility === 'detailOnly' ? 'active' : ''}
                  onClick={() => setSplitColumnVisibility(item.id, 'detailOnly')}
                >Detail</button>
              </div>
            </Row>
            <Row label="Search">
              <div className="segmented flex-1">
                <button
                  className={(item.searchable || 'none') === 'none' ? 'active' : ''}
                  onClick={() => setSplitSearchable(item.id, 'none')}
                >Off</button>
                <button
                  className={item.searchable === 'sidebar' ? 'active' : ''}
                  onClick={() => setSplitSearchable(item.id, 'sidebar')}
                >Sidebar</button>
                <button
                  className={item.searchable === 'toolbar' ? 'active' : ''}
                  onClick={() => setSplitSearchable(item.id, 'toolbar')}
                >Toolbar</button>
              </div>
            </Row>
            <NavSplitHeaderRow item={item} />
          </>
        ) : (
          <Row label="Kind">
            <div className="segmented flex-1">
              <button
                className={item.stackType === 'vstack' ? 'active' : ''}
                onClick={() => updateItem(item.id, { stackType: 'vstack', alignment: 'center' })}
              ><VStackIcon /> VStack</button>
              <button
                className={item.stackType === 'hstack' ? 'active' : ''}
                onClick={() => updateItem(item.id, { stackType: 'hstack', alignment: 'center' })}
              ><HStackIcon /> HStack</button>
              <button
                className={item.stackType === 'zstack' ? 'active' : ''}
                onClick={() => updateItem(item.id, { stackType: 'zstack', alignment: 'center' })}
              ><ZStackIcon /> ZStack</button>
            </div>
          </Row>
        )}
        {!isSplit && <div className="text-[9px] text-textMute uppercase tracking-wider mt-3 mb-1">Layout</div>}
        {!isSplit && <Row label="Align">
          <StackAlignmentPicker
            stackType={item.stackType}
            value={item.alignment}
            onChange={(v) => updateItem(item.id, { alignment: v })}
          />
        </Row>}
        {!isSplit && (<>
        {item.stackType !== 'zstack' && (
          <Row label="Spacing">
            {/*
              SwiftUI default for VStack/HStack `spacing` is `nil` — the system
              picks a context-adaptive value at layout time. We model that as
              `spacing === null` and let the user explicitly opt into a fixed
              point value. The ⨯ button clears the override and returns to
              system spacing (matches SwiftUI's `VStack { ... }` zero-arg form).
            */}
            <IntField
              value={item.spacing == null ? 0 : item.spacing}
              min={0}
              onChange={(v) => updateItem(item.id, { spacing: v })}
            />
            <span className="text-[9px] text-textMute">
              {item.spacing == null ? 'pt · auto' : 'pt'}
            </span>
            <button
              className={`btn btn-ghost text-[9px] ${item.spacing == null ? 'text-accent' : ''}`}
              title="Use SwiftUI's system-adaptive spacing (`spacing: nil`)"
              onClick={() =>
                updateItem(item.id, { spacing: item.spacing == null ? 8 : null })
              }
            >Auto</button>
          </Row>
        )}
        <Row label="Padding">
          <IntField value={item.paddingEdges ? -1 : item.padding} min={0} onChange={(v) => updateItem(item.id, { padding: v, paddingEdges: null })} />
          <span className="text-[9px] text-textMute">pt</span>
          <button
            className={`btn btn-ghost text-[9px] ${item.paddingEdges ? 'text-accent' : ''}`}
            onClick={() => {
              if (item.paddingEdges) {
                updateItem(item.id, { paddingEdges: null })
              } else {
                const p = item.padding || 0
                updateItem(item.id, { paddingEdges: { top: p, bottom: p, leading: p, trailing: p } })
              }
            }}
            title="Per-edge padding"
          >4-edge</button>
        </Row>
        {item.paddingEdges && (
          <div className="grid grid-cols-2 gap-1 mt-1">
            <Row label="Top"><IntField value={item.paddingEdges.top ?? 0} min={0} onChange={(v) => updateItem(item.id, { paddingEdges: { ...item.paddingEdges, top: v } })} /></Row>
            <Row label="Bottom"><IntField value={item.paddingEdges.bottom ?? 0} min={0} onChange={(v) => updateItem(item.id, { paddingEdges: { ...item.paddingEdges, bottom: v } })} /></Row>
            <Row label="Leading"><IntField value={item.paddingEdges.leading ?? 0} min={0} onChange={(v) => updateItem(item.id, { paddingEdges: { ...item.paddingEdges, leading: v } })} /></Row>
            <Row label="Trailing"><IntField value={item.paddingEdges.trailing ?? 0} min={0} onChange={(v) => updateItem(item.id, { paddingEdges: { ...item.paddingEdges, trailing: v } })} /></Row>
          </div>
        )}
        {(item.stackType === 'grid' || item.stackType === 'lazyVGrid' || item.stackType === 'lazyHGrid') && (
          <>
            <Row label="Sizing">
              <div className="segmented flex-1">
                <button
                  className={(item.gridMode || 'fixed') === 'fixed' ? 'active' : ''}
                  onClick={() => updateItem(item.id, { gridMode: 'fixed' })}
                >Fixed</button>
                <button
                  className={item.gridMode === 'adaptive' ? 'active' : ''}
                  onClick={() => updateItem(item.id, { gridMode: 'adaptive' })}
                >Adaptive</button>
              </div>
            </Row>
            {(item.gridMode || 'fixed') === 'fixed' ? (
              <Row label={item.stackType === 'lazyHGrid' ? 'Rows' : 'Columns'}>
                <IntField value={item.columns || 2} min={1} max={12} onChange={(v) => updateItem(item.id, { columns: v })} />
              </Row>
            ) : (
              <Row label="Min">
                <IntField value={item.minColumnWidth ?? 140} min={40} max={600} onChange={(v) => updateItem(item.id, { minColumnWidth: v })} />
                <span className="text-[9px] text-textMute">pt</span>
              </Row>
            )}
          </>
        )}
        {item.stackType === 'scrollView' && (
          <>
            {/*
              Spec §1.24 — `ScrollView(_ axes:, showsIndicators:)`. Default
              axis is `.vertical`; indicators default to true. Both fields
              feed the SwiftUI exporter so the generated code matches.
            */}
            <Row label="Axis">
              <div className="segmented flex-1">
                <button className={(item.scrollAxis || 'vertical') === 'vertical' ? 'active' : ''} onClick={() => updateItem(item.id, { scrollAxis: 'vertical' })}>Vertical</button>
                <button className={item.scrollAxis === 'horizontal' ? 'active' : ''} onClick={() => updateItem(item.id, { scrollAxis: 'horizontal' })}>Horizontal</button>
                <button className={item.scrollAxis === 'both' ? 'active' : ''} onClick={() => updateItem(item.id, { scrollAxis: 'both' })}>Both</button>
              </div>
            </Row>
            <Row label="Indicators">
              <div className="segmented flex-1">
                <button className={(item.scrollShowsIndicators ?? true) ? 'active' : ''} onClick={() => updateItem(item.id, { scrollShowsIndicators: true })}>Show</button>
                <button className={!(item.scrollShowsIndicators ?? true) ? 'active' : ''} onClick={() => updateItem(item.id, { scrollShowsIndicators: false })}>Hide</button>
              </div>
            </Row>
          </>
        )}
        {item.stackType === 'viewThatFits' && (
          <Row label="Fits Axes">
            {/*
              `in:` defaults to `[.horizontal, .vertical]`. Spec §1.24 —
              the runtime evaluates each child against the available space
              along these axes and picks the first that fits.
            */}
            <div className="segmented flex-1">
              <button className={(item.fitsAxes || 'both') === 'both' ? 'active' : ''} onClick={() => updateItem(item.id, { fitsAxes: 'both' })}>Both</button>
              <button className={item.fitsAxes === 'horizontal' ? 'active' : ''} onClick={() => updateItem(item.id, { fitsAxes: 'horizontal' })}>H Only</button>
              <button className={item.fitsAxes === 'vertical' ? 'active' : ''} onClick={() => updateItem(item.id, { fitsAxes: 'vertical' })}>V Only</button>
            </div>
          </Row>
        )}
        {/* Size sub-block — was its own "Frame" section. Putting it under
            Layout keeps every "how does this stack take space" knob
            (align / spacing / padding / size) in one inspector header
            instead of two. */}
        <div className="text-[9px] text-textMute uppercase tracking-wider mt-3 mb-1">Size</div>
        {(() => {
          const wMode = item.widthMode || (item.fixedWidth != null ? 'fixed' : 'fit')
          return (
            <Row label="Width">
              <div className="segmented flex-1">
                <button
                  className={wMode === 'fit' ? 'active' : ''}
                  onClick={() => updateItem(item.id, { widthMode: 'fit', fixedWidth: null })}
                  title="Hug contents"
                >Fit</button>
                <button
                  className={wMode === 'fixed' ? 'active' : ''}
                  onClick={() => updateItem(item.id, { widthMode: 'fixed', fixedWidth: item.fixedWidth ?? 300 })}
                  title=".frame(width:)"
                >Fixed</button>
                <button
                  className={wMode === 'fill' ? 'active' : ''}
                  onClick={() => updateItem(item.id, { widthMode: 'fill' })}
                  title=".frame(maxWidth: .infinity)"
                >Fill</button>
              </div>
            </Row>
          )
        })()}
        {(item.widthMode || (item.fixedWidth != null ? 'fixed' : 'fit')) === 'fixed' && (
          <Row label="W">
            <div className="flex-1">
              <input
                type="number"
                step={1}
                min={0}
                placeholder="pt"
                value={item.fixedWidth ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : parseFloat(e.target.value)
                  updateItem(item.id, { fixedWidth: isNaN(v) ? null : Math.max(0, v) })
                }}
                className="field"
              />
            </div>
            <span className="text-[9px] text-textMute">pt</span>
          </Row>
        )}
        {(() => {
          const hMode = item.heightMode || (item.fixedHeight != null ? 'fixed' : 'fit')
          return (
            <Row label="Height">
              <div className="segmented flex-1">
                <button
                  className={hMode === 'fit' ? 'active' : ''}
                  onClick={() => updateItem(item.id, { heightMode: 'fit', fixedHeight: null })}
                  title="Hug contents"
                >Fit</button>
                <button
                  className={hMode === 'fixed' ? 'active' : ''}
                  onClick={() => updateItem(item.id, { heightMode: 'fixed', fixedHeight: item.fixedHeight ?? 200 })}
                  title=".frame(height:)"
                >Fixed</button>
                <button
                  className={hMode === 'fill' ? 'active' : ''}
                  onClick={() => updateItem(item.id, { heightMode: 'fill' })}
                  title=".frame(maxHeight: .infinity)"
                >Fill</button>
              </div>
            </Row>
          )
        })()}
        {(item.heightMode || (item.fixedHeight != null ? 'fixed' : 'fit')) === 'fixed' && (
          <Row label="H">
            <div className="flex-1">
              <input
                type="number"
                step={1}
                min={0}
                placeholder="pt"
                value={item.fixedHeight ?? ''}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : parseFloat(e.target.value)
                  updateItem(item.id, { fixedHeight: isNaN(v) ? null : Math.max(0, v) })
                }}
                className="field"
              />
            </div>
            <span className="text-[9px] text-textMute">pt</span>
          </Row>
        )}
        {/* Scrollable — moved out of its own section so all the
            "how does the stack take + use space" knobs live under
            Layout. Draws a trailing-edge indicator while on. */}
        <div className="text-[9px] text-textMute uppercase tracking-wider mt-3 mb-1">Scroll</div>
        <Row label="Scrollable">
          <div className="segmented flex-1">
            <button className={item.scrollable ? 'active' : ''} onClick={() => updateItem(item.id, { scrollable: true })}>On</button>
            <button className={!item.scrollable ? 'active' : ''} onClick={() => updateItem(item.id, { scrollable: false })}>Off</button>
          </div>
        </Row>
        <div className="text-[10px] text-textMute leading-relaxed mt-1">
          {STACK_TYPES[item.stackType]?.description}
        </div>
        </>)}
      </Section>
      {isSplit && <NavSplitConfig item={item} />}

      {item.stackType === 'section' && (
        <Section title="Section">
          <Row label="Header">
            <input value={item.sectionHeader || ''} onChange={(e) => updateItem(item.id, { sectionHeader: e.target.value })} className="field flex-1" placeholder="Section Title" />
          </Row>
          <Row label="Footer">
            <input value={item.sectionFooter || ''} onChange={(e) => updateItem(item.id, { sectionFooter: e.target.value })} className="field flex-1" placeholder="Optional footnote" />
          </Row>
        </Section>
      )}

      {item.stackType === 'disclosure' && (
        <Section title="Disclosure">
          <Row label="Label">
            <input value={item.disclosureLabel || ''} onChange={(e) => updateItem(item.id, { disclosureLabel: e.target.value })} className="field flex-1" />
          </Row>
          <Row label="Expanded">
            <div className="segmented flex-1">
              <button className={item.expanded ? 'active' : ''} onClick={() => updateItem(item.id, { expanded: true })}>Open</button>
              <button className={!item.expanded ? 'active' : ''} onClick={() => updateItem(item.id, { expanded: false })}>Closed</button>
            </div>
          </Row>
        </Section>
      )}

      {item.stackType === 'navigationStack' && (
        <Section title="Navigation">
          <Row label="Title">
            <input value={item.navTitle || ''} onChange={(e) => updateItem(item.id, { navTitle: e.target.value })} className="field flex-1" placeholder="Navigation Title" />
          </Row>
          <Row label="Active">
            <IntField value={item.activeChild ?? 0} min={0} onChange={(v) => updateItem(item.id, { activeChild: v })} />
          </Row>
        </Section>
      )}

      {item.stackType === 'tabView' && (
        <Section title="Navigation Stack (TabView)">
          <div className="text-[10px] text-textMute mb-2">
            Only the active Tab is visible at a time. Add Tab children in the layers panel.
          </div>
          <Row label="Active Tab">
            <IntField value={item.activeTab ?? 0} min={0} onChange={(v) => updateItem(item.id, { activeTab: v })} />
            <span className="text-[9px] text-textMute">index</span>
          </Row>
        </Section>
      )}

      {/* Spec §1.26 — Toolbar items declare a placement (.principal,
          .topBarLeading, .bottomOrnament, etc.). On visionOS the
          .bottomOrnament placement materialises the bottom-edge ornament
          look. */}
      {(item.stackType === 'toolbarItem' || item.stackType === 'toolbarItemGroup') && (
        <Section title="Toolbar Placement">
          <Row label="Placement">
            <select
              value={item.toolbarPlacement || 'automatic'}
              onChange={(e) => updateItem(item.id, { toolbarPlacement: e.target.value })}
              className="field flex-1 cursor-pointer"
            >
              {/* One list, from the same table the canvas zones by, so a
                  placement cannot be offered here without somewhere to draw. */}
              {Object.entries(TOOLBAR_PLACEMENTS).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Row>
          <div className="text-[10px] text-textMute leading-snug mt-1">
            Drop interactive children inside this placement; the exporter wraps them in <code>ToolbarItem(placement:)</code>.
          </div>
        </Section>
      )}

      {item.stackType === 'tab' && (
        <Section title="Tab">
          <Row label="Label">
            <input
              value={item.tabLabel || ''}
              onChange={(e) => updateItem(item.id, { tabLabel: e.target.value })}
              className="field flex-1"
              placeholder="Tab name"
            />
          </Row>
          <Row label="Icon">
            <input
              value={item.tabIcon || ''}
              onChange={(e) => updateItem(item.id, { tabIcon: e.target.value || null })}
              className="field flex-1"
              placeholder="SF Symbol name (e.g. star)"
            />
          </Row>
          <div className="text-[10px] text-textMute mt-1">
            Use any SF Symbol name. The parent TabView controls which tab is active.
          </div>
        </Section>
      )}

      {/* Frame moved into the Layout section above as a Size sub-block. */}

      {!isSplit && <Section title="Ornament" defaultOpen={false}>
        <div className="text-[9px] text-textMute mb-1">attachmentAnchor — required (spec §1.26)</div>
        {/*
          Spec §1.26 / §3.4 — `OrnamentAttachmentAnchor` factories are
          `.scene(UnitPoint3D)` (the visionOS default; renders in the
          scene-relative coordinate space) or `.parent(_:)` (visionOS 26+;
          anchored to the owning view). Both share the same UnitPoint3D
          values, so we expose the mode separately from the anchor edge.
        */}
        <Row label="Mode">
          <div className="segmented flex-1">
            <button
              className={(item.ornamentAnchorMode || 'scene') === 'scene' ? 'active' : ''}
              onClick={() => updateItem(item.id, { ornamentAnchorMode: 'scene' })}
            >.scene</button>
            <button
              className={item.ornamentAnchorMode === 'parent' ? 'active' : ''}
              onClick={() => updateItem(item.id, { ornamentAnchorMode: 'parent' })}
              title="visionOS 26+ — anchors to the owning view"
            >.parent</button>
          </div>
        </Row>
        <Row label="Anchor">
          <Select
            value={item.ornament || ''}
            options={[
              { value: '',                label: '— None —' },
              { value: 'leading',         label: '.leading' },
              { value: 'trailing',        label: '.trailing' },
              { value: 'top',             label: '.top' },
              { value: 'bottom',          label: '.bottom' },
              { value: 'topLeading',      label: '.topLeading' },
              { value: 'topTrailing',     label: '.topTrailing' },
              { value: 'bottomLeading',   label: '.bottomLeading' },
              { value: 'bottomTrailing',  label: '.bottomTrailing' },
              { value: 'center',          label: '.center' }
            ]}
            onChange={(v) => updateItem(item.id, { ornament: v || null })}
          />
        </Row>
        <div className="text-[9px] text-textMute mt-2 mb-1">contentAlignment — ornament's own alignment</div>
        <Row label="Alignment">
          <Select
            value={item.ornamentContentAlignment || 'center'}
            options={[
              { value: 'center',        label: '.center' },
              { value: 'leading',       label: '.leading' },
              { value: 'trailing',      label: '.trailing' },
              { value: 'top',           label: '.top' },
              { value: 'bottom',        label: '.bottom' },
              { value: 'topLeading',    label: '.topLeading' },
              { value: 'topTrailing',   label: '.topTrailing' },
              { value: 'bottomLeading', label: '.bottomLeading' },
              { value: 'bottomTrailing',label: '.bottomTrailing' }
            ]}
            onChange={(v) => updateItem(item.id, { ornamentContentAlignment: v })}
          />
        </Row>
        <div className="text-[9px] text-textMute mt-2 mb-1">visibility</div>
        <Row label="Visibility">
          <div className="segmented flex-1">
            {['automatic', 'visible', 'hidden'].map((v) => (
              <button
                key={v}
                className={(item.ornamentVisibility || 'automatic') === v ? 'active' : ''}
                onClick={() => updateItem(item.id, { ornamentVisibility: v })}
              >{v}</button>
            ))}
          </div>
        </Row>
        <div className="text-[9px] text-textMute mt-2 mb-1">offsetFromBoundary</div>
        <Row label="Offset">
          <IntField value={item.ornamentOffset ?? 0} onChange={(v) => updateItem(item.id, { ornamentOffset: v })} />
          <span className="text-[9px] text-textMute">pt</span>
        </Row>
        <div className="text-[9px] text-textMute mt-2 mb-1">Background &amp; Material</div>
        <Row label="Background">
          <SemanticColorPicker
            token={item.background}
            onChange={(t) => updateItem(item.id, { background: t })}
          />
        </Row>
        <Row label="Material">
          <MaterialField
            value={item.material}
            fallback="regular"
            onChange={(v) => updateItem(item.id, { material: v })}
          />
        </Row>
        {/* Background Blur — pairs with the Material picker so any
            material on the stack can read as a frosted backdrop. The
            renderer overlays a soft white frost; export maps to
            `.background(.regularMaterial)` with the radius below. */}
        <Row label="Blur">
          <div className="segmented flex-1">
            <button
              className={item.blur ? 'active' : ''}
              onClick={() => updateItem(item.id, { blur: true })}
              title="Frosted glass — softens the backdrop"
            >On</button>
            <button
              className={!item.blur ? 'active' : ''}
              onClick={() => updateItem(item.id, { blur: false })}
            >Off</button>
          </div>
        </Row>
        {item.blur && (
          <Row label="Amount">
            <Slider
              value={item.blurAmount ?? 12}
              min={0} max={40} step={1} suffix="pt"
              onChange={(v) => updateItem(item.id, { blurAmount: v })}
            />
          </Row>
        )}
      </Section>}

      {/* Scroll View was its own section; rolled into Layout as a sub-
          option so a designer doesn't have to expand a second header
          just to flip a one-knob scrollable on/off. */}

      {!isSplit && <Section title="Environment" defaultOpen={false}>
        <Row label="Font"><Select value={item.environment?.font || ''} options={[{ value: '', label: '— Inherit —' }, ...TEXT_STYLE_ORDER.map((k) => ({ value: k, label: TEXT_STYLES[k].label }))]} onChange={(v) => updateItem(item.id, { environment: { ...item.environment, font: v || null } })} /></Row>
        <Row label="Foreground"><SemanticColorPicker token={item.environment?.foregroundStyle} onChange={(t) => updateItem(item.id, { environment: { ...item.environment, foregroundStyle: t } })} /></Row>
        <Row label="Direction">
          <div className="segmented flex-1">
            <button className={(item.environment?.layoutDirection || 'leftToRight') === 'leftToRight' ? 'active' : ''} onClick={() => updateItem(item.id, { environment: { ...item.environment, layoutDirection: 'leftToRight' } })}>LTR</button>
            <button className={(item.environment?.layoutDirection) === 'rightToLeft' ? 'active' : ''} onClick={() => updateItem(item.id, { environment: { ...item.environment, layoutDirection: 'rightToLeft' } })}>RTL</button>
          </div>
        </Row>
        <Row label="Locale"><input value={item.environment?.locale || ''} onChange={(e) => updateItem(item.id, { environment: { ...item.environment, locale: e.target.value } })} className="field flex-1" placeholder="en-US" /></Row>
      </Section>}

      {!isSplit && <ModifierStack item={item} updateItem={updateItem} />}
      {/* Info section removed — the internal ID was developer plumbing
          that didn't help the user and added a header to scroll past. */}
    </div>
  )
}

// ---- NavigationSplitView inspector --------------------------------------
//
// Drives the structural pieces the sidebar wizard creates. The user
// asked for these to live in the inspector instead of the layer tree —
// the tree shows only the NavSplitView + its destination stacks, and
// the header, section headings, and item counts are edited here.
//
// All edits mutate the underlying items in the store directly so the
// renderer continues to draw from the items array (no data-model
// rewrite required). When an item count changes we keep the sidebar
// list rows in sync with destination stacks (one navTag-linked pair
// per nav link).

// Inline trash button used for inspector delete actions. Same visual
// language as the eye toggle so the row chrome reads as a small,
// production-ready icon cluster rather than a sprinkle of × glyphs.
function TrashButton({ onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="btn btn-ghost"
      style={{ width: 22, height: 22, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#ff453a' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = '' }}
    >
      <svg width="11" height="12" viewBox="0 0 14 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 4h10M5 4V2.5C5 2 5.5 1.5 6 1.5h2c.5 0 1 .5 1 1V4M3.5 4l.5 9c.05.7.6 1.5 1.5 1.5h4c.9 0 1.45-.8 1.5-1.5L11.5 4M6 7v5M8 7v5" />
      </svg>
    </button>
  )
}

// Small +-button used to add items / groups inline. Matches the visual
// weight of the eye + trash buttons so the action cluster stays even.
function PlusButton({ onClick, title, label, fill = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="btn btn-ghost"
      style={{
        height: 22, padding: label ? '0 8px 0 6px' : 0,
        width: label ? 'auto' : 22,
        display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'center',
        background: fill ? 'rgba(255,255,255,0.06)' : 'transparent',
        border: fill ? '1px solid rgba(255,255,255,0.10)' : 'none',
        borderRadius: 5
      }}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M6 2v8M2 6h8" />
      </svg>
      {label && <span style={{ fontSize: 10.5 }}>{label}</span>}
    </button>
  )
}

// Small eye-button used inline next to NavSplitView header / item rows.
function EyeToggle({ on, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="btn btn-ghost"
      style={{ width: 22, height: 22, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {on ? (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
          <circle cx="8" cy="8" r="2" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
          <path d="M2 2l12 12" />
          <path d="M1 8s2.5-5 7-5c1.2 0 2.3.3 3.2.8" />
          <path d="M15 8s-2.5 5-7 5c-1.2 0-2.3-.3-3.2-.8" />
        </svg>
      )}
    </button>
  )
}

// Header row inside the NavSplitView "Foundation" section. Combines the
// header visibility toggle, the title input, and the Edit-button
// visibility toggle into a single row — per user spec, no separate
// "Show header" segmented control.
function NavSplitHeaderRow({ item }) {
  const items = useStore((s) => s.items)
  const updateItem = useStore((s) => s.updateItem)
  const header = items.find((c) => c.parentId === item.id && c.name === 'Header' && c.slot === 'sidebar')
  if (!header) return null
  const headerKids = items.filter((c) => c.parentId === header.id)
  const headerTitle = headerKids.find((c) => c.name === 'Title')
  const editButton  = headerKids.find((c) => c.name === 'Edit')
  const showHeader  = header.visible !== false
  const showEdit    = editButton ? editButton.visible !== false : false
  return (
    <Row label="Header">
      <EyeToggle
        on={showHeader}
        onClick={() => updateItem(header.id, { visible: !showHeader })}
        title={showHeader ? 'Hide header' : 'Show header'}
      />
      <input
        value={headerTitle?.text || ''}
        onChange={(e) => headerTitle && updateItem(headerTitle.id, { text: e.target.value })}
        disabled={!showHeader || !headerTitle}
        className="field flex-1"
        placeholder="Title"
      />
      {editButton && (
        <EyeToggle
          on={showEdit}
          onClick={() => updateItem(editButton.id, { visible: !showEdit })}
          title={showEdit ? 'Hide Edit button' : 'Show Edit button'}
        />
      )}
    </Row>
  )
}

function NavSplitConfig({ item }) {
  const items = useStore((s) => s.items)
  const select = useStore((s) => s.select)
  const updateItem = useStore((s) => s.updateItem)
  const removeItem = useStore((s) => s.removeItem)

  // ---- shape inference ----
  // Walk the children (in document order, the same way the renderer
  // sees them) and bucket them: Header HStack first, then alternating
  // section-header text + list pairs, then detail destinations.
  const allChildren = items.filter((c) => c.parentId === item.id)
  const header = allChildren.find((c) => c.name === 'Header' && c.slot === 'sidebar')
  // The Header's own title / Edit-button toggles live in NavSplitHeaderRow,
  // which reads them straight off the tree — this component only needs to
  // know that a header exists so it can exclude it from the group pairing.

  // Pair section-header text panels with their following Group list.
  const sidebarChildren = allChildren.filter((c) => c.slot === 'sidebar' && c !== header)
  const groups = []
  let pendingHeader = null
  for (const sc of sidebarChildren) {
    if (sc.type === 'panel' && sc.panelType === 'text') {
      pendingHeader = sc
    } else if (sc.type === 'panel' && sc.panelType === 'list') {
      groups.push({ header: pendingHeader, list: sc })
      pendingHeader = null
    }
  }

  const destinations = allChildren.filter((c) => c.slot === 'detail')

  // Mint fresh, globally-unique navTags / destinations for new items.
  const SAMPLE_TITLES   = ['Inbox','Drafts','Sent','Archive','Trash','Spam','Junk','Important','Starred','Flagged','Outbox','All Mail']
  const SAMPLE_SYMBOLS  = ['tray','doc','paperplane','archivebox','trash','envelope','envelope.fill','flag','star','bookmark','tag','folder']
  const SAMPLE_COUNTERS = ['42','12','7','3','1','8','24','99','5','6','11','0']
  const SAMPLE_SECTION  = ['Inboxes','Mailboxes','Favourites','Tags','Smart Folders']

  const nextNavTag = () => {
    const used = new Set(items
      .filter((it) => it.navTag && /^dest-\d+$/.test(it.navTag))
      .map((it) => Number(it.navTag.replace('dest-', ''))))
    let n = 0
    while (used.has(n)) n++
    return `dest-${n}`
  }

  // Build a fresh detail-slot Destination stack for a new nav link so
  // the 1-to-1 mapping holds. Same shape the wizard builds.
  const makeDestination = (navTag, rowTitle) => ({
    id: `dest-${navTag}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'stack', stackType: 'vstack',
    name: `Destination ${destinations.length + 1} (${rowTitle})`,
    parentId: item.id,
    spacing: 16, padding: 32,
    widthMode: 'fill', heightMode: 'fill', alignment: 'leading',
    slot: 'detail', navTag,
    visible: false,
    modifiers: [], collapsed: false
  })

  const addRowToGroup = (groupListId, suggestedTitle) => {
    const list = items.find((it) => it.id === groupListId)
    if (!list) return
    const tag = nextNavTag()
    const idx = (list.rows || []).length
    const title = suggestedTitle || SAMPLE_TITLES[idx % SAMPLE_TITLES.length]
    const newRow = {
      title,
      subtitle: '',
      systemImage: SAMPLE_SYMBOLS[idx % SAMPLE_SYMBOLS.length],
      value: SAMPLE_COUNTERS[idx % SAMPLE_COUNTERS.length],
      navTag: tag
    }
    updateItem(groupListId, { rows: [...(list.rows || []), newRow] })
    const dest = makeDestination(tag, title)
    // Direct mutation: store doesn't expose a raw "append item" so we
    // piggy-back on updateItem against a sibling to trigger a state
    // refresh after we mutate items via setState. Simpler: read the
    // current state, append, write back via the store's set.
    useStore.setState((s) => ({ items: [...s.items, dest] }))
  }

  // Add a single top-level "direct" item — a row that lives outside
  // any named section. Appends to the first headerless list if one
  // exists, otherwise creates a new headerless list. Per the user's
  // spec: "we can directly items as well as groups and then items
  // within them."
  const addDirectItem = () => {
    const headerlessList = groups.find((g) => !g.header)?.list
    if (headerlessList) {
      addRowToGroup(headerlessList.id)
      return
    }
    const tag = nextNavTag()
    const listId = `panel-list-${Math.random().toString(36).slice(2, 7)}`
    const title = SAMPLE_TITLES[0]
    const listPanel = {
      id: listId, type: 'panel', panelType: 'list',
      name: 'Items',
      parentId: item.id, slot: 'sidebar',
      size: [288 / 1360, 0],
      listStyle: 'sidebar',
      rows: [{
        title,
        subtitle: '',
        systemImage: SAMPLE_SYMBOLS[0],
        value: SAMPLE_COUNTERS[0],
        navTag: tag
      }],
      visible: true, modifiers: [], collapsed: false
    }
    const dest = makeDestination(tag, title)
    useStore.setState((s) => ({ items: [...s.items, listPanel, dest] }))
  }

  const addGroup = () => {
    const gi = groups.length
    const sectionId = `panel-section-${Math.random().toString(36).slice(2, 7)}`
    const listId    = `panel-list-${Math.random().toString(36).slice(2, 7)}`
    const sectionPanel = {
      id: sectionId, type: 'panel', panelType: 'text',
      name: `Section ${gi + 1} Header`,
      parentId: item.id, slot: 'sidebar',
      text: SAMPLE_SECTION[gi] || 'Section Heading',
      textStyle: 'title3', fontSize: 20 / 1360,
      fontWeight: 'semibold', widthMode: 'fill', colorToken: 'primary',
      visible: true, modifiers: [], collapsed: false
    }
    const tag = nextNavTag()
    const listPanel = {
      id: listId, type: 'panel', panelType: 'list',
      name: `Group ${gi + 1}`,
      parentId: item.id, slot: 'sidebar',
      size: [288 / 1360, 0],
      listStyle: 'sidebar',
      rows: [{
        title: SAMPLE_TITLES[0],
        subtitle: '',
        systemImage: SAMPLE_SYMBOLS[0],
        value: SAMPLE_COUNTERS[0],
        navTag: tag
      }],
      visible: true, modifiers: [], collapsed: false
    }
    const dest = makeDestination(tag, SAMPLE_TITLES[0])
    useStore.setState((s) => ({ items: [...s.items, sectionPanel, listPanel, dest] }))
  }

  const removeRow = (groupListId, rowIdx) => {
    const list = items.find((it) => it.id === groupListId)
    if (!list) return
    const rows = list.rows || []
    const removed = rows[rowIdx]
    updateItem(groupListId, { rows: rows.filter((_, i) => i !== rowIdx) })
    // Drop the linked destination too — 1:1 mapping invariant.
    if (removed?.navTag) {
      const dest = items.find((it) => it.slot === 'detail' && it.navTag === removed.navTag)
      if (dest) useStore.setState((s) => ({
        items: s.items.filter((it) => it.id !== dest.id)
      }))
    }
  }

  return (
    <>
      <Section title="Hierarchy" defaultOpen={true}>
        {groups.length === 0 && (
          <div className="text-[10px] text-textMute leading-relaxed mb-2">
            Empty. Use the buttons below to add items or a section.
          </div>
        )}
        {groups.map((g) => {
          const rows = g.list.rows || []
          const headerVisible = g.header ? g.header.visible !== false : true
          const removeWholeGroup = () => {
            const tagsToDrop = new Set((rows).map((r) => r.navTag).filter(Boolean))
            if (g.header) removeItem(g.header.id)
            removeItem(g.list.id)
            useStore.setState((s) => ({
              items: s.items.filter((it) => !(it.slot === 'detail' && tagsToDrop.has(it.navTag)))
            }))
          }
          return (
            <div
              key={g.list.id}
              style={{
                marginBottom: 10,
                padding: '8px 8px 6px',
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: 6
              }}
            >
              {/* Group header — section title input + eye + trash, or a
                  "Items" label for direct (headerless) groups. */}
              {g.header ? (
                <div className="flex items-center gap-1.5 mb-2">
                  <EyeToggle
                    on={headerVisible}
                    onClick={() => updateItem(g.header.id, { visible: !headerVisible })}
                    title={headerVisible ? 'Hide section heading' : 'Show section heading'}
                  />
                  <input
                    value={g.header.text || ''}
                    onChange={(e) => updateItem(g.header.id, { text: e.target.value })}
                    className="field flex-1"
                    style={{ fontSize: 12, fontWeight: 600 }}
                    placeholder="Section heading"
                  />
                  <TrashButton onClick={removeWholeGroup} title="Remove this section" />
                </div>
              ) : (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-textMute uppercase" style={{ letterSpacing: 0.8, fontWeight: 600 }}>Items</span>
                  <TrashButton onClick={removeWholeGroup} title="Remove all direct items" />
                </div>
              )}
              {/* Item rows — icon glyph + title + counter + trash. */}
              <div className="flex flex-col gap-1">
                {rows.map((r, ri) => (
                  <div key={ri} className="flex items-center gap-1.5">
                    <input
                      value={r.systemImage || ''}
                      onChange={(e) => {
                        const next = rows.slice()
                        next[ri] = { ...next[ri], systemImage: e.target.value }
                        updateItem(g.list.id, { rows: next })
                      }}
                      className="field"
                      style={{
                        width: 60, fontSize: 10,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        textAlign: 'center',
                        color: '#5ac8fa'
                      }}
                      placeholder="icon"
                      title="SF Symbol name"
                    />
                    <input
                      value={r.title || ''}
                      onChange={(e) => {
                        const next = rows.slice()
                        next[ri] = { ...next[ri], title: e.target.value }
                        updateItem(g.list.id, { rows: next })
                      }}
                      className="field flex-1"
                      style={{ fontSize: 11 }}
                      placeholder="Title"
                    />
                    <input
                      value={r.value || ''}
                      onChange={(e) => {
                        const next = rows.slice()
                        next[ri] = { ...next[ri], value: e.target.value }
                        updateItem(g.list.id, { rows: next })
                      }}
                      className="field"
                      style={{ width: 36, fontSize: 11, textAlign: 'center', color: '#8e8e93' }}
                      placeholder="—"
                      title="Counter (leave empty for none)"
                    />
                    <TrashButton onClick={() => removeRow(g.list.id, ri)} title="Remove item" />
                  </div>
                ))}
                <div className="flex justify-end mt-1">
                  <PlusButton
                    onClick={() => addRowToGroup(g.list.id)}
                    title="Add an item to this section"
                    label="Item"
                  />
                </div>
              </div>
            </div>
          )
        })}
        <div className="flex gap-2 mt-2">
          <PlusButton onClick={addDirectItem} title="Add a top-level item (no section)" label="Item" fill />
          <PlusButton onClick={addGroup} title="Add a new section" label="Group" fill />
        </div>
      </Section>

      <Section title="Interaction" defaultOpen={true}>
        {(() => {
          // Flatten all rows across all groups so each sidebar link
          // gets one row here. The dropdown for a link offers every
          // destination — selecting one rebinds both the row's navTag
          // and the destination's navTag, preserving the 1-to-1
          // mapping (no two rows can point at the same destination).
          const allRows = []
          for (const g of groups) {
            for (let ri = 0; ri < (g.list.rows || []).length; ri++) {
              const r = g.list.rows[ri]
              allRows.push({ row: r, listId: g.list.id, rowIdx: ri })
            }
          }
          if (allRows.length === 0) {
            return (
              <div className="text-[10px] text-textMute leading-relaxed">
                No links yet. Add an item under Hierarchy to link a destination.
              </div>
            )
          }
          const rebind = (listId, rowIdx, fromTag, toTag) => {
            if (fromTag === toTag) return
            const list = items.find((it) => it.id === listId)
            if (!list) return
            const otherRow = (() => {
              for (const g of groups) {
                const idx = (g.list.rows || []).findIndex((r) => r.navTag === toTag)
                if (idx >= 0 && (g.list.id !== listId || idx !== rowIdx)) {
                  return { listId: g.list.id, idx }
                }
              }
              return null
            })()
            // Swap navTags so the mapping stays 1-to-1.
            const newRows = list.rows.slice()
            newRows[rowIdx] = { ...newRows[rowIdx], navTag: toTag }
            updateItem(listId, { rows: newRows })
            if (otherRow) {
              const other = items.find((it) => it.id === otherRow.listId)
              if (other) {
                const otherRows = other.rows.slice()
                otherRows[otherRow.idx] = { ...otherRows[otherRow.idx], navTag: fromTag }
                updateItem(otherRow.listId, { rows: otherRows })
              }
            }
          }
          return allRows.map(({ row, listId, rowIdx }) => {
            const linked = destinations.find((d) => d.navTag === row.navTag)
            return (
              <Row key={`${listId}-${rowIdx}`} label={row.title || `Item ${rowIdx + 1}`}>
                <select
                  value={row.navTag || ''}
                  onChange={(e) => rebind(listId, rowIdx, row.navTag, e.target.value)}
                  className="field flex-1 text-[11px]"
                >
                  {destinations.map((d) => (
                    <option key={d.id} value={d.navTag}>{d.name}</option>
                  ))}
                </select>
                {linked && (
                  <button
                    className="btn btn-ghost text-[10px]"
                    onClick={() => select(linked.id)}
                    title="Open destination in canvas"
                  >→</button>
                )}
              </Row>
            )
          })
        })()}
      </Section>
    </>
  )
}
