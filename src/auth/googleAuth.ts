// Google Identity Services (GIS) + Backend auth integration
import { setAuthState, clearAuthState, type UserInfo } from './authState';
import { API_BASE } from '../api';

// Google Client ID - loaded from env or fallback
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
          revoke: (email: string, callback: () => void) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

type AuthCallback = (success: boolean) => void;
let onAuthCallback: AuthCallback | null = null;

/** Decode Google ID Token to get user display info */
function decodeGoogleIdToken(token: string): UserInfo {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  const payload = JSON.parse(jsonPayload);
  return {
    name: payload.name || payload.email,
    email: payload.email,
    picture: payload.picture || '',
  };
}

/**
 * Send Google ID Token to backend for authentication.
 * Backend verifies the token, sets an HttpOnly refresh_token cookie,
 * and returns only the accessToken in the response body.
 *
 * credentials: 'include' is required so the browser accepts the Set-Cookie header.
 */
async function authenticateWithBackend(googleIdToken: string): Promise<{ accessToken: string }> {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Allow backend to set HttpOnly cookie
    body: JSON.stringify({ idToken: googleIdToken }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Authentication failed: ${res.status} - ${errorText}`);
  }

  const json = await res.json();
  // Backend returns ResponseData<AuthenticationResponse> — only accessToken in body
  return json.data;
}

/** Handle credential response from Google Sign-In */
async function handleCredentialResponse(response: { credential: string }) {
  try {
    const googleIdToken = response.credential;
    const userInfo = decodeGoogleIdToken(googleIdToken);

    // Send to backend — gets accessToken back; refreshToken is set as HttpOnly cookie
    const { accessToken } = await authenticateWithBackend(googleIdToken);
    setAuthState(accessToken, userInfo);
    onAuthCallback?.(true);
  } catch (err) {
    console.error('Google login failed:', err);
    onAuthCallback?.(false);
  }
}

/** Initialize Google Identity Services */
export function initGoogleAuth(callback: AuthCallback): void {
  onAuthCallback = callback;

  if (!GOOGLE_CLIENT_ID) {
    console.error('VITE_GOOGLE_CLIENT_ID is not set! Google Sign-In will not work.');
    return;
  }

  if (window.google?.accounts?.id) {
    setupGIS();
  } else {
    // Wait for GIS script to load
    const check = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(check);
        setupGIS();
      }
    }, 100);
    setTimeout(() => clearInterval(check), 10_000);
  }
}

function setupGIS(): void {
  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: true,
  });
}

/** Render the Google Sign-In button */
export function renderGoogleButton(container: HTMLElement): void {
  if (!window.google?.accounts?.id) {
    setTimeout(() => renderGoogleButton(container), 200);
    return;
  }
  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    text: 'signin_with',
    shape: 'pill',
    logo_alignment: 'left',
    width: 300,
  });
}

/**
 * Sign out: call backend logout (which clears the HttpOnly cookie),
 * then clear local access token state.
 */
export async function signOut(): Promise<void> {
  try {
    // Use authState access token from RAM (not localStorage)
    const { authState } = await import('./authState');
    const token = authState.accessToken;
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include', // Needed so backend can clear the cookie via Set-Cookie
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
  } catch (err) {
    console.warn('Logout API call failed (ignored):', err);
  }

  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
  }
  clearAuthState();
}
