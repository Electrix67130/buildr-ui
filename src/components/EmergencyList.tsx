import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { AlertTriangle, Camera, ImagePlus, MapPin, MessageSquareWarning } from 'lucide-react-native';
import ActionSheet from './ActionSheet';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { useEmergencies, useCreateEmergency, EmergencyWithAuthor } from '@/api/hooks/useEmergencies';
import { useUnreadCounts, useMarkTabViewed, useMarkItemViewed } from '@/api/hooks/useChantierViews';
import { uploadFile } from '@/api/upload';
import { optimizeImage } from '@/utils/optimizeImage';

/** Attente maximale d'un point GPS precis avant d'enregistrer sans coordonnees. */
const GPS_TIMEOUT_MS = 8_000;

export type EmergencySplitTab = 'emergency' | 'claim';

interface Props {
  chantierId: string;
  /** Si false, le bouton de creation est cache. */
  canCreate?: boolean;
  /** 'claim' = mode reclamation (client). 'emergency' = mode urgence (manager/ouvrier). 'split' = admin (deux sous-tabs). */
  mode?: 'emergency' | 'claim' | 'split';
  readonly?: boolean;
  /** Sous-onglet actif (mode split) controle par le parent — preserve entre main-tab switches. */
  splitTab?: EmergencySplitTab;
  onSplitTabChange?: (tab: EmergencySplitTab) => void;
}

