import React from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Pencil, Trash2, Layers } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import {
  useChantierTemplates,
  useDeleteChantierTemplate,
  ChantierTemplate,
} from '@/api/hooks/useChantierTemplates';

export default function TemplatesListScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useTranslation();

  const { data, isLoading } = useChantierTemplates();
  const deleteMutation = useDeleteChantierTemplate();

  const confirmDelete = (template: ChantierTemplate) => {
    Alert.alert(
      t('templates.deleteConfirmTitle'),
      `« ${template.name} » — ${t('templates.deleteConfirmBody')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deleteMutation.mutate(template.id) },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel={t('common.back')}
        >
          <ArrowLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('templates.title')}</Text>
        <View style={{ width: IconSize.lg }} />
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          renderItem={({ item }) => (
            <View
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, Shadow.sm]}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
                <Layers size={IconSize.lg} color={colors.primary} />
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.meta, { color: colors.mutedText }]}>
                  {item.steps.length} {item.steps.length > 1 ? t('templates.steps') : t('templates.step')}
                  {item.members.length > 0 ? ` • ${item.members.length} 👤` : ''}
                  {item.description ? ` • ${item.description}` : ''}
                </Text>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => router.push(`/templates/edit/${item.id}`)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.actionBtn}
                  accessibilityLabel={t('common.edit')}
                >
                  <Pencil size={IconSize.md} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDelete(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.actionBtn}
                  accessibilityLabel={t('common.delete')}
                >
                  <Trash2 size={IconSize.md} color={colors.red} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.empty, { color: colors.mutedText }]}>{t('templates.empty')}</Text>
              <Text style={[styles.emptyHint, { color: colors.mutedText }]}>
                {t('templates.emptyHint')}
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }, Shadow.lg]}
        onPress={() => router.push('/templates/create')}
        accessibilityLabel={t('templates.titleNew')}
      >
        <Plus size={IconSize.xl} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.lg, paddingBottom: 100 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  iconBox: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  meta: { fontSize: FontSize.xs, marginTop: 2 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { padding: Spacing.xs },

  emptyContainer: { alignItems: 'center', paddingTop: Spacing.xxxl * 2 },
  empty: { fontSize: FontSize.lg, fontWeight: FontWeight.medium },
  emptyHint: {
    fontSize: FontSize.base,
    marginTop: Spacing.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.xxl,
  },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
