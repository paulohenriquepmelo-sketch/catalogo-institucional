import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import type { ParamListBase } from 'expo-router/react-navigation';
import type { NativeStackNavigationProp } from 'expo-router/native-stack';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { ProductRow } from '@/components/ProductRow';
import { ThemedBackground } from '@/components/ThemedBackground';
import { PanelHeading, ThemedPanel } from '@/components/ThemedPanel';
import { isDiscontinued, useCatalog } from '@/lib/catalog-store';
import { isOfferEligible, similarProducts } from '@/lib/api';
import { complementProducts } from '@/lib/complements';
import { useLocalImageUri } from '@/lib/image-cache';
import { useAppTheme } from '@/lib/theme-provider';
import { readableColor } from '@/lib/theme-contrast';
import { radius, spacing, typography } from '@/lib/theme';
import { detailFields } from '@/lib/product-fields';

const RELATED_LIMIT = 8;

export default function ProdutoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products, config } = useCatalog();
  const { tokens } = useAppTheme();
  const [broken, setBroken] = useState(false);
  const product = useMemo(
    () => products.find((item) => String(item.id) === id),
    [products, id],
  );
  const imageUri = useLocalImageUri(product?.image);
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const [transitionDone, setTransitionDone] = useState(false);

  useEffect(() => setBroken(false), [imageUri]);
  useEffect(() => {
    const finish = () => setTransitionDone(true);
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

  const complements = useMemo(() => {
    if (!product || !transitionDone || similar.length >= RELATED_LIMIT) return [];
    const skip = new Set(similar.map((item) => item.id));
    return complementProducts(products, product, RELATED_LIMIT - similar.length, skip);
  }, [products, product, transitionDone, similar]);

  const styles = useMemo(() => StyleSheet.create({
    scroll: { flex: 1 },
    content: { paddingBottom: spacing.xxl, gap: spacing.lg },
    body: { paddingHorizontal: spacing.lg, gap: spacing.lg },
    surface: {
      padding: spacing.lg,
      backgroundColor: tokens.soft,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: tokens.border,
      gap: spacing.sm,
    },
    photo: {
      width: '100%',
      aspectRatio: 1,
      backgroundColor: '#ffffff',
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: tokens.border,
      overflow: 'hidden',
    },
    image: { width: '100%', height: '100%' },
    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    placeholderText: { ...typography.body, color: '#526057', textAlign: 'center' },
    badge: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      backgroundColor: tokens.accent,
      alignSelf: 'flex-start',
    },
    badgeText: { ...typography.body, color: readableColor(tokens.onAccent, tokens.accent), fontWeight: '700' },
    brand: { ...typography.small, color: tokens.muted },
    name: { ...typography.title, color: tokens.ink },
    code: { ...typography.body, color: tokens.link, fontWeight: '700', fontVariant: ['tabular-nums'] },
    muted: { ...typography.body, color: tokens.muted },
    text: { ...typography.body, color: tokens.ink },
    discontinued: {
      backgroundColor: tokens.tint,
      padding: spacing.md,
      borderRadius: radius.sm,
    },
    discontinuedText: { ...typography.body, color: readableColor(tokens.ink, tokens.tint), fontWeight: '800' },
    blockTitle: { ...typography.subtitle, color: tokens.ink },
    detailRow: {
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: tokens.border,
      gap: spacing.xs,
    },
    detailLabel: { ...typography.small, color: tokens.muted },
    detailValue: { ...typography.body, color: tokens.ink },
    link: {
      minHeight: 44,
      minWidth: 44,
      justifyContent: 'center',
      paddingVertical: spacing.sm,
    },
    linkText: { ...typography.body, color: tokens.link, fontWeight: '700' },
    related: { paddingBottom: spacing.lg },
    empty: { padding: spacing.xl, backgroundColor: tokens.soft },
  }), [tokens]);

  if (!product) {
    return (
      <ThemedBackground>
        <ThemedPanel><PanelHeading title="Produto" /></ThemedPanel>
        <View style={styles.empty}>
          <Text style={styles.text}>Produto não encontrado.</Text>
        </View>
      </ThemedBackground>
    );
  }

  const offer = product.details?.offer;
  const email = config?.email;

  return (
    <ThemedBackground>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <ThemedPanel>
          <PanelHeading title="Informações do produto" />
        </ThemedPanel>
        <View style={styles.body}>
          <View style={styles.photo}>
            {imageUri && !broken ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.image}
                resizeMode="contain"
                resizeMethod="resize"
                fadeDuration={0}
                accessibilityLabel={`Foto de ${product.name}`}
                onError={() => setBroken(true)}
              />
            ) : (
              <View style={styles.placeholder}>
                <AppIcon name="image" size={40} color="#526057" />
                <Text style={styles.placeholderText}>
                  {product.image ? 'Foto indisponível no momento.' : 'Imagem não cadastrada.'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.surface}>
            <Text style={styles.brand}>{product.brand}</Text>
            <Text accessibilityRole="header" style={styles.name}>{product.name}</Text>
            {product.code ? (
              <Text selectable style={styles.code}>Código {product.code}</Text>
            ) : null}
            {isOfferEligible(product) && offer ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{offer.discount}% OFF</Text>
              </View>
            ) : null}
            {isDiscontinued(product) ? (
              <View style={styles.discontinued}>
                <Text style={styles.discontinuedText}>ITEM DESCONTINUADO</Text>
              </View>
            ) : null}
            <Text style={styles.muted}>
              {[product.department, product.section, product.category].filter(Boolean).join(' • ')}
            </Text>
            {product.segment ? (
              <Text style={styles.muted}>Segmento: {product.segment}</Text>
            ) : null}
            {product.description ? <Text style={styles.text}>{product.description}</Text> : null}
          </View>

          {product.specs?.length > 0 ? (
            <View style={styles.surface}>
              <Text accessibilityRole="header" style={styles.blockTitle}>Especificações</Text>
              {product.specs.map((spec, index) => (
                <Text key={`${product.id}-${index}-${spec}`} style={styles.text}>• {spec}</Text>
              ))}
            </View>
          ) : null}

          {product.details ? (
            <View style={styles.surface}>
              <Text accessibilityRole="header" style={styles.blockTitle}>Dados técnicos</Text>
              {detailFields.map(([key, label]) => {
                const value = product.details?.[key];
                if (!value) return null;
                return (
                  <View key={key} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{label}</Text>
                    <Text selectable style={styles.detailValue}>{value}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={styles.surface}>
            <Text accessibilityRole="header" style={styles.blockTitle}>Contato comercial</Text>
            {email ? (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Enviar e-mail para ${email}`}
                style={styles.link}
                onPress={() => { void Linking.openURL(`mailto:${email}`); }}
              >
                <Text style={styles.linkText}>{email}</Text>
              </Pressable>
            ) : (
              <Text style={styles.text}>Contato comercial ainda não cadastrado.</Text>
            )}
          </View>
        </View>

        {similar.length > 0 ? (
          <ThemedPanel style={styles.related}>
            <PanelHeading title="Produtos parecidos" />
            <ProductRow products={similar} />
          </ThemedPanel>
        ) : null}
        {complements.length > 0 ? (
          <ThemedPanel style={styles.related}>
            <PanelHeading title="Combina com este produto" />
            <ProductRow products={complements} />
          </ThemedPanel>
        ) : null}
      </ScrollView>
    </ThemedBackground>
  );
}
