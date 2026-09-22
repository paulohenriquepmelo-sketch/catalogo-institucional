import type { ComponentType } from 'react';
import type { ColorValue } from 'react-native';
import type { LucideProps } from 'lucide-react-native';
import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  BottleWine,
  Bell,
  BadgeInfo,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock,
  CloudOff,
  CupSoda,
  FlaskConical,
  Grid2X2,
  Handshake,
  Headphones,
  House,
  Image as ImageIcon,
  Mail,
  Package,
  Percent,
  Search,
  ShieldCheck,
  ShoppingBasket,
  SoapDispenserDroplet,
  Sparkles,
  SprayCan,
  Tag,
  Tags,
  Truck,
  XCircle,
} from 'lucide-react-native';

export type AppIconName =
  | 'alarm'
  | 'arrow-back'
  | 'arrow-forward'
  | 'basket'
  | 'beer'
  | 'business'
  | 'cafe'
  | 'chevron-down'
  | 'chevron-forward'
  | 'circle-alert'
  | 'cloud-offline'
  | 'close-circle'
  | 'cube'
  | 'flask'
  | 'grid'
  | 'handshake'
  | 'headset'
  | 'home'
  | 'image'
  | 'information-circle'
  | 'mail'
  | 'medkit'
  | 'notifications'
  | 'people'
  | 'percent'
  | 'pricetag'
  | 'pricetags'
  | 'search'
  | 'shield-checkmark'
  | 'sparkles'
  | 'spray'
  | 'time'
  | 'truck';

const icons: Record<AppIconName, ComponentType<LucideProps>> = {
  alarm: AlarmClock,
  'arrow-back': ArrowLeft,
  'arrow-forward': ArrowRight,
  basket: ShoppingBasket,
  beer: BottleWine,
  business: Building2,
  cafe: CupSoda,
  'chevron-down': ChevronDown,
  'chevron-forward': ChevronRight,
  'circle-alert': CircleAlert,
  'cloud-offline': CloudOff,
  'close-circle': XCircle,
  cube: Package,
  flask: FlaskConical,
  grid: Grid2X2,
  handshake: Handshake,
  headset: Headphones,
  home: House,
  image: ImageIcon,
  'information-circle': BadgeInfo,
  mail: Mail,
  medkit: SoapDispenserDroplet,
  notifications: Bell,
  people: Handshake,
  percent: Percent,
  pricetag: Tag,
  pricetags: Tags,
  search: Search,
  'shield-checkmark': ShieldCheck,
  sparkles: Sparkles,
  spray: SprayCan,
  time: Clock,
  truck: Truck,
};

type Props = {
  name: AppIconName;
  size?: number;
  // A barra de abas do React Navigation entrega ColorValue; na prática são
  // sempre cores em texto (hex/rgba), que é o que o SVG do lucide aceita.
  color?: ColorValue;
  strokeWidth?: number;
  fill?: ColorValue;
};

export function AppIcon({
  name,
  size = 24,
  color = '#0b347d',
  strokeWidth = 2,
  fill = 'none',
}: Props) {
  const Icon = icons[name];
  return <Icon width={size} height={size} color={color as string} strokeWidth={strokeWidth} fill={fill as string} />;
}
