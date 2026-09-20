// Accessibility polish for the Ant Design Vue widgets this app uses. The library's markup trips axe-core on a few
// WCAG rules (menu roles, combobox attributes, unnamed progress bars); rather than fork components, the layout runs
// this over the DOM and keeps it applied while the tree changes. Every rule here maps to a specific axe finding.

const fixMenu = (root) => {
  for (const menu of root.querySelectorAll('.ant-menu-root')) {
    menu.setAttribute('role', 'list')
    menu.setAttribute('aria-label', 'Main navigation')
  }
  for (const li of root.querySelectorAll('li.ant-menu-item, li.ant-menu-submenu')) li.setAttribute('role', 'listitem')
  for (const title of root.querySelectorAll('.ant-menu-submenu-title')) {
    title.setAttribute('role', 'button')
    title.setAttribute('tabindex', '0')
  }
  for (const sub of root.querySelectorAll('ul.ant-menu-sub')) sub.setAttribute('role', 'list')
  for (const popup of root.querySelectorAll('.ant-menu-submenu-popup ul, .ant-menu-submenu-hidden ul')) popup.setAttribute('role', 'none')
}

const fixSelects = (root) => {
  for (const input of root.querySelectorAll('.ant-select-selection-search-input[role="combobox"]')) {
    const select = input.closest('.ant-select')
    const open = !!select?.classList.contains('ant-select-open')
    input.setAttribute('aria-expanded', open ? 'true' : 'false')
    const active = input.getAttribute('aria-activedescendant')
    if (active && !document.getElementById(active)) input.removeAttribute('aria-activedescendant')
    if (!input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby')) {
      const label = select?.getAttribute('data-a11y-label')
        || select?.closest('.ant-form-item')?.querySelector('.ant-form-item-label label')?.textContent?.trim()
        || select?.querySelector('.ant-select-selection-item')?.textContent?.trim()
        || select?.querySelector('.ant-select-selection-placeholder')?.textContent?.trim()
        || 'Select'
      input.setAttribute('aria-label', label)
    }
  }
}

const fixProgress = (root) => {
  for (const bar of root.querySelectorAll('.ant-progress[role="progressbar"], .ant-progress')) {
    if (!bar.hasAttribute('aria-label')) bar.setAttribute('aria-label', bar.getAttribute('data-a11y-label') || 'Progress')
  }
}

const fixIconButtons = (root) => {
  for (const btn of root.querySelectorAll('button.ant-btn')) {
    if (btn.textContent.trim() || btn.hasAttribute('aria-label') || btn.hasAttribute('aria-labelledby')) continue
    const label = btn.getAttribute('title') || btn.closest('[title]')?.getAttribute('title') || btn.querySelector('[aria-label]')?.getAttribute('aria-label')
    if (label) btn.setAttribute('aria-label', label)
  }
}

// Ant Design only links <label for> to a control when the form item has a `name`; the demo forms bind with v-model
// instead, so the label text is copied onto the control. Inputs that only carry a placeholder get it as their name.
const fixFormFields = (root) => {
  for (const box of root.querySelectorAll('.ant-transfer-list-checkbox input[type=checkbox]:not([aria-label])')) {
    const row = box.closest('li[title]')
    box.setAttribute('aria-label', row ? 'Select ' + row.getAttribute('title') : 'Select all')
  }
  for (const box of root.querySelectorAll('input[type=checkbox]:not([aria-label]):not([aria-labelledby]), input[type=radio]:not([aria-label]):not([aria-labelledby])')) {
    const wrapper = box.closest('label')
    const textual = wrapper?.textContent?.trim()
    if (!textual) box.setAttribute('aria-label', box.closest('[title]')?.getAttribute('title') || 'Option')
  }
  for (const item of root.querySelectorAll('.ant-form-item')) {
    const label = item.querySelector('.ant-form-item-label label')?.textContent?.trim()
    if (!label) continue
    for (const control of item.querySelectorAll('input:not([type=hidden]), textarea, [role=slider], button.ant-switch, .ant-select-selection-search-input')) {
      if (!control.hasAttribute('aria-label') && !control.hasAttribute('aria-labelledby')) control.setAttribute('aria-label', label)
    }
  }
  for (const input of root.querySelectorAll('input[placeholder]:not([aria-label]):not([aria-labelledby]), textarea[placeholder]:not([aria-label])')) {
    if (!input.closest('label')) input.setAttribute('aria-label', input.getAttribute('placeholder'))
  }
}

export const applyA11y = (root = document) => {
  fixMenu(root)
  fixSelects(root)
  fixProgress(root)
  fixIconButtons(root)
  fixFormFields(root)
}

// Debounced observer: Ant Design re-renders menus and selects on every interaction.
export const watchA11y = (root = document.body) => {
  let timer = null
  const run = () => { clearTimeout(timer); timer = setTimeout(() => applyA11y(document), 50) }
  const observer = new MutationObserver(run)
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-activedescendant'] })
  run()
  return () => { clearTimeout(timer); observer.disconnect() }
}
