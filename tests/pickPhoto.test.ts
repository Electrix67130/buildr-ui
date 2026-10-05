/**
 * Choix et envoi de photos pour valider une etape.
 *
 * On choisit souvent plusieurs photos d'un coup dans la galerie, prises la
 * veille sur le chantier. Chacune doit partir, et garder son lieu et son heure
 * de prise de vue : l'optimisation retire les metadonnees, donc les lire apres
 * reviendrait a les perdre, en silence. Annuler ou refuser une permission ne
 * doit rien envoyer.
 */
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { pickAndUploadPhotos } from '@/utils/pickPhoto';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

/** Journal des etapes, pour verifier l'ordre lecture des metadonnees / optimisation. */
const mockJournal: string[] = [];

jest.mock('@/utils/exif', () => {
  const reel = jest.requireActual('@/utils/exif');
  return {
    extractPhotoMeta: (asset: { uri: string }) => {
      mockJournal.push(`meta:${asset.uri}`);
      return reel.extractPhotoMeta(asset);
    },
  };
});

const mockOptimize = jest.fn(async (uri: string) => {
  mockJournal.push(`optimise:${uri}`);
  return { uri: `${uri}.optimise.jpg`, width: 1920, height: 1440, mimeType: 'image/jpeg' };
});
jest.mock('@/utils/optimizeImage', () => ({ optimizeImage: (uri: string) => mockOptimize(uri) }));

const mockUpload = jest.fn();
jest.mock('@/api/upload', () => ({ uploadFile: (...args: unknown[]) => mockUpload(...args) }));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const t = (key: string) => key;

function asset(uri: string, exif?: Record<string, unknown>) {
  return { uri, width: 4000, height: 3000, exif } as ImagePicker.ImagePickerAsset;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockJournal.length = 0;
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as ImagePicker.CameraPermissionResponse);
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as ImagePicker.MediaLibraryPermissionResponse);
  let n = 0;
  mockUpload.mockImplementation(async () => {
    n += 1;
    return { url: `https://api/files/${n}.jpg`, thumbnail_url: `https://api/files/${n}-thumb.jpg`, file_size: 1000, mime_type: 'image/jpeg' };
  });
});

describe('Galerie', () => {
  it('envoie chaque photo d une selection multiple, dans l ordre', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [asset('file:///a.jpg'), asset('file:///b.jpg'), asset('file:///c.jpg')],
    });

    const photos = await pickAndUploadPhotos(false, t);

    expect(picker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsMultipleSelection: true, exif: true }));
    expect(mockUpload).toHaveBeenCalledTimes(3);
    expect(mockUpload.mock.calls.map((c) => c[0])).toEqual([
      'file:///a.jpg.optimise.jpg',
      'file:///b.jpg.optimise.jpg',
      'file:///c.jpg.optimise.jpg',
    ]);
    expect(photos.map((p) => p.url)).toEqual(['https://api/files/1.jpg', 'https://api/files/2.jpg', 'https://api/files/3.jpg']);
    expect(photos[0].local_uri).toBe('file:///a.jpg.optimise.jpg');
  });

  it('lit lieu et heure de prise de vue avant l optimisation', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        asset('file:///a.jpg', {
          '{GPS}': { Latitude: 48.58, LatitudeRef: 'N', Longitude: 7.75, LongitudeRef: 'E' },
          '{Exif}': { DateTimeOriginal: '2026:10:03 16:05:00' },
        }),
      ],
    });

    const [photo] = await pickAndUploadPhotos(false, t);

    expect(mockJournal).toEqual(['meta:file:///a.jpg', 'optimise:file:///a.jpg']);
    expect(photo.latitude).toBeCloseTo(48.58, 6);
    expect(photo.longitude).toBeCloseTo(7.75, 6);
    expect(photo.taken_at).toBe(new Date(2026, 9, 3, 16, 5, 0).toISOString());
  });

  it('date une photo sans metadonnees de l instant de l envoi, sans position', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [asset('file:///a.jpg')] });
    const avant = Date.now();

    const [photo] = await pickAndUploadPhotos(false, t);

    expect(Date.parse(photo.taken_at)).toBeGreaterThanOrEqual(avant);
    expect(photo.latitude).toBeUndefined();
    expect(photo.longitude).toBeUndefined();
  });

  it('annuler la selection ne renvoie rien et n envoie rien', async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null });

    await expect(pickAndUploadPhotos(false, t)).resolves.toEqual([]);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('refuser l acces a la galerie previent et n ouvre rien', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false } as ImagePicker.MediaLibraryPermissionResponse);

    await expect(pickAndUploadPhotos(false, t)).resolves.toEqual([]);
    expect(Alert.alert).toHaveBeenCalledWith('urgence.galleryDenied', 'urgence.galleryDeniedBody');
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });
});

describe('Appareil photo', () => {
  it('refuser la camera previent et n ouvre rien', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as ImagePicker.CameraPermissionResponse);

    await expect(pickAndUploadPhotos(true, t)).resolves.toEqual([]);
    expect(Alert.alert).toHaveBeenCalledWith('urgence.cameraDenied', 'urgence.cameraDeniedBody');
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('envoie la prise de vue', async () => {
    picker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [asset('file:///cam.jpg')] });

    const photos = await pickAndUploadPhotos(true, t);

    expect(picker.launchCameraAsync).toHaveBeenCalledWith(expect.objectContaining({ exif: true }));
    expect(photos).toHaveLength(1);
  });
});
