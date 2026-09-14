import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { onlineManager, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/api/client';
import { uploadFile } from '@/api/upload';
import { optimizeImage } from '@/utils/optimizeImage';

/**
 * File d'attente des photos prises hors ligne.
 *
 * Un chantier est souvent mal couvert — tranchee, sous-sol, zone rurale — et la
 * photo d'avancement est le geste le plus frequent sur place. La perdre parce
 * qu'il n'y a pas de reseau, c'est demander a l'ouvrier de refaire le tour du
 * chantier plus tard.
 *
 * La photo est donc optimisee, copiee dans un dossier durable — le fichier
 * temporaire de l'appareil photo peut disparaitre a tout moment — et l'entree
 * est conservee sur le telephone. Au retour du reseau, elle est envoyee avec
 * son HEURE REELLE de prise de vue : sans cela, une photo du matin remontee le
 * soir apparaitrait a l'heure de l'envoi, et le fil d'avancement du chantier
 * mentirait.
 *
 * Tout est en JavaScript (AsyncStorage + expo-file-system), donc livrable en
 * mise a jour OTA.
 */

const STORAGE_KEY = 'buildr-photo-queue-v1';
const QUEUE_DIR = `${FileSystem.documentDirectory}photo-queue/`;

/**
 * Au-dela, l'entree passe en erreur et cesse d'etre retentee automatiquement.
 * Sans ce plafond, une photo qu'un serveur refuse toujours — trop lourde, type
 * invalide — serait rejouee sans fin a chaque retour de reseau.
 */
const MAX_ATTEMPTS = 5;

export interface QueuedPhoto {
  id: string;
  chantierId: string;
  /** Chemin durable de la photo, hors du cache temporaire du systeme. */
  localUri: string;
  /** Heure reelle de la prise de vue (ISO). */
  takenAt: string;
  caption?: string;
  attempts: number;
  status: 'pending' | 'error';
  createdAt: string;
}

export interface CapturedPhoto {
  uri: string;
  width?: number;
  height?: number;
}

/** Reference vide stable : useSyncExternalStore exige un instantane memoise. */
const EMPTY: QueuedPhoto[] = [];

let queue: QueuedPhoto[] | null = null;
let queryClient: QueryClient | null = null;
let processing = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(QUEUE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(QUEUE_DIR, { intermediates: true });
  }
}

async function load(): Promise<QueuedPhoto[]> {
  if (queue) return queue;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    queue = raw ? (JSON.parse(raw) as QueuedPhoto[]) : [];
  } catch {
    // Un cache illisible ne doit pas empecher l'app de demarrer.
    queue = [];
  }
  return queue;
}

async function persist(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue ?? []));
}

/** Optimise la photo puis la copie hors du cache temporaire du systeme. */
async function persistPhoto(photo: CapturedPhoto): Promise<string> {
  await ensureDir();
  const optimized = await optimizeImage(photo.uri, photo.width, photo.height);
  const dest = `${QUEUE_DIR}${newId()}.jpg`;
  await FileSystem.copyAsync({ from: optimized.uri, to: dest });
  return dest;
}

/**
 * Met une photo en file d'attente, puis tente aussitot de la traiter — le
 * reseau est peut-etre revenu entre-temps.
 */
export async function enqueuePhoto(input: {
  chantierId: string;
  photo: CapturedPhoto;
  takenAt?: string;
  caption?: string;
}): Promise<void> {
  const list = await load();
  const localUri = await persistPhoto(input.photo);

  const entry: QueuedPhoto = {
    id: newId(),
    chantierId: input.chantierId,
    localUri,
    takenAt: input.takenAt ?? new Date().toISOString(),
    caption: input.caption,
    attempts: 0,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  // Nouvelle reference de tableau a chaque changement : c'est ce que
  // useSyncExternalStore compare pour decider de re-rendre.
  queue = [...list, entry];
  await persist();
  emit();
  void processQueue();
}

/** Retire une entree de la file et supprime son fichier. */
export async function discardPhoto(id: string): Promise<void> {
  const entry = (queue ?? []).find((e) => e.id === id);
  if (entry) {
    await FileSystem.deleteAsync(entry.localUri, { idempotent: true }).catch(() => undefined);
  }
  queue = (queue ?? []).filter((e) => e.id !== id);
  await persist();
  emit();
}

/** Remet en attente une entree passee en erreur, et relance le traitement. */
export async function retryPhoto(id: string): Promise<void> {
  queue = (queue ?? []).map((e) => (e.id === id ? { ...e, attempts: 0, status: 'pending' as const } : e));
  await persist();
  emit();
  void processQueue();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Instantane stable pour useSyncExternalStore. */
export function getSnapshot(): QueuedPhoto[] {
  return queue ?? EMPTY;
}

/** Reactif : les photos en attente pour un chantier donne. */
export function usePendingPhotos(chantierId: string | undefined): QueuedPhoto[] {
  const all = useSyncExternalStore(subscribe, getSnapshot);
  if (!chantierId) return EMPTY;
  const forChantier = all.filter((e) => e.chantierId === chantierId);
  return forChantier.length > 0 ? forChantier : EMPTY;
}

/** Reactif : le nombre total de photos en attente, tous chantiers confondus. */
export function usePendingCount(): number {
  return useSyncExternalStore(subscribe, getSnapshot).length;
}

async function sendEntry(entry: QueuedPhoto): Promise<void> {
  const uploaded = await uploadFile(entry.localUri, `photo-${entry.id}.jpg`, 'image/jpeg');

  await apiFetch('/photos', {
    method: 'POST',
    body: {
      chantier_id: entry.chantierId,
      url: uploaded.url,
      thumbnail_url: uploaded.thumbnail_url,
      file_size: uploaded.file_size,
      mime_type: uploaded.mime_type,
      // L'heure de la prise de vue, pas celle de l'envoi.
      taken_at: entry.takenAt,
      ...(entry.caption ? { caption: entry.caption } : {}),
    },
  });
}

/**
 * Envoie les photos en attente, dans l'ordre ou elles ont ete prises.
 *
 * Ne fait rien hors ligne, et un seul passage a la fois. Une entree qui echoue
 * n'arrete pas les suivantes : elle sera retentee au prochain declenchement.
 */
export async function processQueue(): Promise<void> {
  if (processing || !onlineManager.isOnline()) return;
  processing = true;
  try {
    const list = await load();
    for (const entry of list.filter((e) => e.status === 'pending')) {
      if (!onlineManager.isOnline()) break;
      try {
        await sendEntry(entry);
        await FileSystem.deleteAsync(entry.localUri, { idempotent: true }).catch(() => undefined);
        queue = (queue ?? []).filter((e) => e.id !== entry.id);
        await persist();
        emit();
        queryClient?.invalidateQueries({ queryKey: ['photos', entry.chantierId] });
      } catch {
        const attempts = entry.attempts + 1;
        const updated: QueuedPhoto = {
          ...entry,
          attempts,
          status: attempts >= MAX_ATTEMPTS ? 'error' : 'pending',
        };
        queue = (queue ?? []).map((e) => (e.id === entry.id ? updated : e));
        await persist();
        emit();
      }
    }
  } finally {
    processing = false;
  }
}

/**
 * A appeler une fois au demarrage. Charge la file, la traite, et rebranche le
 * traitement sur chaque retour du reseau.
 */
export function initPhotoQueue(qc: QueryClient): void {
  queryClient = qc;
  void load().then(() => {
    emit();
    void processQueue();
  });
  onlineManager.subscribe((online) => {
    if (online) void processQueue();
  });
}
