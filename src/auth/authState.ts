// Auth state management — Hybrid Security Pattern:
// - accessToken: stored in RAM (JS variable) — cleared on page reload
// - refreshToken: stored in HttpOnly Cookie (browser handles automatically)
// - userInfo: stored in localStorage (non-sensitive, needed for UI restore)

export interface UserInfo {
  name: string;
  email: string;
  picture: string;
  role?: string; // e.g. 'ADMIN', 'USER'
}

export interface AuthState {
  isLoggedIn: boolean;
  userInfo: UserInfo | null;
  accessToken: string | null;
  role: string | null; // cached role extracted from JWT or backend response
  // NOTE: refreshToken is intentionally NOT stored here.
  // It lives exclusively in an HttpOnly Cookie managed by the browser.
}

const STORAGE_KEY_USER = 'chatbot_user_info';
const ROLE_UNKNOWN = 'UNKNOWN' as const;
const IS_DEV = import.meta.env?.DEV ?? false;

export const authState: AuthState = {
  isLoggedIn: false,
  userInfo: null,
  accessToken: null,
  role: null,
};

// ─────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────

/**
 * Decode JWT payload from a token string.
 * Returns parsed payload object or null if token is malformed.
 */
function _decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null; // JWT must have exactly 3 parts (header.payload.signature)

    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Extract role string from JWT payload.
 * Looks for: roles[], role, authorities[] (Spring Security default).
 * Returns canonical role string (e.g. 'ADMIN', 'USER') or null.
 */
function _extractRoleFromJwt(token: string): string | null {
  try {
    const payload = _decodeJwtPayload(token);
    if (!payload) return null;

    if (IS_DEV) {
      console.debug('[Auth] JWT payload keys:', Object.keys(payload));
    }

    const roles: string[] = [];

    // Field: roles / role
    if (Array.isArray(payload.roles)) roles.push(...payload.roles);
    if (typeof payload.role === 'string') roles.push(payload.role);

    // Field: authorities (Spring Security default)
    if (Array.isArray(payload.authorities)) {
      payload.authorities.forEach((a: any) => {
        if (typeof a === 'string') roles.push(a);
        else if (typeof a?.authority === 'string') roles.push(a.authority);
      });
    }

    // NOTE: OAuth2 'scope' field is intentionally NOT included here.
    // Scopes (e.g. 'openid profile email') are permissions, NOT roles.

    if (IS_DEV) {
      console.debug('[Auth] extracted roles:', roles);
    }

    // Return canonical role (priority: ADMIN > USER > first found)
    if (roles.some(r => r === 'ADMIN' || r === 'ROLE_ADMIN' || r === 'admin' || r === 'role_admin')) {
      return 'ADMIN';
    }
    if (roles.some(r => r === 'USER' || r === 'ROLE_USER' || r === 'user' || r === 'role_user')) {
      return 'USER';
    }
    return roles[0] || null;
  } catch (e) {
    console.error('[Auth] Failed to decode JWT:', e);
    return null;
  }
}

/**
 * Sync authState.userInfo with current role and persist to localStorage.
 * Internal helper to avoid repeating role-enrichment logic.
 */
function _syncUserInfoWithRole(role: string | null): void {
  if (!authState.userInfo) return;

  const displayRole = role && role !== ROLE_UNKNOWN ? role : undefined;
  authState.userInfo = { ...authState.userInfo, role: displayRole };
  localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(authState.userInfo));
}

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

/** Save auth state after login — only access token + user info */
export function setAuthState(accessToken: string, user: UserInfo): void {
  authState.isLoggedIn = true;
  authState.accessToken = accessToken;
  authState.userInfo = user;
  // refreshToken is set as HttpOnly Cookie by the backend, we don't touch it

  // Extract role from JWT and cache it
  const extractedRole = _extractRoleFromJwt(accessToken);
  authState.role = extractedRole ?? ROLE_UNKNOWN;

  // Persist user info enriched with role
  _syncUserInfoWithRole(authState.role);
}

/** Update access token in RAM after a silent refresh */
export function updateAccessToken(accessToken: string): void {
  authState.accessToken = accessToken;
  // refreshToken cookie rotation is handled by the backend Set-Cookie header

  // Re-extract role — backend may have changed user's role since last token
  const freshRole = _extractRoleFromJwt(accessToken);
  authState.role = freshRole ?? ROLE_UNKNOWN;
  _syncUserInfoWithRole(authState.role);
}

/** Clear all auth state (RAM + localStorage). Cookie is cleared by backend on logout. */
export function clearAuthState(): void {
  authState.isLoggedIn = false;
  authState.accessToken = null;
  authState.userInfo = null;
  authState.role = null;
  localStorage.removeItem(STORAGE_KEY_USER);
}

/**
 * Try to restore session on page load by calling /auth/refresh.
 * The HttpOnly cookie is automatically included by the browser.
 * If refresh succeeds, restore user info from localStorage.
 *
 * @returns true if session was restored successfully
 */
export async function tryRestoreSession(apiBase: string): Promise<boolean> {
  const userStr = localStorage.getItem(STORAGE_KEY_USER);
  if (!userStr) return false; // No user info means no prior session

  try {
    const res = await fetch(`${apiBase}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Sends HttpOnly cookie automatically
    });
    if (!res.ok) {
      clearAuthState();
      return false;
    }
    const json = await res.json();
    const accessToken: string = json.data.accessToken;
    const storedUser: UserInfo = JSON.parse(userStr);

    authState.isLoggedIn = true;
    authState.accessToken = accessToken;
    authState.userInfo = storedUser;

    // ALWAYS re-extract role from the fresh access token — never trust localStorage role
    const freshRole = _extractRoleFromJwt(accessToken);
    authState.role = freshRole ?? ROLE_UNKNOWN;

    // Enrich user info with freshly-extracted role and persist back
    _syncUserInfoWithRole(authState.role);
    return true;
  } catch {
    clearAuthState();
    return false;
  }
}

/** Check if access token is expired by decoding JWT */
export function isAccessTokenExpired(): boolean {
  if (!authState.accessToken) return true;
  try {
    const payload = _decodeJwtPayload(authState.accessToken);
    if (!payload || typeof payload.exp !== 'number') return true;
    // 30s buffer before actual expiry
    return payload.exp * 1000 < Date.now() + 30_000;
  } catch {
    return true;
  }
}

/** Check if current user has ADMIN role */
export function isAdmin(): boolean {
  // Primary: use cached role in RAM (set on login/refresh from fresh JWT)
  if (authState.role !== null) {
    return authState.role === 'ADMIN';
  }

  // Fallback: decode directly from access token in RAM
  // (handles edge case where authState.role was not set yet)
  if (authState.accessToken) {
    const role = _extractRoleFromJwt(authState.accessToken);
    authState.role = role ?? ROLE_UNKNOWN;
    return role === 'ADMIN';
  }

  // No token available → not admin
  return false;
}
