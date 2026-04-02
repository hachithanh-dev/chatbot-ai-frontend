import { knowledgeApi } from '../api/knowledge.api';
import type { DocumentDto, CrawlerPageDto, CrawlSourceDto, PageResponse } from '../types';
import { showToast, formatNumber, formatFileSize, formatISODate, renderSkeletonRows } from '../utils/helpers';
import { updatePendingBadges } from './overview';

// =============================================================================
// State
// =============================================================================

let docFilter   = 'ALL';
let reviewFilter: string = 'PENDING';

// =============================================================================
// Knowledge Feature — Public entry point
// =============================================================================

export function renderKnowledgeFeature(): void {
  // Docs Tab
  fetchAndRenderDocs();
  initDocFilter();
  initUploadZone();

  // Review Tab
  fetchAndRenderReview();
  initReviewFilter();

  // Sources Tab
  fetchAndRenderSources();
  initSourceForm();
}

// =============================================================================
// DOCUMENTS
// =============================================================================

function getDocStatusBadge(status: DocumentDto['status']): string {
  const map: Record<DocumentDto['status'], string> = {
    ACTIVE:      '<span class="badge badge-success">Đang dùng</span>',
    PROCESSING:  '<span class="badge badge-warning">Đang xử lý</span>',
    ERROR:       '<span class="badge badge-danger">Lỗi</span>',
  };
  return map[status] ?? `<span class="badge badge-gray">${status}</span>`;
}

async function fetchAndRenderDocs(): Promise<void> {
  renderSkeletonRows('docs-table-body', 4, 6);

  try {
    // Map UI filter → API status param
    const statusParam = docFilter === 'all' ? 'ALL' : docFilter.toUpperCase();
    const page: PageResponse<DocumentDto> = await knowledgeApi.getDocuments(statusParam);
    renderDocs(page.content, page.totalElements);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi tải tài liệu';
    showToast(msg, 'error');
    renderDocsEmpty();
  }
}

function renderDocs(docs: DocumentDto[], total: number): void {
  const tbody = document.getElementById('docs-table-body');
  const countEl = document.getElementById('doc-count');
  if (countEl) countEl.textContent = String(total);

  if (!tbody) return;

  if (docs.length === 0) {
    renderDocsEmpty();
    return;
  }

  tbody.innerHTML = docs.map(doc => `
    <tr>
      <td><span class="cell-primary">${doc.fileName}</span></td>
      <td>${formatFileSize(doc.fileSize)}</td>
      <td>${doc.chunkCount !== null ? formatNumber(doc.chunkCount) : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td><span class="badge badge-gray">${doc.topic || '—'}</span></td>
      <td><span class="cell-secondary">${formatISODate(doc.uploadedAt)}</span></td>
      <td style="display:flex;gap:6px;align-items:center">
        ${getDocStatusBadge(doc.status)}
        <button class="btn btn-outline btn-sm btn-delete-doc" data-id="${doc.id}" title="Xóa tài liệu" style="padding:2px 8px">🗑</button>
      </td>
    </tr>`).join('');

  // Bind delete buttons (event delegation on tbody)
  tbody.addEventListener('click', handleDocDelete, { once: true });
}

