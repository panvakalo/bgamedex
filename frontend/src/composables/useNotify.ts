import { ref } from 'vue'

export interface Notification {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

let nextId = 0
const notifications = ref<Notification[]>([])

export function useNotify() {
  const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = nextId++
    notifications.value.push({ id, message, type })
    setTimeout(() => dismiss(id), 4000)
  }

  const dismiss = (id: number) => {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }

  return { notifications, notify, dismiss }
}
