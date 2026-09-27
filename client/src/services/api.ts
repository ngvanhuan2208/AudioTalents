export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const AUTH_STORAGE_KEYS = {
  ACCESS_TOKEN: 'audiotalents_access_token',
  REFRESH_TOKEN: 'audiotalents_refresh_token',
};

export const authStorage = {
  getAccessToken(): string | null {
    return localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
  },

  setTokens(tokens: { accessToken: string; refreshToken?: string | null }) {
    localStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken);
    if (tokens.refreshToken) {
      localStorage.setItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken);
    }
  },

  clearTokens() {
    localStorage.removeItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
  },
};

export function buildApiUrl(path: string) {
  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

// Public media paths are root-relative to the API host, not the Vite host.
// Absolute provider URLs (including signed URLs) must be left untouched.
export function resolvePlaybackUrl(value: string, apiBaseUrl = buildApiUrl('/')): string | null {
  const path = value.trim();
  if (/^https?:\/\//i.test(path)) return path;
  if (!path || path.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(path)) return null;
  try {
    const base = new URL(apiBaseUrl);
    if (!/^https?:$/.test(base.protocol)) return null;
    return new URL(path, base).toString();
  } catch {
    return null;
  }
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const rawBody = await response.text();
  let payload: unknown = rawBody;

  if (contentType.includes('application/json') && rawBody.trim()) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      // A malformed upstream response must be handled as a request failure,
      // not surfaced as an uncaught JSON parsing error in the UI.
      payload = rawBody;
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && payload.error && typeof payload.error === 'object' && 'message' in payload.error && typeof payload.error.message === 'string'
        ? payload.error.message
        : payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
          ? payload.message
        : 'Request failed';
    const error = new Error(message) as Error & {code?: string; status?: number; details?: unknown};
    if (payload && typeof payload === 'object' && 'error' in payload && payload.error && typeof payload.error === 'object') {
      error.code = 'code' in payload.error && typeof payload.error.code === 'string' ? payload.error.code : undefined;
      error.details = 'details' in payload.error ? payload.error.details : undefined;
    }
    error.status = response.status;
    throw error;
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T;
  }

  return payload as T;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers || {});
  const accessToken = authStorage.getAccessToken();

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers,
  });

  if (response.status === 401 && retry) {
    const refreshToken = authStorage.getRefreshToken();
    if (refreshToken) {
      try {
        const refreshed = await apiFetch<{ accessToken: string }>('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        }, false);

        authStorage.setTokens({
          accessToken: refreshed.accessToken,
          refreshToken,
        });

        return apiFetch<T>(path, options, false);
      } catch {
        authStorage.clearTokens();
      }
    }
  }

  return parseApiResponse<T>(response);
}
