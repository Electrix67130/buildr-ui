import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'react-native';
import { LogOut, User, Sun, Moon, Smartphone, Save, Mail, Phone, Building2, Check, Globe, Lock, KeyRound, X, Camera, Plus, ArrowRightLeft, Bell, FileText, ChevronRight, ExternalLink, Trash2, AlertTriangle } from 'lucide-react-native';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { DASHBOARD_CREATE_ORG_URL } from '@/constants/Urls';
import { Modal, Alert } from 'react-native';
import Animated from 'react-native-reanimated';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import * as ImagePicker from 'expo-image-picker';
import { uploadFile } from '@/api/upload';
import { optimizeImage } from '@/utils/optimizeImage';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, ThemeMode } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/I18nContext';
import { LOCALES, Locale } from '@/i18n/translations';
import { useQueryClient } from '@tanstack/react-query';
import { useUpdateProfile, useUpdatePassword, useSwitchOrganization, useCreateOrganization, useUpdatePushPreference } from '@/api/hooks/useAuth';
import { useUnreadSummary } from '@/api/hooks/useChantierViews';
import * as Updates from 'expo-updates';
import { Colors } from '@/constants/Colors';
import AppHeader from '@/components/AppHeader';
import CalendarIntegrations from '@/components/CalendarIntegrations';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useOrganization, useUpdateOrganization } from '@/api/hooks/useOrganization';

const THEME_OPTIONS: { mode: ThemeMode; key: 'profile.themeLight' | 'profile.themeDark' | 'profile.themeSystem'; icon: typeof Sun }[] = [
  { mode: 'light', key: 'profile.themeLight', icon: Sun },
  { mode: 'dark', key: 'profile.themeDark', icon: Moon },
  { mode: 'system', key: 'profile.themeSystem', icon: Smartphone },
];

