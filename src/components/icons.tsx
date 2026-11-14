// Every icon on the website, as Phosphor duotone, matching the app's
// duotone_icon.dart. Names are the ones the code already used (they came from
// lucide), so a page only imports from here. Sizing still comes from
// className (h-4 w-4): CSS overrides Phosphor's 1em default.
import { forwardRef } from 'react';
import {
  AddressBook,
  ArrowClockwise,
  ArrowElbowDownLeft,
  ArrowRight as PhArrowRight,
  ArrowsLeftRight,
  Bell as PhBell,
  BookOpen as PhBookOpen,
  Bug as PhBug,
  Buildings,
  CalendarBlank,
  CalendarCheck,
  Camera as PhCamera,
  CaretDown,
  CaretUp,
  CaretLeft,
  CaretRight,
  ChartLine as PhChartLine,
  Check as PhCheck,
  CheckCircle,
  Circle as PhCircle,
  Checks,
  CircleNotch,
  Circuitry,
  Clock as PhClock,
  CloudArrowUp,
  Compass as PhCompass,
  Copy as PhCopy,
  Dna as PhDna,
  DotsThree,
  DownloadSimple,
  Envelope,
  Eye as PhEye,
  EyeSlash,
  File as PhFile,
  FileText as PhFileText,
  FolderOpen as PhFolderOpen,
  Footprints as PhFootprints,
  Gavel as PhGavel,
  Gear,
  GraduationCap as PhGraduationCap,
  HandHeart,
  House as PhHouse,
  Image as PhImage,
  Info as PhInfo,
  Keyboard as PhKeyboard,
  Lightbulb as PhLightbulb,
  Link,
  List,
  Lock as PhLock,
  MagnifyingGlass,
  MapPin as PhMapPin,
  Medal,
  Megaphone as PhMegaphone,
  Minus as PhMinus,
  Moon as PhMoon,
  MusicNotes,
  Notepad as PhNotepad,
  PaintBrush,
  Palette as PhPalette,
  Path,
  PencilSimple,
  Phone as PhPhone,
  Planet,
  Play as PhPlay,
  Plus as PhPlus,
  Presentation as PhPresentation,
  PushPin,
  PushPinSlash,
  QrCode as PhQrCode,
  Scales,
  Scan,
  Scroll,
  ShieldCheck as PhShieldCheck,
  SignOut,
  Sparkle,
  SquaresFour,
  Sun as PhSun,
  Trash,
  Tray,
  User as PhUser,
  UserCheck as PhUserCheck,
  UserCircle,
  UserMinus,
  Users as PhUsers,
  Warning,
  WarningCircle,
  X as PhX,
  XCircle as PhXCircle,
  Terminal as PhTerminal,
  Robot,
  Rocket,
  MathOperations,
  Flask,
  Globe as PhGlobe,
  Brain,
  MusicNote,
  Wrench,
  Calculator,
  TrendUp,
  InstagramLogo,
  Quotes as PhQuotes,
  ChatText,
  type Icon,
  type IconProps,
} from '@phosphor-icons/react';

/** The icon component type (was lucide's LucideIcon). */
export type AppIcon = Icon;
export type LucideIcon = Icon;

function duotone(Base: Icon, name: string): Icon {
  const Wrapped = forwardRef<SVGSVGElement, IconProps>((props, ref) => (
    <Base ref={ref} weight="duotone" {...props} />
  ));
  Wrapped.displayName = name;
  return Wrapped as Icon;
}

// Same thing, same icon as the app: tabs are Home, Schedule, Discover, Announcements (News in the app).
export const House = duotone(PhHouse, 'House');
export const Notepad = duotone(PhNotepad, 'Notepad');
export const Compass = duotone(PhCompass, 'Compass');

