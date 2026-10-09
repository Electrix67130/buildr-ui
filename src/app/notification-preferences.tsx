import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  MessageSquare,
  AtSign,
  AlertTriangle,
  ListChecks,
  Camera,
  FileText,
  UserPlus,
  Flag,
  BellOff,
  type LucideIcon,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import type { TranslationKeys } from '@/i18n/translations';
import type { NotificationCategory } from '@/api/types';
import { useUpdatePushPreference } from '@/api/hooks/useAuth';
import {
  useNotificationPreferences,
  useUpdateNotificationCategory,
  useSetChantierNotificationLevel,
} from '@/api/hooks/useNotificationPreferences';

/** Les categories, dans l'ordre de l'ecran. Table explicite : le typage verifie chaque cle. */
const CATEGORIES: { key: NotificationCategory; icon: LucideIcon; label: TranslationKeys; hint: TranslationKeys }[] = [
  { key: 'mentions', icon: AtSign, label: 'notifPrefs.mentions', hint: 'notifPrefs.mentionsHint' },
  { key: 'messages', icon: MessageSquare, label: 'notifPrefs.messages', hint: 'notifPrefs.messagesHint' },
  { key: 'emergencies', icon: AlertTriangle, label: 'notifPrefs.emergencies', hint: 'notifPrefs.emergenciesHint' },
  { key: 'steps', icon: ListChecks, label: 'notifPrefs.steps', hint: 'notifPrefs.stepsHint' },
  { key: 'photos', icon: Camera, label: 'notifPrefs.photos', hint: 'notifPrefs.photosHint' },
  { key: 'documents', icon: FileText, label: 'notifPrefs.documents', hint: 'notifPrefs.documentsHint' },
  { key: 'membership', icon: UserPlus, label: 'notifPrefs.membership', hint: 'notifPrefs.membershipHint' },
  { key: 'reports', icon: Flag, label: 'notifPrefs.reports', hint: 'notifPrefs.reportsHint' },
];

const LEVEL_LABEL: Record<'important' | 'none', TranslationKeys> = {
  important: 'notifPrefs.levelImportant',
  none: 'notifPrefs.levelNone',
};

/**
 * Reglages fins des notifications : l'interrupteur general, une ligne par type
 * d'evenement, et les chantiers mis en sourdine (reglables depuis chaque
 * chantier, par la cloche).
 */
export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = Colors[useColorScheme()];
  const { user } = useAuth();
  const prefs = useNotificationPreferences();
  const updateCategory = useUpdateNotificationCategory();
  const updatePush = useUpdatePushPreference();
  const setLevel = useSetChantierNotificationLevel();

  const pushEnabled = user?.push_enabled ?? true;
  // Les signalements ne vont qu'aux administrateurs : inutile d'en parler aux autres.
  const isAdmin = (user?.memberships ?? []).some((m) => m.role === 'admin');
  const categories = CATEGORIES.filter((c) => c.key !== 'reports' || isAdmin);

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('notifPrefs.title')}</Text>
        <View style={{ width: IconSize.md }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Row
            icon={Bell}
            title={t('profile.pushTitle')}
            hint={t('profile.pushHint')}
            value={pushEnabled}
            onChange={(value) => updatePush.mutate(value)}
            disabled={updatePush.isPending}
            colors={colors}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('notifPrefs.byType')}</Text>
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pushEnabled ? 1 : 0.5 }]}
        >
          {prefs.isLoading || !prefs.data ? (
            <ActivityIndicator color={colors.primary} style={{ padding: Spacing.lg }} />
          ) : (
            categories.map((c, i) => (
              <View key={c.key}>
                {i > 0 ? <View style={[styles.separator, { backgroundColor: colors.border }]} /> : null}
                <Row
                  icon={c.icon}
                  title={t(c.label)}
                  hint={t(c.hint)}
                  value={prefs.data.categories[c.key]}
                  onChange={(enabled) => updateCategory.mutate({ category: c.key, enabled })}
                  disabled={!pushEnabled}
                  colors={colors}
                />
              </View>
            ))
          )}
        </View>
        {!pushEnabled ? (
          <Text style={[styles.hint, { color: colors.mutedText }]}>{t('notifPrefs.pushOffHint')}</Text>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('notifPrefs.byChantier')}</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {(prefs.data?.chantiers ?? []).length === 0 ? (
            <Text style={[styles.hint, { color: colors.mutedText, marginTop: 0 }]}>{t('notifPrefs.noMutedChantier')}</Text>
          ) : (
            prefs.data!.chantiers.map((c, i) => (
              <View key={c.chantier_id}>
                {i > 0 ? <View style={[styles.separator, { backgroundColor: colors.border }]} /> : null}
                <View style={styles.row}>
                  <View style={[styles.icon, { backgroundColor: colors.primary + '15' }]}>
                    <BellOff size={IconSize.md} color={colors.primary} />
                  </View>
                  <View style={styles.info}>
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                      {c.chantier_name}
                    </Text>
                    <Text style={[styles.rowHint, { color: colors.mutedText }]}>{t(LEVEL_LABEL[c.level])}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setLevel.mutate({ chantierId: c.chantier_id, level: 'all' })}
                    style={[styles.resetBtn, { borderColor: colors.primary }]}
                    accessibilityRole="button"
                    accessibilityLabel={t('notifPrefs.resetNamed', { name: c.chantier_name })}
                  >
                    <Text style={[styles.resetText, { color: colors.primary }]}>{t('notifPrefs.reset')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
        <Text style={[styles.hint, { color: colors.mutedText }]}>{t('notifPrefs.byChantierHint')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  icon: Icon,
  title,
  hint,
  value,
  onChange,
  disabled,
  colors,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  colors: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: colors.primary + '15' }]}>
        <Icon size={IconSize.md} color={colors.primary} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.rowHint, { color: colors.mutedText }]}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#FFFFFF"
        accessibilityLabel={title}
      />
    </View>
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
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, marginTop: Spacing.xl, marginBottom: Spacing.sm, marginLeft: Spacing.sm, textTransform: 'uppercase' },
  card: { borderWidth: 1, borderRadius: Radius.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  separator: { height: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  icon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  title: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  rowHint: { fontSize: FontSize.xs, marginTop: 2, lineHeight: FontSize.xs * 1.4 },
  hint: { fontSize: FontSize.xs, marginTop: Spacing.sm, marginHorizontal: Spacing.sm, lineHeight: FontSize.xs * 1.5 },
  resetBtn: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  resetText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
