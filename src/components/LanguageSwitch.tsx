import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Radius, Spacing, FontSize, FontWeight } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { LOCALES } from '@/i18n/translations';

/**
 * Selecteur de langue compact, pour les ecrans accessibles avant connexion.
 *
 * Le selecteur complet vit dans le Profil, donc derriere l'authentification :
 * quelqu'un qui ne parle pas francais ne pouvait pas changer de langue avant
 * d'avoir reussi a se connecter, ce qui est precisement le moment ou il en a
 * besoin.
 *
 * Affiche les codes de langue (FR, EN, DE...) et non des drapeaux. Un drapeau
 * designe un pays, pas une langue — le drapeau britannique ignore les
 * anglophones non britanniques, et le portugais du Portugal n'est pas celui du
 * Bresil. Les drapeaux ne s'affichent d'ailleurs pas dans le simulateur iOS,
 * qui n'embarque pas leurs glyphes : on ne pouvait pas verifier le rendu.
 *
 * Le nom complet de la langue reste expose aux lecteurs d'ecran.
 */
export default function LanguageSwitch() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { locale, setLocale } = useTranslation();

  return (
    <View style={styles.row}>
      {LOCALES.map((loc) => {
        const isActive = locale === loc.code;
        return (
          <TouchableOpacity
            key={loc.code}
            onPress={() => setLocale(loc.code)}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? colors.primary + '20' : 'transparent',
                borderColor: isActive ? colors.primary : 'transparent',
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={loc.label}
          >
            <Text
              style={[styles.code, { color: isActive ? colors.primary : colors.text2 }]}
            >
              {loc.code.toUpperCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  code: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, letterSpacing: 0.5 },
});
