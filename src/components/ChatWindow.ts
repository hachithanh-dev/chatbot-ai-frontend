import { api } from '../api';
import { state } from '../store/state';
import { dom } from '../utils/dom';
import { escapeHtml } from '../utils/formatter';
import { renderMarkdown } from './MarkdownRenderer';
import { renderSessions, toggleSidebar } from './Sidebar';
import { addMessageActions } from './UIExtensions';

const STORAGE_KEY_SESSION = 'chatbot_last_session_id';

export function scrollToBottom() {
  requestAnimationFrame(() => {
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
  });
}

export function addMessageToUI(role: 'user' | 'assistant', content: string, animate = true): HTMLElement {
  dom.welcomeScreen.style.display = 'none';

  const messageEl = document.createElement('div');
  messageEl.className = `message ${role}`;
  if (!animate) messageEl.style.animation = 'none';

  const avatarContent = role === 'user'
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';

  messageEl.innerHTML = `
    <div class="message-avatar" aria-hidden="true">${avatarContent}</div>
    <div class="message-body">
      <div class="message-role">${role === 'user' ? 'Bạn' : 'AI Assistant'}</div>
      <div class="message-content">${role === 'user' ? `<p>${escapeHtml(content)}</p>` : renderMarkdown(content)}</div>
    </div>
  `;

  dom.chatMessages.appendChild(messageEl);

  // Add message actions (copy, reactions, timestamp)
  if (content) {
    addMessageActions(messageEl, role);
  }

  scrollToBottom();
  return messageEl;
}

export function showTypingIndicator(): HTMLElement {
  dom.welcomeScreen.style.display = 'none';
  const el = document.createElement('div');
  el.className = 'message assistant';
  el.id = 'typing-message';
  el.setAttribute('aria-label', 'AI đang trả lời...');
  el.innerHTML = `
    <div class="message-avatar" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
      </svg>
    </div>
    <div class="message-body">
      <div class="message-role">AI Assistant</div>
      <div class="message-content">
        <div class="typing-indicator" aria-hidden="true"><span></span><span></span><span></span></div>
      </div>
    </div>
  `;
  dom.chatMessages.appendChild(el);
  scrollToBottom();
  return el;
}

export function clearChat() {
  dom.chatMessages.innerHTML = '';
  dom.chatMessages.appendChild(dom.welcomeScreen);
  dom.welcomeScreen.style.display = '';
  dom.chatTitle.textContent = 'New Conversation';
}

let currentLoadController: AbortController | null = null;

export async function selectSession(sessionId: string) {
  if (currentLoadController) {
    currentLoadController.abort();
  }
  currentLoadController = new AbortController();
  const signal = currentLoadController.signal;

  state.currentSessionId = sessionId;
  localStorage.setItem(STORAGE_KEY_SESSION, sessionId); // Persist for F5 restore
  const session = state.sessions.find(s => s.id === sessionId);
  dom.chatTitle.textContent = session?.title || 'Chat';
  renderSessions();

  dom.chatMessages.innerHTML = '';
  dom.chatMessages.appendChild(dom.welcomeScreen);
  dom.welcomeScreen.style.display = 'none';

  try {
    const res = await api.getMessages(sessionId, undefined, 20, signal);
    if (signal.aborted) return;
    const messages = (res.data || []).reverse();
    messages.forEach(msg => {
      addMessageToUI(msg.role.toLowerCase() as 'user' | 'assistant', msg.content, false);
    });
    scrollToBottom();
  } catch (err: any) {
    if (err.name === 'AbortError') return;
    console.error('Failed to load messages:', err);
    addMessageToUI('assistant', '⚠️ Không thể tải tin nhắn. Server có thể đang offline.');
  }

  if (window.innerWidth <= 768) {
    toggleSidebar(false);
  }
}

export function startNewChat() {
  state.currentSessionId = null;
  localStorage.removeItem(STORAGE_KEY_SESSION); // Clear persisted session
  clearChat();
  renderSessions();
  dom.messageInput.focus();
}
