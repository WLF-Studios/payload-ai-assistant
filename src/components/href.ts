/** Path + search + hash when `href` is absolute or `/`-relative on `origin`. */
export function sameOriginPath(href: string | undefined, origin: string): string | undefined {
  if (!href || !/^(?:\/|https?:)/i.test(href)) {
    return undefined
  }
  try {
    const url = new URL(href, origin)
    return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : undefined
  } catch {
    return undefined
  }
}

export function isExternal(href: string | undefined, origin: string): boolean {
  if (!href || href.startsWith('#')) {
    return false
  }
  try {
    return new URL(href, origin).origin !== origin
  } catch {
    return false
  }
}
