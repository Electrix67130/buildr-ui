import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
  Pressable,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown, X, Search, UserX } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useCreateChantier } from '@/api/hooks/useChantiers';
import { useAllUsers } from '@/api/hooks/useMembers';
import { ApiError } from '@/api/client';
import CityAutocomplete from '@/components/CityAutocomplete';
import DateRangePicker from '@/components/DateRangePicker';
import KeyboardAwareScroll from '@/components/KeyboardAwareScroll';
import type { ChantierStatus } from '@/api/types';
import type { TranslationKeys } from '@/i18n/translations';
import { useTranslation } from '@/contexts/I18nContext';

const STATUS_OPTIONS: { value: ChantierStatus; labelKey: TranslationKeys }[] = [
  { value: 'a_venir', labelKey: 'chantier.statusUpcoming' },
  { value: 'en_cours', labelKey: 'chantier.statusInProgress' },
  { value: 'termine', labelKey: 'chantier.statusCompleted' },
];

export default function CreateChantierScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const createMutation = useCreateChantier();
  const { data: usersData } = useAllUsers();

  const [name, setName] = useState('');
  const [managerId, setManagerId] = useState<string | undefined>();
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const [managerSearch, setManagerSearch] = useState('');
  // 0.7 = on conserve la maxHeight d'origine (70% de la zone visible) qui matche le design
  const animatedManagerPickerStyle = useKeyboardAwareModalStyle({
    visible: showManagerPicker,
    maxHeightRatio: 0.7,
  });
  const [description, setDescription] = useState('');

  const managers = (usersData?.data ?? []).filter((u) => u.role === 'manager' || u.role === 'admin');
  const selectedManager = managers.find((m) => m.id === managerId);
  const filteredManagers = useMemo(() => {
    if (!managerSearch.trim()) return managers;
    const q = managerSearch.toLowerCase();
    return managers.filter(
      (m) => `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [managers, managerSearch]);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [status, setStatus] = useState<ChantierStatus>('a_venir');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) {
      setError(t('chantier.nameRequired'));
      return;
    }

    setError('');

    try {
      await createMutation.mutateAsync({
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
        manager_id: managerId,
      });
      router.back();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(String(err.details));
      } else {
        setError(t('chantier.createError'));
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={t('a11y.back')}
        >
          <ArrowLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.text }]}>{t('chantier.create')}</Text>
        <View style={{ width: IconSize.lg }} />
      </View>

      <KeyboardAwareScroll contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.label, { color: colors.text }]}>{t('chantier.nameRequiredLabel')}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
            placeholder={t('chantier.namePlaceholder')}
            placeholderTextColor={colors.placeholder}
            value={name}
            onChangeText={setName}
            accessibilityLabel={t('chantier.nameLabel')}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('chantier.status')}</Text>
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
                  onPress={() => { Keyboard.dismiss(); setStatus(opt.value); }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={[styles.statusText, { color: isActive ? colors.primary : colors.text2 }]}>
                    {t(opt.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>{t('collab.role.manager')}</Text>
          <TouchableOpacity
            style={[styles.pickerField, { backgroundColor: colors.itemBackground, borderColor: managerId ? '#7C3AED' : colors.border }]}
            onPress={() => { Keyboard.dismiss(); setManagerSearch(''); setShowManagerPicker(true); }}
            accessibilityRole="button"
            accessibilityLabel={t('chantier.chooseManager')}
          >
            {selectedManager ? (
              <View style={styles.pickerSelected}>
                <View style={[styles.pickerAvatar, { backgroundColor: '#7C3AED20' }]}>
                  <Text style={[styles.pickerAvatarText, { color: '#7C3AED' }]}>
                    {selectedManager.first_name[0]}{selectedManager.last_name[0]}
                  </Text>
                </View>
                <Text style={[styles.pickerText, { color: colors.text }]}>
                  {selectedManager.first_name} {selectedManager.last_name}
                </Text>
                <TouchableOpacity onPress={() => setManagerId(undefined)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={16} color={colors.text2} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.pickerPlaceholder}>
                <Text style={[styles.pickerText, { color: colors.placeholder }]}>{t('chantier.noManagerOptional')}</Text>
                <ChevronDown size={18} color={colors.placeholder} />
              </View>
            )}
          </TouchableOpacity>

          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(s, e) => { Keyboard.dismiss(); setStartDate(s); setEndDate(e); }}
          />

          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('chantier.location')}</Text>

          <CityAutocomplete
            city={city}
            postalCode={postalCode}
            address={address}
            onCityChange={setCity}
            onSelect={(c, cp, lat, lng) => { setCity(c); setPostalCode(cp); setLatitude(lat); setLongitude(lng); }}
            onAddressChange={setAddress}
            onAddressSelect={(addr, lat, lng) => { setAddress(addr); setLatitude(lat); setLongitude(lng); }}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('chantier.description')}</Text>
          <TextInput
            style={[styles.inputMultiline, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
            placeholder={t('chantier.descriptionPlaceholder')}
            placeholderTextColor={colors.placeholder}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            accessibilityLabel={t('chantier.description')}
          />

          {error ? <Text style={[styles.error, { color: colors.red }]}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleCreate}
            disabled={createMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('chantier.createSubmit')}
          >
            {createMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>{t('chantier.createSubmit')}</Text>
            )}
          </TouchableOpacity>
      </KeyboardAwareScroll>

      {/* Manager picker modal */}
      <Modal visible={showManagerPicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowManagerPicker(false)}>
          <AnimatedPressable style={[styles.modalContent, { backgroundColor: colors.surface }, animatedManagerPickerStyle]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('chantier.chooseManager')}</Text>
              <TouchableOpacity onPress={() => setShowManagerPicker(false)}>
                <X size={IconSize.lg} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBox, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}>
              <Search size={16} color={colors.placeholder} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={t('chantier.searchManager')}
                placeholderTextColor={colors.placeholder}
                value={managerSearch}
                onChangeText={setManagerSearch}
                autoFocus
              />
            </View>

            {/* Option "Aucun" */}
            <TouchableOpacity
              style={[styles.managerOption, { borderColor: colors.border }]}
              onPress={() => { setManagerId(undefined); setShowManagerPicker(false); }}
            >
              <View style={[styles.managerAvatar, { backgroundColor: colors.itemBackground }]}>
                <UserX size={18} color={colors.text2} />
              </View>
              <Text style={[styles.managerName, { color: colors.text2 }]}>{t('chantier.noManager')}</Text>
            </TouchableOpacity>

            <FlatList
              data={filteredManagers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isSelected = managerId === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.managerOption,
                      { borderColor: isSelected ? '#7C3AED' : colors.border },
                      isSelected && { backgroundColor: '#7C3AED10' },
                    ]}
                    onPress={() => { setManagerId(item.id); setShowManagerPicker(false); }}
                  >
                    <View style={[styles.managerAvatar, { backgroundColor: '#7C3AED20' }]}>
                      <Text style={[styles.managerAvatarText, { color: '#7C3AED' }]}>
                        {item.first_name[0]}{item.last_name[0]}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.managerName, { color: colors.text }]}>
                        {item.first_name} {item.last_name}
                      </Text>
                      <Text style={[styles.managerEmail, { color: colors.mutedText }]}>{item.email}</Text>
                    </View>
                    {isSelected && (
                      <View style={[styles.selectedBadge, { backgroundColor: '#7C3AED' }]}>
                        <Text style={styles.selectedBadgeText}>{t('chantier.selected')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.emptySearch, { color: colors.mutedText }]}>{t('chantier.noManagerFound')}</Text>
              }
              keyboardShouldPersistTaps="handled"
            />
          </AnimatedPressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
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
  pickerField: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  pickerSelected: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  pickerPlaceholder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pickerAvatarText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  pickerText: { fontSize: FontSize.base, flex: 1 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 40,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: FontSize.base, height: 40 },
  managerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
  },
  managerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  managerAvatarText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  managerName: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  managerEmail: { fontSize: FontSize.xs },
  selectedBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  selectedBadgeText: { color: '#FFFFFF', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  emptySearch: { fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.xl },
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
