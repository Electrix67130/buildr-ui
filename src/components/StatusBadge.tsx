import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import type { TranslationKeys } from '@/i18n/translations';
import type { ChantierStatus } from '@/api/types';

const STATUS_KEYS: Record<ChantierStatus, TranslationKeys> = {
  a_venir: 'chantier.statusUpcoming',
  en_cours: 'chantier.statusInProgress',
  termine: 'chantier.statusCompleted',
};

interface Props {
  status: ChantierStatus;
}

const StatusBadge: React.FC<Props> = ({ status }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const colorMap: Record<ChantierStatus, string> = {
    a_venir: colors.statusAVenir,
    en_cours: colors.statusEnCours,
    termine: colors.statusTermine,
  };

  const badgeColor = colorMap[status];

  return (
    <View style={[styles.badge, { backgroundColor: badgeColor + '20', borderColor: badgeColor }]}>
      <View style={[styles.dot, { backgroundColor: badgeColor }]} />
      <Text style={[styles.text, { color: badgeColor }]}>{t(STATUS_KEYS[status])}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
});

export default React.memo(StatusBadge);
