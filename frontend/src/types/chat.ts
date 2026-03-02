export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatStreamEvent {
  type: 'text' | 'done' | 'error'
  text?: string
  error?: string
}
