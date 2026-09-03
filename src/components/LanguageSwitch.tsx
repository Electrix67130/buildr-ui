import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Radius, Spacing, FontSize } from '@/constants/Layout';
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
 * Ne montre que les drapeaux : huit libelles ne tiendraient pas sur une ligne,
 * et le drapeau seul se reconnait sans savoir lire la langue courante. Le nom
 * complet reste accessible aux lecteurs d'ecran.
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
            <Text style={styles.flag}>{loc.flag}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  flag: { fontSize: FontSize.lg },
});
