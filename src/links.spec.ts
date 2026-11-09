import type { PayloadRequest } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { adminURL, resolveDocumentURLs } from './links.js'

const req = (serverURL = '') =>
  ({
    payload: { config: { routes: { admin: '/admin' }, serverURL }, logger: { warn: vi.fn() } },
  }) as unknown as PayloadRequest

describe('adminURL', () => {
  it('builds collection and global edit URLs', () => {
    const config = { routes: { admin: '/cms' }, serverURL: 'https://cms.test' }
    expect(adminURL(config, { id: 'a b', collection: 'pages' })).toBe(
      'https://cms.test/cms/collections/pages/a%20b',
    )
    expect(adminURL({}, { global: 'header' })).toBe('/admin/globals/header')
  })
})

describe('resolveDocumentURLs', () => {
  it('adds the public link from the option', async () => {
    const links = resolveDocumentURLs(req(), ({ doc }) => ({
      public: `https://site.test/${String(doc.slug)}/`,
    }))
    await expect(links({ collection: 'pages', doc: { id: 4, slug: 'spa' } })).resolves.toEqual({
      admin: '/admin/collections/pages/4',
      public: 'https://site.test/spa/',
    })
    await expect(links({ doc: {}, global: 'footer' })).resolves.toMatchObject({
      admin: '/admin/globals/footer',
    })
  })

  it('keeps the admin link when the resolver fails or returns nothing', async () => {
    const r = req('https://cms.test')
    const failing = resolveDocumentURLs(r, () => {
      throw new Error('boom')
    })
    await expect(failing({ collection: 'pages', doc: { id: 1 } })).resolves.toEqual({
      admin: 'https://cms.test/admin/collections/pages/1',
    })
    expect(r.payload.logger.warn).toHaveBeenCalled()
    await expect(
      resolveDocumentURLs(r, () => undefined)({ collection: 'pages', doc: { id: 1 } }),
    ).resolves.toEqual({ admin: 'https://cms.test/admin/collections/pages/1' })
  })
})
