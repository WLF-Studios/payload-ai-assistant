import { describe, expect, it } from 'vitest'

import { resolveDefaultModel, resolveProvider, validateModel } from './model.js'

const models = [
  { id: 'a/one', label: 'One' },
  { id: 'b/two', label: 'Two' },
]

describe('resolveDefaultModel', () => {
  it('uses the given id or the first entry', () => {
    expect(resolveDefaultModel(models, 'b/two')).toBe('b/two')
    expect(resolveDefaultModel(models, undefined)).toBe('a/one')
  })

  it('throws when the id is not listed or the list is empty', () => {
    expect(() => resolveDefaultModel(models, 'z/other')).toThrow(/defaultModel "z\/other"/)
    expect(() => resolveDefaultModel([], undefined)).toThrow(/not in models/)
  })
})

describe('resolveProvider', () => {
  const provider = (modelId: string) => ({ modelId }) as never

  it('throws when apiKey and provider are both set', () => {
    expect(() => resolveProvider({ apiKey: 'k', models, provider })).toThrow(
      'payload-ai-assistant: pass apiKey or provider, not both.',
    )
  })

  it('throws when a provider comes without models', () => {
    expect(() => resolveProvider({ provider })).toThrow(/provider needs models/)
  })

  it('returns the given provider as is', () => {
    expect(resolveProvider({ models, provider })).toBe(provider)
  })

  it('builds the OpenRouter provider from apiKey', () => {
    const resolved = resolveProvider({ apiKey: 'k' })
    expect(resolved?.('a/one')).toMatchObject({ modelId: 'a/one' })
  })

  it('returns undefined without apiKey or provider', () => {
    expect(resolveProvider({})).toBeUndefined()
  })
})

describe('validateModel', () => {
  it('uses the default when the request names no model', () => {
    expect(validateModel(models, undefined, 'b/two')).toBe('b/two')
    expect(validateModel(models, null, 'b/two')).toBe('b/two')
  })

  it('accepts a listed model', () => {
    expect(validateModel(models, 'b/two', 'a/one')).toBe('b/two')
  })

  it('rejects a model outside the list', () => {
    expect(() => validateModel(models, 'c/three', 'a/one')).toThrow('Unknown model.')
    expect(() => validateModel(models, 42, 'a/one')).toThrow('Unknown model.')
  })
})
