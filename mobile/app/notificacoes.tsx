import { useCallback, useEffect, useMemo } from 'react';
import { router } from 'expo-router';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { useCatalog } from '@/lib/catalog-store';
import { buildNotifications, markNotificationsSeen } from '@/lib/notifications';
import { colors, radius, spacing, typography } from '@/lib/theme';

function timeAgo(at: number) {
  const diff = Date.now() - at;
  if (diff < 0) return 'agora';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return minutes <= 1 ? 'agora' : `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? 'ontem' : `há ${days} dias`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'há 1 mês' : `há ${months} meses`;
}

export default function NotificacoesScreen() {
  const { products, config, offline } = useCatalog();

  const notifications = useMemo(
    () => buildNotifications(products, config),
    [products, config],
  );
  const renderNotification = useCallback<
    ListRenderItem<(typeof notifications)[number]>
  >(
    ({ item }) => (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => router.push(`/produto/${item.productId}`)}
      >
        <View
          style={[
            styles.iconWrap,
            item.kind === 'offer' ? styles.iconOffer : styles.iconNew,
          ]}
        >
          <AppIcon
            name={item.kind === 'offer' ? 'percent' : 'sparkles'}
            size={20}
            color="#fff"
          />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.cardMessage} numberOfLines={2}>{item.message}</Text>
          <Text style={styles.cardTime}>{timeAgo(item.at)}</Text>
        </View>
        <AppIcon name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    ),
    [],
  );

  // Abrir a tela marca tudo como visto e zera o contador do sino.
  useEffect(() => {
    void markNotificationsSeen();
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Notificações</Text>
        <Text style={styles.subtitle}>
          {notifications.length === 0
            ? 'Nenhuma novidade por enquanto'
            : `${notifications.length} ${notifications.length === 1 ? 'aviso' : 'avisos'} do catálogo`}
        </Text>
      </View>

      {offline ? (
        <View style={styles.offlineBanner}>
          <AppIcon name="cloud-offline" size={16} color="#7a5b00" />
          <Text style={styles.offlineText}>Sem conexão — avisos do catálogo salvo.</Text>
        </View>
      ) : null}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        contentContainerStyle={styles.list}
        renderItem={renderNotification}
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppIcon name="notifications" size={44} color={colors.border} />
            <Text style={styles.emptyTitle}>Tudo em dia</Text>
            <Text style={styles.emptyText}>
              Quando houver ofertas ativas ou produtos novos no catálogo, os avisos aparecem aqui.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#fff3cd',
    padding: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  offlineText: { ...typography.small, color: '#7a5b00', flex: 1 },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardPressed: { opacity: 0.85 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOffer: { backgroundColor: colors.accent },
  iconNew: { backgroundColor: colors.primary },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { ...typography.body, color: colors.text, fontWeight: '700' },
  cardMessage: { ...typography.small, color: colors.textMuted },
  cardTime: { ...typography.small, color: colors.textMuted, opacity: 0.7, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyTitle: { ...typography.subtitle, color: colors.text, marginTop: spacing.sm },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
});
