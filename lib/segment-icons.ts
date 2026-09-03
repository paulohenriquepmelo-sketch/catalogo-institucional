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
