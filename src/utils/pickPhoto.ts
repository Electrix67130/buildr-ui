import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { optimizeImage } from '@/utils/optimizeImage';
import { uploadFile } from '@/api/upload';
import type { TranslationKeys } from '@/i18n/translations';

export interface UploadedPhoto {
  url: string;
  thumbnail_url?: string;
  file_size?: number;
  mime_type?: string;
  taken_at: string;
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
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false })
    : await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: 0,
        orderedSelection: true,
      });
  if (result.canceled || result.assets.length === 0) return [];

  const taken_at = new Date().toISOString();
  const uploaded: UploadedPhoto[] = [];
  for (const asset of result.assets) {
    const optimized = await optimizeImage(asset.uri, asset.width, asset.height);
    const file = await uploadFile(optimized.uri, `photo-${Date.now()}-${uploaded.length}.jpg`, optimized.mimeType);
    uploaded.push({
      url: file.url,
      thumbnail_url: file.thumbnail_url,
      file_size: file.file_size,
      mime_type: file.mime_type,
      taken_at,
      local_uri: optimized.uri,
    });
  }
  return uploaded;
}
