import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '@/lib/theme';
import { createThemedStyles, useAppTheme } from '@/lib/app-theme';
import { AppIcon } from '@/components/AppIcon';

// Tela de carregamento do app: logo pulsando + o que está sendo baixado no
// momento. Quando o progresso é conhecido (download das imagens), a barra
// mostra a porcentagem real; nas etapas sem medida ela pulsa sozinha.
export function LoadingScreen({
  label = 'Carregando catálogo…',
  progress = null,
}: {
  label?: string;
  progress?: number | null;
}) {
  const styles = useStyles();
  const theme = useAppTheme();
  const pulse = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.85,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const percent =
    typeof progress === 'number' && Number.isFinite(progress)
      ? Math.round(Math.min(1, Math.max(0, progress)) * 100)
      : null;

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {theme.badge ? (
        <View style={styles.themeBadge}>
          <AppIcon name={theme.badge.icon} size={14} color="#fff" />
          <Text style={styles.themeBadgeText}>{theme.badge.label}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>{label}</Text>

      <View style={styles.progressBar}>
        {percent !== null ? (
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        ) : (
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: '100%',
                transform: [
                  {
                    scaleX: pulse.interpolate({
                      inputRange: [0.85, 1.08],
                      outputRange: [0.35, 0.85],
                    }),
                  },
                ],
              },
            ]}
          />
        )}
      </View>

      {percent !== null ? <Text style={styles.percent}>{percent}%</Text> : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  themeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: spacing.md,
  },
  themeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    gap: spacing.md,
    padding: spacing.xl,
  },
  logo: { width: 140, height: 140, marginBottom: spacing.md },
  label: {
    ...typography.subtitle,
    color: colors.primaryDark,
    opacity: 0.85,
    textAlign: 'center',
  },
  progressBar: {
    width: 220,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e6f0',
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  percent: {
    ...typography.small,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
}));
