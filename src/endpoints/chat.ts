import type { PayloadHandler } from 'payload'

import {
  convertToModelMessages,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from 'ai'

import type {
  AiAssistantModelProvider,
  AiAssistantPluginConfig,
  StoredChatConfig,
} from '../types.js'

import { MAX_MESSAGES } from '../defaults.js'
import { readKnowledge } from '../knowledge.js'
import { resolveDocumentURLs } from '../links.js'
import { connectInMemory } from '../mcp/connect.js'
import { createChatMcpServer } from '../mcp/server.js'
import { validateModel } from '../model.js'
import { buildSystemPrompt, FINAL_STEP_NOTE } from '../prompt.js'
import { resolveScope } from '../scope.js'

const ERROR_MESSAGE = 'The assistant hit an error. Try again.'

const plain = (message: string, status: number) =>
  new Response(message, { headers: { 'Content-Type': 'text/plain; charset=utf-8' }, status })

const userText = (message: UIMessage | undefined) =>
  message?.role === 'user'
    ? message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('')
    : ''

export const createChatHandler = (
  options: AiAssistantPluginConfig,
  stored: StoredChatConfig,
  provider: AiAssistantModelProvider | undefined,
): PayloadHandler => {
  // Read once on the first request; a restart picks up edits.
  let knowledge: Promise<string | undefined> | undefined
  return async (req) => {
    const { payload, user } = req
    if (!user || (stored.access && !(await stored.access({ req, user })))) {
      return plain('Forbidden', 403)
    }

    const body = (await req.json?.().catch(() => undefined)) as
      { messages?: unknown; model?: unknown } | undefined
    const validated = await safeValidateUIMessages({ messages: body?.messages })
    if (!validated.success) {
      return plain('Invalid messages.', 400)
    }
    const messages = validated.data
    if (messages.length > MAX_MESSAGES) {
      return plain(`Conversations are limited to ${MAX_MESSAGES} messages. Start a new one.`, 400)
    }
    if (userText(messages.at(-1)).length > stored.limits.maxUserMessageChars) {
      return plain(`Messages are limited to ${stored.limits.maxUserMessageChars} characters.`, 400)
    }

    let modelId: string
    try {
      modelId = validateModel(stored.models, body?.model, stored.defaultModel)
    } catch {
      return plain('Unknown model.', 400)
    }
    if (!provider) {
      return plain(
        'The assistant is not configured: pass apiKey or provider to aiAssistantPlugin.',
        503,
      )
    }

    const scope = resolveScope({ mode: stored.mode, options, req })
    const { server, writeTools } = createChatMcpServer({
      limits: stored.limits,
      links: resolveDocumentURLs(req, options.documentURL),
      mode: stored.mode,
      req,
      scope,
      tools: options.tools,
    })
    const { client, close } = await connectInMemory(server)
    let tools: Awaited<ReturnType<typeof client.tools>>
    try {
      tools = await client.tools()
    } catch (error) {
      await close()
      throw error
    }
    for (const name of writeTools) {
      if (tools[name]) {
        tools[name] = { ...tools[name], needsApproval: true }
      }
    }

    if (options.knowledgeFile) {
      knowledge ??= readKnowledge(options.knowledgeFile, payload.logger)
    }
    const localization = payload.config.localization
    const instructions = buildSystemPrompt({
      instructions: options.instructions,
      knowledge: await knowledge,
      localization: localization && {
        defaultLocale: localization.defaultLocale,
        localeCodes: localization.localeCodes,
      },
      mode: stored.mode,
      now: new Date(),
    })
    const lastStep = stored.limits.maxSteps - 1
    const result = streamText({
      abortSignal: req.signal,
      instructions,
      maxOutputTokens: stored.limits.maxOutputTokens,
      messages: await convertToModelMessages(messages, { tools }),
      model: provider(modelId),
      onAbort: close,
      onEnd: close,
      onError: async ({ error }) => {
        payload.logger.error({ err: error, msg: 'payload-ai-assistant: stream failed' })
        await close()
      },
      // The last step must answer in text instead of stopping after another tool call.
      prepareStep: ({ stepNumber }) =>
        stepNumber === lastStep
          ? {
              instructions: `${instructions}\n\n${FINAL_STEP_NOTE}`,
              toolChoice: 'none',
            }
          : undefined,
      stopWhen: stepCountIs(stored.limits.maxSteps),
      tools,
    })

    return result.toUIMessageStreamResponse({
      headers: { 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' },
      onError: (error) => {
        payload.logger.error({ err: error, msg: 'payload-ai-assistant: response failed' })
        return ERROR_MESSAGE
      },
      originalMessages: messages,
    })
  }
}
