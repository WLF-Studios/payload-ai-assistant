import type { TypedLocale } from 'payload'

import { z } from 'zod'

import type { ScopeEntry } from '../../types.js'
import type { ChatTool } from '../context.js'

import { entityName, parseData } from '../context.js'

export function globalTools(entries: ScopeEntry[]): ChatTool[] {
  const tools: ChatTool[] = []
  for (const entry of entries) {
    const name = entityName(entry.slug)
    const about = `"${entry.label}" (global ${entry.slug})${entry.description ? `: ${entry.description}` : ''}`
    tools.push({
      name: `find${name}`,
      description: `Read the ${about}.`,
      inputSchema: {
        draft: z.boolean().optional().describe('Read the latest draft (default true)'),
        fields: z.array(z.string()).optional().describe('Top-level field names to return'),
        locale: z.string().optional(),
      },
      run: async (args, ctx) => {
        const fields = args.fields as string[] | undefined
        const doc = (await ctx.req.payload.findGlobal({
          slug: entry.slug,
          depth: 0,
          draft: (args.draft as boolean | undefined) ?? true,
          locale: args.locale as TypedLocale | undefined,
          overrideAccess: false,
          req: ctx.req,
          ...(fields?.length && { select: Object.fromEntries(fields.map((f) => [f, true])) }),
          user: ctx.req.user,
        })) as Record<string, unknown>
        const links = await ctx.links({ doc, global: entry.slug })
        return [`Global "${entry.slug}"`, JSON.stringify({ ...doc, links })].join('\n')
      },
    })
    if (!entry.writable) {
      continue
    }
    tools.push({
      name: `update${name}`,
      description: `Update the ${about}. Only send the fields to change. The user must approve; the change is saved as a draft, never published.`,
      inputSchema: {
        data: z.string().describe('JSON object with only the fields to change'),
        locale: z.string().optional(),
      },
      run: async (args, ctx) => {
        const doc = (await ctx.req.payload.updateGlobal({
          slug: entry.slug,
          data: { ...parseData(args.data), _status: 'draft' },
          depth: 0,
          draft: true,
          locale: args.locale as TypedLocale | undefined,
          overrideAccess: false,
          req: ctx.req,
          user: ctx.req.user,
        })) as Record<string, unknown>
        const links = await ctx.links({ doc, global: entry.slug })
        return [`Draft saved: [${entry.label}](${links.admin})`, JSON.stringify({ links })].join(
          '\n',
        )
      },
      write: true,
    })
  }
  return tools
}
