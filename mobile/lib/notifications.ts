import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  activeOffers,
  newProducts,
  type CatalogConfig,
  type Product,
} from '@/lib/api';

const SEEN_KEY = '@catalogo/notifications-seen';

export type AppNotification = {
  id: string;
  kind: 'offer' | 'new';
  title: string;
  message: string;
  productId: number;
  at: number;
};

let seenAt = 0;
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

async function hydrateSeenAt(): Promise<void> {
  if (hydrated) return;
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    let cached = 0;
    try {
      const raw = await AsyncStorage.getItem(SEEN_KEY);
      const parsed = raw ? Number(raw) : 0;
      cached = Number.isFinite(parsed) ? parsed : 0;
    } catch {
      cached = 0;
    }

    // Uma abertura da tela durante a leitura prevalece sobre o cache antigo.
    if (!hydrated) {
      seenAt = cached;
      hydrated = true;
      emit();
    }
  })();

  return hydrationPromise;
}

export async function markNotificationsSeen(): Promise<void> {
  hydrated = true;
  seenAt = Date.now();
  emit();
  try {
    await AsyncStorage.setItem(SEEN_KEY, String(seenAt));
  } catch {
    // O contador permanece correto nesta sessão.
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

function formatDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('pt-BR');
}

/**
 * Os seletores compartilhados excluem produtos restritos e ofertas fora
 * da vigência, inclusive ao montar notificações a partir do cache offline.
 */
export function buildNotifications(
  products: Product[],
  config: CatalogConfig | null,
): AppNotification[] {
  const list: AppNotification[] = [];

  for (const product of activeOffers(products, 25)) {
    const offer = product.details?.offer;
    if (!offer) continue;

    list.push({
      id: `offer-${product.id}`,
      kind: 'offer',
      title: `${offer.discount}% OFF em ${product.name}`,
      message: `Oferta válida até ${formatDate(offer.endsAt)}.`,
      productId: product.id,
      at: Date.parse(`${offer.startsAt}T00:00:00`),
    });
  }

  for (const product of newProducts(products, config?.newProducts.fromCode, 25)) {
    const createdAt = Date.parse(product.createdAt ?? '');
    list.push({
      id: `new-${product.id}`,
      kind: 'new',
      title: `Novo no catálogo: ${product.name}`,
      message: product.brand ? `Marca ${product.brand}.` : 'Recém-adicionado ao catálogo.',
      productId: product.id,
      // Sem data, evita criar uma notificação "nova" a cada renderização.
      at: Number.isFinite(createdAt) ? createdAt : 0,
    });
  }

  return list.sort((a, b) => b.at - a.at).slice(0, 40);
}

export function countUnread(notifications: AppNotification[], seen: number): number {
  if (!seen) return notifications.length;
  return notifications.filter((item) => item.at > seen).length;
}
