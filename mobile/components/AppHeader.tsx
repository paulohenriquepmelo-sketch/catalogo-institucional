import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/AppIcon';
import { useCatalog, useCatalogSearch } from '@/lib/catalog-store';
import {
  buildNotifications,
  countUnread,
  useNotificationsSeenAt,
} from '@/lib/notifications';
import { useAppTheme } from '@/lib/theme-provider';
import { readableColor } from '@/lib/theme-contrast';
import { radius, spacing } from '@/lib/theme';

export function AppHeader({
  canGoBack = false,
  onBack,
}: {
  canGoBack?: boolean;
  onBack?: () => void;
}) {
  const { config, products } = useCatalog();
  const { searchQuery, setSearchQuery } = useCatalogSearch();
  const { id, tokens, copy } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const seenAt = useNotificationsSeenAt();
  const notifications = useMemo(
    () => buildNotifications(products, config),
    [products, config],
  );
  const unread = countUnread(notifications, seenAt);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      backgroundColor: tokens.dark,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 3,
      borderBottomColor: tokens.accent,
    },
    topbar: {
      color: '#ffffff',
      fontSize: 12,
      textAlign: 'center',
      paddingVertical: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: '#ffffff55',
    },
    topRow: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    sideButton: {
      width: 44,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#ffffff',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoMark: { width: 38, height: 38 },
    brandText: { flex: 1, minWidth: 0 },
    title: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
    tagline: { color: '#ffffff', fontSize: 12, marginTop: 2 },
    notificationBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      minWidth: 20,
      minHeight: 20,
      borderRadius: 10,
      paddingHorizontal: 4,
      backgroundColor: tokens.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notificationText: {
      color: readableColor(tokens.onAccent, tokens.accent),
      fontSize: 11,
      fontWeight: '800',
    },
    searchBar: {
      minHeight: 48,
      borderRadius: radius.md,
      backgroundColor: tokens.soft,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: tokens.border,
    },
    searchInput: {
      flex: 1,
      minHeight: 48,
      paddingVertical: spacing.sm,
      color: tokens.ink,
      fontSize: 14,
    },
  }), [tokens]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 4 }]}>
      {id !== 'padrao' ? <Text style={styles.topbar}>{copy.topbar}</Text> : null}
      <View style={styles.topRow}>
        {canGoBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            onPress={onBack ?? (() => router.back())}
            style={styles.sideButton}
          >
            <AppIcon name="arrow-back" size={28} color="#ffffff" />
          </Pressable>
        ) : null}

        <View style={styles.logoCircle}>
          <Image
            source={require('@/assets/brand-mark.png')}
            style={styles.logoMark}
            resizeMode="contain"
          />
        </View>
        <View style={styles.brandText}>
          <Text style={styles.title}>
            {config?.name ?? 'DISTRIBUIDORA LAURENCINI'}
          </Text>
          <Text style={styles.tagline}>
            {config?.tagline ?? 'Seu mix completo de atacado e distribuição.'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `Notificações, ${unread} não lidas` : 'Notificações'}
          onPress={() => router.navigate('/notificacoes')}
          style={styles.sideButton}
        >
          <AppIcon name="notifications" size={26} color="#ffffff" />
          {unread > 0 ? (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>
      <View style={styles.searchBar}>
        <AppIcon name="search" size={22} color={tokens.ink} />
        <TextInput
          accessibilityLabel="Buscar produtos, marcas ou categorias"
          placeholder="Buscar produtos, marcas ou categorias..."
          placeholderTextColor={tokens.muted}
          value={searchQuery}
          onFocus={() => router.navigate('/(tabs)/catalogo')}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => router.navigate('/(tabs)/catalogo')}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={styles.searchInput}
        />
      </View>
    </View>
  );
}
