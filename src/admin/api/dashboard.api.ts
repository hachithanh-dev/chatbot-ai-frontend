import { adminGet } from './http';
import type {
  DashboardStatsResponse,
  TopicCoverageDto,
  CrawlHistoryDto,
} from '../types';

/**
 * Dashboard API — Tab "Tổng quan"
 * All endpoints: GET /api/v1/admin/dashboard/*
 */
export const dashboardApi = {
  /**
   * Số liệu tổng quan:
   * docs active, vector count, pending pages, last crawl, queries today
   */
  getStats(): Promise<DashboardStatsResponse> {
    return adminGet<DashboardStatsResponse>('/dashboard/stats');
  },

  /**
   * Phủ sóng tài liệu theo chủ đề (progress bars)
   */
  getTopics(): Promise<TopicCoverageDto[]> {
    return adminGet<TopicCoverageDto[]>('/dashboard/topics');
  },

  /**
   * Lịch sử crawl 8 ngày gần nhất (bar chart)
   */
  getCrawlHistory(): Promise<CrawlHistoryDto[]> {
    return adminGet<CrawlHistoryDto[]>('/dashboard/crawl-history');
  },
};
