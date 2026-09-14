// Canvas ↔ export parity baseline — the known-divergence ledger.
//
// `parity.test.js` computes, from the live source, which fields each side
// actually reads. Any field read by exactly one side is a divergence, and
// every divergence must appear here with a tier and a reason. The test then
// asserts the computed set and this ledger match EXACTLY, which gives the
// property that makes this file worth maintaining:
//
//   • wire a new field into one side only  → test fails (add an entry, or
//     wire the other side)
//   • close a divergence but leave its entry → test fails (delete the entry)
//
// So the ledger can never silently grow, and it can never silently lie about
// work that is already done. `DEBT_CEILING` at the bottom is the ratchet:
// lower it as entries move out of DEBT.
//
// ---- tiers ----
//
//   EXEMPT  Correct as it stands. The field has no counterpart on the other
//           side and never will — editor state, preview-only state, or a
//           SwiftUI property that carries semantics rather than pixels.
//           Does NOT count as debt.
//
//   DEBT    A real divergence. The designer can set this and the two outputs
//           disagree. Close it by teaching the missing side about the field.
//
//   MIRROR  Two fields, one concept: each side reads a different one, and
//           something else keeps them in sync. Not wrong today, but a
//           standing trap — close it by unifying on one field, not by
//           teaching both sides about both.
//
// Reasons are written for the person who has to fix the entry, so they say
// what diverges, not just that something does. `AUDIT.md` §8 carries the
// numbered defect index referenced below.

export const EXEMPT = 'EXEMPT'
export const DEBT = 'DEBT'
export const MIRROR = 'MIRROR'

// Shorthand builders, so the tables below stay readable.
const ex = (why) => ({ tier: EXEMPT, why })
const debt = (why, defect = null) => ({ tier: DEBT, why, defect })
const mirror = (why, defect = null) => ({ tier: MIRROR, why, defect })

// ---------------------------------------------------------------------------
// Stack fields
// ---------------------------------------------------------------------------

export const STACK = {
  // -- preview / editor state, never part of the exported document ----------
  activeChild: ex('canvas-only: which ViewThatFits branch the preview shows'),
  activeTab: ex('canvas-only: selected in-window tab, a preview affordance'),
  collapsed: ex('neither: layers-tree disclosure state, pure editor chrome'),
  scrollY: ex('canvas-only: live scroll offset of the preview, not a document property'),
  scrollX: ex('canvas-only: live scroll offset of the preview, not a document property'),

  // -- material -------------------------------------------------------------
  blur: debt('canvas-only: frosted-glass toggle on a stack background is not emitted'),
  blurAmount: debt('canvas-only: blur radius is not emitted'),

  // -- disclosure -----------------------------------------------------------
  expanded: debt('canvas-only: export emits DisclosureGroup(isExpanded: $state) without seeding it from the authored value'),

  // -- ornaments ------------------------------------------------------------
  ornamentAnchorMode: debt('export-only: canvas draws every ornament scene-anchored, ignoring .parent()'),
  ornamentContentAlignment: debt('export-only: canvas ignores ornament content alignment'),
  ornamentVisibility: debt('export-only: canvas always draws the ornament regardless of visibility'),
  // `ornamentOffset` left this table in phase 1.5 (AUDIT #14). It was read by
  // NEITHER side — the number in the inspector moved nothing and reached no
  // file. The canvas now pushes the ornament that far out along the edge it
  // hangs from, and the export carries the matching `.offset` on the ornament
  // content, because `.ornament` itself has no offset parameter.

  // -- scrolling / chrome ---------------------------------------------------
  // `scrollShowsIndicators` left this table in phase 1.4: a scrollable stack
  // now draws a real scroll thumb, and both sides read the field to decide
  // whether to show it.
  toolbarPlacement: debt('export-only: canvas draws toolbar items in tree order, ignoring placement'),
  fitsAxes: debt('export-only: canvas picks a ViewThatFits branch via activeChild instead of measuring axes'),

  // -- environment ----------------------------------------------------------
  // The whole section left this table in phase 1.5 (AUDIT #13). Font,
  // Foreground, Tint, Direction and Locale were editable in the inspector and
  // read by NOBODY, on either side. All five now emit — each is a real
  // SwiftUI modifier — and `layoutDirection` is previewed as well: the canvas
  // mirrors the declaring container's own alignment.
  //
  // One limit worth stating rather than leaving to be discovered: SwiftUI
  // inherits `\.layoutDirection` down the whole subtree, while the canvas
  // mirrors it at the container that declares it. A nested stack with its own
  // alignment will read left-to-right on the canvas and right-to-left on
  // device. Closing that means threading an inherited environment through
  // `layoutStack`, which is a bigger change than this phase.
}

