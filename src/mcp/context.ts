import type { PayloadRequest, SanitizedCollectionConfig, SelectType, Where } from 'payload'
import type { ZodRawShape } from 'zod'

import type { AiAssistantLimits, LinkResolver, ResolvedScope, ScopeEntry } from '../types.js'
import type { BlocksConfig, FieldLike } from './fields.js'

import { topLevelFields } from './fields.js'

export type ToolContext = {
  limits: AiAssistantLimits
  links: LinkResolver
  req: PayloadRequest
  scope: ResolvedScope
}

export type ChatTool = {
  description: string
  inputSchema: ZodRawShape
  name: string
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>
  write?: boolean
}

export const toCamelCase = (value: string): string =>
  value
    .replace(/[-_\s]+(.)?/g, (_, chr: string | undefined) => (chr ? chr.toUpperCase() : ''))
    .replace(/^(.)/, (_, chr: string) => chr.toLowerCase())

export const entityName = (slug: string): string =>
  slug.charAt(0).toUpperCase() + toCamelCase(slug).slice(1)

export function scopeEntry(entries: ScopeEntry[], slug: unknown, kind: string): ScopeEntry {
  const entry = entries.find((e) => e.slug === slug)
  if (!entry) {
    throw new Error(
      `Unknown ${kind} "${String(slug)}". Available: ${entries.map((e) => e.slug).join(', ') || 'none'}.`,
    )
  }
  return entry
}

export const collectionConfig = (req: PayloadRequest, slug: string): SanitizedCollectionConfig =>
  req.payload.collections[slug].config

export const blocksConfig = (req: PayloadRequest): BlocksConfig =>
  req.payload.config as unknown as BlocksConfig

export const fieldsOf = (config: { fields: unknown }): FieldLike[] => config.fields as FieldLike[]

export function parseWhere(where: unknown): undefined | Where {
  if (!where) {
    return undefined
  }
  if (typeof where !== 'string') {
    return where as Where
  }
  try {
    return JSON.parse(where) as Where
  } catch {
    throw new Error('Invalid JSON in `where`.')
  }
}

export function parseData(data: unknown): Record<string, unknown> {
  const value = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('`data` must be a JSON object.')
  }
  return value as Record<string, unknown>
}

export function summarySelect(config: SanitizedCollectionConfig, extra: string[] = []): SelectType {
  const names = new Set(topLevelFields(fieldsOf(config)).map((f) => f.name))
  const select: Record<string, unknown> = { createdAt: true, updatedAt: true }
  const title = config.admin?.useAsTitle
  if (title && title !== 'id') {
    select[title] = true
  }
  if (names.has('slug')) {
    select.slug = true
  }
  if (config.versions?.drafts) {
    select._status = true
  }
  const meta = topLevelFields(fieldsOf(config)).find((f) => f.name === 'meta' && f.type === 'group')
  if (meta) {
    const metaNames = new Set(topLevelFields(meta.fields).map((f) => f.name))
    select.meta = Object.fromEntries(
      ['title', 'description', 'image'].filter((n) => metaNames.has(n)).map((n) => [n, true]),
    )
  }
  for (const name of extra) {
    if (names.has(name)) {
      select[name] = true
    }
  }
  return select as SelectType
}

export function titleOf(doc: Record<string, unknown>, config: SanitizedCollectionConfig): string {
  const title = doc[config.admin?.useAsTitle ?? 'id']
  return typeof title === 'string' && title.trim() ? title : String(doc.id)
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const data = (error as { data?: { errors?: Array<{ message?: string; path?: string }> } }).data
    const details = data?.errors?.map((e) => `${e.path ?? ''}: ${e.message ?? ''}`).join('; ')
    return details ? `${error.message} (${details})` : error.message
  }
  return String(error)
}
