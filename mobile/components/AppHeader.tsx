import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCatalog, useCatalogSearch } from '@/lib/catalog-store';
import {
  buildNotifications,
  countUnread,
  useNotificationsSeenAt,
} from '@/lib/notifications';
import { radius, spacing } from '@/lib/theme';
import { createThemedStyles, useThemeColors } from '@/lib/app-theme';
import { LogoOrnament, ThemeGarland } from '@/components/ThemeDecor';

export function AppHeader({
  canGoBack = false,
  onBack,
}: {
  canGoBack?: boolean;
  onBack?: () => void;
}) {
  const styles = useStyles();
  const colors = useThemeColors();
  const { config, products } = useCatalog();
  const { searchQuery, setSearchQuery } = useCatalogSearch();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const seenAt = useNotificationsSeenAt();
  const notifications = useMemo(
    () => buildNotifications(products, config),
    [products, config],
  );
  const unread = countUnread(notifications, seenAt);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6 }]}> 
      <View style={styles.topRow}>
        {canGoBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={8}
            onPress={onBack}
            style={styles.sideButton}
          >
            <AppIcon name="arrow-back" size={30} color="#fff" />
          </Pressable>
        ) : null}

        <View style={styles.logoCircle}>
          <Image source={require('../assets/brand-mark.png')} style={styles.logoMark} resizeMode="contain" />
          <LogoOrnament />
        </View>

        <View style={styles.brandText}>
          <Text style={styles.title} numberOfLines={1}>
            {config?.name ?? 'DISTRIBUIDORA LAURENCINI'}
          </Text>
          <Text style={styles.tagline} numberOfLines={1}>
            {config?.tagline ?? 'Seu mix completo de atacado e distribuição.'}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            unread > 0 ? `Notificações, ${unread} não lidas` : 'Notificações'
          }
          hitSlop={8}
          onPress={() => router.navigate('/notificacoes')}
          style={styles.notificationButton}
        >
          <AppIcon name="notifications" size={27} color="#fff" />
          {unread > 0 ? (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.searchBar}>
        <AppIcon name="search" size={23} color={colors.primaryDark} />
        <TextInput
          accessibilityLabel="Buscar produtos, marcas ou categorias"
          placeholder="Buscar produtos, marcas ou categorias..."
          placeholderTextColor="#60708d"
          value={searchQuery}
          onFocus={() => router.navigate('/(tabs)/catalogo')}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => router.navigate('/(tabs)/catalogo')}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={styles.searchInput}
        />
      </View>
      <ThemeGarland />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  container: {
    backgroundColor: colors.header,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 3,
    borderBottomColor: colors.accent,
  },
  topRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sideButton: { width: 36, height: 50, alignItems: 'center', justifyContent: 'center' },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: { width: 42, height: 42 },
  brandText: { flex: 1, minWidth: 0 },
  title: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  tagline: { color: 'rgba(255,255,255,0.88)', fontSize: 10, marginTop: 2 },
  notificationButton: { width: 38, height: 48, alignItems: 'center', justifyContent: 'center' },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  searchBar: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#dce5f2',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    color: colors.text,
    fontSize: 13,
  },
}));