// ---------------------------------------------------------------------------
// Window fields
// ---------------------------------------------------------------------------

export const WINDOW = {
  collapsed: ex('neither: layers-tree disclosure state, pure editor chrome'),
  scrollY: ex('canvas-only: live scroll offset of the preview, not a document property'),

  fillOpacity: debt('canvas-only: plate fill opacity is not carried into the emitted material'),
  blur: debt('canvas-only: window backdrop blur toggle is not emitted'),
  blurAmount: debt('canvas-only: blur radius is not emitted'),

  volumeDepthMeters: debt('export-only: canvas derives volume depth from the window size instead'),
  worldScalingBehavior: debt('export-only: no canvas equivalent'),
  volumeWorldAlignment: debt('export-only: no canvas equivalent'),
  supportedVolumeViewpoints: debt('export-only: no canvas equivalent'),

  // `spatial` and `environment` left this table in phase 1.5 (AUDIT #13).
  //
  // `spatial` lost two of its four fields rather than gaining renderers for
  // them. `immersionStyle` is a SCENE property that the Scene tab already
  // owns and the exporter already emits — the per-window copy was a second
  // source for one concept, and the dead one. `gestures` was a list of
  // gesture names with no SwiftUI API to emit it as. What is left is read by
  // both sides: `hoverEffect` by the canvas (via `resolveHoverEffect`) and
  // `windowResizability` by the exporter, as a Scene modifier on the
  // WindowGroup — which is why the canvas has nowhere to preview it, and why
  // the inspector now says so instead of implying one.
  //
  // `environment` is the same section stacks carry; see the note there.
}

// ---------------------------------------------------------------------------
// Panel fields
//
// Unioned across all 56 panel types, so a field here may exist on only one.
// ---------------------------------------------------------------------------

