import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  StyleSheet,
  Modal,
  Alert,
  Keyboard,
  Linking,
  Image,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserPlus, Mail, X, Trash2, Building2, Shield, UserX, UserCheck, Phone, Users, Search, Copy, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import type { TranslationKeys } from '@/i18n/translations';
import { useAllUsers, useTeam, useAddTeamMember, useRemoveTeamMember, useDeleteUser } from '@/api/hooks/useMembers';
import { useInvitations, useCreateInvitation, useCancelInvitation } from '@/api/hooks/useInvitations';
import { useUpdateProfile } from '@/api/hooks/useAuth';
import { useAuth } from '@/contexts/AuthContext';

function roleLabelKey(role: string): TranslationKeys {
  switch (role) {
    case 'admin': return 'collab.role.admin';
    case 'manager': return 'collab.role.manager';
    case 'employee': return 'collab.role.employee';
    case 'client': return 'collab.role.client';
    case 'gestionnaire_reseau': return 'collab.role.gestionnaireReseau';
    default: return 'collab.role.employee';
  }
}
import SearchBar from '@/components/SearchBar';
import AppHeader from '@/components/AppHeader';
import type { MeResponse } from '@/api/types';

// --------------- Team Modal (admin manages a manager's team) ---------------

const TEAM_ROLE_COLORS: Record<string, string> = {
  admin: '#D97706',
  manager: '#7C3AED',
  employee: '#2563EB',
  client: '#059669',
  gestionnaire_reseau: '#0891B2',
};