function renderDocsEmpty(): void {
  const tbody = document.getElementById('docs-table-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6">
    <div class="empty-state">
      <div class="empty-state-icon">📄</div>
      <div class="empty-state-text">Không có tài liệu nào</div>
    </div>
  </td></tr>`;
}

function handleDocDelete(e: Event): void {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.btn-delete-doc');
  if (!btn || !btn.dataset.id) return;
  deleteDoc(btn.dataset.id);
}

async function deleteDoc(id: string): Promise<void> {
  if (!confirm('Xóa tài liệu này sẽ xóa cả vectors trong Qdrant. Tiếp tục?')) return;
  try {
    await knowledgeApi.deleteDocument(id);
    showToast('Đã xóa tài liệu', 'success');
    fetchAndRenderDocs();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi xóa tài liệu';
    showToast(msg, 'error');
  }
}

function initDocFilter(): void {
  const container = document.getElementById('doc-filter');
  if (!container) return;
  container.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.filter-tab');
    if (!btn?.dataset.filter) return;
    container.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    docFilter = btn.dataset.filter;
    fetchAndRenderDocs();
  });
}

// =============================================================================
// UPLOAD ZONE
// =============================================================================

function initUploadZone(): void {
  const zone  = document.getElementById('upload-zone');
  const input = document.getElementById('file-input-admin') as HTMLInputElement;
  const btn   = document.getElementById('btn-choose-file');
  if (!zone || !input || !btn) return;

  btn.addEventListener('click', (e) => { e.stopPropagation(); input.click(); });
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  });
  input.addEventListener('change', () => {
    if (input.files?.length) handleFiles(input.files);
  });

  function handleFiles(files: FileList) {
    Array.from(files).forEach(file => uploadFile(file));
    input.value = '';
  }
}

async function uploadFile(file: File): Promise<void> {
  showToast(`Đang upload: ${file.name}`, 'info');
  try {
    await knowledgeApi.uploadFile(file);
    showToast(`Đã upload: ${file.name} — đang xử lý trong nền`, 'success');
    // Refresh list after short delay to allow backend to register the doc
    setTimeout(() => fetchAndRenderDocs(), 1_500);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload thất bại';
    showToast(`${file.name}: ${msg}`, 'error');
  }
}

// =============================================================================
// CRAWLER REVIEW
// =============================================================================

function getReviewStatusBadge(status: CrawlerPageDto['status']): string {
  if (status === 'PENDING')  return '<span class="badge badge-warning">Chờ duyệt</span>';
  if (status === 'APPROVED') return '<span class="badge badge-success">Đã duyệt</span>';
  return '<span class="badge badge-danger">Đã từ chối</span>';
}

async function fetchAndRenderReview(): Promise<void> {
  renderSkeletonRows('review-table-body', 4, 6);

  try {
    const statusParam = reviewFilter === 'all' ? 'ALL' : reviewFilter.toUpperCase();
    const page: PageResponse<CrawlerPageDto> = await knowledgeApi.getPages(statusParam);
    renderReview(page.content);

    // Keep pending count in sync
    if (reviewFilter.toUpperCase() !== 'ALL') {
      const pending = await knowledgeApi.getPages('PENDING');
      updatePendingBadges(pending.totalElements);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi tải trang crawler';
    showToast(msg, 'error');
    renderReviewEmpty();
  }
}

function renderReview(pages: CrawlerPageDto[]): void {
  const tbody = document.getElementById('review-table-body');
  if (!tbody) return;

  if (pages.length === 0) {
    renderReviewEmpty();
    return;
  }

  tbody.innerHTML = pages.map(page => {
    const isPending = page.status === 'PENDING';
    const topicTag = page.topicTag
      ? `<span class="tag-chip tag-default">${page.topicTag}</span>`
      : '';
    const actions = isPending
      ? `<div style="display:flex;gap:6px">
           <button class="btn btn-success btn-sm btn-approve" data-id="${page.id}">Duyệt</button>
           <button class="btn btn-danger btn-sm btn-reject"  data-id="${page.id}">Từ chối</button>
         </div>`
      : getReviewStatusBadge(page.status);

    return `
      <tr>
        <td class="page-title-cell">
          <div class="page-name">${page.title || '(Không có tiêu đề)'}</div>
          <div class="page-tags">${topicTag}</div>
          <div class="page-url">${page.url}</div>
        </td>
        <td><span class="cell-secondary">${page.sourceName || '—'}</span></td>
        <td><span class="cell-mono">${formatNumber(page.wordCount)}</span></td>
        <td><span class="cell-mono">${page.chunkCount}</span></td>
        <td><span class="cell-secondary">${formatISODate(page.crawledAt)}</span></td>
        <td>${actions}</td>
      </tr>`;
  }).join('');

  // Bind action buttons via event delegation
  tbody.addEventListener('click', handleReviewAction, { once: true });
}

function renderReviewEmpty(): void {
  const tbody = document.getElementById('review-table-body');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6">
    <div class="empty-state">
      <div class="empty-state-icon">✅</div>
      <div class="empty-state-text">Không có trang nào</div>
    </div>
  </td></tr>`;
}

function handleReviewAction(e: Event): void {
  const target = e.target as HTMLElement;
  const approveBtn = target.closest<HTMLButtonElement>('.btn-approve');
  const rejectBtn  = target.closest<HTMLButtonElement>('.btn-reject');

  if (approveBtn?.dataset.id) approvePageAction(approveBtn.dataset.id);
  else if (rejectBtn?.dataset.id)  rejectPageAction(rejectBtn.dataset.id);
}

async function approvePageAction(id: string): Promise<void> {
  try {
    await knowledgeApi.approvePage(id);
    showToast('Đã duyệt — ingestion đang xử lý trong nền', 'success');
    await refreshReviewAndPending();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Lỗi duyệt trang', 'error');
  }
}

async function rejectPageAction(id: string): Promise<void> {
  try {
    await knowledgeApi.rejectPage(id);
    showToast('Đã từ chối trang', 'info');
    await refreshReviewAndPending();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Lỗi từ chối trang', 'error');
  }
}

async function approveAllAction(): Promise<void> {
  try {
    await knowledgeApi.approveAll();
    showToast('Đã duyệt tất cả — ingestion đang xử lý', 'success');
    await refreshReviewAndPending();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Lỗi duyệt tất cả', 'error');
  }
}

async function refreshReviewAndPending(): Promise<void> {
  await fetchAndRenderReview();
  // Refresh pending count from server
  try {
    const pending = await knowledgeApi.getPages('PENDING');
    updatePendingBadges(pending.totalElements);
  } catch { /* non-critical */ }
}

function initReviewFilter(): void {
  const container    = document.getElementById('review-filter');
  const approveAllBtn = document.getElementById('btn-approve-all');

  if (container) {
    container.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.filter-tab');
      if (!btn?.dataset.filter) return;
      container.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      reviewFilter = btn.dataset.filter;
      fetchAndRenderReview();
    });
  }

  if (approveAllBtn) {
    approveAllBtn.addEventListener('click', () => approveAllAction());
  }
}

