import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { Globe, Check, ChevronDown } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Radius, Spacing, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { LOCALES } from '@/i18n/translations';

/**
 * Selecteur de langue pour les ecrans accessibles avant connexion.
 *
 * Le selecteur complet vit dans le Profil, donc derriere l'authentification :
 * quelqu'un qui ne parle pas francais ne pouvait pas changer de langue avant
 * d'avoir reussi a se connecter, ce qui est le moment ou il en a besoin.
 *
 * Un bouton qui ouvre une liste, plutot qu'une rangee de puces : c'est le
 * comportement d'un menu deroulant, celui du dashboard, et il affiche le nom
 * complet de la langue. Le drapeau l'accompagne sans le remplacer — un drapeau
 * designe un pays et non une langue, et le simulateur iOS n'en affiche meme pas
 * les glyphes. Si le drapeau manque, le nom suffit.
 */
export default function LanguageSwitch() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { locale, setLocale, t } = useTranslation();
  const [open, setOpen] = useState(false);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[styles.trigger, { borderColor: colors.border, backgroundColor: colors.itemBackground }]}
        accessibilityRole="button"
        accessibilityLabel={`${t('profile.language')} : ${current.label}`}
      >
        <Globe size={IconSize.sm} color={colors.mutedText} />
        <Text style={[styles.triggerText, { color: colors.text2 }]}>
          {current.flag} {current.label}
        </Text>
        <ChevronDown size={IconSize.sm} color={colors.mutedText} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* Pressable interne : un appui sur la liste ne doit pas la refermer. */}
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }, Shadow.lg]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{t('profile.language')}</Text>
            <ScrollView>
              {LOCALES.map((loc) => {
                const isActive = loc.code === locale;
                return (
                  <TouchableOpacity
                    key={loc.code}
                    style={[styles.option, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      setLocale(loc.code);
                      setOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={loc.label}
                  >
                    <Text style={[styles.optionText, { color: isActive ? colors.primary : colors.text }]}>
                      {loc.flag} {loc.label}
                    </Text>
                    {isActive ? <Check size={IconSize.sm} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  triggerText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: Spacing.xl },
  sheet: { borderRadius: Radius.xl, paddingVertical: Spacing.sm, maxHeight: '70%' },
  sheetTitle: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: { fontSize: FontSize.base },
});
