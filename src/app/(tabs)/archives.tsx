import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArchiveRestore, Calendar, MapPin, Clock, Trash2, X, Check } from 'lucide-react-native';
import Animated, { LinearTransition, FadeInLeft, FadeOutLeft, FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useChantierArchives, useUnarchiveChantier, chantierHooks } from '@/api/hooks/useChantiers';
import { useAuth } from '@/contexts/AuthContext';
import SearchBar from '@/components/SearchBar';
import AppHeader from '@/components/AppHeader';
import type { Chantier } from '@/api/types';
import { useTranslation } from '@/contexts/I18nContext';

export default function ArchivesScreen() {
  const { t, locale } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [search, setSearch] = useState('');
  const { data, isLoading, refetch, isRefetching } = useChantierArchives({ q: search || undefined });
  const unarchiveMutation = useUnarchiveChantier();
  const deleteMutation = chantierHooks.useRemove();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleUnarchive = useCallback(
    (id: string, name: string) => {
      Alert.alert(t('chantier.unarchive'), t('chantier.unarchiveConfirm', { name }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('chantier.unarchive'), onPress: () => unarchiveMutation.mutate(id) },
      ]);
    },
    [unarchiveMutation, t],
  );

  const handleEnterSelection = useCallback(
    (chantier: Chantier) => {
      if (!isAdmin) return;
      setSelectionMode(true);
      setSelectedIds((prev) => new Set(prev).add(chantier.id));
    },
    [isAdmin],
  );

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Alert.alert(
      t('chantier.bulkDeleteTitle', { count: ids.length }),
      t('chantier.bulkDeleteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(ids.map((id) => deleteMutation.mutateAsync(id)));
              exitSelection();
            } catch (err) {
              Alert.alert(t('common.error'), err instanceof Error ? err.message : t('chantier.bulkDeletePartial'));
            }
          },
        },
      ],
    );
  }, [selectedIds, deleteMutation, exitSelection, t]);

  const handleBulkUnarchive = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    Alert.alert(
      t('chantier.bulkUnarchiveTitle', { count: ids.length }),
      t('chantier.bulkUnarchiveBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('chantier.unarchive'),
          onPress: async () => {
            try {
              await Promise.all(ids.map((id) => unarchiveMutation.mutateAsync(id)));
              exitSelection();
            } catch (err) {
              Alert.alert(t('common.error'), err instanceof Error ? err.message : t('chantier.bulkPartial'));
            }
          },
        },
      ],
    );
  }, [selectedIds, unarchiveMutation, exitSelection, t]);

  const formatDate = (date?: string) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getDeleteCountdown = (autoDeleteAt?: string) => {
    if (!autoDeleteAt) return '';
    const diff = new Date(autoDeleteAt).getTime() - Date.now();
    const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
    const months = Math.floor((diff % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
    if (years > 0) return t('duration.yearsMonths', { years, months });
    return t('duration.months', { months });
  };

  const renderItem = useCallback(
    ({ item }: { item: Chantier }) => {
      const isSelected = selectedIds.has(item.id);
      const card = (
        <TouchableOpacity
          style={[
            styles.card,
            {
              backgroundColor: isSelected ? colors.primary + '15' : colors.surface,
              borderColor: isSelected ? colors.primary : colors.border,
            },
            Shadow.sm,
          ]}
          onPress={() => {
            if (selectionMode) toggleSelection(item.id);
            else router.push(`/chantier/${item.id}`);
          }}
          onLongPress={isAdmin ? () => handleEnterSelection(item) : undefined}
          delayLongPress={350}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('chantier.viewA11y', { name: item.name })}
          accessibilityState={selectionMode ? { selected: isSelected } : undefined}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            {!selectionMode && (
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); handleUnarchive(item.id, item.name); }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={t('chantier.unarchiveA11y', { name: item.name })}
              >
                <ArchiveRestore size={IconSize.lg} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {(item.address || item.city) && (
            <View style={styles.row}>
              <MapPin size={IconSize.sm} color={colors.text2} />
              <Text style={[styles.detail, { color: colors.text2 }]} numberOfLines={1}>
                {[item.address, item.city].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}

          <View style={styles.row}>
            <Calendar size={IconSize.sm} color={colors.text2} />
            <Text style={[styles.detail, { color: colors.text2 }]}>
              {t('archives.archivedOnDate', { date: formatDate(item.archived_at) })}
            </Text>
          </View>

          <View style={styles.row}>
            <Clock size={IconSize.sm} color={colors.red} />
            <Text style={[styles.detail, { color: colors.red }]}>
              {t('chantier.autoDeleteIn', { duration: getDeleteCountdown(item.auto_delete_at) })}
            </Text>
          </View>
        </TouchableOpacity>
      );

      return (
        <Animated.View style={styles.selectableRow} layout={LinearTransition.duration(220)}>
          {selectionMode ? (
            <Animated.View entering={FadeInLeft.duration(200)} exiting={FadeOutLeft.duration(180)}>
              <TouchableOpacity
                onPress={() => toggleSelection(item.id)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                style={[
                  styles.externalCheckbox,
                  {
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary : 'transparent',
                  },
                ]}
              >
                {isSelected ? <Check size={14} color="#FFFFFF" /> : null}
              </TouchableOpacity>
            </Animated.View>
          ) : null}
          <Animated.View style={{ flex: 1 }} layout={LinearTransition.duration(220)}>
            {card}
          </Animated.View>
        </Animated.View>
      );
    },
    [colors, handleUnarchive, handleEnterSelection, isAdmin, router, selectionMode, selectedIds, toggleSelection, locale, t],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader />

      {selectionMode ? (
        <Animated.View
          key="selection-bar"
          entering={FadeInDown.duration(220)}
          exiting={FadeOutUp.duration(180)}
          style={[styles.selectionBar, { backgroundColor: colors.primary + '15', borderBottomColor: colors.primary }]}
        >
          <TouchableOpacity onPress={exitSelection} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel={t('selection.cancel')}>
            <X size={IconSize.lg} color={colors.text} />
          </TouchableOpacity>
          <Animated.Text
            key={`count-${selectedIds.size}`}
            entering={FadeInDown.duration(140)}
            style={[styles.selectionCount, { color: colors.text }]}
          >
            {t('selection.count', { count: selectedIds.size })}
          </Animated.Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity
              style={[
                styles.selectionAction,
                { backgroundColor: selectedIds.size === 0 ? colors.itemBackground : colors.primary },
              ]}
              onPress={handleBulkUnarchive}
              disabled={selectedIds.size === 0 || unarchiveMutation.isPending}
              accessibilityLabel={t('selection.unarchive')}
            >
              <ArchiveRestore size={IconSize.sm} color={selectedIds.size === 0 ? colors.mutedText : '#FFFFFF'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.selectionAction,
                { backgroundColor: selectedIds.size === 0 ? colors.itemBackground : colors.red },
              ]}
              onPress={handleBulkDelete}
              disabled={selectedIds.size === 0 || deleteMutation.isPending}
              accessibilityLabel={t('selection.delete')}
            >
              <Trash2 size={IconSize.sm} color={selectedIds.size === 0 ? colors.mutedText : '#FFFFFF'} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : (
        <Animated.View
          key="search"
          entering={FadeInDown.duration(220)}
          exiting={FadeOutUp.duration(180)}
          style={styles.searchContainer}
        >
          <SearchBar value={search} onChangeText={setSearch} placeholder={t('archives.search')} />
        </Animated.View>
      )}

      <FlatList
        style={{ flex: 1 }}
        data={data?.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { flexGrow: 1 }]}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.mutedText }]}>
                {search ? t('archives.noResult') : t('archives.empty')}
              </Text>
              <Text style={[styles.emptyHint, { color: colors.mutedText }]}>
                {t('archives.emptyHint')}
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  searchContainer: { paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.md },
  list: { paddingHorizontal: Spacing.xxl, paddingBottom: 100 },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, flex: 1, marginRight: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  detail: { fontSize: FontSize.sm, flex: 1 },
  emptyContainer: { alignItems: 'center', paddingTop: Spacing.xxxl * 2 },
  emptyText: { fontSize: FontSize.lg, fontWeight: FontWeight.medium },
  emptyHint: { fontSize: FontSize.base, marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.xxl },
  selectableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
  },
  externalCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  selectionCount: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, flex: 1, textAlign: 'center' },
  selectionActions: { flexDirection: 'row', gap: Spacing.sm },
  selectionAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
