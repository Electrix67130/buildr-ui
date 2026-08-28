import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, FlatList, StyleSheet, Modal, Keyboard, Platform, Animated, RefreshControl, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated from 'react-native-reanimated';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { Send, Trash2, Pencil, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useComments, useCreateComment, useUpdateComment, useDeleteComment } from '@/api/hooks/useComments';
import { useAuth } from '@/contexts/AuthContext';
import type { Comment } from '@/api/types';
import { useTranslation } from '@/contexts/I18nContext';

type CommentWithAuthor = Comment & { first_name: string; last_name: string; avatar_url?: string };

interface Props {
  chantierId: string;
  /** 'general' = uniquement messages hors-etape ; uuid = messages d'une etape ; undefined = tous */
  stepFilter?: string | 'general';
  readonly?: boolean;
  /** Contenu rendu au-dessus de la liste des messages, scrolle avec elle. */
  listHeader?: React.ReactNode;
  /** Callback declenche au focus du champ de saisie (ex. pour masquer un header au-dessus). */
  onInputFocus?: () => void;
}

const CommentThread: React.FC<Props> = ({ chantierId, stepFilter, readonly, listHeader, onInputFocus }) => {
  const { t, locale } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { user } = useAuth();

  const { data, isLoading, refetch, isRefetching } = useComments(chantierId, stepFilter);
  const createMutation = useCreateComment();
  const updateMutation = useUpdateComment();
  const deleteMutation = useDeleteComment();

  const [text, setText] = useState('');
  const [selectedComment, setSelectedComment] = useState<CommentWithAuthor | null>(null);
  const [editText, setEditText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const animatedEditModalStyle = useKeyboardAwareModalStyle({ visible: isEditing });

  const flatListRef = useRef<FlatList>(null);
  const keyboardPadding = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  // Auto-scroll only quand l'utilisateur est deja proche du bas. Si il a scrolle pour relire
  // d'anciens messages, on respecte sa position (clavier qui s'ouvre, nouveau message, etc.).
  const isNearBottomRef = useRef(true);
  // Premier rendu : on aligne la liste sur le dernier message peu importe la position.
  const isFirstContentLayoutRef = useRef(true);
  const NEAR_BOTTOM_THRESHOLD = 80;

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    isNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;
  }, []);

  // Listen to keyboard events and animate padding
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      // Subtract bottom safe area + tab bar to avoid double spacing
      const offset = e.endCoordinates.height - insets.bottom;
      Animated.timing(keyboardPadding, {
        toValue: Math.max(0, offset),
        duration: Platform.OS === 'ios' ? e.duration : 200,
        useNativeDriver: false,
      }).start();
      // Suit la conversation uniquement si on etait deja en bas — sinon on respecte
      // la position de lecture de l'utilisateur.
      if (isNearBottomRef.current) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
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
  }, [keyboardPadding]);

  const handleSend = useCallback(async () => {
    if (!text.trim()) return;
    const step_id = stepFilter && stepFilter !== 'general' ? stepFilter : null;
    await createMutation.mutateAsync({ chantier_id: chantierId, step_id, content: text.trim() });
    setText('');
    // Envoi : on force le scroll pour que l'utilisateur voie son message.
    isNearBottomRef.current = true;
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
  }, [text, chantierId, stepFilter, createMutation]);

  const handleDelete = useCallback(() => {
    if (!selectedComment) return;
    deleteMutation.mutate(selectedComment.id);
    setSelectedComment(null);
  }, [selectedComment, deleteMutation]);

  const handleStartEdit = useCallback(() => {
    if (!selectedComment) return;
    setEditText(selectedComment.content);
    setIsEditing(true);
  }, [selectedComment]);

  const handleSaveEdit = useCallback(async () => {
    if (!selectedComment || !editText.trim()) return;
    await updateMutation.mutateAsync({ id: selectedComment.id, content: editText.trim() });
    setIsEditing(false);
    setSelectedComment(null);
    setEditText('');
  }, [selectedComment, editText, updateMutation]);

  const formatTime = (date: string) => {
    const d = new Date(date);
    return t('comments.dateAtTime', {
      date: d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
      time: d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    });
  };

  const renderItem = useCallback(
    ({ item }: { item: CommentWithAuthor }) => {
      const isOwn = item.author_id === user?.id;
      return (
        <TouchableOpacity
          activeOpacity={isOwn ? 0.7 : 1}
          onPress={() => Keyboard.dismiss()}
          onLongPress={() => (isOwn && !readonly) ? setSelectedComment(item) : undefined}
          delayLongPress={300}
          style={[styles.bubble, { backgroundColor: isOwn ? colors.primary + '15' : colors.itemBackground }]}
        >
          <View style={styles.bubbleHeader}>
            <Text style={[styles.author, { color: colors.primary }]}>
              {isOwn ? t('comments.you') : `${item.first_name} ${item.last_name}`}
            </Text>
            <Text style={[styles.time, { color: colors.mutedText }]}>{formatTime(item.created_at)}</Text>
          </View>
          <Text style={[styles.content, { color: colors.text }]}>{item.content}</Text>
        </TouchableOpacity>
      );
    },
    [user, colors, readonly, locale, t],
  );

  return (
    <>
      <Animated.View style={[styles.container, { paddingBottom: keyboardPadding }]}>
        <Pressable style={styles.flex} onPress={() => Keyboard.dismiss()}>
          <FlatList
            ref={flatListRef}
            data={data?.data ?? []}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            onScrollBeginDrag={() => Keyboard.dismiss()}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            onContentSizeChange={() => {
              // Premier rendu : aligne sur le dernier message. Apres, on suit la conversation
              // uniquement si l'utilisateur est deja proche du bas — sinon il lit d'anciens
              // messages, on ne le fait pas sauter.
              if (isFirstContentLayoutRef.current || isNearBottomRef.current) {
                flatListRef.current?.scrollToEnd({ animated: false });
                isFirstContentLayoutRef.current = false;
              }
            }}
            ListHeaderComponent={listHeader as React.ReactElement | null}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />
            }
            ListEmptyComponent={
              !isLoading ? (
                <Text style={[styles.empty, { color: colors.mutedText }]}>{t('comments.empty')}</Text>
              ) : null
            }
          />
        </Pressable>

        {!readonly && <View style={[styles.inputRow, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
            placeholder={t('comments.placeholder')}
            placeholderTextColor={colors.placeholder}
            value={text}
            onChangeText={setText}
            onFocus={onInputFocus}
            multiline
            accessibilityLabel={t('comments.write')}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.itemBackground }]}
            onPress={handleSend}
            disabled={!text.trim() || createMutation.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('common.send')}
          >
            <Send size={IconSize.md} color={text.trim() ? '#FFFFFF' : colors.mutedText} />
          </TouchableOpacity>
        </View>}
      </Animated.View>

      {/* Action sheet */}
      <Modal visible={!!selectedComment && !isEditing} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedComment(null)}>
          <View style={[styles.actionSheet, { backgroundColor: colors.surface }]}>
            {selectedComment && (
              <>
                <Text style={[styles.actionSheetPreview, { color: colors.text }]} numberOfLines={2}>
                  {selectedComment.content}
                </Text>
                <View style={[styles.separator, { backgroundColor: colors.border }]} />

                <TouchableOpacity style={styles.actionRow} onPress={handleStartEdit}>
                  <Pencil size={IconSize.lg} color={colors.primary} />
                  <Text style={[styles.actionLabel, { color: colors.text }]}>{t('common.edit')}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionRow} onPress={handleDelete}>
                  <Trash2 size={IconSize.lg} color={colors.red} />
                  <Text style={[styles.actionLabel, { color: colors.red }]}>{t('common.delete')}</Text>
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
              <Text style={[styles.editTitle, { color: colors.text }]}>{t('comments.editTitle')}</Text>
              <TouchableOpacity onPress={() => { setIsEditing(false); setSelectedComment(null); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <X size={IconSize.lg} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.editInput, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
              accessibilityLabel={t('comments.editTitle')}
            />
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: editText.trim() ? colors.primary : colors.itemBackground }]}
              onPress={handleSaveEdit}
              disabled={!editText.trim() || updateMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel={t('common.save')}
            >
              <Text style={[styles.saveBtnText, { color: editText.trim() ? '#FFFFFF' : colors.mutedText }]}>
                {t('common.save')}
              </Text>
            </TouchableOpacity>
          </Reanimated.View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  list: { padding: Spacing.lg, paddingBottom: Spacing.sm },
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
  cancelLabel: { fontSize: FontSize.lg, textAlign: 'center', width: '100%' },
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
});

export default CommentThread;
