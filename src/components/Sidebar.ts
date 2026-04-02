import { api } from '../api';
import { state } from '../store/state';
import { dom } from '../utils/dom';
import { formatDate, escapeHtml } from '../utils/formatter';
import { selectSession, clearChat } from './ChatWindow';
import { showToast } from './Toast';

// Track the currently open context menu
let activeContextMenu: HTMLElement | null = null;

// Track the session ID to delete (for confirm dialog)
let pendingDeleteSessionId: string | null = null;

export async function loadSessions() {
  // Show skeleton loading
  dom.sessionsList.innerHTML = `
    <div class="skeleton-list">
      ${Array(5).fill('<div class="skeleton-item"><div class="skeleton-icon"></div><div class="skeleton-lines"><div class="skeleton-line long"></div><div class="skeleton-line short"></div></div></div>').join('')}
    </div>`;

  try {
    const res = await api.getSessions();
    state.sessions = res.data || [];
    state.sessionsCursor = res.nextCursor;
    state.hasMoreSessions = res.hasNext;
    state.hasLoadedSessions = true;
    renderSessions();
  } catch (err) {
    console.warn('Could not load sessions (backend might be offline):', err);
    dom.sessionsList.innerHTML = `<div class="sessions-empty">Unable to connect to server.<br>Start chatting to create a session.</div>`;
  }
}

export async function loadMoreSessions() {
  if (!state.hasMoreSessions || !state.sessionsCursor) return;
  try {
    const res = await api.getSessions(state.sessionsCursor);
    
    // Lọc bỏ những session đã có trong danh sách (Deduplication / Optimistic Reorder safe)
    const newSessions = (res.data || []).filter(
      newSession => !state.sessions.some(existing => existing.id === newSession.id)
    );
    
    state.sessions.push(...newSessions);
    state.sessionsCursor = res.nextCursor;
    state.hasMoreSessions = res.hasNext;
    renderSessions();
  } catch (err) {
    console.error('Failed to load more sessions:', err);
    showToast('Không thể tải thêm cuộc trò chuyện', 'error');
  }
}

/** Close any open context menu */
function closeContextMenu() {
  if (activeContextMenu) {
    activeContextMenu.remove();
    activeContextMenu = null;
  }
}

/** Show confirm dialog for session deletion */
function showDeleteConfirm(sessionId: string) {
  pendingDeleteSessionId = sessionId;
  dom.confirmDialog.classList.remove('hidden');
}

/** Hide confirm dialog */
function hideDeleteConfirm() {
  pendingDeleteSessionId = null;
  dom.confirmDialog.classList.add('hidden');
}

/** Delete a session */
async function deleteSession(sessionId: string) {
  try {
    await api.deleteSession(sessionId);

    // Remove from state
    state.sessions = state.sessions.filter(s => s.id !== sessionId);

    // If this was the active session, start new chat
    if (state.currentSessionId === sessionId) {
      state.currentSessionId = null;
      clearChat();
    }

    renderSessions();
    showToast('Đã xoá cuộc trò chuyện', 'success');
  } catch (err) {
    console.error('Failed to delete session:', err);
    showToast('Không thể xoá cuộc trò chuyện', 'error');
  }
}

/** Enter inline rename mode for a session */
function startRename(sessionId: string, sessionItemEl: HTMLElement) {
  const session = state.sessions.find(s => s.id === sessionId);
  if (!session) return;

  const titleEl = sessionItemEl.querySelector('.session-title') as HTMLElement;
  if (!titleEl) return;

  const currentTitle = session.title || 'New Chat';

  // Replace title with input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'session-rename-input';
  input.value = currentTitle;
  input.maxLength = 500;

  titleEl.replaceWith(input);
  input.focus();
  input.select();

  // Prevent click from selecting the session
  input.addEventListener('click', (e) => e.stopPropagation());

  let hasCommitted = false;

  const commitRename = async () => {
    if (hasCommitted) return;
    hasCommitted = true;

    const newTitle = input.value.trim();
    if (newTitle && newTitle !== currentTitle) {
      try {
        await api.renameSession(sessionId, newTitle);
        session.title = newTitle;

        // Update chat header if this is the active session
        if (state.currentSessionId === sessionId) {
          dom.chatTitle.textContent = newTitle;
        }
        showToast('Đã đổi tên cuộc trò chuyện', 'success');
      } catch (err) {
        console.error('Failed to rename session:', err);
        showToast('Không thể đổi tên', 'error');
        hasCommitted = false; // allow retry on error
      }
    }
    renderSessions();
  };

  const cancelRename = () => {
    if (hasCommitted) return;
    hasCommitted = true;
    renderSessions();
  };

  // onBlur phải được khai báo trước keydown để có thể removeEventListener đúng reference
  const onBlur = () => {
    commitRename();
  };

  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      // Remove blur listener TRƯỚC, sau đó mới blur để tránh gọi commitRename 2 lần
      input.removeEventListener('blur', onBlur);
      input.blur(); // Chủ động blur để browser không tự trigger sau này
      commitRename();
    } else if (e.key === 'Escape') {
      input.removeEventListener('blur', onBlur);
      input.blur();
      cancelRename();
    }
  });

  input.addEventListener('blur', onBlur);
}

