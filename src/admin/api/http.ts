import { authState, isAccessTokenExpired, updateAccessToken } from '../../auth/authState';

export const ADMIN_API_BASE = '/api/v1/admin';
export const API_BASE = '/api/v1';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authState.accessToken) {
    headers['Authorization'] = `Bearer ${authState.accessToken}`;
  }
  return headers;
}

/**
 * Silently refresh the access token using the HttpOnly refresh_token cookie.
 * credentials: 'include' causes the browser to attach the cookie automatically.
 */
async function tryRefreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // HttpOnly cookie sent automatically
    });
    if (!res.ok) return false;
    const json = await res.json();
    updateAccessToken(json.data.accessToken);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// authFetch — auto-refresh on 401, redirect on 403 (not admin)
// ---------------------------------------------------------------------------

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Pre-emptively refresh if token is expiring
  if (isAccessTokenExpired() && authState.isLoggedIn) {
    const refreshed = await tryRefreshToken();
    if (!refreshed) {
      throw new Error('Session hết hạn. Vui lòng đăng nhập lại.');
    }
  }

  const mergedHeaders = {
    ...buildAuthHeaders(),
    ...(options.headers as Record<string, string> ?? {}),
  };

  let res = await fetch(url, { ...options, headers: mergedHeaders, credentials: 'include' });

  // Token expired mid-request — retry once
  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const retryHeaders = {
        ...buildAuthHeaders(),
        ...(options.headers as Record<string, string> ?? {}),
      };
      res = await fetch(url, { ...options, headers: retryHeaders, credentials: 'include' });
    } else {
      throw new Error('Session hết hạn. Vui lòng đăng nhập lại trên trang chính.');
    }
  }

  // Not admin
  if (res.status === 403) {
    throw new Error('Bạn không có quyền truy cập trang Admin.');
  }

  return res;
}

// ---------------------------------------------------------------------------
// Typed helpers used by domain API modules
// ---------------------------------------------------------------------------

/** GET, returns parsed JSON `.data` field from ResponseData<T> wrapper */
export async function adminGet<T>(path: string): Promise<T> {
  const res = await authFetch(`${ADMIN_API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  const json = await res.json();
  return json.data as T;
}

/** POST with optional JSON body, returns parsed JSON `.data` or void */
export async function adminPost<T = void>(path: string, body?: unknown): Promise<T> {
  const res = await authFetch(`${ADMIN_API_BASE}${path}`, {
    method: 'POST',
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  const json = await res.json();
  return (json.data ?? json) as T;
}

/** PUT with JSON body */
export async function adminPut<T = void>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(`${ADMIN_API_BASE}${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  return (json.data ?? json) as T;
}

/** DELETE, no body */
export async function adminDelete(path: string): Promise<void> {
  const res = await authFetch(`${ADMIN_API_BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
}

/** POST multipart/form-data (file upload) — uses base API_BASE not admin */
export async function uploadFileRequest(file: File): Promise<unknown> {
  const form = new FormData();
  form.append('file', file);

  const headers: Record<string, string> = {};
  if (authState.accessToken) {
    headers['Authorization'] = `Bearer ${authState.accessToken}`;
  }

  const res = await authFetch(`${API_BASE}/rag/file`, {
    method: 'POST',
    body: form,
    headers,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}
