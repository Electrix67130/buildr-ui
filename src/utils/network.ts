import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { onlineManager } from '@tanstack/react-query';
import { probeApi } from '@/api/client';

/** Reactif : true si l'API est joignable, false sinon. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  return online;
}

/**
 * Branche React Query sur une detection reseau en JavaScript pur.
 *
 * Pas de module natif : la fonctionnalite part en mise a jour OTA, sans
 * repasser par l'App Store.
 *
 * On sonde l'API plutot que l'etat de l'interface reseau, parce que les deux
 * different souvent sur un chantier : une barre de signal ne dit pas qu'un
 * serveur repond. Le cas courant est le Wi-Fi du bureau de chantier auquel on
 * est connecte sans acces a internet.
 *
 * Trois declencheurs : au demarrage, au retour de l'app au premier plan — le
 * cas le plus frequent, on ressort le telephone de sa poche — et toutes les
 * 20 s tant que l'app est active, pour rattraper un retour de reseau pendant
 * l'usage. iOS suspend le JavaScript en arriere-plan : l'intervalle ne coute
 * donc rien a la batterie quand l'app est fermee.
 *
 * Hors ligne, React Query met les requetes en pause mais continue de servir le
 * cache. Au retour du reseau, il rafraichit de lui-meme.
 *
 * A appeler une seule fois, au chargement du module racine.
 */
export function initOnlineManager(): void {
  onlineManager.setEventListener((setOnline) => {
    let cancelled = false;

    const check = async () => {
      const reachable = await probeApi();
      if (!cancelled) setOnline(reachable);
    };

    check();

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    const interval = setInterval(check, 20_000);

    return () => {
      cancelled = true;
      appStateSub.remove();
      clearInterval(interval);
    };
  });
}
