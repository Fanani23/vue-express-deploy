<template>
  <a-tooltip :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'" placement="bottomRight">
    <button
      type="button"
      class="theme-toggle"
      data-cy="theme"
      :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      :aria-pressed="isDark"
      @click="toggle"
    >
      <transition name="theme-toggle__swap" mode="out-in">
        <svg v-if="isDark" key="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
        <svg v-else key="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      </transition>
    </button>
  </a-tooltip>
</template>

<script setup>
import { useTheme } from '../theme.js'

const { isDark, toggle } = useTheme()
</script>

<style scoped>
.theme-toggle {
  --tt-bg: #ffffff;
  --tt-fg: #5f6672;
  --tt-fg-hover: #1a1d21;
  --tt-border: #e3e6eb;
  --tt-shadow: 0 1px 2px rgb(15 23 42 / 0.06), 0 4px 16px rgb(15 23 42 / 0.08);

  width: 2.5rem; height: 2.5rem; padding: 0;
  display: inline-grid; place-items: center;
  border: 1px solid var(--tt-border); border-radius: 999px;
  background: var(--tt-bg); color: var(--tt-fg);
  box-shadow: var(--tt-shadow);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}
:root[data-theme="dark"] .theme-toggle {
  --tt-bg: #171b21;
  --tt-fg: #9aa3b0;
  --tt-fg-hover: #e6e9ee;
  --tt-border: #2b323c;
  --tt-shadow: 0 1px 2px rgb(0 0 0 / 0.4), 0 4px 16px rgb(0 0 0 / 0.35);
}
.theme-toggle:hover { color: var(--tt-fg-hover); transform: translateY(-1px); }
.theme-toggle:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }
.theme-toggle svg { width: 1.15rem; height: 1.15rem; }

.theme-toggle__swap-enter-active, .theme-toggle__swap-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.theme-toggle__swap-enter-from { opacity: 0; transform: rotate(-40deg) scale(0.8); }
.theme-toggle__swap-leave-to { opacity: 0; transform: rotate(40deg) scale(0.8); }
@media (prefers-reduced-motion: reduce) {
  .theme-toggle, .theme-toggle__swap-enter-active, .theme-toggle__swap-leave-active { transition: none; }
}
</style>
