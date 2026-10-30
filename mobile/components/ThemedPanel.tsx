import { useMemo, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { CachedImage } from '@/components/CachedImage';
import { useAppTheme } from '@/lib/theme-provider';
import { spacing, typography } from '@/lib/theme';

export type PanelVariant = 'default' | 'marcas' | 'ofertas' | 'segmentos';

export function ThemedPanel({
  children,
  variant = 'default',
  art,
  style,
}: {
  children: ReactNode;
  variant?: PanelVariant;
  art?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { id, tokens, arts } = useAppTheme();
  const uri = art ?? (
    id === 'padrao'
      ? undefined
      : arts.extras[variant] || arts.panel
  );
  const styles = useMemo(() => StyleSheet.create({
    panel: { position: 'relative', backgroundColor: tokens.dark },
    decoration: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
    image: { width: '100%', height: '100%' },
    veil: {
      ...StyleSheet.absoluteFill,
      backgroundColor: tokens.dark,
      opacity: 0.94,
    },
  }), [tokens]);

  return (
    <View style={[styles.panel, style]}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.decoration}
      >
        <CachedImage uri={uri} style={styles.image} resizeMode="cover" />
        <View style={styles.veil} />
      </View>
      {children}
    </View>
  );
}

export function PanelHeading({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { tokens } = useAppTheme();
  const styles = useMemo(() => StyleSheet.create({
    root: { padding: spacing.lg, gap: spacing.sm },
    title: {
      ...typography.title,
      color: '#ffffff',
      textShadowColor: '#000000',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    subtitle: { ...typography.body, color: '#ffffff' },
    action: {
      minHeight: 44,
      minWidth: 44,
      alignSelf: 'flex-start',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      borderWidth: 1,
      borderColor: '#ffffff',
      borderRadius: 8,
      backgroundColor: tokens.dark,
    },
    actionText: { ...typography.body, fontWeight: '700', color: '#ffffff' },
  }), [tokens]);

  return (
    <View style={styles.root}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.action}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