export const PANEL = {
  // -- live preview state ---------------------------------------------------
  currentSlide: ex('canvas-only: which slide the preview is showing'),
  searchValue: ex('canvas-only: text typed into the preview search field'),
  securefieldValue: ex('canvas-only: text typed into the preview secure field'),
  dateValue: ex('canvas-only: value picked in the preview date picker'),
  isSpacer: ex('canvas-only: renderer flag, the exporter switches on panelType'),
  showAnchorAxes: ex('canvas-only: editor gizmo, never exported'),
  imageAssetId: ex('neither: asset-library back-reference; the store resolves it into imageUrl'),
  cameraMode: ex('neither: viewport camera affordance, not a document property'),

  // -- semantics and input behaviour: no pixels to draw ---------------------
  accessibility: ex('export-only: labels and traits, no visual'),
  animation: ex('export-only: transition config, the canvas is not time-based here'),
  autocorrectionDisabled: ex('export-only: keyboard behaviour'),
  keyboardType: ex('export-only: keyboard behaviour'),
  textContentType: ex('export-only: autofill semantics'),
  textInputAutocapitalization: ex('export-only: keyboard behaviour'),
  submitLabel: ex('export-only: keyboard return-key label'),
  url: ex('export-only: link destination'),
  navValue: ex('export-only: NavigationLink value, a routing concern'),
  destinationName: ex('export-only: NavigationLink destination type name'),
  linkMode: ex('export-only: selects which NavigationLink initializer to emit'),
  interactiveDismissDisabled: ex('export-only: presentation behaviour'),
  presentationBackgroundInteraction: ex('export-only: presentation behaviour'),
  presentationContentInteraction: ex('export-only: presentation behaviour'),
  dialogSuppressionToggle: ex('export-only: dialog behaviour'),
  menuOrder: ex('export-only: menu ordering semantics'),
  supportsOpacity: ex('export-only: colour-picker capability flag'),

  // The MIRROR tier is empty as of phase 2.3. `buttonSize`/`controlSize`,
  // `buttonShape`/`buttonBorderShape` and `fontSize`/`textStyle` each
  // collapsed onto the single field the exporter already read, with the
  // canvas deriving its metrics from that one field instead of from a
  // mirrored copy the inspector had to keep in sync.

  // The control-range block left this table in phase 1.7 (AUDIT #17). Slider,
  // Gauge, Stepper and ProgressView each took a value inside a declared range
  // and the canvas clamped it to 0..1 instead, so a slider authored 0..100 at
  // 50 drew hard right here and centred on device. `controlFraction` in
  // Panel3D now derives the fraction from the authored bounds, the value
  // labels and per-type styles draw, and the Stepper steps by `stepperStep`
  // and stops at its ends. 18 entries, all closed.

  // -- style pickers the canvas does not act on -----------------------------
  // AUDIT #6 emptied in phase 1.2. `form` and `outlinegroup` draw their rows
  // now, so `formStyle` picks between the grouped card and the two-column
  // layout, and `rowHeight` — which reached NEITHER side — lays the rows out
  // on the canvas and rides along as `.frame(minHeight:)` on each generated
  // row.
  // AUDIT #19 emptied in phase 1.8. Eleven of the thirteen now change the
  // canvas: the list row family, both menu fields, the table style, the
  // picker's options in the styles that lay them out, both date-picker
  // fields, and the text field's growth axis.
  //
  // The two below stay, and neither is a rendering gap — both are inert on
  // BOTH sides, which is why wiring a renderer would have been theatre:
  //
  //   `groupBoxStyle`  SwiftUI ships exactly one GroupBoxStyle, `.automatic`,
  //                    so GROUP_BOX_STYLES has a single option and the
  //                    emitter elides it at that value. The field can never
  //                    hold anything else and never reaches the file. The
  //                    honest fix is to drop the one-option picker from the
  //                    inspector, not to invent a second treatment.
  //
  //   headerProminence `.headerProminence` styles SECTION headers, and the
  //                    list panel does not model sections — so the emitted
  //                    modifier lands on a `List` with no `Section` in it and
  //                    does nothing on device either. It belongs on the
  //                    `section` stack type, which has a real header, rather
  //                    than on `list`.
  groupBoxStyle: ex('neither: one-case vocabulary, elided at its only value - see the note above'),
  headerProminence: ex('neither: styles Section headers and the list panel has no sections - see the note above'),

  // -- presentation metrics -------------------------------------------------
  presentationCornerRadius: debt('export-only: canvas uses the panel corner radius'),
  presentationDragIndicator: debt('export-only: canvas draws no drag indicator'),
  sheetFraction: debt('export-only: canvas honours sheetDetent only'),
  sheetHeight: debt('export-only: canvas honours sheetDetent only'),
  // AUDIT #7 emptied in phase 1.3. `confirmationdialog` and `inspector` are
  // routed as presentations now rather than laid out as ordinary children, so
  // the fields that describe them finally have something to describe:
  // `titleVisibility`, `dialogIcon` and `dialogSeverity` draw on the dialog,
  // the four inspector widths size its column, and the popover draws an arrow
  // on `popoverArrowEdge`. `popoverAnchor` was read by NEITHER side; the
  // canvas now narrows the arrow for a point anchor and the exporter emits
  // the matching `attachmentAnchor:`.

  // -- typography and 3D ----------------------------------------------------
  // Same blocker as their modifier twins in MODIFIER_VISIBILITY — see the
  // note there. Closing these means shipping a rounded / serif / mono face.
  fontDesign: debt('export-only: only Inter is bundled, so there is no face to swap to', 5),
  monospacedDigit: debt('export-only: tabular figures need a face the app does not ship', 5),
  boxCornerRadius: debt('export-only: canvas box primitive draws sharp edges'),
  depth: debt('export-only: canvas ignores .frame(depth:)'),
  iconName: debt('export-only: contentUnavailable icon is not drawn'),
  styles: debt('export-only: the shared styles bag (controlSize and friends) reaches the export only'),

  // -- canvas-only visuals the export drops ---------------------------------
  //
  // AUDIT #20 emptied in phase 1.9. This group ran the other way from the
  // rest of Stage 1 — the canvas drew these and the EXPORT dropped them — so
  // the work was in the emitters. Eight now reach the file: the field shape
  // as a `.clipShape`, the image as a named asset or an `AsyncImage` rather
  // than a `photo` placeholder, the symbol variant as `.symbolVariant`, the
  // editor's line count as `.lineLimit`, and the Label's icon tile as the
  // explicit two-closure `Label { } icon: { }` form that can carry a colour,
  // a size and a corner radius.
  //
  // The two below have no SwiftUI API behind them, so emitting anything
  // would have been invention rather than translation:
  //
  //   selectedColorToken  The raised pill in a segmented control is drawn by
  //                       `.pickerStyle(.segmented)` itself, and SwiftUI
  //                       exposes no way to re-material it. The canvas has to
  //                       paint something there, so it uses the tier; the
  //                       export has nowhere to put it.
  //
  //   dotCount            How many bullets the editor draws in an EMPTY
  //                       SecureField, so the field reads as a password field
  //                       before anything is typed. On device SecureField
  //                       masks the real value and there is no
  //                       placeholder-dot API; the placeholder is the prompt
  //                       string, which is already emitted.
  selectedColorToken: ex('canvas-only: the segmented selection pill is system-drawn - see the note above'),
  dotCount: ex('canvas-only: placeholder bullets in an empty SecureField - see the note above')
}

