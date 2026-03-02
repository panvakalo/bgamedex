import { ref } from 'vue'

const active = ref(false)

export function useFireworks() {
  const fire = () => {
    active.value = true
  }

  const done = () => {
    active.value = false
  }

  return { active, fire, done }
}
