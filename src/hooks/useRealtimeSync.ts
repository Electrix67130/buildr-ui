import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAccessToken } from '@/api/client';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || 'change-me-in-production';

const WS_URL = API_URL.replace(/^http/, 'ws');

const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];

export type RealtimeEventType =
  | 'comment.created'
  | 'comment.updated'
  | 'comment.deleted'
  | 'photo.created'
  | 'photo.deleted'
  | 'document.created'
  | 'document.deleted'
  | 'emergency.created'
  | 'emergency.deleted'
  | 'emergency-comment.created'
  | 'emergency-comment.updated'
  | 'emergency-comment.deleted'
  | 'chantier-member.created'
  | 'chantier-member.updated'
  | 'chantier-member.deleted'
  | 'membership.updated';

interface RealtimeEvent {
  type: RealtimeEventType;
  chantier_id?: string;
  resource_id?: string;
  actor_id?: string;
}

interface Options {
  enabled: boolean;
  /** Appele quand le serveur ferme avec code 4001 (single-session : compte connecte ailleurs). */
  onSessionReplaced?: () => void;
  /** Appele quand le serveur ferme avec code 4002 : le compte vient d'etre desactive. */
  onAccountDisabled?: () => void;
  /** Appele quand le serveur ferme avec code 4003 : le compte vient d'etre supprime. */
  onAccountDeleted?: () => void;
}

export function useRealtimeSync({ enabled, onSessionReplaced, onAccountDisabled, onAccountDeleted }: Options): void {
  // Les callbacks changent a chaque rendu ; l'effet ne se rebranche que sur
  // `enabled`. Une ref garde toujours la derniere version.
  const callbacks = useRef({ onSessionReplaced, onAccountDisabled, onAccountDeleted });
  callbacks.current = { onSessionReplaced, onAccountDisabled, onAccountDeleted };
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    cancelledRef.current = false;

    const handleEvent = (event: RealtimeEvent) => {
      const cid = event.chantier_id;
      switch (event.type) {
        case 'comment.created':
        case 'comment.updated':
        case 'comment.deleted':
          queryClient.invalidateQueries({ queryKey: ['comments', cid] });
          queryClient.invalidateQueries({ queryKey: ['chantier-views', 'unread', cid] });
          queryClient.invalidateQueries({ queryKey: ['chantier-views', 'unread-summary'] });
          break;
        case 'photo.created':
        case 'photo.deleted':
          queryClient.invalidateQueries({ queryKey: ['photos', cid] });
          queryClient.invalidateQueries({ queryKey: ['chantier-views', 'unread', cid] });
          queryClient.invalidateQueries({ queryKey: ['chantier-views', 'unread-summary'] });
          break;
        case 'document.created':
        case 'document.deleted':
          queryClient.invalidateQueries({ queryKey: ['documents', cid] });
          queryClient.invalidateQueries({ queryKey: ['chantier-views', 'unread', cid] });
          queryClient.invalidateQueries({ queryKey: ['chantier-views', 'unread-summary'] });
          break;
        case 'emergency.created':
        case 'emergency.deleted':
          queryClient.invalidateQueries({ queryKey: ['emergencies', cid] });
          queryClient.invalidateQueries({ queryKey: ['chantier-views', 'unread', cid] });
          queryClient.invalidateQueries({ queryKey: ['chantier-views', 'unread-summary'] });
          break;
        case 'emergency-comment.created':
        case 'emergency-comment.updated':
        case 'emergency-comment.deleted':
          // L'urgence_id n'est pas dans l'event ; on invalide tous les emergency-comments.
          queryClient.invalidateQueries({ queryKey: ['emergency-comments'] });
          // Met a jour la pastille de l'onglet Urgences en temps reel.
          queryClient.invalidateQueries({ queryKey: ['chantier-views', 'unread', cid] });
          queryClient.invalidateQueries({ queryKey: ['chantier-views', 'unread-summary'] });
          break;
        case 'chantier-member.created':
        case 'chantier-member.updated':
        case 'chantier-member.deleted':
          queryClient.invalidateQueries({ queryKey: ['chantier-members', cid] });
          // Etre ajoute ou retire change ce qu'on a le droit de voir : la
          // liste des chantiers et ses propres droits sur celui-ci.
          queryClient.invalidateQueries({ queryKey: ['chantiers'] });
          break;
        case 'membership.updated':
          // Le role conditionne tout ce que l'API renvoie : on relit tout,
          // profil en tete, pour que les nouveaux droits s'appliquent sans
          // attendre.
          queryClient.invalidateQueries();
          break;
      }
    };

    const connect = async () => {
      if (cancelledRef.current) return;
      const token = await getAccessToken();
      // Le composant a pu etre demonte pendant la lecture du jeton : on
      // n'ouvre pas une socket que personne ne fermera.
      if (!token || cancelledRef.current) return;

      const url = `${WS_URL}/ws?token=${encodeURIComponent(token)}&api_key=${encodeURIComponent(API_KEY)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data as string) as RealtimeEvent;
          handleEvent(event);
        } catch {
          // ignore malformed
        }
      };

      ws.onclose = (e) => {
        wsRef.current = null;

        // Code 4001 = session-replaced (single-session enforcement). On ne reconnecte pas
        // et on previent le parent pour qu'il logout.
        if (e.code === 4001) {
          cancelledRef.current = true;
          callbacks.current.onSessionReplaced?.();
          return;
        }
        if (e.code === 4002) {
          cancelledRef.current = true;
          callbacks.current.onAccountDisabled?.();
          return;
        }
        if (e.code === 4003) {
          cancelledRef.current = true;
          callbacks.current.onAccountDeleted?.();
          return;
        }

        if (cancelledRef.current) return;

        // Reconnect avec backoff exponentiel.
        const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS_MS.length - 1)];
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // Le close handler s'occupe du reconnect.
      };
    };

    connect();

    return () => {
      cancelledRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close(1000, 'unmount');
        } catch {
          // ignore
        }
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
