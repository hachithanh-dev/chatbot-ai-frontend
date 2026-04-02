import type { Session } from '../types';

export const state = {
  sessions: [] as Session[],
  currentSessionId: null as string | null,
  sessionsCursor: null as string | null,
  hasMoreSessions: true,
  isStreaming: false,
  isSidebarOpen: false, // Updated to false by default
  hasLoadedSessions: false, // Track if sessions were loaded at least once
};
