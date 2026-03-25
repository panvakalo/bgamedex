import { useNotify } from './useNotify'

function setup() {
  const ctx = useNotify()
  ctx.notifications.value = []
  vi.useFakeTimers()
  return ctx
}

function teardown() {
  vi.advanceTimersByTime(10_000)
  vi.useRealTimers()
}

describe('useNotify', () => {
  it('should add a success notification by default', () => {
    const { notify, notifications } = setup()
    notify('Saved!')
    expect(notifications.value).toHaveLength(1)
    expect(notifications.value[0]).toMatchObject({ message: 'Saved!', type: 'success' })
    teardown()
  })

  it('should add an error notification when type is error', () => {
    const { notify, notifications } = setup()
    notify('Something failed', 'error')
    expect(notifications.value).toHaveLength(1)
    expect(notifications.value[0]).toMatchObject({ message: 'Something failed', type: 'error' })
    teardown()
  })

  it('should auto-dismiss after 4 seconds', () => {
    const { notify, notifications } = setup()
    notify('Temporary')
    expect(notifications.value).toHaveLength(1)

    vi.advanceTimersByTime(4000)
    expect(notifications.value).toHaveLength(0)
    teardown()
  })

  it('should dismiss a notification by id', () => {
    const { notify, dismiss, notifications } = setup()
    notify('First')
    notify('Second')
    const firstId = notifications.value[0].id

    dismiss(firstId)
    expect(notifications.value).toHaveLength(1)
    expect(notifications.value[0].message).toBe('Second')
    teardown()
  })

  it('should assign unique ids to each notification', () => {
    const { notify, notifications } = setup()
    notify('A')
    notify('B')
    notify('C')
    const ids = notifications.value.map((n) => n.id)
    expect(new Set(ids).size).toBe(3)
    teardown()
  })
})
