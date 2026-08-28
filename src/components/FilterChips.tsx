import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { ChantierStatus } from '@/api/types';
import { useTranslation } from '@/contexts/I18nContext';
import type { TranslationKeys } from '@/i18n/translations';

interface Chip {
  key: ChantierStatus | 'all';
  labelKey: TranslationKeys;
}

const CHIPS: Chip[] = [
  { key: 'all', labelKey: 'common.all' },
  { key: 'a_venir', labelKey: 'chantier.statusUpcoming' },
  { key: 'en_cours', labelKey: 'chantier.statusInProgress' },
  { key: 'termine', labelKey: 'chantier.statusCompleted' },
];

interface Props {
  selected: ChantierStatus | 'all';
  onSelect: (value: ChantierStatus | 'all') => void;
}

const FilterChips: React.FC<Props> = ({ selected, onSelect }) => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const getChipColor = (key: string) => {
    if (key === 'a_venir') return colors.statusAVenir;
    if (key === 'en_cours') return colors.statusEnCours;
    if (key === 'termine') return colors.statusTermine;
    return colors.primary;
  };

  return (
    <View style={styles.container}>
      {CHIPS.map((chip) => {
        const isActive = selected === chip.key;
        const chipColor = getChipColor(chip.key);

        return (
          <TouchableOpacity
            key={chip.key}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? chipColor + '20' : colors.itemBackground,
                borderColor: isActive ? chipColor : colors.border,
              },
            ]}
            onPress={() => onSelect(chip.key)}
            accessibilityRole="tab"
            accessibilityLabel={t(chip.labelKey)}
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[
                styles.chipText,
                { color: isActive ? chipColor : colors.text2 },
              ]}
            >
              {t(chip.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});

export default React.memo(FilterChips);
