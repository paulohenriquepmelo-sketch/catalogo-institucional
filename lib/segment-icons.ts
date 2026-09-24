import {
  ShoppingBasket,
  UtensilsCrossed,
  Croissant,
  Candy,
  Wine,
  Package,
  Sparkles,
  SprayCan,
  CookingPot,
  Store,
  Beer,
  Truck,
  Pizza,
  Hamburger,
  IceCreamCone,
  Soup,
  TreePine,
  type LucideIcon,
} from 'lucide-react';
import { normalize } from './catalog-config';
export function segmentIcon(name: string) {
  const text = normalize(name);
  if (/supermerc|mercear|mercado/.test(text)) return ShoppingBasket;
  if (/restaur|lanchon/.test(text)) return UtensilsCrossed;
  if (/padari|confeit/.test(text)) return Croissant;
  if (/docer|bombon|doce/.test(text)) return Candy;
  if (/bares|bar |convenien|bebida/.test(text)) return Wine;
  if (/delivery|embalag/.test(text)) return Package;
  if (/perfum|higiene|beleza/.test(text)) return Sparkles;
  if (/limpeza/.test(text)) return SprayCan;
  if (/utilidad|bazar/.test(text)) return CookingPot;
  return Store;
}

// Ícone pelo nome definido nas regras dos segmentos (lib/segment-rules.ts),
// os mesmos do app mobile.
const ICONS_BY_ID: Record<string, LucideIcon> = {
  basket: ShoppingBasket,
  restaurant: UtensilsCrossed,
  bread: Croissant,
  candy: Candy,
  beer: Beer,
  truck: Truck,
  medkit: Sparkles,
  spray: SprayCan,
  grid: CookingPot,
  pizza: Pizza,
  'fast-food': Hamburger,
  'ice-cream': IceCreamCone,
  soup: Soup,
  tree: TreePine,
};
export function segmentIconById(icon: string, name = ''): LucideIcon {
  return ICONS_BY_ID[icon] ?? segmentIcon(name);
}
