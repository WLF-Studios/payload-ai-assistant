import type { UIMessage } from 'ai'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearStoredChats, loadMessages, saveMessages, storageKey } from './session.js'

function memoryStorage(): Storage {
  const items = new Map<string, string>()
  return {
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    get length() {
      return items.size
    },
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  }
}

const message = { id: 'm1', parts: [{ type: 'text', text: 'hi' }], role: 'user' } as UIMessage

describe('session storage', () => {
  beforeEach(() => vi.stubGlobal('sessionStorage', memoryStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('keys by user collection and id', () => {
    expect(storageKey({ id: 7, collection: 'users' })).toBe('payload-ai-assistant:users:7')
  })

  it('round-trips messages and removes the key when empty', () => {
    const key = storageKey({ id: 'a', collection: 'admins' })
    saveMessages(key, [message])
    expect(loadMessages(key)).toEqual([message])
    saveMessages(key, [])
    expect(sessionStorage.getItem(key)).toBeNull()
  })

  it('ignores corrupt data and missing storage', () => {
    sessionStorage.setItem('payload-ai-assistant:users:1', '{nope')
    expect(loadMessages('payload-ai-assistant:users:1')).toEqual([])
    vi.unstubAllGlobals()
    expect(loadMessages('payload-ai-assistant:users:1')).toEqual([])
  })

  it('clears only plugin keys', () => {
    sessionStorage.setItem('payload-ai-assistant:users:1', '[]')
    sessionStorage.setItem('payload-ai-assistant:users:2', '[]')
    sessionStorage.setItem('other', 'x')
    clearStoredChats()
    expect(sessionStorage.length).toBe(1)
    expect(sessionStorage.getItem('other')).toBe('x')
  })
})
