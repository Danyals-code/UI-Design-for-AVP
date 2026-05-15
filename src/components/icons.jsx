// Icon set — Lucide React under the hood.
//
// We re-export the editor's icon vocabulary so call-sites continue
// importing `FolderIcon`, `ButtonIcon`, `WindowIcon`, etc. without
// touching every file. Each export is a thin wrapper around a Lucide
// icon picked to match the visionOS HIG affordance — Apple's own
// design system leans hard on outline glyphs, so Lucide's 1.5px
// strokes read as native.
//
// Wrapper signature: `<XIcon size={n} />`. Defaults stay at the
// original sizes (12–14pt) so layouts don't shift after the swap.

import {
  // Chrome / navigation
  Eye, EyeOff,
  Folder as LucideFolder, FolderPlus as LucideFolderPlus, FolderOpen,
  ChevronRight as LucideChevronRight,
  ChevronDown as LucideChevronDown,
  ChevronLeft, ChevronUp, ChevronsUpDown,
  Plus, Minus, X, Search,
  // Layout / containers
  Square, Circle as LucideCircle, Triangle, Cylinder, Box,
  RectangleHorizontal,
  AppWindow, AppWindowMac, Layers, LayoutGrid,
  Rows3, Columns3, Grid3x3, PanelLeft, PanelRight, PanelTop, PanelBottom,
  // Views & controls
  Type, MousePointerClick, MousePointer2,
  Image as LucideImage, ImagePlus, Images,
  ToggleRight, SlidersHorizontal, Loader, Gauge,
  List, Table, Menu, Tag,
  Calendar, Palette as LucidePalette, Link as LucideLink,
  TextCursor, KeyRound, FileText, AlignLeft,
  // Display / chrome variants
  ScrollText, AlignVerticalJustifyEnd, AlignVerticalJustifyStart,
  LayoutDashboard, Pin,
  // Presentations
  MessageSquare, AlertTriangle,
  // Tools / transform
  Move, RotateCw, Scale, MousePointer,
  // Shapes / gradients
  Spline, CircleDot, Sun,
  // 3D / RealityKit
  Box as LucideBox, Globe, Anchor, BoxSelect, Boxes,
  Paintbrush, Wand2,
  // Other
  Hand, Space as LucideSpace, Divide,
  ClipboardList, SquareDashed, ListTree,
  File as LucideFile, FilePlus
} from 'lucide-react'

// `size` is treated as both width and height (square viewBox). Lucide's
// `size` prop already does this; we pass an explicit absoluteStrokeWidth
// of 1.5 to keep glyphs crisp at small sizes.
const wrap = (Icon, defaultSize = 13) => ({ size = defaultSize, strokeWidth = 1.5 }) =>
  <Icon size={size} strokeWidth={strokeWidth} absoluteStrokeWidth />

// ---- Chrome / navigation -------------------------------------------
export const EyeOpen      = wrap(Eye)
export const EyeClosed    = wrap(EyeOff)
export const Folder       = wrap(LucideFolder)
export const FolderIcon   = wrap(FolderOpen)
export const FolderPlus   = wrap(LucideFolderPlus)
export const FolderPlusIcon = wrap(LucideFolderPlus)
export const ChevronRight = wrap(LucideChevronRight, 10)
export const ChevronDown  = wrap(LucideChevronDown, 10)
export const PlusIcon     = wrap(Plus, 12)
export const CloseIcon    = wrap(X, 12)
export const SearchIcon   = wrap(Search, 12)

// ---- Window / volume ------------------------------------------------
export const WindowIcon   = wrap(AppWindowMac, 13)
export const VolumeIcon   = wrap(LucideBox, 13)
export const CanvasIcon   = wrap(RectangleHorizontal, 12)
export const HdriIcon     = wrap(Globe, 13)

// ---- Layout / stacks ------------------------------------------------
export const VStackIcon       = wrap(Rows3, 13)
export const HStackIcon       = wrap(Columns3, 13)
export const ZStackIcon       = wrap(Layers, 13)
export const GridIcon         = wrap(Grid3x3, 13)
export const GridLayoutIcon   = wrap(Grid3x3, 12)
export const LazyVStackIcon   = wrap(Rows3, 13)
export const LazyHStackIcon   = wrap(Columns3, 13)
export const SectionIcon      = wrap(LayoutDashboard, 12)
export const DisclosureIcon   = wrap(ChevronsUpDown, 12)
export const NavStackIcon     = wrap(ChevronsUpDown, 13)
export const SplitViewIcon    = wrap(PanelLeft, 13)
export const HandIcon         = wrap(Hand, 13)

