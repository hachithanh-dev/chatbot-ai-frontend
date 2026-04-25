import { API_BASE, api } from '../api';
import { authState, isAccessTokenExpired, updateAccessToken, clearAuthState } from '../auth/authState';
import { showLoginScreen } from '../auth/authUI';
import { state } from '../store/state';
import { dom } from '../utils/dom';
import { escapeHtml } from '../utils/formatter';
import { addMessageToUI, showTypingIndicator, scrollToBottom } from './ChatWindow';
import { StreamRenderer } from './StreamRenderer';
import type { StreamEvent } from '../types';
import { renderSessions, loadSessions } from './Sidebar';

// Store pending message to send after login
let pendingMessage: string | null = null;

// Track current stream for abort capability
let currentAbortController: AbortController | null = null;
let currentStreamRenderer: StreamRenderer | null = null;

// SVG icons for send/stop toggle
const SEND_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
const STOP_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;

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
  if (state.isStreaming) {
    // Show stop button — keep enabled so user can abort
    dom.sendBtn.disabled = false;
    dom.sendBtn.classList.add('btn-stop-mode');
    dom.sendBtn.innerHTML = STOP_ICON;
    dom.sendBtn.title = 'Dừng tạo';
    dom.sendBtn.setAttribute('aria-label', 'Dừng tạo');
  } else {
    // Show send button
    dom.sendBtn.classList.remove('btn-stop-mode');
    dom.sendBtn.innerHTML = SEND_ICON;
    dom.sendBtn.title = 'Gửi tin nhắn';
    dom.sendBtn.setAttribute('aria-label', 'Gửi tin nhắn');
    dom.sendBtn.disabled = !dom.messageInput.value.trim();
  }
}

/** Abort the current streaming response */
export function abortStream(): void {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  if (currentStreamRenderer) {
    currentStreamRenderer.destroy();
    currentStreamRenderer = null;
  }
  // Remove streaming cursor from any active message
  const streamingMsg = document.querySelector('.message.streaming');
  if (streamingMsg) {
    streamingMsg.classList.remove('streaming');
  }
  // Remove typing indicator if still showing
  const typingEl = document.getElementById('typing-message');
  typingEl?.remove();

  state.isStreaming = false;
  updateSendButton();
  dom.messageInput.focus();
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
  dom.messageInput.value = '';
  autoResizeTextarea();
  updateSendButton(); // Switch to stop icon

  addMessageToUI('user', text);
  const typingEl = showTypingIndicator();

  let accumulatedContent = '';
  let currentSessionId = state.currentSessionId;

  // Create abort controller for this stream
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

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
      signal,
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
    const contentEl = aiMessage.querySelector('.message-content')! as HTMLElement;
    aiMessage.classList.add('streaming');

    // Use StreamRenderer for smooth typewriter effect
    const streamRenderer = new StreamRenderer(contentEl);
    currentStreamRenderer = streamRenderer;
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

          if (event.type === 'CONTENT' && event.content) {
            accumulatedContent += event.content;
            streamRenderer.pushToken(event.content);
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
          } else if (event.type === 'ERROR' && event.content) {
            contentEl.innerHTML += `<div class="message-error">${escapeHtml(event.content)}</div>`;
          }

          if (event.sessionId && !state.currentSessionId) {
            state.currentSessionId = event.sessionId;
            currentSessionId = event.sessionId;
            
            // Add session to list immediately for best UI feedback
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

    // Signal stream complete — renderer drains remaining queue then finalizes
    currentStreamRenderer = null;
    streamRenderer.finish(() => {
      aiMessage.classList.remove('streaming');
      scrollToBottom();
    });

    if (currentSessionId && !state.sessions.find(s => s.id === currentSessionId)) {
      loadSessions();
    }

  } catch (err: any) {
    typingEl?.remove();
    if (err.name === 'AbortError') {
      // User cancelled — keep what was already rendered
      currentStreamRenderer = null;
    } else {
      addMessageToUI('assistant', `⚠️ **Connection Error**: ${err.message || 'Could not connect to the server.'}`);
    }
  } finally {
    currentAbortController = null;
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
