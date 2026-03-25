import { ref } from 'vue'
import type { ChatMessage } from '../types/chat'

export function useRulesChat(gameId: number, onChunk?: (text: string) => void) {
  const messages = ref<ChatMessage[]>([])
  const isStreaming = ref(false)
  const error = ref<string | null>(null)

  const sendMessage = async (content: string) => {
    error.value = null
    messages.value.push({ role: 'user', content })
    isStreaming.value = true

    // Add placeholder for assistant response
    messages.value.push({ role: 'assistant', content: '' })
    const assistantIndex = messages.value.length - 1

    try {
      const response = await fetch(`/api/games/${gameId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: messages.value.slice(0, -1), // exclude empty assistant placeholder
        }),
      })

      if (!response.ok) {
        const body = await response.json()
        throw new Error(body.error ?? `HTTP ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7)
          } else if (line.startsWith('data: ') && eventType) {
            const data = line.slice(6)
            if (eventType === 'text') {
              const chunk = JSON.parse(data) as string
              messages.value[assistantIndex].content += chunk
              onChunk?.(chunk)
            } else if (eventType === 'error') {
              error.value = JSON.parse(data)
            }
            eventType = ''
          }
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to send message'
      // Remove empty assistant message on error
      if (!messages.value[assistantIndex].content) {
        messages.value.splice(assistantIndex, 1)
      }
    } finally {
      isStreaming.value = false
    }
  }

  const clearChat = () => {
    messages.value = []
    error.value = null
  }

  return { messages, isStreaming, error, sendMessage, clearChat }
}
