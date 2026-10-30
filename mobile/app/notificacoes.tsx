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
import { ThemedBackground } from '@/components/ThemedBackground';
import { PanelHeading, ThemedPanel } from '@/components/ThemedPanel';
import { useCatalog } from '@/lib/catalog-store';
import { buildNotifications, markNotificationsSeen } from '@/lib/notifications';
import { useAppTheme } from '@/lib/theme-provider';
import { readableColor } from '@/lib/theme-contrast';
import { radius, spacing, typography } from '@/lib/theme';

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
  const { tokens } = useAppTheme();
  const notifications = useMemo(
    () => buildNotifications(products, config),
    [products, config],
  );

  const styles = useMemo(() => StyleSheet.create({
    list: { flex: 1 },
    content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    header: { marginHorizontal: -spacing.lg, marginBottom: spacing.lg },
    notice: { padding: spacing.lg, backgroundColor: tokens.soft },
    noticeText: { ...typography.body, color: tokens.ink },
    card: {
      minHeight: 44,
      marginBottom: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: tokens.border,
      backgroundColor: tokens.soft,
      padding: spacing.md,
      gap: spacing.md,
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    pressed: { opacity: 0.85 },
    icon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.accent,
    },
    body: { flex: 1, gap: spacing.xs },
    title: { ...typography.body, color: tokens.ink, fontWeight: '700' },
    message: { ...typography.body, color: tokens.muted },
    time: { ...typography.small, color: tokens.muted, marginTop: spacing.xs },
    empty: {
      alignItems: 'center',
      padding: spacing.xl,
      gap: spacing.md,
      borderRadius: radius.md,
      backgroundColor: tokens.soft,
    },
    emptyTitle: { ...typography.subtitle, color: tokens.ink },
    emptyText: { ...typography.body, color: tokens.muted, textAlign: 'center' },
  }), [tokens]);

  const renderNotification = useCallback<ListRenderItem<(typeof notifications)[number]>>(
    ({ item }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.message}`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        onPress={() => router.push(`/produto/${item.productId}`)}
      >
        <View style={styles.icon}>
          <AppIcon
            name={item.kind === 'offer' ? 'percent' : 'sparkles'}
            size={22}
            color={readableColor(tokens.onAccent, tokens.accent)}
          />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.message}>{item.message}</Text>
          <Text style={styles.time}>{timeAgo(item.at)}</Text>
        </View>
      </Pressable>
    ),
    [styles, tokens],
  );

  useEffect(() => {
    void markNotificationsSeen();
  }, []);

  return (
    <ThemedBackground>
      <FlatList
        style={styles.list}
        data={notifications}
        keyExtractor={(item) => item.id}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        contentContainerStyle={styles.content}
        renderItem={renderNotification}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedPanel>
              <PanelHeading
                title="Notificações"
                subtitle={notifications.length === 0
                  ? 'Nenhuma novidade por enquanto'
                  : `${notifications.length} ${notifications.length === 1 ? 'aviso' : 'avisos'} do catálogo`}
              />
            </ThemedPanel>
            {offline ? (
              <View style={styles.notice}>
                <Text style={styles.noticeText}>Sem conexão — avisos do catálogo salvo.</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppIcon name="notifications" size={40} color={tokens.muted} />
            <Text style={styles.emptyTitle}>Tudo em dia</Text>
            <Text style={styles.emptyText}>
              Quando houver ofertas ativas ou produtos novos no catálogo, os avisos aparecem aqui.
            </Text>
          </View>
        }
      />
    </ThemedBackground>
  );
}
