import type { ComponentType } from 'react';
import type { ColorValue } from 'react-native';
import type { LucideProps } from 'lucide-react-native';
import {
  AlarmClock,
  ArrowLeft,
  ArrowRight,
  BottleWine,
  Candy,
  Croissant,
  Hamburger,
  IceCreamCone,
  Pizza,
  Soup,
  Store,
  UtensilsCrossed,
  Bell,
  BadgeInfo,
  Balloon,
  Cake,
  Gift,
  Heart,
  Music,
  PartyPopper,
  TreePine,
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
  | 'bread'
  | 'balloon'
  | 'business'
  | 'cake'
  | 'candy'
  | 'cafe'
  | 'chevron-down'
  | 'chevron-forward'
  | 'circle-alert'
  | 'cloud-offline'
  | 'close-circle'
  | 'cube'
  | 'fast-food'
  | 'flask'
  | 'gift'
  | 'grid'
  | 'handshake'
  | 'heart'
  | 'headset'
  | 'home'
  | 'ice-cream'
  | 'image'
  | 'information-circle'
  | 'mail'
  | 'music'
  | 'medkit'
  | 'notifications'
  | 'party'
  | 'people'
  | 'percent'
  | 'pricetag'
  | 'pizza'
  | 'pricetags'
  | 'restaurant'
  | 'search'
  | 'shield-checkmark'
  | 'soup'
  | 'sparkles'
  | 'spray'
  | 'store'
  | 'time'
  | 'tree'
  | 'truck';

const icons: Record<AppIconName, ComponentType<LucideProps>> = {
  alarm: AlarmClock,
  'arrow-back': ArrowLeft,
  'arrow-forward': ArrowRight,
  basket: ShoppingBasket,
  beer: BottleWine,
  bread: Croissant,
  balloon: Balloon,
  business: Building2,
  cake: Cake,
  candy: Candy,
  cafe: CupSoda,
  'chevron-down': ChevronDown,
  'chevron-forward': ChevronRight,
  'circle-alert': CircleAlert,
  'cloud-offline': CloudOff,
  'close-circle': XCircle,
  cube: Package,
  'fast-food': Hamburger,
  flask: FlaskConical,
  gift: Gift,
  grid: Grid2X2,
  handshake: Handshake,
  heart: Heart,
  headset: Headphones,
  home: House,
  'ice-cream': IceCreamCone,
  image: ImageIcon,
  'information-circle': BadgeInfo,
  mail: Mail,
  music: Music,
  medkit: SoapDispenserDroplet,
  notifications: Bell,
  party: PartyPopper,
  people: Handshake,
  percent: Percent,
  pricetag: Tag,
  pizza: Pizza,
  pricetags: Tags,
  restaurant: UtensilsCrossed,
  search: Search,
  'shield-checkmark': ShieldCheck,
  soup: Soup,
  sparkles: Sparkles,
  spray: SprayCan,
  store: Store,
  time: Clock,
  tree: TreePine,
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
