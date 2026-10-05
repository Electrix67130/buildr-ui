import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || 'change-me-in-production';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

/**
 * Teste si l'API est joignable.
 *
 * N'importe quelle reponse HTTP — meme un 401 ou un 404 — signifie que le
 * reseau fonctionne : seule une erreur de fetch ou un depassement de 4 s
 * compte comme hors ligne. On ne veut pas confondre « pas de reseau » avec
 * « serveur qui repond une erreur ».
 *
 * Pur JavaScript, sans module natif : livrable par mise a jour OTA.
 */
export async function probeApi(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: { 'x-api-key': API_KEY },
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// --------------- Token management ---------------

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, accessToken],
    [REFRESH_TOKEN_KEY, refreshToken],
  ]);
}

export async function clearTokens(): Promise<void> {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

// --------------- Error class ---------------

export class ApiError extends Error {
  statusCode: number;
  error: string;
  details: string | string[];

  constructor(statusCode: number, error: string, details: string | string[]) {
    super(typeof details === 'string' ? details : details.join(', '));
    this.statusCode = statusCode;
    this.error = error;
    this.details = details;
  }
}

// --------------- Token refresh ---------------

let refreshPromise: Promise<string> | null = null;

export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) throw new ApiError(401, 'Unauthorized', 'No refresh token');

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      // Seul un 401 dit que la session est finie. Un 502 pendant un
      // redeploiement de l'API, un 500, un 429 sont passagers : effacer les
      // jetons la-dessus deconnectait tout le monde a chaque mise en ligne.
      if (response.status === 401) {
        await clearTokens();
        throw new ApiError(401, 'Unauthorized', 'Refresh token expired');
      }
      if (!response.ok) {
        throw new ApiError(response.status, 'Service Unavailable', 'Refresh temporarily failed');
      }

      const data = await response.json();
      await setTokens(data.access_token, data.refresh_token);
      return data.access_token as string;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// --------------- Fetch wrapper ---------------

interface FetchOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, headers: extraHeaders = {} } = options;

  const headers: Record<string, string> = {
    'x-api-key': API_KEY,
    ...extraHeaders,
  };

  // For write methods, always include a valid JSON body (even {}) to avoid server errors
  const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
  const effectiveBody = body ?? (isWriteMethod ? {} : undefined);
  if (effectiveBody !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = await getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  let response = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: effectiveBody !== undefined ? JSON.stringify(effectiveBody) : undefined,
  });

  // Auto-refresh on 401
  if (response.status === 401 && auth) {
    try {
      const newToken = await refreshAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers,
        body: effectiveBody !== undefined ? JSON.stringify(effectiveBody) : undefined,
      });
    } catch (err) {
      // Session reellement finie : 401 du renouvellement. Tout le reste
      // (API injoignable, erreur passagere) remonte tel quel, sans que
      // l'appelant n'en deduise une deconnexion.
      if (err instanceof ApiError && err.statusCode === 401) {
        throw new ApiError(401, 'Unauthorized', 'Session expired');
      }
      throw err;
    }
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new ApiError(data.statusCode || response.status, data.error || 'Error', data.message || 'Unknown error');
  }

  return data as T;
}
