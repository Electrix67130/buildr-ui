import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import Animated, { LinearTransition, FadeInLeft, FadeOutLeft, FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, List, MapIcon, Trash2, X, Check, FilePlus, Layers, Settings } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useChantiers, useChantierSearch, chantierHooks } from '@/api/hooks/useChantiers';
import { useTranslation } from '@/contexts/I18nContext';
import SearchBar from '@/components/SearchBar';
import FilterChips from '@/components/FilterChips';
import ChantierCard from '@/components/ChantierCard';
import { useUnreadSummary } from '@/api/hooks/useChantierViews';
import ChantierMap from '@/components/ChantierMap';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/AppHeader';
import ActionSheet from '@/components/ActionSheet';
import type { ChantierStatus, Chantier } from '@/api/types';

type ViewMode = 'list' | 'map';

export default function ChantiersScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [statusFilter, setStatusFilter] = useState<ChantierStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const activeStatus = statusFilter === 'all' ? undefined : statusFilter;

  const isSearching = searchQuery.length > 0;
  const chantiersQuery = useChantiers({ status: activeStatus });
  const unreadSummary = useUnreadSummary(true);
  const searchResults = useChantierSearch(searchQuery, undefined, undefined, activeStatus);

  const data = isSearching ? searchResults.data?.data : chantiersQuery.data?.data;
  const isLoading = isSearching ? searchResults.isLoading : chantiersQuery.isLoading;

  const deleteMutation = chantierHooks.useRemove();

  // Mode multi-selection (active sur long-press d'une carte ; admin uniquement).
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCreateMenu, setShowCreateMenu] = useState(false);

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

  const handleChantierPress = useCallback(
    (id: string) => {
      if (selectionMode) {
        toggleSelection(id);
      } else {
        router.push(`/chantier/${id}`);
      }
    },
    [router, selectionMode, toggleSelection],
  );

  const handleChantierLongPress = useCallback(
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
      `Supprimer ${ids.length} chantier${ids.length > 1 ? 's' : ''} ?`,
      'Action irréversible : toutes leurs données (photos, documents, étapes…) seront supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await Promise.all(ids.map((id) => deleteMutation.mutateAsync(id)));
              exitSelection();
            } catch (err) {
              Alert.alert('Erreur', err instanceof Error ? err.message : 'Suppression partielle');
            }
          },
        },
      ],
    );
  }, [selectedIds, deleteMutation, exitSelection]);

  const renderItem = useCallback(
    ({ item }: { item: Chantier }) => {
      const isSelected = selectedIds.has(item.id);
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
            <ChantierCard
              chantier={item}
              onPress={handleChantierPress}
              onLongPress={isAdmin ? handleChantierLongPress : undefined}
              selectionMode={selectionMode}
              selected={isSelected}
              unread={unreadSummary.data?.by_chantier[item.id] ?? 0}
            />
          </Animated.View>
        </Animated.View>
      );
    },
    [handleChantierPress, handleChantierLongPress, isAdmin, selectionMode, selectedIds, toggleSelection, colors, unreadSummary.data],
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.mutedText }]}>
          {t('chantier.empty')}
        </Text>
        <Text style={[styles.emptyHint, { color: colors.mutedText }]}>
          {isSearching ? 'Essayez un autre terme de recherche.' : 'Appuyez sur + pour créer votre premier chantier.'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader>
        <Text style={[styles.title, { color: colors.text }]}>{t('chantier.title')}</Text>
        {/* Toggle liste / carte */}
        <View style={[styles.viewToggle, { backgroundColor: colors.itemBackground }]}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'list' && { backgroundColor: colors.primary }]}
            onPress={() => setViewMode('list')}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'list' }}
            accessibilityLabel={t('chantier.viewList')}
          >
            <List size={IconSize.md} color={viewMode === 'list' ? '#FFFFFF' : colors.text2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'map' && { backgroundColor: colors.primary }]}
            onPress={() => setViewMode('map')}
            accessibilityRole="tab"
            accessibilityState={{ selected: viewMode === 'map' }}
            accessibilityLabel={t('chantier.viewMap')}
          >
            <MapIcon size={IconSize.md} color={viewMode === 'map' ? '#FFFFFF' : colors.text2} />
          </TouchableOpacity>
        </View>
      </AppHeader>

      {selectionMode ? (
        <Animated.View
          key="selection-bar"
          entering={FadeInDown.duration(220)}
          exiting={FadeOutUp.duration(180)}
          style={[styles.selectionBar, { backgroundColor: colors.primary + '15', borderBottomColor: colors.primary }]}
        >
          <TouchableOpacity onPress={exitSelection} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel="Annuler la sélection">
            <X size={IconSize.lg} color={colors.text} />
          </TouchableOpacity>
          <Animated.Text
            key={`count-${selectedIds.size}`}
            entering={FadeInDown.duration(140)}
            style={[styles.selectionCount, { color: colors.text }]}
          >
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </Animated.Text>
          <TouchableOpacity
            style={[
              styles.selectionDelete,
              { backgroundColor: selectedIds.size === 0 ? colors.itemBackground : colors.red },
            ]}
            onPress={handleBulkDelete}
            disabled={selectedIds.size === 0 || deleteMutation.isPending}
            accessibilityLabel="Supprimer la sélection"
          >
            <Trash2 size={IconSize.sm} color={selectedIds.size === 0 ? colors.mutedText : '#FFFFFF'} />
            <Text style={[styles.selectionDeleteText, { color: selectedIds.size === 0 ? colors.mutedText : '#FFFFFF' }]}>
              Supprimer
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <Animated.View
          key="controls"
          entering={FadeInDown.duration(220)}
          exiting={FadeOutUp.duration(180)}
          style={styles.controls}
        >
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('chantier.search')}
          />
          <FilterChips selected={statusFilter} onSelect={setStatusFilter} />
        </Animated.View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : viewMode === 'map' ? (
        <ChantierMap chantiers={data ?? []} onChantierPress={handleChantierPress} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[styles.list, { flexGrow: 1 }]}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={chantiersQuery.isRefetching}
              onRefresh={() => { chantiersQuery.refetch(); searchResults.refetch(); }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}

      {/* FAB — Menu de creation (admin only) */}
      {isAdmin && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }, Shadow.lg]}
          onPress={() => setShowCreateMenu(true)}
          accessibilityRole="button"
          accessibilityLabel={t('chantier.create')}
        >
          <Plus size={IconSize.xl} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Bottom sheet — menu de creation */}
      <ActionSheet
        visible={showCreateMenu}
        title={t('chantier.createTitle')}
        subtitle={t('chantier.createSubtitle')}
        onClose={() => setShowCreateMenu(false)}
        options={[
          {
            key: 'blank',
            label: t('chantier.createEmpty'),
            description: t('chantier.createEmptyDesc'),
            icon: FilePlus,
            onPress: () => router.push('/chantier/create'),
          },
          {
            key: 'template',
            label: t('chantier.createFromTemplate'),
            description: t('chantier.createFromTemplateDesc'),
            icon: Layers,
            onPress: () => router.push('/templates/pick'),
          },
          {
            key: 'manage',
            label: t('chantier.manageTemplates'),
            description: t('chantier.manageTemplatesDesc'),
            icon: Settings,
            onPress: () => router.push('/templates'),
          },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: 2,
  },
  toggleBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: { paddingHorizontal: Spacing.xxl, gap: Spacing.md, paddingBottom: Spacing.md },
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
  selectionDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  selectionDeleteText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  selectableRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  externalCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: Spacing.xxl, paddingBottom: 100 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyContainer: { alignItems: 'center', paddingTop: Spacing.xxxl * 2 },
  emptyText: { fontSize: FontSize.lg, fontWeight: FontWeight.medium },
  emptyHint: { fontSize: FontSize.base, marginTop: Spacing.sm, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: Spacing.xxl,
    bottom: Spacing.xxl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

});
