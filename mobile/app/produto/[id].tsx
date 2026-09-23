import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import type { ParamListBase } from 'expo-router/react-navigation';
import type { NativeStackNavigationProp } from 'expo-router/native-stack';
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { isDiscontinued, useCatalog } from '@/lib/catalog-store';
import { similarProducts } from '@/lib/api';
import { complementProducts } from '@/lib/complements';
import { useLocalImageUri } from '@/lib/image-cache';
import { colors, radius, spacing, typography } from '@/lib/theme';
import { ProductRow } from '@/components/ProductRow';
import { detailFields } from '@/lib/product-fields';

const RELATED_LIMIT = 8;

export default function ProdutoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products, config } = useCatalog();
  const [broken, setBroken] = useState(false);

  const product = useMemo(
    () => products.find((p) => String(p.id) === id),
    [products, id],
  );

  const imageUri = useLocalImageUri(product?.image);

  // Os "produtos parecidos" só entram depois da animação de abertura: assim a
  // tela aparece na hora e a transição não engasga montando outra lista.
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const [transitionDone, setTransitionDone] = useState(false);
  useEffect(() => {
    const finish = () => setTransitionDone(true);
    // Rede de segurança caso o evento de fim de transição não chegue.
    const fallback = setTimeout(finish, 450);
    const unsubscribe = navigation.addListener('transitionEnd', finish);
    return () => {
      clearTimeout(fallback);
      unsubscribe();
    };
  }, [navigation]);

  const similar = useMemo(() => {
    if (!product || !transitionDone) return [];
    return similarProducts(products, product, RELATED_LIMIT);
  }, [products, product, transitionDone]);

  // Só quando faltam parecidos: completa com o que acompanha o produto
  // (macarrão → molho de tomate), numa faixa separada.
  const complements = useMemo(() => {
    if (!product || !transitionDone || similar.length >= RELATED_LIMIT) return [];
    const skip = new Set(similar.map((p) => p.id));
    return complementProducts(products, product, RELATED_LIMIT - similar.length, skip);
  }, [products, product, transitionDone, similar]);

  if (!product) {
    return (
      <View style={styles.notFound}>
        <AppIcon name="circle-alert" size={32} color={colors.textMuted} />
        <Text style={styles.notFoundText}>Produto não encontrado.</Text>
      </View>
    );
  }

  const offer = product.details?.offer;
  const discontinued = isDiscontinued(product);
  const hasOffer = !discontinued && offer?.enabled === true;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.imageWrap}>
        {imageUri && !broken ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="contain"
            resizeMethod="resize"
            fadeDuration={0}
            onError={() => setBroken(true)}
          />
        ) : (
          <View style={styles.placeholder}>
            <AppIcon name="image" size={40} color={colors.textMuted} />
          </View>
        )}
        {hasOffer && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{offer!.discount}% OFF</Text>
          </View>
        )}
      </View>

      <Text style={styles.brand}>{product.brand}</Text>
      <Text style={styles.name}>{product.name}</Text>
      {product.code ? (
        // Selecionável: o vendedor pode copiar o código para o pedido.
        <Text style={styles.code} selectable>
          Código {product.code}
        </Text>
      ) : null}
      {discontinued ? (
        <View style={styles.discontinuedBanner}>
          <AppIcon name="circle-alert" size={18} color="#fff" />
          <Text style={styles.discontinuedText}>ITEM DESCONTINUADO</Text>
        </View>
      ) : null}
      <Text style={styles.path}>
        {[product.department, product.section, product.category].filter(Boolean).join(' • ')}
      </Text>
      {product.segment ? (
        <Text style={styles.segment}>Segmento: {product.segment}</Text>
      ) : null}

      {product.description ? (
        <Text style={styles.description}>{product.description}</Text>
      ) : null}

      {product.specs?.length > 0 && (
        <View style={styles.specsBlock}>
          <Text style={styles.blockTitle}>Especificações</Text>
          {product.specs.map((spec, i) => (
            <Text key={`${product.id}-${i}-${spec}`} style={styles.specLine}>
              • {spec}
            </Text>
          ))}
        </View>
      )}

      {product.details && (
        <View style={styles.specsBlock}>
          <Text style={styles.blockTitle}>Dados técnicos</Text>
          {detailFields.map(([key, label]) => {
            const value = product.details?.[key];
            if (!value) return null;
            return (
              <View key={key} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={styles.detailValue}>{value}</Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.contactBlock}>
        <Text style={styles.blockTitle}>Contato comercial</Text>
        {config?.email ? (
          <Text style={styles.contactLink} onPress={() => Linking.openURL(`mailto:${config.email}`)}>
            <AppIcon name="mail" size={14} color={colors.primary} /> {config.email}
          </Text>
        ) : (
          <Text style={styles.detailValue}>Contato comercial ainda não cadastrado.</Text>
        )}
      </View>

      {similar.length > 0 && (
        <View style={styles.similarBlock}>
          <Text style={styles.blockTitle}>Produtos parecidos</Text>
          <ProductRow products={similar} />
        </View>
      )}

      {complements.length > 0 && (
        <View style={styles.similarBlock}>
          <Text style={styles.blockTitle}>Combina com este produto</Text>
          <ProductRow products={complements} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeText: { color: '#fff', fontWeight: '700' },
  brand: { ...typography.small, color: colors.textMuted, fontWeight: '600' },
  name: { ...typography.title, color: colors.text, marginTop: 2 },
  code: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  discontinuedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    backgroundColor: '#374151',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginTop: spacing.sm,
  },
  discontinuedText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  path: { ...typography.small, color: colors.textMuted, marginTop: 4 },
  segment: { ...typography.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  description: { ...typography.body, color: colors.text, marginBottom: spacing.lg },
  specsBlock: { marginBottom: spacing.lg },
  blockTitle: { ...typography.subtitle, color: colors.text, marginBottom: spacing.sm },
  specLine: { ...typography.body, color: colors.text, marginBottom: 4 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLabel: { ...typography.small, color: colors.textMuted, flex: 1 },
  detailValue: { ...typography.body, color: colors.text, flex: 1, textAlign: 'right' },
  contactBlock: { marginBottom: spacing.lg },
  contactLink: { ...typography.body, color: colors.primary, fontWeight: '600' },
  similarBlock: { marginHorizontal: -spacing.lg, marginBottom: spacing.lg },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  notFoundText: { ...typography.body, color: colors.textMuted },
});
