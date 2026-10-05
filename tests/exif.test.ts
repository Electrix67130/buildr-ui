/**
 * Lieu et heure d'une photo choisie dans la galerie.
 *
 * Une photo de la veille envoyee depuis le bureau doit garder les coordonnees
 * du chantier et l'heure ou elle a ete prise, pas celles de l'envoi. iOS et
 * Android ne rangent pas ces metadonnees de la meme facon : une forme mal lue
 * ne plante rien, elle place la photo au mauvais endroit, en silence.
 */
import { extractPhotoMeta } from '@/utils/exif';

describe('extractPhotoMeta', () => {
  it('lit la forme iOS ({GPS} et {Exif}), hemisphere sud compris', () => {
    const meta = extractPhotoMeta({
      exif: {
        '{GPS}': { Latitude: 33.8688, LatitudeRef: 'S', Longitude: 151.2093, LongitudeRef: 'E' },
        '{Exif}': { DateTimeOriginal: '2026:10:04 14:32:10' },
      },
    });
    expect(meta.latitude).toBeCloseTo(-33.8688, 6);
    expect(meta.longitude).toBeCloseTo(151.2093, 6);
    expect(meta.takenAt).toBe(new Date(2026, 9, 4, 14, 32, 10).toISOString());
  });

  it('lit la forme Android a plat, en fractions degres/minutes/secondes', () => {
    const meta = extractPhotoMeta({
      exif: {
        GPSLatitude: '48/1,51/1,2730/100',
        GPSLatitudeRef: 'N',
        GPSLongitude: '2/1,21/1,0/1',
        GPSLongitudeRef: 'W',
        DateTimeOriginal: '2026:10:04 14:32:10',
      },
    });
    expect(meta.latitude).toBeCloseTo(48 + 51 / 60 + 27.3 / 3600, 6);
    expect(meta.longitude).toBeCloseTo(-(2 + 21 / 60), 6);
    expect(meta.takenAt).toBe(new Date(2026, 9, 4, 14, 32, 10).toISOString());
  });

  it('rend un objet vide quand la photo n a aucune metadonnee', () => {
    expect(extractPhotoMeta({ exif: undefined })).toEqual({
      latitude: undefined,
      longitude: undefined,
      takenAt: undefined,
    });
    expect(extractPhotoMeta({ exif: {} })).toEqual({
      latitude: undefined,
      longitude: undefined,
      takenAt: undefined,
    });
  });

  it('ne garde aucune coordonnee quand la longitude manque', () => {
    const meta = extractPhotoMeta({ exif: { '{GPS}': { Latitude: 48.85, LatitudeRef: 'N' } } });
    expect(meta.latitude).toBeUndefined();
    expect(meta.longitude).toBeUndefined();
  });

  it('rejette des coordonnees hors bornes ou nulles', () => {
    expect(extractPhotoMeta({ exif: { '{GPS}': { Latitude: 95, Longitude: 2 } } }).latitude).toBeUndefined();
    expect(extractPhotoMeta({ exif: { '{GPS}': { Latitude: 48, Longitude: 200 } } }).longitude).toBeUndefined();
    // 0,0 est la valeur d'un capteur sans position, pas un lieu reel.
    expect(extractPhotoMeta({ exif: { '{GPS}': { Latitude: 0, Longitude: 0 } } }).latitude).toBeUndefined();
  });

  it('ignore une date qui n est pas au format EXIF', () => {
    expect(extractPhotoMeta({ exif: { DateTimeOriginal: 'hier soir' } }).takenAt).toBeUndefined();
  });
});
