import { memo, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { router } from 'expo-router';
import { AppIcon } from '@/components/AppIcon';
import { useLocalImageUri } from '@/lib/image-cache';
import { isOnline } from '@/lib/network';
import { radius, spacing, typography } from '@/lib/theme';
import { useAppTheme } from '@/lib/theme-provider';
import { readableColor } from '@/lib/theme-contrast';
import { isOfferEligible, type Product } from '@/lib/api';
import { isDiscontinued } from '@/lib/catalog-store';

export const ProductCard = memo(function ProductCard({
  product,
  style,
  width,
}: {
  product: Product;
  style?: StyleProp<ViewStyle>;
  width?: number;
}) {
  const { tokens, dark } = useAppTheme();
  const [broken, setBroken] = useState(false);
  const imageUri = useLocalImageUri(product.image);
  const offer = product.details?.offer;
  const discontinued = isDiscontinued(product);
  const showOffer = isOfferEligible(product);
  const surface = dark ? tokens.soft : '#ffffff';

  const styles = useMemo(() => StyleSheet.create({
    card: {
      minHeight: 44,
      overflow: 'hidden',
      backgroundColor: surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: tokens.border,
      padding: spacing.sm,
    },
    pressed: { opacity: 0.85 },
    imageWrap: {
      width: '100%',
      aspectRatio: 1.08,
      borderRadius: radius.sm,
      overflow: 'hidden',
      backgroundColor: '#ffffff',
    },
    image: { width: '100%', height: '100%' },
    placeholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.sm,
    },
    placeholderText: {
      ...typography.small,
      color: '#526057',
      textAlign: 'center',
    },
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: tokens.accent,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    badgeText: {
      ...typography.small,
      fontWeight: '800',
      color: readableColor(tokens.onAccent, tokens.accent),
    },
    discontinued: {
      padding: spacing.sm,
      backgroundColor: tokens.tint,
      borderRadius: radius.sm,
    },
    discontinuedText: {
      ...typography.small,
      color: readableColor(tokens.ink, tokens.tint),
      fontWeight: '800',
    },
    details: { paddingTop: spacing.sm, gap: spacing.xs },
    brand: {
      ...typography.small,
      color: readableColor(tokens.muted, surface),
      textTransform: 'uppercase',
    },
    name: {
      ...typography.body,
      color: readableColor(tokens.ink, surface),
      fontWeight: '800',
    },
    code: {
      ...typography.small,
      color: readableColor(tokens.muted, surface),
      fontVariant: ['tabular-nums'],
    },
  }), [tokens, surface]);

  useEffect(() => setBroken(false), [imageUri]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver informações de ${product.name}`}
      onPress={() => router.push(`/produto/${product.id}`)}
      style={({ pressed }) => [
        styles.card,
        width === undefined ? undefined : { width },
        style,
        pressed && styles.pressed,
      ]}
    >
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
            <AppIcon
              name={product.image ? 'cloud-offline' : 'cube'}
              size={28}
              color="#526057"
            />
            <Text style={styles.placeholderText}>
              {product.image && (!broken || !isOnline())
                ? 'Foto disponível com internet'
                : 'Imagem não cadastrada'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.details}>
        {showOffer && offer ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{offer.discount}% OFF</Text>
          </View>
        ) : null}
        {discontinued ? (
          <View style={styles.discontinued}>
            <Text style={styles.discontinuedText}>ITEM DESCONTINUADO</Text>
          </View>
        ) : null}
        <Text style={styles.brand}>{product.brand}</Text>
        <Text style={styles.name}>{product.name}</Text>
        {product.code ? <Text style={styles.code}>Código {product.code}</Text> : null}
      </View>
    </Pressable>
  );
});