// ---- Views / controls -----------------------------------------------
export const TextIcon         = wrap(Type, 12)
export const ButtonIcon       = wrap(MousePointerClick, 12)
export const LabelIcon        = wrap(Tag, 12)
export const LinkIcon         = wrap(LucideLink, 12)
export const ImageIcon        = wrap(LucideImage, 12)
export const AsyncImageIcon   = wrap(ImagePlus, 12)
export const ToggleIcon       = wrap(ToggleRight, 12)
export const SegmentedIcon    = wrap(LayoutGrid, 12)
export const SlideshowIcon    = wrap(Images, 12)
export const TickerIcon       = wrap(ScrollText, 12)
export const SearchFieldIcon  = wrap(Search, 12)
export const ListIcon         = wrap(List, 12)
export const TableIcon        = wrap(Table, 12)
export const MenuIcon         = wrap(Menu, 12)
export const ProgressIcon     = wrap(Loader, 12)
export const SliderIcon       = wrap(SlidersHorizontal, 12)
export const StepperIcon      = wrap(ChevronsUpDown, 12)
export const GaugeIcon        = wrap(Gauge, 12)
export const PickerIcon       = wrap(ChevronsUpDown, 12)
export const DatePickerIcon   = wrap(Calendar, 12)
export const ColorPickerIcon  = wrap(LucidePalette, 12)
export const TextFieldIcon    = wrap(TextCursor, 12)
export const SecureFieldIcon  = wrap(KeyRound, 12)
export const TextEditorIcon   = wrap(FileText, 12)
export const ContentUnavailableIcon = wrap(AlertTriangle, 12)
export const FormIcon         = wrap(ClipboardList, 12)
export const GroupBoxIcon     = wrap(SquareDashed, 12)
export const OutlineGroupIcon = wrap(ListTree, 12)
export const SpacerIcon       = wrap(LucideSpace, 12)
export const DividerIcon      = wrap(Divide, 12)

// ---- Chrome / ornaments --------------------------------------------
export const NavBarIcon       = wrap(AlignVerticalJustifyStart, 13)
export const TabBarIcon       = wrap(AlignVerticalJustifyEnd, 13)
export const ToolbarIcon      = wrap(LayoutDashboard, 13)
export const OrnamentLeading  = wrap(PanelLeft, 13)
export const OrnamentTrailing = wrap(PanelRight, 13)
export const OrnamentTop      = wrap(PanelTop, 13)
export const OrnamentBottom   = wrap(PanelBottom, 13)
export const PageTabIcon      = wrap(LucideFile, 13)
export const TabViewIcon      = wrap(AppWindow, 13)
export const TabIcon          = wrap(LucideFile, 12)

// ---- Presentations --------------------------------------------------
export const SheetIcon        = wrap(PanelBottom, 12)
export const PopoverIcon      = wrap(MessageSquare, 12)
export const AlertIcon        = wrap(AlertTriangle, 12)

// ---- Shapes / gradients --------------------------------------------
export const RectangleIcon    = wrap(Square, 12)
export const CircleIcon       = wrap(LucideCircle, 12)
export const CapsuleIcon      = wrap(({ size, strokeWidth, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <rect x="2" y="8" width="20" height="8" rx="4" />
  </svg>
))
export const EllipseIcon      = wrap(({ size, strokeWidth, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <ellipse cx="12" cy="12" rx="10" ry="6" />
  </svg>
))
export const UnevenRectIcon   = wrap(({ size, strokeWidth, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
    <path d="M6 4h14a0 0 0 0 1 0 0v6a8 8 0 0 1-8 8H4a0 0 0 0 1 0 0V10a6 6 0 0 1 6-6h-4z" />
  </svg>
))
export const PathIcon             = wrap(Spline, 12)
export const LinearGradientIcon   = wrap(LayoutDashboard, 12)
export const RadialGradientIcon   = wrap(Sun, 12)
export const AngularGradientIcon  = wrap(CircleDot, 12)

// ---- 3D primitives --------------------------------------------------
export const SphereIcon       = wrap(Globe, 12)
export const BoxIcon          = wrap(Box, 12)
export const PlaneIcon        = wrap(Square, 12)
export const ConeIcon         = wrap(Triangle, 12)
export const CylinderIcon     = wrap(Cylinder, 12)
export const Text3DIcon       = wrap(Type, 12)
export const MeshIcon         = wrap(Boxes, 12)

// ---- Transform tools -----------------------------------------------
export const MoveToolIcon     = wrap(Move, 13)
export const RotateToolIcon   = wrap(RotateCw, 13)
export const ScaleToolIcon    = wrap(Scale, 13)
export const PointerToolIcon  = wrap(MousePointer2, 13)

// ---- RealityKit ----------------------------------------------------
export const RealityViewIcon  = wrap(BoxSelect, 13)
export const AnchorIcon       = wrap(Anchor, 12)
export const EntityGroupIcon  = wrap(Boxes, 12)
export const ModelEntityIcon  = wrap(Box, 12)
export const MaterialIcon     = wrap(Paintbrush, 12)
