import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import DraggableFlatList, {
  NestableDraggableFlatList,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GripVertical,
  ListOrdered,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  X,
  Check,
  MessageSquarePlus,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  useChantierSteps,
  useCreateStep,
  useCreateSubstep,
  useDeleteStep,
  useDeleteSubstep,
  useReorderSteps,
  useReorderSubsteps,
  useToggleStep,
  useToggleSubstep,
  useUpdateStep,
  useUpdateSubstep,
  ChantierStep,
  ChantierSubstep,
} from '@/api/hooks/useChantierSteps';
import { useTranslation } from '@/contexts/I18nContext';

interface Props {
  chantierId: string;
  canManage: boolean;
  canToggle: boolean;
  readonly?: boolean;
  /** Compteur de messages par step_id pour afficher un badge sur chaque etape. */
  commentCountByStep?: Record<string, number>;
  /** Set des step_id qui ont du contenu non-lu (pour pastille visuelle). */
  unreadStepIds?: Set<string>;
  /** Callback declenche au tap du bouton "Discussion" dans une etape depliee. */
  onOpenStepDiscussion?: (step: ChantierStep) => void;
  /**
   * Mode "inline" : utilise NestableDraggableFlatList pour pouvoir s'integrer
   * dans un NestableScrollContainer parent. Le drag-drop est preserve.
   */
  inline?: boolean;
  /** Appele apres chaque reorder par drag-drop (utile pour reveiller le scroll parent). */
  onAfterReorder?: () => void;
}