function TeamModal({ managerId, allUsers, colors, onClose, onAdd, onRemove, onRefreshUsers }: {
  managerId: string | null;
  allUsers: MeResponse[];
  colors: Record<string, string>;
  onClose: () => void;
  onAdd: (managerId: string, userId: string) => void;
  onRemove: (id: string) => void;
  onRefreshUsers: () => void;
}) {
  const { t } = useTranslation();
  const [teamSearch, setTeamSearch] = useState('');
  const [teamRoleFilter, setTeamRoleFilter] = useState<'all' | 'admin' | 'manager' | 'employee' | 'client'>('all');
  const animatedTeamModalStyle = useKeyboardAwareModalStyle({ visible: !!managerId });

  const { data: teamData, refetch: refetchTeam, isRefetching: teamRefetching } = useTeam(managerId ?? undefined);
  const teamMembers = teamData?.data ?? [];
  const teamUserIds = new Set(teamMembers.map((m) => m.user_id));

  const available = allUsers.filter((u) => {
    if (teamUserIds.has(u.id) || u.id === managerId) return false;
    if (teamRoleFilter !== 'all' && u.role !== teamRoleFilter) return false;
    if (teamSearch.trim()) {
      const q = teamSearch.toLowerCase();
      return `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.company_name || '').toLowerCase().includes(q);
    }
    return true;
  });

  const manager = allUsers.find((u) => u.id === managerId);

  if (!managerId) return null;

  const renderUser = (user: { id: string; first_name: string; last_name: string; email: string; role: string; company_name?: string; avatar_url?: string | null }, action: React.ReactNode) => {
    const roleColor = TEAM_ROLE_COLORS[user.role] || '#6B7280';
    const roleLabel = t(roleLabelKey(user.role));
    return (
      <View key={user.id} style={[teamStyles.card, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}>
        <View style={[teamStyles.avatar, { backgroundColor: roleColor + '20' }]}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={teamStyles.avatarImage} />
          ) : (
            <Text style={[teamStyles.avatarText, { color: roleColor }]}>
              {user.first_name[0]}{user.last_name[0]}
            </Text>
          )}
        </View>
        <View style={teamStyles.info}>
          <Text style={[teamStyles.name, { color: colors.text }]}>{user.first_name} {user.last_name}</Text>
          <Text style={[teamStyles.email, { color: colors.mutedText }]}>{user.email}</Text>
          {user.company_name && (
            <Text style={[teamStyles.email, { color: colors.text2 }]}>{user.company_name}</Text>
          )}
        </View>
        <View style={[teamStyles.roleBadge, { backgroundColor: roleColor + '15' }]}>
          <Text style={[teamStyles.roleText, { color: roleColor }]}>{roleLabel}</Text>
        </View>
        {action}
      </View>
    );
  };

  return (
    <Modal visible={!!managerId} transparent animationType="slide" onRequestClose={() => { onClose(); setTeamSearch(''); setTeamRoleFilter('all'); }}>
      <View style={teamStyles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => { onClose(); setTeamSearch(''); setTeamRoleFilter('all'); }} />
        <Animated.View style={[teamStyles.content, { backgroundColor: colors.surface }, animatedTeamModalStyle]}>
          <View style={teamStyles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 }}>
              {manager && (
                <View style={[teamStyles.headerAvatar, { backgroundColor: '#7C3AED20' }]}>
                  <Text style={[teamStyles.headerAvatarText, { color: '#7C3AED' }]}>
                    {manager.first_name[0]}{manager.last_name[0]}
                  </Text>
                </View>
              )}
              <View>
                <Text style={[teamStyles.title, { color: colors.text }]}>{t('tabs.team')}</Text>
                {manager && (
                  <Text style={[teamStyles.sub, { color: colors.mutedText }]}>
                    {manager.first_name} {manager.last_name}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={() => { onClose(); setTeamSearch(''); setTeamRoleFilter('all'); }}>
              <X size={IconSize.lg} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search + role filter */}
          <View style={[teamStyles.searchBox, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}>
            <Search size={16} color={colors.placeholder} />
            <TextInput
              style={[teamStyles.searchInput, { color: colors.text }]}
              placeholder={t('common.search')}
              placeholderTextColor={colors.placeholder}
              value={teamSearch}
              onChangeText={setTeamSearch}
            />
          </View>
          <View style={teamStyles.roleFilterRow}>
            {(['all', 'admin', 'manager', 'employee', 'client'] as const).map((r) => {
              const active = teamRoleFilter === r;
              const chipColor = r === 'all' ? colors.primary : TEAM_ROLE_COLORS[r];
              return (
                <TouchableOpacity
                  key={r}
                  style={[teamStyles.roleChip, { backgroundColor: active ? chipColor + '20' : colors.itemBackground, borderColor: active ? chipColor : colors.border }]}
                  onPress={() => setTeamRoleFilter(r)}
                >
                  <Text style={[teamStyles.roleChipText, { color: active ? chipColor : colors.text2 }]}>
                    {r === 'all' ? t('common.all') : t(roleLabelKey(r))}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <FlatList
            data={[
              ...(teamMembers.length > 0
                ? [{ type: 'header' as const, label: t('team.membersCount', { count: teamMembers.length }) }]
                : []),
              ...teamMembers.map((m) => ({ type: 'member' as const, user: m })),
              { type: 'header' as const, label: t('common.addSection') },
              ...available.map((u) => ({ type: 'available' as const, user: u })),
            ]}
            keyExtractor={(item, i) => item.type === 'header' ? `h-${i}` : item.user.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl
                refreshing={teamRefetching}
                onRefresh={() => { refetchTeam(); onRefreshUsers(); }}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            renderItem={({ item }) => {
              if (item.type === 'header') {
                return <Text style={[teamStyles.sectionLabel, { color: colors.text2, marginTop: Spacing.sm }]}>{item.label}</Text>;
              }
              if (item.type === 'member') {
                return renderUser(item.user, (
                  <TouchableOpacity
                    style={teamStyles.removeBtn}
                    onPress={() => {
                      Alert.alert(
                        t('team.remove'),
                        t('team.removeFromTeamConfirm', {
                          name: `${item.user.first_name} ${item.user.last_name}`,
                        }),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          { text: t('team.remove'), style: 'destructive', onPress: () => onRemove(item.user.id) },
                        ],
                      );
                    }}
                  >
                    <Trash2 size={IconSize.md} color={colors.red} />
                  </TouchableOpacity>
                ));
              }
              return renderUser(item.user, (
                <TouchableOpacity
                  style={teamStyles.addBtn}
                  onPress={() => onAdd(managerId!, item.user.id)}
                >
                  <UserPlus size={IconSize.md} color="#7C3AED" />
                </TouchableOpacity>
              ));
            }}
            ListEmptyComponent={
              <Text style={[teamStyles.empty, { color: colors.mutedText }]}>
                {teamSearch ? t('team.noResult') : t('collab.noUserAvailable')}
              </Text>
            }
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const teamStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  content: { borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerAvatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold },
  sub: { fontSize: FontSize.sm, marginTop: 2 },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },
  avatarText: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  info: { flex: 1 },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  email: { fontSize: FontSize.xs },
  roleBadge: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.pill },
  roleText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  removeBtn: { marginLeft: Spacing.sm },
  addBtn: { marginLeft: Spacing.sm },
  empty: { fontSize: FontSize.sm, paddingVertical: Spacing.lg, textAlign: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, height: 40, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSize.base, height: 40 },
  roleFilterRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  roleChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill, borderWidth: 1 },
  roleChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
});

// --------------- Main Screen ---------------

const ROLE_COLORS: Record<string, string> = {
  admin: '#D97706',
  manager: '#7C3AED',
  employee: '#2563EB',
  client: '#059669',
  gestionnaire_reseau: '#0891B2',
};

export default function CollaborateursScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t, locale } = useTranslation();

  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers, isRefetching: usersRefetching } = useAllUsers();
  const { data: invitationsData } = useInvitations();
  const createInvite = useCreateInvitation();
  const cancelInvite = useCancelInvitation();
  const updateProfile = useUpdateProfile();

  const addTeamMember = useAddTeamMember();
  const removeTeamMember = useRemoveTeamMember();
  const deleteUser = useDeleteUser();

  const handleDeleteUser = useCallback(
    (userId: string, name: string) => {
      Alert.alert(
        t('profile.deleteAccountConfirm'),
        t('collab.deleteBody', { name }),
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteUser.mutateAsync(userId);
                setSelectedUser(null);
              } catch (err) {
                Alert.alert(t('common.error'), err instanceof Error ? err.message : t('chantier.deleteFailed'));
              }
            },
          },
        ],
      );
    },
    [deleteUser],
  );

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'manager' | 'employee' | 'client'>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'employee' | 'client' | 'gestionnaire_reseau'>('employee');
  const [selectedUser, setSelectedUser] = useState<MeResponse | null>(null);
  const [copiedField, setCopiedField] = useState<'email' | 'phone' | null>(null);
  const animatedInviteModalStyle = useKeyboardAwareModalStyle({ visible: showInviteModal });

  const copyToClipboard = useCallback(async (value: string, field: 'email' | 'phone') => {
    await Clipboard.setStringAsync(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }, []);
  const [showTeamModal, setShowTeamModal] = useState<string | null>(null); // manager_id

  const handleUpdateRole = useCallback(async (userId: string, role: 'admin' | 'manager' | 'employee' | 'client') => {
    await updateProfile.mutateAsync({ id: userId, body: { role } });
    setSelectedUser((prev) => (prev ? { ...prev, role } : null));
  }, [updateProfile]);

  const handleToggleActive = useCallback(async (u: MeResponse) => {
    const newActive = !u.is_active;
    await updateProfile.mutateAsync({ id: u.id, body: { is_active: newActive } });
    setSelectedUser({ ...u, is_active: newActive });
  }, [updateProfile]);

  const users = usersData?.data ?? [];
  const invitations = (invitationsData?.data ?? []).filter((i) => i.status === 'pending');

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.company_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return;
    await createInvite.mutateAsync({ email: inviteEmail.trim(), role: inviteRole });
    setInviteEmail('');
    setShowInviteModal(false);
  }, [inviteEmail, inviteRole, createInvite]);

  const handleCancelInvite = useCallback(
    (id: string, email: string) => {
      Alert.alert(t('common.cancel'), t('collab.cancelInviteConfirm', { email }), [
        { text: t('common.no'), style: 'cancel' },
        { text: t('common.yes'), style: 'destructive', onPress: () => cancelInvite.mutate(id) },
      ]);
    },
    [cancelInvite, t],
  );

  const renderUser = useCallback(
    ({ item }: { item: MeResponse }) => {
      const roleColor = ROLE_COLORS[item.role] || colors.primary;
      const isInactive = item.is_active === false;
      return (
        <TouchableOpacity
          style={[
            styles.userCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
            Shadow.sm,
            isInactive && { opacity: 0.5 },
          ]}
          onPress={() => setSelectedUser(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${item.first_name} ${item.last_name}`}
        >
          <View style={[styles.avatar, { backgroundColor: roleColor + '20' }]}>
            {item.avatar_url ? (
              <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarText, { color: roleColor }]}>
                {item.first_name[0]}{item.last_name[0]}
              </Text>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {item.first_name} {item.last_name}
              {isInactive && ` ${t('collab.deactivatedSuffix')}`}
            </Text>
            <Text style={[styles.userEmail, { color: colors.mutedText }]}>{item.email}</Text>
            {item.company_name && (
              <View style={styles.companyRow}>
                <Building2 size={IconSize.sm} color={colors.text2} />
                <Text style={[styles.companyName, { color: colors.text2 }]}>{item.company_name}</Text>
              </View>
            )}
          </View>
          <View style={[styles.roleBadge, { backgroundColor: roleColor + '15' }]}>
            <Text style={[styles.roleText, { color: roleColor }]}>{t(roleLabelKey(item.role))}</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [colors, isAdmin],
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader>
        {(isAdmin || currentUser?.role === 'manager') && (
          <TouchableOpacity
            style={[styles.inviteBtn, { backgroundColor: colors.primary }]}
            onPress={() => setShowInviteModal(true)}
            accessibilityRole="button"
            accessibilityLabel={t('collab.inviteColleague')}
          >
            <UserPlus size={IconSize.md} color="#FFFFFF" />
            <Text style={styles.inviteBtnText}>{t('collab.invite')}</Text>
          </TouchableOpacity>
        )}
      </AppHeader>

      <View style={styles.searchContainer}>
        <SearchBar value={search} onChangeText={setSearch} placeholder={t('collab.search')} />
      </View>

      <View style={styles.filterContainer}>
        {(['all', 'admin', 'manager', 'employee', 'client'] as const).map((role) => {
          const isActive = roleFilter === role;
          const chipColor = role === 'all' ? colors.primary : ROLE_COLORS[role];
          const label = role === 'all' ? t('common.all') : t(roleLabelKey(role));
          return (
            <TouchableOpacity
              key={role}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? chipColor + '20' : colors.itemBackground,
                  borderColor: isActive ? chipColor : colors.border,
                },
              ]}
              onPress={() => setRoleFilter(role)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.filterChipText, { color: isActive ? chipColor : colors.text2 }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <View style={styles.invitationsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text2 }]}>
            Invitations en attente ({invitations.length})
          </Text>
          {invitations.map((inv) => (
            <View
              key={inv.id}
              style={[styles.inviteCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary + '30' }]}
            >
              <Mail size={IconSize.md} color={colors.primary} />
              <View style={styles.inviteInfo}>
                <Text style={[styles.inviteEmail, { color: colors.text }]}>{inv.email}</Text>
                <Text style={[styles.inviteRole, { color: colors.mutedText }]}>
                  {t(roleLabelKey(inv.role))} — expire le{' '}
                  {new Date(inv.expires_at).toLocaleDateString(locale)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleCancelInvite(inv.id, inv.email)}
                accessibilityRole="button"
                accessibilityLabel={t('collab.cancelInvite')}
              >
                <Trash2 size={IconSize.md} color={colors.red} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Users list */}
      <FlatList
        style={{ flex: 1 }}
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={[styles.list, { flexGrow: 1 }]}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        ListEmptyComponent={
          !usersLoading ? (
            <Text style={[styles.empty, { color: colors.mutedText }]}>{t('collab.empty')}</Text>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={usersRefetching}
            onRefresh={() => refetchUsers()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />

      {/* User management modal */}
      <Modal visible={!!selectedUser} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedUser(null)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            {selectedUser && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderInfo}>
                    <View style={[styles.modalAvatar, { backgroundColor: (ROLE_COLORS[selectedUser.role] || colors.primary) + '20' }]}>
                      <Text style={[styles.modalAvatarText, { color: ROLE_COLORS[selectedUser.role] || colors.primary }]}>
                        {selectedUser.first_name[0]}{selectedUser.last_name[0]}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.modalTitle, { color: colors.text }]}>
                        {selectedUser.first_name} {selectedUser.last_name}
                      </Text>
                      {selectedUser.company_name && (
                        <Text style={[styles.modalSub, { color: colors.text2 }]}>{selectedUser.company_name}</Text>
                      )}
                      <View style={[styles.modalRoleBadge, { backgroundColor: (ROLE_COLORS[selectedUser.role] || colors.primary) + '15' }]}>
                        <Text style={[styles.modalRoleBadgeText, { color: ROLE_COLORS[selectedUser.role] || colors.primary }]}>
                          {t(roleLabelKey(selectedUser.role))}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedUser(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <X size={IconSize.lg} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {/* Contact section — always visible */}
                <Text style={[styles.sectionLabel, { color: colors.text2 }]}>{t('common.contactSection')}</Text>
                <TouchableOpacity
                  style={[styles.contactRow, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}
                  onPress={() => Linking.openURL(`mailto:${selectedUser.email}`)}
                  accessibilityRole="button"
                  accessibilityLabel={t('collab.emailA11y', { email: selectedUser.email })}
                >
                  <View style={[styles.contactIcon, { backgroundColor: colors.primary + '15' }]}>
                    <Mail size={IconSize.md} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.contactLabel, { color: colors.text2 }]}>{t('auth.email')}</Text>
                    <Text style={[styles.contactValue, { color: colors.text }]}>{selectedUser.email}</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.copyContactBtn,
                      {
                        backgroundColor: copiedField === 'email' ? colors.green + '25' : colors.primary + '15',
                        borderColor: copiedField === 'email' ? colors.green : colors.primary,
                      },
                    ]}
                    onPress={() => copyToClipboard(selectedUser.email, 'email')}
                    accessibilityRole="button"
                    accessibilityLabel={t('team.copyEmail')}
                  >
                    {copiedField === 'email' ? (
                      <Check size={IconSize.sm} color={colors.green} />
                    ) : (
                      <Copy size={IconSize.sm} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                </TouchableOpacity>

                {selectedUser.phone ? (
                  <TouchableOpacity
                    style={[styles.contactRow, { backgroundColor: colors.itemBackground, borderColor: colors.border, marginTop: Spacing.sm }]}
                    onPress={() => Linking.openURL(`tel:${selectedUser.phone}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`Appeler ${selectedUser.phone}`}
                  >
                    <View style={[styles.contactIcon, { backgroundColor: colors.green + '15' }]}>
                      <Phone size={IconSize.md} color={colors.green} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.contactLabel, { color: colors.text2 }]}>{t('auth.phone')}</Text>
                      <Text style={[styles.contactValue, { color: colors.text }]}>{selectedUser.phone}</Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.copyContactBtn,
                        {
                          backgroundColor: copiedField === 'phone' ? colors.green + '25' : colors.green + '15',
                          borderColor: colors.green,
                        },
                      ]}
                      onPress={() => copyToClipboard(selectedUser.phone!, 'phone')}
                      accessibilityRole="button"
                      accessibilityLabel={t('team.copyPhone')}
                    >
                      {copiedField === 'phone' ? (
                        <Check size={IconSize.sm} color={colors.green} />
                      ) : (
                        <Copy size={IconSize.sm} color={colors.green} />
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                ) : null}

                {/* Admin-only sections */}
                {isAdmin && (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.text2, marginTop: Spacing.xl }]}>{t('collab.globalRole')}</Text>
                    <View style={styles.roleRow}>
                      {(['admin', 'manager', 'employee', 'client'] as const).map((role) => {
                        const isActive = selectedUser.role === role;
                        const color = ROLE_COLORS[role];
                        return (
                          <TouchableOpacity
                            key={role}
                            style={[
                              styles.roleOption,
                              {
                                backgroundColor: isActive ? color + '20' : colors.itemBackground,
                                borderColor: isActive ? color : colors.border,
                              },
                            ]}
                            onPress={() => handleUpdateRole(selectedUser.id, role)}
                          >
                            <Shield size={IconSize.sm} color={isActive ? color : colors.text2} />
                            <Text style={[styles.roleOptionText, { color: isActive ? color : colors.text2 }]}>
                              {t(roleLabelKey(role))}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Text style={[styles.sectionLabel, { color: colors.text2, marginTop: Spacing.xl }]}>{t('common.statusSection')}</Text>
                    <TouchableOpacity
                      style={[
                        styles.actionRow,
                        { borderColor: selectedUser.is_active === false ? colors.green : colors.red },
                      ]}
                      onPress={() => handleToggleActive(selectedUser)}
                      disabled={selectedUser.id === currentUser?.id}
                    >
                      {selectedUser.is_active === false ? (
                        <>
                          <UserCheck size={IconSize.md} color={colors.green} />
                          <Text style={[styles.actionLabel, { color: colors.green }]}>{t('collab.reactivate')}</Text>
                        </>
                      ) : (
                        <>
                          <UserX size={IconSize.md} color={colors.red} />
                          <Text style={[styles.actionLabel, { color: colors.red }]}>
                            {t('collab.deactivate')}
                            {selectedUser.id === currentUser?.id ? ` ${t('collab.yourselfSuffix')}` : ''}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <Text style={[styles.modalHint, { color: colors.mutedText }]}>
                      {t('collab.deactivateHint')}
                    </Text>

                    {selectedUser.id !== currentUser?.id && (
                      <>
                        <Text style={[styles.sectionLabel, { color: colors.text2, marginTop: Spacing.xl }]}>{t('common.deleteSection')}</Text>
                        <TouchableOpacity
                          style={[styles.actionRow, { borderColor: colors.red, backgroundColor: colors.red + '10' }]}
                          onPress={() =>
                            handleDeleteUser(selectedUser.id, `${selectedUser.first_name} ${selectedUser.last_name}`)
                          }
                          disabled={deleteUser.isPending}
                        >
                          <Trash2 size={IconSize.md} color={colors.red} />
                          <Text style={[styles.actionLabel, { color: colors.red }]}>
                            {t('profile.deleteAccountConfirm')}
                          </Text>
                        </TouchableOpacity>
                        <Text style={[styles.modalHint, { color: colors.mutedText }]}>
                          {t('collab.deleteHint')}
                        </Text>
                      </>
                    )}

                    {selectedUser.role === 'manager' && (
                      <>
                        <Text style={[styles.sectionLabel, { color: colors.text2, marginTop: Spacing.xl }]}>{t('collab.teamSection')}</Text>
                        <TouchableOpacity
                          style={[styles.actionRow, { borderColor: '#7C3AED' }]}
                          onPress={() => { setShowTeamModal(selectedUser.id); setSelectedUser(null); refetchUsers(); }}
                        >
                          <Users size={IconSize.md} color="#7C3AED" />
                          <Text style={[styles.actionLabel, { color: '#7C3AED' }]}>{t('collab.manageTeam')}</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Team management modal (admin only) */}
      <TeamModal
        managerId={showTeamModal}
        allUsers={users}
        colors={colors}
        onClose={() => setShowTeamModal(null)}
        onAdd={(managerId, userId) => addTeamMember.mutate({ manager_id: managerId, user_id: userId })}
        onRemove={(id) => removeTeamMember.mutate(id)}
        onRefreshUsers={() => refetchUsers()}
      />

      {/* Invite modal */}
      <Modal visible={showInviteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContent, { backgroundColor: colors.surface }, animatedInviteModalStyle]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('collab.inviteColleague')}</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button">
                <X size={IconSize.lg} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.text }]}>{t('auth.email')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              placeholder="collaborateur@email.com"
              placeholderTextColor={colors.placeholder}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              accessibilityLabel={t('collab.emailLabel')}
            />

            <Text style={[styles.label, { color: colors.text }]}>{t('collab.role')}</Text>
            <View style={styles.roleRow}>
              {(['employee', 'client', 'gestionnaire_reseau'] as const).map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleOption,
                    {
                      backgroundColor: inviteRole === role ? colors.primary + '20' : colors.itemBackground,
                      borderColor: inviteRole === role ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setInviteRole(role)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: inviteRole === role }}
                >
                  <Text style={[styles.roleOptionText, { color: inviteRole === role ? colors.primary : colors.text2 }]}>
                    {t(roleLabelKey(role))}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.sendInviteBtn, { backgroundColor: colors.primary }]}
              onPress={handleInvite}
              disabled={createInvite.isPending}
              accessibilityRole="button"
              accessibilityLabel={t('collab.sendInvite')}
            >
              <Text style={styles.sendInviteText}>{t('collab.sendInvite')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  inviteBtnText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  searchContainer: { paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.sm },
  filterContainer: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.md },
  filterChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.pill, borderWidth: 1 },
  filterChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  invitationsSection: { paddingHorizontal: Spacing.xxl, marginBottom: Spacing.md, gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, textTransform: 'uppercase' },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  inviteInfo: { flex: 1 },
  inviteEmail: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  inviteRole: { fontSize: FontSize.xs },
  list: { paddingHorizontal: Spacing.xxl, paddingBottom: 100 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  userInfo: { flex: 1 },
  userName: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  userEmail: { fontSize: FontSize.xs },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  companyName: { fontSize: FontSize.xs },
  roleBadge: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.pill },
  roleText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  empty: { fontSize: FontSize.base, textAlign: 'center', paddingTop: Spacing.xxxl },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold },
  label: { fontSize: FontSize.base, fontWeight: FontWeight.medium, marginTop: Spacing.md },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.base,
    marginTop: Spacing.xs,
  },
  roleRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  roleOption: { flex: 1, alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  roleOptionText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  modalSub: { fontSize: FontSize.sm, marginTop: 2 },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  actionLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  modalHint: { fontSize: FontSize.xs, marginTop: Spacing.md },
  modalHeaderInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  modalAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  modalAvatarText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  modalRoleBadge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill, marginTop: Spacing.xs },
  modalRoleBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  contactIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: FontSize.xs },
  contactValue: { fontSize: FontSize.base, fontWeight: FontWeight.medium, marginTop: 2 },
  copyContactBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendInviteBtn: {
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  sendInviteText: { color: '#FFFFFF', fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
});
