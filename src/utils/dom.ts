// Helper functions to query DOM
export const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;
export const $$ = <T extends HTMLElement>(sel: string): NodeListOf<T> => document.querySelectorAll<T>(sel);

// Global DOM elements reference
export const dom = {
  sidebar: $('#sidebar'),
  sessionsList: $('#sessions-list'),
  newChatBtn: $('#new-chat-btn'),
  sidebarToggle: $('#sidebar-toggle'),
  chatTitle: $('#chat-title'),
  chatMessages: $('#chat-messages'),
  welcomeScreen: $('#welcome-screen'),
  messageInput: $<HTMLTextAreaElement>('#message-input'),
  sendBtn: $<HTMLButtonElement>('#send-btn'),
  searchInput: $<HTMLInputElement>('#search-input'),
  // Confirm dialog elements
  confirmDialog: $('#confirm-dialog'),
  confirmCancel: $('#confirm-cancel'),
  confirmDelete: $('#confirm-delete'),
  confirmBackdrop: $('#confirm-dialog-backdrop'),
};
