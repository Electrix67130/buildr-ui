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
 * Prend ou choisit une photo, l'optimise et l'envoie.
 *
 * Renvoie `null` si la personne annule ou refuse une permission (deja
 * expliquee par une alerte). La photo n'est pas encore enregistree cote API :
 * l'appelant decide a quoi la rattacher. Contrairement a la galerie, pas de
 * file d'attente hors ligne : la validation d'une etape est un geste court,
 * on prefere dire tout de suite que la photo n'est pas partie.
 */
export async function pickAndUploadPhoto(useCamera: boolean, t: T): Promise<UploadedPhoto | null> {
  if (useCamera) {
    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (!camPerm.granted) {
      Alert.alert(t('urgence.cameraDenied'), t('urgence.cameraDeniedBody'));
      return null;
    }
  }
  // iOS : la camera a aussi besoin de la photothèque pour enregistrer la prise.
  const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!libPerm.granted) {
    Alert.alert(t('urgence.galleryDenied'), t('urgence.galleryDeniedBody'));
    return null;
  }

  const result = useCamera
    ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const taken_at = new Date().toISOString();
  const optimized = await optimizeImage(asset.uri, asset.width, asset.height);
  const uploaded = await uploadFile(optimized.uri, `photo-${Date.now()}.jpg`, optimized.mimeType);
  return {
    url: uploaded.url,
    thumbnail_url: uploaded.thumbnail_url,
    file_size: uploaded.file_size,
    mime_type: uploaded.mime_type,
    taken_at,
    local_uri: optimized.uri,
  };
}
