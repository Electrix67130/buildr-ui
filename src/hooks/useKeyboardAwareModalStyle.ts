import { useEffect } from 'react';
import { Keyboard, Platform, useWindowDimensions } from 'react-native';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface Options {
  /**
   * Si false, le style est neutre. Necessaire quand plusieurs modals coexistent sur le
   * meme ecran : sans cette garde, une modal fermee mais montee dans le tree continue
   * de reagir au clavier d'une autre. Default true.
   */
  visible?: boolean;
  /** Ratio de la zone visible (ecran - clavier) que la modal peut occuper. Default 0.85. */
  maxHeightRatio?: number;
}

/**
 * Style anime pour faire monter une bottom-sheet Modal au-dessus du clavier.
 *
 * Strategie :
 *  - Un shared value `animatedKeyboardHeight` est anime via withTiming aux events
 *    keyboardWillShow / keyboardWillHide (250ms iOS, 220ms Android — matche le systeme).
 *  - translateY ET maxHeight sont DERIVES du meme shared value -> ils animent en lockstep,
 *    donc le top de la modal reste toujours visible pendant la transition.
 *  - On ignore willChangeFrame (autofill bar iOS), threshold de 60px sur les changements
 *    de hauteur, et debounce 120ms sur willHide -> aucune animation declenchee entre
 *    deux inputs d'une meme modal.
 *
 * Usage :
 * ```tsx
 * const animatedStyle = useKeyboardAwareModalStyle({ visible: showModal });
 * <Animated.View style={[styles.modalContent, animatedStyle]}>...</Animated.View>
 * ```
 *
 * Le style statique modalContent ne doit PAS contenir maxHeight (ce hook le gere).
 */
export function useKeyboardAwareModalStyle(opts: Options = {}) {
  const { visible = true, maxHeightRatio = 0.85 } = opts;
  const { height: screenHeight } = useWindowDimensions();
  // Si le clavier est deja ouvert au moment ou ce hook se mount (ex: la modal s'ouvre
  // alors qu'un input parent a deja deploye le clavier), aucun nouveau willShow ne va
  // arriver. On lit la hauteur courante via Keyboard.metrics() pour initialiser le
  // sharedValue au bon endroit. iOS uniquement — sur Android Keyboard.metrics renvoie
  // null, mais la situation y est moins probable car la transition de focus passe par
  // une fermeture/reouverture qui retrigger willShow.
  const initialKeyboardHeight = Keyboard.metrics?.()?.height ?? 0;
  const animatedKeyboardHeight = useSharedValue(initialKeyboardHeight);

  useEffect(() => {
    // Resync au cas ou le clavier aurait change entre le render et le mount.
    const metrics = Keyboard.metrics?.();
    if (metrics && metrics.height !== animatedKeyboardHeight.value) {
      animatedKeyboardHeight.value = metrics.height;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const animDuration = Platform.OS === 'ios' ? 250 : 220;
    // iOS envoie parfois un willHide -> willShow cycle (<120ms d'ecart) quand on passe
    // d'un input a un autre. On debounce le hide pour ignorer ces faux positifs.
    let pendingHide: ReturnType<typeof setTimeout> | null = null;
    const cancelPendingHide = () => {
      if (pendingHide) {
        clearTimeout(pendingHide);
        pendingHide = null;
      }
    };
    const showSub = Keyboard.addListener(showEvent, (e) => {
      cancelPendingHide();
      const h = e.endCoordinates.height;
      // Threshold : ignore les micro-changements (barre d'autofill iOS qui se redessine
      // ~30-50px entre 2 inputs).
      if (animatedKeyboardHeight.value > 0 && Math.abs(h - animatedKeyboardHeight.value) < 60) {
        return;
      }
      animatedKeyboardHeight.value = withTiming(h, { duration: animDuration });
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      cancelPendingHide();
      pendingHide = setTimeout(() => {
        pendingHide = null;
        animatedKeyboardHeight.value = withTiming(0, { duration: animDuration });
      }, 120);
    });
    return () => {
      cancelPendingHide();
      showSub.remove();
      hideSub.remove();
    };
  }, [animatedKeyboardHeight]);

  return useAnimatedStyle(() => {
    if (!visible) {
      return { transform: [{ translateY: 0 }], maxHeight: screenHeight * maxHeightRatio };
    }
    return {
      transform: [{ translateY: -animatedKeyboardHeight.value }],
      maxHeight: (screenHeight - animatedKeyboardHeight.value) * maxHeightRatio,
    };
  });
}
