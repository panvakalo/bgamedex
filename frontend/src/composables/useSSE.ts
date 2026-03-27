import { watch } from 'vue'
import { useAuth } from './useAuth'
import { useNotify } from './useNotify'
import { useFriends } from './useFriends'

let eventSource: EventSource | null = null

export function useSSE() {
  const { isAuthenticated } = useAuth()
  const { notify } = useNotify()
  const { pendingCount, fetchFriends, fetchPendingRequests } = useFriends()

  function connect() {
    if (eventSource) return

    eventSource = new EventSource('/api/events')

    eventSource.addEventListener('friend_request', (e) => {
      const data = JSON.parse(e.data)
      pendingCount.value++
      fetchPendingRequests()
      notify(`${data.requesterName} sent you a friend request`, 'info')
    })

    eventSource.addEventListener('friend_accepted', (e) => {
      const data = JSON.parse(e.data)
      fetchFriends()
      notify(`You and ${data.friendName} are now friends!`, 'success')
    })

    eventSource.addEventListener('friend_removed', () => {
      fetchFriends()
    })
  }

  function disconnect() {
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
  }

  watch(isAuthenticated, (authed) => {
    if (authed) {
      connect()
    } else {
      disconnect()
    }
  }, { immediate: true })
}
