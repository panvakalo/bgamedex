import { ref, onUnmounted } from 'vue'

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent {
  error: string
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as SpeechRecognitionConstructor | null
}

export function useVoiceInput() {
  const isSupported = ref(getSpeechRecognition() !== null)
  const isListening = ref(false)
  const transcript = ref('')

  let recognition: SpeechRecognitionInstance | null = null
  let resolveStop: ((text: string) => void) | null = null

  const startListening = () => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) return

    recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = ''
      let interimText = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }
      transcript.value = finalText + interimText
    }

    recognition.onend = () => {
      isListening.value = false
      if (resolveStop) {
        resolveStop(transcript.value)
        resolveStop = null
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'aborted') {
        console.error('Speech recognition error:', event.error)
      }
      isListening.value = false
      if (resolveStop) {
        resolveStop(transcript.value)
        resolveStop = null
      }
    }

    transcript.value = ''
    isListening.value = true
    recognition.start()
  }

  const stopListening = (): Promise<string> => {
    return new Promise((resolve) => {
      if (!recognition || !isListening.value) {
        resolve(transcript.value)
        return
      }
      resolveStop = resolve
      recognition.stop()
    })
  }

  onUnmounted(() => {
    if (recognition && isListening.value) {
      recognition.abort()
    }
  })

  return { isSupported, isListening, transcript, startListening, stopListening }
}
