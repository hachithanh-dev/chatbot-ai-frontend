import { adminGet, adminPost } from './http';
import type { JobListResponse } from '../types';

/**
 * Background Jobs API — Tab "Background Jobs"
 * All endpoints: /api/v1/admin/jobs
 */
export const jobsApi = {
  /**
   * Lấy danh sách jobs + stats tổng hợp
   * Returns: { stats: JobStatsDto, jobs: BackgroundJobDto[] }
   */
  getJobs(): Promise<JobListResponse> {
    return adminGet<JobListResponse>('/jobs');
  },

  /**
   * Kích hoạt chạy job ngay lập tức (async trên backend)
   */
  runJob(jobId: string): Promise<void> {
    return adminPost(`/jobs/${jobId}/run`);
  },
};
