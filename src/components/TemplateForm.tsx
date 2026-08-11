import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  FlatList,
  findNodeHandle,
  UIManager,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { Plus, Trash2, ChevronUp, ChevronDown, X, UserPlus, Search } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { useAllUsers } from '@/api/hooks/useMembers';
import type { ChantierStatus, TemplateStepInput } from '@/api/hooks/useChantierTemplates';

export interface TemplateMemberValue {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

export interface TemplateFormValues {
  name: string;
  description: string;
  default_status: ChantierStatus;
  steps: TemplateStepInput[];
  members: TemplateMemberValue[];
}

const ROLE_COLOR: Record<string, string> = {
  admin: '#D97706',
  manager: '#7C3AED',
  employee: '#2563EB',
};

function roleLabel(role: string): string {
  if (role === 'admin') return 'Admin';
  if (role === 'manager') return 'Manager';
  if (role === 'employee') return 'Employé';
  return role;
}

interface Props {
  initial?: Partial<TemplateFormValues>;
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: (values: TemplateFormValues) => void;
}

export default function TemplateForm({ initial, submitting, submitLabel, onSubmit }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();

  const STATUS_OPTIONS: { key: ChantierStatus; label: string }[] = [
    { key: 'a_venir', label: t('chantier.statusUpcoming') },
    { key: 'en_cours', label: t('chantier.statusInProgress') },
    { key: 'termine', label: t('chantier.statusCompleted') },
  ];

  const scrollRef = useRef<ScrollView>(null);

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<ChantierStatus>(initial?.default_status ?? 'a_venir');
  const [steps, setSteps] = useState<TemplateStepInput[]>(initial?.steps ?? []);
  const [members, setMembers] = useState<TemplateMemberValue[]>(initial?.members ?? []);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const animatedPickerStyle = useKeyboardAwareModalStyle({ visible: showPicker });

  const { data: allUsers } = useAllUsers();
  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const eligibleUsers = useMemo(() => {
    const list = allUsers?.data ?? [];
    return list.filter(
      (u) => ['admin', 'manager', 'employee'].includes(u.role) && !memberIds.has(u.id),
    );
  }, [allUsers, memberIds]);
  const filteredUsers = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return eligibleUsers;
    return eligibleUsers.filter((u) =>
      `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(q),
    );
  }, [eligibleUsers, pickerSearch]);

  const addMember = (u: { id: string; first_name: string; last_name: string; email: string; role: string }) => {
    setMembers((prev) => [
      ...prev,
      { user_id: u.id, first_name: u.first_name, last_name: u.last_name, email: u.email, role: u.role },
    ]);
  };
  const removeMember = (userId: string) => setMembers((prev) => prev.filter((m) => m.user_id !== userId));

  /** Au focus d'un input, on scroll pour qu'il reste visible au-dessus du clavier. */
  const scrollToInput = (event: { target: number }) => {
    const target = event.target;
    const node = findNodeHandle(scrollRef.current);
    if (!node) return;
    UIManager.measureLayout?.(
      target,
      node,
      () => {},
      (_x, y, _w, h) => {
        // y = position relative au scrollview ; on ajoute la hauteur de l'input pour s'assurer qu'il reste visible.
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 80), animated: true });
        // Reference h pour ESLint
        void h;
      },
    );
  };

  const addStep = () => setSteps((prev) => [...prev, { name: '', substeps: [] }]);
  const updateStepName = (idx: number, val: string) =>
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, name: val } : s)));
  const removeStep = (idx: number) => setSteps((prev) => prev.filter((_, i) => i !== idx));
  const moveStep = (idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    if (to < 0 || to >= steps.length) return;
    setSteps((prev) => {
      const next = [...prev];
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });
  };

  const addSubstep = (stepIdx: number) =>
    setSteps((prev) =>
      prev.map((s, i) => (i === stepIdx ? { ...s, substeps: [...(s.substeps ?? []), { name: '' }] } : s)),
    );
  const updateSubstepName = (stepIdx: number, subIdx: number, val: string) =>
    setSteps((prev) =>
      prev.map((s, i) =>
        i === stepIdx
          ? { ...s, substeps: (s.substeps ?? []).map((sub, j) => (j === subIdx ? { ...sub, name: val } : sub)) }
          : s,
      ),
    );
  const removeSubstep = (stepIdx: number, subIdx: number) =>
    setSteps((prev) =>
      prev.map((s, i) =>
        i === stepIdx ? { ...s, substeps: (s.substeps ?? []).filter((_, j) => j !== subIdx) } : s,
      ),
    );

  const canSubmit = name.trim().length > 0 && !submitting;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <Text style={[styles.label, { color: colors.text2 }]}>{t('templates.nameLabel')} *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
        value={name}
        onChangeText={setName}
        placeholder={t('templates.namePlaceholder')}
        placeholderTextColor={colors.placeholder}
      />

      <Text style={[styles.label, { color: colors.text2 }]}>{t('chantier.description')}</Text>
      <TextInput
        style={[
          styles.input,
          styles.textarea,
          { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border },
        ]}
        value={description}
        onChangeText={setDescription}
        placeholder={t('templates.descriptionPlaceholder')}
        placeholderTextColor={colors.placeholder}
        multiline
      />

      <Text style={[styles.label, { color: colors.text2 }]}>{t('templates.defaultStatus')}</Text>
      <View style={styles.statusRow}>
        {STATUS_OPTIONS.map((opt) => {
          const isActive = status === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.statusOption,
                {
                  backgroundColor: isActive ? colors.primary + '20' : colors.itemBackground,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setStatus(opt.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.statusText, { color: isActive ? colors.primary : colors.text2 }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.text2, marginTop: Spacing.xl }]}>{t('templates.stepsLabel')}</Text>
      {steps.map((step, idx) => (
        <View
          key={idx}
          style={[styles.stepCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.stepHeader}>
            <Text style={[styles.stepNumber, { color: colors.primary }]}>{idx + 1}.</Text>
            <TextInput
              style={[styles.stepInput, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={step.name}
              onChangeText={(v) => updateStepName(idx, v)}
              onFocus={(e) => scrollToInput(e.nativeEvent as unknown as { target: number })}
              placeholder={t('templates.stepNamePlaceholder')}
              placeholderTextColor={colors.placeholder}
            />
            <View style={styles.stepActions}>
              <TouchableOpacity
                onPress={() => moveStep(idx, -1)}
                disabled={idx === 0}
                style={[styles.iconBtn, { opacity: idx === 0 ? 0.3 : 1 }]}
              >
                <ChevronUp size={IconSize.sm} color={colors.mutedText} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => moveStep(idx, 1)}
                disabled={idx === steps.length - 1}
                style={[styles.iconBtn, { opacity: idx === steps.length - 1 ? 0.3 : 1 }]}
              >
                <ChevronDown size={IconSize.sm} color={colors.mutedText} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeStep(idx)} style={styles.iconBtn}>
                <Trash2 size={IconSize.sm} color={colors.red} />
              </TouchableOpacity>
            </View>
          </View>

          {(step.substeps ?? []).map((sub, j) => (
            <View key={j} style={styles.substepRow}>
              <Text style={[styles.bullet, { color: colors.mutedText }]}>•</Text>
              <TextInput
                style={[
                  styles.substepInput,
                  { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border },
                ]}
                value={sub.name}
                onChangeText={(v) => updateSubstepName(idx, j, v)}
                onFocus={(e) => scrollToInput(e.nativeEvent as unknown as { target: number })}
                placeholder={t('templates.substepNamePlaceholder')}
                placeholderTextColor={colors.placeholder}
              />
              <TouchableOpacity onPress={() => removeSubstep(idx, j)} style={styles.iconBtn}>
                <Trash2 size={14} color={colors.red} />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.addSubstepBtn, { borderColor: colors.border }]}
            onPress={() => addSubstep(idx)}
          >
            <Plus size={14} color={colors.primary} />
            <Text style={[styles.addSubstepText, { color: colors.primary }]}>{t('templates.addSubstep')}</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.addStepBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}
        onPress={addStep}
      >
        <Plus size={IconSize.md} color={colors.primary} />
        <Text style={[styles.addStepText, { color: colors.primary }]}>{t('templates.addStep')}</Text>
      </TouchableOpacity>

      <Text style={[styles.label, { color: colors.text2, marginTop: Spacing.xl }]}>{t('collab.title')}</Text>
      {members.length === 0 ? (
        <Text style={[styles.teamEmpty, { color: colors.mutedText }]}>{t('team.empty')}</Text>
      ) : (
        members.map((m) => {
          const color = ROLE_COLOR[m.role] ?? colors.mutedText;
          return (
            <View
              key={m.user_id}
              style={[styles.memberRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.memberAvatar, { backgroundColor: color + '20' }]}>
                <Text style={[styles.memberAvatarText, { color }]}>
                  {m.first_name[0]}
                  {m.last_name[0]}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                  {m.first_name} {m.last_name}
                </Text>
                <Text style={[styles.memberMeta, { color: colors.mutedText }]} numberOfLines={1}>
                  {roleLabel(m.role)} • {m.email}
                </Text>
              </View>
              <TouchableOpacity onPress={() => removeMember(m.user_id)} style={styles.iconBtn}>
                <Trash2 size={IconSize.sm} color={colors.red} />
              </TouchableOpacity>
            </View>
          );
        })
      )}

      <TouchableOpacity
        style={[styles.addStepBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '15' }]}
        onPress={() => {
          setPickerSearch('');
          setShowPicker(true);
        }}
      >
        <UserPlus size={IconSize.md} color={colors.primary} />
        <Text style={[styles.addStepText, { color: colors.primary }]}>{t('team.add')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.submit,
          { backgroundColor: canSubmit ? colors.primary : colors.itemBackground, marginTop: Spacing.xl },
        ]}
        onPress={() =>
          onSubmit({
            name: name.trim(),
            description: description.trim(),
            default_status: status,
            members,
            steps: steps
              .filter((s) => s.name.trim().length > 0)
              .map((s) => ({
                name: s.name.trim(),
                substeps: (s.substeps ?? []).filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim() })),
              })),
          })
        }
        disabled={!canSubmit}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={[styles.submitText, { color: canSubmit ? '#FFFFFF' : colors.mutedText }]}>{submitLabel ?? t('common.save')}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>

    <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
      <Pressable style={pickerStyles.overlay} onPress={() => setShowPicker(false)}>
        <Animated.View
          style={[pickerStyles.sheet, { backgroundColor: colors.surface }, Shadow.lg, animatedPickerStyle]}
          onStartShouldSetResponder={() => true}
        >
          <View style={pickerStyles.header}>
            <Text style={[pickerStyles.title, { color: colors.text }]}>{t('team.add')}</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={IconSize.lg} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={[pickerStyles.searchBox, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}>
            <Search size={16} color={colors.placeholder} />
            <TextInput
              style={[pickerStyles.searchInput, { color: colors.text }]}
              placeholder={t('common.search')}
              placeholderTextColor={colors.placeholder}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              autoFocus
            />
          </View>

          <FlatList
            data={filteredUsers}
            keyExtractor={(u) => u.id}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            contentContainerStyle={{ paddingBottom: Spacing.xxxl }}
            ListEmptyComponent={
              <Text style={[pickerStyles.empty, { color: colors.mutedText }]}>
                {t('collab.empty')}
              </Text>
            }
            renderItem={({ item }) => {
              const color = ROLE_COLOR[item.role] ?? colors.mutedText;
              return (
                <TouchableOpacity
                  style={[pickerStyles.userRow, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}
                  onPress={() => {
                    addMember(item);
                  }}
                >
                  <View style={[pickerStyles.avatar, { backgroundColor: color + '20' }]}>
                    <Text style={[pickerStyles.avatarText, { color }]}>
                      {item.first_name[0]}
                      {item.last_name[0]}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[pickerStyles.userName, { color: colors.text }]} numberOfLines={1}>
                      {item.first_name} {item.last_name}
                    </Text>
                    <Text style={[pickerStyles.userMeta, { color: colors.mutedText }]} numberOfLines={1}>
                      {roleLabel(item.role)} • {item.email}
                    </Text>
                  </View>
                  <Plus size={IconSize.md} color={colors.primary} />
                </TouchableOpacity>
              );
            }}
          />
        </Animated.View>
      </Pressable>
    </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.sm },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginTop: Spacing.md },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.base,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  statusRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  statusOption: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  statusText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  stepCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  stepNumber: { fontSize: FontSize.base, fontWeight: FontWeight.bold, minWidth: 22 },
  stepInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.base,
  },
  stepActions: { flexDirection: 'row', gap: 2 },
  iconBtn: { padding: Spacing.xs },

  substepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingLeft: Spacing.sm },
  bullet: { fontSize: 18, width: 14 },
  substepInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    fontSize: FontSize.sm,
  },

  addSubstepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignSelf: 'flex-start',
  },
  addSubstepText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },

  addStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 48,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  addStepText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },

  submit: {
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },

  teamEmpty: { fontSize: FontSize.sm, fontStyle: 'italic', marginTop: Spacing.xs },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  memberInfo: { flex: 1 },
  memberName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  memberMeta: { fontSize: FontSize.xs, marginTop: 2 },
});

const pickerStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { padding: Spacing.lg, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, height: 40, fontSize: FontSize.base },
  empty: { textAlign: 'center', padding: Spacing.xl, fontStyle: 'italic' },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  userName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  userMeta: { fontSize: FontSize.xs, marginTop: 2 },
});
