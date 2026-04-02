import { jobsApi } from '../api/jobs.api';
import type { BackgroundJobDto, JobStatsDto, JobListResponse } from '../types';
import { showToast, formatISODate, formatDuration, renderSkeletonRows } from '../utils/helpers';

// =============================================================================
// Polling
// =============================================================================

const POLL_INTERVAL_MS = 10_000;
let pollingTimer: ReturnType<typeof setInterval> | null = null;

// =============================================================================
// Jobs Feature — Public entry point
// =============================================================================

export function renderJobsFeature(): void {
  fetchAndRenderJobs();
  startPolling();
}

function startPolling(): void {
  stopPolling();
  pollingTimer = setInterval(() => fetchAndRenderJobs(), POLL_INTERVAL_MS);
}

export function stopPolling(): void {
  if (pollingTimer !== null) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

// =============================================================================
// Fetch & Render
// =============================================================================

async function fetchAndRenderJobs(): Promise<void> {
  // Only show skeleton on first load (tbody empty)
  const tbody = document.getElementById('jobs-table-body');
  if (tbody && tbody.innerHTML.trim() === '') {
    renderSkeletonRows('jobs-table-body', 4, 7);
  }

  try {
    const data: JobListResponse = await jobsApi.getJobs();
    renderJobStats(data.stats);
    renderJobsTable(data.jobs);
    updateJobsBadge(data.stats.failedToday);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi tải jobs';
    showToast(msg, 'error');
  }
}

// =============================================================================
// Stats Cards
// =============================================================================

function renderJobStats(stats: JobStatsDto): void {
  setTextById('job-stat-total',   String(stats.total));
  setTextById('job-stat-running', String(stats.running));
  setTextById('job-stat-success', String(stats.successToday));
  setTextById('job-stat-failed',  String(stats.failedToday));
}

function updateJobsBadge(failed: number): void {
  const badge = document.getElementById('badge-jobs');
  if (!badge) return;
  badge.textContent = String(failed);
  badge.style.display = failed > 0 ? '' : 'none';
}

// =============================================================================
// Jobs Table
// =============================================================================

function getJobStatusBadge(status: BackgroundJobDto['status']): string {
  const map: Record<BackgroundJobDto['status'], string> = {
    SUCCESS: '<span class="badge badge-success">Thành công</span>',
    RUNNING: '<span class="badge badge-running">🔄 Đang chạy</span>',
    FAILED:  '<span class="badge badge-danger">Thất bại</span>',
    IDLE:    '<span class="badge badge-gray">Chờ</span>',
  };
  return map[status] ?? `<span class="badge badge-gray">${status}</span>`;
}

function getJobTypeBadge(type: BackgroundJobDto['jobType']): string {
  return type === 'SCHEDULED'
    ? '<span class="badge badge-primary">Lập lịch</span>'
    : '<span class="badge badge-gray">Thủ công</span>';
}

function renderJobsTable(jobs: BackgroundJobDto[]): void {
  const tbody = document.getElementById('jobs-table-body');
  if (!tbody) return;

  if (jobs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state">
        <div class="empty-state-icon">🔧</div>
        <div class="empty-state-text">Không có jobs nào</div>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = jobs.map(job => {
    const isRunning = job.status === 'RUNNING';
    const isFailed  = job.status === 'FAILED';
    const rowClass  = isRunning ? 'running-row' : '';

    const durationDisplay = isRunning
      ? '<span style="color:var(--color-warning-dark)">Đang chạy...</span>'
      : formatDuration(job.durationMs);

    const actionBtn = isRunning
      ? `<button class="btn btn-outline btn-sm" disabled>Đang chạy...</button>`
      : `<button class="btn btn-primary btn-sm btn-run-job" data-id="${job.jobId}">Chạy ngay</button>`;

    return `
      <tr class="${rowClass}">
        <td>
          <div class="cell-primary">${job.jobName}</div>
          <div class="cell-secondary">ID: ${job.jobId}</div>
        </td>
        <td>${getJobTypeBadge(job.jobType)}</td>
        <td><span class="cell-mono">${job.cron || 'On-demand'}</span></td>
        <td><span class="cell-secondary">${formatISODate(job.lastRunAt)}</span></td>
        <td><span class="cell-mono">${durationDisplay}</span></td>
        <td>${getJobStatusBadge(job.status)}</td>
        <td>${isFailed
          ? `<div style="display:flex;gap:6px">${actionBtn}<button class="btn btn-outline btn-sm btn-view-log" data-id="${job.jobId}">Xem log</button></div>`
          : actionBtn
        }</td>
      </tr>`;
  }).join('');

  // Event delegation for table buttons
  tbody.addEventListener('click', handleJobTableClick, { once: true });
}

function handleJobTableClick(e: Event): void {
  const target = e.target as HTMLElement;
  const runBtn  = target.closest<HTMLButtonElement>('.btn-run-job');
  const logBtn  = target.closest<HTMLButtonElement>('.btn-view-log');

  if (runBtn?.dataset.id)  runJobAction(runBtn.dataset.id);
  if (logBtn?.dataset.id)  viewJobLog(logBtn.dataset.id);
}

// =============================================================================
// Actions
// =============================================================================

async function runJobAction(jobId: string): Promise<void> {
  showToast(`Đang kích hoạt job: ${jobId}...`, 'info');
  try {
    await jobsApi.runJob(jobId);
    showToast('Job đã được kích hoạt — đang polling trạng thái', 'success');
    // Immediate re-fetch to show RUNNING state quickly
    await fetchAndRenderJobs();
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Lỗi kích hoạt job', 'error');
  }
}

function viewJobLog(jobId: string): void {
  // Placeholder — open a modal or navigate when implemented
  showToast(`Log cho ${jobId} — chức năng sẽ được bổ sung`, 'info');
}

// =============================================================================
// Utilities
// =============================================================================

function setTextById(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// Expose for external cleanup (e.g., when navigating away)
export { fetchAndRenderJobs };
