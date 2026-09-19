import { ref, computed, watchEffect } from 'vue'

const KEY = 'theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

const read = () => {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

const preference = ref(read())
const systemDark = ref(media.matches)
media.addEventListener('change', (e) => { systemDark.value = e.matches })

const isDark = computed(() => (preference.value ? preference.value === 'dark' : systemDark.value))

watchEffect(() => {
  const t = isDark.value ? 'dark' : 'light'
  document.documentElement.dataset.theme = t
  document.documentElement.style.colorScheme = t
})

const set = (value) => {
  preference.value = value
  try {
    if (value) localStorage.setItem(KEY, value)
    else localStorage.removeItem(KEY)
  } catch { }
}

export const useTheme = () => ({
  isDark,
  preference,
  set,
  toggle: () => set(isDark.value ? 'light' : 'dark')
})
