import { mount } from '@vue/test-utils'
import { useNotify } from '../composables/useNotify'
import NotificationList from './NotificationList.vue'

function setup() {
  const { notifications, notify, dismiss } = useNotify()
  notifications.value = []
  vi.useFakeTimers()
  return { notifications, notify, dismiss }
}

function teardown() {
  vi.advanceTimersByTime(10_000)
  vi.useRealTimers()
}

describe('NotificationList', () => {
  it('should render nothing when there are no notifications', () => {
    setup()
    const wrapper = mount(NotificationList)
    expect(wrapper.findAll('button')).toHaveLength(0)
    teardown()
  })

  it('should render a notification after notify is called', async () => {
    const { notify } = setup()
    notify('Hello world')
    const wrapper = mount(NotificationList)
    expect(wrapper.text()).toContain('Hello world')
    teardown()
  })

  it('should render multiple notifications', () => {
    const { notify } = setup()
    notify('First')
    notify('Second', 'error')
    const wrapper = mount(NotificationList)
    expect(wrapper.text()).toContain('First')
    expect(wrapper.text()).toContain('Second')
    teardown()
  })

  it('should dismiss a notification when the close button is clicked', async () => {
    const { notify } = setup()
    notify('Dismiss me')
    const wrapper = mount(NotificationList)

    await wrapper.find('button').trigger('click')
    expect(wrapper.text()).not.toContain('Dismiss me')
    teardown()
  })
})
