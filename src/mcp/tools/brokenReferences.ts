import { z } from 'zod'

import type { ChatTool, ToolContext } from '../context.js'
import type { Reference } from '../fields.js'

import { SCAN_CAP } from '../../defaults.js'
import { blocksConfig, collectionConfig, fieldsOf, scopeEntry, titleOf } from '../context.js'
import { collectReferences } from '../fields.js'

type Status = 'missing' | 'unpublished'

export async function scanDocuments(
  ctx: ToolContext,
  slug: string,
  visit: (doc: Record<string, unknown>) => void,
): Promise<{ scanned: number; total: number }> {
  let scanned = 0
  let total = 0
  for (let page = 1; scanned < SCAN_CAP; page++) {
    const result = await ctx.req.payload.find({
      collection: slug,
      depth: 0,
      draft: true,
      limit: Math.min(200, SCAN_CAP - scanned),
      overrideAccess: false,
      page,
      req: ctx.req,
      user: ctx.req.user,
    })
    total = result.totalDocs
    for (const doc of result.docs as Record<string, unknown>[]) {
      visit(doc)
      scanned++
    }
    if (!result.hasNextPage) {
      break
    }
  }
  return { scanned, total }
}

async function targetStatus(
  ctx: ToolContext,
  slug: string,
  ids: Array<number | string>,
): Promise<Map<string, Status>> {
  const status = new Map<string, Status>()
  const target = ctx.req.payload.collections[slug]?.config
  if (!target) {
    ids.forEach((id) => status.set(String(id), 'missing'))
    return status
  }
  const drafts = Boolean(target.versions?.drafts)
  const found = new Map<string, unknown>()
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200)
    const result = await ctx.req.payload.find({
      collection: slug,
      depth: 0,
      draft: false,
      limit: chunk.length,
      overrideAccess: false,
      pagination: false,
      req: ctx.req,
      select: drafts ? { _status: true } : { updatedAt: true },
      user: ctx.req.user,
      where: { id: { in: chunk } },
    })
    for (const doc of result.docs as Record<string, unknown>[]) {
      found.set(String(doc.id), doc._status)
    }
  }
  for (const id of ids) {
    const key = String(id)
    if (!found.has(key)) {
      status.set(key, 'missing')
    } else if (drafts && found.get(key) !== 'published') {
      status.set(key, 'unpublished')
    }
  }
  return status
}

export const findBrokenReferences: ChatTool = {
  name: 'findBrokenReferences',
  description:
    'Find relationship, upload and rich-text references in one collection or one global that point to documents that are missing (deleted or not accessible) or not published. Pass either `collection` or `global`.',
  inputSchema: {
    collection: z.string().optional().describe('Collection slug to check'),
    global: z.string().optional().describe('Global slug to check (its latest draft)'),
    limit: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Maximum broken references listed (default 50)'),
  },
  run: async (args, ctx) => {
    if (Boolean(args.collection) === Boolean(args.global)) {
      throw new Error('Pass either `collection` or `global`.')
    }
    const blocks = blocksConfig(ctx.req)
    const sources: Array<{ doc: Record<string, unknown>; refs: Reference[] }> = []
    let summary: string
    let describe: (doc: Record<string, unknown>) => Promise<Record<string, unknown>>

    if (args.global) {
      const entry = scopeEntry(ctx.scope.globals, args.global, 'global')
      const config = ctx.req.payload.config.globals.find((global) => global.slug === entry.slug)
      const doc = (await ctx.req.payload.findGlobal({
        slug: entry.slug,
        depth: 0,
        draft: true,
        overrideAccess: false,
        req: ctx.req,
        user: ctx.req.user,
      })) as Record<string, unknown>
      const refs = config ? collectReferences(fieldsOf(config), doc, blocks) : []
      if (refs.length) {
        sources.push({ doc, refs })
      }
      summary = `Global "${entry.slug}"`
      describe = async (item) => ({ links: await ctx.links({ doc: item, global: entry.slug }) })
    } else {
      const entry = scopeEntry(ctx.scope.collections, args.collection, 'collection')
      const config = collectionConfig(ctx.req, entry.slug)
      const fields = fieldsOf(config)
      const { scanned, total } = await scanDocuments(ctx, entry.slug, (doc) => {
        // A document pointing at itself (e.g. its own nested-docs breadcrumb) is never a broken link.
        const refs = collectReferences(fields, doc, blocks).filter(
          (ref) => !(ref.relationTo === entry.slug && String(ref.id) === String(doc.id)),
        )
        if (refs.length) {
          sources.push({ doc, refs })
        }
      })
      summary = `Collection "${entry.slug}": ${scanned} documents scanned${total > scanned ? ` (capped at ${SCAN_CAP} of ${total})` : ''}`
      describe = async (item) => ({
        id: item.id,
        links: await ctx.links({ collection: entry.slug, doc: item }),
        title: titleOf(item, config),
      })
    }

    const idsByTarget = new Map<string, Set<number | string>>()
    for (const { refs } of sources) {
      for (const ref of refs) {
        idsByTarget.set(ref.relationTo, (idsByTarget.get(ref.relationTo) ?? new Set()).add(ref.id))
      }
    }
    const statusByTarget = new Map<string, Map<string, Status>>()
    for (const [slug, ids] of idsByTarget) {
      statusByTarget.set(slug, await targetStatus(ctx, slug, [...ids]))
    }

    const broken: Array<{ doc: Record<string, unknown>; ref: Reference; status: Status }> = []
    for (const { doc, refs } of sources) {
      for (const ref of refs) {
        const status = statusByTarget.get(ref.relationTo)?.get(String(ref.id))
        if (status) {
          broken.push({ doc, ref, status })
        }
      }
    }

    const limit = (args.limit as number | undefined) ?? 50
    const lines = [`${summary}, ${broken.length} broken references.`]
    for (const item of broken.slice(0, limit)) {
      lines.push(
        JSON.stringify({
          ...(await describe(item.doc)),
          field: item.ref.path,
          problem: item.status,
          target: `${item.ref.relationTo}/${item.ref.id}`,
        }),
      )
    }
    if (broken.length > limit) {
      lines.push(`...and ${broken.length - limit} more`)
    }
    return lines.join('\n')
  },
}