// ---------------------------------------------------------------------------
// Modifiers whose summarize() output no renderer reads (AUDIT #5, #15)
//
// Keyed by modifier type. Every one of these emits correct Swift; the entry
// records why the canvas shows nothing for it.
// ---------------------------------------------------------------------------

export const MODIFIER_VISIBILITY = {
  contentShape: ex('hit-testing only — correctly invisible'),
  customModifier: ex('raw Swift, uninterpretable by design'),

  // Phase 1.1 emptied most of this table. `background`, `overlay`,
  // `foregroundStyle`, `clipShape`, `glassBackgroundEffect`,
  // `containerBackground`, `tint`, `aspectRatio`, `zIndex`,
  // `toolbarBackground`, `navigationTitle`, `hoverEffect`,
  // `hoverEffectDisabled` and `layoutPriority` all draw now.
  //
  // The two below are the exception, and the blocker is assets rather than
  // wiring: the app bundles Inter alone (upright + italic per weight, see
  // `fonts.js`), troika needs a real font file to shape 3D text, and there is
  // no rounded, serif or monospaced face to point it at. Anything the canvas
  // did here — nudging weight, faking advances — would be a guess dressed as
  // a preview, and the canvas drawing a *different* wrong thing from the
  // device is worse than drawing nothing. Closing these means shipping the
  // faces (e.g. an `@fontsource` mono + serif) and mapping `.rounded` /
  // `.serif` / `.monospaced` onto them; `monospacedDigit` then follows as
  // tabular figures. Deliberate, and signposted rather than faked.
  fontDesign: debt('blocked on font assets: only Inter is bundled, so there is no face to swap to', 5),
  monospacedDigit: debt('blocked on font assets: tabular figures need a face the app does not ship', 5),
  // `scrollIndicators` and `scrollDisabled` left this table in phase 1.4.
  // Both had an empty `summarize()` and so wrote nothing for any renderer to
  // read; both now write, and Stack3D reads them to hide the scroll thumb
  // and to refuse the wheel respectively.
}

// ---------------------------------------------------------------------------
// Emitted enum cases that are not real SwiftUI API (AUDIT #1)
//
// `parity.test.js` validates every `.modifier(.case)` the exporter can
// produce against SWIFT_ENUMS. Anything listed here is a known-bad emission
// that still ships. This list should be empty.
// ---------------------------------------------------------------------------

export const KNOWN_INVALID_EMISSIONS = {
  // Empty, and meant to stay that way. `buttonStyle(.destructive)` lived here
  // until phase 2.2 removed `destructive` from BUTTON_STYLES and routed it to
  // the `buttonRole` field it always belonged in.
}

// ---------------------------------------------------------------------------
// Stacks marked scrollable that do not export a real ScrollView (AUDIT #3)
//
// Keyed by template name. The value is how many scrollable stacks in that
// template emit the `// wrap in ScrollView` comment instead of code.
// ---------------------------------------------------------------------------

export const KNOWN_MISSING_SCROLLVIEWS = {
  // Empty since phase 2.2: a scrollable stack now emits a real
  // `ScrollView { ... }` wrapping its content, with the frame on the
  // viewport and the padding on the scrolling content.
}

// ---------------------------------------------------------------------------
// The ratchet.
//
// Total DEBT + MIRROR entries across STACK, WINDOW, PANEL,
// MODIFIER_VISIBILITY, KNOWN_INVALID_EMISSIONS and KNOWN_MISSING_SCROLLVIEWS.
// Lower it as work lands. The test fails if the real count exceeds it, and
// nags (without failing) when the count drops below so the ceiling gets
// tightened rather than drifting upward over time.
// ---------------------------------------------------------------------------

export const DEBT_CEILING = 27
