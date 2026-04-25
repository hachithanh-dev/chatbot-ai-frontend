export interface CursorResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: string;
  model?: string;
}

export interface StreamEvent {
  sessionId: string;
  title?: string;
  timestamp?: string;
  type: 'CONTENT' | 'TITLE' | 'ERROR';
  content?: string;
  role?: string;
}
