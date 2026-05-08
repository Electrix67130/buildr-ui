import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Layers, Check } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { useChantierTemplates, useUseTemplate, ChantierTemplate } from '@/api/hooks/useChantierTemplates';
import CityAutocomplete from '@/components/CityAutocomplete';
import DateRangePicker from '@/components/DateRangePicker';
import KeyboardAwareScroll from '@/components/KeyboardAwareScroll';
import { ApiError } from '@/api/client';

export default function PickTemplateScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useTranslation();

  const { data, isLoading } = useChantierTemplates();
  const useTemplate = useUseTemplate();

  const [selected, setSelected] = useState<ChantierTemplate | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  const handleSelect = (template: ChantierTemplate) => {
    setSelected(template);
    if (!description.trim() && template.description) setDescription(template.description);
  };

  const handleCreate = async () => {
    if (!selected) return;
    if (!name.trim()) {
      setError(t('templates.chantierNameRequired'));
      return;
    }
    if (!startDate.trim() || !endDate.trim()) {
      setError(t('templates.datesRequired'));
      return;
    }
    setError('');
    try {
      const created = await useTemplate.mutateAsync({
        id: selected.id,
        body: {
          name: name.trim(),
          description: description.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          postal_code: postalCode.trim() || undefined,
          latitude,
          longitude,
          start_date: startDate.trim() || undefined,
          end_date: endDate.trim() || undefined,
        },
      });
      router.replace(`/chantier/${created.id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(String(err.details));
      else Alert.alert(t('common.error'), err instanceof Error ? err.message : t('chantier.createFailed'));
    }
  };

  const canSubmit = !!selected && name.trim().length > 0 && !!startDate && !!endDate && !useTemplate.isPending;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{t('templates.titlePick')}</Text>
        <View style={{ width: IconSize.lg }} />
      </View>

      <KeyboardAwareScroll contentContainerStyle={styles.scroll}>
          <Text style={[styles.sectionLabel, { color: colors.text2 }]}>{t('templates.pickStep1')}</Text>
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.lg }} />
          ) : (data ?? []).length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.mutedText }]}>
                {t('templates.emptyPick')}
              </Text>
            </View>
          ) : (
            (data ?? []).map((tpl) => {
              const isActive = selected?.id === tpl.id;
              return (
                <TouchableOpacity
                  key={tpl.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: isActive ? colors.primary + '15' : colors.surface,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                    Shadow.sm,
                  ]}
                  onPress={() => handleSelect(tpl)}
                >
                  <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
                    <Layers size={IconSize.md} color={colors.primary} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{tpl.name}</Text>
                    <Text style={[styles.cardMeta, { color: colors.mutedText }]} numberOfLines={1}>
                      {tpl.steps.length} {tpl.steps.length > 1 ? t('templates.steps') : t('templates.step')}
                      {tpl.description ? ` • ${tpl.description}` : ''}
                    </Text>
                  </View>
                  {isActive ? <Check size={IconSize.md} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            })
          )}

          {selected ? (
            <>
              <Text style={[styles.sectionLabel, { color: colors.text2, marginTop: Spacing.xl }]}>
                {t('templates.pickStep2')}
              </Text>

              <Text style={[styles.label, { color: colors.text2 }]}>{t('chantier.name')} *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                value={name}
                onChangeText={setName}
                placeholder={t('chantier.name')}
                placeholderTextColor={colors.placeholder}
              />

              <Text style={[styles.label, { color: colors.text2, marginTop: Spacing.md }]}>{t('chantier.dates')} *</Text>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={(s, e) => {
                  Keyboard.dismiss();
                  setStartDate(s);
                  setEndDate(e);
                }}
              />

              <Text style={[styles.label, { color: colors.text2, marginTop: Spacing.md }]}>{t('chantier.location')}</Text>
              <CityAutocomplete
                city={city}
                postalCode={postalCode}
                address={address}
                onCityChange={setCity}
                onSelect={(c, cp, lat, lng) => {
                  setCity(c);
                  setPostalCode(cp);
                  setLatitude(lat);
                  setLongitude(lng);
                }}
                onAddressChange={setAddress}
                onAddressSelect={(addr, lat, lng) => {
                  setAddress(addr);
                  setLatitude(lat);
                  setLongitude(lng);
                }}
              />

              <Text style={[styles.label, { color: colors.text2, marginTop: Spacing.md }]}>{t('chantier.description')}</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textarea,
                  { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border },
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder={t('chantier.description')}
                placeholderTextColor={colors.placeholder}
                multiline
              />

              {error ? <Text style={[styles.error, { color: colors.red }]}>{error}</Text> : null}

              <TouchableOpacity
                style={[
                  styles.submit,
                  { backgroundColor: canSubmit ? colors.primary : colors.itemBackground, marginTop: Spacing.xl },
                ]}
                onPress={handleCreate}
                disabled={!canSubmit}
              >
                {useTemplate.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.submitText, { color: canSubmit ? '#FFFFFF' : colors.mutedText }]}>
                    {t('templates.pickCreateChantier')}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : null}
      </KeyboardAwareScroll>
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

  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.sm },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5 },

  empty: { padding: Spacing.xl, borderWidth: 1, borderRadius: Radius.lg, alignItems: 'center' },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center' },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    marginTop: Spacing.sm,
  },
  iconBox: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  cardMeta: { fontSize: FontSize.xs, marginTop: 2 },

  label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.base,
    marginTop: Spacing.xs,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },

  error: { fontSize: FontSize.sm, marginTop: Spacing.sm },

  submit: { height: 48, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
});
