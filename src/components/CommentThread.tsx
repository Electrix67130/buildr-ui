import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, FlatList, StyleSheet, Modal, Keyboard, Platform, Animated, RefreshControl, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { ZoomIn, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useKeyboardAwareModalStyle } from '@/hooks/useKeyboardAwareModalStyle';
import { Send, Trash2, Pencil, X, Reply } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { REACTION_EMOJIS, type ReactionEmoji } from '@/constants/reactions';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useComments, useCreateComment, useUpdateComment, useDeleteComment, useToggleReaction } from '@/api/hooks/useComments';
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
  const reactMutation = useToggleReaction(chantierId);

  const [text, setText] = useState('');
  const [selectedComment, setSelectedComment] = useState<CommentWithAuthor | null>(null);
  const [replyTo, setReplyTo] = useState<CommentWithAuthor | null>(null);
  const [editText, setEditText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  // Message brievement mis en avant apres un saut depuis une citation.
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const animatedEditModalStyle = useKeyboardAwareModalStyle({ visible: isEditing });

  const flatListRef = useRef<FlatList<CommentWithAuthor>>(null);
  const inputRef = useRef<TextInput>(null);
  const keyboardPadding = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  // Auto-scroll only quand l'utilisateur est deja proche du bas. Si il a scrolle pour relire
  // d'anciens messages, on respecte sa position (clavier qui s'ouvre, nouveau message, etc.).
  const isNearBottomRef = useRef(true);
  // Premier rendu : on aligne la liste sur le dernier message peu importe la position.
  const isFirstContentLayoutRef = useRef(true);
  const NEAR_BOTTOM_THRESHOLD = 80;

  const messages = data?.data ?? [];

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
    await createMutation.mutateAsync({
      chantier_id: chantierId,
      step_id,
      content: text.trim(),
      reply_to_id: replyTo?.id ?? null,
    });
    setText('');
    setReplyTo(null);
    // Envoi : on force le scroll pour que l'utilisateur voie son message.
    isNearBottomRef.current = true;
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
  }, [text, chantierId, stepFilter, createMutation, replyTo]);

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

  const handleStartReply = useCallback(() => {
    if (!selectedComment) return;
    setReplyTo(selectedComment);
    setSelectedComment(null);
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [selectedComment]);

  const handleReact = useCallback(
    (comment: CommentWithAuthor, emoji: ReactionEmoji) => {
      reactMutation.mutate({ id: comment.id, emoji });
    },
    [reactMutation],
  );

  /** Saute au message cite et le met en avant un instant. */
  const scrollToComment = useCallback(
    (id: string) => {
      const index = messages.findIndex((m) => m.id === id);
      if (index < 0) return;
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
      setHighlightedId(id);
      setTimeout(() => setHighlightedId((cur) => (cur === id ? null : cur)), 1600);
    },
    [messages],
  );

  const formatTime = (date: string) => {
    const d = new Date(date);
    return t('comments.dateAtTime', {
      date: d.toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
      time: d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    });
  };

  const authorName = (c: { author_id: string; first_name: string; last_name: string }) =>
    c.author_id === user?.id ? t('comments.you') : `${c.first_name} ${c.last_name}`;

  const renderItem = useCallback(
    ({ item }: { item: CommentWithAuthor }) => {
      const isOwn = item.author_id === user?.id;
      const highlighted = highlightedId === item.id;
      const reactions = item.reactions ?? [];
      return (
        <View>
          <TouchableOpacity
            activeOpacity={readonly ? 1 : 0.7}
            onPress={() => Keyboard.dismiss()}
            onLongPress={() => (!readonly ? setSelectedComment(item) : undefined)}
            delayLongPress={300}
            style={[
              styles.bubble,
              { backgroundColor: isOwn ? colors.primary + '15' : colors.itemBackground },
              highlighted ? { borderWidth: 1.5, borderColor: colors.primary } : null,
            ]}
          >
            <View style={styles.bubbleHeader}>
              <Text style={[styles.author, { color: colors.primary }]}>{authorName(item)}</Text>
              <Text style={[styles.time, { color: colors.mutedText }]}>{formatTime(item.created_at)}</Text>
            </View>

            {item.reply_to ? (
              <Pressable
                onPress={() => scrollToComment(item.reply_to!.id)}
                style={[styles.quote, { borderLeftColor: colors.primary, backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel={t('comments.replyingTo', { name: authorName(item.reply_to) })}
              >
                <Text style={[styles.quoteAuthor, { color: colors.primary }]} numberOfLines={1}>
                  {authorName(item.reply_to)}
                </Text>
                <Text style={[styles.quoteText, { color: colors.text2 }]} numberOfLines={2}>
                  {item.reply_to.content}
                </Text>
              </Pressable>
            ) : null}

            <Text style={[styles.content, { color: colors.text }]}>{item.content}</Text>
          </TouchableOpacity>

          {reactions.length > 0 ? (
            <Reanimated.View style={styles.reactionRow} layout={LinearTransition.springify().damping(18)}>
              {reactions.map((r) => (
                <Reanimated.View key={r.emoji} entering={ZoomIn.springify().damping(12)} exiting={FadeOut.duration(120)} layout={LinearTransition}>
                  <Pressable
                    onPress={() => (!readonly ? handleReact(item, r.emoji as ReactionEmoji) : undefined)}
                    style={[
                      styles.reactionChip,
                      {
                        backgroundColor: r.mine ? colors.primary + '25' : colors.surface,
                        borderColor: r.mine ? colors.primary : colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: r.mine }}
                  >
                    <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                    <Text style={[styles.reactionCount, { color: r.mine ? colors.primary : colors.text2 }]}>{r.count}</Text>
                  </Pressable>
                </Reanimated.View>
              ))}
            </Reanimated.View>
          ) : null}
        </View>
      );
    },
    [user, colors, readonly, locale, t, highlightedId, handleReact, scrollToComment],
  );

  return (
    <>
      <Animated.View style={[styles.container, { paddingBottom: keyboardPadding }]}>
        <Pressable style={styles.flex} onPress={() => Keyboard.dismiss()}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            extraData={highlightedId}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            onScrollBeginDrag={() => Keyboard.dismiss()}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            onScrollToIndexFailed={({ index }) => {
              // La cible n'est pas encore mesuree : on s'en approche, puis on reessaie.
              flatListRef.current?.scrollToOffset({ offset: index * 80, animated: true });
              setTimeout(() => flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 }), 250);
            }}
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

        {!readonly && (
          <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            {replyTo ? (
              <Reanimated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(120)} style={[styles.replyBar, { borderLeftColor: colors.primary, backgroundColor: colors.itemBackground }]}>
                <Reply size={IconSize.sm} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.quoteAuthor, { color: colors.primary }]} numberOfLines={1}>
                    {t('comments.replyingTo', { name: authorName(replyTo) })}
                  </Text>
                  <Text style={[styles.quoteText, { color: colors.text2 }]} numberOfLines={1}>
                    {replyTo.content}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setReplyTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={t('common.cancel')}>
                  <X size={IconSize.sm} color={colors.text2} />
                </TouchableOpacity>
              </Reanimated.View>
            ) : null}
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
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
            </View>
          </View>
        )}
      </Animated.View>

      {/* Action sheet : reactions, repondre, et pour ses propres messages modifier / supprimer */}
      <Modal visible={!!selectedComment && !isEditing} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedComment(null)}>
          <View style={[styles.actionSheet, { backgroundColor: colors.surface, paddingBottom: Spacing.xl + insets.bottom }]}>
            {selectedComment && (
              <>
                <View style={styles.reactionPicker} accessibilityLabel={t('comments.react')}>
                  {REACTION_EMOJIS.map((emoji, i) => {
                    const mine = selectedComment.reactions?.some((r) => r.emoji === emoji && r.mine);
                    return (
                      <Reanimated.View key={emoji} entering={ZoomIn.delay(i * 30).springify().damping(11)}>
                        <Pressable
                          onPress={() => {
                            handleReact(selectedComment, emoji);
                            setSelectedComment(null);
                          }}
                          style={({ pressed }) => [
                            styles.reactionPickerItem,
                            { backgroundColor: mine ? colors.primary + '25' : colors.itemBackground, transform: [{ scale: pressed ? 1.25 : 1 }] },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={emoji}
                          accessibilityState={{ selected: !!mine }}
                        >
                          <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
                        </Pressable>
                      </Reanimated.View>
                    );
                  })}
                </View>

                <Text style={[styles.actionSheetPreview, { color: colors.text }]} numberOfLines={2}>
                  {selectedComment.content}
                </Text>
                <View style={[styles.separator, { backgroundColor: colors.border }]} />

                <TouchableOpacity style={styles.actionRow} onPress={handleStartReply}>
                  <Reply size={IconSize.lg} color={colors.primary} />
                  <Text style={[styles.actionLabel, { color: colors.text }]}>{t('comments.reply')}</Text>
                </TouchableOpacity>

                {selectedComment.author_id === user?.id ? (
                  <>
                    <TouchableOpacity style={styles.actionRow} onPress={handleStartEdit}>
                      <Pencil size={IconSize.lg} color={colors.primary} />
                      <Text style={[styles.actionLabel, { color: colors.text }]}>{t('common.edit')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionRow} onPress={handleDelete}>
                      <Trash2 size={IconSize.lg} color={colors.red} />
                      <Text style={[styles.actionLabel, { color: colors.red }]}>{t('common.delete')}</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
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
  quote: { borderLeftWidth: 3, borderRadius: Radius.sm, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm },
  quoteAuthor: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  quoteText: { fontSize: FontSize.sm },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: -Spacing.xs, marginLeft: Spacing.sm },
  reactionChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill, borderWidth: 1 },
  reactionEmoji: { fontSize: 14, lineHeight: 18 },
  reactionCount: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  empty: { fontSize: FontSize.base, textAlign: 'center', paddingTop: Spacing.xxxl },
  composer: { borderTopWidth: 1 },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.md, marginTop: Spacing.sm, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, borderLeftWidth: 3, borderRadius: Radius.sm },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    padding: Spacing.md,
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
  reactionPicker: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.lg },
  reactionPickerItem: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  reactionPickerEmoji: { fontSize: 22, lineHeight: 28 },
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
  saveBtnText: { textAlign: 'center', fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
});

export default CommentThread;
