import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CatalogProvider, useCatalog } from '@/lib/catalog-store';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AppHeader } from '@/components/AppHeader';
import { AppIcon } from '@/components/AppIcon';
import { radius, spacing, typography } from '@/lib/theme';
import { AppThemeProvider, createThemedStyles, useThemeColors } from '@/lib/app-theme';

function RootNavigator() {
  const colors = useThemeColors();
  const {
    loading,
    loadingLabel,
    loadingProgress,
    error,
    config,
    products,
    refreshing,
    refresh,
  } = useCatalog();

  if (loading) return <LoadingScreen label={loadingLabel} progress={loadingProgress} />;

  // Só mostra a tela de erro quando NÃO há absolutamente nada para exibir
  // (primeira abertura, sem internet e sem cache salvo). Se houver qualquer
  // dado — da rede ou do cache — o app abre normalmente.
  if (error && !config && products.length === 0) {
    return (
      <ErrorScreen message={error} busy={refreshing} onRetry={() => void refresh()} />
    );
  }

  return (
    <Stack
      screenOptions={({ navigation }) => ({
        header: () => (
          <AppHeader canGoBack={navigation.canGoBack()} onBack={() => navigation.goBack()} />
        ),
        contentStyle: { backgroundColor: colors.background },
      })}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="produto/[id]" />
      <Stack.Screen name="segmento/[id]" />
      <Stack.Screen name="notificacoes" />
    </Stack>
  );
}

function ErrorScreen({
  message,
  busy,
  onRetry,
}: {
  message: string;
  busy: boolean;
  onRetry: () => void;
}) {
  const styles = useStyles();
  const colors = useThemeColors();
  return (
    <View style={styles.errorScreen}>
      <AppIcon name="cloud-offline" size={52} color={colors.textMuted} />
      <Text style={styles.errorTitle}>Não foi possível carregar o catálogo</Text>
      <Text style={styles.errorText}>
        Verifique sua conexão com a internet. Assim que o catálogo for baixado uma vez,
        o app passa a funcionar offline.
      </Text>
      <Text style={styles.errorDetail} numberOfLines={2}>{message}</Text>
      <Pressable onPress={onRetry} disabled={busy} style={[styles.retryButton, busy && styles.retryBusy]}>
        <Text style={styles.retryText}>{busy ? 'Tentando…' : 'Tentar novamente'}</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  return (
    <CatalogProvider>
      {/* O tema segue a campanha publicada no site (lida pelo catálogo). */}
      <AppThemeProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AppThemeProvider>
    </CatalogProvider>
  );
}

const useStyles = createThemedStyles((colors) => ({
  errorScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  errorTitle: {
    ...typography.title,
    color: colors.primaryDark,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  errorDetail: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    opacity: 0.7,
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  retryBusy: { opacity: 0.6 },
  retryText: { color: colors.textOnPrimary, fontWeight: '700', fontSize: 14 },
}));
