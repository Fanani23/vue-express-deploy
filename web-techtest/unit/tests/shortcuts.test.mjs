import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The registry, the matcher and the chord logic are plain functions; the palette component is exercised end-to-end.
let mod
beforeEach(async () => { vi.resetModules(); mod = await import('../../app/shortcuts.js') })
afterEach(() => { vi.useRealTimers() })

describe('command registry and matching', () => {
  it('ranks title prefix over contains over keywords, and unregisters a page\'s commands', () => {
    const off = mod.registerCommands([
      { id: 'tasks', title: 'Go to Tasks', keywords: ['page'] },
      { id: 'theme', title: 'Toggle theme', keywords: ['dark'] },
      { id: 'new', title: 'New task', keywords: ['add'] },
    ])
    expect(mod.matchCommands('').map((c) => c.id)).toEqual(['tasks', 'theme', 'new'])
    expect(mod.matchCommands('new').map((c) => c.id)).toEqual(['new'])
    expect(mod.matchCommands('task').map((c) => c.id)).toEqual(['tasks', 'new'])
    expect(mod.matchCommands('dark').map((c) => c.id)).toEqual(['theme'])
    expect(mod.matchCommands('go tasks').map((c) => c.id)).toEqual(['tasks'])
    expect(mod.matchCommands('zzz')).toEqual([])
    off()
    expect(mod.allCommands()).toEqual([])
  })
  it('resolves single keys and two-key chords within a second', () => {
    mod.registerCommands([{ id: 'd', title: 'Dashboard', keys: ['g', 'd'] }, { id: 't', title: 'Tasks', keys: ['g', 't'] }, { id: 'n', title: 'New', keys: ['n'] }])
    let now = 1000
    const match = mod.createChordMatcher(() => now)
    expect(match('n')?.id).toBe('n')
    expect(match('g')).toBeNull()
    now += 400
    expect(match('t')?.id).toBe('t')
    expect(match('g')).toBeNull()
    now += 1500 // too late
    expect(match('d')).toBeNull()
    expect(match('x')).toBeNull()
  })
  it('never fires while typing, and maps modifier keys', () => {
    const input = document.createElement('input')
    expect(mod.isTyping(input)).toBe(true)
    expect(mod.isTyping(document.createElement('div'))).toBe(false)
    expect(mod.keyOf({ key: 'K', ctrlKey: true })).toBe('mod+k')
    expect(mod.keyOf({ key: 'k', metaKey: true })).toBe('mod+k')
    expect(mod.keyOf({ key: '?' })).toBe('?')
    expect(mod.keyOf({ key: 'g', altKey: true })).toBeNull()
  })
  it('installShortcuts opens the palette on mod+k and runs a chord', () => {
    const ran = []
    mod.registerCommands([{ id: 't', title: 'Tasks', keys: ['g', 't'] }])
    const off = mod.installShortcuts((c) => ran.push(c.id))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }))
    expect(ran).toEqual(['t'])
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    expect(mod.paletteOpen.value).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }))
    expect(ran).toEqual(['t']) // nothing while the palette is open
    off()
  })
})
