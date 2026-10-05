/**
 * Preparation commune a tous les fichiers de test.
 *
 * Seuls les modules natifs sans equivalent JavaScript sont remplaces ici. Un
 * fichier de test qui a besoin d'une doublure plus fine (le stockage de la
 * file photo, par exemple) la redeclare : son `jest.mock` l'emporte.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
