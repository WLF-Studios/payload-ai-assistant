import type { PayloadRequest } from 'payload'

import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import type { AiAssistantMode, AiAssistantTool, ResolvedScope } from '../types.js'

import { DEFAULT_LIMITS } from '../defaults.js'
import { connectInMemory } from './connect.js'
import { createChatMcpServer } from './server.js'

const pages = { admin: { useAsTitle: 'title' }, fields: [{ name: 'title', type: 'text' }] }
const req = {
  payload: { collections: { pages: { config: pages } }, config: { globals: [] } },
  user: { id: 1 },
} as unknown as PayloadRequest

const scope = (mode: AiAssistantMode): ResolvedScope => ({
  collections: [{ slug: 'pages', drafts: true, label: 'Pages', writable: mode === 'full' }],
  globals: [],
})

const projectTools: AiAssistantTool[] = [
  {
    name: 'echo',
    description: 'Echo',
    handler: (args) => ({ said: args.text }),
    inputSchema: { text: z.string() },
    kind: 'read',
  },
  {
    name: 'publishAll',
    description: 'Write',
    handler: () => 'done',
    inputSchema: {},
    kind: 'write',
  },
]

async function toolsFor(mode: AiAssistantMode) {
  const { server, writeTools } = createChatMcpServer({
    limits: DEFAULT_LIMITS,
    links: () => Promise.resolve({ admin: '/admin' }),
    mode,
    req,
    scope: scope(mode),
    tools: projectTools,
  })
  const { client, close } = await connectInMemory(server)
  return { client, close, tools: await client.tools(), writeTools }
}

describe('in-memory chat MCP server', () => {
  it('exposes read tools only in read mode', async () => {
    const { close, tools, writeTools } = await toolsFor('read')
    expect(Object.keys(tools).sort()).toEqual(
      [
        'countDocuments',
        'describeSchema',
        'echo',
        'findBrokenReferences',
        'findPages',
        'recentChanges',
        'seoAudit',
        'unusedMedia',
      ].sort(),
    )
    expect(writeTools.size).toBe(0)
    await close()
  })

  it('adds write tools in full mode and runs tools through the transport', async () => {
    const { client, close, tools, writeTools } = await toolsFor('full')
    expect([...writeTools].sort()).toEqual(['createPages', 'publishAll', 'updatePages'])
    expect(tools).toHaveProperty('createPages')
    const echo = await client.callTool({ name: 'echo', arguments: { text: 'hi' } })
    expect(echo.content).toEqual([{ type: 'text', text: '{"said":"hi"}' }])
    const schema = await client.callTool({
      name: 'describeSchema',
      arguments: { collection: 'pages' },
    })
    expect(JSON.stringify(schema.content)).toContain('- title (text)')
    const missing = await client.callTool({
      name: 'countDocuments',
      arguments: { collection: 'x' },
    })
    expect(missing.isError).toBe(true)
    await close()
  })
})
