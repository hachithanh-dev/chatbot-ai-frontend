# 🤖 AI Chatbot — Frontend

> **Modern AI Chatbot interface** xây dựng bằng Vanilla TypeScript + Vite.  
> Hỗ trợ chat streaming (SSE), Google OAuth2 login, Admin Dashboard, và Dark/Light mode.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.3-purple?logo=vite)](https://vite.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ⚡ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **TypeScript 5.9** | Type-safe JavaScript |
| **Vite 7** | Lightning-fast dev server & build tool |
| **Vanilla CSS** | Custom styling (no framework dependency) |
| **Google Identity Services** | OAuth2 social login |
| **Server-Sent Events (SSE)** | Real-time streaming chat responses |
| **Markdown Rendering** | Rich message formatting |

---

## ✨ Features

- 💬 **AI Chat Interface** — Real-time streaming responses via SSE
- 🔐 **Google OAuth2 Login** — Secure authentication with JWT
- 📂 **Session Management** — Sidebar with chat history, rename, delete
- 🌗 **Dark / Light Mode** — Theme toggle
- 🛡️ **Admin Dashboard** — Stats, document management, web crawler control (ADMIN role)
- 📝 **Markdown Support** — Code highlighting, tables, lists in chat messages
- 🍞 **Toast Notifications** — User-friendly feedback
- 📱 **Responsive Design** — Mobile-friendly layout

---

## 📋 Prerequisites

- **Node.js 20+** — [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Backend server** running — see [chatbot-ai-backend](https://github.com/Thanhlovecode/chatbot-ai-backend)

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/Thanhlovecode/chatbot-ai-frontend.git
cd chatbot-ai-frontend

npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Mở `.env` và điền Google Client ID:

```properties
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
```

> 💡 Lấy Client ID từ [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth 2.0 Client IDs.  
> Nhớ thêm `http://localhost:5173` vào **Authorized JavaScript origins**.

### 3. Start Backend

Đảm bảo backend đang chạy tại `http://localhost:8080`. Xem hướng dẫn tại [chatbot-ai-backend](https://github.com/Thanhlovecode/chatbot-ai-backend).

### 4. Start Dev Server

```bash
npm run dev
```

Ứng dụng sẽ mở tại **http://localhost:5173**.

---

## 🔑 Environment Variables

| Variable | Description | Required |
|----------|------------|----------|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth2 Client ID | ✅ |

---

## 📁 Project Structure

```
chatbot-ai-frontend/
├── index.html                    # Main chatbot page
├── admin.html                    # Admin dashboard page
├── src/
│   ├── main.ts                   # App entry point
│   ├── style.css                 # Main chatbot styles
│   ├── style-admin.css           # Admin dashboard styles
│   ├── api/
│   │   └── index.ts              # API client (fetch wrapper)
│   ├── auth/
│   │   ├── authState.ts          # Auth state management (JWT + roles)
│   │   ├── authUI.ts             # Login/logout UI components
│   │   └── googleAuth.ts         # Google Identity Services integration
│   ├── components/
│   │   ├── ChatInput.ts          # Message input component
│   │   ├── ChatWindow.ts         # Chat message display
│   │   ├── MarkdownRenderer.ts   # Markdown → HTML rendering
│   │   ├── Sidebar.ts            # Session sidebar
│   │   ├── Toast.ts              # Toast notification system
│   │   └── UIExtensions.ts       # UI utilities & extensions
│   ├── admin/
│   │   ├── main.ts               # Admin dashboard entry
│   │   ├── api/                  # Admin API calls
│   │   ├── core/                 # Admin core logic
│   │   ├── data/                 # Data processing
│   │   ├── features/             # Admin feature modules
│   │   ├── types/                # Admin TypeScript types
│   │   └── utils/                # Admin utilities
│   ├── store/
│   │   └── state.ts              # Global state management
│   ├── types/
│   │   └── index.ts              # Shared TypeScript types
│   └── utils/
│       ├── dom.ts                # DOM utility helpers
│       └── formatter.ts          # Text formatting utilities
├── public/
│   ├── manifest.json             # Web app manifest
│   └── vite.svg                  # Default favicon
├── package.json                  # Dependencies & scripts
├── package-lock.json             # Lockfile
├── tsconfig.json                 # TypeScript config
├── vite.config.ts                # Vite config (proxy, build)
├── .env.example                  # Environment template
├── .editorconfig                 # Code style
└── README.md
```

---

## 🔗 Backend Integration

Frontend giao tiếp với backend thông qua **Vite dev proxy** (dev) hoặc **reverse proxy** (prod):

```typescript
// vite.config.ts — Dev proxy
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    }
  }
}
```

| Frontend | Proxied to Backend |
|----------|-------------------|
| `http://localhost:5173/api/*` | `http://localhost:8080/api/*` |

---

## 🔐 Authentication Flow

```
┌──────────┐    1. Google Login     ┌───────────────┐
│  Browser  │──────────────────────▶│ Google OAuth2  │
│           │◀─────────────────────│               │
│           │    2. ID Token        └───────────────┘
│           │
│           │    3. POST /api/v1/auth/google
│           │    Body: { credential: "..." }
│           │──────────────────────▶┌───────────────┐
│           │                       │  Spring Boot   │
│           │    4. Access Token     │  Backend       │
│           │       (JSON body)     │               │
│           │    + Refresh Token     │               │
│           │       (HttpOnly Cookie)│               │
│           │◀──────────────────────└───────────────┘
│           │
│           │    5. API calls with
│           │    Authorization: Bearer <accessToken>
│           │──────────────────────▶
└──────────┘
```

- **Access Token**: Lưu trong JS memory (biến RAM) — XSS-safe
- **Refresh Token**: `HttpOnly` cookie — tự động gửi khi gọi `/api/v1/auth/refresh`
- **Silent Refresh**: Tự động renew access token trước khi hết hạn

---

## 🏗️ Build for Production

```bash
npm run build
```

Output sẽ nằm trong thư mục `dist/`. Deploy lên bất kỳ static hosting nào (Vercel, Netlify, Nginx, etc.).

> ⚠️ Khi deploy production, cần cấu hình reverse proxy trỏ `/api/*` về backend server.

---

## 🔗 Related Repositories

| Repository | Description |
|-----------|-------------|
| [chatbot-ai-backend](https://github.com/Thanhlovecode/chatbot-ai-backend) | Spring Boot backend (API, RAG, Auth) |

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
