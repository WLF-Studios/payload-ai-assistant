import type { PayloadRequest } from 'payload'

import type { AiAssistantMode, ResolvedScope, ScopeEntry } from './types.js'

type EntityConfig = {
  admin?: { description?: unknown; hidden?: unknown }
  auth?: unknown
  label?: unknown
  labels?: { plural?: unknown }
  slug: string
  versions?: unknown
}

type ScopeArgs = {
  mode: AiAssistantMode
  options: { collections?: string[]; globals?: string[] }
  req: PayloadRequest
}

export const hasDrafts = (versions: unknown): boolean =>
  Boolean(versions && typeof versions === 'object' && (versions as { drafts?: unknown }).drafts)

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined

const isInternal = (entity: EntityConfig) => entity.slug.startsWith('payload-')

/** Mirrors the admin sidebar: `admin.hidden` as a boolean or `({ user }) => boolean`; a throw counts as hidden. */
function isHidden(entity: EntityConfig, user: PayloadRequest['user']): boolean {
  const hidden = entity.admin?.hidden
  if (typeof hidden !== 'function') {
    return Boolean(hidden)
  }
  try {
    return Boolean((hidden as (args: { user: unknown }) => unknown)({ user }))
  } catch {
    return true
  }
}

function pick(
  entities: EntityConfig[],
  allowlist: string[] | undefined,
  mode: AiAssistantMode,
  user: PayloadRequest['user'],
): ScopeEntry[] {
  return entities
    .filter((entity) => (allowlist ? allowlist.includes(entity.slug) : !isHidden(entity, user)))
    .map((entity) => {
      const drafts = hasDrafts(entity.versions)
      return {
        slug: entity.slug,
        description: text(entity.admin?.description),
        drafts,
        label: text(entity.labels?.plural) ?? text(entity.label) ?? entity.slug,
        writable: mode === 'full' && drafts,
      }
    })
}

/** Collections and globals the chat may use for this user. */
export function resolveScope({ mode, options, req }: ScopeArgs): ResolvedScope {
  const { config, logger } = req.payload
  const collections = (config.collections ?? []) as EntityConfig[]
  const globals = (config.globals ?? []) as EntityConfig[]
  const unknown = [
    ...(options.collections ?? []).filter((slug) => !collections.some((c) => c.slug === slug)),
    ...(options.globals ?? []).filter((slug) => !globals.some((g) => g.slug === slug)),
  ]
  if (unknown.length) {
    logger.warn(`payload-ai-assistant: ignoring unknown slugs in scope: ${unknown.join(', ')}`)
  }

  return {
    collections: pick(
      collections.filter((entity) => !entity.auth && !isInternal(entity)),
      options.collections,
      mode,
      req.user,
    ),
    globals: pick(
      globals.filter((entity) => !isInternal(entity)),
      options.globals,
      mode,
      req.user,
    ),
  }
}
