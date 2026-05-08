import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { ChantierStatus } from '@/api/types';

interface Chip {
  key: ChantierStatus | 'all';
  label: string;
}

const CHIPS: Chip[] = [
  { key: 'all', label: 'Tous' },
  { key: 'a_venir', label: 'À venir' },
  { key: 'en_cours', label: 'En cours' },
  { key: 'termine', label: 'Terminés' },
];

interface Props {
  selected: ChantierStatus | 'all';
  onSelect: (value: ChantierStatus | 'all') => void;
}

const FilterChips: React.FC<Props> = ({ selected, onSelect }) => {
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
            accessibilityLabel={chip.label}
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[
                styles.chipText,
                { color: isActive ? chipColor : colors.text2 },
              ]}
            >
              {chip.label}
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
