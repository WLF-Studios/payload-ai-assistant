import type { PayloadRequest } from 'payload'

import { describe, expect, it, vi } from 'vitest'

import { resolveScope } from './scope.js'

const config = {
  collections: [
    { slug: 'pages', fields: [], labels: { plural: 'Pages' }, versions: { drafts: true } },
    { slug: 'media', admin: { description: 'Images' }, fields: [], upload: true },
    { slug: 'cache', admin: { hidden: true }, fields: [] },
    {
      slug: 'logs',
      admin: { hidden: ({ user }: { user: { admin?: boolean } }) => !user.admin },
      fields: [],
    },
    {
      slug: 'broken',
      admin: {
        hidden: () => {
          throw new Error('boom')
        },
      },
      fields: [],
    },
    { slug: 'users', auth: true, fields: [] },
    { slug: 'payload-mcp-api-keys', fields: [] },
    { slug: 'payload-folders', fields: [] },
  ],
  globals: [
    { slug: 'header', fields: [], versions: { drafts: true } },
    { slug: 'footer', fields: [] },
    { slug: 'secret', admin: { hidden: true }, fields: [] },
  ],
}

const request = (user: Record<string, unknown> = {}) => {
  const warn = vi.fn()
  const req = { payload: { config, logger: { warn } }, user } as unknown as PayloadRequest
  return { req, warn }
}

const slugs = (entries: Array<{ slug: string }>) => entries.map((e) => e.slug)

describe('resolveScope', () => {
  it('defaults to what the user sees in the sidebar; a throwing hidden counts as hidden', () => {
    const { req } = request()
    const scope = resolveScope({ mode: 'read', options: {}, req })
    expect(slugs(scope.collections)).toEqual(['pages', 'media'])
    expect(slugs(scope.globals)).toEqual(['header', 'footer'])
    expect(scope.collections[0]).toMatchObject({ drafts: true, label: 'Pages', writable: false })
    expect(scope.collections[1]).toMatchObject({ description: 'Images' })
  })

  it('evaluates hidden functions with the request user', () => {
    const { req } = request({ admin: true })
    expect(slugs(resolveScope({ mode: 'read', options: {}, req }).collections)).toEqual([
      'pages',
      'media',
      'logs',
    ])
  })

  it('marks only draft-enabled entities writable in full mode', () => {
    const { req } = request()
    const scope = resolveScope({ mode: 'full', options: {}, req })
    expect(scope.collections.map((e) => e.writable)).toEqual([true, false])
    expect(scope.globals.map((e) => e.writable)).toEqual([true, false])
  })

  it('keeps exactly the allowlist, skips auth and internals, and warns on unknown slugs', () => {
    const { req, warn } = request()
    const scope = resolveScope({
      mode: 'full',
      options: {
        collections: ['cache', 'users', 'payload-folders', 'nope'],
        globals: ['secret'],
      },
      req,
    })
    expect(slugs(scope.collections)).toEqual(['cache'])
    expect(slugs(scope.globals)).toEqual(['secret'])
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toContain('nope')
  })
})
