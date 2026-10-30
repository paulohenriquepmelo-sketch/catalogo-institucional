import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CatalogProvider, useCatalog } from '@/lib/catalog-store';
import { ThemeProvider, useAppTheme } from '@/lib/theme-provider';
import { LoadingScreen } from '@/components/LoadingScreen';
import { AppHeader } from '@/components/AppHeader';
import { AppIcon } from '@/components/AppIcon';
import { radius, spacing, typography, type ThemeTokens } from '@/lib/theme';

function RootNavigator() {
  const {
    configResolved,
    loadingLabel,
    loadingProgress,
    error,
    config,
    refreshing,
    refresh,
  } = useCatalog();
  const { tokens, ready } = useAppTheme();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  if (!configResolved) {
    return (
      <>
        <StatusBar style="dark" />
        <LoadingScreen label={loadingLabel} progress={loadingProgress} />
      </>
    );
  }

  // Produtos sem configuração não autorizam abrir com um tema presumido.
  if (!config) {
    return (
      <>
        <StatusBar style="dark" />
        <ErrorScreen
          message={error ?? 'Não foi possível obter a configuração do catálogo.'}
          busy={refreshing}
          onRetry={() => void refresh()}
        />
      </>
    );
  }

  if (!ready) {
    return (
      <>
        <StatusBar style="dark" />
        <LoadingScreen label="Preparando o tema…" />
      </>
    );
  }

  return (
    <>
      {/* O status bar fica sobre tokens.dark, escuro em todos os oito temas. */}
      <StatusBar style={statusBarStyle(tokens.dark)} />
      <Stack
        screenOptions={({ navigation }) => ({
          header: () => (
            <AppHeader
              canGoBack={navigation.canGoBack()}
              onBack={() => navigation.goBack()}
            />
          ),
          contentStyle: styles.content,
        })}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="produto/[id]" />
        <Stack.Screen name="segmento/[id]" />
        <Stack.Screen name="notificacoes" />
      </Stack>
    </>
  );
}

/** Escolhe o contraste pela superfície efetivamente atrás do status bar. */
function statusBarStyle(background: string): 'light' | 'dark' {
  const hex = background.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return 'light';

  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? 'dark' : 'light';
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
  const { tokens } = useAppTheme();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  return (
    <View style={styles.errorScreen}>
      <AppIcon name="cloud-offline" size={52} color={tokens.muted} />
      <Text style={styles.errorTitle}>Não foi possível carregar o catálogo</Text>
      <Text style={styles.errorText}>
        Verifique sua conexão com a internet. Assim que o catálogo for baixado uma vez,
        o app passa a funcionar offline.
      </Text>
      <Text style={styles.errorDetail} numberOfLines={2}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        disabled={busy}
        style={[styles.retryButton, busy && styles.retryBusy]}
      >
        <Text style={styles.retryText}>
          {busy ? 'Tentando…' : 'Tentar novamente'}
        </Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  return (
    <CatalogProvider>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </CatalogProvider>
  );
}

function createStyles(tokens: Readonly<ThemeTokens>) {
  return StyleSheet.create({
    content: { backgroundColor: tokens.paper },
    errorScreen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tokens.paper,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    errorTitle: {
      ...typography.title,
      color: tokens.ink,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    errorText: {
      ...typography.body,
      color: tokens.muted,
      textAlign: 'center',
    },
    errorDetail: {
      ...typography.small,
      color: tokens.muted,
      textAlign: 'center',
      opacity: 0.7,
    },
    retryButton: {
      marginTop: spacing.lg,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: tokens.accent,
    },
    retryBusy: { opacity: 0.6 },
    retryText: {
      color: tokens.onAccent,
      fontWeight: '700',
      fontSize: 14,
    },
  });
}
