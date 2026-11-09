import type { Payload, PayloadRequest } from 'payload'

import config from '@payload-config'
import { createPayloadRequest, getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { DEFAULT_LIMITS } from '../src/defaults.js'
import { connectInMemory } from '../src/mcp/connect.js'
import { createChatMcpServer } from '../src/mcp/server.js'
import { resolveScope } from '../src/scope.js'
import { devUser } from './helpers/credentials.js'

let payload: Payload

const message = { id: '1', parts: [{ type: 'text', text: 'How many posts?' }], role: 'user' }

async function chatRequest(user?: PayloadRequest['user']): Promise<PayloadRequest> {
  const request = new Request('http://localhost:3000/api/ai-assistant', {
    body: JSON.stringify({ messages: [message] }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })
  const req = await createPayloadRequest({ config, request })
  req.user = user ?? null
  return req
}

async function devUserDoc(): Promise<PayloadRequest['user']> {
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: devUser.email } },
  })
  return { ...docs[0], collection: 'users' } as PayloadRequest['user']
}

const chatEndpoint = () =>
  payload.config.endpoints.find((endpoint) => endpoint.path === '/ai-assistant')

afterAll(async () => {
  await payload.destroy()
})

beforeAll(async () => {
  payload = await getPayload({ config })
  await payload.create({ collection: 'posts', data: { title: 'First' } })
  await payload.create({ collection: 'posts', data: { title: 'Second' } })
})

describe('AI assistant plugin', () => {
  test('registers the endpoint, provider and dashboard widget', () => {
    expect(chatEndpoint()?.method).toBe('post')
    expect(payload.config.admin.components.providers).toContainEqual(
      expect.objectContaining({ path: 'payload-ai-assistant/client#AiAssistantProvider' }),
    )
    expect(payload.config.admin.dashboard?.widgets).toContainEqual(
      expect.objectContaining({ slug: 'ai-assistant' }),
    )
  })

  test('rejects anonymous requests', async () => {
    const response = await chatEndpoint()!.handler(await chatRequest())
    expect(response.status).toBe(403)
  })

  test('answers 503 without a provider', async () => {
    const response = await chatEndpoint()!.handler(await chatRequest(await devUserDoc()))
    expect(response.status).toBe(503)
  })

  test('MCP tools read real documents', async () => {
    const req = await chatRequest(await devUserDoc())
    const scope = resolveScope({ mode: 'full', options: {}, req })
    expect(scope.collections.map((entry) => entry.slug)).toContain('posts')

    const { server, writeTools } = createChatMcpServer({
      limits: DEFAULT_LIMITS,
      links: () => Promise.resolve({ admin: '/admin' }),
      mode: 'full',
      req,
      scope,
    })
    expect(writeTools).toContain('createPosts')
    const { client, close } = await connectInMemory(server)
    const count = await client.callTool({
      name: 'countDocuments',
      arguments: { collection: 'posts' },
    })
    await close()
    expect(JSON.stringify(count.content)).toContain('2 documents')
  })
})
