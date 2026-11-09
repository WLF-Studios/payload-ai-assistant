import type { SelectType, TypedLocale } from 'payload'

import { z } from 'zod'

import type { AiAssistantLimits, ScopeEntry } from '../../types.js'
import type { ChatTool, ToolContext } from '../context.js'

import {
  blocksConfig,
  collectionConfig,
  entityName,
  fieldsOf,
  parseData,
  parseWhere,
  summarySelect,
  titleOf,
} from '../context.js'
import { containsType, lexicalTexts, topLevelFields } from '../fields.js'

type FindArgs = {
  draft?: boolean
  fields?: string[]
  id?: number | string
  includeContent?: boolean
  limit?: number
  locale?: string
  page?: number
  sort?: string
  where?: string
}

async function findDocuments(entry: ScopeEntry, args: FindArgs, ctx: ToolContext): Promise<string> {
  const { payload } = ctx.req
  const config = collectionConfig(ctx.req, entry.slug)
  const select = summarySelect(config, args.fields) as Record<string, boolean>
  const contentFields = args.includeContent
    ? topLevelFields(fieldsOf(config)).filter((f) =>
        containsType(f, 'richText', blocksConfig(ctx.req)),
      )
    : []
  for (const field of contentFields) {
    select[field.name!] = true
  }
  const common = {
    collection: entry.slug,
    depth: 0,
    draft: args.draft ?? true,
    locale: args.locale as TypedLocale | undefined,
    overrideAccess: false,
    req: ctx.req,
    select: select as SelectType,
    user: ctx.req.user,
  }

  let docs: Record<string, unknown>[]
  let header: string
  if (args.id !== undefined) {
    docs = [(await payload.findByID({ ...common, id: args.id })) as Record<string, unknown>]
    header = `Collection "${entry.slug}", document ${args.id}`
  } else {
    const result = await payload.find({
      ...common,
      limit: Math.min(args.limit ?? 10, ctx.limits.maxDocuments),
      page: args.page,
      sort: args.sort,
      where: parseWhere(args.where),
    })
    docs = result.docs as Record<string, unknown>[]
    header = `Collection "${entry.slug}", ${docs.length} of ${result.totalDocs}, page ${result.page ?? 1} of ${result.totalPages}`
  }

  const lines = await Promise.all(
    docs.map(async (doc) => {
      const out: Record<string, unknown> = { ...doc }
      for (const field of contentFields) {
        out[field.name!] = lexicalTexts(doc[field.name!]).join('\n\n')
      }
      out.links = await ctx.links({ collection: entry.slug, doc })
      return JSON.stringify(out)
    }),
  )
  return [header, ...lines].join('\n')
}

async function writeResult(
  entry: ScopeEntry,
  doc: Record<string, unknown>,
  ctx: ToolContext,
): Promise<string> {
  const links = await ctx.links({ collection: entry.slug, doc })
  const title = titleOf(doc, collectionConfig(ctx.req, entry.slug))
  return [
    `Draft saved: [${title}](${links.admin})${links.public ? ` (public: ${links.public})` : ''}`,
    JSON.stringify({ id: doc.id, links }),
  ].join('\n')
}

export function collectionTools(entries: ScopeEntry[], limits: AiAssistantLimits): ChatTool[] {
  const tools: ChatTool[] = []
  for (const entry of entries) {
    const name = entityName(entry.slug)
    const about = `"${entry.label}" (collection ${entry.slug})${entry.description ? `: ${entry.description}` : ''}`
    tools.push({
      name: `find${name}`,
      description: `Find documents in ${about}. Returns a summary per document plus admin/public links. Pass \`id\` for one document or \`where\` to filter.`,
      inputSchema: {
        id: z.union([z.string(), z.number()]).optional().describe('A specific document id'),
        draft: z
          .boolean()
          .optional()
          .describe('Read the latest draft (default true); false reads published content only'),
        fields: z
          .array(z.string())
          .optional()
          .describe('Extra top-level field names to include (see describeSchema)'),
        includeContent: z
          .boolean()
          .optional()
          .describe('Include rich text as plain text (large; use for one or a few documents)'),
        limit: z.number().int().min(1).max(limits.maxDocuments).optional(),
        locale: z.string().optional(),
        page: z.number().int().min(1).optional(),
        sort: z.string().optional().describe('Field to sort by, e.g. "-updatedAt"'),
        where: z
          .string()
          .optional()
          .describe('JSON Payload where clause, e.g. {"title":{"like":"spa"}}'),
      },
      run: (args, ctx) => findDocuments(entry, args as FindArgs, ctx),
    })
    if (!entry.writable) {
      continue
    }
    tools.push({
      name: `create${name}`,
      description: `Create a new draft document in ${about}. The user must approve; it is saved as a draft, never published.`,
      inputSchema: {
        data: z.string().describe('JSON object of field values'),
        locale: z.string().optional(),
      },
      run: async (args, ctx) => {
        const doc = await ctx.req.payload.create({
          collection: entry.slug,
          data: { ...parseData(args.data), _status: 'draft' },
          depth: 0,
          draft: true,
          locale: args.locale as TypedLocale | undefined,
          overrideAccess: false,
          req: ctx.req,
          user: ctx.req.user,
        })
        return writeResult(entry, doc as Record<string, unknown>, ctx)
      },
      write: true,
    })
    tools.push({
      name: `update${name}`,
      description: `Update one document by id in ${about}. Only send the fields to change. The user must approve; the change is saved as a draft, never published.`,
      inputSchema: {
        id: z.union([z.string(), z.number()]),
        data: z.string().describe('JSON object with only the fields to change'),
        locale: z.string().optional(),
      },
      run: async (args, ctx) => {
        const doc = await ctx.req.payload.update({
          id: args.id as number | string,
          collection: entry.slug,
          data: { ...parseData(args.data), _status: 'draft' },
          depth: 0,
          draft: true,
          locale: args.locale as TypedLocale | undefined,
          overrideAccess: false,
          req: ctx.req,
          user: ctx.req.user,
        })
        return writeResult(entry, doc as Record<string, unknown>, ctx)
      },
      write: true,
    })
  }
  return tools
}
