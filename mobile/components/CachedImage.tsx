import { Image, type ImageResizeMode, type ImageStyle, type StyleProp } from 'react-native';
import { useLocalImageUri } from '@/lib/image-cache';

/**
 * Imagem que prefere o arquivo já salvo no aparelho e cai na URL remota
 * enquanto o download não terminou. Usar isto (em vez de <Image> direto)
 * é o que garante que a imagem apareça sem internet.
 */
export function CachedImage({
  uri,
  style,
  resizeMode = 'contain',
}: {
  uri?: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
}) {
  const localUri = useLocalImageUri(uri);
  if (!localUri) return null;
  return (
    <Image
      source={{ uri: localUri }}
      style={style}
      resizeMode={resizeMode}
      resizeMethod="resize"
      fadeDuration={0}
    />
  );
}
