import './style.css';
import { dom } from './utils/dom';
import { state } from './store/state';
import { renderSessions, loadSessions, toggleSidebar, initConfirmDialog } from './components/Sidebar';
import { startNewChat, selectSession, initScrollObserver, updateWelcomeGreeting } from './components/ChatWindow';
import { autoResizeTextarea, updateSendButton, sendMessage, consumePendingMessage, abortStream } from './components/ChatInput';
import { tryRestoreSession } from './auth/authState';
import { initGoogleAuth } from './auth/googleAuth';
import { hideLoginScreen, updateHeaderAuth, initHeaderAuthListeners } from './auth/authUI';
import { initThemeToggle, initModelSelector, initSwipeGesture } from './components/UIExtensions';
import { API_BASE } from './config';

const STORAGE_KEY_SESSION = 'chatbot_last_session_id';

function initApp() {
  // Initialize theme (dark/light)
  initThemeToggle();

  // Initialize model selector dropdown
  initModelSelector();

  // Restore sidebar preference from localStorage, default to open on desktop
  const savedSidebarState = localStorage.getItem('sidebar-open');
  const isDesktop = window.innerWidth > 768;
  const shouldOpen = savedSidebarState !== null ? savedSidebarState === 'true' : isDesktop;
  state.isSidebarOpen = shouldOpen;
  dom.sidebar.classList.toggle('collapsed', !shouldOpen);

  // Sidebar toggle - persist preference
  dom.sidebarToggle.addEventListener('click', () => {
    toggleSidebar();
    localStorage.setItem('sidebar-open', String(state.isSidebarOpen));
  });

  // Swipe gesture for mobile sidebar (Phase 4.1)
  initSwipeGesture(
    dom.sidebar,
    () => {
      toggleSidebar(true);
      localStorage.setItem('sidebar-open', 'true');
    },
    () => {
      toggleSidebar(false);
      localStorage.setItem('sidebar-open', 'false');
    }
  );

  // New chat
  dom.newChatBtn.addEventListener('click', startNewChat);

  // Search with debounce (200ms) to avoid spam re-renders
  let searchDebounceTimer: ReturnType<typeof setTimeout>;
  dom.searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => renderSessions(), 200);
  });

  // Message input
  dom.messageInput.addEventListener('input', () => {
    autoResizeTextarea();
    updateSendButton();
  });

  dom.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (state.isStreaming) {
        // Enter during streaming = stop
        abortStream();
      } else if (dom.messageInput.value.trim()) {
        sendMessage(dom.messageInput.value);
      }
    }
  });

  // Send/Stop button — toggles between send and abort based on streaming state
  dom.sendBtn.addEventListener('click', () => {
    if (state.isStreaming) {
      abortStream();
    } else if (dom.messageInput.value.trim()) {
      sendMessage(dom.messageInput.value);
    }
  });

  // Suggestion chips
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = (chip as HTMLElement).dataset.prompt;
      if (prompt) {
        dom.messageInput.value = prompt;
        updateSendButton();
        sendMessage(prompt);
      }
    });
  });

  // File upload removed from chat header — use Admin panel instead

  // Init header auth: login button, dropdown, logout
  initHeaderAuthListeners(() => {
    updateHeaderAuth();
    state.sessions = [];
    state.hasLoadedSessions = false;
    startNewChat();
    updateWelcomeGreeting(); // Reset greeting to guest
  });

  // Init confirm dialog (for session delete)
  initConfirmDialog();

  // Init scroll-to-bottom floating button
  initScrollObserver();

  // Keyboard shortcuts
  initKeyboardShortcuts();

  // Focus input
  dom.messageInput.focus();
}

// ===== Keyboard Shortcuts =====
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+K / Cmd+K = New chat
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      startNewChat();
      return;
    }

    // Ctrl+/ / Cmd+/ = Focus input
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      dom.messageInput.focus();
      return;
    }

    // Escape = Close sidebar on mobile or stop streaming
    if (e.key === 'Escape') {
      if (state.isStreaming) {
        abortStream();
      } else if (window.innerWidth <= 768 && state.isSidebarOpen) {
        toggleSidebar(false);
        localStorage.setItem('sidebar-open', 'false');
      }
      return;
    }

    // Ctrl+Shift+S = Toggle sidebar
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      toggleSidebar();
      localStorage.setItem('sidebar-open', String(state.isSidebarOpen));
      return;
    }
  });
}

// ===== Entry Point =====
async function boot() {
  initApp();

  // Attempt to restore session by calling /auth/refresh with the HttpOnly cookie.
  // If the cookie is valid, we get a fresh access token — no credentials stored in localStorage.
  const isLoggedIn = await tryRestoreSession(API_BASE);
  updateHeaderAuth();
  updateWelcomeGreeting(); // Set personalized greeting after auth restore

  // If user is already logged in (session restored), load sessions immediately
  if (isLoggedIn) {
    await loadSessions();

    // Restore last active session before page was refreshed
    const lastSessionId = localStorage.getItem(STORAGE_KEY_SESSION);
    if (lastSessionId && state.sessions.some(s => s.id === lastSessionId)) {
      selectSession(lastSessionId);
    }
  }

  initGoogleAuth((success: boolean) => {
    if (success) {
      hideLoginScreen();
      updateHeaderAuth();
      updateWelcomeGreeting(); // Update greeting after login

      // Load sessions after fresh login
      loadSessions().then(() => {
        const pending = consumePendingMessage();
        if (pending) {
          sendMessage(pending);
        }
      });
    } else {
      const errorEl = document.getElementById('login-error');
      if (errorEl) {
        errorEl.textContent = 'Đăng nhập thất bại. Vui lòng thử lại.';
        errorEl.style.display = 'block';
      }
    }
  });
}

boot();
