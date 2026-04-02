// =============================================================================
// LOCAL UI TYPES (used inside render functions)
// =============================================================================

export interface TopicItem {
  name: string;
  chunks: number;
  target: number;
}

export interface CrawlDay {
  label: string;
  success: number;
  fail: number;
}

/** Local doc representation (mapped from DocumentDto) */
export interface DocItem {
  id: string;
  fileName: string;
  fileSize: string;          // formatted string: "4.2 MB"
  chunks: number | null;
  topic: string;
  uploadedAt: string;        // formatted string: "28/03 14:22"
  status: 'active' | 'processing' | 'error';
}

export interface CrawlerPage {
  id: string;
  title: string;
  tags: { label: string; cls: string }[];
  url: string;
  source: string;
  wordCount: number;
  chunks: number;
  crawledAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface CrawlSource {
  id: string;
  name: string;
  url: string;
  schedule: string;
  lastCrawl: string;
  pagesCrawled: number;
  depth: number;
  status: 'approved' | 'pending' | 'error';
}

export interface Job {
  id: string;
  name: string;
  subName: string;
  type: 'scheduled' | 'manual';
  cron: string;
  lastRun: string;
  duration: string;
  status: 'success' | 'running' | 'failed' | 'idle';
}

// =============================================================================
// API RESPONSE TYPES  (match Spring Boot DTOs)
// =============================================================================

/** Generic Spring ResponseData<T> wrapper */
export interface ResponseData<T> {
  data: T;
  message: string;
}

/** Spring Page<T> wrapper */
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;   // current page index (0-based)
  size: number;
}

// ---------------------------------------------------------------------------
// Dashboard DTOs
// ---------------------------------------------------------------------------

export interface DashboardStatsResponse {
  activeDocuments: number;
  vectorCount: number;
  pendingPages: number;
  lastCrawlPages: number;
  lastCrawlAt: string | null;       // ISO-8601
  queriesToday: number;
  lowRelevancePct: number;          // percentage 0-100
}

export interface TopicCoverageDto {
  topic: string;
  chunkCount: number;
  targetCount: number;
}

export interface CrawlHistoryDto {
  date: string;                     // "2026-03-28"
  successCount: number;
  failCount: number;
}

// ---------------------------------------------------------------------------
// Document DTOs
// ---------------------------------------------------------------------------

export type DocumentStatus = 'ACTIVE' | 'PROCESSING' | 'ERROR';

export interface DocumentDto {
  id: string;
  fileName: string;
  fileSize: number;                 // bytes
  chunkCount: number | null;
  topic: string;
  status: DocumentStatus;
  uploadedAt: string;              // ISO-8601
  updatedAt: string;               // ISO-8601
}

// ---------------------------------------------------------------------------
// Crawler Page DTOs
// ---------------------------------------------------------------------------

export type CrawlerPageStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CrawlerPageDto {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  topicTag: string | null;
  wordCount: number;
  chunkCount: number;
  crawledAt: string;               // ISO-8601
  status: CrawlerPageStatus;
}

// ---------------------------------------------------------------------------
// Crawl Source DTOs
// ---------------------------------------------------------------------------

export interface CrawlSourceDto {
  id: string;
  name: string;
  baseUrl: string;
  cronSchedule: string;
  maxDepth: number;
  status: string;
  lastCrawlAt: string | null;      // ISO-8601
  pagesCrawled: number;
}

export interface AddCrawlSourceRequest {
  name: string;
  baseUrl: string;
  cronSchedule: string;
  maxDepth: number;
}

export interface UpdateCrawlSourceRequest {
  name?: string;
  cronSchedule?: string;
  maxDepth?: number;
}

// ---------------------------------------------------------------------------
// Background Job DTOs
// ---------------------------------------------------------------------------

export type JobStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'IDLE';
export type JobType = 'SCHEDULED' | 'MANUAL';

export interface BackgroundJobDto {
  jobId: string;
  jobName: string;
  jobType: JobType;
  cron: string;
  lastRunAt: string | null;        // ISO-8601
  durationMs: number | null;
  status: JobStatus;
  errorMessage?: string;
}

export interface JobStatsDto {
  total: number;
  running: number;
  successToday: number;
  failedToday: number;
}

export interface JobListResponse {
  stats: JobStatsDto;
  jobs: BackgroundJobDto[];
}
