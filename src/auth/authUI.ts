// Auth UI - Login modal, user header display, logout
import { authState, isAdmin } from './authState';
import { renderGoogleButton, signOut } from './googleAuth';
import { escapeHtml } from '../utils/formatter';
import { activateFocusTrap } from '../utils/focusTrap';

// ============================================================
// LOGIN MODAL (small popup)
// ============================================================

let _focusTrapCleanup: (() => void) | null = null;

/** Show the login modal popup with focus trap */
export function showLoginScreen(): void {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.classList.remove('hidden');
    // Trap focus inside modal using shared utility
    setTimeout(() => {
      _focusTrapCleanup?.();
      _focusTrapCleanup = activateFocusTrap(modal, hideLoginScreen);
    }, 50);
  }

  // Render Google button in the container
  const btnContainer = document.getElementById('google-btn-container');
  if (btnContainer) {
    btnContainer.innerHTML = '';
    renderGoogleButton(btnContainer);
  }

  // Clear previous errors
  const errorEl = document.getElementById('login-error');
  if (errorEl) {
    errorEl.style.display = 'none';
    errorEl.textContent = '';
  }
}

/** Hide login modal and release focus trap */
export function hideLoginScreen(): void {
  const modal = document.getElementById('login-modal');
  if (modal) {
    modal.classList.add('hidden');
    _focusTrapCleanup?.();
    _focusTrapCleanup = null;
  }
}

// ============================================================
// HEADER AUTH UI
// ============================================================

/** Update header: show/hide login button vs user avatar */
export function updateHeaderAuth(): void {
  const authButtons = document.getElementById('header-auth-buttons');
  const userMenu = document.getElementById('header-user-menu');
  const headerAvatar = document.getElementById('header-avatar');
  const dropdownName = document.getElementById('dropdown-user-name');
  const dropdownEmail = document.getElementById('dropdown-user-email');

  if (authState.isLoggedIn && authState.userInfo) {
    // Show user avatar, hide login button
    authButtons?.classList.add('hidden');
    userMenu?.classList.remove('hidden');

    // Update avatar with Google picture
    if (headerAvatar && authState.userInfo.picture) {
      headerAvatar.innerHTML = `<img src="${escapeHtml(authState.userInfo.picture)}" alt="Avatar" referrerpolicy="no-referrer" />`;
    }

    // Update dropdown info
    if (dropdownName) dropdownName.textContent = authState.userInfo.name;
    if (dropdownEmail) dropdownEmail.textContent = authState.userInfo.email;

    // Show Admin dashboard button if applicable
    const adminBtn = document.getElementById('admin-dashboard-btn');
    if (adminBtn) {
      if (isAdmin()) {
        adminBtn.classList.remove('hidden');
      } else {
        adminBtn.classList.add('hidden');
      }
    }

    // Also update sidebar user info
    _updateSidebarUser();
  } else {
    // Show login button, hide user menu
    authButtons?.classList.remove('hidden');
    userMenu?.classList.add('hidden');

    // Reset sidebar to guest
    _resetSidebarGuest();
  }
}

/** Alias for backward compat */
export function updateUserUI(): void {
  updateHeaderAuth();
}

function _updateSidebarUser(): void {
  const userAvatar = document.querySelector('.sidebar-footer .user-avatar') as HTMLElement;
  const userName = document.querySelector('.sidebar-footer .user-name') as HTMLElement;
  if (!authState.userInfo) return;

  if (userAvatar && authState.userInfo.picture) {
    userAvatar.innerHTML = `<img src="${escapeHtml(authState.userInfo.picture)}" alt="Avatar" referrerpolicy="no-referrer" />`;
  }
  if (userName) {
    userName.textContent = authState.userInfo.name;
    userName.title = authState.userInfo.name;
  }
}

function _resetSidebarGuest(): void {
  const userAvatar = document.querySelector('.sidebar-footer .user-avatar') as HTMLElement;
  const userName = document.querySelector('.sidebar-footer .user-name') as HTMLElement;
  if (userAvatar) {
    userAvatar.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>`;
  }
  if (userName) userName.textContent = 'Guest';
}

// ============================================================
// USER DROPDOWN
// ============================================================

let _dropdownOpen = false;

function closeDropdown(): void {
  const dropdown = document.getElementById('user-dropdown');
  dropdown?.classList.add('hidden');
  _dropdownOpen = false;
}

function openDropdown(): void {
  const dropdown = document.getElementById('user-dropdown');
  dropdown?.classList.remove('hidden');
  _dropdownOpen = true;
}

/** Setup event listeners for header auth buttons and dropdown */
export function initHeaderAuthListeners(onLogoutCallback: () => void): void {
  // Login button
  const loginBtn = document.getElementById('header-login-btn');
  loginBtn?.addEventListener('click', () => showLoginScreen());

  // Modal close button
  const closeBtn = document.getElementById('login-modal-close');
  closeBtn?.addEventListener('click', () => hideLoginScreen());

  // Modal backdrop click to close
  const backdrop = document.getElementById('login-modal-backdrop');
  backdrop?.addEventListener('click', () => hideLoginScreen());

  // User avatar button - toggle dropdown
  const userBtn = document.getElementById('header-user-btn');
  userBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    _dropdownOpen ? closeDropdown() : openDropdown();
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    if (_dropdownOpen) closeDropdown();
  });

  // Logout button in dropdown
  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn?.addEventListener('click', async () => {
    closeDropdown();
    await signOut();
    updateHeaderAuth();
    onLogoutCallback();
  });
}

// ============================================================
// LEGACY (renderLogoutButton kept for compat, now no-op)
// ============================================================

/** @deprecated logout is now in header dropdown */
export function renderLogoutButton(_onLogout: () => void): void {
  // No-op: logout is now handled via header dropdown in initHeaderAuthListeners
}

/** Handle 401 - force re-login */
export function handleUnauthorized(): void {
  import('./authState').then(m => {
    m.clearAuthState();
    updateHeaderAuth();
    showLoginScreen();
  });
}
