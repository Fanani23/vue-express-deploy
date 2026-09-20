// Stand-in for the template's `http` plugin: the three members the overlay uses, backed by plain variables.
import { vi } from 'vitest'

let tokens = {}
let options = {}

export const http = {
  getTokens: () => tokens,
  setTokens: (t) => { tokens = { ...tokens, ...t } },
  setOptions: (o) => { options = { ...options, ...o } },
  post: vi.fn(),
  // test helpers
  _reset: () => { tokens = {}; options = {}; http.post.mockReset() },
  _options: () => options,
}
