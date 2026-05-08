import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MapPin, Calendar } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import StatusBadge from './StatusBadge';
import type { Chantier } from '@/api/types';

interface Props {
  chantier: Chantier;
  onPress: (id: string) => void;
  onLongPress?: (chantier: Chantier) => void;
  selectionMode?: boolean;
  selected?: boolean;
  /** Nombre d'items non lus (toutes sections confondues). Affiche une pastille si > 0. */
  unread?: number;
}

const ChantierCard: React.FC<Props> = ({ chantier, onPress, onLongPress, selectionMode, selected, unread = 0 }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const formatDate = (date?: string) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: selected ? colors.primary + '15' : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
        Shadow.sm,
      ]}
      onPress={() => onPress(chantier.id)}
      onLongPress={onLongPress ? () => onLongPress(chantier) : undefined}
      delayLongPress={350}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Chantier ${chantier.name}`}
      accessibilityState={selectionMode ? { selected: !!selected } : undefined}
    >
      <View style={styles.header}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {chantier.name}
        </Text>
        {unread > 0 ? (
          <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.unreadBadgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        ) : null}
        <StatusBadge status={chantier.status} />
      </View>

      {(chantier.address || chantier.city) && (
        <View style={styles.row}>
          <MapPin size={IconSize.sm} color={colors.text2} />
          <Text style={[styles.detail, { color: colors.text2 }]} numberOfLines={1}>
            {[chantier.address, chantier.city, chantier.postal_code].filter(Boolean).join(', ')}
          </Text>
        </View>
      )}

      {(chantier.start_date || chantier.end_date) && (
        <View style={styles.row}>
          <Calendar size={IconSize.sm} color={colors.text2} />
          <Text style={[styles.detail, { color: colors.text2 }]}>
            {formatDate(chantier.start_date)}
            {chantier.end_date ? ` → ${formatDate(chantier.end_date)}` : ''}
          </Text>
        </View>
      )}

      {chantier.description && (
        <Text style={[styles.description, { color: colors.mutedText }]} numberOfLines={2}>
          {chantier.description}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    flex: 1,
    marginRight: Spacing.sm,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: FontWeight.bold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  detail: {
    fontSize: FontSize.sm,
    flex: 1,
  },
  description: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },
  selectRow: { marginBottom: Spacing.xs },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
});

export default React.memo(ChantierCard);
