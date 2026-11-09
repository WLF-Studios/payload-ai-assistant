import { describe, expect, it } from 'vitest'

import { resolveMode } from './mode.js'

describe('resolveMode', () => {
  it('defaults to read', () => {
    expect(resolveMode(undefined)).toBe('read')
  })

  it('accepts read and full', () => {
    expect(resolveMode('read')).toBe('read')
    expect(resolveMode('full')).toBe('full')
  })

  it('throws on anything else and names the value', () => {
    expect(() => resolveMode('write')).toThrow(/invalid mode "write"/)
  })
})
