import type { WidgetServerProps } from 'payload'

import type { StoredChatConfig } from '../types.js'

import { MODEL_PREFERENCE_KEY, PLUGIN_SLUG } from '../defaults.js'
import { AiAssistant } from './AiAssistant.js'

export async function AiAssistantWidget({ req, user }: WidgetServerProps) {
  const stored = req.payload.config.custom?.[PLUGIN_SLUG] as StoredChatConfig | undefined
  if (!stored || !user || (stored.access && !(await stored.access({ req, user })))) {
    return null
  }
  const { docs } = await req.payload.find({
    collection: 'payload-preferences',
    depth: 0,
    limit: 1,
    pagination: false,
    where: {
      and: [
        { key: { equals: MODEL_PREFERENCE_KEY } },
        { 'user.value': { equals: user.id } },
        { 'user.relationTo': { equals: user.collection } },
      ],
    },
  })
  const saved = (docs[0]?.value as { id?: unknown } | undefined)?.id
  const initialModel = stored.models.some((model) => model.id === saved)
    ? (saved as string)
    : stored.defaultModel
  return (
    <AiAssistant
      initialModel={initialModel}
      mode={stored.mode}
      models={stored.models}
      quickPrompts={stored.quickPrompts}
    />
  )
}
