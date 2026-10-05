import React, { useRef } from 'react';
import { Animated, Image, type ImageProps, type StyleProp, type ImageStyle } from 'react-native';

/**
 * Une image qui apparait en fondu une fois chargee, sur le fond de la case.
 *
 * Le chargement lui-meme ne va pas plus vite, mais l'oeil ne voit plus une
 * case vide puis une image qui claque : il voit une case qui se remplit.
 * C'est ce qui fait la difference entre « ca charge » et « c'est fluide ».
 */
export default function FadeImage({ style, onLoad, ...props }: ImageProps & { style?: StyleProp<ImageStyle> }) {
  const opacity = useRef(new Animated.Value(0)).current;
  return (
    <Animated.Image
      {...props}
      style={[style, { opacity }]}
      onLoad={(e) => {
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
        onLoad?.(e);
      }}
    />
  );
}

/** Precharge des images dans le cache natif, sans bloquer. */
export function prefetchImages(uris: (string | undefined | null)[]): void {
  for (const uri of uris) if (uri) Image.prefetch(uri).catch(() => undefined);
}
