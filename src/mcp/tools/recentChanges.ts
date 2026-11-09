import { z } from 'zod'

import type { ChatTool } from '../context.js'

import { collectionConfig, scopeEntry, summarySelect } from '../context.js'

export const recentChanges: ChatTool = {
  name: 'recentChanges',
  description:
    'List documents updated since a date, newest first, across all collections or one collection. Includes drafts.',
  inputSchema: {
    collection: z.string().optional().describe('Collection slug; omit for all collections'),
    limit: z.number().int().min(1).optional().describe('Maximum documents per collection'),
    since: z.string().describe('ISO date or date-time, e.g. 2026-01-31'),
  },
  run: async (args, ctx) => {
    const since = new Date(String(args.since))
    if (Number.isNaN(since.getTime())) {
      throw new Error('`since` must be an ISO date.')
    }
    const entries = args.collection
      ? [scopeEntry(ctx.scope.collections, args.collection, 'collection')]
      : ctx.scope.collections
    const limit = Math.min(
      (args.limit as number | undefined) ?? ctx.limits.maxDocuments,
      ctx.limits.maxDocuments,
    )
    const sections = await Promise.all(
      entries.map(async (entry) => {
        const result = await ctx.req.payload.find({
          collection: entry.slug,
          depth: 0,
          draft: true,
          limit,
          overrideAccess: false,
          req: ctx.req,
          select: summarySelect(collectionConfig(ctx.req, entry.slug)),
          sort: '-updatedAt',
          user: ctx.req.user,
          where: { updatedAt: { greater_than_equal: since.toISOString() } },
        })
        if (!result.totalDocs) {
          return ''
        }
        const lines = await Promise.all(
          (result.docs as Record<string, unknown>[]).map(async (doc) =>
            JSON.stringify({ ...doc, links: await ctx.links({ collection: entry.slug, doc }) }),
          ),
        )
        return [
          `Collection "${entry.slug}": ${result.docs.length} of ${result.totalDocs} changed`,
          ...lines,
        ].join('\n')
      }),
    )
    const body = sections.filter(Boolean).join('\n')
    return body || `No changes since ${since.toISOString()}.`
  },
}
