import type { PayloadRequest } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import type { ToolContext } from '../context.js'

import { DEFAULT_LIMITS } from '../../defaults.js'
import { classifySeo, seoAudit } from './seoAudit.js'

const ok = {
  description:
    'Book massages, facials and packages at the resort spa, open all year with seasonal treatments for couples, families and groups.',
  title: 'Massanutten spa treatments and packages for every season',
}

describe('classifySeo', () => {
  it('groups documents by issue', () => {
    const doc = (id: number, meta: Record<string, unknown>) => ({
      ...meta,
      doc: { id },
      label: `Doc ${id}`,
    })
    const issues = classifySeo([
      doc(1, { ...ok, hasImage: true }),
      doc(2, { description: ok.description, hasImage: false }),
      doc(3, { description: '  ', title: 'Short' }),
      doc(4, { ...ok, description: 'Too short.' }),
      doc(5, { ...ok, title: ok.title.toUpperCase() }),
    ])
    const ids = (key: keyof typeof issues) => issues[key].map((d) => d.doc.id)
    expect(ids('missingTitle')).toEqual([2])
    expect(ids('missingDescription')).toEqual([3])
    expect(ids('titleLength')).toEqual([3])
    expect(ids('descriptionLength')).toEqual([4])
    expect(ids('duplicateTitle')).toEqual([1, 4, 5])
    expect(ids('missingImage')).toEqual([2])
  })
})

describe('seoAudit tool', () => {
  const pages = {
    slug: 'pages',
    admin: { useAsTitle: 'title' },
    fields: [
      { name: 'title', type: 'text' },
      { name: 'slug', type: 'text' },
      {
        name: 'meta',
        type: 'group',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'description', type: 'textarea' },
          { name: 'image', type: 'upload', relationTo: 'media' },
        ],
      },
    ],
  }
  const tags = { slug: 'tags', admin: {}, fields: [{ name: 'name', type: 'text' }] }

  const context = (docs: Record<string, unknown>[]) => {
    const find = vi.fn(() => Promise.resolve({ docs, hasNextPage: false, totalDocs: docs.length }))
    const req = {
      payload: { collections: { pages: { config: pages }, tags: { config: tags } }, find },
      user: { id: 1 },
    } as unknown as PayloadRequest
    const ctx: ToolContext = {
      limits: DEFAULT_LIMITS,
      links: ({ collection, doc }) =>
        Promise.resolve({ admin: `/admin/collections/${collection}/${String(doc.id)}` }),
      req,
      scope: {
        collections: [
          { slug: 'pages', drafts: true, label: 'Pages', writable: false },
          { slug: 'tags', drafts: false, label: 'Tags', writable: false },
        ],
        globals: [],
      },
    }
    return { ctx, find }
  }

  it('audits only collections with SEO fields, as the session user, and links every entry', async () => {
    const { ctx, find } = context([
      { id: 1, meta: { ...ok, image: 3 }, title: 'Home' },
      { id: 2, meta: { title: ok.title }, title: 'Spa' },
    ])
    const text = await seoAudit.run({}, ctx)
    expect(find).toHaveBeenCalledTimes(1)
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'pages', draft: true, overrideAccess: false }),
    )
    expect(text).toContain('title 50-60 characters, description 100-150 characters')
    expect(text).toContain('Collection "pages": 2 documents checked')
    expect(text).toContain('Missing meta description (1):')
    expect(text).toContain('Duplicate meta title (2):')
    expect(text).toContain('Missing meta image (1):')
    expect(text).toContain('"links":{"admin":"/admin/collections/pages/2"}')
    expect(text).not.toContain('tags')
  })

  it('caps the listed entries per issue', async () => {
    const docs = Array.from({ length: 5 }, (_, i) => ({ id: i, meta: {}, title: `P${i}` }))
    const text = await seoAudit.run({ limit: 2 }, context(docs).ctx)
    expect(text).toContain('Missing meta title (5):')
    expect(text).toContain('...and 3 more')
  })

  it('rejects a collection without SEO fields', async () => {
    await expect(seoAudit.run({ collection: 'tags' }, context([]).ctx)).rejects.toThrow(
      /Collections with SEO fields: pages/,
    )
  })
})