export default function ChantierSteps({
  chantierId,
  canManage,
  canToggle,
  readonly = false,
  commentCountByStep,
  unreadStepIds,
  onOpenStepDiscussion,
  inline = false,
  onAfterReorder,
}: Props) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const { data: steps, isLoading, refetch, isRefetching } = useChantierSteps(chantierId);

  // Local mirror of steps for instant drag-drop reordering. Synced from server when not actively reordering.
  const [orderedSteps, setOrderedSteps] = useState<ChantierStep[]>([]);
  const createStep = useCreateStep(chantierId);
  const updateStep = useUpdateStep(chantierId);
  const deleteStep = useDeleteStep(chantierId);
  const reorderSteps = useReorderSteps(chantierId);
  const createSubstep = useCreateSubstep(chantierId);
  const updateSubstep = useUpdateSubstep(chantierId);
  const deleteSubstep = useDeleteSubstep(chantierId);
  const reorderSubsteps = useReorderSubsteps(chantierId);
  const toggleSubstep = useToggleSubstep(chantierId);
  const toggleStep = useToggleStep(chantierId);

  useEffect(() => {
    if (!steps) return;
    if (reorderSteps.isPending) return;
    setOrderedSteps(steps);
  }, [steps, reorderSteps.isPending]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editingStep, setEditingStep] = useState<ChantierStep | null>(null);
  const [editingSubstep, setEditingSubstep] = useState<ChantierSubstep | null>(null);
  const [addingStep, setAddingStep] = useState(false);
  const [addingSubstepFor, setAddingSubstepFor] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [commentTarget, setCommentTarget] = useState<
    | { kind: 'step'; item: ChantierStep }
    | { kind: 'substep'; item: ChantierSubstep }
    | null
  >(null);
  const [draftComment, setDraftComment] = useState('');
  const animatedStepModalStyle = useKeyboardAwareModalStyle({
    visible: addingStep || !!editingStep || !!addingSubstepFor || !!editingSubstep,
  });
  const animatedCommentModalStyle = useKeyboardAwareModalStyle({ visible: !!commentTarget });
  const [reorderModalOpen, setReorderModalOpen] = useState(false);

  const isManager = canManage && !readonly;
  const canCheck = canToggle && !readonly;

  const toggleCollapse = (stepId: string) => {
    setCollapsed((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const submitNewStep = async () => {
    const name = draftName.trim();
    if (!name) return;
    await createStep.mutateAsync(name);
    setDraftName('');
    setAddingStep(false);
  };

  const submitRenameStep = async () => {
    if (!editingStep) return;
    const name = draftName.trim();
    if (!name) return;
    await updateStep.mutateAsync({ id: editingStep.id, name });
    setEditingStep(null);
    setDraftName('');
  };

  const submitNewSubstep = async () => {
    if (!addingSubstepFor) return;
    const name = draftName.trim();
    if (!name) return;
    await createSubstep.mutateAsync({ stepId: addingSubstepFor, name });
    setDraftName('');
    setAddingSubstepFor(null);
  };

  const submitRenameSubstep = async () => {
    if (!editingSubstep) return;
    const name = draftName.trim();
    if (!name) return;
    await updateSubstep.mutateAsync({ id: editingSubstep.id, name });
    setEditingSubstep(null);
    setDraftName('');
  };

  const confirmDeleteStep = (step: ChantierStep) => {
    Alert.alert(
      t('steps.confirmDeleteStep'),
      t('steps.deleteStepBody', { name: step.name, count: step.substeps.length }),
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteStep.mutate(step.id) },
      ],
    );
  };

  const confirmDeleteSubstep = (sub: ChantierSubstep) => {
    Alert.alert(t('steps.confirmDeleteSubstep'), t('steps.deleteSubstepBody', { name: sub.name }), [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteSubstep.mutate(sub.id) },
    ]);
  };

  const onCheckSubstep = useCallback(
    (sub: ChantierSubstep) => {
      if (!canCheck) return;
      const validating = !sub.validated_at;
      if (validating) {
        setCommentTarget({ kind: 'substep', item: sub });
        setDraftComment(sub.validation_comment ?? '');
      } else {
        toggleSubstep.mutate({ id: sub.id, validated: false, validation_comment: null });
      }
    },
    [canCheck, toggleSubstep],
  );

  const onCheckStep = useCallback(
    (step: ChantierStep) => {
      if (!canCheck) return;
      const validating = !step.validated_at;
      if (validating) {
        setCommentTarget({ kind: 'step', item: step });
        setDraftComment(step.validation_comment ?? '');
      } else {
        toggleStep.mutate({ id: step.id, validated: false, validation_comment: null });
      }
    },
    [canCheck, toggleStep],
  );

  const submitValidateWithComment = async (skipComment = false) => {
    if (!commentTarget) return;
    const comment = skipComment ? null : draftComment.trim() || null;
    if (commentTarget.kind === 'substep') {
      await toggleSubstep.mutateAsync({ id: commentTarget.item.id, validated: true, validation_comment: comment });
    } else {
      await toggleStep.mutateAsync({ id: commentTarget.item.id, validated: true, validation_comment: comment });
    }
    setCommentTarget(null);
    setDraftComment('');
  };

  const moveSubstep = (step: ChantierStep, fromIdx: number, dir: -1 | 1) => {
    const toIdx = fromIdx + dir;
    if (toIdx < 0 || toIdx >= step.substeps.length) return;
    const ids = step.substeps.map((s) => s.id);
    [ids[fromIdx], ids[toIdx]] = [ids[toIdx], ids[fromIdx]];
    reorderSubsteps.mutate({ stepId: step.id, orderedIds: ids });
  };


  const renderSubstepRow = (item: ChantierSubstep, idx: number, step: ChantierStep) => {
    const checked = !!item.validated_at;
    const isFirst = idx === 0;
    const isLast = idx === step.substeps.length - 1;
    return (
      <View key={item.id} style={[styles.substepRow, { borderColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => onCheckSubstep(item)}
          disabled={!canCheck}
          style={[
            styles.checkbox,
            {
              borderColor: checked ? colors.green : colors.border,
              backgroundColor: checked ? colors.green : 'transparent',
              opacity: canCheck ? 1 : 0.5,
            },
          ]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
        >
          {checked ? <Check size={14} color="#FFFFFF" /> : null}
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.substepName,
              { color: colors.text, textDecorationLine: checked ? 'line-through' : 'none', opacity: checked ? 0.6 : 1 },
            ]}
          >
            {item.name}
          </Text>
          {item.validation_comment ? (
            <Text style={[styles.substepComment, { color: colors.mutedText }]}>{item.validation_comment}</Text>
          ) : null}
        </View>

        {isManager ? (
          <View style={styles.rowActions}>
            <TouchableOpacity
              onPress={() => moveSubstep(step, idx, -1)}
              disabled={isFirst}
              style={[styles.iconBtn, { opacity: isFirst ? 0.3 : 1 }]}
              accessibilityLabel={t('steps.moveSubstepUp')}
            >
              <ChevronUp size={16} color={colors.mutedText} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => moveSubstep(step, idx, 1)}
              disabled={isLast}
              style={[styles.iconBtn, { opacity: isLast ? 0.3 : 1 }]}
              accessibilityLabel={t('steps.moveSubstepDown')}
            >
              <ChevronDown size={16} color={colors.mutedText} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setEditingSubstep(item);
                setDraftName(item.name);
              }}
              style={styles.iconBtn}
              accessibilityLabel={t('steps.renameSubstep')}
            >
              <Pencil size={14} color={colors.mutedText} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => confirmDeleteSubstep(item)}
              style={styles.iconBtn}
              accessibilityLabel={t('steps.deleteSubstep')}
            >
              <Trash2 size={14} color={colors.red} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  const renderStep = useCallback(
    (params: RenderItemParams<ChantierStep>) => {
      const { item: step, drag, isActive, getIndex } = params;
      const isCollapsed = !!collapsed[step.id];
      const validatedCount = step.substeps.filter((s) => s.validated_at).length;
      const idx = getIndex?.() ?? 0;
      const total = orderedSteps.length;
      const isFirst = idx === 0;
      const isLast = idx === total - 1;

      // Keep identical layout (size, margins, corners) between drag and rest to avoid any
      // re-flow when the item is dropped. Only change visual feedback (background, shadow).
      const mergedStyle = {
        backgroundColor: isActive ? colors.itemBackground : colors.surface,
        borderColor: colors.border,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderTopWidth: isFirst ? 1 : StyleSheet.hairlineWidth,
        borderBottomWidth: isLast ? 1 : 0,
        borderTopLeftRadius: isFirst ? Radius.lg : 0,
        borderTopRightRadius: isFirst ? Radius.lg : 0,
        borderBottomLeftRadius: isLast ? Radius.lg : 0,
        borderBottomRightRadius: isLast ? Radius.lg : 0,
        ...(isActive
          ? {
              elevation: 8,
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              zIndex: 10,
            }
          : {}),
      };

      const stepValidated = !!step.validated_at;

      return (
        <View
          style={[
            styles.stepBlock,
            mergedStyle,
            stepValidated && !isActive
              ? { backgroundColor: colors.itemBackground, opacity: 0.7 }
              : null,
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.stepHeader}
            onPress={() => toggleCollapse(step.id)}
            onLongPress={
              isManager
                ? inline
                  ? () => setReorderModalOpen(true)
                  : drag
                : undefined
            }
            delayLongPress={300}
            disabled={isActive}
          >
            <TouchableOpacity
              onPress={() => onCheckStep(step)}
              disabled={!canCheck}
              style={[
                styles.checkbox,
                {
                  borderColor: stepValidated ? colors.green : colors.border,
                  backgroundColor: stepValidated ? colors.green : 'transparent',
                  opacity: canCheck ? 1 : 0.5,
                },
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: stepValidated }}
              accessibilityLabel={`Valider l'étape ${step.name}`}
            >
              {stepValidated ? <Check size={14} color="#FFFFFF" /> : null}
            </TouchableOpacity>

            {isCollapsed ? (
              <ChevronRight size={IconSize.sm} color={colors.text2} />
            ) : (
              <ChevronDown size={IconSize.sm} color={colors.text2} />
            )}
            <View style={[styles.stepNumber, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
              <Text style={[styles.stepNumberText, { color: colors.primary }]}>{idx + 1}</Text>
            </View>
            {unreadStepIds?.has(step.id) ? (
              <View
                style={[styles.unreadDot, { backgroundColor: colors.primary }]}
                accessibilityLabel={t('steps.newMessages')}
              />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.stepName,
                  {
                    color: colors.text,
                    textDecorationLine: stepValidated ? 'line-through' : 'none',
                    opacity: stepValidated ? 0.6 : 1,
                  },
                ]}
              >
                {step.name}
              </Text>
              {step.validation_comment ? (
                <Text style={[styles.substepComment, { color: colors.mutedText }]}>{step.validation_comment}</Text>
              ) : null}
            </View>
            <Text style={[styles.stepCount, { color: colors.mutedText }]}>
              {validatedCount}/{step.substeps.length}
            </Text>

            {isManager ? (
              <View style={styles.rowActions}>
                <TouchableOpacity
                  onPress={() => {
                    setEditingStep(step);
                    setDraftName(step.name);
                  }}
                  style={styles.iconBtn}
                >
                  <Pencil size={IconSize.sm} color={colors.mutedText} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDeleteStep(step)} style={styles.iconBtn}>
                  <Trash2 size={IconSize.sm} color={colors.red} />
                </TouchableOpacity>
              </View>
            ) : null}
          </TouchableOpacity>

          {!isCollapsed ? (
            <View style={styles.substepsBlock}>
              {step.substeps.length > 0 ? (
                step.substeps.map((sub, idx) => renderSubstepRow(sub, idx, step))
              ) : (
                <Text style={[styles.emptySubsteps, { color: colors.mutedText }]}>{t('steps.noSubstep')}</Text>
              )}

              {onOpenStepDiscussion ? (
                <TouchableOpacity
                  style={[styles.discussionBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}
                  onPress={() => onOpenStepDiscussion(step)}
                  accessibilityRole="button"
                  accessibilityLabel={t('steps.openDiscussion')}
                >
                  <MessageCircle size={14} color={colors.primary} />
                  <Text style={[styles.discussionBtnText, { color: colors.primary }]}>
                    Discussion {commentCountByStep?.[step.id] ? `(${commentCountByStep[step.id]})` : ''}
                  </Text>
                </TouchableOpacity>
              ) : null}

              {isManager ? (
                <TouchableOpacity
                  style={[styles.addSubstepBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    setAddingSubstepFor(step.id);
                    setDraftName('');
                  }}
                >
                  <Plus size={14} color={colors.primary} />
                  <Text style={[styles.addSubstepText, { color: colors.primary }]}>{t('steps.addSubstep')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collapsed, colors, isManager, canCheck, orderedSteps.length, onCheckStep, onOpenStepDiscussion, commentCountByStep, inline],
  );

  if (isLoading) {
    return <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.lg }} />;
  }

  const ListFooter = isManager ? (
    <TouchableOpacity
      style={[styles.addStepBtn, { backgroundColor: colors.primary }]}
      onPress={() => {
        setAddingStep(true);
        setDraftName('');
      }}
    >
      <Plus size={IconSize.md} color="#FFFFFF" />
      <Text style={styles.addStepText}>{t('templates.addStep')}</Text>
    </TouchableOpacity>
  ) : null;

  // Mode inline : pas de drag-drop direct (les libs nested ont trop de bugs avec le scroll
  // parent). Reorder via la modal "Réorganiser" qui isole un DraggableFlatList plein ecran.
  if (inline) {
    return (
      <View>
        <View style={[styles.scroll, { paddingBottom: 0 }]}>
          {isManager && orderedSteps.length > 1 ? (
            <TouchableOpacity
              style={[styles.reorderTrigger, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setReorderModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('steps.reorder')}
            >
              <ListOrdered size={IconSize.sm} color={colors.primary} />
              <Text style={[styles.reorderTriggerText, { color: colors.primary }]}>{t('steps.reorder')}</Text>
            </TouchableOpacity>
          ) : null}
          {orderedSteps.length > 0 ? (
            orderedSteps.map((step, idx) => (
              <View key={step.id}>
                {renderStep({ item: step, drag: () => {}, isActive: false, getIndex: () => idx } as never)}
              </View>
            ))
          ) : (
            <View
              style={[
                styles.stepBlock,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: Radius.lg,
                },
              ]}
            >
              <Text style={[styles.empty, { color: colors.mutedText }]}>
                Aucune étape pour ce chantier{isManager ? '. Ajoutes-en une ci-dessous.' : '.'}
              </Text>
            </View>
          )}
          {ListFooter}
        </View>

        {/* Modal — add/rename step or substep */}
        <Modal
          visible={addingStep || !!editingStep || !!addingSubstepFor || !!editingSubstep}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setAddingStep(false);
            setEditingStep(null);
            setAddingSubstepFor(null);
            setEditingSubstep(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <Animated.View style={[styles.modal, { backgroundColor: colors.surface }, animatedStepModalStyle]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {addingStep
                    ? t('steps.newStep')
                    : editingStep
                    ? t('steps.renameStep')
                    : addingSubstepFor
                    ? t('steps.newSubstep')
                    : t('steps.renameSubstep')}
                </Text>
                <TouchableOpacity
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPress={() => {
                    setAddingStep(false);
                    setEditingStep(null);
                    setAddingSubstepFor(null);
                    setEditingSubstep(null);
                    setDraftName('');
                  }}
                >
                  <X size={IconSize.md} color={colors.text2} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                value={draftName}
                onChangeText={setDraftName}
                placeholder={t('common.name')}
                placeholderTextColor={colors.placeholder}
                autoFocus
                onSubmitEditing={() => {
                  if (addingStep) submitNewStep();
                  else if (editingStep) submitRenameStep();
                  else if (addingSubstepFor) submitNewSubstep();
                  else if (editingSubstep) submitRenameSubstep();
                }}
              />

              <TouchableOpacity
                style={[styles.modalSave, { backgroundColor: colors.primary }]}
                onPress={() => {
                  if (addingStep) submitNewStep();
                  else if (editingStep) submitRenameStep();
                  else if (addingSubstepFor) submitNewSubstep();
                  else if (editingSubstep) submitRenameSubstep();
                }}
                disabled={!draftName.trim()}
              >
                <Text style={styles.modalSaveText}>{t('common.validate')}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>

        {/* Modal — optional comment when validating */}
        <Modal
          visible={!!commentTarget}
          transparent
          animationType="fade"
          onRequestClose={() => setCommentTarget(null)}
        >
          <View style={styles.modalOverlay}>
            <Animated.View style={[styles.modal, { backgroundColor: colors.surface }, animatedCommentModalStyle]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {commentTarget?.kind === 'step' ? t('steps.validateStep') : t('steps.validateSubstep')}
                </Text>
                <TouchableOpacity
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPress={() => {
                    setCommentTarget(null);
                    setDraftComment('');
                  }}
                >
                  <X size={IconSize.md} color={colors.text2} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalLabel, { color: colors.text2 }]}>{commentTarget?.item.name}</Text>

              <View style={styles.commentLabelRow}>
                <MessageSquarePlus size={14} color={colors.mutedText} />
                <Text style={[styles.modalLabel, { color: colors.mutedText, marginTop: 0 }]}>{t('steps.commentOptional')}</Text>
              </View>
              <TextInput
                style={[styles.commentInput, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                value={draftComment}
                onChangeText={setDraftComment}
                placeholder={t('steps.commentExample')}
                placeholderTextColor={colors.placeholder}
                multiline
                numberOfLines={3}
              />

              <View style={styles.commentActions}>
                <TouchableOpacity
                  style={[styles.modalSecondary, { borderColor: colors.border }]}
                  onPress={() => submitValidateWithComment(true)}
                >
                  <Text style={[styles.modalSecondaryText, { color: colors.text }]}>{t('steps.noComment')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSave, { backgroundColor: colors.green, flex: 1 }]}
                  onPress={() => submitValidateWithComment(false)}
                >
                  <Check size={IconSize.sm} color="#FFFFFF" />
                  <Text style={styles.modalSaveText}>{t('common.validate')}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </Modal>

        {/* Modal Reorder : drag-drop isole du scroll parent */}
        <Modal
          visible={reorderModalOpen}
          animationType="slide"
          onRequestClose={() => setReorderModalOpen(false)}
        >
          <View style={[styles.reorderContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.reorderHeader, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={[styles.reorderTitle, { color: colors.text }]}>{t('steps.reorder')}</Text>
              <TouchableOpacity
                onPress={() => setReorderModalOpen(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel={t('common.close')}
              >
                <Text style={[styles.reorderDone, { color: colors.primary }]}>{t('common.done')}</Text>
              </TouchableOpacity>
            </View>
            <DraggableFlatList
              data={orderedSteps}
              keyExtractor={(s) => s.id}
              onDragEnd={({ data }) => {
                setOrderedSteps(data);
                if (isManager) reorderSteps.mutate(data.map((s) => s.id));
              }}
              activationDistance={8}
              contentContainerStyle={{ padding: Spacing.lg }}
              animationConfig={{ damping: 40, stiffness: 1100, mass: 0.25, overshootClamping: true }}
              renderItem={({ item, drag, isActive, getIndex }) => {
                const i = getIndex?.() ?? 0;
                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onLongPress={drag}
                    delayLongPress={150}
                    disabled={isActive}
                    style={[
                      styles.reorderRow,
                      {
                        backgroundColor: isActive ? colors.itemBackground : colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <GripVertical size={IconSize.md} color={colors.mutedText} />
                    <View style={[styles.stepNumber, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                      <Text style={[styles.stepNumberText, { color: colors.primary }]}>{i + 1}</Text>
                    </View>
                    <Text style={[styles.reorderName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {orderedSteps.length > 0 ? (
        <DraggableFlatList
          data={orderedSteps}
          keyExtractor={(s) => s.id}
          renderItem={renderStep}
          onDragEnd={({ data }) => {
            // 1. Update local state synchronously so the lib's render matches the new order immediately
            setOrderedSteps(data);
            // 2. Persist to API in background (cache update inside onMutate keeps query in sync)
            if (!isManager) return;
            reorderSteps.mutate(data.map((s) => s.id));
          }}
          activationDistance={isManager ? 8 : 999999}
          contentContainerStyle={styles.scroll}
          ListFooterComponent={ListFooter}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          // Snap quasi instantane (~50ms) tout en preservant les animations de
          // glissement des cellules voisines pendant le drag.
          animationConfig={{
            damping: 40,
            stiffness: 1100,
            mass: 0.25,
            overshootClamping: true,
          }}
        />
      ) : (
        <View style={styles.scroll}>
          <View
            style={[
              styles.stepBlock,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: Radius.lg,
              },
            ]}
          >
            <Text style={[styles.empty, { color: colors.mutedText }]}>
              Aucune étape pour ce chantier{isManager ? '. Ajoutes-en une ci-dessous.' : '.'}
            </Text>
          </View>
          {ListFooter}
        </View>
      )}

      {/* Modal — add/rename step or substep */}
      <Modal
        visible={addingStep || !!editingStep || !!addingSubstepFor || !!editingSubstep}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setAddingStep(false);
          setEditingStep(null);
          setAddingSubstepFor(null);
          setEditingSubstep(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modal, { backgroundColor: colors.surface }, animatedStepModalStyle]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {addingStep
                  ? t('steps.newStep')
                  : editingStep
                  ? t('steps.renameStep')
                  : addingSubstepFor
                  ? t('steps.newSubstep')
                  : t('steps.renameSubstep')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setAddingStep(false);
                  setEditingStep(null);
                  setAddingSubstepFor(null);
                  setEditingSubstep(null);
                  setDraftName('');
                }}
              >
                <X size={IconSize.md} color={colors.text2} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={draftName}
              onChangeText={setDraftName}
              placeholder={t('common.name')}
              placeholderTextColor={colors.placeholder}
              autoFocus
              onSubmitEditing={() => {
                if (addingStep) submitNewStep();
                else if (editingStep) submitRenameStep();
                else if (addingSubstepFor) submitNewSubstep();
                else if (editingSubstep) submitRenameSubstep();
              }}
            />

            <TouchableOpacity
              style={[styles.modalSave, { backgroundColor: colors.primary }]}
              onPress={() => {
                if (addingStep) submitNewStep();
                else if (editingStep) submitRenameStep();
                else if (addingSubstepFor) submitNewSubstep();
                else if (editingSubstep) submitRenameSubstep();
              }}
              disabled={!draftName.trim()}
            >
              <Text style={styles.modalSaveText}>{t('common.validate')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal — optional comment when validating */}
      <Modal
        visible={!!commentTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setCommentTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modal, { backgroundColor: colors.surface }, animatedCommentModalStyle]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {commentTarget?.kind === 'step' ? t('steps.validateStep') : t('steps.validateSubstep')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCommentTarget(null);
                  setDraftComment('');
                }}
              >
                <X size={IconSize.md} color={colors.text2} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, { color: colors.text2 }]}>{commentTarget?.item.name}</Text>

            <View style={styles.commentLabelRow}>
              <MessageSquarePlus size={14} color={colors.mutedText} />
              <Text style={[styles.modalLabel, { color: colors.mutedText, marginTop: 0 }]}>{t('steps.commentOptional')}</Text>
            </View>
            <TextInput
              style={[styles.commentInput, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={draftComment}
              onChangeText={setDraftComment}
              placeholder={t('steps.commentExample')}
              placeholderTextColor={colors.placeholder}
              multiline
              numberOfLines={3}
            />

            <View style={styles.commentActions}>
              <TouchableOpacity
                style={[styles.modalSecondary, { borderColor: colors.border }]}
                onPress={() => submitValidateWithComment(true)}
              >
                <Text style={[styles.modalSecondaryText, { color: colors.text }]}>{t('steps.noComment')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, { backgroundColor: colors.green, flex: 1 }]}
                onPress={() => submitValidateWithComment(false)}
              >
                <Check size={IconSize.sm} color="#FFFFFF" />
                <Text style={styles.modalSaveText}>{t('common.validate')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl * 2, gap: Spacing.md, flexGrow: 1 },
  empty: { textAlign: 'center', fontSize: FontSize.sm, paddingVertical: Spacing.lg, fontStyle: 'italic' },
  emptySubsteps: { fontSize: FontSize.xs, fontStyle: 'italic', paddingVertical: Spacing.sm, paddingLeft: Spacing.xs },

  stepBlock: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  stepNumber: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  stepNumberText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 2,
  },
  stepName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, flex: 1 },
  stepCount: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  substepsBlock: { marginTop: Spacing.sm, gap: 2 },

  substepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radius.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  substepName: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  substepComment: { fontSize: FontSize.xs, marginTop: 2, fontStyle: 'italic' },

  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { padding: Spacing.xs, borderRadius: Radius.sm },

  discussionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
  discussionBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  addSubstepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
  addSubstepText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  addStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  addStepText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  modal: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  modalLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginTop: Spacing.xs },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.base,
  },
  commentLabelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
  commentInput: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.base,
    textAlignVertical: 'top',
  },
  commentActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  modalSave: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    height: 44,
    borderRadius: Radius.md,
  },
  modalSaveText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  modalSecondary: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  reorderTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  reorderTriggerText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  reorderContainer: { flex: 1 },
  reorderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  reorderTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  reorderDone: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  reorderName: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.medium },
});
