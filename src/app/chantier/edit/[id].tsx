import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { chantierHooks, useUpdateChantier } from '@/api/hooks/useChantiers';
import { ApiError } from '@/api/client';
import CityAutocomplete from '@/components/CityAutocomplete';
import DateRangePicker from '@/components/DateRangePicker';
import KeyboardAwareScroll from '@/components/KeyboardAwareScroll';
import type { ChantierStatus } from '@/api/types';

const STATUS_OPTIONS: { value: ChantierStatus; label: string }[] = [
  { value: 'a_venir', label: 'À venir' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'termine', label: 'Terminé' },
];

export default function EditChantierScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: chantier, isLoading } = chantierHooks.useById(id);
  const updateMutation = useUpdateChantier();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [status, setStatus] = useState<ChantierStatus>('a_venir');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Pre-fill form with existing data
  useEffect(() => {
    if (chantier && !initialized) {
      setName(chantier.name || '');
      setDescription(chantier.description || '');
      setAddress(chantier.address || '');
      setCity(chantier.city || '');
      setPostalCode(chantier.postal_code || '');
      setLatitude(chantier.latitude ? Number(chantier.latitude) : undefined);
      setLongitude(chantier.longitude ? Number(chantier.longitude) : undefined);
      setStatus(chantier.status);
      setStartDate(chantier.start_date ? chantier.start_date.split('T')[0] : '');
      setEndDate(chantier.end_date ? chantier.end_date.split('T')[0] : '');
      setInitialized(true);
    }
  }, [chantier, initialized]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Le nom du chantier est obligatoire.');
      return;
    }
    if (!id) return;

    setError('');

    try {
      await updateMutation.mutateAsync({
        id,
        body: {
          name: name.trim(),
          description: description.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          postal_code: postalCode.trim() || undefined,
          latitude,
          longitude,
          status,
          start_date: startDate.trim() || undefined,
          end_date: endDate.trim() || undefined,
        },
      });
      router.back();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(String(err.details));
      } else {
        setError('Erreur lors de la modification.');
      }
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Retour">
          <ArrowLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.text }]}>Modifier le chantier</Text>
        <View style={{ width: IconSize.lg }} />
      </View>

      <KeyboardAwareScroll contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.label, { color: colors.text }]}>Nom du chantier *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
            value={name}
            onChangeText={setName}
            accessibilityLabel="Nom du chantier"
          />

          <Text style={[styles.label, { color: colors.text }]}>Description</Text>
          <TextInput
            style={[styles.inputMultiline, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            accessibilityLabel="Description"
          />

          <Text style={[styles.label, { color: colors.text }]}>Statut</Text>
          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((opt) => {
              const isActive = status === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor: isActive ? colors.primary + '20' : colors.itemBackground,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setStatus(opt.value)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={[styles.statusText, { color: isActive ? colors.primary : colors.text2 }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>Localisation</Text>

          <CityAutocomplete
            city={city}
            postalCode={postalCode}
            address={address}
            onCityChange={setCity}
            onSelect={(c, cp, lat, lng) => { setCity(c); setPostalCode(cp); setLatitude(lat); setLongitude(lng); }}
            onAddressChange={setAddress}
            onAddressSelect={(addr, lat, lng) => { setAddress(addr); setLatitude(lat); setLongitude(lng); }}
          />

          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
          />

          {error ? <Text style={[styles.error, { color: colors.red }]}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={updateMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel="Enregistrer les modifications"
          >
            {updateMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Enregistrer</Text>
            )}
          </TouchableOpacity>
      </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
  },
  topTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold },
  scrollContent: { paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.xxxl * 2 },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, marginTop: Spacing.xl },
  label: { fontSize: FontSize.base, fontWeight: FontWeight.medium, marginTop: Spacing.md },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.base,
    marginTop: Spacing.xs,
  },
  inputMultiline: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    fontSize: FontSize.base,
    marginTop: Spacing.xs,
    textAlignVertical: 'top',
  },
  statusRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  statusChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  statusText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  row: { flexDirection: 'row', gap: Spacing.md },
  halfField: { flex: 1 },
  error: { fontSize: FontSize.sm, marginTop: Spacing.md },
  button: {
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxl,
  },
  buttonText: { color: '#FFFFFF', fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
});
