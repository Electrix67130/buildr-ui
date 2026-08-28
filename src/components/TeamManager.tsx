import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, Switch, Linking, RefreshControl } from 'react-native';
import Animated from 'react-native-reanimated';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { UserPlus, Trash2, Shield, Pencil, X, Mail, Phone, Search, Copy, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useChantierMembers, useAddMember, useRemoveMember, useUpdateMember, useAllUsers } from '@/api/hooks/useMembers';
import { chantierHooks } from '@/api/hooks/useChantiers';
import { useAuth } from '@/contexts/AuthContext';
import type { ChantierMemberRole, ChantierMember } from '@/api/types';
import { useTranslation } from '@/contexts/I18nContext';
import type { TranslationKeys } from '@/i18n/translations';

type MemberWithUser = ChantierMember & { first_name: string; last_name: string; email: string; phone?: string; company_name?: string; user_role?: 'admin' | 'manager' | 'employee' | 'client' | 'gestionnaire_reseau' };

const ROLE_LABEL_KEYS: Record<ChantierMemberRole, TranslationKeys> = {
  manager: 'collab.role.manager',
  ouvrier: 'team.role.ouvrier',
  client: 'collab.role.client',
  gestionnaire_reseau: 'collab.role.gestionnaireReseau',
};

const ROLE_COLORS: Record<ChantierMemberRole, string> = {
  manager: '#7C3AED',
  ouvrier: '#2563EB',
  client: '#059669',
  gestionnaire_reseau: '#0891B2',
};

// Cles i18n plutot que libelles : la liste est parcourue au rendu, ou `t` est
// disponible, donc rien n'oblige a figer le francais ici.
const PERMISSION_LABELS: { key: keyof ChantierMember; labelKey: TranslationKeys; descKey: TranslationKeys }[] = [
  { key: 'can_view_comments', labelKey: 'perm.viewDiscussions', descKey: 'perm.viewDiscussionsDesc' },
  { key: 'can_view_photos', labelKey: 'perm.viewPhotos', descKey: 'perm.viewPhotosDesc' },
  { key: 'can_view_documents', labelKey: 'perm.viewDocuments', descKey: 'perm.viewDocumentsDesc' },
  { key: 'can_view_steps', labelKey: 'perm.viewSteps', descKey: 'perm.viewStepsDesc' },
  { key: 'can_view_team', labelKey: 'perm.viewTeam', descKey: 'perm.viewTeamDesc' },
  { key: 'can_edit', labelKey: 'perm.editChantier', descKey: 'perm.editChantierDesc' },
];

type ExternalPerms = Pick<
  ChantierMember,
  | 'can_view_comments'
  | 'can_view_photos'
  | 'can_view_documents'
  | 'can_view_steps'
  | 'can_view_team'
  | 'can_edit'
>;

// Permissions par defaut alignees avec le backend DEFAULT_PERMISSIONS
const CLIENT_DEFAULT_PERMS: ExternalPerms = {
  can_view_comments: true,
  can_view_photos: true,
  can_view_documents: false,
  can_view_steps: false,
  can_view_team: true,
  can_edit: false,
};

const GESTIONNAIRE_RESEAU_DEFAULT_PERMS: ExternalPerms = {
  can_view_comments: false,
  can_view_photos: false,
  can_view_documents: true, // mais filtre serveur a DICT uniquement
  can_view_steps: false,
  can_view_team: false,
  can_edit: false,
};

interface Props {
  chantierId: string;
  readonly?: boolean;
}

