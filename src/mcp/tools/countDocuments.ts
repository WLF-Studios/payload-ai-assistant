import { z } from 'zod'

import type { ChatTool } from '../context.js'

import { parseWhere, scopeEntry } from '../context.js'

export const countDocuments: ChatTool = {
  name: 'countDocuments',
  description: 'Count documents in a collection, optionally filtered by a where clause.',
  inputSchema: {
    collection: z.string().describe('Collection slug'),
    where: z.string().optional().describe('JSON Payload where clause'),
  },
  run: async (args, ctx) => {
    const entry = scopeEntry(ctx.scope.collections, args.collection, 'collection')
    const { totalDocs } = await ctx.req.payload.count({
      collection: entry.slug,
      overrideAccess: false,
      req: ctx.req,
      user: ctx.req.user,
      where: parseWhere(args.where),
    })
    return `Collection "${entry.slug}": ${totalDocs} documents${args.where ? ' matching the filter' : ''}`
  },
}
