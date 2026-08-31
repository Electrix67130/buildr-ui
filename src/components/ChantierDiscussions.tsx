import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ListChecks, MessageSquare, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useComments } from '@/api/hooks/useComments';
import { useUnreadCounts, useMarkTabViewed, useMarkItemViewed } from '@/api/hooks/useChantierViews';
import ChantierSteps from './ChantierSteps';
import CommentThread from './CommentThread';
import type { ChantierStep } from '@/api/hooks/useChantierSteps';
import { useTranslation } from '@/contexts/I18nContext';

export type DiscussionSubTab = 'steps' | 'messages';

interface Props {
  chantierId: string;
  canManageSteps: boolean;
  canToggleSteps: boolean;
  canViewSteps: boolean;
  canViewComments: boolean;
  readonly?: boolean;
  /** Notifie le parent quand l'utilisateur focus le champ de saisie (ex. masquer les detail au-dessus). */
  onInputFocus?: () => void;
  /** Sous-onglet actif controle par le parent (preserve entre main-tab switches). */
  subTab?: DiscussionSubTab;
  onSubTabChange?: (tab: DiscussionSubTab) => void;
  /**
   * Masque le selecteur Etapes / Messages. Depuis que chacun a son propre onglet
   * de premier niveau, l'afficher ferait doublon : deux commandes cote a cote
   * pour la meme navigation.
   */
  hideToggle?: boolean;
}

