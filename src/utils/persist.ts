import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

/** Cle du cache React Query conserve sur le telephone. */
export const PERSIST_KEY = 'BUILDR_RQ_CACHE';

/**
 * A incrementer pour purger le cache conserve apres un changement de forme des
 * donnees. Sans cela, une app mise a jour relirait un cache dont la structure
 * ne correspond plus a ce que le code attend.
 */
export const PERSIST_BUSTER = 'v1';

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: PERSIST_KEY,
  throttleTime: 1000,
});

/**
 * Efface le cache conserve.
 *
 * Appele a la deconnexion : le cache contient les chantiers, les adresses et
 * les discussions de l'utilisateur precedent. Sur un telephone partage entre
 * deux ouvriers, les laisser serait une fuite.
 */
export async function clearPersistedCache(): Promise<void> {
  await AsyncStorage.removeItem(PERSIST_KEY);
}
