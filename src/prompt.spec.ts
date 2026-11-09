import { describe, expect, it } from 'vitest'

import { buildSystemPrompt } from './prompt.js'

const now = new Date('2026-11-05T12:00:00Z')

describe('buildSystemPrompt', () => {
  it('states the read-only mode, the date and the site context', () => {
    const prompt = buildSystemPrompt({ instructions: ' Ski resort site. ', mode: 'read', now })
    expect(prompt).toContain('You cannot change content')
    expect(prompt).not.toContain('saved as a draft')
    expect(prompt).toContain('Today is 2026-11-05.')
    expect(prompt.endsWith('Site context:\nSki resort site.')).toBe(true)
  })

  it('states drafts and approval in full mode and lists locales', () => {
    const prompt = buildSystemPrompt({
      localization: { defaultLocale: 'base', localeCodes: ['base', 'winter'] },
      mode: 'full',
      now,
    })
    expect(prompt).toContain("saved as a draft and needs the user's approval")
    expect(prompt).toContain('Locale codes: base, winter. Default locale: base.')
    expect(prompt).not.toContain('Site context')
  })

  it('puts the knowledge file before the inline instructions', () => {
    const prompt = buildSystemPrompt({
      instructions: 'Inline note.',
      knowledge: '# Facts\n',
      mode: 'read',
      now,
    })
    expect(prompt.endsWith('Site context:\n# Facts\n\nInline note.')).toBe(true)
  })
})