const TeamManager: React.FC<Props> = ({ chantierId, readonly }) => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { user } = useAuth();
  const { data: chantier } = chantierHooks.useById(chantierId);

  const canManage = !readonly && !!user && (
    user.role === 'admin' || user.role === 'manager' || (chantier && chantier.created_by === user.id)
  );
  const canEditPerms = !readonly && !!user && (
    user.role === 'admin' || (chantier && chantier.created_by === user.id)
  );

  const { data: membersData, isLoading, refetch, isRefetching } = useChantierMembers(chantierId);
  const { data: usersData } = useAllUsers();
  const addMutation = useAddMember();
  const removeMutation = useRemoveMember();
  const updateMutation = useUpdateMember();

  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearch, setAddSearch] = useState('');

  const animatedModalStyle = useKeyboardAwareModalStyle({ visible: showAddModal });
  const [editingMember, setEditingMember] = useState<MemberWithUser | null>(null);
  const [viewingMember, setViewingMember] = useState<MemberWithUser | null>(null);
  const [pendingExternalAdd, setPendingExternalAdd] = useState<
    | {
        user_id: string;
        first_name: string;
        last_name: string;
        role: 'client' | 'gestionnaire_reseau';
        perms: ExternalPerms;
      }
    | null
  >(null);
  const [copiedField, setCopiedField] = useState<'email' | 'phone' | null>(null);

  const copyToClipboard = useCallback(async (value: string, field: 'email' | 'phone') => {
    await Clipboard.setStringAsync(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }, []);

  const members = membersData?.data ?? [];
  const memberUserIds = new Set(members.map((m) => m.user_id));
  const availableUsers = (usersData?.data ?? []).filter((u) => !memberUserIds.has(u.id));
  const filteredAvailable = useMemo(() => {
    if (!addSearch.trim()) return availableUsers;
    const q = addSearch.toLowerCase();
    return availableUsers.filter(
      (u) => `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.company_name || '').toLowerCase().includes(q),
    );
  }, [availableUsers, addSearch]);

  const handleRemove = useCallback((id: string, name: string) => {
    Alert.alert(t('team.remove'), t('team.removeFromChantierConfirm', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('team.remove'), style: 'destructive', onPress: () => removeMutation.mutate(id) },
    ]);
  }, [removeMutation, t]);

  const handleAdd = useCallback(
    (userId: string, role: ChantierMemberRole, firstName?: string, lastName?: string) => {
      // Pour un acteur externe (client ou gestionnaire reseau) on ouvre d'abord la modale
      // de permissions au lieu d'ajouter directement.
      if (role === 'client' || role === 'gestionnaire_reseau') {
        setShowAddModal(false);
        setAddSearch('');
        setPendingExternalAdd({
          user_id: userId,
          first_name: firstName ?? '',
          last_name: lastName ?? '',
          role,
          perms: { ...(role === 'client' ? CLIENT_DEFAULT_PERMS : GESTIONNAIRE_RESEAU_DEFAULT_PERMS) },
        });
        return;
      }
      addMutation.mutate({ chantier_id: chantierId, user_id: userId, role });
      setShowAddModal(false);
      setAddSearch('');
    },
    [chantierId, addMutation],
  );

  const confirmExternalAdd = useCallback(() => {
    if (!pendingExternalAdd) return;
    addMutation.mutate({
      chantier_id: chantierId,
      user_id: pendingExternalAdd.user_id,
      role: pendingExternalAdd.role,
      ...pendingExternalAdd.perms,
    });
    setPendingExternalAdd(null);
  }, [pendingExternalAdd, chantierId, addMutation]);

  const handleToggleRole = useCallback((member: MemberWithUser, newRole: ChantierMemberRole) => {
    updateMutation.mutate({ id: member.id, body: { role: newRole } });
  }, [updateMutation]);

  const handleTogglePermission = useCallback((member: MemberWithUser, key: keyof ChantierMember, value: boolean) => {
    updateMutation.mutate({ id: member.id, body: { [key]: value } as Partial<ChantierMember> });
  }, [updateMutation]);

  const renderMember = useCallback(
    ({ item }: { item: MemberWithUser }) => {
      const roleColor = ROLE_COLORS[item.role];
      return (
        <TouchableOpacity
          style={[styles.memberCard, { backgroundColor: colors.surface, borderColor: colors.border }, Shadow.sm]}
          onPress={() => setViewingMember(item)}
          activeOpacity={0.7}
        >
          <View style={styles.memberInfo}>
            <Text style={[styles.memberName, { color: colors.text }]}>
              {item.first_name} {item.last_name}
            </Text>
            <Text style={[styles.memberEmail, { color: colors.mutedText }]}>{item.email}</Text>
            {item.company_name && (
              <Text style={[styles.memberCompany, { color: colors.text2 }]}>{item.company_name}</Text>
            )}
          </View>
          <View style={[styles.roleBadge, { backgroundColor: roleColor + '20', borderColor: roleColor }]}>
            <Shield size={IconSize.sm} color={roleColor} />
            <Text style={[styles.roleText, { color: roleColor }]}>{t(ROLE_LABEL_KEYS[item.role])}</Text>
          </View>
          {canManage && (
            <TouchableOpacity
              onPress={() => handleRemove(item.id, `${item.first_name} ${item.last_name}`)}
              style={styles.actionBtn}
            >
              <Trash2 size={IconSize.md} color={colors.red} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      );
    },
    [colors, handleRemove, canManage],
  );

  return (
    <View style={styles.container}>
      {canManage && (
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowAddModal(true)}
        >
          <UserPlus size={IconSize.md} color="#FFFFFF" />
          <Text style={styles.addText}>{t('team.addMember')}</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={renderMember}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={[styles.empty, { color: colors.mutedText }]}>{t('team.noMemberInChantier')}</Text>
          ) : null
        }
      />

      {/* Add member modal */}
      {showAddModal && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <Animated.View style={[styles.modalContent, { backgroundColor: colors.surface }, animatedModalStyle]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{t('team.addMember')}</Text>
                <TouchableOpacity onPress={() => { setShowAddModal(false); setAddSearch(''); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <X size={IconSize.lg} color={colors.text} />
                </TouchableOpacity>
              </View>
              <View style={[styles.searchBox, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}>
                <Search size={16} color={colors.placeholder} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder={t('team.searchUser')}
                  placeholderTextColor={colors.placeholder}
                  value={addSearch}
                  onChangeText={setAddSearch}
                />
              </View>
              <FlatList
                data={filteredAvailable}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const allowedRoles: ChantierMemberRole[] =
                    item.role === 'admin' ? ['manager']
                    : item.role === 'manager' ? ['manager']
                    : item.role === 'employee' ? ['ouvrier']
                    : item.role === 'gestionnaire_reseau' ? ['gestionnaire_reseau']
                    : ['client'];

                  const globalRoleLabel =
                    item.role === 'admin' ? t('collab.role.adminLong')
                    : item.role === 'manager' ? t('collab.role.manager')
                    : item.role === 'employee' ? t('collab.role.employee')
                    : item.role === 'gestionnaire_reseau' ? t('collab.role.gestionnaireReseau')
                    : t('collab.role.client');

                  return (
                    <View style={[styles.userItem, { borderColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.userName, { color: colors.text }]}>
                          {item.first_name} {item.last_name}
                        </Text>
                        <Text style={[styles.userEmail, { color: colors.mutedText }]}>{item.email}</Text>
                        <Text style={[styles.userEmail, { color: colors.mutedText, fontStyle: 'italic' }]}>
                          {globalRoleLabel}
                        </Text>
                      </View>
                      <View style={styles.rolePickerRow}>
                        {allowedRoles.map((role) => (
                          <TouchableOpacity
                            key={role}
                            style={[styles.rolePickerBtn, { backgroundColor: ROLE_COLORS[role] + '20', borderColor: ROLE_COLORS[role] }]}
                            onPress={() => handleAdd(item.id, role, item.first_name, item.last_name)}
                          >
                            <Text style={[styles.rolePickerText, { color: ROLE_COLORS[role] }]}>
                              {t(ROLE_LABEL_KEYS[role])}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <Text style={[styles.empty, { color: colors.mutedText }]}>
                    {addSearch ? t('team.noResult') : t('team.allAlreadyMembers')}
                  </Text>
                }
                keyboardShouldPersistTaps="handled"
              />
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* Member contact modal */}
      {viewingMember && (
        <Modal visible transparent animationType="slide">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setViewingMember(null)}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
              {(() => {
                const roleColor = ROLE_COLORS[viewingMember.role];
                return (
                  <>
                    <View style={styles.modalHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 }}>
                        <View style={[styles.contactAvatar, { backgroundColor: roleColor + '20' }]}>
                          <Text style={[styles.contactAvatarText, { color: roleColor }]}>
                            {viewingMember.first_name[0]}{viewingMember.last_name[0]}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.modalTitle, { color: colors.text }]}>
                            {viewingMember.first_name} {viewingMember.last_name}
                          </Text>
                          {viewingMember.company_name && (
                            <Text style={[styles.modalSub, { color: colors.text2 }]}>{viewingMember.company_name}</Text>
                          )}
                          <View style={[styles.contactRoleBadge, { backgroundColor: roleColor + '15' }]}>
                            <Text style={[styles.contactRoleText, { color: roleColor }]}>{t(ROLE_LABEL_KEYS[viewingMember.role])}</Text>
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => setViewingMember(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <X size={IconSize.lg} color={colors.text} />
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.contactSectionLabel, { color: colors.text2 }]}>{t('common.contactSection')}</Text>
                    <TouchableOpacity
                      style={[styles.contactRow, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}
                      onPress={() => Linking.openURL(`mailto:${viewingMember.email}`)}
                    >
                      <View style={[styles.contactIconBox, { backgroundColor: colors.primary + '15' }]}>
                        <Mail size={IconSize.md} color={colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.contactLabel, { color: colors.text2 }]}>{t('auth.email')}</Text>
                        <Text style={[styles.contactValue, { color: colors.text }]}>{viewingMember.email}</Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.copyContactBtn,
                          {
                            backgroundColor: copiedField === 'email' ? colors.green + '25' : colors.primary + '15',
                            borderColor: copiedField === 'email' ? colors.green : colors.primary,
                          },
                        ]}
                        onPress={() => copyToClipboard(viewingMember.email, 'email')}
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

                    {viewingMember.phone && (
                      <TouchableOpacity
                        style={[styles.contactRow, { backgroundColor: colors.itemBackground, borderColor: colors.border, marginTop: Spacing.sm }]}
                        onPress={() => Linking.openURL(`tel:${viewingMember.phone}`)}
                      >
                        <View style={[styles.contactIconBox, { backgroundColor: '#05966915' }]}>
                          <Phone size={IconSize.md} color="#059669" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.contactLabel, { color: colors.text2 }]}>{t('auth.phone')}</Text>
                          <Text style={[styles.contactValue, { color: colors.text }]}>{viewingMember.phone}</Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.copyContactBtn,
                            {
                              backgroundColor: copiedField === 'phone' ? colors.green + '25' : '#05966915',
                              borderColor: copiedField === 'phone' ? colors.green : '#059669',
                            },
                          ]}
                          onPress={() => copyToClipboard(viewingMember.phone!, 'phone')}
                          accessibilityRole="button"
                          accessibilityLabel={t('team.copyPhone')}
                        >
                          {copiedField === 'phone' ? (
                            <Check size={IconSize.sm} color={colors.green} />
                          ) : (
                            <Copy size={IconSize.sm} color="#059669" />
                          )}
                        </TouchableOpacity>
                      </TouchableOpacity>
                    )}

                    {canEditPerms && (
                      <TouchableOpacity
                        style={[styles.contactActionBtn, { borderColor: colors.primary, marginTop: Spacing.xl }]}
                        onPress={() => { setViewingMember(null); setEditingMember(viewingMember); }}
                      >
                        <Pencil size={IconSize.md} color={colors.primary} />
                        <Text style={[styles.contactActionText, { color: colors.primary }]}>{t('team.managePermissions')}</Text>
                      </TouchableOpacity>
                    )}

                    {canManage && (
                      <TouchableOpacity
                        style={[styles.contactActionBtn, { borderColor: colors.red, marginTop: Spacing.sm }]}
                        onPress={() => {
                          const m = viewingMember;
                          setViewingMember(null);
                          setTimeout(() => handleRemove(m.id, `${m.first_name} ${m.last_name}`), 300);
                        }}
                      >
                        <Trash2 size={IconSize.md} color={colors.red} />
                        <Text style={[styles.contactActionText, { color: colors.red }]}>{t('team.removeFromChantier')}</Text>
                      </TouchableOpacity>
                    )}
                  </>
                );
              })()}
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Permissions editor modal */}
      {editingMember && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{t('team.permissions')}</Text>
                  <Text style={[styles.modalSub, { color: colors.mutedText }]}>
                    {editingMember.first_name} {editingMember.last_name}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setEditingMember(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <X size={IconSize.lg} color={colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionLabel, { color: colors.text2 }]}>{t('team.roleOnChantier')}</Text>
              <View style={styles.roleRow}>
                {(() => {
                  const allowed: ChantierMemberRole[] =
                    editingMember.user_role === 'admin' ? ['manager']
                    : editingMember.user_role === 'manager' ? ['manager']
                    : editingMember.user_role === 'employee' ? ['ouvrier']
                    : editingMember.user_role === 'client' ? ['client']
                    : editingMember.user_role === 'gestionnaire_reseau' ? ['gestionnaire_reseau']
                    : ['manager', 'ouvrier', 'client'];
                  return allowed.map((role) => {
                    const isActive = editingMember.role === role;
                    return (
                      <TouchableOpacity
                        key={role}
                        style={[
                          styles.roleOption,
                          {
                            backgroundColor: isActive ? ROLE_COLORS[role] + '20' : colors.itemBackground,
                            borderColor: isActive ? ROLE_COLORS[role] : colors.border,
                          },
                        ]}
                        onPress={() => {
                          handleToggleRole(editingMember, role);
                          setEditingMember({ ...editingMember, role });
                        }}
                      >
                        <Text style={[styles.roleOptionText, { color: isActive ? ROLE_COLORS[role] : colors.text2 }]}>
                          {t(ROLE_LABEL_KEYS[role])}
                        </Text>
                      </TouchableOpacity>
                    );
                  });
                })()}
              </View>

              <Text style={[styles.sectionLabel, { color: colors.text2, marginTop: Spacing.xl }]}>{t('team.permissionsSection')}</Text>
              {PERMISSION_LABELS.map((p) => {
                const value = !!editingMember[p.key];
                const desc =
                  editingMember.role === 'gestionnaire_reseau' && p.key === 'can_view_documents'
                    ? t('perm.dictOnly')
                    : t(p.descKey);
                return (
                  <View key={p.key} style={[styles.permissionRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.permissionInfo}>
                      <Text style={[styles.permissionLabel, { color: colors.text }]}>{t(p.labelKey)}</Text>
                      <Text style={[styles.permissionDesc, { color: colors.mutedText }]}>{desc}</Text>
                    </View>
                    <Switch
                      value={value}
                      onValueChange={(v) => {
                        handleTogglePermission(editingMember, p.key, v);
                        setEditingMember({ ...editingMember, [p.key]: v } as MemberWithUser);
                      }}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                );
              })}
            </View>
          </View>
        </Modal>
      )}

      {/* Permissions modal pour un nouvel acteur externe (client ou gestionnaire reseau) */}
      {pendingExternalAdd && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {pendingExternalAdd.role === 'client' ? t('team.permsOfClient') : t('team.permsOfNetworkManager')}
                  </Text>
                  <Text style={[styles.modalSub, { color: colors.mutedText }]}>
                    {pendingExternalAdd.first_name} {pendingExternalAdd.last_name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setPendingExternalAdd(null)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <X size={IconSize.lg} color={colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionLabel, { color: colors.text2 }]}>{t('team.whatToSee')}</Text>
              {PERMISSION_LABELS.filter((p) => p.key !== 'can_edit').map((p) => {
                const key = p.key as keyof ExternalPerms;
                const value = !!pendingExternalAdd.perms[key];
                const desc =
                  pendingExternalAdd.role === 'gestionnaire_reseau' && p.key === 'can_view_documents'
                    ? t('perm.dictOnly')
                    : t(p.descKey);
                return (
                  <View key={p.key} style={[styles.permissionRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.permissionInfo}>
                      <Text style={[styles.permissionLabel, { color: colors.text }]}>{t(p.labelKey)}</Text>
                      <Text style={[styles.permissionDesc, { color: colors.mutedText }]}>{desc}</Text>
                    </View>
                    <Switch
                      value={value}
                      onValueChange={(v) =>
                        setPendingExternalAdd({
                          ...pendingExternalAdd,
                          perms: { ...pendingExternalAdd.perms, [key]: v },
                        })
                      }
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                );
              })}

              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.primary, marginTop: Spacing.lg }]}
                onPress={confirmExternalAdd}
                disabled={addMutation.isPending}
              >
                <Text style={styles.confirmBtnText}>
                  {pendingExternalAdd.role === 'client' ? t('team.addClient') : t('team.addNetworkManager')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 48,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  addText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  list: { paddingBottom: Spacing.xxxl },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  memberEmail: { fontSize: FontSize.xs },
  memberCompany: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  roleText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  actionBtn: { padding: Spacing.xs },
  empty: { fontSize: FontSize.base, textAlign: 'center', paddingTop: Spacing.xxxl },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold },
  modalSub: { fontSize: FontSize.sm, marginTop: 2 },

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

  userItem: { paddingVertical: Spacing.md, borderBottomWidth: 1, gap: Spacing.sm },
  userName: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  userEmail: { fontSize: FontSize.sm },
  rolePickerRow: { flexDirection: 'row', gap: Spacing.xs },
  rolePickerBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1 },
  rolePickerText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  sectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, marginBottom: Spacing.sm },
  roleRow: { flexDirection: 'row', gap: Spacing.sm },
  roleOption: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  roleOptionText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  permissionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, gap: Spacing.md },
  permissionInfo: { flex: 1 },
  permissionLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  permissionDesc: { fontSize: FontSize.xs, marginTop: 2 },

  contactAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  contactAvatarText: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  contactRoleBadge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill, marginTop: Spacing.xs },
  contactRoleText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  contactSectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, marginBottom: Spacing.sm, marginTop: Spacing.md },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  contactIconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: FontSize.xs },
  contactValue: { fontSize: FontSize.base, fontWeight: FontWeight.medium, marginTop: 2 },
  contactActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  contactActionText: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
  confirmBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  confirmBtnText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  copyContactBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHint: {
    fontSize: FontSize.xs,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});

export default TeamManager;
