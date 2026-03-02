<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useRulesChat } from '../composables/useRulesChat'
import { useVoiceInput } from '../composables/useVoiceInput'
import { useVoiceOutput } from '../composables/useVoiceOutput'

marked.setOptions({ breaks: true })

const props = defineProps<{
  gameId: number
  gameTitle: string
  hasRules: boolean
  preparing: boolean
  rulesSource: 'rules' | 'description' | 'unavailable' | null
}>()

const { isSpeaking, speakingMessageIndex, speak, stop: stopSpeaking, feedChunk, flushBuffer, startStreaming } = useVoiceOutput()

const voiceTriggered = ref(false)

const onChunk = (text: string) => {
  if (voiceTriggered.value) {
    feedChunk(text, messages.value.length - 1)
  }
}

const { messages, isStreaming, error, sendMessage, clearChat } = useRulesChat(props.gameId, onChunk)
const { isSupported: micSupported, isListening, transcript, startListening, stopListening } = useVoiceInput()

const input = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

watch(() => messages.value.length, scrollToBottom)
watch(
  () => messages.value[messages.value.length - 1]?.content,
  scrollToBottom
)

// Sync live transcript into input field
watch(transcript, (text) => {
  if (isListening.value) {
    input.value = text
  }
})

// Flush remaining buffered text when streaming ends
watch(isStreaming, (streaming, wasStreaming) => {
  if (wasStreaming && !streaming && voiceTriggered.value) {
    voiceTriggered.value = false
    flushBuffer()
  }
})

const handleSend = () => {
  const text = input.value.trim()
  if (!text || isStreaming.value) return
  input.value = ''
  sendMessage(text)
}

const toggleMic = async () => {
  if (isListening.value) {
    const text = await stopListening()
    if (text.trim()) {
      input.value = ''
      voiceTriggered.value = true
      sendMessage(text.trim())
    }
  } else {
    stopSpeaking()
    input.value = ''
    startListening()
  }
}

const handleSpeak = (text: string, index: number) => {
  speak(text, index)
}

const renderedMessages = computed(() =>
  messages.value.map((msg) => ({
    ...msg,
    html: msg.role === 'assistant' ? DOMPurify.sanitize(marked.parse(msg.content) as string) : '',
  }))
)
</script>

