// Centralized configuration — single source of truth for all environment-dependent values.
// In development, Vite proxy handles /api → localhost:8080.
// In production, Nginx reverse proxy handles /api → backend:8080.
// If deploying frontend on a separate domain (e.g. Vercel), set VITE_API_BASE_URL to the backend URL.

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
export const ADMIN_API_BASE = `${API_BASE}/admin`;
