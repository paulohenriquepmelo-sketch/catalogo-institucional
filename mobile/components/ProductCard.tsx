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
import { market } from '@/lib/theme';
import { useAppTheme } from '@/lib/theme-provider';
import { readableColor } from '@/lib/theme-contrast';
import { isOfferEligible, type Product } from '@/lib/api';
import { isDiscontinued } from '@/lib/catalog-store';

/** Card de produto da vitrine: foto, etiqueta, marca, nome e "Saiba mais". */
export const ProductCard = memo(function ProductCard({
  product,
  style,
  width,
  tag,
}: {
  product: Product;
  style?: StyleProp<ViewStyle>;
  width?: number;
  tag?: string;
}) {
  const { tokens, dark } = useAppTheme();
  const [broken, setBroken] = useState(false);
  const imageUri = useLocalImageUri(product.image);
  const offer = product.details?.offer;
  const discontinued = isDiscontinued(product);
  const showOffer = isOfferEligible(product) && Boolean(offer);
  const surface = dark ? tokens.soft : '#ffffff';
  const label = discontinued
    ? 'Descontinuado'
    : showOffer && offer ? `${offer.discount}% OFF` : tag;

  const styles = useMemo(() => {
    const muted = readableColor('#86918a', surface);
    return StyleSheet.create({
      card: {
        overflow: 'hidden',
        backgroundColor: surface,
        borderRadius: market.radius,
        borderWidth: 1,
        borderColor: dark ? tokens.border : market.line,
        shadowColor: '#000000',
        shadowOpacity: 0.07,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      },
      pressed: { opacity: 0.85 },
      imageWrap: {
        height: 140,
        backgroundColor: market.imageBg,
        alignItems: 'center',
        justifyContent: 'center',
      },
      image: { width: '100%', height: '100%' },
      placeholder: { alignItems: 'center', justifyContent: 'center', padding: 8, gap: 4 },
      placeholderText: { fontSize: 11, color: '#526057', textAlign: 'center' },
      tag: {
        position: 'absolute',
        left: 9,
        top: 9,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 2,
        backgroundColor: discontinued ? tokens.tint : showOffer ? tokens.accent : '#ffffff',
        shadowColor: '#000000',
        shadowOpacity: 0.08,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      },
      tagText: {
        fontSize: 10,
        fontWeight: '700',
        color: discontinued
          ? readableColor(tokens.ink, tokens.tint)
          : showOffer
            ? readableColor(tokens.onAccent, tokens.accent)
            : readableColor(tokens.link, '#ffffff'),
      },
      info: { padding: 10 },
      brand: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: muted,
      },
      name: {
        fontSize: 13,
        fontWeight: '700',
        marginTop: 4,
        marginBottom: 4,
        color: readableColor('#25332c', surface),
      },
      code: { fontSize: 11, color: muted, marginBottom: 10, fontVariant: ['tabular-nums'] },
      foot: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        borderTopWidth: 1,
        borderTopColor: dark ? tokens.border : '#f0f2f0',
        paddingTop: 8,
        marginTop: 'auto',
      },
      unit: { flex: 1, fontSize: 10, color: readableColor('#7f8a83', surface) },
      more: { flexShrink: 0, fontSize: 11, fontWeight: '700', color: readableColor(tokens.link, surface) },
    });
  }, [tokens, dark, surface, discontinued, showOffer]);

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
        {label ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{label}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text style={styles.brand} numberOfLines={1}>{product.brand}</Text>
        <Text style={styles.name} numberOfLines={3}>{product.name}</Text>
        {product.code ? <Text style={styles.code}>Código {product.code}</Text> : null}
        <View style={styles.foot}>
          <Text style={styles.unit}>Consulte disponibilidade</Text>
          <Text style={styles.more}>Saiba mais →</Text>
        </View>
      </View>
    </Pressable>
  );
});
