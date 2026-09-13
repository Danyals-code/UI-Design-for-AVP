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
  TextCursor, KeyRound, FileText,
  // Display / chrome variants
  ScrollText, AlignVerticalJustifyEnd, AlignVerticalJustifyStart,
  LayoutDashboard,
  // Presentations
  MessageSquare, AlertTriangle,
  // Tools / transform
  Move, RotateCw, Scale,
  // Shapes / gradients
  Spline, CircleDot, Sun,
  // 3D / RealityKit
  Box as LucideBox, Globe, Anchor, BoxSelect, Boxes,
  Paintbrush,
  // Other
  Hand, Space as LucideSpace, Divide,
  ClipboardList, SquareDashed, ListTree,
  File as LucideFile,
  // SF Symbol coverage (visionOS-curated set). Imports needed by the
  // SF_TO_LUCIDE map below — kept in the same lucide-react import so
  // tree-shaking gathers them in one chunk.
  Home, Settings, User, Star, Heart, Bell, Mail, Send, FileText as Doc,
  Trash2, Pencil, Check, ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
  Camera, Video, Play, Pause, StopCircle, Volume2, Mic, Phone,
  MessageCircle, Map as LucideMap, MapPin, Clock, Bookmark, Lock, Unlock,
  Wifi, Battery, Info, HelpCircle, MoreHorizontal,
  Users, Newspaper, Utensils, Sun as SunIcon,
  Accessibility, KeyRound as Key, BookOpen, Languages, Keyboard,
  Laptop, Inbox, Archive, Flag, Music, Mic2, SkipForward, SkipBack,
  Sofa, Bed, CornerUpLeft, CornerUpRight, Sparkles,
  Apple, ToggleLeft, MonitorSmartphone, Library, Maximize2,
  // Phase 9 — bigger catalogue
  FileText as FileTextIcon, Files, Clipboard, Braces,
  PenLine, Eraser, Paperclip, Link as LinkIcon2, Link2,
  CheckCircle, CheckSquare, XCircle, XSquare, PlusCircle, PlusSquare,
  MinusCircle, MinusSquare, Octagon, AlertCircle, AlertOctagon,
  Filter, ArrowUpDown, SlidersHorizontal as Sliders,
  Download, Share2, CloudUpload, CloudDownload, Cloud as CloudIcon,
  ArrowUpCircle, ArrowDownCircle, RefreshCw, RotateCcw,
  MessageSquare as MsgSquare, MailOpen,
  PhoneIncoming, PhoneOutgoing, MicOff, VideoOff,
  Volume, Volume1, VolumeX, Shuffle, Repeat, Repeat1, FastForward, Rewind,
  PlayCircle, PauseCircle, StopCircle as StopCircleIcon,
  WifiOff, Bluetooth, Radio,
  Cast,
  BatteryLow, BatteryMedium, BatteryFull, Zap,
  BarChart3, LineChart, PieChart, TrendingUp, TrendingDown,
  Percent, Hash,
  Timer, Hourglass, AlarmClock, CalendarPlus, CalendarMinus,
  Navigation, Compass, Flag as FlagIcon,
  Smartphone, Tablet, Monitor, Tv, Headphones as HeadphonesIcon, Gamepad2, Printer,
  ShieldCheck, ShieldAlert,
  Moon, CloudRain, CloudSnow, CloudSun, CloudLightning, Wind, Snowflake,
  Thermometer, Droplets, Flame,
  HeartPulse, Activity, Dumbbell, Bike,
  ShoppingCart, ShoppingBag, CreditCard, DollarSign, Euro, PoundSterling, JapaneseYen,
  Coffee, Wine,
  Lightbulb, Lamp, Fan, Building, Building2,
  DoorOpen, DoorClosed, Bath, Car, Plane, Train, Fuel, Sailboat,
  Book, GraduationCap, Newspaper as NewspaperIcon,
  Trophy, Medal, Crown, Award,
  ThumbsUp, ThumbsDown, Hand as HandIcon2, Smile,
  Wrench, Hammer, Brush, Pipette,
  Scissors, Ruler, AlertTriangle as AlertTriangleIcon, Ear,
  Power, AsteriskSquare, AtSign
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
// Escape hatch — braces read as "this is source, not a view".
export const CustomSwiftIcon  = wrap(Braces, 12)
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
export const LightIcon        = wrap(Lightbulb, 12)

