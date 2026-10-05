import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { Flag, X, Check } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { useCreateReport, REPORT_REASONS, type ReportReason, type ReportTarget } from '@/api/hooks/useReports';
import type { TranslationKeys } from '@/i18n/translations';

export interface ReportTargetRef {
  type: ReportTarget;
  id: string;
  /** Ce qu'on signale, rappele en haut de la fenetre. */
  label: string;
}

interface Props {
  target: ReportTargetRef | null;
  onClose: () => void;
}

const REASON_KEYS: Record<ReportReason, TranslationKeys> = {
  inappropriate: 'report.reasonInappropriate',
  harassment: 'report.reasonHarassment',
  off_topic: 'report.reasonOffTopic',
  other: 'report.reasonOther',
};

/**
 * Fenetre de signalement, commune aux messages, photos et membres.
 *
 * Le signalement part a l'administrateur de l'organisation, jamais a la
 * personne visee : la fenetre le dit, pour que personne n'hesite par crainte
 * d'une confrontation.
 */
export default function ReportSheet({ target, onClose }: Props) {
  const { t } = useTranslation();
  const colors = Colors[useColorScheme()];
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState('');
  const create = useCreateReport();
  const animatedStyle = useKeyboardAwareModalStyle({ visible: !!target });

  const close = () => {
    setReason(null);
    setComment('');
    onClose();
  };

  const submit = async () => {
    if (!target || !reason) return;
    try {
      await create.mutateAsync({ target_type: target.type, target_id: target.id, reason, comment: comment.trim() || undefined });
      close();
      Alert.alert(t('report.sentTitle'), t('report.sentBody'));
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.failed'));
    }
  };

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.overlay}>
        <Reanimated.View style={[styles.sheet, { backgroundColor: colors.surface }, animatedStyle]}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Flag size={IconSize.md} color={colors.red} />
              <Text style={[styles.title, { color: colors.text }]}>{t('report.title')}</Text>
            </View>
            <TouchableOpacity onPress={close} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityLabel={t('common.close')}>
              <X size={IconSize.lg} color={colors.text} />
            </TouchableOpacity>
          </View>

          {target ? (
            <Text style={[styles.targetLabel, { color: colors.text2 }]} numberOfLines={2}>
              {target.label}
            </Text>
          ) : null}

          <Text style={[styles.sectionLabel, { color: colors.text2 }]}>{t('report.reason')}</Text>
          <View style={styles.reasons}>
            {REPORT_REASONS.map((r) => {
              const active = reason === r;
              return (
                <TouchableOpacity
                  key={r}
                  onPress={() => setReason(r)}
                  style={[
                    styles.reason,
                    { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '20' : colors.itemBackground },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  {active ? <Check size={IconSize.sm} color={colors.primary} /> : null}
                  <Text style={[styles.reasonText, { color: active ? colors.primary : colors.text }]}>{t(REASON_KEYS[r])}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.text2 }]}>{t('report.commentOptional')}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
            value={comment}
            onChangeText={setComment}
            placeholder={t('report.commentPlaceholder')}
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={3}
          />

          <Text style={[styles.hint, { color: colors.mutedText }]}>{t('report.hint')}</Text>

          <TouchableOpacity
            style={[styles.submit, { backgroundColor: reason ? colors.red : colors.itemBackground }]}
            onPress={submit}
            disabled={!reason || create.isPending}
            accessibilityRole="button"
          >
            <Flag size={IconSize.sm} color={reason ? '#FFFFFF' : colors.mutedText} />
            <Text style={[styles.submitText, { color: reason ? '#FFFFFF' : colors.mutedText }]}>{t('report.send')}</Text>
          </TouchableOpacity>
        </Reanimated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl, paddingBottom: Spacing.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold },
  targetLabel: { fontSize: FontSize.sm, fontStyle: 'italic', marginBottom: Spacing.md },
  sectionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  reasons: { gap: Spacing.sm },
  reason: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: Radius.md, borderWidth: 1 },
  reasonText: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  input: { minHeight: 72, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: FontSize.base, textAlignVertical: 'top' },
  hint: { fontSize: FontSize.xs, marginTop: Spacing.sm, lineHeight: 16 },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, height: 48, borderRadius: Radius.md, marginTop: Spacing.lg },
  submitText: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, textAlign: 'center' },
});
