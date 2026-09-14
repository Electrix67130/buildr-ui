import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, interpolate } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloudOff, UploadCloud } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { FontSize, FontWeight, Spacing } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useOnlineStatus } from '@/utils/network';
import { usePendingCount } from '@/utils/photoQueue';
import { useTranslation } from '@/contexts/I18nContext';

/** Hauteur visible du bandeau : le contenu descend d'autant. */
const STRIP = 30;

/**
 * Bandeau d'etat du reseau, enveloppant tout le contenu de l'app.
 *
 * Il POUSSE le contenu vers le bas au lieu de le recouvrir : superpose, il
 * masquait le logo et les en-tetes d'ecran.
 *
 * Dire qu'on est hors ligne importe autant que de fonctionner hors ligne. Sans
 * ce bandeau, un ouvrier lit des donnees vieilles de deux heures en croyant
 * qu'elles sont a jour — ce qui est pire que de savoir qu'on est coupe.
 */
export default function OfflineBanner({ children }: { children: React.ReactNode }) {
  const online = useOnlineStatus();
  const enAttente = usePendingCount();
  const insets = useSafeAreaInsets();
  const colors = Colors[useColorScheme()];
  const { t } = useTranslation();

  // Deux raisons d'afficher le bandeau : etre coupe, ou avoir des photos qui
  // n'ont pas encore pu partir.
  const visible = !online || enAttente > 0;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: 250 });
  }, [visible, progress]);

  const contentStyle = useAnimatedStyle(() => ({
    paddingTop: interpolate(progress.value, [0, 1], [0, STRIP]),
  }));

  const bannerStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    height: interpolate(progress.value, [0, 1], [0, STRIP + insets.top]),
  }));

  const message = !online
    ? enAttente > 0
      ? t('offline.bannerWithPending', { count: enAttente })
      : t('offline.banner')
    : t('offline.sending', { count: enAttente });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.banner, bannerStyle, { backgroundColor: online ? colors.primary : colors.mutedText, paddingTop: insets.top }]}
        accessibilityLiveRegion="polite"
      >
        {online ? <UploadCloud size={14} color="#FFFFFF" /> : <CloudOff size={14} color="#FFFFFF" />}
        <Text style={styles.text} numberOfLines={1}>
          {message}
        </Text>
      </Animated.View>
      <Animated.View style={[styles.content, contentStyle]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    overflow: 'hidden',
  },
  text: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  content: { flex: 1 },
});
