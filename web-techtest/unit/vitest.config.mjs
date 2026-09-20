import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// The modules under test import the template's fetch plugin (`../common/plugins/fetch.js`), which is not part of
// this repo; the alias points that import at a small in-memory stand-in with the same surface. `app/` has no
// node_modules of its own either, so 'vue' resolves from this folder's install.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^(.*)\/common\/plugins\/fetch\.js$/, replacement: fileURLToPath(new URL('./mocks/fetch.js', import.meta.url)) },
      { find: /^vue$/, replacement: fileURLToPath(new URL('./node_modules/vue/dist/vue.runtime.esm-bundler.js', import.meta.url)) },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.mjs'],
    coverage: {
      provider: 'v8',
      include: ['**/app/session.js', '**/app/taskpulse.js', '**/app/users.js'],
      allowExternal: true,
      reporter: ['text', 'json-summary'],
      thresholds: { lines: 80, functions: 70 },
    },
    env: {
      VITE_TASKPULSE_URL: 'http://taskpulse.test',
      VITE_REFRESH_URL: '/api/auth/refresh',
      VITE_IDLE_LIMIT_SECONDS: '1800',
    },
  },
})
