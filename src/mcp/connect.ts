import type { MCPClient, MCPTransport } from '@ai-sdk/mcp'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { createMCPClient } from '@ai-sdk/mcp'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

export async function connectInMemory(
  server: McpServer,
): Promise<{ client: MCPClient; close: () => Promise<void> }> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  let client: MCPClient | undefined
  let closed = false
  const close = async () => {
    if (closed) {
      return
    }
    closed = true
    await client?.close().catch(() => undefined)
    await server.close().catch(() => undefined)
  }
  try {
    client = await createMCPClient({ transport: clientTransport as unknown as MCPTransport })
  } catch (error) {
    await close()
    throw error
  }
  return { client, close }
}
