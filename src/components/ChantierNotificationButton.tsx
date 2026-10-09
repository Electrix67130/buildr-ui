import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, BellOff, BellRing, Check, type LucideIcon } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import type { TranslationKeys } from '@/i18n/translations';
import type { ChantierNotificationLevel } from '@/api/types';
import { useChantierNotificationLevel, useSetChantierNotificationLevel } from '@/api/hooks/useNotificationPreferences';

const LEVELS: { level: ChantierNotificationLevel; icon: LucideIcon; label: TranslationKeys; hint: TranslationKeys }[] = [
  { level: 'all', icon: Bell, label: 'notifPrefs.levelAll', hint: 'notifPrefs.levelAllHint' },
  { level: 'important', icon: BellRing, label: 'notifPrefs.levelImportant', hint: 'notifPrefs.levelImportantHint' },
  { level: 'none', icon: BellOff, label: 'notifPrefs.levelNone', hint: 'notifPrefs.levelNoneHint' },
];

/**
 * La cloche d'un chantier : tout recevoir, seulement l'important (mentions et
 * urgences), ou rien. Son icone dit le reglage en cours.
 */
export default function ChantierNotificationButton({ chantierId }: { chantierId: string }) {
  const { t } = useTranslation();
  const colors = Colors[useColorScheme()];
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const { data } = useChantierNotificationLevel(chantierId);
  const setLevel = useSetChantierNotificationLevel();
  const current = data?.level ?? 'all';
  const CurrentIcon = LEVELS.find((l) => l.level === current)?.icon ?? Bell;

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={t('notifPrefs.chantierTitle')}
      >
        <CurrentIcon size={IconSize.lg} color={current === 'all' ? colors.text2 : colors.primary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Spacing.xl + insets.bottom }]}>
            <Text style={[styles.title, { color: colors.text }]}>{t('notifPrefs.chantierTitle')}</Text>
            {LEVELS.map(({ level, icon: Icon, label, hint }) => {
              const selected = level === current;
              return (
                <TouchableOpacity
                  key={level}
                  style={styles.option}
                  onPress={() => {
                    setLevel.mutate({ chantierId, level });
                    setOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.icon, { backgroundColor: colors.primary + '15' }]}>
                    <Icon size={IconSize.md} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.text }]}>{t(label)}</Text>
                    <Text style={[styles.hint, { color: colors.mutedText }]}>{t(hint)}</Text>
                  </View>
                  {selected ? <Check size={IconSize.md} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, marginBottom: Spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  icon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  hint: { fontSize: FontSize.xs, marginTop: 2, lineHeight: FontSize.xs * 1.4 },
});
