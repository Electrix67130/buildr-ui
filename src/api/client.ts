import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY || 'change-me-in-production';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

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

async function refreshAccessToken(): Promise<string> {
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

      if (!response.ok) {
        await clearTokens();
        throw new ApiError(401, 'Unauthorized', 'Refresh token expired');
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
    } catch {
      throw new ApiError(401, 'Unauthorized', 'Session expired');
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
