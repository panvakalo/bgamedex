import { ref, onMounted } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa-install-dismissed'

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const canInstall = ref(false)
const dismissed = ref(localStorage.getItem(DISMISS_KEY) === 'true')

let listenerAttached = false

export function usePwaInstall() {
  onMounted(() => {
    if (listenerAttached) return
    listenerAttached = true

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      deferredPrompt.value = e as BeforeInstallPromptEvent
      if (!dismissed.value) {
        canInstall.value = true
      }
    })

    window.addEventListener('appinstalled', () => {
      canInstall.value = false
      deferredPrompt.value = null
    })
  })

  async function install() {
    if (!deferredPrompt.value) return
    await deferredPrompt.value.prompt()
    const { outcome } = await deferredPrompt.value.userChoice
    if (outcome === 'accepted') {
      canInstall.value = false
    }
    deferredPrompt.value = null
  }

  function dismiss() {
    canInstall.value = false
    dismissed.value = true
    localStorage.setItem(DISMISS_KEY, 'true')
  }

  return { canInstall, install, dismiss }
}
