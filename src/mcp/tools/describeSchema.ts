import { z } from 'zod'

import type { ScopeEntry } from '../../types.js'
import type { ChatTool, ToolContext } from '../context.js'

import { blocksConfig, collectionConfig, fieldsOf } from '../context.js'
import { describeFields, hasLocalizedField } from '../fields.js'

const yesNo = (value: boolean) => (value ? 'yes' : 'no')

const globalFields = (ctx: ToolContext, slug: string) =>
  ctx.req.payload.config.globals.find((g) => g.slug === slug)?.fields ?? []

export const describeSchema: ChatTool = {
  name: 'describeSchema',
  description:
    'Describe the content structure. Without arguments: lists the collections and globals you can access. With `collection` (a collection or global slug): lists its fields recursively with types, required, localized, select options, relations and block types.',
  inputSchema: {
    collection: z.string().optional().describe('Collection or global slug'),
  },
  run: (args, ctx) => {
    const { collections, globals } = ctx.scope
    const config = blocksConfig(ctx.req)
    const slug = args.collection as string | undefined

    if (!slug) {
      const line = (entry: ScopeEntry, kind: string, fields: unknown) =>
        `- ${entry.slug} (${kind}) "${entry.label}"${entry.description ? `: ${entry.description}` : ''} | drafts: ${yesNo(entry.drafts)} | localized: ${yesNo(hasLocalizedField(fieldsOf({ fields }), config))} | writable here: ${yesNo(entry.writable)}`
      return Promise.resolve(
        [
          'Collections:',
          ...collections.map((e) =>
            line(e, 'collection', collectionConfig(ctx.req, e.slug).fields),
          ),
          'Globals:',
          ...globals.map((e) => line(e, 'global', globalFields(ctx, e.slug))),
        ].join('\n'),
      )
    }

    const collection = collections.find((c) => c.slug === slug)
    const global = globals.find((g) => g.slug === slug)
    let header: string
    let fields: unknown
    if (collection) {
      const cfg = collectionConfig(ctx.req, slug)
      header = `Collection "${slug}" (${collection.label}), useAsTitle: ${cfg.admin?.useAsTitle ?? 'id'}, drafts: ${yesNo(collection.drafts)}`
      fields = cfg.fields
    } else if (global) {
      header = `Global "${slug}" (${global.label}), drafts: ${yesNo(global.drafts)}`
      fields = globalFields(ctx, slug)
    } else {
      throw new Error(
        `Unknown collection or global "${slug}". Available: ${[...collections, ...globals].map((e) => e.slug).join(', ')}.`,
      )
    }
    return Promise.resolve(
      [header, 'Fields:', ...describeFields(fieldsOf({ fields }), config)].join('\n'),
    )
  },
}