/** Create context menu for a session */
function showContextMenu(e: MouseEvent, sessionId: string, sessionItemEl: HTMLElement) {
  e.stopPropagation();
  e.preventDefault();
  closeContextMenu();

  const menu = document.createElement('div');
  menu.className = 'session-context-menu';
  menu.innerHTML = `
    <button class="session-context-item" data-action="rename">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
      Đổi tên
    </button>
    <button class="session-context-item session-context-delete" data-action="delete">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
      Xoá
    </button>
  `;

  // Position the menu
  sessionItemEl.style.position = 'relative';
  sessionItemEl.appendChild(menu);
  activeContextMenu = menu;

  // Button handlers
  menu.querySelector('[data-action="rename"]')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    closeContextMenu();
    startRename(sessionId, sessionItemEl);
  });

  menu.querySelector('[data-action="delete"]')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    closeContextMenu();
    showDeleteConfirm(sessionId);
  });

  // Close when clicking outside
  const closeOnOutsideClick = (ev: MouseEvent) => {
    if (!menu.contains(ev.target as Node)) {
      closeContextMenu();
      document.removeEventListener('click', closeOnOutsideClick);
    }
  };
  // Delay to avoid immediate closing
  setTimeout(() => document.addEventListener('click', closeOnOutsideClick), 0);
}

export function renderSessions() {
  const search = dom.searchInput.value.toLowerCase();
  const filtered = search
    ? state.sessions.filter(s => s.title?.toLowerCase().includes(search))
    : state.sessions;

  if (filtered.length === 0) {
    dom.sessionsList.innerHTML = `<div class="sessions-empty">${search ? 'Không tìm thấy cuộc trò chuyện' : 'Chưa có cuộc trò chuyện nào.<br>Bắt đầu chat mới!'}</div>`;
    return;
  }

  let html = filtered.map(session => `
    <div class="session-item ${session.id === state.currentSessionId ? 'active' : ''}" data-session-id="${session.id}" tabindex="0" role="button" aria-label="${escapeHtml(session.title || 'New Chat')}">
      <div class="session-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
      <div class="session-info">
        <div class="session-title">${escapeHtml(session.title || 'New Chat')}</div>
        <div class="session-date">${formatDate(session.updatedAt || session.createdAt)}</div>
      </div>
      <button class="session-actions-btn" data-session-id="${session.id}" title="More options" aria-label="More options">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="5" r="1"></circle>
          <circle cx="12" cy="12" r="1"></circle>
          <circle cx="12" cy="19" r="1"></circle>
        </svg>
      </button>
    </div>
  `).join('');

  if (state.hasMoreSessions && !search) {
    html += `<button class="load-more-btn" id="load-more-sessions">Tải thêm...</button>`;
  }

  dom.sessionsList.innerHTML = html;

  // Click handler for selecting sessions
  dom.sessionsList.querySelectorAll('.session-item').forEach(el => {
    el.addEventListener('click', (e) => {
      // Don't select if clicking on action button
      if ((e.target as HTMLElement).closest('.session-actions-btn')) return;
      const id = (el as HTMLElement).dataset.sessionId!;
      selectSession(id);
    });

    // Keyboard navigation: Enter to select
    el.addEventListener('keydown', (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key === 'Enter' || ke.key === ' ') {
        ke.preventDefault();
        if (!(ke.target as HTMLElement).closest('.session-actions-btn')) {
          const id = (el as HTMLElement).dataset.sessionId!;
          selectSession(id);
        }
      }
      // Arrow key navigation
      if (ke.key === 'ArrowDown') {
        ke.preventDefault();
        const next = (el as HTMLElement).nextElementSibling as HTMLElement;
        if (next?.classList.contains('session-item')) next.focus();
      }
      if (ke.key === 'ArrowUp') {
        ke.preventDefault();
        const prev = (el as HTMLElement).previousElementSibling as HTMLElement;
        if (prev?.classList.contains('session-item')) prev.focus();
      }
    });
  });

  // Click handler for 3-dot menu buttons
  dom.sessionsList.querySelectorAll('.session-actions-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const sessionId = (btn as HTMLElement).dataset.sessionId!;
      const sessionItem = (btn as HTMLElement).closest('.session-item') as HTMLElement;
      showContextMenu(e as MouseEvent, sessionId, sessionItem);
    });
  });

  const loadMoreBtn = document.getElementById('load-more-sessions');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadMoreSessions);
  }
}

/** Initialize confirm dialog event listeners */
export function initConfirmDialog() {
  dom.confirmCancel.addEventListener('click', hideDeleteConfirm);
  dom.confirmBackdrop.addEventListener('click', hideDeleteConfirm);
  dom.confirmDelete.addEventListener('click', async () => {
    if (pendingDeleteSessionId) {
      const sessionId = pendingDeleteSessionId;
      hideDeleteConfirm();
      await deleteSession(sessionId);
    }
  });
}

export function toggleSidebar(forceState?: boolean) {
  state.isSidebarOpen = forceState ?? !state.isSidebarOpen;
  dom.sidebar.classList.toggle('collapsed', !state.isSidebarOpen);

  // Lazy load sessions if opening sidebar and hasn't loaded before
  if (state.isSidebarOpen && !state.hasLoadedSessions) {
    loadSessions();
  }
}
