import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { ArrowLeft, Bug, Lightbulb, MessageSquare, Send } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import type { TranslationKeys } from '@/i18n/translations';
import { ApiError } from '@/api/client';
import {
  useMyFeedbacks,
  useCreateFeedback,
  type Feedback,
  type FeedbackStatus,
  type FeedbackType,
} from '@/api/hooks/useFeedback';

/** Bornes du schema de l'API. Les rappeler ici evite un aller-retour pour un 400. */
const SUBJECT_MIN = 3;
const MESSAGE_MIN = 10;

/** Table explicite plutot qu'une cle construite : le typage verifie les quatre. */
const STATUS_KEY: Record<FeedbackStatus, TranslationKeys> = {
  new: 'support.status.new',
  in_progress: 'support.status.in_progress',
  resolved: 'support.status.resolved',
  declined: 'support.status.declined',
};

export default function SupportScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [type, setType] = useState<FeedbackType>('bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [envoye, setEnvoye] = useState(false);
  const [deplie, setDeplie] = useState<string | null>(null);

  const mine = useMyFeedbacks();
  const create = useCreateFeedback();

  const valide = subject.trim().length >= SUBJECT_MIN && message.trim().length >= MESSAGE_MIN;

  const envoyer = async () => {
    setError('');
    try {
      await create.mutateAsync({
        type,
        subject: subject.trim(),
        message: message.trim(),
        platform: 'mobile',
        // La version installee : savoir si un correctif est bien arrive chez
        // l'utilisateur evite de chercher un bug deja corrige.
        app_version: Updates.runtimeVersion ?? undefined,
        locale,
      });
      setSubject('');
      setMessage('');
      setEnvoye(true);
    } catch (err) {
      setError(err instanceof ApiError ? String(err.details ?? err.message) : t('common.error'));
    }
  };

  const statusColor = (status: FeedbackStatus) => {
    if (status === 'resolved') return colors.green;
    if (status === 'declined') return colors.mutedText;
    if (status === 'in_progress') return colors.primary;
    return colors.text2;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <ArrowLeft size={IconSize.md} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('support.title')}</Text>
        <View style={{ width: IconSize.md }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.subtitle, { color: colors.text2 }]}>{t('support.subtitle')}</Text>

          {/* Nature du signalement : deux boutons plutot qu'une liste deroulante,
              c'est un choix binaire fait au doigt sur un chantier. */}
          <View style={styles.typeRow}>
            {(['bug', 'suggestion'] as const).map((option) => {
              const actif = type === option;
              const Icon = option === 'bug' ? Bug : Lightbulb;
              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.typeButton,
                    {
                      backgroundColor: actif ? colors.primary : colors.itemBackground,
                      borderColor: actif ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setType(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: actif }}
                >
                  <Icon size={IconSize.sm} color={actif ? '#FFFFFF' : colors.text2} />
                  <Text style={[styles.typeText, { color: actif ? '#FFFFFF' : colors.text }]}>
                    {option === 'bug' ? t('support.typeBug') : t('support.typeSuggestion')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>{t('support.subject')}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
            placeholder={type === 'bug' ? t('support.subjectPlaceholderBug') : t('support.subjectPlaceholderIdea')}
            placeholderTextColor={colors.placeholder}
            value={subject}
            onChangeText={(v) => { setSubject(v); setEnvoye(false); }}
            maxLength={150}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('support.message')}</Text>
          <TextInput
            style={[styles.input, styles.textarea, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
            placeholder={type === 'bug' ? t('support.messagePlaceholderBug') : t('support.messagePlaceholderIdea')}
            placeholderTextColor={colors.placeholder}
            value={message}
            onChangeText={(v) => { setMessage(v); setEnvoye(false); }}
            multiline
            textAlignVertical="top"
            maxLength={5000}
          />
          <Text style={[styles.hint, { color: colors.mutedText }]}>{t('support.messageHint')}</Text>

          {error ? <Text style={[styles.error, { color: colors.red }]}>{error}</Text> : null}
          {envoye ? <Text style={[styles.success, { color: colors.green }]}>{t('support.sent')}</Text> : null}

          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: valide ? colors.primary : colors.border }]}
            onPress={envoyer}
            disabled={!valide || create.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('support.send')}
          >
            {create.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Send size={IconSize.sm} color="#FFFFFF" />
                <Text style={styles.sendText}>{t('support.send')}</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Mes signalements */}
          <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('support.mine')}</Text>

          {mine.isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.lg }} />
          ) : mine.data && mine.data.data.length > 0 ? (
            mine.data.data.map((f: Feedback) => {
              const ouvert = deplie === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => setDeplie(ouvert ? null : f.id)}
                  accessibilityRole="button"
                >
                  <View style={styles.cardHeader}>
                    {f.type === 'bug' ? (
                      <Bug size={IconSize.sm} color={colors.mutedText} />
                    ) : (
                      <Lightbulb size={IconSize.sm} color={colors.mutedText} />
                    )}
                    <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={ouvert ? undefined : 1}>
                      {f.subject}
                    </Text>
                  </View>

                  <View style={styles.cardMeta}>
                    <Text style={[styles.status, { color: statusColor(f.status) }]}>{t(STATUS_KEY[f.status])}</Text>
                    {f.response ? (
                      <View style={styles.answeredRow}>
                        <MessageSquare size={12} color={colors.primary} />
                        <Text style={[styles.answered, { color: colors.primary }]}>{t('support.answered')}</Text>
                      </View>
                    ) : null}
                  </View>

                  {ouvert ? (
                    <>
                      <Text style={[styles.cardMessage, { color: colors.text2 }]}>{f.message}</Text>

                      {f.response ? (
                        <View style={[styles.responseBox, { borderColor: colors.primary }]}>
                          <Text style={[styles.responseFrom, { color: colors.primary }]}>
                            {t('support.responseFrom')}
                          </Text>
                          <Text style={[styles.responseText, { color: colors.text }]}>{f.response}</Text>
                        </View>
                      ) : (
                        <Text style={[styles.hint, { color: colors.mutedText }]}>{t('support.awaitingResponse')}</Text>
                      )}
                    </>
                  ) : null}
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={[styles.hint, { color: colors.mutedText }]}>{t('support.emptyDescription')}</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  subtitle: { fontSize: FontSize.base, marginBottom: Spacing.lg, lineHeight: 20 },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  typeText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  label: { fontSize: FontSize.base, fontWeight: FontWeight.medium, marginBottom: Spacing.xs },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    marginBottom: Spacing.md,
  },
  textarea: { minHeight: 140 },
  hint: { fontSize: FontSize.sm, marginBottom: Spacing.md, lineHeight: 18 },
  error: { fontSize: FontSize.sm, marginBottom: Spacing.sm },
  success: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginBottom: Spacing.sm },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 48,
    borderRadius: Radius.md,
  },
  sendText: { color: '#FFFFFF', fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  card: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.lg, marginBottom: Spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardTitle: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.medium },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xs },
  status: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  answeredRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  answered: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  cardMessage: { fontSize: FontSize.base, lineHeight: 20, marginTop: Spacing.md },
  responseBox: { borderLeftWidth: 3, paddingLeft: Spacing.md, marginTop: Spacing.lg },
  responseFrom: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  responseText: { fontSize: FontSize.base, lineHeight: 20 },
});