export default function EmergencyList({
  chantierId,
  canCreate = true,
  mode = 'emergency',
  readonly,
  splitTab: splitTabProp,
  onSplitTabChange,
}: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { t } = useTranslation();

  const { data, isLoading, refetch, isRefetching } = useEmergencies(chantierId);
  const createMutation = useCreateEmergency();

  const [submitting, setSubmitting] = useState(false);
  const [showSourceSheet, setShowSourceSheet] = useState(false);
  const [internalSplitTab, setInternalSplitTab] = useState<EmergencySplitTab>('emergency');
  const splitTab = splitTabProp ?? internalSplitTab;
  const setSplitTab = (tab: EmergencySplitTab) => {
    if (onSplitTabChange) onSplitTabChange(tab);
    else setInternalSplitTab(tab);
  };

  // Pastilles non-lu par sous-onglet (mode split uniquement). En mode non-split
  // il n'y a qu'un seul flux, le parent gère la pastille principale.
  const { data: unreadCounts } = useUnreadCounts(chantierId);
  const markTabViewed = useMarkTabViewed();
  const unreadEmergency = unreadCounts?.emergencies ?? 0;
  const unreadClaim = unreadCounts?.emergencies_claim ?? 0;
  const unreadEmergencyIds = useMemo(
    () => new Set(unreadCounts?.unread_emergency_ids ?? []),
    [unreadCounts?.unread_emergency_ids],
  );

  // Pas de markTabViewed à l'arrivée — la pastille d'une urgence/réclamation
  // précise s'efface uniquement quand on l'ouvre (cf. onPress du renderItem).
  const markItemViewed = useMarkItemViewed();

  const isPickingRef = useRef(false);

  const formatDateTime = (date: string) => {
    const d = new Date(date);
    return (
      d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' à ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    );
  };

  const captureAndUpload = useCallback(
    async (useCamera: boolean) => {
      if (isPickingRef.current) return;
      isPickingRef.current = true;
      setSubmitting(true);
      try {
        // Permissions
        // iOS : launchCameraAsync requiert AUSSI la permission MediaLibrary
        // pour pouvoir sauvegarder la photo prise. On demande les deux.
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
        if (result.canceled || !result.assets[0]) return;

        const asset = result.assets[0];
        const optimized = await optimizeImage(asset.uri, asset.width, asset.height);
        const fileName = `emergency-${Date.now()}.jpg`;
        const uploaded = await uploadFile(optimized.uri, fileName, optimized.mimeType);

        // GPS du device au moment de la capture. Accuracy.High vise ~10 m :
        // sur un chantier, il faut pouvoir retrouver le point exact du danger,
        // pas seulement la parcelle.
        let latitude: number | undefined;
        let longitude: number | undefined;
        const locPerm = await Location.requestForegroundPermissionsAsync();
        if (locPerm.granted) {
          try {
            // Un fix precis peut etre long a obtenir (batiment, tranchee, ciel
            // masque). On plafonne l'attente : une urgence sans coordonnees vaut
            // mieux qu'une urgence qui ne part pas.
            const pos = await Promise.race([
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), GPS_TIMEOUT_MS)),
            ]);
            if (pos) {
              latitude = pos.coords.latitude;
              longitude = pos.coords.longitude;
            }
          } catch {
            // GPS indispo — on enregistre quand meme la photo
          }
        }

        await createMutation.mutateAsync({
          chantier_id: chantierId,
          photo_url: uploaded.url,
          latitude,
          longitude,
        });
      } catch (err) {
        Alert.alert(t('common.error'), err instanceof Error ? err.message : t('urgence.saveFailed'));
      } finally {
        setSubmitting(false);
        isPickingRef.current = false;
      }
    },
    [chantierId, createMutation, t],
  );

  const handleAddPress = useCallback(() => {
    setShowSourceSheet(true);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: EmergencyWithAuthor }) => {
      const lat = item.latitude != null ? Number(item.latitude) : null;
      const lng = item.longitude != null ? Number(item.longitude) : null;
      const hasGps = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);
      const hasUnread = unreadEmergencyIds.has(item.id);
      return (
        <TouchableOpacity
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: hasUnread ? colors.red : colors.border,
              borderWidth: hasUnread ? 1.5 : 1,
            },
            Shadow.sm,
          ]}
          onPress={() => {
            markItemViewed.mutate({ item_type: 'emergency', item_id: item.id });
            router.push({ pathname: '/emergency/[id]', params: { id: item.id, chantierId, mode: item.type } });
          }}
          activeOpacity={0.85}
        >
          {hasUnread ? (
            <View
              style={[styles.unreadDot, { backgroundColor: colors.red }]}
              accessibilityLabel="Activité non lue"
            />
          ) : null}
          {item.photo_url ? (
            <Image source={{ uri: item.photo_url }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, { backgroundColor: colors.itemBackground, alignItems: 'center', justifyContent: 'center' }]}>
              <AlertTriangle size={IconSize.lg} color={colors.red} />
            </View>
          )}
          <View style={styles.cardInfo}>
            <Text style={[styles.cardAuthor, { color: colors.text }]}>
              {item.first_name} {item.last_name}
            </Text>
            <Text style={[styles.cardDate, { color: colors.mutedText }]}>{formatDateTime(item.created_at)}</Text>
            {hasGps ? (
              <View style={styles.row}>
                <MapPin size={12} color={colors.primary} />
                <Text style={[styles.coord, { color: colors.primary }]}>
                  {lat!.toFixed(5)}, {lng!.toFixed(5)}
                </Text>
              </View>
            ) : (
              <Text style={[styles.coord, { color: colors.mutedText, fontStyle: 'italic' }]}>{t('urgence.noGps')}</Text>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [colors, t, router, chantierId, unreadEmergencyIds],
  );

  const allItems = data?.data ?? [];
  const emergencyItems = allItems.filter((it) => it.type === 'emergency');
  const claimItems = allItems.filter((it) => it.type === 'claim');

  // Filtrage selon le mode :
  // - 'claim' (client) : seulement les reclamations
  // - 'emergency' (ouvrier) : seulement les urgences
  // - 'split' (admin/manager) : selon le sous-onglet
  const visibleItems =
    mode === 'split'
      ? splitTab === 'emergency'
        ? emergencyItems
        : claimItems
      : mode === 'claim'
        ? claimItems
        : emergencyItems;

  // Pour l'admin (mode split), bouton de creation = "Signaler une urgence" (rouge).
  // Le bouton est masque sur le sous-onglet Reclamations (admin n'en cree pas lui-meme).
  const showCreateBtn =
    !readonly && canCreate && (mode !== 'split' || splitTab === 'emergency');

  return (
    <View style={styles.container}>
      {mode === 'split' ? (
        <View style={[styles.toggleBar, { backgroundColor: colors.itemBackground }]}>
          <TouchableOpacity
            onPress={() => setSplitTab('emergency')}
            style={[styles.togglePill, splitTab === 'emergency' && { backgroundColor: colors.surface }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: splitTab === 'emergency' }}
          >
            <View style={styles.pillIconWrap}>
              <AlertTriangle
                size={IconSize.sm}
                color={splitTab === 'emergency' ? colors.red : colors.text2}
              />
              {splitTab !== 'emergency' && unreadEmergency > 0 ? (
                <View style={[styles.subUnreadBadge, { backgroundColor: colors.red }]}>
                  <Text style={styles.subUnreadBadgeText}>
                    {unreadEmergency > 99 ? '99+' : unreadEmergency}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[
                styles.togglePillText,
                { color: splitTab === 'emergency' ? colors.red : colors.text2 },
              ]}
            >
              Incident externe{emergencyItems.length > 0 ? ` (${emergencyItems.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.togglePill, splitTab === 'claim' && { backgroundColor: colors.surface }]}
            onPress={() => setSplitTab('claim')}
            accessibilityRole="tab"
            accessibilityState={{ selected: splitTab === 'claim' }}
          >
            <View style={styles.pillIconWrap}>
              <MessageSquareWarning
                size={IconSize.sm}
                color={splitTab === 'claim' ? colors.red : colors.text2}
              />
              {splitTab !== 'claim' && unreadClaim > 0 ? (
                <View style={[styles.subUnreadBadge, { backgroundColor: colors.red }]}>
                  <Text style={styles.subUnreadBadgeText}>
                    {unreadClaim > 99 ? '99+' : unreadClaim}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[
                styles.togglePillText,
                { color: splitTab === 'claim' ? colors.red : colors.text2 },
              ]}
            >
              Réclamations{claimItems.length > 0 ? ` (${claimItems.length})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {showCreateBtn && (
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: mode === 'claim' ? colors.primary : colors.red }]}
          onPress={handleAddPress}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={mode === 'claim' ? t('urgence.makeClaim') : t('urgence.report')}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <AlertTriangle size={IconSize.md} color="#FFFFFF" />
              <Text style={styles.addBtnText}>
                {mode === 'claim' ? t('urgence.makeClaim') : t('urgence.report')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={[styles.empty, { color: colors.mutedText }]}>
              {(mode === 'claim' || (mode === 'split' && splitTab === 'claim'))
                ? t('urgence.emptyClaim')
                : t('urgence.empty')}
            </Text>
          ) : null
        }
      />

      <ActionSheet
        visible={showSourceSheet}
        title={mode === 'claim' ? t('urgence.newClaim') : t('urgence.newOne')}
        subtitle={t('urgence.photoFrom')}
        onClose={() => setShowSourceSheet(false)}
        options={[
          {
            key: 'camera',
            label: t('photos.camera'),
            description: t('urgence.pickCameraDesc'),
            icon: Camera,
            onPress: () => captureAndUpload(true),
          },
          {
            key: 'gallery',
            label: t('photos.gallery'),
            description: t('urgence.pickGalleryDesc'),
            icon: ImagePlus,
            onPress: () => captureAndUpload(false),
          },
        ]}
      />
    </View>
  );
}

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
  addBtnText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  list: { paddingBottom: Spacing.xxxl },
  card: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  thumb: { width: 72, height: 72, borderRadius: Radius.md },
  cardInfo: { flex: 1, justifyContent: 'center', gap: 2 },
  cardAuthor: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  cardDate: { fontSize: FontSize.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  coord: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  empty: { fontSize: FontSize.base, textAlign: 'center', paddingTop: Spacing.xxxl, fontStyle: 'italic' },

  toggleBar: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
    padding: 4,
    borderRadius: Radius.pill,
    gap: 4,
  },
  togglePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  togglePillText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  pillIconWrap: { position: 'relative' },
  subUnreadBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subUnreadBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: FontWeight.bold },

  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    zIndex: 1,
  },
});
