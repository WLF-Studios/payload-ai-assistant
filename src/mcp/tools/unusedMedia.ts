import { z } from 'zod'

import type { ChatTool } from '../context.js'

import { SCAN_CAP } from '../../defaults.js'
import { blocksConfig, collectionConfig, fieldsOf, scopeEntry, titleOf } from '../context.js'
import { collectReferences } from '../fields.js'
import { scanDocuments } from './brokenReferences.js'

export const unusedMedia: ChatTool = {
  name: 'unusedMedia',
  description:
    'List uploads (media) that no document references through an upload or relationship field, including rich text and blocks. Coarse: scans at most 2000 documents per collection.',
  inputSchema: {
    collection: z.string().optional().describe('Upload collection slug; defaults to the first one'),
    limit: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Maximum unused uploads listed (default 50)'),
  },
  run: async (args, ctx) => {
    const uploads = ctx.scope.collections.filter((e) => collectionConfig(ctx.req, e.slug).upload)
    const entry = args.collection
      ? scopeEntry(uploads, args.collection, 'upload collection')
      : uploads[0]
    if (!entry) {
      throw new Error('No upload collection is available.')
    }
    const mediaConfig = collectionConfig(ctx.req, entry.slug)
    const blocks = blocksConfig(ctx.req)
    const notes: string[] = []

    const media: Record<string, unknown>[] = []
    const mediaScan = await scanDocuments(ctx, entry.slug, (doc) => media.push(doc))
    if (mediaScan.total > mediaScan.scanned) {
      notes.push(`Only the first ${SCAN_CAP} of ${mediaScan.total} uploads were checked.`)
    }

    const used = new Set<string>()
    const mark = (fields: unknown, doc: unknown) => {
      for (const ref of collectReferences(fieldsOf({ fields }), doc, blocks)) {
        if (ref.relationTo === entry.slug) {
          used.add(String(ref.id))
        }
      }
    }
    for (const source of ctx.scope.collections) {
      const fields = collectionConfig(ctx.req, source.slug).fields
      const scan = await scanDocuments(ctx, source.slug, (doc) => mark(fields, doc))
      if (scan.total > scan.scanned) {
        notes.push(`"${source.slug}": only ${SCAN_CAP} of ${scan.total} documents scanned.`)
      }
    }
    for (const global of ctx.scope.globals) {
      const config = ctx.req.payload.config.globals.find((g) => g.slug === global.slug)
      const doc = await ctx.req.payload.findGlobal({
        slug: global.slug,
        depth: 0,
        draft: true,
        overrideAccess: false,
        req: ctx.req,
        user: ctx.req.user,
      })
      mark(config?.fields, doc)
    }

    const unused = media.filter((doc) => !used.has(String(doc.id)))
    const limit = (args.limit as number | undefined) ?? 50
    const lines = [
      `Upload collection "${entry.slug}": ${media.length} checked, ${unused.length} not referenced.`,
      ...notes,
    ]
    for (const doc of unused.slice(0, limit)) {
      lines.push(
        JSON.stringify({
          id: doc.id,
          filename: doc.filename,
          links: await ctx.links({ collection: entry.slug, doc }),
          title: titleOf(doc, mediaConfig),
        }),
      )
    }
    if (unused.length > limit) {
      lines.push(`...and ${unused.length - limit} more`)
    }
    return lines.join('\n')
  },
}
