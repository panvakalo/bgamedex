import { ref, onUnmounted } from 'vue'

const SENTENCE_RE = /[.!?]\s+/

export function useVoiceOutput() {
  const isSpeaking = ref(false)
  const speakingMessageIndex = ref<number | null>(null)

  let buffer = ''
  let queue: string[] = []
  let speaking = false
  let stopped = false

  const speakNext = () => {
    if (stopped || queue.length === 0) {
      if (queue.length === 0 && buffer === '') {
        speaking = false
        isSpeaking.value = false
        speakingMessageIndex.value = null
      }
      return
    }

    speaking = true
    const text = queue.shift()!
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.onend = () => speakNext()
    utterance.onerror = () => speakNext()
    window.speechSynthesis.speak(utterance)
  }

  /** Feed a new chunk of streamed text. Sentences are split off and queued for speech. */
  const feedChunk = (chunk: string, messageIndex: number) => {
    if (stopped) return

    if (!isSpeaking.value) {
      isSpeaking.value = true
      speakingMessageIndex.value = messageIndex
    }

    buffer += chunk

    // Split on sentence boundaries — keep the last partial sentence in the buffer
    const parts = buffer.split(SENTENCE_RE)
    if (parts.length > 1) {
      // All but the last part are complete sentences
      for (let i = 0; i < parts.length - 1; i++) {
        const sentence = parts[i].trim()
        if (sentence) queue.push(sentence)
      }
      buffer = parts[parts.length - 1]
    }

    // Start speaking if not already
    if (!speaking && queue.length > 0) {
      speakNext()
    }
  }

  /** Call when streaming is done to flush any remaining buffered text. */
  const flushBuffer = () => {
    if (stopped) return
    const remaining = buffer.trim()
    buffer = ''
    if (remaining) {
      queue.push(remaining)
    }
    if (!speaking && queue.length > 0) {
      speakNext()
    }
  }

  /** Speak a complete text all at once (for the manual speaker button). */
  const speak = (text: string, messageIndex: number) => {
    if (isSpeaking.value && speakingMessageIndex.value === messageIndex) {
      stop()
      return
    }

    stop()
    stopped = false
    isSpeaking.value = true
    speakingMessageIndex.value = messageIndex

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.onend = () => cleanup()
    utterance.onerror = () => cleanup()
    window.speechSynthesis.speak(utterance)
  }

  const cleanup = () => {
    isSpeaking.value = false
    speakingMessageIndex.value = null
    speaking = false
    buffer = ''
    queue = []
  }

  const stop = () => {
    stopped = true
    window.speechSynthesis.cancel()
    cleanup()
    stopped = false
  }

  /** Begin a new streaming session (resets state). */
  const startStreaming = (messageIndex: number) => {
    stop()
    stopped = false
    speakingMessageIndex.value = messageIndex
  }

  onUnmounted(() => {
    if (isSpeaking.value) {
      stop()
    }
  })

  return { isSpeaking, speakingMessageIndex, speak, stop, feedChunk, flushBuffer, startStreaming }
}
