import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { FontWeight } from '@/constants/Layout';

/**
 * Logo Buildr : badge carre arrondi orange portant un B blanc.
 *
 * Dessine en vues natives plutot qu'importe comme image. Le logo apparait a des
 * tailles tres differentes — 80 px sur l'ecran de connexion, 28 px dans l'en-tete
 * des onglets — et une image tramee perdrait en nettete a l'une ou a l'autre.
 * C'est aussi la forme exacte du logo de getbuildr.fr et du dashboard.
 */
interface Props {
  size?: number;
  color?: string;
  showText?: boolean;
}

const ORANGE = '#D97706';

const BuildrLogo: React.FC<Props> = ({ size = 64, color = ORANGE, showText = true }) => {
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.badge,
          { width: size, height: size, borderRadius: size * 0.28, backgroundColor: ORANGE },
        ]}
      >
        <Text
          style={[
            styles.letter,
            {
              fontSize: size * 0.56,
              // Sans lineHeight explicite, la lettre se decale vers le haut :
              // Android reserve la place des jambages sous la ligne de base.
              lineHeight: size * 0.72,
            },
          ]}
        >
          B
        </Text>
      </View>
      {showText && <Text style={[styles.text, { color }]}>Buildr</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  badge: { alignItems: 'center', justifyContent: 'center' },
  letter: {
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
    ...Platform.select({ android: { includeFontPadding: false } }),
  },
  text: {
    fontSize: 32,
    fontWeight: FontWeight.bold,
    marginTop: 8,
    letterSpacing: 1,
  },
});

export default React.memo(BuildrLogo);
