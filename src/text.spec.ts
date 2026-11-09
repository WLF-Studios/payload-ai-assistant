import { describe, expect, it } from 'vitest'

import { lexicalToText, truncate } from './text.js'

const text = (value: string) => ({ type: 'text', text: value })

describe('lexicalToText', () => {
  it('joins blocks with newlines and inline nodes without', () => {
    const value = {
      root: {
        type: 'root',
        children: [
          { type: 'heading', children: [text('Title')] },
          {
            type: 'paragraph',
            children: [text('Hello '), { type: 'link', children: [text('world')] }, text('!')],
          },
          {
            type: 'list',
            children: [
              { type: 'listitem', children: [text('one')] },
              { type: 'listitem', children: [text('two')] },
            ],
          },
          { type: 'paragraph', children: [text('a'), { type: 'linebreak' }, text('b')] },
          { type: 'paragraph', children: [] },
        ],
      },
    }
    expect(lexicalToText(value)).toBe('Title\nHello world!\none\ntwo\na\nb')
  })

  it('keeps children of unknown nodes and ignores non-lexical values', () => {
    expect(
      lexicalToText({ root: { children: [{ type: 'custom', children: [text('inner')] }] } }),
    ).toBe('inner')
    expect(lexicalToText('plain')).toBe('')
    expect(lexicalToText(null)).toBe('')
  })
})

describe('truncate', () => {
  it('returns short text unchanged', () => {
    expect(truncate('abc', 3)).toBe('abc')
  })

  it('cuts and appends the note', () => {
    expect(truncate('abcdef', 3, '[cut]')).toBe('abc\n[cut]')
    expect(truncate('abcdef', 3)).toMatch(/^abc\n\[truncated/)
  })
})
