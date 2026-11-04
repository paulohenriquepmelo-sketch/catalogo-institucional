import { useMemo, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { ThemeBackdrop } from '@/components/ThemeBackdrop';
import { useAppTheme } from '@/lib/theme-provider';
import { market } from '@/lib/theme';

export function ThemedBackground({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { id, tokens } = useAppTheme();
  const page = id === 'padrao' ? market.page : tokens.paper;

  const styles = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: page },
  }), [page]);

  return (
    <View style={[styles.root, style]}>
      {/* O fundo do tema pertence à tela, nunca aos cards. O Padrão fica liso. */}
      {id !== 'padrao' ? <ThemeBackdrop id={id} page={page} /> : null}
      {children}
    </View>
  );
}
