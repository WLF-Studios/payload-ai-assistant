import type { Config, WidgetInstance } from 'payload'

import { describe, expect, it } from 'vitest'

import type { StoredChatConfig } from './types.js'

import { aiAssistantPlugin, defaultModels, defaultQuickPrompts, placeWidget } from './index.js'

const layout = (...slugs: string[]) =>
  slugs.map((widgetSlug) => ({ widgetSlug, width: 'full' }) as WidgetInstance)

const order = (items: WidgetInstance[]) => items.map((w) => w.widgetSlug)

describe('placeWidget', () => {
  it('inserts before or after the collections widget', () => {
    expect(order(placeWidget(layout('a', 'collections'), 'chat', 'before-collections'))).toEqual([
      'a',
      'chat',
      'collections',
    ])
    expect(order(placeWidget(layout('collections', 'b'), 'chat', 'after-collections'))).toEqual([
      'collections',
      'chat',
      'b',
    ])
  })

  it('falls back to the start or end and never duplicates', () => {
    expect(order(placeWidget(layout('a'), 'chat', 'before-collections'))).toEqual(['chat', 'a'])
    expect(order(placeWidget(layout('a'), 'chat', 'after-collections'))).toEqual(['a', 'chat'])
    const existing = layout('chat', 'collections')
    expect(placeWidget(existing, 'chat', 'after-collections')).toBe(existing)
  })
})

describe('aiAssistantPlugin', () => {
  const stored = async (options: Parameters<typeof aiAssistantPlugin>[0]) => {
    const config = await aiAssistantPlugin(options)({} as Config)
    return config.custom?.['payload-ai-assistant'] as StoredChatConfig
  }

  it('applies the default models, quick prompts and read mode', async () => {
    expect(await stored({})).toMatchObject({
      defaultModel: defaultModels[0].id,
      mode: 'read',
      models: defaultModels,
      quickPrompts: defaultQuickPrompts,
    })
  })

  it('accepts a listed defaultModel', async () => {
    expect((await stored({ defaultModel: defaultModels[1].id })).defaultModel).toBe(
      defaultModels[1].id,
    )
  })

  it('throws on an unlisted defaultModel or an invalid mode, naming the value', () => {
    expect(() => aiAssistantPlugin({ defaultModel: 'x/unknown' })({} as Config)).toThrow(
      'defaultModel "x/unknown"',
    )
    expect(() => aiAssistantPlugin({ mode: 'write' as 'read' })({} as Config)).toThrow(
      /invalid mode "write"/,
    )
  })
})
