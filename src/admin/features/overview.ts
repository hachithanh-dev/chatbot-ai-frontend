import { dashboardApi } from '../api/dashboard.api';
import { formatNumber, formatISODate, formatDayLabel, showToast, pct } from '../utils/helpers';
import type { DashboardStatsResponse, TopicCoverageDto, CrawlHistoryDto } from '../types';

// =============================================================================
// Overview Tab — Public entry point
// =============================================================================

export async function renderOverview(): Promise<void> {
  renderSkeletonStats();
  renderSkeletonTopics();

  try {
    const [stats, topics, history] = await Promise.all([
      dashboardApi.getStats(),
      dashboardApi.getTopics(),
      dashboardApi.getCrawlHistory(),
    ]);

    renderStats(stats);
    renderTopics(topics);
    renderCrawlChart(history);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi tải dữ liệu';
    showToast(`Tổng quan: ${message}`, 'error');
  }
}

// =============================================================================
// Stats Cards
// =============================================================================

function renderSkeletonStats() {
  setTextById('stat-active-docs', '...');
  setTextById('stat-vector-count', '...');
  setTextById('stat-pending-pages', '...');
  setTextById('stat-last-crawl-pages', '...');
  setTextById('stat-last-crawl-at', '...');
  setTextById('stat-queries-today', '...');
  setTextById('stat-low-relevance', '...');
}

function renderStats(stats: DashboardStatsResponse): void {
  setTextById('stat-active-docs', formatNumber(stats.activeDocuments));
  setTextById('stat-vector-count', formatNumber(stats.vectorCount));
  setTextById('stat-pending-pages', formatNumber(stats.pendingPages));
  setTextById('stat-last-crawl-pages', formatNumber(stats.lastCrawlPages));
  setTextById('stat-last-crawl-at', formatISODate(stats.lastCrawlAt));
  setTextById('stat-queries-today', formatNumber(stats.queriesToday));
  setTextById('stat-low-relevance', `${(stats.lowRelevancePct || 0).toFixed(1)}%`);

  // Update pending badges in header and banner
  updatePendingBadges(stats.pendingPages);
}

/** Sync pending count across all badge elements */
export function updatePendingBadges(count: number): void {
  const countStr = String(count);
  ['badge-overview', 'badge-knowledge'].forEach(id => setTextById(id, countStr));

  const subtabCount = document.querySelector<HTMLElement>('.subtab-count');
  if (subtabCount) subtabCount.textContent = countStr;

  // Review filter label
  const pendingBtn = document.querySelector<HTMLElement>('#review-filter [data-filter="pending"]');
  if (pendingBtn) pendingBtn.textContent = `Chờ duyệt (${count})`;

  // Overview banner
  const bannerCount = document.getElementById('pending-banner-count');
  const banner = document.getElementById('pending-banner');
  if (bannerCount) bannerCount.textContent = String(count);
  if (banner) banner.style.display = count > 0 ? '' : 'none';
}

// =============================================================================
// Topic Coverage
// =============================================================================

function renderSkeletonTopics(): void {
  const container = document.getElementById('topic-list');
  if (!container) return;
  container.innerHTML = Array.from({ length: 5 }, () => `
    <div class="topic-item" style="opacity:.4">
      <div class="topic-row">
        <span class="topic-name" style="background:var(--color-border);border-radius:4px;width:140px;display:inline-block">&nbsp;</span>
      </div>
      <div class="progress-track"><div class="progress-fill primary" style="width:0%"></div></div>
    </div>`).join('');
}

function renderTopics(topics: TopicCoverageDto[]): void {
  const container = document.getElementById('topic-list');
  if (!container) return;

  if (topics.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Không có dữ liệu chủ đề</div></div>';
    return;
  }

  container.innerHTML = topics.map(t => {
    const p = pct(t.chunkCount, t.targetCount);
    const isWarn = p < 40;
    return `
      <div class="topic-item">
        <div class="topic-row">
          <span class="topic-name">${t.topic}</span>
          <span class="topic-meta">
            <span class="topic-chunks">${formatNumber(t.chunkCount)} chunks</span>
            <span class="topic-pct ${isWarn ? 'warn' : 'normal'}">${p}%</span>
            ${isWarn ? '<span class="warn-icon">⚠</span>' : ''}
          </span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${isWarn ? 'warn' : 'primary'}" style="width: ${p}%"></div>
        </div>
      </div>`;
  }).join('');
}

// =============================================================================
// Crawl History Chart
// =============================================================================

function renderCrawlChart(history: CrawlHistoryDto[]): void {
  const container = document.getElementById('crawl-chart');
  if (!container) return;

  const maxVal = Math.max(...history.map(d => d.successCount + d.failCount), 1);
  const chartH = 130;

  container.innerHTML = history.map(day => {
    const label = formatDayLabel(day.date);
    const totalH = ((day.successCount + day.failCount) / maxVal) * chartH;
    const successH = (day.successCount / (day.successCount + day.failCount || 1)) * totalH;
    const failH = totalH - successH;
    return `
      <div class="chart-col">
        <div class="bar-group" style="height:${totalH}px; min-height: ${totalH > 0 ? 4 : 0}px">
          ${day.successCount > 0 ? `<div class="bar success" style="height:${successH}px" title="${day.successCount} thành công"></div>` : ''}
          ${day.failCount > 0    ? `<div class="bar fail"    style="height:${failH}px"    title="${day.failCount} thất bại"></div>` : ''}
        </div>
        <span class="bar-label">${label}</span>
      </div>`;
  }).join('');
}

// =============================================================================
// Utils
// =============================================================================

function setTextById(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
