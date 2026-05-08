import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { ListChecks, MessageSquare, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useComments } from '@/api/hooks/useComments';
import ChantierSteps from './ChantierSteps';
import CommentThread from './CommentThread';
import type { ChantierStep } from '@/api/hooks/useChantierSteps';

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
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [openStep, setOpenStep] = useState<ChantierStep | null>(null);
  const initialTab: DiscussionSubTab = canViewSteps ? 'steps' : 'messages';
  // Si le parent fournit subTab, on l'utilise (controlled). Sinon fallback local.
  const [internalSubTab, setInternalSubTab] = useState<DiscussionSubTab>(initialTab);
  const subTab = subTabProp ?? internalSubTab;
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
        <Text style={{ color: colors.mutedText }}>Vous n'avez pas accès à cette section.</Text>
      </View>
    );
  }

  const showToggle = canViewSteps && canViewComments;

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
            <ListChecks size={IconSize.sm} color={subTab === 'steps' ? colors.primary : colors.text2} />
            <Text
              style={[
                styles.togglePillText,
                { color: subTab === 'steps' ? colors.primary : colors.text2 },
              ]}
            >
              Étapes
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
            <MessageSquare size={IconSize.sm} color={subTab === 'messages' ? colors.primary : colors.text2} />
            <Text
              style={[
                styles.togglePillText,
                { color: subTab === 'messages' ? colors.primary : colors.text2 },
              ]}
            >
              Messages{generalCount > 0 ? ` (${generalCount})` : ''}
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
            onOpenStepDiscussion={(step) => setOpenStep(step)}
          />
        ) : null}
        {(subTab === 'messages' || !canViewSteps) && canViewComments ? (
          <CommentThread chantierId={chantierId} stepFilter="general" readonly={readonly} onInputFocus={onInputFocus} />
        ) : null}
      </View>

      {/* Modal : discussion par etape */}
      <Modal visible={!!openStep} transparent={false} animationType="slide" onRequestClose={() => setOpenStep(null)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalSubtitle, { color: colors.mutedText }]}>Discussion de l'étape</Text>
              <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>
                {openStep?.name}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setOpenStep(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Fermer"
            >
              <X size={IconSize.lg} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            {openStep ? (
              <CommentThread chantierId={chantierId} stepFilter={openStep.id} readonly={readonly} />
            ) : null}
          </View>
        </View>
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
