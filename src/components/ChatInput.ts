import { API_BASE, api } from '../api';
import { authState, isAccessTokenExpired, updateAccessToken, clearAuthState } from '../auth/authState';
import { showLoginScreen } from '../auth/authUI';
import { state } from '../store/state';
import { dom } from '../utils/dom';
import { escapeHtml } from '../utils/formatter';
import { renderMarkdown } from './MarkdownRenderer';
import { addMessageToUI, showTypingIndicator, scrollToBottom } from './ChatWindow';
import type { StreamEvent } from '../types';
import { renderSessions, loadSessions } from './Sidebar';

// Store pending message to send after login
let pendingMessage: string | null = null;

/** Get pending message and clear it */
export function consumePendingMessage(): string | null {
  const msg = pendingMessage;
  pendingMessage = null;
  return msg;
}

export function autoResizeTextarea() {
  const el = dom.messageInput;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

export function updateSendButton() {
  dom.sendBtn.disabled = !dom.messageInput.value.trim() || state.isStreaming;
}

/** Try to refresh access token before a stream request */
async function ensureValidToken(): Promise<string | null> {
  if (!authState.accessToken) return null;
  if (!isAccessTokenExpired()) return authState.accessToken;

  // Try refresh using HttpOnly cookie (sent automatically by browser)
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Browser sends HttpOnly cookie automatically
    });
    if (!res.ok) return null;
    const json = await res.json();
    updateAccessToken(json.data.accessToken);
    return json.data.accessToken;
  } catch {
    return null;
  }
}

export async function sendMessage(text: string) {
  if (!text.trim() || state.isStreaming) return;

  // Check auth before sending - if not logged in, show login popup
  if (!authState.isLoggedIn || !authState.accessToken) {
    pendingMessage = text;
    showLoginScreen();
    return;
  }

  state.isStreaming = true;
  dom.sendBtn.disabled = true;
  dom.messageInput.value = '';
  autoResizeTextarea();

  addMessageToUI('user', text);
  const typingEl = showTypingIndicator();

  let accumulatedContent = '';
  let currentSessionId = state.currentSessionId;

  try {
    // Ensure valid token before streaming
    const token = await ensureValidToken();
    if (!token) {
      clearAuthState();
      window.location.reload();
      return;
    }

    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        message: text,
        sessionId: currentSessionId,
      }),
    });

    if (response.status === 401) {
      clearAuthState();
      window.location.reload();
      return;
    }

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    // Bump existing session
    if (currentSessionId) {
      const existing = state.sessions.find(s => s.id === currentSessionId);
      if (existing) {
        existing.updatedAt = new Date().toISOString();
        if (state.sessions[0]?.id !== existing.id) {
          state.sessions = state.sessions.filter(s => s.id !== existing.id);
          state.sessions.unshift(existing);
          renderSessions();
        }
      }
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    typingEl.remove();
    const aiMessage = addMessageToUI('assistant', '');
    const contentEl = aiMessage.querySelector('.message-content')!;

    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;

        try {
          const event: StreamEvent = JSON.parse(jsonStr);

          if (event.type === 'CONTENT') {
            accumulatedContent += event.content;
            contentEl.innerHTML = renderMarkdown(accumulatedContent);
            scrollToBottom();
          } else if (event.type === 'TITLE') {
            dom.chatTitle.textContent = event.title || event.content || 'Chat';
            if (event.sessionId) {
              currentSessionId = event.sessionId;
              state.currentSessionId = event.sessionId;
              const existing = state.sessions.find(s => s.id === event.sessionId);
              if (existing) {
                existing.title = event.title || event.content || existing.title;
              } else {
                state.sessions.unshift({
                  id: event.sessionId,
                  title: event.title || event.content || 'New Chat',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                });
              }
              renderSessions();
            }
          } else if (event.type === 'ERROR') {
            contentEl.innerHTML += `<div class="message-error">${escapeHtml(event.content)}</div>`;
          }

          if (event.sessionId && !state.currentSessionId) {
            state.currentSessionId = event.sessionId;
            currentSessionId = event.sessionId;
            
            // Thêm session vào danh sách ngay lập tức để có phản hồi UI tốt nhất
            if (!state.sessions.some(s => s.id === event.sessionId)) {
              state.sessions.unshift({
                id: event.sessionId,
                title: 'New Chat',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              renderSessions();
            }
          }
        } catch (parseErr) {
          // Skip malformed JSON
        }
      }
    }

    if (currentSessionId && !state.sessions.find(s => s.id === currentSessionId)) {
      loadSessions();
    }

  } catch (err: any) {
    typingEl?.remove();
    addMessageToUI('assistant', `⚠️ **Connection Error**: ${err.message || 'Could not connect to the server.'}`);
  } finally {
    state.isStreaming = false;
    updateSendButton();
    dom.messageInput.focus();
  }
}

export async function handleFileUpload(file: File) {
  const overlay = document.getElementById('upload-overlay');
  overlay?.classList.remove('hidden');
  try {
    await api.uploadFile(file);
    addMessageToUI('assistant', `✅ File **${escapeHtml(file.name)}** has been uploaded and processed for RAG. You can now ask questions about its content.`);
  } catch (err: any) {
    addMessageToUI('assistant', `❌ Failed to upload file: ${err.message}`);
  } finally {
    overlay?.classList.add('hidden');
  }
}
