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
import { market, spacing } from '@/lib/theme';

const LOGO = require('@/assets/logo.png');

export function AppHeader({
  canGoBack = false,
  onBack,
}: {
  canGoBack?: boolean;
  onBack?: () => void;
}) {
  const { config, products } = useCatalog();
  const { searchQuery, setSearchQuery } = useCatalogSearch();
  const { tokens } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const seenAt = useNotificationsSeenAt();
  const notifications = useMemo(
    () => buildNotifications(products, config),
    [products, config],
  );
  const unread = countUnread(notifications, seenAt);

  const styles = useMemo(() => StyleSheet.create({
    root: { backgroundColor: '#ffffff' },
    top: {
      paddingHorizontal: 15,
      paddingTop: 12,
      paddingBottom: 12,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: market.line,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    back: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
    logo: { width: 174, height: 35 },
    spacer: { flex: 1 },
    bell: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    badge: {
      position: 'absolute',
      top: 2,
      right: 0,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: tokens.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: {
      color: readableColor(tokens.onAccent, tokens.accent),
      fontSize: 10,
      fontWeight: '800',
    },
    search: {
      height: 44,
      flexDirection: 'row',
      backgroundColor: '#ffffff',
      borderRadius: market.radius,
      borderWidth: 1,
      borderColor: '#dddddd',
      overflow: 'hidden',
    },
    input: { flex: 1, minWidth: 0, paddingHorizontal: 14, fontSize: 14, color: '#333333' },
    searchButton: {
      width: 46,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: market.imageBg,
      borderLeftWidth: 1,
      borderLeftColor: '#eeeeee',
    },
  }), [tokens]);

  const goSearch = () => router.navigate('/(tabs)/catalogo');

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <View style={styles.row}>
          {canGoBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={onBack ?? (() => router.back())}
              style={styles.back}
            >
              <AppIcon name="arrow-back" size={24} color="#333333" />
            </Pressable>
          ) : null}
          <Image
            source={LOGO}
            style={styles.logo}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel={config?.name || 'Distribuidora Laurencini'}
          />
          <View style={styles.spacer} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Notificações, ${unread} não lidas` : 'Notificações'}
            onPress={() => router.navigate('/notificacoes')}
            style={styles.bell}
          >
            <AppIcon name="notifications" size={24} color="#333333" />
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        <View style={styles.search}>
          <TextInput
            accessibilityLabel="Buscar produtos, marcas e categorias"
            placeholder="Buscar produtos, marcas e categorias"
            placeholderTextColor="#888888"
            value={searchQuery}
            onFocus={goSearch}
            onChangeText={setSearchQuery}
            onSubmitEditing={goSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buscar"
            onPress={goSearch}
            style={styles.searchButton}
          >
            <AppIcon name="search" size={20} color="#444444" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