// ---- SF Symbols (visionOS) → Lucide component map ------------------
//
// The 3D canvas + DOM call sites used to render an SF Symbol as the
// nearest Unicode codepoint (`☰`, `⌖`, …) — which collapses
// to missing-glyph boxes in any non-Apple font. We swap to Lucide
// React, which ships outline glyphs that read as "native" Apple-style
// affordances at all sizes.
//
// Add to this map whenever a panel introduces a new symbolName. The
// `fallback` (LucideCircle) keeps unknown names rendering instead of
// silently going blank.
export const SF_TO_LUCIDE = {
  'house':                   Home,
  'house.fill':              Home,
  'gear':                    Settings,
  'gearshape':               Settings,
  'gearshape.fill':          Settings,
  'gearshape.2.fill':        Settings,
  'person':                  User,
  'person.fill':             User,
  'person.circle':           User,
  'person.crop.circle':      User,
  'person.crop.circle.fill': User,
  'person.2.fill':           Users,
  'star':                    Star,
  'star.fill':               Star,
  'heart':                   Heart,
  'heart.fill':              Heart,
  'magnifyingglass':         Search,
  'bell':                    Bell,
  'bell.fill':               Bell,
  'bell.badge':              Bell,
  'envelope':                Mail,
  'envelope.fill':           Mail,
  'paperplane':              Send,
  'paperplane.fill':         Send,
  'square.and.arrow.up':     CornerUpRight,
  'doc':                     Doc,
  'doc.fill':                Doc,
  'doc.viewfinder.fill':     Doc,
  'folder':                  LucideFolder,
  'folder.fill':             LucideFolder,
  'folder.badge.plus':       LucideFolderPlus,
  'trash':                   Trash2,
  'pencil':                  Pencil,
  'plus':                    Plus,
  'minus':                   Minus,
  'xmark':                   X,
  'checkmark':               Check,
  'chevron.right':           LucideChevronRight,
  'chevron.left':            ChevronLeft,
  'chevron.up':              ChevronUp,
  'chevron.down':            LucideChevronDown,
  'arrow.left':              ArrowLeft,
  'arrow.right':             ArrowRight,
  'arrow.up':                ArrowUp,
  'arrow.down':              ArrowDown,
  'photo':                   LucideImage,
  'photo.on.rectangle.angled': Images,
  'camera':                  Camera,
  'video':                   Video,
  'play':                    Play,
  'play.fill':               Play,
  'pause':                   Pause,
  'pause.fill':              Pause,
  'stop':                    StopCircle,
  'speaker.wave.2':          Volume2,
  'mic':                     Mic,
  'phone':                   Phone,
  'bubble.left':             MessageCircle,
  'map':                     LucideMap,
  'location':                MapPin,
  'clock':                   Clock,
  'clock.fill':              Clock,
  'calendar':                Calendar,
  'bookmark':                Bookmark,
  'bookmark.fill':           Bookmark,
  'tag':                     Tag,
  'lock':                    Lock,
  'lock.open':               Unlock,
  'eye':                     Eye,
  'eye.slash':               EyeOff,
  'wifi':                    Wifi,
  'battery.100':             Battery,
  'globe':                   Globe,
  'info.circle':             Info,
  'exclamationmark.triangle': AlertTriangle,
  'questionmark.circle':     HelpCircle,
  'list.bullet':             List,
  'square.grid.2x2':         LayoutGrid,
  'square.grid.2x2.fill':    LayoutGrid,
  'square.stack':            Layers,
  'square.stack.fill':       Layers,
  'cube':                    Box,
  'pano':                    RectangleHorizontal,
  'ellipsis':                MoreHorizontal,
  'newspaper.fill':          Newspaper,
  'n.square.fill':           Newspaper,
  'fork.knife':              Utensils,
  'fork.knife.circle.fill':  Utensils,
  'rectangle':               Square,
  'rectangle.on.rectangle':  Layers,
  'applewatch':              MonitorSmartphone,
  'applelogo':               Apple,
  'apple.logo':              Apple,
  'mountain.2.fill':         Triangle,
  'accessibility':           Accessibility,
  'sun.max.fill':            SunIcon,
  'switch.2':                ToggleLeft,
  'key.fill':                Key,
  'character.book.closed.fill': BookOpen,
  'textformat':              Languages,
  'keyboard':                Keyboard,
  'visionpro':               Maximize2,
  'laptopcomputer':          Laptop,
  'tray':                    Inbox,
  'tray.full':               Inbox,
  'tray.full.fill':          Inbox,
  'archivebox':              Archive,
  'archivebox.fill':         Archive,
  'flag':                    Flag,
  'flag.fill':               Flag,
  'music.note':              Music,
  'music.mic':               Mic2,
  'forward.fill':            SkipForward,
  'backward.fill':           SkipBack,
  'sofa':                    Sofa,
  'sofa.fill':               Sofa,
  'bed.double':              Bed,
  'bed.double.fill':         Bed,
  'books.vertical':          Library,
  'books.vertical.fill':     Library,
  'arrowshape.turn.up.left': CornerUpLeft,
  'arrowshape.turn.up.left.fill': CornerUpLeft,
  'arrowshape.turn.up.right': CornerUpRight,
  'sparkles':                Sparkles,
  // Phase 9 — broader visionOS catalogue
  // Files & documents
  'doc.text':                FileTextIcon,
  'doc.text.fill':           FileTextIcon,
  'doc.plaintext':           Doc,
  'doc.on.doc':              Files,
  'doc.on.clipboard':        Clipboard,
  'square.and.pencil':       PenLine,
  'pencil.tip':              Pencil,
  'pencil.line':             PenLine,
  'highlighter':             Brush,
  'eraser':                  Eraser,
  'paperclip':               Paperclip,
  'link':                    LinkIcon2,
  'link.circle':             Link2,
  // Status / state
  'checkmark.circle':        CheckCircle,
  'checkmark.circle.fill':   CheckCircle,
  'checkmark.square':        CheckSquare,
  'checkmark.square.fill':   CheckSquare,
  'xmark.circle':            XCircle,
  'xmark.circle.fill':       XCircle,
  'xmark.square':            XSquare,
  'plus.circle':             PlusCircle,
  'plus.circle.fill':        PlusCircle,
  'plus.square':             PlusSquare,
  'minus.circle':            MinusCircle,
  'minus.circle.fill':       MinusCircle,
  'minus.square':            MinusSquare,
  'circle':                  LucideCircle,
  'circle.fill':             LucideCircle,
  'square':                  Square,
  'square.fill':             Square,
  'triangle':                Triangle,
  'triangle.fill':           Triangle,
  'octagon':                 Octagon,
  // Filters / sorting / search
  'line.3.horizontal':       List,
  'line.3.horizontal.decrease': Filter,
  'arrow.up.arrow.down':     ArrowUpDown,
  'slider.horizontal.3':     Sliders,
  // Sharing
  'square.and.arrow.down':   Download,
  'square.and.arrow.up.on.square': Share2,
  'icloud':                  CloudIcon,
  'icloud.and.arrow.up':     CloudUpload,
  'icloud.and.arrow.down':   CloudDownload,
  'arrow.down.circle':       ArrowDownCircle,
  'arrow.up.circle':         ArrowUpCircle,
  'arrow.clockwise':         RefreshCw,
  'arrow.counterclockwise':  RotateCcw,
  // Communication extra
  'message':                 MsgSquare,
  'message.fill':            MsgSquare,
  'envelope.open':           MailOpen,
  'envelope.badge':          Mail,
  'envelope.arrow.triangle.branch': Send,
  'phone.fill':              Phone,
  'phone.arrow.up.right':    PhoneOutgoing,
  'phone.arrow.down.left':   PhoneIncoming,
  'video.fill':              Video,
  'video.slash':             VideoOff,
  'mic.fill':                Mic,
  'mic.slash':               MicOff,
  'mic.slash.fill':          MicOff,
  // Media controls extra
  'speaker':                 Volume,
  'speaker.slash':           VolumeX,
  'speaker.wave.1':          Volume1,
  'speaker.wave.3':          Volume2,
  'shuffle':                 Shuffle,
  'repeat':                  Repeat,
  'repeat.1':                Repeat1,
  'goforward.10':            FastForward,
  'gobackward.10':           Rewind,
  'play.circle':             PlayCircle,
  'play.circle.fill':        PlayCircle,
  'pause.circle':            PauseCircle,
  'pause.circle.fill':       PauseCircle,
  'stop.circle':             StopCircleIcon,
  'stop.circle.fill':        StopCircleIcon,
  // Connectivity
  'wifi.slash':              WifiOff,
  'bluetooth':               Bluetooth,
  'antenna.radiowaves.left.and.right': Radio,
  'airplayvideo':            Cast,
  'airplayaudio':            Cast,
  // Battery
  'battery.0':               BatteryLow,
  'battery.25':              BatteryLow,
  'battery.50':              BatteryMedium,
  'battery.75':              BatteryFull,
  'bolt':                    Zap,
  'bolt.fill':               Zap,
  // Charts & data
  'chart.bar':               BarChart3,
  'chart.bar.fill':          BarChart3,
  'chart.line.uptrend.xyaxis': LineChart,
  'chart.pie':               PieChart,
  'chart.pie.fill':          PieChart,
  'arrow.up.right':          TrendingUp,
  'arrow.down.right':        TrendingDown,
  'percent':                 Percent,
  'number':                  Hash,
  // Time
  'timer':                   Timer,
  'hourglass':               Hourglass,
  'alarm':                   AlarmClock,
  'alarm.fill':              AlarmClock,
  'stopwatch':               Timer,
  'calendar.badge.plus':     CalendarPlus,
  'calendar.badge.minus':    CalendarMinus,
  // Location extra
  'mappin':                  MapPin,
  'mappin.and.ellipse':      MapPin,
  'location.fill':           MapPin,
  'location.circle':         MapPin,
  'arrow.triangle.turn.up.right.diamond': Navigation,
  'flag.checkered':          FlagIcon,
  'safari':                  Compass,
  'compass':                 Compass,
  'globe.americas':          Globe,
  'globe.europe.africa':     Globe,
  'globe.asia.australia':    Globe,
  // Devices
  'iphone':                  Smartphone,
  'ipad':                    Tablet,
  'desktopcomputer':         Monitor,
  'macbook':                 Laptop,
  'tv':                      Tv,
  'tv.fill':                 Tv,
  'headphones':              HeadphonesIcon,
  'airpods':                 HeadphonesIcon,
  'gamecontroller':          Gamepad2,
  'gamecontroller.fill':     Gamepad2,
  'printer':                 Printer,
  'printer.fill':            Printer,
  'speaker.zzz':             VolumeX,
  // Security
  'shield':                  ShieldAlert,
  'shield.fill':             ShieldAlert,
  'lock.fill':               Lock,
  'lock.shield':             ShieldCheck,
  'lock.open.fill':          Unlock,
  'faceid':                  Smile,
  'touchid':                 HandIcon2,
  // Weather
  'sun.max':                 SunIcon,
  'sun.min':                 SunIcon,
  'moon':                    Moon,
  'moon.fill':               Moon,
  'cloud':                   CloudIcon,
  'cloud.fill':              CloudIcon,
  'cloud.rain':              CloudRain,
  'cloud.snow':              CloudSnow,
  'cloud.sun':               CloudSun,
  'cloud.bolt':              CloudLightning,
  'wind':                    Wind,
  'snowflake':               Snowflake,
  'thermometer':             Thermometer,
  'drop':                    Droplets,
  'flame':                   Flame,
  'flame.fill':              Flame,
  // Health & activity
  'heart.text.square':       HeartPulse,
  'figure.walk':             Activity,
  'figure.run':              Activity,
  'dumbbell':                Dumbbell,
  'dumbbell.fill':           Dumbbell,
  'bicycle':                 Bike,
  'figure.yoga':             Activity,
  // Shopping & commerce
  'cart':                    ShoppingCart,
  'cart.fill':               ShoppingCart,
  'creditcard':              CreditCard,
  'creditcard.fill':         CreditCard,
  'dollarsign.circle':       DollarSign,
  'dollarsign.circle.fill':  DollarSign,
  'eurosign.circle':         Euro,
  'sterlingsign.circle':     PoundSterling,
  'yensign.circle':          JapaneseYen,
  'bag':                     ShoppingBag,
  'bag.fill':                ShoppingBag,
  'gift':                    Sparkles,
  'gift.fill':               Sparkles,
  // Food
  'cup.and.saucer':          Coffee,
  'cup.and.saucer.fill':     Coffee,
  'mug':                     Coffee,
  'wineglass':               Wine,
  // Smart home extra
  'lightbulb':               Lightbulb,
  'lightbulb.fill':          Lightbulb,
  'lamp.desk':               Lamp,
  'lamp.ceiling':            Lamp,
  'fan':                     Fan,
  'fan.desk':                Fan,
  'thermometer.sun':         Thermometer,
  'house.lodge':             Home,
  'building':                Building,
  'building.2':              Building2,
  'door.left.hand.open':     DoorOpen,
  'door.left.hand.closed':   DoorClosed,
  'window.vertical.open':    Square,
  'bathtub':                 Bath,
  'shower':                  Bath,
  // Transport
  'car':                     Car,
  'car.fill':                Car,
  'airplane':                Plane,
  'airplane.departure':      Plane,
  'airplane.arrival':        Plane,
  'tram':                    Train,
  'tram.fill':               Train,
  'fuelpump':                Fuel,
  'sailboat':                Sailboat,
  // Knowledge & education
  'book':                    Book,
  'book.fill':               Book,
  'book.closed':             Book,
  'graduationcap':           GraduationCap,
  'graduationcap.fill':      GraduationCap,
  'pencil.and.ruler':        Pencil,
  'magazine':                NewspaperIcon,
  'magazine.fill':           NewspaperIcon,
  // Awards & achievement
  'trophy':                  Trophy,
  'trophy.fill':             Trophy,
  'medal':                   Medal,
  'medal.fill':              Medal,
  'crown':                   Crown,
  'crown.fill':              Crown,
  'rosette':                 Award,
  // Reactions
  'hand.thumbsup':           ThumbsUp,
  'hand.thumbsup.fill':      ThumbsUp,
  'hand.thumbsdown':         ThumbsDown,
  'hand.thumbsdown.fill':    ThumbsDown,
  'hand.wave':               HandIcon2,
  'hand.wave.fill':          HandIcon2,
  'face.smiling':            Smile,
  'face.smiling.fill':       Smile,
  // Tools / editing
  'wrench':                  Wrench,
  'wrench.fill':             Wrench,
  'hammer':                  Hammer,
  'hammer.fill':             Hammer,
  'screwdriver':             Wrench,
  'paintbrush':              Brush,
  'paintbrush.fill':         Brush,
  'paintpalette':            LucidePalette,
  'eyedropper':              Pipette,
  'scissors':                Scissors,
  'ruler':                   Ruler,
  // Vision & accessibility extra
  'eye.fill':                Eye,
  'eye.trianglebadge.exclamationmark': AlertTriangleIcon,
  'ear':                     Ear,
  'ear.fill':                Ear,
  'figure.roll':             Accessibility,
  // Misc
  'tag.fill':                Tag,
  'tag.circle':              Tag,
  'bookmark.circle':         Bookmark,
  'star.circle':             Star,
  'star.circle.fill':        Star,
  'heart.circle':            Heart,
  'heart.circle.fill':       Heart,
  'rectangle.stack':         Layers,
  'rectangle.portrait':      RectangleHorizontal,
  'rectangle.landscape':     RectangleHorizontal,
  'square.grid.3x3':         Grid3x3,
  'square.grid.4x3':         Grid3x3,
  'circle.grid.2x2':         LayoutGrid,
  'circle.grid.3x3':         LayoutGrid,
  'power':                   Power,
  'power.circle':            Power,
  'powersleep':              Moon,
  'questionmark':            HelpCircle,
  'exclamationmark':         AlertCircle,
  'exclamationmark.circle':  AlertCircle,
  'exclamationmark.octagon': AlertOctagon,
  'at':                      AtSign,
  'asterisk':                AsteriskSquare,
  'function':                Hash
}

