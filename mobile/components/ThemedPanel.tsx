import { useMemo, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAppTheme } from '@/lib/theme-provider';
import { readableColor } from '@/lib/theme-contrast';
import { market } from '@/lib/theme';

export type PanelVariant = 'default' | 'marcas' | 'ofertas' | 'segmentos';

/** Painel branco da vitrine. O tema aparece no fundo da página e no card principal. */
export function usePanelSurface() {
  const { tokens, dark } = useAppTheme();
  return dark ? tokens.soft : '#ffffff';
}

export function ThemedPanel({
  children,
  style,
}: {
  children: ReactNode;
  variant?: PanelVariant;
  style?: StyleProp<ViewStyle>;
}) {
  const surface = usePanelSurface();
  return (
    <View style={[styles.panel, { backgroundColor: surface }, style]}>
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
  const surface = usePanelSurface();
  const colors = useMemo(() => ({
    title: { color: readableColor(tokens.ink, surface) },
    subtitle: { color: readableColor('#777777', surface) },
    action: { color: readableColor(tokens.link, surface) },
  }), [tokens, surface]);

  return (
    <View style={styles.heading}>
      <View style={styles.headingText}>
        <Text accessibilityRole="header" style={[styles.title, colors.title]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, colors.subtitle]}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.action}>
          <Text style={[styles.actionText, colors.action]}>{actionLabel} →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: market.radius,
    paddingHorizontal: 12,
    paddingVertical: 13,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headingText: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  subtitle: { fontSize: 12 },
  action: { minHeight: 44, justifyContent: 'center' },
  actionText: { fontSize: 12, fontWeight: '700' },
});
