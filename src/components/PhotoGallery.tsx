import React, { useCallback, useState, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, StyleSheet, Dimensions, Alert, RefreshControl } from 'react-native';
import { Camera, ImagePlus, Trash2, Share2, X, CloudOff, RotateCw } from 'lucide-react-native';
import ImageView from 'react-native-image-viewing';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { usePhotos, useCreatePhoto, useDeletePhoto } from '@/api/hooks/usePhotos';
import { uploadFile } from '@/api/upload';
import { optimizeImage } from '@/utils/optimizeImage';
import { shareFile } from '@/utils/shareFile';
import { getSignedFileUrl } from '@/api/fileAccess';
import type { Photo } from '@/api/types';
import { useTranslation } from '@/contexts/I18nContext';
import { probeApi } from '@/api/client';
import { useOnlineStatus } from '@/utils/network';
import { enqueuePhoto, usePendingPhotos, retryPhoto, discardPhoto } from '@/utils/photoQueue';

const COLUMN_COUNT = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const ITEM_GAP = Spacing.xs;
const ITEM_SIZE = (SCREEN_WIDTH - Spacing.lg * 2 - ITEM_GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

interface Props {
  chantierId: string;
  readonly?: boolean;
}

const PhotoGallery: React.FC<Props> = ({ chantierId, readonly }) => {
  const { t, locale } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const { data, isLoading, refetch, isRefetching } = usePhotos(chantierId);
  const online = useOnlineStatus();
  const enAttente = usePendingPhotos(chantierId);
  const createMutation = useCreatePhoto();
  const deleteMutation = useDeletePhoto();
  const [selectedPhoto, setSelectedPhoto] = useState<(Photo & { first_name: string; last_name: string }) | null>(null);
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null);

  const pickImage = useCallback(async (useCamera: boolean) => {
    try {
      // iOS : launchCameraAsync requiert AUSSI MediaLibrary pour sauvegarder la photo.
      if (useCamera) {
        const camPerm = await ImagePicker.requestCameraPermissionsAsync();
        if (!camPerm.granted) {
          Alert.alert(t('urgence.cameraDenied'), t('urgence.cameraDeniedBody'));
          return;
        }
        const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libPerm.granted) {
          Alert.alert(t('urgence.galleryDenied'), t('urgence.galleryDeniedBody'));
          return;
        }
      } else {
        const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!libPerm.granted) {
          Alert.alert(t('urgence.galleryDenied'), t('urgence.galleryDeniedBody'));
          return;
        }
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        // L'heure de la prise de vue, capturee tout de suite : une photo
        // enregistree hors ligne et envoyee le soir doit apparaitre a l'heure ou
        // elle a ete prise, sinon le fil d'avancement du chantier ment.
        const takenAt = new Date().toISOString();

        if (!online) {
          await enqueuePhoto({ chantierId, photo: asset, takenAt });
          Alert.alert(t('offline.banner'), t('offline.photoQueued'));
          return;
        }

        const optimized = await optimizeImage(asset.uri, asset.width, asset.height);
        const fileName = `photo-${Date.now()}.jpg`;
        try {
          const uploaded = await uploadFile(optimized.uri, fileName, optimized.mimeType);
          await createMutation.mutateAsync({
            chantier_id: chantierId,
            url: uploaded.url,
            thumbnail_url: uploaded.thumbnail_url,
            file_size: uploaded.file_size,
            mime_type: uploaded.mime_type,
            taken_at: takenAt,
          });
        } catch (err) {
          // Le reseau a pu tomber entre la derniere sonde et maintenant : on
          // revérifie avant de conclure. S'il est vraiment coupe, la photo part
          // en file d'attente plutot que d'etre perdue ; sinon c'est une vraie
          // erreur, et il faut la dire.
          if (await probeApi()) throw err;
          await enqueuePhoto({ chantierId, photo: asset, takenAt });
          Alert.alert(t('offline.banner'), t('offline.photoQueued'));
        }
      }
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.failed'));
    }
  }, [chantierId, createMutation, online, t]);

  const handleDelete = useCallback((id: string) => {
    deleteMutation.mutate(id);
    if (selectedPhoto?.id === id) setSelectedPhoto(null);
  }, [deleteMutation, selectedPhoto]);

  const renderItem = useCallback(
    ({ item }: { item: Photo & { first_name: string; last_name: string } }) => (
      <View style={[styles.photoItem, { backgroundColor: colors.itemBackground }]}>
        <TouchableOpacity
          onPress={() => setSelectedPhoto(item)}
          onLongPress={() => setSelectedPhoto(item)}
          delayLongPress={200}
          activeOpacity={0.8}
          accessibilityRole="image"
          accessibilityLabel={item.caption || t('photos.ofSite')}
        >
          <Image source={{ uri: item.thumbnail_url || item.url }} style={styles.photoImage} />
        </TouchableOpacity>
        {!readonly && (
          <TouchableOpacity
            style={styles.deleteIcon}
            onPress={() => handleDelete(item.id)}
            accessibilityRole="button"
            accessibilityLabel={t('photos.delete')}
          >
            <View style={styles.deleteIconBg}>
              <Trash2 size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        )}
      </View>
    ),
    [colors, handleDelete, readonly, t],
  );

  /**
   * Les photos qui n'ont pas encore pu partir.
   *
   * Affichees a part plutot que melangees a la grille : elles ne sont pas
   * encore sur le chantier, et personne d'autre ne les voit. Les confondre
   * donnerait a l'ouvrier le sentiment d'avoir transmis son travail.
   */
  const renderEnAttente = () => enAttente.length === 0 ? null : (
    <View style={[styles.pendingBox, { borderColor: colors.border, backgroundColor: colors.itemBackground }]}>
      <View style={styles.pendingHeader}>
        <CloudOff size={IconSize.sm} color={colors.mutedText} />
        <Text style={[styles.pendingTitle, { color: colors.text2 }]}>
          {t('photo.pendingUpload')} · {enAttente.length}
        </Text>
      </View>
      <View style={styles.pendingRow}>
        {enAttente.map((p) => (
          <View key={p.id} style={styles.pendingItem}>
            <Image source={{ uri: p.localUri }} style={styles.pendingImage} />
            {p.status === 'error' ? (
              <View style={styles.pendingActions}>
                <Text style={[styles.pendingError, { color: colors.red }]} numberOfLines={1}>
                  {t('photo.uploadFailed')}
                </Text>
                <TouchableOpacity
                  onPress={() => retryPhoto(p.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('photo.retryUpload')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <RotateCw size={IconSize.sm} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => discardPhoto(p.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('photo.discardPending')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={IconSize.sm} color={colors.mutedText} />
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );

  const renderHeader = () => (
    <>
      {renderEnAttente()}
      {readonly ? null : renderActions()}
    </>
  );

  const renderActions = () => (
    <View style={styles.actions}>
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: colors.primary }]}
        onPress={() => pickImage(true)}
        accessibilityRole="button"
        accessibilityLabel={t('photos.take')}
      >
        <Camera size={IconSize.md} color="#FFFFFF" />
        <Text style={styles.actionText}>{t('photos.camera')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionBtn, { backgroundColor: colors.primary }]}
        onPress={() => pickImage(false)}
        accessibilityRole="button"
        accessibilityLabel={t('photos.choose')}
      >
        <ImagePlus size={IconSize.md} color="#FFFFFF" />
        <Text style={styles.actionText}>{t('photos.gallery')}</Text>
      </TouchableOpacity>
    </View>
  );

  const photos = data?.data ?? [];
  const imageSources = useMemo(() => photos.map((p) => ({ uri: p.url })), [photos]);

  // Detail overlay — tap the image to open fullscreen with zoom
  if (selectedPhoto) {
    return (
      <View style={styles.container}>
        <View style={[styles.overlay, { backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={styles.closeIcon}
            onPress={() => setSelectedPhoto(null)}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={IconSize.lg} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.fullImageWrapper}
            onPress={() => {
              const idx = photos.findIndex((p) => p.id === selectedPhoto.id);
              setFullscreenIndex(idx >= 0 ? idx : 0);
            }}
            accessibilityRole="image"
            accessibilityLabel={t('photos.zoom')}
          >
            <Image source={{ uri: selectedPhoto.url }} style={styles.fullImage} resizeMode="contain" />
          </TouchableOpacity>
          <View style={[styles.photoInfo, { backgroundColor: colors.surface }, Shadow.md]}>
            <Text style={[styles.photoAuthor, { color: colors.text }]}>
              {selectedPhoto.first_name} {selectedPhoto.last_name}
            </Text>
            {selectedPhoto.caption && (
              <Text style={[styles.photoCaption, { color: colors.text2 }]}>{selectedPhoto.caption}</Text>
            )}
            <Text style={[styles.photoDate, { color: colors.mutedText }]}>
              {new Date(selectedPhoto.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          </View>
          <View style={styles.detailActions}>
            <TouchableOpacity
              style={[styles.detailBtn, { backgroundColor: colors.primary }]}
              onPress={async () => {
                const name = `photo-${selectedPhoto.id}.jpg`;
                try {
                  const signedUrl = await getSignedFileUrl(selectedPhoto.url);
                  await shareFile(signedUrl, name, selectedPhoto.mime_type || 'image/jpeg');
                } catch { /* silent */ }
              }}
              accessibilityRole="button"
              accessibilityLabel={t('photos.share')}
            >
              <Share2 size={IconSize.md} color="#FFFFFF" />
              <Text style={styles.detailBtnText}>{t('common.share')}</Text>
            </TouchableOpacity>
            {!readonly && <TouchableOpacity
              style={[styles.detailBtn, { backgroundColor: colors.red }]}
              onPress={() => handleDelete(selectedPhoto.id)}
              accessibilityRole="button"
              accessibilityLabel={t('photos.delete')}
            >
              <Trash2 size={IconSize.md} color="#FFFFFF" />
              <Text style={styles.detailBtnText}>{t('common.delete')}</Text>
            </TouchableOpacity>}
          </View>
        </View>

        {/* Fullscreen zoom viewer */}
        <ImageView
          images={imageSources}
          imageIndex={fullscreenIndex ?? 0}
          visible={fullscreenIndex !== null}
          onRequestClose={() => setFullscreenIndex(null)}
          swipeToCloseEnabled
          doubleTapToZoomEnabled
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={data?.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={COLUMN_COUNT}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={[styles.empty, { color: colors.mutedText }]}>{t('photos.empty')}</Text>
          ) : null
        }
      />

    </View>
  );
};

const styles = StyleSheet.create({
  pendingBox: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.md },
  pendingHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  pendingTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  pendingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pendingItem: { alignItems: 'center', gap: Spacing.xs },
  pendingImage: { width: 64, height: 64, borderRadius: Radius.sm, opacity: 0.65 },
  pendingActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  pendingError: { fontSize: FontSize.xs, maxWidth: 70 },
  container: { flex: 1 },
  list: { padding: Spacing.lg },
  actions: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 44,
    borderRadius: Radius.md,
  },
  actionText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  row: { gap: ITEM_GAP, marginBottom: ITEM_GAP },
  photoItem: { width: ITEM_SIZE, height: ITEM_SIZE, borderRadius: Radius.sm, overflow: 'hidden', position: 'relative' },
  photoImage: { width: '100%', height: '100%' },
  deleteIcon: { position: 'absolute', top: 4, right: 4 },
  deleteIconBg: {
    backgroundColor: 'rgba(220, 38, 38, 0.85)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { fontSize: FontSize.base, textAlign: 'center', paddingTop: Spacing.xxxl },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  closeIcon: { position: 'absolute', top: Spacing.md, right: Spacing.md, padding: Spacing.sm, zIndex: 10 },
  fullImageWrapper: { width: '100%', height: '55%' },
  fullImage: { width: '100%', height: '100%' },
  photoInfo: { padding: Spacing.lg, borderRadius: Radius.lg, marginTop: Spacing.lg, width: '100%' },
  photoAuthor: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  photoCaption: { fontSize: FontSize.base, marginTop: Spacing.xs },
  photoDate: { fontSize: FontSize.sm, marginTop: Spacing.xs },
  detailActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg, width: '100%' },
  detailBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 44,
    borderRadius: Radius.md,
  },
  detailBtnText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.medium },

  // Fullscreen viewer footer
  viewerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  viewerInfo: { flex: 1 },
  viewerAuthor: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  viewerDate: { color: '#E7E5E4', fontSize: FontSize.sm, marginTop: 2 },
  viewerCaption: { color: '#E7E5E4', fontSize: FontSize.sm, marginTop: Spacing.xs },
  viewerActions: { flexDirection: 'row', gap: Spacing.sm },
  viewerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PhotoGallery;