// SwiftUI symbol-config → Lucide drawing knobs.
//
// `fontWeight` (SwiftUI weights propagate to symbols by default) maps
// to Lucide's `strokeWidth`. Values are calibrated so a regular-weight
// label reads the same as Lucide's stock 1.5pt stroke — close to SF
// Pro's medium weight at body size.
export const SYMBOL_WEIGHT_STROKES = {
  ultraLight: 0.75,
  thin:       1.0,
  light:      1.2,
  regular:    1.5,
  medium:     1.75,
  semibold:   2.0,
  bold:       2.25,
  heavy:      2.5,
  black:      2.75
}

// `.imageScale(.small|.medium|.large)` — SwiftUI scales the symbol's
// drawing box relative to the surrounding text. The multipliers below
// match Apple's reference scale (small ≈ 0.84, medium 1.0, large ≈ 1.2).
export const SYMBOL_IMAGE_SCALES = {
  small:  0.84,
  medium: 1.0,
  large:  1.2
}

// SwiftUI `.symbolVariant(_:)` resolves a base symbol to a variant
// glyph by appending the variant suffix to the name and looking it
// up again. e.g. `house` + `.fill` → `house.fill`. When the variant
// isn't in our catalogue, fall back to the base name so the picker
// stays predictable.
export function resolveSymbolName(name, variant) {
  if (!name) return name
  if (!variant || variant === 'default' || variant === 'none') return name
  // SwiftUI variants only ever append, never replace prefix segments.
  // Most fill/circle/square/slash variants follow the same pattern.
  const candidate = `${name}.${variant}`
  if (SF_TO_LUCIDE[candidate]) return candidate
  return name
}

