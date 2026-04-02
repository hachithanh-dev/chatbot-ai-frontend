import './style.css';
import { dom } from './utils/dom';
import { state } from './store/state';
import { renderSessions, loadSessions, toggleSidebar, initConfirmDialog } from './components/Sidebar';
import { startNewChat, selectSession } from './components/ChatWindow';
import { autoResizeTextarea, updateSendButton, sendMessage, consumePendingMessage } from './components/ChatInput';
import { tryRestoreSession } from './auth/authState';
import { initGoogleAuth } from './auth/googleAuth';
import { hideLoginScreen, updateHeaderAuth, initHeaderAuthListeners } from './auth/authUI';
import { initThemeToggle, initModelSelector, initSwipeGesture } from './components/UIExtensions';

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
      if (dom.messageInput.value.trim() && !state.isStreaming) {
        sendMessage(dom.messageInput.value);
      }
    }
  });

  // Send button
  dom.sendBtn.addEventListener('click', () => {
    if (dom.messageInput.value.trim() && !state.isStreaming) {
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
  });


  // NOTE: updateHeaderAuth() is intentionally called AFTER tryRestoreSession() in boot(),
  // so the UI reflects the correct auth state after cookie-based session restore.


  // Init confirm dialog (for session delete)
  initConfirmDialog();

  // Focus input
  dom.messageInput.focus();
}

// ===== Entry Point =====
async function boot() {
  initApp();

  // Attempt to restore session by calling /auth/refresh with the HttpOnly cookie.
  // If the cookie is valid, we get a fresh access token — no credentials stored in localStorage.
  const isLoggedIn = await tryRestoreSession('/api/v1');
  updateHeaderAuth();

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
