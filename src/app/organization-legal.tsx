import React, { useEffect, useState } from 'react';
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Building2, Sparkles, Save } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization, useUpdateOrganization, Organization } from '@/api/hooks/useOrganization';
import { useSiretLookup } from '@/hooks/useSiretLookup';

interface FormState {
  siret: string;
  legal_form: string;
  vat_number: string;
  naf_code: string;
  address: string;
  postal_code: string;
  city: string;
  country: string;
  phone: string;
  billing_email: string;
  website: string;
  insurance_provider: string;
  insurance_number: string;
}

const EMPTY: FormState = {
  siret: '',
  legal_form: '',
  vat_number: '',
  naf_code: '',
  address: '',
  postal_code: '',
  city: '',
  country: 'FR',
  phone: '',
  billing_email: '',
  website: '',
  insurance_provider: '',
  insurance_number: '',
};

function pickInitial(org: Organization | undefined): FormState {
  if (!org) return EMPTY;
  return {
    siret: org.siret ?? '',
    legal_form: org.legal_form ?? '',
    vat_number: org.vat_number ?? '',
    naf_code: org.naf_code ?? '',
    address: org.address ?? '',
    postal_code: org.postal_code ?? '',
    city: org.city ?? '',
    country: org.country ?? 'FR',
    phone: org.phone ?? '',
    billing_email: org.billing_email ?? '',
    website: org.website ?? '',
    insurance_provider: org.insurance_provider ?? '',
    insurance_number: org.insurance_number ?? '',
  };
}