// SwiftUI `.symbolRenderingMode(_:)` adjusts how the symbol is painted.
// Lucide icons are single-path outline glyphs, so the multi-layer modes
// (hierarchical / palette / multicolor) can only be approximated. We
// match the visual ordering Apple uses:
//   - monochrome   → full tint, 1.0 opacity (default)
//   - hierarchical → tint at 0.7 opacity (faded primary layer)
//   - palette      → tint + secondary color hint (we shift stroke to
//                    the second tint when provided)
//   - multicolor   → full saturation tint with a slightly thicker stroke
//                    so the glyph reads as "vivid"
export function symbolModeStyling(mode, color, secondaryColor) {
  if (mode === 'hierarchical') return { color, opacity: 0.7,  weightBoost: 0 }
  if (mode === 'palette')      return { color: secondaryColor || color, opacity: 1.0, weightBoost: 0 }
  if (mode === 'multicolor')   return { color, opacity: 1.0, weightBoost: 0.25 }
  return { color, opacity: 1.0, weightBoost: 0 }
}

// Render an SF Symbol as a Lucide icon with SwiftUI-style settings.
// `name`        — SF Symbol name (e.g. 'info.circle').
// `size`        — base size in px (default 14, matches SwiftUI body).
// `weight`      — SwiftUI font weight (drives stroke width).
// `imageScale`  — '.imageScale(...)' (small / medium / large).
// `color`       — CSS color string. Defaults to `currentColor` so DOM
//                 call sites inherit foreground colour automatically.
export function SymbolIcon({
  name,
  size = 14,
  weight = 'regular',
  imageScale = 'medium',
  color = 'currentColor',
  // `.symbolVariant(.fill | .circle | .square | .slash)` — appends a
  // suffix and re-resolves via SF_TO_LUCIDE.
  variant = null,
  // `.symbolRenderingMode(_:)` — adjusts paint. Multi-layer modes are
  // approximated since Lucide is single-path.
  renderingMode = 'monochrome',
  secondaryColor = null,
  className,
  style
}) {
  const resolved = resolveSymbolName(name, variant)
  const Icon = SF_TO_LUCIDE[resolved] || LucideCircle
  const mode = symbolModeStyling(renderingMode, color, secondaryColor)
  const strokeWidth = (SYMBOL_WEIGHT_STROKES[weight] ?? 1.5) + mode.weightBoost
  const scaled = Math.round(size * (SYMBOL_IMAGE_SCALES[imageScale] ?? 1.0))
  return (
    <Icon
      size={scaled}
      strokeWidth={strokeWidth}
      color={mode.color}
      absoluteStrokeWidth
      className={className}
      style={{ opacity: mode.opacity, ...style }}
    />
  )
}
