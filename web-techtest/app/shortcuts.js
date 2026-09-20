import { ref, shallowRef, onMounted, onBeforeUnmount } from 'vue'

// Keyboard shortcuts and the command palette (Ctrl/⌘ K). Commands are a registry: the layout registers the pages
// and global actions, a page adds its own while it is mounted (`useCommands`). Chords like `g t` are two keys
// pressed within a second. Nothing fires while the user is typing in a field, so shortcuts never eat input.
export const CHORD_WINDOW_MS = 1000
const commands = shallowRef([])
export const paletteOpen = ref(false)
export const helpOpen = ref(false)
let seq = 0

export const registerCommands = (list) => {
  const mine = list.map((c) => ({ ...c, _id: ++seq }))
  commands.value = [...commands.value, ...mine]
  return () => { commands.value = commands.value.filter((c) => !mine.includes(c)) }
}
export const allCommands = () => commands.value

// A page registers its commands for as long as it is mounted.
export const useCommands = (list) => {
  let off = null
  onMounted(() => { off = registerCommands(typeof list === 'function' ? list() : list) })
  onBeforeUnmount(() => { off?.() })
}

// Substring match on title and keywords, best first: title prefix > title contains > keyword contains. Empty query
// keeps the registry order.
export const matchCommands = (query, list = commands.value) => {
  const q = (query || '').trim().toLowerCase()
  if (!q) return list.slice()
  const score = (c) => {
    const title = c.title.toLowerCase()
    if (title.startsWith(q)) return 3
    if (title.includes(q)) return 2
    if ((c.keywords || []).some((k) => k.toLowerCase().includes(q))) return 1
    return q.split(/\s+/).every((w) => title.includes(w)) ? 1 : 0
  }
  return list.map((c) => [score(c), c]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).map(([, c]) => c)
}

export const isTyping = (target) => {
  if (!target || !(target instanceof Element)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target.closest('.ant-select, .ant-picker, [role="combobox"], [role="listbox"]')
}

// Turns a keydown into a shortcut key: "mod+k", "?", "g" … (mod = Ctrl, or ⌘ on a Mac)
export const keyOf = (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
  const mod = e.ctrlKey || e.metaKey
  if (mod) return 'mod+' + key
  if (e.altKey) return null
  return e.key.length === 1 ? e.key : key // keep "?" and case-sensitive singles
}

// Resolves single keys and two-key chords against the registered commands' `keys` (e.g. ['g', 't'] or ['n']).
export const createChordMatcher = (now = () => Date.now()) => {
  let pending = null
  let at = 0
  return (key) => {
    const list = commands.value
    const fresh = pending && now() - at <= CHORD_WINDOW_MS ? pending : null
    if (fresh) {
      const two = list.find((c) => c.keys && c.keys.length === 2 && c.keys[0] === fresh && c.keys[1] === key)
      pending = null
      if (two) return two
    }
    const one = list.find((c) => c.keys && c.keys.length === 1 && c.keys[0] === key)
    if (one) { pending = null; return one }
    const startsChord = list.some((c) => c.keys && c.keys.length === 2 && c.keys[0] === key)
    pending = startsChord ? key : null
    at = now()
    return null
  }
}

export const installShortcuts = (run) => {
  const match = createChordMatcher()
  const onKey = (e) => {
    const key = keyOf(e)
    if (!key) return
    if (key === 'mod+k') { e.preventDefault(); paletteOpen.value = !paletteOpen.value; return }
    if (paletteOpen.value || helpOpen.value || isTyping(e.target)) return
    if (key === '?') { e.preventDefault(); helpOpen.value = true; return }
    const command = match(key)
    if (command) { e.preventDefault(); run(command) }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}

export const keyLabel = (keys) => (keys || []).map((k) => (k === 'mod+k' ? (navigator.platform?.includes('Mac') ? '⌘ K' : 'Ctrl K') : k)).join(' ')
