import { memo, useEffect, useState } from 'react';
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
import { colors, radius, spacing, typography } from '@/lib/theme';
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
  const [broken, setBroken] = useState(false);
  const imageUri = useLocalImageUri(product.image);
  const offer = product.details?.offer;
  const discontinued = isDiscontinued(product);
  const showOffer = isOfferEligible(product);

  useEffect(() => {
    setBroken(false);
  }, [imageUri]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver informações de ${product.name}`}
      onPress={() => router.push(`/produto/${product.id}`)}
      style={({ pressed }) => [
        styles.card,
        width === undefined ? null : { width },
        style,
        pressed && styles.cardPressed,
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
            <AppIcon name={product.image ? 'cloud-offline' : 'cube'} size={32} color="#8b9ab3" />
            <Text style={styles.placeholderText}>
              {product.image && (!broken || !isOnline())
                ? 'Foto disponível com internet'
                : 'Imagem não cadastrada'}
            </Text>
          </View>
        )}

        {showOffer && offer ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{offer.discount}% OFF</Text>
          </View>
        ) : null}

        {discontinued ? (
          <View style={styles.discontinuedBadge}>
            <Text style={styles.discontinuedText}>ITEM DESCONTINUADO</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.details}>
        <Text style={styles.brand} numberOfLines={1}>{product.brand}</Text>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        {product.code ? (
          <Text style={styles.code} numberOfLines={1}>Código {product.code}</Text>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#dce5f0',
    padding: spacing.sm,
    shadowColor: '#173866',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  imageWrap: {
    width: '100%',
    aspectRatio: 1.08,
    overflow: 'hidden',
    borderRadius: radius.sm,
    backgroundColor: '#fff',
  },
  image: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#f7f9fc',
  },
  placeholderText: { ...typography.small, color: colors.textMuted, fontSize: 9 },
  badge: {
    position: 'absolute',
    top: 4,
    left: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  discontinuedBadge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(55, 65, 81, 0.92)',
    paddingVertical: 7,
    alignItems: 'center',
  },
  discontinuedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  details: { minHeight: 72, paddingHorizontal: 2, paddingTop: spacing.sm },
  brand: {
    ...typography.small,
    color: '#56709a',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  name: {
    ...typography.body,
    color: colors.primaryDark,
    fontWeight: '800',
    marginTop: 2,
  },
  code: {
    ...typography.small,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
});
