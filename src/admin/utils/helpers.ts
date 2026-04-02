// =============================================================================
// Math / formatting
// =============================================================================

export function pct(chunks: number, target: number): number {
  return Math.min(Math.round((chunks / target) * 100), 100);
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '0';
  return n.toLocaleString('vi-VN');
}

// =============================================================================
// File size
// =============================================================================

/**
 * Converts bytes to human-readable string.
 * formatFileSize(4200000) → "4.0 MB"
 * formatFileSize(890000)  → "869 KB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

// =============================================================================
// Date / time
// =============================================================================

/**
 * Converts ISO-8601 string to short Vietnamese format.
 * formatISODate("2026-03-30T06:12:00") → "30/03 06:12"
 * Returns "—" for null/undefined.
 */
export function formatISODate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const day   = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hour  = String(d.getHours()).padStart(2, '0');
    const min   = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${hour}:${min}`;
  } catch {
    return '—';
  }
}

/**
 * Converts ISO date string to short day label for chart ("T2", "T3" ... "CN")
 */
export function formatDayLabel(iso: string): string {
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  try {
    return days[new Date(iso).getDay()];
  } catch {
    return '?';
  }
}

// =============================================================================
// Duration
// =============================================================================

/**
 * Converts milliseconds to human-readable duration string.
 * formatDuration(252000) → "4m 12s"
 * formatDuration(300)    → "0.3s"
 * Returns "—" for null/0.
 */
export function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '—';
  if (ms < 1_000) return `${ms}ms`;
  const totalSec = Math.floor(ms / 1_000);
  if (totalSec < 60) return `${(ms / 1_000).toFixed(1)}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}m ${sec}s`;
}

// =============================================================================
// Toast
// =============================================================================

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', error: '✗', info: 'ℹ' };
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3200);
}

// =============================================================================
// Clock
// =============================================================================

export function startClock() {
  function tick() {
    const now = new Date();
    const clock = document.getElementById('header-clock');
    const date  = document.getElementById('header-date');
    if (clock) clock.textContent = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    if (date)  date.textContent  = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  tick();
  setInterval(tick, 1_000);
}

// =============================================================================
// Loading skeleton
// =============================================================================

export function skeletonRow(cols: number): string {
  const cells = Array.from({ length: cols }, () =>
    `<td><div style="height:14px;border-radius:6px;background:var(--color-border);animation:shimmer 1.5s infinite;"></div></td>`
  ).join('');
  return `<tr>${cells}</tr>`;
}

export function renderSkeletonRows(tbodyId: string, rows = 3, cols = 6) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = Array.from({ length: rows }, () => skeletonRow(cols)).join('');
}
