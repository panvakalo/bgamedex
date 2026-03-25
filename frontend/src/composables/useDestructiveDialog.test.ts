import { useDestructiveDialog } from './useDestructiveDialog'

describe('useDestructiveDialog', () => {
  beforeEach(() => {
    const { onCancel, dialog } = useDestructiveDialog()
    if (dialog.value.open) onCancel()
  })

  it('should start with dialog closed', () => {
    const { dialog } = useDestructiveDialog()
    expect(dialog.value.open).toBe(false)
  })

  it('should open dialog with default options', () => {
    const { confirmDestructive, dialog } = useDestructiveDialog()
    confirmDestructive()

    expect(dialog.value.open).toBe(true)
    expect(dialog.value.title).toBe('Are you sure?')
    expect(dialog.value.message).toBe('This action cannot be undone.')
    expect(dialog.value.confirmLabel).toBe('Delete')
  })

  it('should open dialog with custom options', () => {
    const { confirmDestructive, dialog } = useDestructiveDialog()
    confirmDestructive({ title: 'Remove game?', message: 'This will delete all plays.', confirmLabel: 'Remove' })

    expect(dialog.value.title).toBe('Remove game?')
    expect(dialog.value.message).toBe('This will delete all plays.')
    expect(dialog.value.confirmLabel).toBe('Remove')
  })

  it('should resolve true on confirm', async () => {
    const { confirmDestructive, onConfirm, dialog } = useDestructiveDialog()
    const promise = confirmDestructive()

    onConfirm()
    await expect(promise).resolves.toBe(true)
    expect(dialog.value.open).toBe(false)
  })

  it('should resolve false on cancel', async () => {
    const { confirmDestructive, onCancel, dialog } = useDestructiveDialog()
    const promise = confirmDestructive()

    onCancel()
    await expect(promise).resolves.toBe(false)
    expect(dialog.value.open).toBe(false)
  })
})
