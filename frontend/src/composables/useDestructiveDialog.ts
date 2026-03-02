import { ref } from 'vue'

interface DestructiveDialogOptions {
  title?: string
  message?: string
  confirmLabel?: string
}

interface DestructiveDialogState {
  open: boolean
  title: string
  message: string
  confirmLabel: string
}

const dialog = ref<DestructiveDialogState>({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Delete',
})

let resolvePending: ((value: boolean) => void) | null = null

export function useDestructiveDialog() {
  const confirmDestructive = (opts: DestructiveDialogOptions = {}): Promise<boolean> => {
    dialog.value = {
      open: true,
      title: opts.title ?? 'Are you sure?',
      message: opts.message ?? 'This action cannot be undone.',
      confirmLabel: opts.confirmLabel ?? 'Delete',
    }
    return new Promise<boolean>((resolve) => {
      resolvePending = resolve
    })
  }

  const onConfirm = () => {
    dialog.value.open = false
    resolvePending?.(true)
    resolvePending = null
  }

  const onCancel = () => {
    dialog.value.open = false
    resolvePending?.(false)
    resolvePending = null
  }

  return { dialog, confirmDestructive, onConfirm, onCancel }
}
