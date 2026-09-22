import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activeOffers, newProducts, type CatalogConfig, type Product } from './api';

const SEEN_KEY = '@catalogo/notifications-seen';

export type AppNotification = {
  id: string;
  kind: 'offer' | 'new';
  title: string;
  message: string;
  productId: number;
  at: number;
};

// Estado compartilhado simples: o sino do cabeçalho precisa saber, na hora,
// que a tela de notificações foi aberta para zerar o contador.
let seenAt = 0;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

async function hydrateSeenAt() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    const parsed = raw ? Number(raw) : 0;
    seenAt = Number.isFinite(parsed) ? parsed : 0;
  } catch {
    seenAt = 0;
  }
  emit();
}

export async function markNotificationsSeen(): Promise<void> {
  hydrated = true;
  seenAt = Date.now();
  emit();
  try {
    await AsyncStorage.setItem(SEEN_KEY, String(seenAt));
  } catch {
    // Sem persistência o contador volta na próxima abertura — aceitável.
  }
}

export function useNotificationsSeenAt(): number {
  const [value, setValue] = useState(seenAt);
  useEffect(() => {
    const listener = () => setValue(seenAt);
    listeners.add(listener);
    void hydrateSeenAt();
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return value;
}

function formatDate(value?: string) {
  if (!value) return '';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('pt-BR');
}

/**
 * Monta a lista de notificações a partir do próprio catálogo publicado:
 * ofertas ativas e produtos novos. Sem inventar nada — tudo vem dos dados
 * que o app já baixou, então funciona inclusive offline.
 */
export function buildNotifications(
  products: Product[],
  config: CatalogConfig | null,
): AppNotification[] {
  const list: AppNotification[] = [];

  for (const product of activeOffers(products, 25)) {
    const offer = product.details?.offer;
    if (!offer) continue;
    const startedAt = Date.parse(`${offer.startsAt}T00:00:00`);
    list.push({
      id: `offer-${product.id}`,
      kind: 'offer',
      title: `${offer.discount}% OFF em ${product.name}`,
      message: offer.endsAt
        ? `Oferta válida até ${formatDate(offer.endsAt)}.`
        : 'Oferta ativa no catálogo.',
      productId: product.id,
      at: Number.isFinite(startedAt) ? startedAt : Date.now(),
    });
  }

  for (const product of newProducts(products, config?.newProducts.days ?? 30, 25)) {
    const createdAt = Date.parse(product.createdAt ?? '');
    list.push({
      id: `new-${product.id}`,
      kind: 'new',
      title: `Novo no catálogo: ${product.name}`,
      message: product.brand ? `Marca ${product.brand}.` : 'Recém-adicionado ao catálogo.',
      productId: product.id,
      at: Number.isFinite(createdAt) ? createdAt : Date.now(),
    });
  }

  return list.sort((a, b) => b.at - a.at).slice(0, 40);
}

export function countUnread(notifications: AppNotification[], seen: number): number {
  if (!seen) return notifications.length;
  return notifications.filter((item) => item.at > seen).length;
}
