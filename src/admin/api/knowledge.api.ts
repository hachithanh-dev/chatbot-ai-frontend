import { adminGet, adminPost, adminPut, adminDelete, uploadFileRequest } from './http';
import type {
  DocumentDto,
  CrawlerPageDto,
  CrawlSourceDto,
  PageResponse,
  AddCrawlSourceRequest,
  UpdateCrawlSourceRequest,
} from '../types';

/**
 * Knowledge Base API — Tab "Knowledge Base"
 * Documents, Crawler Pages, and Crawl Sources management.
 */
export const knowledgeApi = {
  // ---------------------------------------------------------------------------
  // Documents
  // ---------------------------------------------------------------------------

  /**
   * Danh sách tài liệu, filter theo status (ALL | ACTIVE | PROCESSING | ERROR)
   */
  getDocuments(status = 'ALL', page = 0, size = 20): Promise<PageResponse<DocumentDto>> {
    const params = new URLSearchParams({ status, page: String(page), size: String(size) });
    return adminGet<PageResponse<DocumentDto>>(`/documents?${params}`);
  },

  /**
   * Xóa tài liệu + vectors trong Qdrant
   */
  deleteDocument(id: string): Promise<void> {
    return adminDelete(`/documents/${id}`);
  },

  /**
   * Upload file (reuses /api/v1/rag/file endpoint)
   */
  uploadFile(file: File): Promise<unknown> {
    return uploadFileRequest(file);
  },

  // ---------------------------------------------------------------------------
  // Crawler Pages
  // ---------------------------------------------------------------------------

  /**
   * Danh sách trang đã crawl, filter theo status (ALL | PENDING | APPROVED | REJECTED)
   */
  getPages(status = 'ALL', page = 0, size = 50): Promise<PageResponse<CrawlerPageDto>> {
    const params = new URLSearchParams({ status, page: String(page), size: String(size) });
    return adminGet<PageResponse<CrawlerPageDto>>(`/crawler/pages?${params}`);
  },

  /**
   * Duyệt một trang → kích hoạt ingestion vào Qdrant
   */
  approvePage(id: string): Promise<void> {
    return adminPost(`/crawler/pages/${id}/approve`);
  },

  /**
   * Từ chối một trang
   */
  rejectPage(id: string): Promise<void> {
    return adminPost(`/crawler/pages/${id}/reject`);
  },

  /**
   * Duyệt tất cả trang đang PENDING
   */
  approveAll(): Promise<void> {
    return adminPost('/crawler/pages/approve-all');
  },

  // ---------------------------------------------------------------------------
  // Crawl Sources
  // ---------------------------------------------------------------------------

  /**
   * Danh sách nguồn crawl
   */
  getSources(): Promise<CrawlSourceDto[]> {
    return adminGet<CrawlSourceDto[]>('/crawler/sources');
  },

  /**
   * Thêm nguồn crawl mới
   */
  addSource(req: AddCrawlSourceRequest): Promise<CrawlSourceDto> {
    return adminPost<CrawlSourceDto>('/crawler/sources', req);
  },

  /**
   * Cập nhật nguồn crawl
   */
  updateSource(id: string, req: UpdateCrawlSourceRequest): Promise<CrawlSourceDto> {
    return adminPut<CrawlSourceDto>(`/crawler/sources/${id}`, req);
  },

  /**
   * Kích hoạt crawl ngay cho nguồn cụ thể
   */
  triggerCrawl(id: string): Promise<void> {
    return adminPost(`/crawler/sources/${id}/crawl-now`);
  },
};