export default function ProfilScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { user, logout, deleteAccount } = useAuth();
  const { mode, setMode } = useTheme();
  const { locale, setLocale, t } = useTranslation();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();
  const isAdmin = user?.role === 'admin';
  const orgQuery = useOrganization(isAdmin);
  const updateOrg = useUpdateOrganization();
  const updatePassword = useUpdatePassword();
  const switchOrg = useSwitchOrganization();
  const createOrg = useCreateOrganization();
  const updatePushPref = useUpdatePushPreference();
  const unreadSummary = useUnreadSummary(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);

  const handleOpenDashboardCreateOrg = async () => {
    setShowCreateOrgModal(false);
    await Linking.openURL(DASHBOARD_CREATE_ORG_URL);
  };

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [retentionInput, setRetentionInput] = useState('');
  const [retentionSavedFlash, setRetentionSavedFlash] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const animatedPasswordModalStyle = useKeyboardAwareModalStyle({ visible: showPasswordModal });
  const animatedCreateOrgModalStyle = useKeyboardAwareModalStyle({ visible: showCreateOrgModal });
  const animatedDeleteModalStyle = useKeyboardAwareModalStyle({ visible: showDeleteModal });

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setCompanyName(user.company_name || '');
    }
  }, [user]);

  useEffect(() => {
    if (orgQuery.data?.archive_retention_years != null) {
      setRetentionInput(String(orgQuery.data.archive_retention_years));
    }
  }, [orgQuery.data?.archive_retention_years]);

  const parsedRetention = parseInt(retentionInput, 10);
  const retentionValid = Number.isInteger(parsedRetention) && parsedRetention >= 1 && parsedRetention <= 10;
  const retentionChanged = retentionValid && parsedRetention !== orgQuery.data?.archive_retention_years;

  const handleSaveRetention = async () => {
    if (!retentionChanged) return;
    await updateOrg.mutateAsync({ archive_retention_years: parsedRetention });
    setRetentionSavedFlash(true);
    setTimeout(() => setRetentionSavedFlash(false), 2000);
  };

  const handlePickAvatar = async () => {
    if (!user) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const optimized = await optimizeImage(asset.uri, asset.width, asset.height);
    const uploaded = await uploadFile(optimized.uri, `avatar-${user.id}.jpg`, 'image/jpeg');
    await updateProfile.mutateAsync({ id: user.id, body: { avatar_url: uploaded.url } });
  };

  const handleSave = async () => {
    if (!user) return;
    await updateProfile.mutateAsync({
      id: user.id,
      body: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        company_name: companyName.trim() || undefined,
      },
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (newPassword.length < 8) {
      setPasswordError(t('auth.passwordMin8'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('auth.passwordsMismatch'));
      return;
    }
    try {
      await updatePassword.mutateAsync({ current_password: currentPassword, new_password: newPassword });
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert(t('profile.passwordChanged'), t('profile.passwordChangedBody'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      setPasswordError(msg.includes('Current') ? t('profile.wrongCurrentPassword') : msg);
    }
  };

  /**
   * Suppression definitive du compte. En cas de succes le contexte vide la session,
   * ce qui renvoie automatiquement l'utilisateur sur l'ecran de connexion — pas de
   * navigation manuelle a faire ici.
   */
  const handleDeleteAccount = async () => {
    setDeleteError('');
    if (!deletePassword) {
      setDeleteError(t('profile.deleteAccountPassword'));
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
    } catch (err) {
      // Message du serveur affiche tel quel : il porte le cas « dernier administrateur ».
      setDeleteError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setDeleting(false);
      setDeletePassword('');
    }
  };

  const hasChanges = user && (
    firstName !== (user.first_name || '') ||
    lastName !== (user.last_name || '') ||
    email !== (user.email || '') ||
    phone !== (user.phone || '') ||
    companyName !== (user.company_name || '')
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
                setRefreshing(false);
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >

          {user && (
            <>
              {/* Avatar + email */}
              <View style={[styles.identityCard, { backgroundColor: colors.surface, borderColor: colors.border }, Shadow.sm]}>
                <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.7}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
                    {user.avatar_url ? (
                      <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
                    ) : (
                      <Text style={[styles.avatarText, { color: colors.primary }]}>
                        {user.first_name[0]}{user.last_name[0]}
                      </Text>
                    )}
                    <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
                      <Camera size={12} color="#FFFFFF" />
                    </View>
                  </View>
                </TouchableOpacity>
                <View style={styles.identityInfo}>
                  <Text style={[styles.email, { color: colors.text }]}>{user.email}</Text>
                  <View style={[styles.roleBadge, { backgroundColor: colors.primary + '15' }]}>
                    <Text style={[styles.roleText, { color: colors.primary }]}>{user.role}</Text>
                  </View>
                </View>
              </View>

              {/* Settings — Informations personnelles */}
              <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('profile.personalInfo')}</Text>
              <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.row}>
                  <View style={styles.halfField}>
                    <Text style={[styles.label, { color: colors.text2 }]}>{t('auth.firstName')}</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                      value={firstName}
                      onChangeText={setFirstName}
                      accessibilityLabel={t('auth.firstName')}
                    />
                  </View>
                  <View style={styles.halfField}>
                    <Text style={[styles.label, { color: colors.text2 }]}>{t('auth.lastName')}</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                      value={lastName}
                      onChangeText={setLastName}
                      accessibilityLabel={t('auth.lastName')}
                    />
                  </View>
                </View>

                <Text style={[styles.label, { color: colors.text2 }]}>{t('auth.email')}</Text>
                <View style={styles.inputRow}>
                  <Mail size={IconSize.md} color={colors.mutedText} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.inputWithIcon, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel={t('auth.email')}
                  />
                </View>

                <Text style={[styles.label, { color: colors.text2 }]}>{t('auth.phone')}</Text>
                <View style={styles.inputRow}>
                  <Phone size={IconSize.md} color={colors.mutedText} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.inputWithIcon, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="06 12 34 56 78"
                    placeholderTextColor={colors.placeholder}
                    accessibilityLabel={t('auth.phone')}
                  />
                </View>

                <Text style={[styles.label, { color: colors.text2 }]}>{t('auth.company')}</Text>
                <View style={styles.inputRow}>
                  <Building2 size={IconSize.md} color={colors.mutedText} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.inputWithIcon, {
                      backgroundColor: (user.role === 'admin' || user.role === 'client') ? colors.itemBackground : colors.border + '30',
                      color: colors.text,
                      borderColor: colors.border,
                    }]}
                    value={companyName}
                    onChangeText={setCompanyName}
                    editable={user.role === 'admin' || user.role === 'client'}
                    placeholder="EIFFAGE, Bouygues..."
                    placeholderTextColor={colors.placeholder}
                    accessibilityLabel={t('auth.company')}
                  />
                </View>
                {user.role !== 'admin' && user.role !== 'client' && (
                  <Text style={[styles.hint, { color: colors.mutedText }]}>{t('profile.onlyAdminCompany')}</Text>
                )}

                {hasChanges && (
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: savedFlash ? colors.green : colors.primary }]}
                    onPress={handleSave}
                    disabled={updateProfile.isPending}
                    accessibilityRole="button"
                    accessibilityLabel={t('common.save')}
                  >
                    {updateProfile.isPending ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : savedFlash ? (
                      <>
                        <Check size={IconSize.md} color="#FFFFFF" />
                        <Text style={styles.saveBtnText}>{t('common.saved')}</Text>
                      </>
                    ) : (
                      <>
                        <Save size={IconSize.md} color="#FFFFFF" />
                        <Text style={styles.saveBtnText}>{t('profile.saveChanges')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {/* Security */}
              <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('profile.securitySection')}</Text>
              <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.securityBtn, { borderColor: colors.border }]}
                  onPress={() => setShowPasswordModal(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('profile.changePassword')}
                >
                  <KeyRound size={IconSize.md} color={colors.primary} />
                  <Text style={[styles.securityBtnText, { color: colors.text }]}>
                    {t('profile.changePassword')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Notifications */}
              <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('profile.notificationsSection')}</Text>
              <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.notifRow}>
                  <View style={[styles.notifIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Bell size={IconSize.md} color={colors.primary} />
                  </View>
                  <View style={styles.notifInfo}>
                    <Text style={[styles.notifTitle, { color: colors.text }]}>
                      {t('profile.pushTitle')}
                    </Text>
                    <Text style={[styles.notifHint, { color: colors.mutedText }]}>
                      {t('profile.pushHint')}
                    </Text>
                  </View>
                  <Switch
                    value={user.push_enabled}
                    onValueChange={(value) => updatePushPref.mutate(value)}
                    disabled={updatePushPref.isPending}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#FFFFFF"
                    accessibilityLabel={t('profile.enablePush')}
                  />
                </View>
              </View>

              {/* Mes organisations */}
              <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('profile.orgsSection')}</Text>
              <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {(user?.memberships ?? []).map((m) => {
                  const isActive = m.organization_id === user?.active_organization_id;
                  const orgUnread = unreadSummary.data?.by_organization[m.organization_id] ?? 0;
                  return (
                    <View
                      key={m.organization_id}
                      style={[styles.orgRow, { borderColor: colors.border }]}
                    >
                      <View style={[styles.orgIcon, { backgroundColor: colors.primary + '15' }]}>
                        <Building2 size={IconSize.md} color={colors.primary} />
                      </View>
                      <View style={styles.orgInfo}>
                        <Text style={[styles.orgName, { color: colors.text }]} numberOfLines={1}>
                          {m.organization_name}
                        </Text>
                        <Text style={[styles.orgRole, { color: colors.mutedText }]}>
                          {m.role === 'admin'
                            ? t('collab.role.admin')
                            : m.role === 'manager'
                              ? t('collab.role.manager')
                              : m.role === 'employee'
                                ? t('collab.role.employee')
                                : m.role === 'client'
                                  ? t('collab.role.client')
                                  : t('collab.role.gestionnaireReseau')}
                        </Text>
                      </View>
                      {orgUnread > 0 ? (
                        <View style={[styles.orgUnreadBadge, { backgroundColor: colors.primary }]}>
                          <Text style={styles.orgUnreadBadgeText}>
                            {orgUnread > 99 ? '99+' : orgUnread}
                          </Text>
                        </View>
                      ) : null}
                      {isActive ? (
                        <View style={[styles.orgActiveBadge, { backgroundColor: colors.primary + '20' }]}>
                          <Check size={14} color={colors.primary} />
                          <Text style={[styles.orgActiveText, { color: colors.primary }]}>{t('profile.orgCurrent')}</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.orgSwitchBtn, { backgroundColor: colors.primary }]}
                          onPress={() => {
                            switchOrg.mutate(m.organization_id, {
                              onError: (err) =>
                                Alert.alert(t('common.error'), err instanceof Error ? err.message : t('profile.cannotSwitch')),
                            });
                          }}
                          disabled={switchOrg.isPending}
                          accessibilityLabel={`Changer de compte vers ${m.organization_name}`}
                        >
                          {switchOrg.isPending ? (
                            <ActivityIndicator color="#FFFFFF" />
                          ) : (
                            <>
                              <ArrowRightLeft size={14} color="#FFFFFF" />
                              <Text style={styles.orgSwitchText}>{t('profile.switchAccount')}</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}

                <TouchableOpacity
                  style={[styles.createOrgBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
                  onPress={() => setShowCreateOrgModal(true)}
                  accessibilityLabel={t('profile.createOrg')}
                >
                  <Plus size={IconSize.md} color={colors.primary} />
                  <Text style={[styles.createOrgText, { color: colors.primary }]}>
                    {t('profile.createOrg')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Calendars */}
              <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('profile.calendarsSection')}</Text>
              <CalendarIntegrations />

              {/* Admin — Informations légales */}
              {isAdmin && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('legal.sectionTitle')}</Text>
                  <TouchableOpacity
                    style={[styles.settingsCard, styles.legalRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => router.push('/organization-legal')}
                    accessibilityRole="button"
                    accessibilityLabel={t('legal.openButton')}
                  >
                    <FileText size={IconSize.md} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.legalRowTitle, { color: colors.text }]}>{t('legal.openButton')}</Text>
                      <Text style={[styles.hint, { color: colors.mutedText }]}>{t('legal.openButtonHint')}</Text>
                    </View>
                    <ChevronRight size={IconSize.sm} color={colors.mutedText} />
                  </TouchableOpacity>
                </>
              )}

              {/* Admin — Conservation des archives */}
              {isAdmin && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('profile.archivesSection')}</Text>
                  <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.label, { color: colors.text2 }]}>{t('profile.retentionLabel')}</Text>
                    <View style={styles.retentionInputRow}>
                      <TextInput
                        style={[
                          styles.retentionInput,
                          {
                            backgroundColor: colors.itemBackground,
                            color: colors.text,
                            borderColor: retentionInput && !retentionValid ? colors.red : colors.border,
                          },
                        ]}
                        value={retentionInput}
                        onChangeText={(v) => setRetentionInput(v.replace(/[^0-9]/g, '').slice(0, 2))}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholder="1-10"
                        placeholderTextColor={colors.placeholder}
                        accessibilityLabel={t('profile.retentionA11y')}
                      />
                      <Text style={[styles.retentionUnit, { color: colors.text2 }]}>
                        {parsedRetention === 1 ? 'an' : 'ans'}
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.retentionSaveBtn,
                          {
                            backgroundColor: retentionSavedFlash
                              ? colors.green
                              : retentionChanged
                                ? colors.primary
                                : colors.itemBackground,
                            opacity: retentionChanged || retentionSavedFlash ? 1 : 0.5,
                          },
                        ]}
                        onPress={handleSaveRetention}
                        disabled={!retentionChanged || updateOrg.isPending}
                        accessibilityRole="button"
                        accessibilityLabel={t('profile.retentionSave')}
                      >
                        {updateOrg.isPending ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : retentionSavedFlash ? (
                          <Check size={IconSize.md} color="#FFFFFF" />
                        ) : (
                          <Save size={IconSize.md} color={retentionChanged ? '#FFFFFF' : colors.mutedText} />
                        )}
                      </TouchableOpacity>
                    </View>
                    {retentionInput && !retentionValid && (
                      <Text style={[styles.hint, { color: colors.red }]}>
                        {t('profile.retentionRange')}
                      </Text>
                    )}
                    <Text style={[styles.hint, { color: colors.mutedText }]}>
                      {t('profile.retentionHint')}
                    </Text>
                  </View>
                </>
              )}

              {/* Settings — Apparence */}
              <Text style={[styles.sectionTitle, { color: colors.text2 }]}>{t('profile.appearance')}</Text>
              <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.text2 }]}>{t('profile.theme')}</Text>
                <View style={styles.themeRow}>
                  {THEME_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = mode === opt.mode;
                    return (
                      <TouchableOpacity
                        key={opt.mode}
                        style={[
                          styles.themeOption,
                          {
                            backgroundColor: isActive ? colors.primary + '20' : colors.itemBackground,
                            borderColor: isActive ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setMode(opt.mode)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isActive }}
                        accessibilityLabel={t(opt.key)}
                      >
                        <Icon size={IconSize.lg} color={isActive ? colors.primary : colors.text2} />
                        <Text style={[styles.themeLabel, { color: isActive ? colors.primary : colors.text2 }]}>
                          {t(opt.key)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Language picker */}
                <Text style={[styles.label, { color: colors.text2, marginTop: Spacing.lg }]}>{t('profile.language')}</Text>
                <View style={styles.langGrid}>
                  {LOCALES.map((loc) => {
                    const isActive = locale === loc.code;
                    return (
                      <TouchableOpacity
                        key={loc.code}
                        style={[
                          styles.langOption,
                          {
                            backgroundColor: isActive ? colors.primary + '20' : colors.itemBackground,
                            borderColor: isActive ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setLocale(loc.code)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isActive }}
                        accessibilityLabel={loc.label}
                      >
                        <Text style={styles.langFlag}>{loc.flag}</Text>
                        <Text style={[styles.langLabel, { color: isActive ? colors.primary : colors.text2 }]}>
                          {loc.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Logout */}
              <TouchableOpacity
                style={[styles.logoutBtn, { borderColor: colors.red }]}
                onPress={logout}
                accessibilityRole="button"
                accessibilityLabel={t('profile.logout')}
              >
                <LogOut size={IconSize.md} color={colors.red} />
                <Text style={[styles.logoutText, { color: colors.red }]}>{t('profile.logout')}</Text>
              </TouchableOpacity>

              {/* Suppression de compte — requis par l'App Store (guideline 5.1.1(v)) */}
              <TouchableOpacity
                style={styles.deleteAccountBtn}
                onPress={() => { setDeleteError(''); setDeletePassword(''); setShowDeleteModal(true); }}
                accessibilityRole="button"
                accessibilityLabel={t('profile.deleteAccount')}
              >
                <Trash2 size={IconSize.sm} color={colors.mutedText} />
                <Text style={[styles.deleteAccountText, { color: colors.mutedText }]}>
                  {t('profile.deleteAccount')}
                </Text>
              </TouchableOpacity>

              {/* Version affichee pour le support : savoir si un correctif OTA
                  est bien arrive chez l'utilisateur evite de chercher a l'aveugle. */}
              <Text style={[styles.versionText, { color: colors.mutedText }]}>
                Buildr {Updates.runtimeVersion ?? '?'}
                {' · '}
                {Updates.isEmbeddedLaunch
                  ? t('profile.versionInstalled')
                  : Updates.createdAt
                    ? t('profile.versionUpdatedOn', { date: Updates.createdAt.toLocaleDateString(locale) })
                    : t('profile.versionUpdated')}
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Change password modal */}
      <Modal visible={showPasswordModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, { backgroundColor: colors.surface }, animatedPasswordModalStyle]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('profile.changePassword')}</Text>
              <TouchableOpacity onPress={() => { setShowPasswordModal(false); setPasswordError(''); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <X size={IconSize.lg} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.text2 }]}>{t('profile.currentPassword')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              accessibilityLabel={t('profile.currentPassword')}
            />

            <Text style={[styles.label, { color: colors.text2 }]}>{t('auth.newPassword')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              placeholder={t('auth.min8chars')}
              placeholderTextColor={colors.placeholder}
              accessibilityLabel={t('auth.newPassword')}
            />

            <Text style={[styles.label, { color: colors.text2 }]}>{t('common.confirm')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              accessibilityLabel={t('auth.confirmPassword')}
            />

            {passwordError ? (
              <Text style={[styles.error, { color: colors.red }]}>{passwordError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: Spacing.lg }]}
              onPress={handleChangePassword}
              disabled={updatePassword.isPending}
              accessibilityRole="button"
              accessibilityLabel={t('common.validate')}
            >
              {updatePassword.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>{t('profile.updatePassword')}</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Create organization modal */}
      <Modal visible={showCreateOrgModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, { backgroundColor: colors.surface }, animatedCreateOrgModalStyle]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('profile.newOrg')}</Text>
              <TouchableOpacity
                onPress={() => setShowCreateOrgModal(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={IconSize.lg} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.dashRedirectBubble, { backgroundColor: colors.primary + '15' }]}>
              <Building2 size={IconSize.lg} color={colors.primary} />
            </View>
            <Text style={[styles.dashRedirectTitle, { color: colors.text }]}>
              {t('profile.orgOnDashboard')}
            </Text>
            <Text style={[styles.dashRedirectBody, { color: colors.text2 }]}>
              {t('profile.orgOnDashboardBody')}
            </Text>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: Spacing.lg, flexDirection: 'row', gap: Spacing.sm }]}
              onPress={handleOpenDashboardCreateOrg}
              accessibilityRole="link"
              accessibilityLabel={t('profile.openDashboardOrgA11y')}
            >
              <ExternalLink size={IconSize.sm} color="#FFFFFF" />
              <Text style={[styles.saveBtnText, { color: '#FFFFFF' }]}>{t('register.openDashboard')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Delete account modal */}
      <Modal visible={showDeleteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, { backgroundColor: colors.surface }, animatedDeleteModalStyle]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('profile.deleteAccountTitle')}</Text>
              <TouchableOpacity
                onPress={() => { setShowDeleteModal(false); setDeleteError(''); setDeletePassword(''); }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={IconSize.lg} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.deleteWarningBubble, { backgroundColor: colors.red + '15' }]}>
              <AlertTriangle size={IconSize.lg} color={colors.red} />
            </View>
            <Text style={[styles.deleteWarningText, { color: colors.text2 }]}>{t('profile.deleteAccountWarning')}</Text>

            <Text style={[styles.label, { color: colors.text2 }]}>{t('profile.deleteAccountPassword')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={deletePassword}
              onChangeText={setDeletePassword}
              secureTextEntry
              autoCapitalize="none"
              accessibilityLabel={t('profile.deleteAccountPassword')}
            />

            {deleteError ? (
              <Text style={[styles.error, { color: colors.red }]}>{deleteError}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.red, marginTop: Spacing.lg }]}
              onPress={handleDeleteAccount}
              disabled={deleting}
              accessibilityRole="button"
              accessibilityLabel={t('profile.deleteAccountConfirm')}
            >
              {deleting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>{t('profile.deleteAccountConfirm')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteCancelBtn}
              onPress={() => { setShowDeleteModal(false); setDeleteError(''); setDeletePassword(''); }}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={[styles.deleteCancelText, { color: colors.text2 }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.xxl, paddingTop: Spacing.lg, paddingBottom: Spacing.xxxl * 2, gap: Spacing.md },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },

  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  avatarImage: { width: 56, height: 56, borderRadius: 28 },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  avatarText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  versionText: { fontSize: FontSize.xs, textAlign: 'center', marginTop: Spacing.lg, marginBottom: Spacing.md },
  identityInfo: { flex: 1, gap: Spacing.xs },
  email: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  roleBadge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  roleText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textTransform: 'capitalize' },

  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, marginTop: Spacing.lg, marginLeft: Spacing.sm },

  settingsCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  legalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  legalRowTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  dashRedirectBubble: {
    height: 56,
    width: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  dashRedirectTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, marginTop: Spacing.md },
  dashRedirectBody: { fontSize: FontSize.base, lineHeight: 22, marginTop: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.md },
  halfField: { flex: 1 },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginTop: Spacing.sm },
  hint: { fontSize: FontSize.xs, marginTop: Spacing.xs, fontStyle: 'italic' },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.base,
    marginTop: Spacing.xs,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs, position: 'relative' },
  inputIcon: { position: 'absolute', left: Spacing.md, zIndex: 1 },
  inputWithIcon: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingLeft: 44,
    paddingRight: Spacing.md,
    fontSize: FontSize.base,
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 44,
    borderRadius: Radius.md,
    marginTop: Spacing.md,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold },

  retentionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  retentionInput: {
    width: 80,
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: FontSize.base,
    fontWeight: FontWeight.semibold,
    textAlign: 'center',
  },
  retentionUnit: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  retentionSaveBtn: {
    marginLeft: 'auto',
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  themeRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  themeLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    minWidth: 130,
  },
  langFlag: { fontSize: 20 },
  langLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    marginTop: Spacing.xl,
  },
  logoutText: { fontSize: FontSize.base, fontWeight: FontWeight.medium },

  // Suppression de compte : volontairement discrete (pas de bordure rouge), pour ne pas
  // rivaliser visuellement avec la deconnexion tout en restant accessible.
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    height: 44,
    marginTop: Spacing.sm,
  },
  deleteAccountText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  deleteWarningBubble: {
    height: 56,
    width: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  deleteWarningText: { fontSize: FontSize.base, lineHeight: 22, marginBottom: Spacing.sm },
  deleteCancelBtn: { alignItems: 'center', justifyContent: 'center', height: 44, marginTop: Spacing.xs },
  deleteCancelText: { fontSize: FontSize.base, fontWeight: FontWeight.medium },

  securityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  securityBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.medium, flex: 1 },

  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  notifIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  notifInfo: { flex: 1 },
  notifTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  notifHint: { fontSize: FontSize.xs, marginTop: 2, lineHeight: FontSize.xs * 1.4 },

  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
  },
  orgIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  orgInfo: { flex: 1 },
  orgName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  orgRole: { fontSize: FontSize.xs, marginTop: 2 },
  orgActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  orgActiveText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  orgUnreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgUnreadBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: FontWeight.bold },
  orgSwitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  orgSwitchText: { color: '#FFFFFF', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  createOrgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: Spacing.sm,
  },
  createOrgText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },

  error: { fontSize: FontSize.sm, marginTop: Spacing.sm },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl, gap: Spacing.xs },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold },
});
