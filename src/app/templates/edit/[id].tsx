import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import TemplateForm, { TemplateFormValues } from '@/components/TemplateForm';
import {
  useChantierTemplate,
  useUpdateChantierTemplate,
} from '@/api/hooks/useChantierTemplates';

export default function EditTemplateScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading } = useChantierTemplate(id);
  const updateMutation = useUpdateChantierTemplate();

  const handleSubmit = async (values: TemplateFormValues) => {
    if (!id) return;
    try {
      await updateMutation.mutateAsync({
        id,
        body: {
          name: values.name,
          description: values.description || null,
          default_status: values.default_status,
          steps: values.steps,
          members: values.members.map((m) => ({ user_id: m.user_id })),
        },
      });
      router.back();
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('templates.updateFailed'));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel={t('common.back')}
        >
          <ArrowLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('templates.titleEdit')}</Text>
        <View style={{ width: IconSize.lg }} />
      </View>
      {isLoading || !data ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <TemplateForm
          initial={{
            name: data.name,
            description: data.description ?? '',
            default_status: data.default_status,
            steps: data.steps.map((s) => ({
              name: s.name,
              substeps: s.substeps.map((x) => ({ name: x.name })),
            })),
            members: (data.members ?? []).map((m) => ({
              user_id: m.user_id,
              first_name: m.first_name,
              last_name: m.last_name,
              email: m.email,
              role: m.role,
            })),
          }}
          submitting={updateMutation.isPending}
          submitLabel={t('common.save')}
          onSubmit={handleSubmit}
        />
      )}
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
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
