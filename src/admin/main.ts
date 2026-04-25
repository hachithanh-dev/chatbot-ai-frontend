import '../style-admin.css';

// ⚠️ MUST import and restore auth state FIRST — before any API module loads
import { tryRestoreSession, isAdmin } from '../auth/authState';
import { API_BASE } from '../config';
import { startClock, showToast }          from './utils/helpers';
import { renderOverview }                 from './features/overview';
import { renderKnowledgeFeature }         from './features/knowledge';
import { renderJobsFeature, stopPolling } from './features/jobs';

// =============================================================================
// Tab routing
// =============================================================================

type TabId = 'overview' | 'knowledge' | 'jobs';

function switchTab(tabId: TabId): void {
  document.querySelectorAll<HTMLButtonElement>('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll<HTMLElement>('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tabId}`);
  });
}

function initTabRouting(): void {
  document.querySelectorAll<HTMLButtonElement>('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab as TabId;
      switchTab(tabId);
    });
  });
}

// =============================================================================
// Sub-tab routing (Knowledge Base)
// =============================================================================

type SubTabId = 'upload' | 'review' | 'sources';

function switchSubTab(subTabId: SubTabId): void {
  document.querySelectorAll<HTMLButtonElement>('.subtab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.subtab === subTabId);
  });
  document.querySelectorAll<HTMLElement>('.subtab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `subpanel-${subTabId}`);
  });
}

function initSubTabs(): void {
  document.querySelectorAll<HTMLButtonElement>('.subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchSubTab(btn.dataset.subtab as SubTabId);
    });
  });
}

// =============================================================================
// Quick navigate: "Duyệt ngay" banner button
// =============================================================================

function initQuickNav(): void {
  document.getElementById('btn-go-review')?.addEventListener('click', () => {
    switchTab('knowledge');
    setTimeout(() => switchSubTab('review'), 50);
  });
}

// =============================================================================
// Error boundary for critical fetch failures
// =============================================================================

function handleUnhandledError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('403') || msg.includes('quyền')) {
    showToast('Không đủ quyền ADMIN để truy cập trang này.', 'error');
  }
}

// =============================================================================
// Auth guard — hiển thị thông báo & dừng toàn bộ nếu chưa đăng nhập
// =============================================================================

function renderAccessDenied(reason: 'not-logged-in' | 'not-admin'): void {
  const main = document.querySelector<HTMLElement>('.admin-main');
  if (!main) return;

  const isNotLoggedIn = reason === 'not-logged-in';
  const icon    = isNotLoggedIn ? '#F59E0B' : '#EF4444';
  const title   = isNotLoggedIn ? 'Bạn chưa đăng nhập' : 'Không có quyền truy cập';
  const message = isNotLoggedIn
    ? 'Vui lòng đăng nhập bằng tài khoản <strong>Admin</strong> trên trang chính trước.'
    : 'Tài khoản của bạn không có quyền <strong>ADMIN</strong>. Hãy liên hệ quản trị viên.';

  main.innerHTML = `
    <div style="
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      height:60vh; gap:16px; text-align:center;
    ">
      <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="${icon}" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <h2 style="font-size:20px;font-weight:700;color:#111827">${title}</h2>
      <p style="font-size:14px;color:#6B7280">${message}</p>
      <a href="/" style="
        margin-top:8px; padding:10px 28px; border-radius:8px;
        background:#5B4FE8; color:white; text-decoration:none;
        font-weight:600; font-size:14px;
      ">← Về trang Chatbot</a>
    </div>`;
}

// =============================================================================
// Bootstrap
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  startClock();
  initTabRouting();
  initSubTabs();
  initQuickNav();

  // Restore session via HttpOnly cookie — must await before checking auth state
  const isLoggedIn = await tryRestoreSession(API_BASE);

  if (!isLoggedIn) {
    // Not logged in → show error, block everything
    renderAccessDenied('not-logged-in');
    return;
  }

  if (!isAdmin()) {
    // Logged in but not admin → show forbidden
    renderAccessDenied('not-admin');
    return;
  }

  // Load all tab data in parallel
  Promise.allSettled([renderOverview()]).then(results => {
    results.forEach(r => {
      if (r.status === 'rejected') handleUnhandledError(r.reason);
    });
  });

  renderKnowledgeFeature();
  renderJobsFeature();

  // Cleanup polling on page leave
  window.addEventListener('beforeunload', () => stopPolling());
});