<template>
  <div class="rounded-xl border border-surface-lighter bg-surface-light">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-surface-lighter">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-accent-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <h3 class="text-sm font-semibold text-text-primary">Ask about the rules</h3>
      </div>
      <button
        v-if="messages.length"
        @click="clearChat"
        class="text-xs text-text-muted hover:text-text-secondary transition-colors"
      >
        Clear
      </button>
    </div>

    <!-- Disabled state -->
    <div v-if="!hasRules" class="px-4 py-8 text-center">
      <p class="text-sm text-text-muted">No rules or description available for this game.</p>
    </div>

    <!-- Preparing rules -->
    <div v-else-if="preparing" class="px-4 py-8 flex flex-col items-center gap-2">
      <div class="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      <p class="text-sm text-text-muted">Loading rules...</p>
    </div>

    <!-- Chat area -->
    <template v-else>
      <!-- Messages -->
      <div ref="messagesContainer" class="h-80 overflow-y-auto px-4 py-3 space-y-3">
        <div v-if="!messages.length" class="flex flex-col items-center justify-center h-full gap-1">
          <p class="text-sm text-text-muted">Ask a question about {{ gameTitle }}'s rules</p>
          <p v-if="rulesSource === 'description'" class="text-xs text-text-muted/60">Based on game description — no rules PDF found</p>
        </div>

        <div
          v-for="(msg, i) in renderedMessages"
          :key="i"
          :class="[
            'max-w-[85%] rounded-lg px-3 py-2 text-sm',
            msg.role === 'user'
              ? 'ml-auto bg-accent/20 text-accent-light'
              : 'bg-surface-lighter/50 text-text-secondary',
          ]"
        >
          <p v-if="msg.role === 'user'" class="whitespace-pre-wrap">{{ msg.content }}</p>
          <div v-else class="prose-chat" v-html="msg.html" />
          <span v-if="msg.role === 'assistant' && isStreaming && i === renderedMessages.length - 1" class="inline-block w-1.5 h-4 bg-accent-light animate-pulse ml-0.5 align-text-bottom" />
          <!-- Speaker button for assistant messages -->
          <button
            v-if="msg.role === 'assistant' && msg.content && !(isStreaming && i === messages.length - 1)"
            @click="handleSpeak(msg.content, i)"
            class="mt-1.5 flex items-center gap-1 text-text-muted hover:text-accent-light transition-colors"
            :title="isSpeaking && speakingMessageIndex === i ? 'Stop playback' : 'Read aloud'"
          >
            <!-- Speaker icon (static) -->
            <svg
              v-if="!(isSpeaking && speakingMessageIndex === i)"
              class="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8.5H4a1 1 0 00-1 1v5a1 1 0 001 1h2.5l4 4V4.5l-4 4z" />
            </svg>
            <!-- Animated bars (playing) -->
            <svg
              v-else
              class="w-3.5 h-3.5 text-accent-light"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <rect x="1" y="4" width="2" height="8" rx="0.5">
                <animate attributeName="height" values="8;12;8" dur="0.6s" repeatCount="indefinite" />
                <animate attributeName="y" values="4;2;4" dur="0.6s" repeatCount="indefinite" />
              </rect>
              <rect x="5" y="2" width="2" height="12" rx="0.5">
                <animate attributeName="height" values="12;6;12" dur="0.5s" repeatCount="indefinite" />
                <animate attributeName="y" values="2;5;2" dur="0.5s" repeatCount="indefinite" />
              </rect>
              <rect x="9" y="5" width="2" height="6" rx="0.5">
                <animate attributeName="height" values="6;12;6" dur="0.7s" repeatCount="indefinite" />
                <animate attributeName="y" values="5;2;5" dur="0.7s" repeatCount="indefinite" />
              </rect>
              <rect x="13" y="3" width="2" height="10" rx="0.5">
                <animate attributeName="height" values="10;6;10" dur="0.55s" repeatCount="indefinite" />
                <animate attributeName="y" values="3;5;3" dur="0.55s" repeatCount="indefinite" />
              </rect>
            </svg>
          </button>
        </div>
      </div>

      <!-- Error -->
      <div v-if="error" class="px-4 pb-2">
        <p class="text-xs text-negative">{{ error }}</p>
      </div>

      <!-- Input -->
      <div class="flex gap-2 px-4 py-3 border-t border-surface-lighter">
        <!-- Mic button -->
        <button
          v-if="micSupported"
          @click="toggleMic"
          :disabled="isStreaming"
          :class="[
            'px-2.5 py-2 rounded-lg text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed',
            isListening
              ? 'bg-red-500/20 text-red-400 animate-pulse'
              : 'bg-surface text-text-muted hover:text-text-secondary hover:bg-surface-lighter',
          ]"
          :title="isListening ? 'Stop recording' : 'Voice input'"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
        </button>

        <input
          v-model="input"
          @keydown.enter="handleSend"
          :disabled="isStreaming"
          type="text"
          :placeholder="isListening ? 'Listening...' : 'Ask about the rules...'"
          class="flex-1 bg-surface rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted border border-surface-lighter focus:border-accent focus:outline-none"
        />
        <button
          @click="handleSend"
          :disabled="isStreaming || !input.trim()"
          class="px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.prose-chat :deep(p) {
  margin: 0.25em 0;
}
.prose-chat :deep(p:first-child) {
  margin-top: 0;
}
.prose-chat :deep(p:last-child) {
  margin-bottom: 0;
}
.prose-chat :deep(ul),
.prose-chat :deep(ol) {
  margin: 0.4em 0;
  padding-left: 1.4em;
}
.prose-chat :deep(li) {
  margin: 0.15em 0;
}
.prose-chat :deep(strong) {
  color: var(--color-text-primary, #fff);
  font-weight: 600;
}
.prose-chat :deep(em) {
  font-style: italic;
}
.prose-chat :deep(code) {
  background: rgba(255, 255, 255, 0.08);
  padding: 0.1em 0.35em;
  border-radius: 0.25em;
  font-size: 0.9em;
}
.prose-chat :deep(blockquote) {
  border-left: 2px solid var(--color-accent, #6366f1);
  padding-left: 0.75em;
  margin: 0.4em 0;
  opacity: 0.85;
}
.prose-chat :deep(h1),
.prose-chat :deep(h2),
.prose-chat :deep(h3) {
  font-weight: 600;
  margin: 0.5em 0 0.25em;
  color: var(--color-text-primary, #fff);
}
.prose-chat :deep(h1) { font-size: 1.1em; }
.prose-chat :deep(h2) { font-size: 1.05em; }
.prose-chat :deep(h3) { font-size: 1em; }
</style>
