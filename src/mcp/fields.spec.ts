import { describe, expect, it } from 'vitest'

import type { FieldLike } from './fields.js'

import { collectReferences, describeFields, topLevelFields } from './fields.js'

const hero = {
  slug: 'hero',
  fields: [{ name: 'image', type: 'upload', relationTo: 'media' }],
}

const config = { blocks: [hero] }

const fields: FieldLike[] = [
  { name: 'title', type: 'text', localized: true, required: true },
  {
    type: 'tabs',
    tabs: [
      {
        fields: [
          {
            type: 'row',
            fields: [{ name: 'status', type: 'select', options: ['a', { value: 'b' }] }],
          },
          { name: 'layout', type: 'blocks', blockReferences: ['hero'], blocks: [] },
        ],
      },
      {
        name: 'meta',
        fields: [
          { name: 'description', type: 'textarea' },
          { name: 'image', type: 'upload', relationTo: 'media' },
        ],
      },
    ],
  },
  {
    type: 'collapsible',
    fields: [
      {
        name: 'links',
        type: 'array',
        fields: [{ name: 'doc', type: 'relationship', relationTo: ['pages', 'stories'] }],
      },
    ],
  },
  { name: 'related', type: 'relationship', hasMany: true, relationTo: 'pages' },
  { name: 'body', type: 'richText' },
  { name: 'note', type: 'ui' },
]

describe('topLevelFields', () => {
  it('flattens presentational fields and turns named tabs into groups', () => {
    expect(topLevelFields(fields).map((f) => `${f.name}:${f.type}`)).toEqual([
      'title:text',
      'status:select',
      'layout:blocks',
      'meta:group',
      'links:array',
      'related:relationship',
      'body:richText',
    ])
  })
})

describe('describeFields', () => {
  it('lists fields recursively with their attributes', () => {
    expect(describeFields(fields, config)).toEqual([
      '- title (text, required, localized)',
      '- status (select, options: a | b)',
      '- layout (blocks, blocks: hero)',
      '- meta (group)',
      '  - description (textarea)',
      '  - image (upload, relationTo: media)',
      '- links (array)',
      '  - doc (relationship, relationTo: pages | stories)',
      '- related (relationship, hasMany, relationTo: pages)',
      '- body (richText)',
    ])
  })
})

describe('collectReferences', () => {
  it('finds references in groups, arrays, blocks, polymorphic and rich text values', () => {
    const doc = {
      body: {
        root: {
          children: [{ type: 'upload', relationTo: 'media', value: { id: 9 } }],
        },
      },
      layout: [{ blockType: 'hero', image: 5 }],
      links: [{ doc: { relationTo: 'stories', value: 'abc' } }],
      meta: { image: { id: 7 } },
      related: [1, 2],
      title: 'Hello',
    }
    expect(collectReferences(fields, doc, config)).toEqual([
      { id: 5, path: 'layout.0.image', relationTo: 'media' },
      { id: 7, path: 'meta.image', relationTo: 'media' },
      { id: 'abc', path: 'links.0.doc', relationTo: 'stories' },
      { id: 1, path: 'related', relationTo: 'pages' },
      { id: 2, path: 'related', relationTo: 'pages' },
      { id: 9, path: 'body', relationTo: 'media' },
    ])
  })
})
