import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { optimizeImage } from '@/utils/optimizeImage';
import { uploadFile } from '@/api/upload';
import { extractPhotoMeta } from '@/utils/exif';
import type { TranslationKeys } from '@/i18n/translations';

export interface UploadedPhoto {
  url: string;
  thumbnail_url?: string;
  file_size?: number;
  mime_type?: string;
  taken_at: string;
  /** Position lue dans les metadonnees de la photo, si elle en avait. */
  latitude?: number;
  longitude?: number;
  /** Apercu local, affiche en attendant que l'API renvoie la vignette. */
  local_uri: string;
}

type T = (key: TranslationKeys, params?: Record<string, string | number>) => string;

/**
 * Prend une photo, ou en choisit plusieurs dans la galerie, les optimise et
 * les envoie.
 *
 * Renvoie une liste vide si la personne annule ou refuse une permission (deja
 * expliquee par une alerte). Les photos ne sont pas encore enregistrees cote
 * API : l'appelant decide a quoi les rattacher. Contrairement a la galerie du
 * chantier, pas de file d'attente hors ligne : la validation d'une etape est
 * un geste court, on prefere dire tout de suite que la photo n'est pas partie.
 */
export async function pickAndUploadPhotos(useCamera: boolean, t: T): Promise<UploadedPhoto[]> {
  if (useCamera) {
    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (!camPerm.granted) {
      Alert.alert(t('urgence.cameraDenied'), t('urgence.cameraDeniedBody'));
      return [];
    }
  }
  // iOS : la camera a aussi besoin de la photothèque pour enregistrer la prise.
  const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!libPerm.granted) {
    Alert.alert(t('urgence.galleryDenied'), t('urgence.galleryDeniedBody'));
    return [];
  }

  const result = useCamera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false, exif: true })
    : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: 0,
        orderedSelection: true,
        exif: true,
      });
  if (result.canceled || result.assets.length === 0) return [];

  const now = new Date().toISOString();
  const uploaded: UploadedPhoto[] = [];
  let failed = 0;
  for (const [i, asset] of result.assets.entries()) {
    // Metadonnees lues avant l'optimisation, qui les retire.
    const meta = extractPhotoMeta(asset);
    let optimized: Awaited<ReturnType<typeof optimizeImage>>;
    let file: Awaited<ReturnType<typeof uploadFile>>;
    try {
      optimized = await optimizeImage(asset.uri, asset.width, asset.height);
      file = await uploadFile(optimized.uri, `photo-${Date.now()}-${i}.jpg`, optimized.mimeType);
    } catch {
      // Les autres partent quand meme ; l'echec est dit a la fin, en une fois.
      failed += 1;
      continue;
    }
    uploaded.push({
      url: file.url,
      thumbnail_url: file.thumbnail_url,
      file_size: file.file_size,
      mime_type: file.mime_type,
      taken_at: meta.takenAt ?? now,
      latitude: meta.latitude,
      longitude: meta.longitude,
      local_uri: optimized.uri,
    });
  }
  if (failed > 0) Alert.alert(t('common.error'), t('photos.partialFailure', { count: failed }));
  return uploaded;
}