// =============================================================================
// CRAWL SOURCES
// =============================================================================

function getSourceStatusBadge(status: string): string {
  const s = status.toUpperCase();
  if (s === 'APPROVED') return '<span class="badge badge-success">Đã duyệt</span>';
  if (s === 'PENDING')  return '<span class="badge badge-warning">Chờ duyệt</span>';
  return '<span class="badge badge-danger">Lỗi</span>';
}

async function fetchAndRenderSources(): Promise<void> {
  const container = document.getElementById('sources-list');
  if (container) container.innerHTML = '<div style="padding:24px;color:var(--text-muted)">Đang tải...</div>';

  try {
    const sources = await knowledgeApi.getSources();
    renderSources(sources);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi tải nguồn crawl';
    showToast(msg, 'error');
  }
}

function renderSources(sources: CrawlSourceDto[]): void {
  const container = document.getElementById('sources-list');
  if (!container) return;

  if (sources.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Chưa có nguồn crawl nào</div></div>';
    return;
  }

  container.innerHTML = sources.map(src => `
    <div class="source-card">
      <div class="source-header">
        <div>
          <div class="source-name">${src.name}</div>
          <div class="source-url">${src.baseUrl}</div>
        </div>
        <div class="source-actions">
          ${getSourceStatusBadge(src.status)}
          <button class="btn btn-outline btn-sm">Cấu hình</button>
          <button class="btn btn-primary btn-sm btn-crawl-now" data-id="${src.id}">Crawl ngay</button>
        </div>
      </div>
      <div class="source-meta">
        <div>
          <div class="meta-item-label">Lịch chạy</div>
          <div class="meta-item-value">${src.cronSchedule}</div>
        </div>
        <div>
          <div class="meta-item-label">Lần cuối</div>
          <div class="meta-item-value">${formatISODate(src.lastCrawlAt)}</div>
        </div>
        <div>
          <div class="meta-item-label">Pages crawled</div>
          <div class="meta-item-value">${src.pagesCrawled}</div>
        </div>
        <div>
          <div class="meta-item-label">Độ sâu</div>
          <div class="meta-item-value">depth ${src.maxDepth}</div>
        </div>
      </div>
    </div>`).join('');

  // Bind crawl-now via event delegation
  container.addEventListener('click', handleCrawlNow, { once: true });
}

function handleCrawlNow(e: Event): void {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.btn-crawl-now');
  if (!btn?.dataset.id) return;
  triggerCrawlAction(btn.dataset.id);
}

async function triggerCrawlAction(id: string): Promise<void> {
  try {
    await knowledgeApi.triggerCrawl(id);
    showToast('Đã kích hoạt crawl — job đang chạy trong nền', 'info');
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Lỗi kích hoạt crawl', 'error');
  }
}

function initSourceForm(): void {
  const btnAdd    = document.getElementById('btn-add-source');
  const form      = document.getElementById('add-source-form');
  const btnCancel = document.getElementById('btn-cancel-source');
  const btnSave   = document.getElementById('btn-save-source');
  if (!btnAdd || !form || !btnCancel || !btnSave) return;

  btnAdd.addEventListener('click', () => {
    form.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  btnCancel.addEventListener('click', () => {
    form.style.display = 'none';
    ['name', 'url', 'cron', 'depth'].forEach(f => {
      const el = document.getElementById(`input-source-${f}`) as HTMLInputElement;
      if (el) el.value = '';
    });
  });

  btnSave.addEventListener('click', () => saveSourceAction(btnCancel));
}

async function saveSourceAction(cancelBtn: HTMLElement): Promise<void> {
  const name  = (document.getElementById('input-source-name')  as HTMLInputElement).value.trim();
  const url   = (document.getElementById('input-source-url')   as HTMLInputElement).value.trim();
  const cron  = (document.getElementById('input-source-cron')  as HTMLInputElement).value.trim() || '0 6 * * *';
  const depth = parseInt((document.getElementById('input-source-depth') as HTMLInputElement).value) || 3;

  if (!name || !url) {
    showToast('Vui lòng điền đầy đủ Tên nguồn và URL', 'error');
    return;
  }

  try {
    await knowledgeApi.addSource({ name, baseUrl: url, cronSchedule: cron, maxDepth: depth });
    showToast(`Đã thêm nguồn: ${name}`, 'success');
    cancelBtn.click();
    fetchAndRenderSources();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Lỗi thêm nguồn', 'error');
  }
}
