import type { CursorResponse, Session, ChatMessage } from '../types';
import { authState, isAccessTokenExpired, updateAccessToken, clearAuthState } from '../auth/authState';
import { API_BASE } from '../config';

export { API_BASE };

/** Build authorization headers with current access token */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authState.accessToken) {
    headers['Authorization'] = `Bearer ${authState.accessToken}`;
  }
  return headers;
}

/**
 * Silently refresh the access token using the HttpOnly refresh_token cookie.
 * credentials: 'include' causes the browser to attach the cookie automatically.
 * Returns true if refresh succeeded.
 */
async function tryRefreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // HttpOnly cookie is sent automatically by the browser
    });
    if (!res.ok) return false;
    const json = await res.json();
    updateAccessToken(json.data.accessToken);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wrapper for fetch that auto-refreshes token on 401.
 * If refresh fails, redirects to login screen.
 */
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Auto-refresh if access token is about to expire
  if (isAccessTokenExpired() && authState.isLoggedIn) {
    const refreshed = await tryRefreshToken();
    if (!refreshed) {
      clearAuthState();
      window.location.reload();
      throw new Error('Session expired. Please login again.');
    }
  }

  const headers = { ...getAuthHeaders(), ...(options.headers as Record<string, string> || {}) };
  let res = await fetch(url, { ...options, headers, credentials: 'include' });

  // If still 401, try refresh once more
  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      const retryHeaders = { ...getAuthHeaders(), ...(options.headers as Record<string, string> || {}) };
      res = await fetch(url, { ...options, headers: retryHeaders, credentials: 'include' });
    } else {
      clearAuthState();
      window.location.reload();
      throw new Error('Session expired. Please login again.');
    }
  }

  return res;
}

export const api = {
  async getSessions(cursor?: string, limit = 10): Promise<CursorResponse<Session>> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    const res = await authFetch(`${API_BASE}/chat/sessions?${params}`);
    if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`);
    return res.json();
  },

  async getMessages(sessionId: string, cursor?: string, limit = 20, signal?: AbortSignal): Promise<CursorResponse<ChatMessage>> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    const res = await authFetch(`${API_BASE}/chat/${sessionId}/messages?${params}`, { signal });
    if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
    return res.json();
  },

  async uploadFile(file: File): Promise<any> {
    const form = new FormData();
    form.append('file', file);

    // For FormData, don't set Content-Type (browser sets it with boundary)
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
    return res.json();
  },

  async deleteSession(sessionId: string): Promise<void> {
    const res = await authFetch(`${API_BASE}/chat/sessions/${sessionId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to delete session: ${res.status}`);
  },

  async renameSession(sessionId: string, title: string): Promise<any> {
    const res = await authFetch(`${API_BASE}/chat/sessions/${sessionId}/title`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    });
    if (!res.ok) throw new Error(`Failed to rename session: ${res.status}`);
    return res.json();
  },
};
