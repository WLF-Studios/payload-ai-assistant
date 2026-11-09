import { describe, expect, it } from 'vitest'

import { isExternal, sameOriginPath } from './href.js'

const origin = 'https://cms.test'

describe('sameOriginPath', () => {
  it('returns the path for same-origin absolute and root-relative links', () => {
    expect(sameOriginPath('https://cms.test/admin/collections/pages/4?x=1#top', origin)).toBe(
      '/admin/collections/pages/4?x=1#top',
    )
    expect(sameOriginPath('/admin/globals/header', origin)).toBe('/admin/globals/header')
  })

  it('rejects other origins, protocol-relative, hash-only and non-http links', () => {
    expect(sameOriginPath('https://site.test/spa/', origin)).toBeUndefined()
    expect(sameOriginPath('//cms.evil/admin', origin)).toBeUndefined()
    expect(sameOriginPath('#top', origin)).toBeUndefined()
    expect(sameOriginPath('mailto:a@cms.test', origin)).toBeUndefined()
    expect(sameOriginPath(undefined, origin)).toBeUndefined()
  })
})

describe('isExternal', () => {
  it('flags other origins only', () => {
    expect(isExternal('https://site.test/spa/', origin)).toBe(true)
    expect(isExternal('//cms.evil/admin', origin)).toBe(true)
    expect(isExternal('https://cms.test/admin', origin)).toBe(false)
    expect(isExternal('#top', origin)).toBe(false)
  })
})