export default function ChantierDiscussions({
  chantierId,
  canManageSteps,
  canToggleSteps,
  canViewSteps,
  canViewComments,
  readonly,
  onInputFocus,
  subTab: subTabProp,
  onSubTabChange,
  hideToggle = false,
}: Props) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [openStep, setOpenStep] = useState<ChantierStep | null>(null);
  const initialTab: DiscussionSubTab = canViewSteps ? 'steps' : 'messages';
  // Si le parent fournit subTab, on l'utilise (controlled). Sinon fallback local.
  const [internalSubTab, setInternalSubTab] = useState<DiscussionSubTab>(initialTab);
  const subTab = subTabProp ?? internalSubTab;

  // Pastilles "non lu" par sous-onglet — chaque sous-onglet est marque comme vu
  // independamment, pour qu'on sache d'ou vient une nouvelle notif.
  const { data: unreadCounts } = useUnreadCounts(chantierId);
  const markTabViewed = useMarkTabViewed();
  const unreadMessages = unreadCounts?.comments ?? 0;
  const unreadSteps = unreadCounts?.comments_steps ?? 0;
  const unreadStepIds = useMemo(
    () => new Set(unreadCounts?.unread_step_ids ?? []),
    [unreadCounts?.unread_step_ids],
  );

  // Sous-onglet Messages : on marque comments comme vu (un seul flux, pas de
  // granularité par-item ici). Sous-onglet Étapes : on NE MARQUE PAS comments_steps
  // à l'arrivée — la pastille s'efface uniquement quand on ouvre l'étape concernée
  // (markItemViewed côté handleOpenStep).
  const markItemViewed = useMarkItemViewed();
  useEffect(() => {
    if (!chantierId) return;
    if (subTab === 'messages' && canViewComments) {
      markTabViewed.mutate({ chantier_id: chantierId, tab: 'comments' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chantierId, subTab]);

  const handleOpenStep = (step: ChantierStep) => {
    setOpenStep(step);
    markItemViewed.mutate({ item_type: 'step', item_id: step.id });
  };

  const setSubTab = (tab: DiscussionSubTab) => {
    if (onSubTabChange) onSubTabChange(tab);
    else setInternalSubTab(tab);
  };

  // Tous les commentaires du chantier — sert au compteur par etape ET au compteur "Messages".
  const allComments = useComments(canViewSteps || canViewComments ? chantierId : undefined);

  const commentCountByStep = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of allComments.data?.data ?? []) {
      if (c.step_id) map[c.step_id] = (map[c.step_id] ?? 0) + 1;
    }
    return map;
  }, [allComments.data]);

  const generalCount = useMemo(
    () => (allComments.data?.data ?? []).filter((c) => !c.step_id).length,
    [allComments.data],
  );

  if (!canViewComments && !canViewSteps) {
    return (
      <View style={styles.empty}>
        <Text style={{ color: colors.mutedText }}>{t('discussions.noAccess')}</Text>
      </View>
    );
  }

  const showToggle = !hideToggle && canViewSteps && canViewComments;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {showToggle ? (
        <View style={[styles.toggleBar, { backgroundColor: colors.itemBackground }]}>
          <TouchableOpacity
            style={[
              styles.togglePill,
              subTab === 'steps' && { backgroundColor: colors.surface },
            ]}
            onPress={() => setSubTab('steps')}
            accessibilityRole="tab"
            accessibilityState={{ selected: subTab === 'steps' }}
          >
            <View style={styles.pillIconWrap}>
              <ListChecks size={IconSize.sm} color={subTab === 'steps' ? colors.primary : colors.text2} />
              {subTab !== 'steps' && unreadSteps > 0 ? (
                <View style={[styles.subUnreadBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.subUnreadBadgeText}>
                    {unreadSteps > 99 ? '99+' : unreadSteps}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[
                styles.togglePillText,
                { color: subTab === 'steps' ? colors.primary : colors.text2 },
              ]}
            >
              {t('templates.stepsLabel')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.togglePill,
              subTab === 'messages' && { backgroundColor: colors.surface },
            ]}
            onPress={() => setSubTab('messages')}
            accessibilityRole="tab"
            accessibilityState={{ selected: subTab === 'messages' }}
          >
            <View style={styles.pillIconWrap}>
              <MessageSquare size={IconSize.sm} color={subTab === 'messages' ? colors.primary : colors.text2} />
              {subTab !== 'messages' && unreadMessages > 0 ? (
                <View style={[styles.subUnreadBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.subUnreadBadgeText}>
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[
                styles.togglePillText,
                { color: subTab === 'messages' ? colors.primary : colors.text2 },
              ]}
            >
              {generalCount > 0
                ? t('common.labelWithCount', { label: t('discussions.messages'), count: generalCount })
                : t('discussions.messages')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        {(subTab === 'steps' || !canViewComments) && canViewSteps ? (
          <ChantierSteps
            chantierId={chantierId}
            canManage={canManageSteps}
            canToggle={canToggleSteps}
            readonly={readonly}
            commentCountByStep={commentCountByStep}
            unreadStepIds={unreadStepIds}
            onOpenStepDiscussion={handleOpenStep}
          />
        ) : null}
        {(subTab === 'messages' || !canViewSteps) && canViewComments ? (
          <CommentThread chantierId={chantierId} stepFilter="general" readonly={readonly} onInputFocus={onInputFocus} />
        ) : null}
      </View>

      {/* Modal : discussion par etape.
          Un Modal RN cree un nouveau "root" natif → l'arbre SafeAreaContext de
          expo-router ne se propage pas dedans. Sans un SafeAreaProvider local,
          useSafeAreaInsets() retourne 0 et l'UI se colle sous la status bar
          (X derriere les icones batterie/wifi) et le home indicator (input trop bas).
          On en ajoute un dans le Modal, puis SafeAreaView edges top/bottom applique
          les vrais insets mesures. */}
      <Modal visible={!!openStep} transparent={false} animationType="slide" onRequestClose={() => setOpenStep(null)}>
        <SafeAreaProvider>
          <SafeAreaView
            edges={['top', 'bottom']}
            style={[styles.modalContainer, { backgroundColor: colors.background }]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalSubtitle, { color: colors.mutedText }]}>{t('discussions.stepThread')}</Text>
                <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>
                  {openStep?.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setOpenStep(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel={t('common.close')}
              >
                <X size={IconSize.lg} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              {openStep ? (
                <CommentThread chantierId={chantierId} stepFilter={openStep.id} readonly={readonly} />
              ) : null}
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toggleBar: {
    flexDirection: 'row',
    margin: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: 4,
    borderRadius: Radius.pill,
    gap: 4,
  },
  togglePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  togglePillText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  // Pastille "non lu" sur l'icone du sous-onglet
  pillIconWrap: { position: 'relative' },
  subUnreadBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subUnreadBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: FontWeight.bold },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalSubtitle: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, marginTop: 2 },
});
