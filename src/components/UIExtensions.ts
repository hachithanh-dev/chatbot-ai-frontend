// UI Extensions: Theme toggle, Model selector, Message reactions, Swipe gesture

// ============================================================
// THEME TOGGLE (Phase 2.4)
// ============================================================

const THEME_KEY = 'chatbot-theme';

export function initThemeToggle(): void {
  // Restore theme from localStorage
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(savedTheme);

  const btn = document.getElementById('theme-toggle');
  btn?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  });
}

function applyTheme(theme: string): void {
  document.documentElement.setAttribute('data-theme', theme);
}

// ============================================================
// MODEL SELECTOR (Phase 2.3)
// ============================================================

let selectedModel = localStorage.getItem('chatbot-model') || 'gemini-2.0-flash';

export function initModelSelector(): void {
  const btn = document.getElementById('model-selector-btn');
  const dropdown = document.getElementById('model-dropdown');
  const nameDisplay = document.getElementById('model-name-display');
  if (!btn || !dropdown) return;

  // Restore saved model
  if (nameDisplay) {
    const option = dropdown.querySelector(`[data-model="${selectedModel}"]`) as HTMLElement;
    if (option) {
      nameDisplay.textContent = option.querySelector('.model-option-name')?.textContent || selectedModel;
    }
  }
  updateModelActiveState(dropdown);

  // Toggle dropdown
  let isOpen = false;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    isOpen = !isOpen;
    dropdown.classList.toggle('hidden', !isOpen);
    btn.setAttribute('aria-expanded', String(isOpen));
  });

  // Close on outside click
  document.addEventListener('click', () => {
    if (isOpen) {
      isOpen = false;
      dropdown.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  // Option click
  dropdown.querySelectorAll('.model-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const model = (opt as HTMLElement).dataset.model || '';
      selectModel(model, dropdown, nameDisplay);
      isOpen = false;
      dropdown.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');
    });
  });
}

function selectModel(model: string, dropdown: HTMLElement, nameDisplay: HTMLElement | null): void {
  selectedModel = model;
  localStorage.setItem('chatbot-model', model);
  updateModelActiveState(dropdown);
  if (nameDisplay) {
    const activeOpt = dropdown.querySelector(`[data-model="${model}"]`);
    nameDisplay.textContent = activeOpt?.querySelector('.model-option-name')?.textContent || model;
  }
}

function updateModelActiveState(dropdown: HTMLElement): void {
  dropdown.querySelectorAll('.model-option').forEach(opt => {
    const isActive = (opt as HTMLElement).dataset.model === selectedModel;
    opt.classList.toggle('active', isActive);
    opt.setAttribute('aria-selected', String(isActive));
    const check = opt.querySelector('.model-check');
    check?.classList.toggle('hidden', !isActive);
  });
}

export function getSelectedModel(): string {
  return selectedModel;
}

// ============================================================
// MESSAGE ACTIONS (Phase 4.2 — Reactions + Copy)
// ============================================================

export function addMessageActions(messageEl: HTMLElement, role: 'user' | 'assistant'): void {
  const body = messageEl.querySelector('.message-body');
  if (!body) return;

  const actions = document.createElement('div');
  actions.className = 'message-actions';
  actions.setAttribute('aria-label', 'Thao tác tin nhắn');

  // Copy button (for all messages)
  const copyBtn = document.createElement('button');
  copyBtn.className = 'message-action-btn';
  copyBtn.title = 'Sao chép';
  copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Sao chép`;
  copyBtn.addEventListener('click', () => {
    const content = body.querySelector('.message-content');
    const text = content?.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>Đã sao chép`;
      copyBtn.classList.add('active');
      setTimeout(() => {
        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Sao chép`;
        copyBtn.classList.remove('active');
      }, 2000);
    }).catch(() => {});
  });
  actions.appendChild(copyBtn);

  // For assistant messages: thumbs up/down
  if (role === 'assistant') {
    const thumbUpBtn = document.createElement('button');
    thumbUpBtn.className = 'message-action-btn';
    thumbUpBtn.title = 'Hữu ích';
    thumbUpBtn.setAttribute('aria-label', 'Đánh giá hữu ích');
    thumbUpBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`;

    const thumbDownBtn = document.createElement('button');
    thumbDownBtn.className = 'message-action-btn';
    thumbDownBtn.title = 'Không hữu ích';
    thumbDownBtn.setAttribute('aria-label', 'Đánh giá không hữu ích');
    thumbDownBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>`;

    thumbUpBtn.addEventListener('click', () => {
      thumbUpBtn.classList.toggle('active');
      thumbDownBtn.classList.remove('active');
    });
    thumbDownBtn.addEventListener('click', () => {
      thumbDownBtn.classList.toggle('active');
      thumbUpBtn.classList.remove('active');
    });

    actions.appendChild(thumbUpBtn);
    actions.appendChild(thumbDownBtn);
  }

  // Timestamp - User requested to not show time on hover
  // const meta = document.createElement('div');
  // meta.className = 'message-meta';
  // meta.textContent = timestamp;
  // body.appendChild(meta);

  body.appendChild(actions);
}

// ============================================================
// SWIPE GESTURE SIDEBAR (Phase 4.1)
// ============================================================

export function initSwipeGesture(sidebar: HTMLElement, onOpen: () => void, onClose: () => void): void {
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwiping = false;

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isSwiping = false;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (isSwiping) return;
    const deltaX = e.touches[0].clientX - touchStartX;
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
    // Only handle horizontal swipes (deltaX > deltaY * 2)
    if (Math.abs(deltaX) > deltaY * 2) isSwiping = true;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!isSwiping) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const threshold = 60; // minimum swipe distance

    // Swipe right from left edge to open
    if (deltaX > threshold && touchStartX < 30 && sidebar.classList.contains('collapsed')) {
      onOpen();
    }
    // Swipe left to close
    if (deltaX < -threshold && !sidebar.classList.contains('collapsed')) {
      onClose();
    }
  }, { passive: true });
}
