import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '@/lib/theme';
import { createThemedStyles } from '@/lib/app-theme';

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
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  eyebrow: {
    ...typography.small,
    color: colors.accent,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 2,
  },
  title: { ...typography.title, color: colors.text },
  action: { ...typography.body, color: colors.primary, fontWeight: '600' },
}));
