import { useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { defaultTokens, spacing, typography } from '@/lib/theme';

export function LoadingScreen({
  label = 'Carregando catálogo…',
  progress = null,
}: {
  label?: string;
  progress?: number | null;
}) {
  // Começa estático até conhecer a preferência de acessibilidade.
  const pulse = useRef(new Animated.Value(1)).current;
  const styles = useMemo(() => StyleSheet.create({
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
      color: defaultTokens.dark,
      opacity: 0.85,
      textAlign: 'center',
    },
    progressBar: {
      width: 220,
      height: 4,
      borderRadius: 2,
      backgroundColor: defaultTokens.border,
      overflow: 'hidden',
      marginTop: spacing.xs,
    },
    progressFill: {
      height: '100%',
      backgroundColor: defaultTokens.link,
      borderRadius: 2,
    },
    percent: {
      ...typography.small,
      color: defaultTokens.muted,
      fontVariant: ['tabular-nums'],
    },
  }), []);

  useEffect(() => {
    let cancelled = false;
    let changedByEvent = false;
    let animation: Animated.CompositeAnimation | null = null;

    const applyPreference = (reduceMotion: boolean) => {
      if (cancelled) return;
      animation?.stop();
      pulse.stopAnimation();
      pulse.setValue(1);

      if (reduceMotion) return;

      pulse.setValue(0.85);
      animation = Animated.loop(
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
      animation.start();
    };

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => {
        changedByEvent = true;
        applyPreference(enabled);
      },
    );

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (!changedByEvent) applyPreference(enabled);
      })
      .catch(() => {
        // Se a preferência não puder ser lida, mantém a apresentação estática.
      });

    return () => {
      cancelled = true;
      subscription.remove();
      animation?.stop();
      pulse.stopAnimation();
    };
  }, [pulse]);

  const percent =
    typeof progress === 'number' && Number.isFinite(progress)
      ? Math.round(Math.min(1, Math.max(0, progress)) * 100)
      : null;

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Image
          source={require('@/assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="Distribuidora Laurencini"
        />
      </Animated.View>

      <Text style={styles.label}>{label}</Text>

      <View
        style={styles.progressBar}
        accessibilityRole="progressbar"
        accessibilityValue={
          percent === null ? { text: label } : { min: 0, max: 100, now: percent }
        }
      >
        {percent !== null ? (
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        ) : (
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: '100%',
                transform: [{
                  scaleX: pulse.interpolate({
                    inputRange: [0.85, 1.08],
                    outputRange: [0.35, 0.85],
                  }),
                }],
              },
            ]}
          />
        )}
      </View>

      {percent !== null ? <Text style={styles.percent}>{percent}%</Text> : null}
    </View>
  );
}