export const AlertCircle = duotone(WarningCircle, 'AlertCircle');
export const AlertTriangle = duotone(Warning, 'AlertTriangle');
export const ArrowLeftRight = duotone(ArrowsLeftRight, 'ArrowLeftRight');
export const ArrowRight = duotone(PhArrowRight, 'ArrowRight');
export const Award = duotone(Medal, 'Award');
export const Bell = duotone(PhBell, 'Bell');
export const Bug = duotone(PhBug, 'Bug');
export const BookOpen = duotone(PhBookOpen, 'BookOpen');
export const BookUser = duotone(AddressBook, 'BookUser');
export const CalendarCog = duotone(CalendarCheck, 'CalendarCog');
export const CalendarDays = duotone(CalendarBlank, 'CalendarDays');
export const Camera = duotone(PhCamera, 'Camera');
export const ChartLine = duotone(PhChartLine, 'ChartLine');
export const Check = duotone(PhCheck, 'Check');
export const CheckCheck = duotone(Checks, 'CheckCheck');
export const CheckCircle2 = duotone(CheckCircle, 'CheckCircle2');
export const ChevronDown = duotone(CaretDown, 'ChevronDown');
export const ChevronLeft = duotone(CaretLeft, 'ChevronLeft');
export const ChevronRight = duotone(CaretRight, 'ChevronRight');
export const ChevronUp = duotone(CaretUp, 'ChevronUp');
export const Circle = duotone(PhCircle, 'Circle');
export const CircuitBoard = duotone(Circuitry, 'CircuitBoard');
export const Clock = duotone(PhClock, 'Clock');
export const Clock3 = duotone(PhClock, 'Clock3');
export const Copy = duotone(PhCopy, 'Copy');
export const CornerDownLeft = duotone(ArrowElbowDownLeft, 'CornerDownLeft');
export const Dna = duotone(PhDna, 'Dna');
export const Download = duotone(DownloadSimple, 'Download');
export const MoreHorizontal = duotone(DotsThree, 'MoreHorizontal');
export const Eye = duotone(PhEye, 'Eye');
export const EyeOff = duotone(EyeSlash, 'EyeOff');
export const File = duotone(PhFile, 'File');
export const FileText = duotone(PhFileText, 'FileText');
export const FolderOpen = duotone(PhFolderOpen, 'FolderOpen');
export const Footprints = duotone(PhFootprints, 'Footprints');
export const Gavel = duotone(PhGavel, 'Gavel');
export const GraduationCap = duotone(PhGraduationCap, 'GraduationCap');
export const HeartHandshake = duotone(HandHeart, 'HeartHandshake');
export const ImageIcon = duotone(PhImage, 'ImageIcon');
export const Inbox = duotone(Tray, 'Inbox');
export const Info = duotone(PhInfo, 'Info');
export const Keyboard = duotone(PhKeyboard, 'Keyboard');
export const LayoutDashboard = duotone(SquaresFour, 'LayoutDashboard');
export const Lightbulb = duotone(PhLightbulb, 'Lightbulb');
export const Link2 = duotone(Link, 'Link2');
export const Loader2 = duotone(CircleNotch, 'Loader2');
export const Lock = duotone(PhLock, 'Lock');
export const LogOut = duotone(SignOut, 'LogOut');
export const Mail = duotone(Envelope, 'Mail');
export const MapPin = duotone(PhMapPin, 'MapPin');
export const Megaphone = duotone(PhMegaphone, 'Megaphone');
export const Menu = duotone(List, 'Menu');
export const Minus = duotone(PhMinus, 'Minus');
export const Moon = duotone(PhMoon, 'Moon');
export const Music = duotone(MusicNotes, 'Music');
export const Orbit = duotone(Planet, 'Orbit');
export const Paintbrush = duotone(PaintBrush, 'Paintbrush');
export const Palette = duotone(PhPalette, 'Palette');
export const Pencil = duotone(PencilSimple, 'Pencil');
export const Phone = duotone(PhPhone, 'Phone');
export const Pin = duotone(PushPin, 'Pin');
export const PinOff = duotone(PushPinSlash, 'PinOff');
export const Play = duotone(PhPlay, 'Play');
export const Plus = duotone(PhPlus, 'Plus');
export const Presentation = duotone(PhPresentation, 'Presentation');
export const QrCode = duotone(PhQrCode, 'QrCode');
export const RefreshCw = duotone(ArrowClockwise, 'RefreshCw');
export const Route = duotone(Path, 'Route');
export const Scale = duotone(Scales, 'Scale');
export const ScanLine = duotone(Scan, 'ScanLine');
export const School = duotone(Buildings, 'School');
export const ScrollText = duotone(Scroll, 'ScrollText');
export const Search = duotone(MagnifyingGlass, 'Search');
export const Settings = duotone(Gear, 'Settings');
export const ShieldCheck = duotone(PhShieldCheck, 'ShieldCheck');
export const Sparkles = duotone(Sparkle, 'Sparkles');
export const Sun = duotone(PhSun, 'Sun');
export const Trash2 = duotone(Trash, 'Trash2');
export const UploadCloud = duotone(CloudArrowUp, 'UploadCloud');
export const User = duotone(PhUser, 'User');
export const UserCheck = duotone(PhUserCheck, 'UserCheck');
export const UserRound = duotone(UserCircle, 'UserRound');
export const UserX = duotone(UserMinus, 'UserX');
export const Users = duotone(PhUsers, 'Users');
export const X = duotone(PhX, 'X');
export const XCircle = duotone(PhXCircle, 'XCircle');
export const Globe = duotone(PhGlobe, 'Globe');
export const Instagram = duotone(InstagramLogo, 'Instagram');
export const Quotes = duotone(PhQuotes, 'Quotes');
export const MessageSquare = duotone(ChatText, 'MessageSquare');

/** The app's discipline icon keys (disciplineIcon() in models.dart), as Phosphor icons. */
export const DISCIPLINE_ICONS: Record<string, Icon> = {
  terminal: duotone(PhTerminal, 'Terminal'),
  precision_manufacturing: duotone(Robot, 'Robot'),
  biotech: Dna,
  rocket_launch: duotone(Rocket, 'Rocket'),
  palette: Palette,
  functions: duotone(MathOperations, 'MathOperations'),
  science: duotone(Flask, 'Flask'),
  public: Globe,
  psychology: duotone(Brain, 'Brain'),
  music_note: duotone(MusicNote, 'MusicNote'),
  engineering: duotone(Wrench, 'Wrench'),
  calculate: duotone(Calculator, 'Calculator'),
  gavel: Gavel,
  lightbulb: Lightbulb,
  trending_up: duotone(TrendUp, 'TrendUp'),
  category: LayoutDashboard,
};
