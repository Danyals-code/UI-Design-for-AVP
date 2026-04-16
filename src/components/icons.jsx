// Figma/Blender-style monochrome icon set.
// All icons inherit currentColor and default to 14px.
const s = (size) => ({ width: size, height: size, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' })

export const EyeOpen = ({ size = 13 }) => (
  <svg {...s(size)}><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" /><circle cx="8" cy="8" r="2" /></svg>
)
export const EyeClosed = ({ size = 13 }) => (
  <svg {...s(size)}><path d="M2 4c1.5 2 3.5 3 6 3s4.5-1 6-3" /><line x1="3" y1="10" x2="2" y2="12" /><line x1="7" y1="11" x2="6.5" y2="13" /><line x1="9" y1="11" x2="9.5" y2="13" /><line x1="13" y1="10" x2="14" y2="12" /></svg>
)
export const Folder = ({ size = 13 }) => (
  <svg {...s(size)} fill="currentColor" strokeWidth="0"><path d="M1 4a1 1 0 011-1h4l2 2h6a1 1 0 011 1v7a1 1 0 01-1 1H2a1 1 0 01-1-1V4z" /></svg>
)
export const FolderPlus = ({ size = 13 }) => (
  <svg {...s(size)}><path d="M1 4a1 1 0 011-1h4l2 2h6a1 1 0 011 1v7a1 1 0 01-1 1H2a1 1 0 01-1-1V4z" /><line x1="8" y1="7" x2="8" y2="12" /><line x1="5.5" y1="9.5" x2="10.5" y2="9.5" /></svg>
)
export const ChevronRight = ({ size = 10 }) => (
  <svg {...s(size)}><path d="M5 2l4 4-4 4" /></svg>
)
export const ChevronDown = ({ size = 10 }) => (
  <svg {...s(size)}><path d="M2 5l4 4 4-4" /></svg>
)
export const CanvasIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="12" height="10" rx="1.5" /></svg>
)
export const TextIcon = ({ size = 12 }) => (
  <svg {...s(size)}><path d="M3 4h10" /><path d="M8 4v9" /></svg>
)
export const ButtonIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="5" width="12" height="6" rx="3" /></svg>
)
export const WindowIcon = ({ size = 13 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="12" height="10" rx="1.5" /><line x1="2" y1="5.5" x2="14" y2="5.5" /><circle cx="3.5" cy="4.25" r="0.4" fill="currentColor" /></svg>
)
export const VolumeIcon = ({ size = 13 }) => (
  <svg {...s(size)}><path d="M8 2L2 5v6l6 3 6-3V5L8 2z" /><path d="M2 5l6 3 6-3" /><line x1="8" y1="8" x2="8" y2="14" /></svg>
)
export const GridIcon = ({ size = 13 }) => (
  <svg {...s(size)}><rect x="2" y="2" width="12" height="12" rx="1" /><line x1="6" y1="2" x2="6" y2="14" /><line x1="10" y1="2" x2="10" y2="14" /><line x1="2" y1="6" x2="14" y2="6" /><line x1="2" y1="10" x2="14" y2="10" /></svg>
)
export const HandIcon = ({ size = 13 }) => (
  <svg {...s(size)}><path d="M6 8V3.5a1 1 0 112 0V8" /><path d="M8 8V3a1 1 0 112 0v5" /><path d="M10 8V4a1 1 0 112 0v5" /><path d="M4 8.5V6a1 1 0 112 0v4" /><path d="M4 9c-1 0-1 1-.5 2l1.5 2.5c.7 1.1 1.7 1.5 3 1.5h2c2 0 3-1 3-3V8" /></svg>
)
export const VStackIcon = ({ size = 13 }) => (
  <svg {...s(size)}><rect x="3" y="2" width="10" height="3" rx="0.5" /><rect x="3" y="6.5" width="10" height="3" rx="0.5" /><rect x="3" y="11" width="10" height="3" rx="0.5" /></svg>
)
export const HStackIcon = ({ size = 13 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="3" height="10" rx="0.5" /><rect x="6.5" y="3" width="3" height="10" rx="0.5" /><rect x="11" y="3" width="3" height="10" rx="0.5" /></svg>
)
export const ZStackIcon = ({ size = 13 }) => (
  <svg {...s(size)}><rect x="2" y="2" width="9" height="9" rx="1" /><rect x="5" y="5" width="9" height="9" rx="1" /></svg>
)
export const PlusIcon = ({ size = 12 }) => (
  <svg {...s(size)}><line x1="8" y1="3" x2="8" y2="13" /><line x1="3" y1="8" x2="13" y2="8" /></svg>
)
export const CloseIcon = ({ size = 12 }) => (
  <svg {...s(size)}><line x1="3" y1="3" x2="13" y2="13" /><line x1="13" y1="3" x2="3" y2="13" /></svg>
)
export const OrnamentLeading = ({ size = 13 }) => (
  <svg {...s(size)}><rect x="4" y="3" width="10" height="10" rx="1.5" /><rect x="1" y="5" width="2" height="6" rx="1" fill="currentColor" /></svg>
)
export const OrnamentTrailing = ({ size = 13 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="10" height="10" rx="1.5" /><rect x="13" y="5" width="2" height="6" rx="1" fill="currentColor" /></svg>
)
export const OrnamentTop = ({ size = 13 }) => (
  <svg {...s(size)}><rect x="3" y="4" width="10" height="10" rx="1.5" /><rect x="5" y="1" width="6" height="2" rx="1" fill="currentColor" /></svg>
)
export const OrnamentBottom = ({ size = 13 }) => (
  <svg {...s(size)}><rect x="3" y="2" width="10" height="10" rx="1.5" /><rect x="5" y="13" width="6" height="2" rx="1" fill="currentColor" /></svg>
)
export const SplitViewIcon = ({ size = 13 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="12" height="10" rx="1.5" /><line x1="6" y1="3" x2="6" y2="13" /></svg>
)
export const HdriIcon = ({ size = 13 }) => (
  <svg {...s(size)}><circle cx="8" cy="8" r="6" /><path d="M2 8c3-4 9-4 12 0" /><path d="M2 8c3 4 9 4 12 0" /></svg>
)
export const ImageIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="12" height="10" rx="1.5" /><circle cx="6" cy="7" r="1.2" /><path d="M2 11l3.5-3 3 2 3-2.5L14 11" /></svg>
)
export const ToggleIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="1.5" y="5" width="13" height="6" rx="3" /><circle cx="11" cy="8" r="1.8" fill="currentColor" /></svg>
)
export const SegmentedIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="1.5" y="5" width="13" height="6" rx="1.5" /><line x1="6" y1="5" x2="6" y2="11" /><line x1="10" y1="5" x2="10" y2="11" /></svg>
)
export const SlideshowIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="12" height="8" rx="1" /><circle cx="5.5" cy="13" r="0.6" fill="currentColor" /><circle cx="8" cy="13" r="0.6" fill="currentColor" /><circle cx="10.5" cy="13" r="0.6" fill="currentColor" /></svg>
)
export const TickerIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="1.5" y="6" width="13" height="4" rx="2" /><path d="M3 8h3M7.5 8h2M11 8h2.5" /></svg>
)
export const NavBarIcon = ({ size = 13 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="12" height="10" rx="1.5" /><rect x="3" y="4.3" width="10" height="1.6" rx="0.4" fill="currentColor" /></svg>
)
export const TabBarIcon = ({ size = 13 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="12" height="10" rx="1.5" /><rect x="3" y="10.1" width="10" height="1.6" rx="0.4" fill="currentColor" /></svg>
)
export const SearchIcon = ({ size = 12 }) => (
  <svg {...s(size)}><circle cx="6.5" cy="6.5" r="4" /><line x1="9.5" y1="9.5" x2="13" y2="13" /></svg>
)
export const ListIcon = ({ size = 12 }) => (
  <svg {...s(size)}><line x1="3" y1="4" x2="13" y2="4" /><line x1="3" y1="8" x2="13" y2="8" /><line x1="3" y1="12" x2="13" y2="12" /></svg>
)
export const TableIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="12" height="10" /><line x1="2" y1="6" x2="14" y2="6" /><line x1="6" y1="3" x2="6" y2="13" /><line x1="10" y1="3" x2="10" y2="13" /></svg>
)
export const MenuIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="12" height="10" rx="1.5" /><line x1="4" y1="6" x2="12" y2="6" /><line x1="4" y1="9" x2="12" y2="9" /><line x1="4" y1="12" x2="10" y2="12" /></svg>
)
export const ProgressIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="1.5" y="6.5" width="13" height="3" rx="1.5" /><rect x="1.5" y="6.5" width="7" height="3" rx="1.5" fill="currentColor" /></svg>
)
export const SliderIcon = ({ size = 12 }) => (
  <svg {...s(size)}><line x1="2" y1="8" x2="14" y2="8" /><circle cx="9" cy="8" r="2" fill="currentColor" /></svg>
)
export const StepperIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="1.5" y="4.5" width="13" height="7" rx="1.5" /><line x1="6" y1="4.5" x2="6" y2="11.5" /><line x1="10" y1="4.5" x2="10" y2="11.5" /><line x1="3" y1="8" x2="5" y2="8" /><line x1="11" y1="8" x2="13" y2="8" /><line x1="12" y1="7" x2="12" y2="9" /></svg>
)
export const GaugeIcon = ({ size = 12 }) => (
  <svg {...s(size)}><path d="M2 10a6 6 0 0 1 12 0" /><line x1="8" y1="10" x2="11" y2="5" /></svg>
)
export const ToolbarIcon = ({ size = 13 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="12" height="10" rx="1.5" /><rect x="3" y="4.3" width="2" height="1.6" rx="0.4" fill="currentColor" /><rect x="6" y="4.3" width="2" height="1.6" rx="0.4" fill="currentColor" /><rect x="9" y="4.3" width="2" height="1.6" rx="0.4" fill="currentColor" /></svg>
)
// Phase 1/2 icons
export const SpacerIcon = ({ size = 12 }) => (
  <svg {...s(size)}><line x1="4" y1="3" x2="4" y2="13" /><line x1="12" y1="3" x2="12" y2="13" /><line x1="5" y1="8" x2="11" y2="8" /><path d="M6 6l-1.5 2 1.5 2" /><path d="M10 6l1.5 2-1.5 2" /></svg>
)
export const DividerIcon = ({ size = 12 }) => (
  <svg {...s(size)}><line x1="2" y1="8" x2="14" y2="8" /></svg>
)
export const RectangleIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="12" height="10" rx="1.5" /></svg>
)
export const CircleIcon = ({ size = 12 }) => (
  <svg {...s(size)}><circle cx="8" cy="8" r="5.5" /></svg>
)
export const CapsuleIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="5" width="12" height="6" rx="3" /></svg>
)
export const GridLayoutIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="2" width="5" height="5" rx="0.5" /><rect x="9" y="2" width="5" height="5" rx="0.5" /><rect x="2" y="9" width="5" height="5" rx="0.5" /><rect x="9" y="9" width="5" height="5" rx="0.5" /></svg>
)
export const SectionIcon = ({ size = 12 }) => (
  <svg {...s(size)}><line x1="2" y1="4" x2="7" y2="4" /><rect x="2" y="6" width="12" height="3" rx="0.5" /><rect x="2" y="10.5" width="12" height="3" rx="0.5" /></svg>
)
export const DisclosureIcon = ({ size = 12 }) => (
  <svg {...s(size)}><path d="M4 5l3 3-3 3" /><line x1="8" y1="8" x2="13" y2="8" /><line x1="2" y1="13" x2="14" y2="13" /></svg>
)
export const NavStackIcon = ({ size = 13 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="12" height="10" rx="1.5" /><line x1="2" y1="5.5" x2="14" y2="5.5" /><path d="M4 4.25l-1 0" /><path d="M11 4.25l2 0" /></svg>
)
export const SheetIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="1" width="12" height="12" rx="1.5" /><rect x="3.5" y="6" width="9" height="7" rx="1" fill="currentColor" strokeWidth="0" /></svg>
)
export const PopoverIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="3" y="2" width="10" height="7" rx="1.5" /><path d="M7 9l1 2.5 1-2.5" /></svg>
)
export const AlertIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="3" y="3" width="10" height="10" rx="2" /><line x1="8" y1="6" x2="8" y2="9" /><circle cx="8" cy="11" r="0.5" fill="currentColor" /></svg>
)
export const LazyVStackIcon = ({ size = 13 }) => (
  <svg {...s(size)}><rect x="3" y="2" width="10" height="2.5" rx="0.5" /><rect x="3" y="6.5" width="10" height="2.5" rx="0.5" strokeDasharray="2 1.5" /><rect x="3" y="11" width="10" height="2.5" rx="0.5" strokeDasharray="2 1.5" /></svg>
)
export const LazyHStackIcon = ({ size = 13 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="2.5" height="10" rx="0.5" /><rect x="6.5" y="3" width="2.5" height="10" rx="0.5" strokeDasharray="2 1.5" /><rect x="11" y="3" width="2.5" height="10" rx="0.5" strokeDasharray="2 1.5" /></svg>
)
// Phase 3 — Views & Controls
export const LabelIcon = ({ size = 12 }) => (
  <svg {...s(size)}><circle cx="4.5" cy="8" r="2.5" /><line x1="8" y1="8" x2="14" y2="8" /></svg>
)
export const TextFieldIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="5" width="12" height="6" rx="1.5" /><line x1="4" y1="7" x2="4" y2="9" /><line x1="6" y1="8" x2="10" y2="8" strokeDasharray="1.5 1" /></svg>
)
export const SecureFieldIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="5" width="12" height="6" rx="1.5" /><circle cx="5" cy="8" r="0.7" fill="currentColor" /><circle cx="8" cy="8" r="0.7" fill="currentColor" /><circle cx="11" cy="8" r="0.7" fill="currentColor" /></svg>
)
export const TextEditorIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="2" width="12" height="12" rx="1.5" /><line x1="4" y1="5" x2="12" y2="5" /><line x1="4" y1="8" x2="12" y2="8" /><line x1="4" y1="11" x2="9" y2="11" /></svg>
)
export const PickerIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="5" width="12" height="6" rx="1.5" /><line x1="4" y1="8" x2="9" y2="8" /><path d="M11 7l1.5 1-1.5 1" /></svg>
)
export const DatePickerIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="12" height="10" rx="1.5" /><line x1="2" y1="6" x2="14" y2="6" /><line x1="5" y1="3" x2="5" y2="5" /><line x1="11" y1="3" x2="11" y2="5" /></svg>
)
export const ColorPickerIcon = ({ size = 12 }) => (
  <svg {...s(size)}><circle cx="8" cy="8" r="4" /><circle cx="8" cy="8" r="2" fill="currentColor" /></svg>
)
export const LinkIcon = ({ size = 12 }) => (
  <svg {...s(size)}><line x1="3" y1="11" x2="13" y2="11" /><path d="M3 8h6M11 5l2 3-2 3" /></svg>
)
export const AsyncImageIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M6 8a2 2 0 014 0" /></svg>
)
export const ContentUnavailableIcon = ({ size = 12 }) => (
  <svg {...s(size)}><circle cx="8" cy="6" r="3" /><line x1="8" y1="5" x2="8" y2="6.5" /><circle cx="8" cy="7.5" r="0.3" fill="currentColor" /><line x1="4" y1="12" x2="12" y2="12" /></svg>
)
// Phase 4
export const FormIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="2" width="12" height="12" rx="2" /><line x1="4" y1="5.5" x2="12" y2="5.5" /><line x1="4" y1="8.5" x2="12" y2="8.5" /><line x1="4" y1="11.5" x2="12" y2="11.5" /></svg>
)
export const GroupBoxIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="4" width="12" height="9" rx="1.5" /><line x1="4" y1="4" x2="8" y2="4" /><text x="5" y="3.5" fontSize="4" fill="currentColor" stroke="none">T</text></svg>
)
export const OutlineGroupIcon = ({ size = 12 }) => (
  <svg {...s(size)}><line x1="4" y1="4" x2="14" y2="4" /><line x1="7" y1="7" x2="14" y2="7" /><line x1="7" y1="10" x2="14" y2="10" /><line x1="4" y1="13" x2="14" y2="13" /><path d="M3 3l1.5 1.5L3 6" /><circle cx="5.5" cy="7" r="0.5" fill="currentColor" /><circle cx="5.5" cy="10" r="0.5" fill="currentColor" /></svg>
)
// Phase 5
export const EllipseIcon = ({ size = 12 }) => (
  <svg {...s(size)}><ellipse cx="8" cy="8" rx="6" ry="4" /></svg>
)
export const UnevenRectIcon = ({ size = 12 }) => (
  <svg {...s(size)}><path d="M5 2h7a4 4 0 014 4v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6a4 4 0 014-4z" /></svg>
)
export const PathIcon = ({ size = 12 }) => (
  <svg {...s(size)}><path d="M3 12C3 8 6 4 10 3" /><circle cx="10" cy="3" r="1.5" /></svg>
)
export const LinearGradientIcon = ({ size = 12 }) => (
  <svg {...s(size)}><rect x="2" y="3" width="12" height="10" rx="1.5" /><line x1="5" y1="3" x2="11" y2="13" strokeDasharray="2 1" /></svg>
)
export const RadialGradientIcon = ({ size = 12 }) => (
  <svg {...s(size)}><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="3" /><circle cx="8" cy="8" r="1" /></svg>
)
export const AngularGradientIcon = ({ size = 12 }) => (
  <svg {...s(size)}><circle cx="8" cy="8" r="6" /><path d="M8 2v6" /><path d="M8 8l4 4" /></svg>
)
// Navigation / Tab icons
export const TabViewIcon = ({ size = 13 }) => (
  <svg {...s(size)}>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <line x1="2" y1="6.5" x2="14" y2="6.5" />
    <rect x="3" y="4" width="3.5" height="2" rx="0.4" fill="currentColor" strokeWidth="0" />
    <rect x="7.5" y="4" width="3.5" height="2" rx="0.4" strokeWidth="0.8" />
  </svg>
)
export const TabIcon = ({ size = 12 }) => (
  <svg {...s(size)}>
    <rect x="2" y="5" width="12" height="9" rx="1" />
    <path d="M3 5V4a1 1 0 011-1h4a1 1 0 011 1v1" fill="currentColor" strokeWidth="0" />
  </svg>
)
