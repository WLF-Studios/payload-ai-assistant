import type { SanitizedCollectionConfig } from 'payload'

import { z } from 'zod'

import type { ScopeEntry } from '../../types.js'
import type { ChatTool, ToolContext } from '../context.js'

import { SCAN_CAP, SEO_BOUNDS } from '../../defaults.js'
import { collectionConfig, fieldsOf, titleOf } from '../context.js'
import { topLevelFields } from '../fields.js'

export type SeoDoc = {
  description?: string
  doc: Record<string, unknown>
  hasImage?: boolean
  label: string
  title?: string
}

export const SEO_ISSUES = {
  descriptionLength: `Meta description outside ${SEO_BOUNDS.description[0]}-${SEO_BOUNDS.description[1]} characters`,
  duplicateTitle: 'Duplicate meta title',
  missingDescription: 'Missing meta description',
  missingImage: 'Missing meta image',
  missingTitle: 'Missing meta title',
  titleLength: `Meta title outside ${SEO_BOUNDS.title[0]}-${SEO_BOUNDS.title[1]} characters`,
} as const

export type SeoIssue = keyof typeof SEO_ISSUES

const ISSUE_ORDER: SeoIssue[] = [
  'missingTitle',
  'missingDescription',
  'titleLength',
  'descriptionLength',
  'duplicateTitle',
  'missingImage',
]

const length = (value: string) => [...value].length
const outside = (value: string, [min, max]: readonly [number, number]) =>
  length(value) < min || length(value) > max

export function classifySeo(docs: SeoDoc[]): Record<SeoIssue, SeoDoc[]> {
  const issues = Object.fromEntries(
    Object.keys(SEO_ISSUES).map((key) => [key, [] as SeoDoc[]]),
  ) as Record<SeoIssue, SeoDoc[]>
  const byTitle = new Map<string, SeoDoc[]>()
  for (const doc of docs) {
    const title = doc.title?.trim() ?? ''
    const description = doc.description?.trim() ?? ''
    if (!title) {
      issues.missingTitle.push(doc)
    } else {
      if (outside(title, SEO_BOUNDS.title)) {
        issues.titleLength.push(doc)
      }
      const key = title.toLowerCase()
      byTitle.set(key, [...(byTitle.get(key) ?? []), doc])
    }
    if (!description) {
      issues.missingDescription.push(doc)
    } else if (outside(description, SEO_BOUNDS.description)) {
      issues.descriptionLength.push(doc)
    }
    if (doc.hasImage === false) {
      issues.missingImage.push(doc)
    }
  }
  for (const group of byTitle.values()) {
    if (group.length > 1) {
      issues.duplicateTitle.push(...group)
    }
  }
  return issues
}

/** The plugin-seo shape: a top-level `meta` group with `title` and `description`. */
export function metaFields(config: SanitizedCollectionConfig): Set<string> | undefined {
  const meta = topLevelFields(fieldsOf(config)).find((f) => f.name === 'meta' && f.type === 'group')
  const names = new Set(topLevelFields(meta?.fields).map((f) => f.name!))
  return names.has('title') && names.has('description') ? names : undefined
}

async function auditCollection(entry: ScopeEntry, limit: number, ctx: ToolContext) {
  const config = collectionConfig(ctx.req, entry.slug)
  const names = metaFields(config)!
  const hasImageField = names.has('image')
  const docs: SeoDoc[] = []
  let total = 0
  for (let page = 1; docs.length < SCAN_CAP; page++) {
    const result = await ctx.req.payload.find({
      collection: entry.slug,
      depth: 0,
      draft: true,
      limit: Math.min(500, SCAN_CAP - docs.length),
      overrideAccess: false,
      page,
      req: ctx.req,
      select: {
        [config.admin?.useAsTitle ?? 'id']: true,
        meta: { description: true, title: true, ...(hasImageField && { image: true }) },
        ...(topLevelFields(fieldsOf(config)).some((f) => f.name === 'slug') && { slug: true }),
      },
      user: ctx.req.user,
    })
    total = result.totalDocs
    for (const doc of result.docs as Record<string, unknown>[]) {
      const meta = (doc.meta ?? {}) as Record<string, unknown>
      docs.push({
        description: typeof meta.description === 'string' ? meta.description : undefined,
        doc,
        hasImage: hasImageField ? meta.image != null && meta.image !== '' : undefined,
        label: titleOf(doc, config),
        title: typeof meta.title === 'string' ? meta.title : undefined,
      })
    }
    if (!result.hasNextPage) {
      break
    }
  }

  const issues = classifySeo(docs)
  const lines = [
    `Collection "${entry.slug}": ${docs.length} documents checked${total > docs.length ? ` (capped at ${SCAN_CAP} of ${total})` : ''}`,
  ]
  for (const key of ISSUE_ORDER) {
    const found = issues[key]
    if (!found.length) {
      continue
    }
    lines.push(`${SEO_ISSUES[key]} (${found.length}):`)
    for (const item of found.slice(0, limit)) {
      lines.push(
        JSON.stringify({
          id: item.doc.id,
          title: item.label,
          ...(key === 'titleLength' || key === 'duplicateTitle'
            ? { length: length(item.title!.trim()), metaTitle: item.title }
            : {}),
          ...(key === 'descriptionLength'
            ? { length: length(item.description!.trim()), metaDescription: item.description }
            : {}),
          links: await ctx.links({ collection: entry.slug, doc: item.doc }),
        }),
      )
    }
    if (found.length > limit) {
      lines.push(`...and ${found.length - limit} more`)
    }
  }
  if (lines.length === 1) {
    lines.push('No issues found.')
  }
  return lines.join('\n')
}

export const seoAudit: ChatTool = {
  name: 'seoAudit',
  description: `Audit SEO meta fields (meta.title, meta.description, meta.image) across collections: missing values, title outside ${SEO_BOUNDS.title.join('-')} chars, description outside ${SEO_BOUNDS.description.join('-')} chars, duplicate titles. Results are grouped by issue with links.`,
  inputSchema: {
    collection: z
      .string()
      .optional()
      .describe('Collection slug; omit for every collection with SEO fields'),
    limit: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Maximum documents listed per issue (default 20)'),
  },
  run: async (args, ctx) => {
    const eligible = ctx.scope.collections.filter((e) =>
      metaFields(collectionConfig(ctx.req, e.slug)),
    )
    const entries = args.collection ? eligible.filter((e) => e.slug === args.collection) : eligible
    if (!entries.length) {
      throw new Error(
        `No SEO fields to audit${args.collection ? ` in "${args.collection as string}"` : ''}. Collections with SEO fields: ${eligible.map((e) => e.slug).join(', ') || 'none'}.`,
      )
    }
    const limit = (args.limit as number | undefined) ?? 20
    const sections = []
    for (const entry of entries) {
      sections.push(await auditCollection(entry, limit, ctx))
    }
    return [
      `SEO audit. Fixed bounds: title ${SEO_BOUNDS.title.join('-')} characters, description ${SEO_BOUNDS.description.join('-')} characters.`,
      ...sections,
    ].join('\n')
  },
}
