import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import Reanimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/I18nContext';
import type { MentionableUser } from '@/api/types';
import { parseMentions } from '@/utils/mentions';

/** Un message, ses mentions en couleur ; celles qui vous visent ressortent davantage. */
export function MentionText({ content, style, numberOfLines }: { content: string; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const colors = Colors[useColorScheme()];
  const { user } = useAuth();
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parseMentions(content).map((segment, i) =>
        segment.type === 'text' ? (
          segment.text
        ) : (
          <Text
            key={i}
            style={[
              styles.mention,
              { color: colors.primary },
              segment.id === user?.id ? { backgroundColor: colors.primary + '22' } : null,
            ]}
          >
            @{segment.name}
          </Text>
        ),
      )}
    </Text>
  );
}

/** Les personnes proposees pendant la saisie d'une mention, au-dessus du champ. */
export function MentionSuggestions({ people, onPick }: { people: MentionableUser[]; onPick: (person: MentionableUser) => void }) {
  const colors = Colors[useColorScheme()];
  const { t } = useTranslation();
  if (people.length === 0) return null;
  return (
    <Reanimated.View
      entering={FadeIn.duration(120)}
      exiting={FadeOut.duration(100)}
      style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel={t('mentions.suggestions')}
    >
      {people.map((person) => (
        <TouchableOpacity
          key={person.id}
          style={styles.row}
          onPress={() => onPick(person)}
          accessibilityRole="button"
          accessibilityLabel={t('mentions.mention', { name: `${person.first_name} ${person.last_name}` })}
        >
          <View style={[styles.initials, { backgroundColor: colors.primary + '22' }]}>
            <Text style={[styles.initialsText, { color: colors.primary }]}>
              {(person.first_name[0] ?? '') + (person.last_name[0] ?? '')}
            </Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {person.first_name} {person.last_name}
          </Text>
        </TouchableOpacity>
      ))}
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  mention: { fontWeight: FontWeight.semibold, borderRadius: Radius.sm },
  list: { marginHorizontal: Spacing.md, marginTop: Spacing.sm, borderWidth: 1, borderRadius: Radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  initials: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  name: { fontSize: FontSize.base, flex: 1 },
});
