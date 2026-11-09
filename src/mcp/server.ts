import type { PayloadRequest } from 'payload'
import type { ZodRawShape } from 'zod'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type {
  AiAssistantLimits,
  AiAssistantMode,
  AiAssistantTool,
  LinkResolver,
  ResolvedScope,
} from '../types.js'
import type { ChatTool } from './context.js'

import { PLUGIN_SLUG } from '../defaults.js'
import { truncate } from '../text.js'
import { errorMessage } from './context.js'
import { findBrokenReferences } from './tools/brokenReferences.js'
import { collectionTools } from './tools/collections.js'
import { countDocuments } from './tools/countDocuments.js'
import { describeSchema } from './tools/describeSchema.js'
import { globalTools } from './tools/globals.js'
import { recentChanges } from './tools/recentChanges.js'
import { seoAudit } from './tools/seoAudit.js'
import { unusedMedia } from './tools/unusedMedia.js'

export const genericTools: ChatTool[] = [
  describeSchema,
  countDocuments,
  recentChanges,
  seoAudit,
  findBrokenReferences,
  unusedMedia,
]

type ServerArgs = {
  limits: AiAssistantLimits
  links: LinkResolver
  mode: AiAssistantMode
  req: PayloadRequest
  scope: ResolvedScope
  tools?: AiAssistantTool[]
}

export function createChatMcpServer({ limits, links, mode, req, scope, tools = [] }: ServerArgs): {
  server: McpServer
  writeTools: Set<string>
} {
  const server = new McpServer({ name: PLUGIN_SLUG, version: '0.1.0' })
  const ctx = { limits, links, req, scope }
  const writeTools = new Set<string>()

  const register = (
    name: string,
    description: string,
    inputSchema: ZodRawShape,
    write: boolean,
    run: (args: Record<string, unknown>) => unknown,
  ) => {
    if (write) {
      writeTools.add(name)
    }
    server.registerTool(
      name,
      {
        annotations: write
          ? { destructiveHint: false, readOnlyHint: false }
          : { readOnlyHint: true },
        description,
        inputSchema,
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await run(args)
          const text = typeof result === 'string' ? result : JSON.stringify(result)
          return {
            content: [{ type: 'text' as const, text: truncate(text, limits.maxToolOutputChars) }],
          }
        } catch (error) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${errorMessage(error)}` }],
            isError: true,
          }
        }
      },
    )
  }

  for (const tool of [
    ...genericTools,
    ...collectionTools(scope.collections, limits),
    ...globalTools(scope.globals),
  ]) {
    register(tool.name, tool.description, tool.inputSchema, Boolean(tool.write), (args) =>
      tool.run(args, ctx),
    )
  }
  for (const tool of tools) {
    if (tool.kind === 'write' && mode !== 'full') {
      continue
    }
    register(tool.name, tool.description, tool.inputSchema, tool.kind === 'write', (args) =>
      tool.handler(args, req),
    )
  }
  return { server, writeTools }
}
