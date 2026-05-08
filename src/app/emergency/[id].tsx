import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  FlatList,
  Modal,
  Linking,
  Alert,
  Pressable,
  Animated,
  Keyboard,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated from 'react-native-reanimated';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MapPin, Navigation, Send, Trash2, Pencil, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEmergencies, useDeleteEmergency, EmergencyWithAuthor } from '@/api/hooks/useEmergencies';
import {
  useEmergencyComments,
  useCreateEmergencyComment,
  useUpdateEmergencyComment,
  useDeleteEmergencyComment,
  EmergencyComment,
} from '@/api/hooks/useEmergencyComments';

type Mode = 'emergency' | 'claim';

export default function EmergencyDetailScreen() {
  const { id, chantierId, mode: modeParam } = useLocalSearchParams<{
    id: string;
    chantierId: string;
    mode?: Mode;
  }>();
  const mode: Mode = modeParam === 'claim' ? 'claim' : 'emergency';

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const { data: emergencies } = useEmergencies(chantierId);
  const emergency: EmergencyWithAuthor | undefined = useMemo(
    () => emergencies?.data?.find((e) => e.id === id),
    [emergencies, id],
  );

  const { data: commentsData, isLoading: commentsLoading } = useEmergencyComments(id);
  const createComment = useCreateEmergencyComment();
  const updateComment = useUpdateEmergencyComment(id ?? '');
  const deleteComment = useDeleteEmergencyComment(id ?? '');
  const deleteEmergency = useDeleteEmergency(chantierId ?? '');

  const [draft, setDraft] = useState('');
  const [photoFullscreen, setPhotoFullscreen] = useState(false);
  const [selectedComment, setSelectedComment] = useState<EmergencyComment | null>(null);
  const [editText, setEditText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const animatedEditModalStyle = useKeyboardAwareModalStyle({ visible: isEditing });

  const listRef = useRef<FlatList<EmergencyComment>>(null);
  const keyboardPadding = useRef(new Animated.Value(0)).current;

  const comments = commentsData?.data ?? [];

  // Listen to keyboard events and animate padding (pattern repris de CommentThread)
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      const offset = e.endCoordinates.height - insets.bottom;
      Animated.timing(keyboardPadding, {
        toValue: Math.max(0, offset),
        duration: Platform.OS === 'ios' ? e.duration : 200,
        useNativeDriver: false,
      }).start();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.timing(keyboardPadding, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardPadding, insets.bottom]);

  // Auto-scroll a l'arrivee de nouveaux messages
  useEffect(() => {
    if (comments.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [comments.length]);

  const handleSend = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || !id) return;
    setDraft('');
    try {
      await createComment.mutateAsync({ emergency_id: id, content: trimmed });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : 'Send failed');
    }
  }, [draft, id, createComment, t]);

  const handleStartEdit = useCallback(() => {
    if (!selectedComment) return;
    setEditText(selectedComment.content);
    setIsEditing(true);
  }, [selectedComment]);

  const handleSaveEdit = useCallback(async () => {
    if (!selectedComment || !editText.trim()) return;
    await updateComment.mutateAsync({ id: selectedComment.id, content: editText.trim() });
    setIsEditing(false);
    setSelectedComment(null);
    setEditText('');
  }, [selectedComment, editText, updateComment]);

  const handleDeleteComment = useCallback(() => {
    if (!selectedComment) return;
    deleteComment.mutate(selectedComment.id);
    setSelectedComment(null);
  }, [selectedComment, deleteComment]);

  const handleOpenInMaps = useCallback((lat: number, lng: number) => {
    const urls = [
      `maps://?daddr=${lat},${lng}`,
      `geo:${lat},${lng}?q=${lat},${lng}`,
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    ];
    (async () => {
      for (const url of urls) {
        try {
          const supported = await Linking.canOpenURL(url);
          if (supported) {
            await Linking.openURL(url);
            return;
          }
        } catch {
          // try next
        }
      }
    })();
  }, []);

  const handleDeleteEmergency = useCallback(() => {
    if (!emergency) return;
    Alert.alert(t('urgence.deleteConfirm'), t('common.irreversible'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          deleteEmergency.mutate(emergency.id);
          router.back();
        },
      },
    ]);
  }, [emergency, deleteEmergency, router, t]);

  const formatTime = (date: string) => {
    const d = new Date(date);
    return (
      d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
      ' à ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    );
  };

  if (!emergency) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const lat = emergency.latitude != null ? Number(emergency.latitude) : null;
  const lng = emergency.longitude != null ? Number(emergency.longitude) : null;
  const hasGps = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);
  const canDeleteEmergency = user?.id === emergency.created_by || user?.role === 'admin';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel={t('common.back')}
        >
          <ArrowLeft size={IconSize.lg} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {mode === 'claim' ? t('urgence.titleClaim') : t('urgence.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedText }]} numberOfLines={1}>
            {emergency.first_name} {emergency.last_name}
          </Text>
        </View>
        {canDeleteEmergency && (
          <TouchableOpacity
            onPress={handleDeleteEmergency}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel={t('common.delete')}
          >
            <Trash2 size={IconSize.lg} color={colors.red} />
          </TouchableOpacity>
        )}
      </View>

      <Animated.View style={[styles.flex, { paddingBottom: keyboardPadding }]}>
        <Pressable style={styles.flex} onPress={() => Keyboard.dismiss()}>
        <FlatList
          ref={listRef}
          data={comments}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onScrollBeginDrag={() => Keyboard.dismiss()}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              {emergency.photo_url ? (
                <TouchableOpacity
                  onPress={() => setPhotoFullscreen(true)}
                  activeOpacity={0.9}
                  accessibilityLabel="Agrandir la photo"
                >
                  <Image source={{ uri: emergency.photo_url }} style={styles.photo} resizeMode="cover" />
                </TouchableOpacity>
              ) : null}

              {hasGps ? (
                <View style={[styles.gpsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <MapPin size={IconSize.md} color={colors.primary} />
                  <Text style={[styles.gpsCoord, { color: colors.text }]}>
                    {lat!.toFixed(5)}, {lng!.toFixed(5)}
                  </Text>
                  <TouchableOpacity
                    style={[styles.routeBtn, { backgroundColor: colors.primary }]}
                    onPress={() => handleOpenInMaps(lat!, lng!)}
                  >
                    <Navigation size={IconSize.sm} color="#FFFFFF" />
                    <Text style={styles.routeBtnText}>{t('urgence.routeBtn')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={[styles.gpsRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.gpsCoord, { color: colors.mutedText, fontStyle: 'italic' }]}>
                    {t('urgence.noGps')}
                  </Text>
                </View>
              )}

              <View style={styles.discussionLabel}>
                <Text style={[styles.discussionLabelText, { color: colors.text2 }]}>DISCUSSION</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const isOwn = item.author_id === user?.id;
            return (
              <TouchableOpacity
                activeOpacity={isOwn ? 0.7 : 1}
                onPress={() => Keyboard.dismiss()}
                onLongPress={() => (isOwn ? setSelectedComment(item) : undefined)}
                delayLongPress={300}
                style={[
                  styles.bubble,
                  { backgroundColor: isOwn ? colors.primary + '15' : colors.itemBackground },
                ]}
              >
                <View style={styles.bubbleHeader}>
                  <Text style={[styles.author, { color: colors.primary }]}>
                    {isOwn ? 'Vous' : `${item.first_name} ${item.last_name}`}
                  </Text>
                  <Text style={[styles.time, { color: colors.mutedText }]}>
                    {formatTime(item.created_at)}
                  </Text>
                </View>
                <Text style={[styles.content, { color: colors.text }]}>{item.content}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            !commentsLoading ? (
              <Text style={[styles.empty, { color: colors.mutedText }]}>Aucun message pour le moment.</Text>
            ) : null
          }
        />
        </Pressable>

        <View style={[styles.inputRow, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border },
            ]}
            placeholder="Écrire un commentaire..."
            placeholderTextColor={colors.placeholder}
            value={draft}
            onChangeText={setDraft}
            multiline
            accessibilityLabel="Écrire un commentaire"
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: draft.trim() ? colors.primary : colors.itemBackground },
            ]}
            onPress={handleSend}
            disabled={!draft.trim() || createComment.isPending}
            accessibilityRole="button"
            accessibilityLabel="Envoyer"
          >
            <Send size={IconSize.md} color={draft.trim() ? '#FFFFFF' : colors.mutedText} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Action sheet — modifier / supprimer son message */}
      <Modal visible={!!selectedComment && !isEditing} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedComment(null)}
        >
          <View style={[styles.actionSheet, { backgroundColor: colors.surface }]}>
            {selectedComment && (
              <>
                <Text style={[styles.actionSheetPreview, { color: colors.text }]} numberOfLines={2}>
                  {selectedComment.content}
                </Text>
                <View style={[styles.separator, { backgroundColor: colors.border }]} />
                <TouchableOpacity style={styles.actionRow} onPress={handleStartEdit}>
                  <Pencil size={IconSize.lg} color={colors.primary} />
                  <Text style={[styles.actionLabel, { color: colors.text }]}>Modifier</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionRow} onPress={handleDeleteComment}>
                  <Trash2 size={IconSize.lg} color={colors.red} />
                  <Text style={[styles.actionLabel, { color: colors.red }]}>Supprimer</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit modal */}
      <Modal visible={isEditing} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Reanimated.View style={[styles.editSheet, { backgroundColor: colors.surface }, animatedEditModalStyle]}>
            <View style={styles.editHeader}>
              <Text style={[styles.editTitle, { color: colors.text }]}>Modifier le commentaire</Text>
              <TouchableOpacity
                onPress={() => {
                  setIsEditing(false);
                  setSelectedComment(null);
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={IconSize.lg} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[
                styles.editInput,
                { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border },
              ]}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              accessibilityLabel="Modifier le commentaire"
            />
            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: editText.trim() ? colors.primary : colors.itemBackground },
              ]}
              onPress={handleSaveEdit}
              disabled={!editText.trim() || updateComment.isPending}
              accessibilityRole="button"
              accessibilityLabel="Sauvegarder"
            >
              <Text
                style={[
                  styles.saveBtnText,
                  { color: editText.trim() ? '#FFFFFF' : colors.mutedText },
                ]}
              >
                Sauvegarder
              </Text>
            </TouchableOpacity>
          </Reanimated.View>
        </View>
      </Modal>

      {/* Fullscreen photo */}
      <Modal
        visible={photoFullscreen}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoFullscreen(false)}
      >
        <Pressable style={styles.fullscreenOverlay} onPress={() => setPhotoFullscreen(false)}>
          {emergency.photo_url ? (
            <Image
              source={{ uri: emergency.photo_url }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          ) : null}
          <SafeAreaView style={styles.fullscreenClose} pointerEvents="box-none">
            <TouchableOpacity
              onPress={() => setPhotoFullscreen(false)}
              style={[styles.closeBtn, Shadow.md]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel={t('common.close')}
            >
              <X size={IconSize.lg} color="#FFFFFF" />
            </TouchableOpacity>
          </SafeAreaView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  subtitle: { fontSize: FontSize.xs, marginTop: 2 },

  list: { padding: Spacing.lg, paddingBottom: Spacing.sm },
  headerBlock: { gap: Spacing.md, marginBottom: Spacing.sm },

  photo: {
    width: '100%',
    height: 240,
    borderRadius: Radius.lg,
    backgroundColor: '#000',
  },

  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  gpsCoord: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  routeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
  },
  routeBtnText: { color: '#FFFFFF', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  discussionLabel: { marginTop: Spacing.md },
  discussionLabelText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5 },

  // bubbles repris de CommentThread
  bubble: { borderRadius: Radius.lg, padding: Spacing.md },
  bubbleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  author: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  time: { fontSize: FontSize.xs },
  content: { fontSize: FontSize.base, lineHeight: 20 },
  empty: { fontSize: FontSize.base, textAlign: 'center', paddingTop: Spacing.xxxl },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.base,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  actionSheet: { borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl },
  actionSheetPreview: { fontSize: FontSize.base, marginBottom: Spacing.md },
  separator: { height: 1, marginVertical: Spacing.sm },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.lg },
  actionLabel: { fontSize: FontSize.lg },

  editSheet: { borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, padding: Spacing.xl },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  editTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold },
  editInput: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    textAlignVertical: 'top',
  },
  saveBtn: {
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  saveBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },

  fullscreenOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  fullscreenImage: { width: '100%', height: '100%' },
  fullscreenClose: { position: 'absolute', top: 0, right: 0, padding: Spacing.lg },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
