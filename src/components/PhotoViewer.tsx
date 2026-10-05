import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions, StatusBar } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { X } from 'lucide-react-native';
import { prefetchImages } from '@/components/FadeImage';
import { IconSize, Spacing, FontSize, FontWeight } from '@/constants/Layout';
import { useTranslation } from '@/contexts/I18nContext';

export interface ViewerImage {
  uri: string;
  caption?: string | null;
}

interface Props {
  images: ViewerImage[];
  index: number;
  visible: boolean;
  onRequestClose: () => void;
}

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DISMISS_DISTANCE = 120;

/**
 * Visionneuse plein ecran : pincer pour zoomer, double toucher, balayer entre
 * les photos, tirer vers le bas pour fermer.
 *
 * Elle remplace une bibliotheque qui lisait la taille de l'ecran une fois pour
 * toutes au chargement : tourner le telephone laissait la photo dimensionnee
 * pour le portrait. Ici tout part de `useWindowDimensions`, et l'orientation
 * est deverrouillee tant que la visionneuse est ouverte — le reste de l'app
 * reste en portrait. Une photo de chantier est souvent plus large que haute :
 * tourner le telephone pour la voir en grand devient naturel.
 */
export default function PhotoViewer({ images, index, visible, onRequestClose }: Props) {
  // Le Modal cree un nouvel arbre natif : sans ce Provider, les insets lus
  // dedans valent 0 et le bouton de fermeture passe sous l'encoche.
  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onRequestClose} supportedOrientations={['portrait', 'landscape']}>
      <SafeAreaProvider>
        <ViewerContent images={images} index={index} onRequestClose={onRequestClose} />
      </SafeAreaProvider>
    </Modal>
  );
}

function ViewerContent({ images, index, onRequestClose }: Omit<Props, 'visible'>) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [current, setCurrent] = useState(index);
  const [zoomed, setZoomed] = useState(false);
  const listRef = useRef<FlatList<ViewerImage>>(null);
  const backdrop = useSharedValue(1);

  // Orientation libre pendant la visionneuse, retour au portrait a la sortie.
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => undefined);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    setCurrent(index);
  }, [index]);

  // Les voisines sont prechargees : balayer ne montre plus d'ecran noir.
  useEffect(() => {
    prefetchImages([images[current - 1]?.uri, images[current + 1]?.uri]);
  }, [current, images]);

  // Apres une rotation, la liste se recale sur la photo courante. On ne
  // remonte pas la liste (pas de `key` liee a la largeur) : la remonter
  // rechargeait les images et l'ecran passait au noir le temps du retour.
  useEffect(() => {
    const id = setTimeout(() => listRef.current?.scrollToOffset({ offset: width * current, animated: false }), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  const renderItem = useCallback(
    ({ item }: { item: ViewerImage }) => (
      <ZoomableImage
        uri={item.uri}
        width={width}
        height={height}
        onZoomChange={setZoomed}
        onDismissProgress={(p) => {
          backdrop.value = 1 - Math.min(Math.abs(p) / 300, 0.6);
        }}
        onDismiss={onRequestClose}
      />
    ),
    [width, height, onRequestClose, backdrop],
  );

  return (
    <Animated.View style={[styles.container, backdropStyle]}>
      <StatusBar hidden />
      <FlatList
        ref={listRef}
        extraData={width}
        data={images}
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        initialScrollIndex={Math.min(current, Math.max(images.length - 1, 0))}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={renderItem}
      />

      <View style={[styles.topBar, { top: insets.top + Spacing.sm, left: insets.left + Spacing.md, right: insets.right + Spacing.md }]} pointerEvents="box-none">
        <Text style={styles.counter}>
          {current + 1} / {images.length}
        </Text>
        <TouchableOpacity
          onPress={onRequestClose}
          style={styles.closeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <X size={IconSize.lg} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {images[current]?.caption ? (
        <View style={[styles.captionWrap, { bottom: insets.bottom + Spacing.lg, left: insets.left + Spacing.lg, right: insets.right + Spacing.lg }]} pointerEvents="none">
          <Text style={styles.caption}>{images[current].caption}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function ZoomableImage({
  uri,
  width,
  height,
  onZoomChange,
  onDismissProgress,
  onDismiss,
}: {
  uri: string;
  width: number;
  height: number;
  onZoomChange: (zoomed: boolean) => void;
  onDismissProgress: (translationY: number) => void;
  onDismiss: () => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const dismissY = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);

  const setZoom = (value: boolean) => {
    setZoomed(value);
    onZoomChange(value);
  };

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
    runOnJS(setZoom)(false);
  };

  // Au-dela de l'image, on ne laisse pas glisser dans le vide.
  const clampPan = (value: number, size: number, s: number) => {
    'worklet';
    const max = Math.max(0, (size * s - size) / 2);
    return Math.min(max, Math.max(-max, value));
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1.02) {
        reset();
        return;
      }
      savedScale.value = scale.value;
      runOnJS(setZoom)(true);
    });

  const panZoomed = Gesture.Pan()
    .enabled(zoomed)
    .onUpdate((e) => {
      tx.value = clampPan(savedTx.value + e.translationX, width, savedScale.value);
      ty.value = clampPan(savedTy.value + e.translationY, height, savedScale.value);
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  // Tirer verticalement quand on n'est pas zoome : fermeture. Le balayage
  // horizontal reste a la liste, d'ou les seuils.
  const panDismiss = Gesture.Pan()
    .enabled(!zoomed)
    .activeOffsetY([-12, 12])
    .failOffsetX([-12, 12])
    .onUpdate((e) => {
      dismissY.value = e.translationY;
      runOnJS(onDismissProgress)(e.translationY);
    })
    .onEnd((e) => {
      if (Math.abs(dismissY.value) > DISMISS_DISTANCE || Math.abs(e.velocityY) > 900) {
        runOnJS(onDismiss)();
      } else {
        dismissY.value = withTiming(0);
        runOnJS(onDismissProgress)(0);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        reset();
      } else {
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        savedScale.value = DOUBLE_TAP_SCALE;
        runOnJS(setZoom)(true);
      }
    });

  const gesture = Gesture.Simultaneous(pinch, Gesture.Race(doubleTap, panZoomed, panDismiss));

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value + dismissY.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
        <Animated.Image source={{ uri }} style={[{ width, height }, style]} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  topBar: { position: 'absolute', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  closeBtn: { padding: Spacing.xs, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
  captionWrap: { position: 'absolute', alignItems: 'center' },
  caption: { color: '#FFFFFF', fontSize: FontSize.sm, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: 8, overflow: 'hidden' },
});
