import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/lib/theme-provider';
import { spacing, typography } from '@/lib/theme';

export function SectionHeader({
  eyebrow,
  title,
  actionLabel,
  onAction,
}: {
  eyebrow?: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { tokens } = useAppTheme();
  const styles = useMemo(() => StyleSheet.create({
    row: {
      padding: spacing.lg,
      gap: spacing.sm,
      backgroundColor: tokens.soft,
    },
    eyebrow: {
      ...typography.small,
      color: tokens.link,
      textTransform: 'uppercase',
      fontWeight: '700',
    },
    title: { ...typography.title, color: tokens.ink },
    action: {
      minHeight: 44,
      minWidth: 44,
      justifyContent: 'center',
      alignSelf: 'flex-start',
    },
    actionText: { ...typography.body, color: tokens.link, fontWeight: '700' },
  }), [tokens]);

  return (
    <View style={styles.row}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.action}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