export default function OrganizationLegalScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const orgQuery = useOrganization(isAdmin);
  const updateOrg = useUpdateOrganization();
  const lookup = useSiretLookup();
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    setForm(pickInitial(orgQuery.data));
  }, [orgQuery.data]);

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.empty, { color: colors.mutedText }]}>{t('legal.adminOnly')}</Text>
      </SafeAreaView>
    );
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const siretClean = form.siret.replace(/\s/g, '');
  const siretValid = /^\d{14}$/.test(siretClean);

  const handleAutofill = async () => {
    const result = await lookup.lookup(form.siret);
    if (!result) {
      if (lookup.error) Alert.alert(t('common.error'), lookup.error);
      return;
    }
    setForm((prev) => ({
      ...prev,
      siret: result.siret,
      legal_form: result.legal_form ?? prev.legal_form,
      naf_code: result.naf_code ?? prev.naf_code,
      address: result.address ?? prev.address,
      postal_code: result.postal_code ?? prev.postal_code,
      city: result.city ?? prev.city,
      vat_number: result.vat_number ?? prev.vat_number,
      country: prev.country || 'FR',
    }));
    if (result.name && orgQuery.data && result.name !== orgQuery.data.name) {
      await updateOrg.mutateAsync({ name: result.name });
    }
    Alert.alert(t('legal.autofillSuccess'));
  };

  const handleSave = async () => {
    const body: Record<string, string | null> = {};
    (Object.keys(form) as (keyof FormState)[]).forEach((k) => {
      const value = form[k].trim();
      body[k] = value === '' ? null : value;
    });
    try {
      await updateOrg.mutateAsync(body);
      Alert.alert(t('legal.saved'));
      router.back();
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : '');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <ArrowLeft size={IconSize.md} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('legal.title')}</Text>
        <View style={{ width: IconSize.md }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headerBlock}>
            <Building2 size={IconSize.md} color={colors.primary} />
            <Text style={[styles.subtitle, { color: colors.text2 }]}>{t('legal.subtitle')}</Text>
          </View>

          <Field label={t('legal.siret')} colors={colors} hint={t('legal.siretHint')}>
            <View style={styles.siretRow}>
              <TextInput
                style={[styles.input, styles.siretInput, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                value={form.siret}
                onChangeText={(v) => set('siret', v.replace(/[^0-9 ]/g, '').slice(0, 17))}
                keyboardType="number-pad"
                placeholder="12345678901234"
                placeholderTextColor={colors.placeholder}
              />
              <TouchableOpacity
                style={[
                  styles.autofillBtn,
                  {
                    backgroundColor: siretValid ? colors.primary : colors.itemBackground,
                    opacity: siretValid ? 1 : 0.5,
                  },
                ]}
                onPress={handleAutofill}
                disabled={!siretValid || lookup.isLoading}
                accessibilityRole="button"
              >
                {lookup.isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Sparkles size={IconSize.sm} color={siretValid ? '#FFFFFF' : colors.mutedText} />
                    <Text style={[styles.autofillText, { color: siretValid ? '#FFFFFF' : colors.mutedText }]}>
                      {t('legal.autofill')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Field>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: Spacing.sm }}>
              <Field label={t('legal.legalForm')} colors={colors}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                  value={form.legal_form}
                  onChangeText={(v) => set('legal_form', v)}
                  placeholder="SAS, SARL, EI…"
                  placeholderTextColor={colors.placeholder}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t('legal.nafCode')} colors={colors}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                  value={form.naf_code}
                  onChangeText={(v) => set('naf_code', v.toUpperCase().slice(0, 6))}
                  placeholder="4120A"
                  placeholderTextColor={colors.placeholder}
                />
              </Field>
            </View>
          </View>

          <Field label={t('legal.vatNumber')} colors={colors}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={form.vat_number}
              onChangeText={(v) => set('vat_number', v.toUpperCase())}
              placeholder="FR12345678901"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="characters"
            />
          </Field>

          <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('legal.address')}</Text>

          <Field label={t('legal.streetAddress')} colors={colors}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={form.address}
              onChangeText={(v) => set('address', v)}
            />
          </Field>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: Spacing.sm }}>
              <Field label={t('legal.postalCode')} colors={colors}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                  value={form.postal_code}
                  onChangeText={(v) => set('postal_code', v)}
                  keyboardType="number-pad"
                />
              </Field>
            </View>
            <View style={{ flex: 2 }}>
              <Field label={t('legal.city')} colors={colors}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                  value={form.city}
                  onChangeText={(v) => set('city', v)}
                />
              </Field>
            </View>
          </View>

          <Field label={t('legal.country')} colors={colors} hint="ISO-2">
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={form.country}
              onChangeText={(v) => set('country', v.toUpperCase().slice(0, 2))}
              autoCapitalize="characters"
              maxLength={2}
            />
          </Field>

          <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('legal.contact')}</Text>

          <Field label={t('legal.phone')} colors={colors}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={form.phone}
              onChangeText={(v) => set('phone', v)}
              keyboardType="phone-pad"
            />
          </Field>

          <Field label={t('legal.billingEmail')} colors={colors} hint={t('legal.billingEmailHint')}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={form.billing_email}
              onChangeText={(v) => set('billing_email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Field>

          <Field label={t('legal.website')} colors={colors}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={form.website}
              onChangeText={(v) => set('website', v)}
              keyboardType="url"
              autoCapitalize="none"
              placeholder="https://"
              placeholderTextColor={colors.placeholder}
            />
          </Field>

          <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('legal.insurance')}</Text>
          <Text style={[styles.hint, { color: colors.mutedText }]}>{t('legal.insuranceHint')}</Text>

          <Field label={t('legal.insuranceProvider')} colors={colors}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={form.insurance_provider}
              onChangeText={(v) => set('insurance_provider', v)}
            />
          </Field>

          <Field label={t('legal.insuranceNumber')} colors={colors}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={form.insurance_number}
              onChangeText={(v) => set('insurance_number', v)}
            />
          </Field>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={updateOrg.isPending}
            accessibilityRole="button"
          >
            {updateOrg.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Save size={IconSize.sm} color="#FFFFFF" />
                <Text style={styles.saveText}>{t('common.save')}</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  hint,
  colors,
  children,
}: {
  label: string;
  hint?: string;
  colors: typeof Colors.light;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text2 }]}>{label}</Text>
      {children}
      {hint ? <Text style={[styles.hint, { color: colors.mutedText }]}>{hint}</Text> : null}
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
  headerBlock: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start', marginBottom: Spacing.lg },
  subtitle: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
  sectionTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  field: { marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginBottom: Spacing.xs },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.base,
  },
  hint: { fontSize: FontSize.xs, marginTop: Spacing.xs },
  row: { flexDirection: 'row' },
  siretRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  siretInput: { flex: 1 },
  autofillBtn: {
    height: 48,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  autofillText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  saveBtn: {
    marginTop: Spacing.xl,
    height: 50,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  saveText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  empty: { textAlign: 'center', marginTop: Spacing.xxl, fontSize: FontSize.base },
});
