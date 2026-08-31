import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, Linking, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, MapPin, Navigation, Archive, ArchiveRestore, Pencil, MessageSquare, Camera, FileText, Users, ChevronDown, ChevronUp, Copy, Check, Trash2, AlertTriangle, Clock, Save, ListChecks } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { chantierHooks, useArchiveChantier, useUnarchiveChantier, useSetChantierRetention } from '@/api/hooks/useChantiers';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/StatusBadge';
import PhotoGallery from '@/components/PhotoGallery';
import DocumentList from '@/components/DocumentList';
import TeamManager from '@/components/TeamManager';
import ChantierDiscussions, { DiscussionSubTab } from '@/components/ChantierDiscussions';
import EmergencyList, { EmergencySplitTab } from '@/components/EmergencyList';
import { useChantierMembers } from '@/api/hooks/useMembers';
import { useUnreadCounts, useMarkTabViewed } from '@/api/hooks/useChantierViews';
import type { TranslationKeys } from '@/i18n/translations';
import { useTranslation } from '@/contexts/I18nContext';

// Les onglets portent une cle de traduction, pas un libelle : le rendu appelle t().
const TABS = [
  // Etapes en tete et en premier niveau : c'est le coeur du suivi de chantier.
  // Il vivait auparavant en sous-onglet de « Discussions », ou personne n'allait
  // le chercher — une etape n'est pas une conversation.
  { key: 'steps', labelKey: 'templates.stepsLabel', icon: ListChecks },
  { key: 'comments', labelKey: 'detail.discussions', icon: MessageSquare },
  { key: 'photos', labelKey: 'detail.photos', icon: Camera },
  { key: 'documents', labelKey: 'detail.documents', icon: FileText },
  { key: 'emergencies', labelKey: 'urgence.tabTitle', icon: AlertTriangle },
  { key: 'team', labelKey: 'detail.team', icon: Users },
] as const satisfies readonly { key: string; labelKey: TranslationKeys; icon: unknown }[];

type TabKey = (typeof TABS)[number]['key'];

