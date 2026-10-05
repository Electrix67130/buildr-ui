import type { ImagePickerAsset } from 'expo-image-picker';

export interface PhotoMeta {
  latitude?: number;
  longitude?: number;
  /** Date de prise de vue, ISO. */
  takenAt?: string;
}

/** `48/1,51/1,2730/100` ou `[48, 51, 27.3]` → degres decimaux. */
function dmsToDecimal(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  let parts: number[] | undefined;
  if (Array.isArray(value)) {
    parts = value.map(Number);
  } else if (typeof value === 'string') {
    parts = value.split(',').map((p) => {
      const [num, den] = p.split('/').map(Number);
      return den ? num / den : num;
    });
  }
  if (!parts || parts.some((n) => !Number.isFinite(n))) return undefined;
  if (parts.length === 1) return parts[0];
  const [d = 0, m = 0, s = 0] = parts;
  return d + m / 60 + s / 3600;
}

/** `2026:10:04 14:32:10` (format EXIF) → ISO, en heure locale de l'appareil. */
function exifDateToIso(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const m = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Lit la position et la date de prise de vue dans les metadonnees d'une photo.
 *
 * Une photo choisie dans la galerie a ete prise ailleurs et plus tot : ce
 * sont ces coordonnees-la qu'il faut garder, pas celles de l'endroit ou l'on
 * se trouve en l'envoyant. A lire AVANT l'optimisation, qui retire les
 * metadonnees avant l'envoi. iOS les range sous `{GPS}` et `{Exif}`, Android a
 * plat (`GPSLatitude`, `DateTimeOriginal`) ; les deux formes sont lues.
 * Absentes si l'appareil photo n'avait pas acces a la position.
 */
export function extractPhotoMeta(asset: Pick<ImagePickerAsset, 'exif'>): PhotoMeta {
  const exif = (asset.exif ?? {}) as Record<string, unknown>;
  const gps = (exif['{GPS}'] as Record<string, unknown> | undefined) ?? exif;
  const inner = (exif['{Exif}'] as Record<string, unknown> | undefined) ?? exif;

  let latitude = dmsToDecimal(gps.Latitude ?? gps.GPSLatitude);
  let longitude = dmsToDecimal(gps.Longitude ?? gps.GPSLongitude);
  const latRef = String(gps.LatitudeRef ?? gps.GPSLatitudeRef ?? '').toUpperCase();
  const lngRef = String(gps.LongitudeRef ?? gps.GPSLongitudeRef ?? '').toUpperCase();
  if (latitude !== undefined && latRef === 'S' && latitude > 0) latitude = -latitude;
  if (longitude !== undefined && lngRef === 'W' && longitude > 0) longitude = -longitude;
  if (latitude !== undefined && (Math.abs(latitude) > 90 || latitude === 0)) latitude = undefined;
  if (longitude !== undefined && (Math.abs(longitude) > 180 || longitude === 0)) longitude = undefined;

  const takenAt = exifDateToIso(inner.DateTimeOriginal ?? inner.DateTimeDigitized ?? exif.DateTimeOriginal ?? exif.DateTime);

  return {
    latitude: latitude !== undefined && longitude !== undefined ? latitude : undefined,
    longitude: latitude !== undefined && longitude !== undefined ? longitude : undefined,
    takenAt,
  };
}
