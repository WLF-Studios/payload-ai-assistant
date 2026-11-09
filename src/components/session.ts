import type { UIMessage } from 'ai'

import { PLUGIN_SLUG } from '../defaults.js'

const PREFIX = `${PLUGIN_SLUG}:`

export const storageKey = (user: { collection: string; id: number | string }) =>
  `${PREFIX}${user.collection}:${user.id}`

export function loadMessages(key: string): UIMessage[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(key) ?? '[]')
    return Array.isArray(parsed) ? (parsed as UIMessage[]) : []
  } catch {
    return []
  }
}

export function saveMessages(key: string, messages: UIMessage[]): void {
  try {
    if (messages.length) {
      sessionStorage.setItem(key, JSON.stringify(messages))
    } else {
      sessionStorage.removeItem(key)
    }
  } catch {
    // quota exceeded or storage unavailable
  }
}

export function clearStoredChats(): void {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index)
      if (key?.startsWith(PREFIX)) {
        sessionStorage.removeItem(key)
      }
    }
  } catch {
    // storage unavailable
  }
}