export default function ChantierDetailScreen() {
  const { t, locale } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: chantier, isLoading } = chantierHooks.useById(id);
  const archiveMutation = useArchiveChantier();
  const { user } = useAuth();
  const unarchiveMutation = useUnarchiveChantier();
  const setRetentionMutation = useSetChantierRetention();
  const deleteMutation = chantierHooks.useRemove();
  const [showRetentionModal, setShowRetentionModal] = useState(false);
  const [retentionInput, setRetentionInput] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('steps');
  const [showInfo, setShowInfo] = useState(true);
  const [addressCopied, setAddressCopied] = useState(false);
  // Sous-onglets persistes au-dessus des unmounts des sections.
  const [discussionSubTab, setDiscussionSubTab] = useState<DiscussionSubTab>('messages');
  const [emergencySplitTab, setEmergencySplitTab] = useState<EmergencySplitTab>('emergency');

  const { data: unreadCounts } = useUnreadCounts(id);
  const markTabViewed = useMarkTabViewed();

  // Plus de markTabViewed initial : les sous-onglets de Discussions et Urgences
  // se marquent eux-memes (via leur propre useEffect interne) quand l'utilisateur
  // les visite. Photos / Documents continuent d'etre marques sur clic d'onglet
  // (cf. plus bas).

  const { data: membersData } = useChantierMembers(id);
  const currentMember = membersData?.data.find((m) => m.user_id === user?.id);
  const isAdmin = user?.role === 'admin';
  const isCreator = !!chantier && chantier.created_by === user?.id;
  const canEdit = isAdmin || isCreator || !!currentMember?.can_edit;
  const canManageSteps = isAdmin || isCreator || currentMember?.role === 'manager' || !!currentMember?.can_edit;
  const canToggleSteps = isAdmin || isCreator || (!!currentMember && currentMember.role !== 'client');
  const canViewSteps = isAdmin || isCreator || !!currentMember?.can_view_steps;
  const canViewComments = isAdmin || isCreator || !!currentMember?.can_view_comments;
  const canViewTeam = isAdmin || isCreator || !!currentMember?.can_view_team;
  const canViewPhotos = isAdmin || isCreator || !!currentMember?.can_view_photos;
  // Gestionnaire reseau : voit toujours Documents (filtre serveur DICT) — c'est tout
  // l'interet de son role. Et tous les membres voient les urgences sans condition.
  const isGestionnaireReseau =
    user?.role === 'gestionnaire_reseau' || currentMember?.role === 'gestionnaire_reseau';
  const canViewDocuments =
    isAdmin || isCreator || !!currentMember?.can_view_documents || isGestionnaireReseau;
  const canViewEmergencies = isAdmin || isCreator || !!currentMember;
  // Urgence/Reclamation :
  // - admin / creator / manager → mode split (deux sous-onglets Urgences/Reclamations)
  // - ouvrier → mode urgence (terrain uniquement)
  // - client → mode reclamation
  // - gestionnaire_reseau → pas de creation
  const isClientMember = currentMember?.role === 'client';
  const canCreateEmergency =
    isAdmin ||
    isCreator ||
    currentMember?.role === 'manager' ||
    currentMember?.role === 'ouvrier' ||
    isClientMember;
  const emergencyMode: 'emergency' | 'claim' | 'split' =
    isAdmin || isCreator || currentMember?.role === 'manager'
      ? 'split'
      : isClientMember
        ? 'claim'
        : 'emergency';

  const visibleTabs = TABS
    .filter((tab) => {
      if (tab.key === 'team') return canViewTeam;
      if (tab.key === 'steps') return canViewSteps;
      if (tab.key === 'comments') return canViewComments;
      if (tab.key === 'photos') return canViewPhotos;
      if (tab.key === 'documents') return canViewDocuments;
      if (tab.key === 'emergencies') return canViewEmergencies;
      return true;
    })
    .map((tab) =>
      tab.key === 'emergencies' && emergencyMode === 'claim'
        ? { ...tab, labelKey: 'chantier.claims' as const }
        : tab,
    );

  // L'onglet par defaut est « Etapes », mais tout le monde n'y a pas droit : un
  // client peut n'avoir acces qu'aux photos. Si l'onglet actif ne fait pas partie
  // des onglets visibles, on retombe sur le premier disponible plutot que
  // d'afficher un ecran vide.
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [visibleTabs, activeTab]);

  const openInMaps = async () => {
    if (!chantier?.latitude || !chantier?.longitude) return;
    const { latitude, longitude } = chantier;
    // Try native Apple Maps on iOS, Google Maps on Android, fallback to web
    const urls = [
      `maps://?daddr=${latitude},${longitude}`, // Apple Maps
      `geo:${latitude},${longitude}?q=${latitude},${longitude}`, // Android native
      `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`, // Web
    ];
    for (const url of urls) {
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
          return;
        }
      } catch {
        // try next
      }
    }
  };

  const handleArchive = async () => {
    if (!id) return;
    await archiveMutation.mutateAsync(id);
    router.back();
  };

  // Estimate the current retention duration (in years) from archived_at + auto_delete_at
  const currentRetentionYears =
    chantier?.archived_at && chantier?.auto_delete_at
      ? Math.max(
          1,
          Math.round(
            (new Date(chantier.auto_delete_at).getTime() - new Date(chantier.archived_at).getTime()) /
              (365.25 * 24 * 60 * 60 * 1000),
          ),
        )
      : null;

  const openRetentionModal = () => {
    setRetentionInput(currentRetentionYears != null ? String(currentRetentionYears) : '');
    setShowRetentionModal(true);
  };

  const parsedRetention = parseInt(retentionInput, 10);
  const retentionValid =
    Number.isInteger(parsedRetention) && parsedRetention >= 1 && parsedRetention <= 10;

  const handleSaveRetention = async () => {
    if (!id || !retentionValid) return;
    try {
      await setRetentionMutation.mutateAsync({ id, years: parsedRetention });
      setShowRetentionModal(false);
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('chantier.updateFailed'));
    }
  };

  const formatCountdown = (autoDeleteAt?: string) => {
    if (!autoDeleteAt) return '';
    const diff = new Date(autoDeleteAt).getTime() - Date.now();
    if (diff <= 0) return t('duration.imminent');
    const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
    const months = Math.floor((diff % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
    if (years > 0) return t('duration.yearsMonths', { years, months });
    return t('duration.months', { months });
  };

  const handleDelete = () => {
    if (!id || !chantier) return;
    Alert.alert(
      t('chantier.deletePermanently'),
      t('chantier.deleteBody', { name: chantier.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(id);
              router.back();
            } catch (err) {
              Alert.alert(t('common.error'), err instanceof Error ? err.message : t('chantier.deleteFailed'));
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!chantier) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel={t('a11y.back')}>
            <ArrowLeft size={IconSize.lg} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.emptyText, { color: colors.mutedText }]}>{t('chantier.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const formatDate = (date?: string) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel={t('a11y.back')}>
          <ArrowLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.text }]} numberOfLines={2}>
          {chantier.name}
        </Text>
        <View style={styles.headerActions}>
          {user?.role === 'admin' && (
            <>
              {chantier.archived_at ? (
                <TouchableOpacity
                  onPress={async () => { if (!id) return; await unarchiveMutation.mutateAsync(id); }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel={t('chantier.unarchive')}
                >
                  <ArchiveRestore size={IconSize.lg} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => router.push(`/chantier/edit/${id}`)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('chantier.edit')}
                  >
                    <Pencil size={IconSize.lg} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleArchive}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('chantier.archive')}
                  >
                    <Archive size={IconSize.lg} color={colors.text2} />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                onPress={handleDelete}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={t('chantier.deletePermanently')}
              >
                <Trash2 size={IconSize.lg} color={colors.red} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Collapsible info card */}
      <TouchableOpacity
        style={[styles.infoToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => setShowInfo(!showInfo)}
        activeOpacity={0.7}
      >
        <View style={styles.infoToggleRow}>
          <StatusBadge status={chantier.status} />
          <Text style={[styles.infoToggleText, { color: colors.text2 }]}>
            {showInfo ? t('chantier.hideDetails') : t('chantier.showDetails')}
          </Text>
          {showInfo
            ? <ChevronUp size={IconSize.md} color={colors.text2} />
            : <ChevronDown size={IconSize.md} color={colors.text2} />
          }
        </View>
      </TouchableOpacity>

      {showInfo && (
        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.dates, { color: colors.text2 }]}>
            {formatDate(chantier.start_date)} → {formatDate(chantier.end_date)}
          </Text>

          {chantier.description && (
            <Text style={[styles.description, { color: colors.text }]}>{chantier.description}</Text>
          )}

          {(chantier.address || chantier.city) && (
            <View style={styles.locationRow}>
              <MapPin size={IconSize.md} color={colors.primary} />
              <Text style={[styles.locationText, { color: colors.text }]}>
                {[chantier.address, chantier.city, chantier.postal_code].filter(Boolean).join(', ')}
              </Text>
              <TouchableOpacity
                onPress={async () => {
                  const fullAddress = [chantier.address, chantier.postal_code, chantier.city].filter(Boolean).join(', ');
                  await Clipboard.setStringAsync(fullAddress);
                  setAddressCopied(true);
                  setTimeout(() => setAddressCopied(false), 1500);
                }}
                style={[styles.copyAddressBtn, { backgroundColor: addressCopied ? colors.green + '20' : colors.primary + '15' }]}
                accessibilityRole="button"
                accessibilityLabel={t('chantier.copyAddress')}
              >
                {addressCopied ? (
                  <Check size={IconSize.sm} color={colors.green} />
                ) : (
                  <Copy size={IconSize.sm} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>
          )}

          {chantier.latitude && chantier.longitude && (
            <TouchableOpacity
              style={[styles.mapsButton, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
              onPress={openInMaps}
              accessibilityRole="button"
              accessibilityLabel={t('chantier.openGoogleMaps')}
            >
              <Navigation size={IconSize.sm} color={colors.primary} />
              <Text style={[styles.mapsText, { color: colors.primary }]}>{t('chantier.openMaps')}</Text>
            </TouchableOpacity>
          )}

          {chantier.archived_at && chantier.auto_delete_at && (
            <View style={[styles.retentionRow, { borderTopColor: colors.border }]}>
              <Clock size={IconSize.sm} color={colors.red} />
              <Text style={[styles.retentionText, { color: colors.red }]}>
                {t('chantier.autoDeleteIn', { duration: formatCountdown(chantier.auto_delete_at) })}
              </Text>
              {isAdmin && (
                <TouchableOpacity
                  onPress={openRetentionModal}
                  style={[styles.retentionEditBtn, { backgroundColor: colors.primary + '15' }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('chantier.editRetention')}
                >
                  <Pencil size={IconSize.sm} color={colors.primary} />
                  <Text style={[styles.retentionEditText, { color: colors.primary }]}>{t('common.edit')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const TabIcon = tab.icon;
          // Compteur "non lu" — uniquement pour les onglets trackes (pas team).
          // On masque la pastille sur l'onglet actif : l'utilisateur est en train de regarder
          // le contenu, l'indicateur "il y a du nouveau" est redondant. Ca evite aussi le flash
          // bref entre l'arrivee sur le chantier et le retour du markTabViewed.
          // Pour Discussions et Urgences, la pastille du tab principal = somme des
          // sous-onglets. Le marquage "lu" se fait DANS le sous-composant quand on
          // visite le bon sous-onglet (cf. ChantierDiscussions / EmergencyList).
          const UNREAD_BY_TAB: Record<string, number> = {
            steps: unreadCounts?.comments_steps ?? 0,
            comments: unreadCounts?.comments ?? 0,
            photos: unreadCounts?.photos ?? 0,
            documents: unreadCounts?.documents ?? 0,
            emergencies: (unreadCounts?.emergencies ?? 0) + (unreadCounts?.emergencies_claim ?? 0),
          };
          const unread = isActive ? 0 : UNREAD_BY_TAB[tab.key] ?? 0;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
              onPress={() => {
                setActiveTab(tab.key);
                // Photos / Documents : marquage simple sur clic.
                // Discussions / Urgences : le sous-composant marque le bon sous-onglet
                // selon le subTab / splitTab actif.
                if (id && (tab.key === 'photos' || tab.key === 'documents')) {
                  markTabViewed.mutate({ chantier_id: id, tab: tab.key });
                }
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <View style={styles.tabIconWrap}>
                <TabIcon size={IconSize.md} color={isActive ? colors.primary : colors.text2} />
                {unread > 0 ? (
                  <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.unreadBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.tabLabel, { color: isActive ? colors.primary : colors.text2 }]}>
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content — takes all remaining space, no parent ScrollView */}
      <View style={styles.tabContent}>
        {(activeTab === 'steps' || activeTab === 'comments') && (
          <ChantierDiscussions
            chantierId={id!}
            canManageSteps={canManageSteps}
            canToggleSteps={canToggleSteps}
            canViewSteps={canViewSteps}
            canViewComments={canViewComments}
            readonly={!!chantier.archived_at}
            onInputFocus={() => setShowInfo(false)}
            subTab={activeTab === 'steps' ? 'steps' : 'messages'}
            onSubTabChange={setDiscussionSubTab}
            hideToggle
          />
        )}
        {activeTab === 'photos' && <PhotoGallery chantierId={id!} readonly={!!chantier.archived_at || !canEdit} />}
        {activeTab === 'documents' && <DocumentList chantierId={id!} readonly={!!chantier.archived_at || !canEdit} />}
        {activeTab === 'emergencies' && (
          <EmergencyList
            chantierId={id!}
            canCreate={canCreateEmergency}
            mode={emergencyMode}
            readonly={!!chantier.archived_at}
            splitTab={emergencySplitTab}
            onSplitTabChange={setEmergencySplitTab}
          />
        )}
        {activeTab === 'team' && <TeamManager chantierId={id!} readonly={!!chantier.archived_at} />}
      </View>

      <Modal visible={showRetentionModal} transparent animationType="fade" onRequestClose={() => setShowRetentionModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }, Shadow.lg]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('chantier.retention')}</Text>
            <Text style={[styles.modalHint, { color: colors.text2 }]}>
              {t('chantier.retentionHint')}
            </Text>

            <View style={styles.modalInputRow}>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.itemBackground,
                    color: colors.text,
                    borderColor: retentionInput && !retentionValid ? colors.red : colors.border,
                  },
                ]}
                value={retentionInput}
                onChangeText={(v) => setRetentionInput(v.replace(/[^0-9]/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="1-10"
                placeholderTextColor={colors.placeholder}
                autoFocus
                accessibilityLabel={t('chantier.yearsCount')}
              />
              <Text style={[styles.modalUnit, { color: colors.text2 }]}>
                {parsedRetention === 1 ? t('duration.year') : t('duration.years')}
              </Text>
            </View>

            {retentionInput !== '' && !retentionValid && (
              <Text style={[styles.modalError, { color: colors.red }]}>{t('profile.retentionRange')}</Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.border }]}
                onPress={() => setShowRetentionModal(false)}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <Text style={[styles.modalBtnText, { color: colors.text2 }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  { backgroundColor: retentionValid ? colors.primary : colors.itemBackground, opacity: retentionValid ? 1 : 0.6 },
                ]}
                onPress={handleSaveRetention}
                disabled={!retentionValid || setRetentionMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel={t('common.save')}
              >
                {setRetentionMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Save size={IconSize.sm} color="#FFFFFF" />
                    <Text style={[styles.modalBtnText, { color: '#FFFFFF' }]}>{t('common.save')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  // Deux lignes : la convention de nommage des chantiers (« Lieu — nature des
  // travaux ») produit des titres qui ne tiennent jamais sur une seule.
  topTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, flex: 1, textAlign: 'center' },
  headerActions: { flexDirection: 'row', gap: Spacing.md },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Collapsible info
  infoToggle: {
    marginHorizontal: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  infoToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoToggleText: { fontSize: FontSize.sm, flex: 1, marginLeft: Spacing.md },
  infoCard: {
    marginHorizontal: Spacing.xxl,
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  dates: { fontSize: FontSize.sm },
  description: { fontSize: FontSize.base, lineHeight: 22 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  locationText: { fontSize: FontSize.base, flex: 1 },
  copyAddressBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  mapsText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  tabIconWrap: { position: 'relative' },
  unreadBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: FontWeight.bold },

  // Tab content fills remaining space
  tabContent: { flex: 1 },
  emptyText: { fontSize: FontSize.lg },

  // Retention row in info card
  retentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
  },
  retentionText: { fontSize: FontSize.sm, flex: 1, fontWeight: FontWeight.medium },
  retentionEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  retentionEditText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  // Retention modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  modalHint: { fontSize: FontSize.sm, lineHeight: 18 },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  modalInput: {
    width: 100,
    height: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  modalUnit: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  modalError: { fontSize: FontSize.sm },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  modalBtnPrimary: { borderWidth: 0 },
  modalBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
});
