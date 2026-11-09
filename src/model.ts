import { createOpenRouter } from '@openrouter/ai-sdk-provider'

import type {
  AiAssistantModel,
  AiAssistantModelProvider,
  AiAssistantPluginConfig,
} from './types.js'

/** The provider to stream with; throws at config time on a conflicting or incomplete setup. */
export function resolveProvider(
  options: AiAssistantPluginConfig,
): AiAssistantModelProvider | undefined {
  if (options.apiKey && options.provider) {
    throw new Error('payload-ai-assistant: pass apiKey or provider, not both.')
  }
  if (options.provider) {
    if (!options.models) {
      throw new Error(
        'payload-ai-assistant: provider needs models; defaultModels are OpenRouter ids.',
      )
    }
    return options.provider
  }
  if (options.apiKey) {
    const openrouter = createOpenRouter({ apiKey: options.apiKey })
    return (id) => openrouter.chat(id)
  }
  return undefined
}

/** The configured default; throws at config time when it is not in the list. */
export function resolveDefaultModel(
  models: AiAssistantModel[],
  defaultId: string | undefined,
): string {
  const id = defaultId ?? models[0]?.id
  if (!id || !models.some((model) => model.id === id)) {
    throw new Error(`payload-ai-assistant: defaultModel "${id}" is not in models.`)
  }
  return id
}

/** The model to use for a request; throws when the requested id is not in the list. */
export function validateModel(
  models: AiAssistantModel[],
  requested: unknown,
  defaultId: string,
): string {
  if (requested === undefined || requested === null) {
    return defaultId
  }
  if (typeof requested !== 'string' || !models.some((model) => model.id === requested)) {
    throw new Error('Unknown model.')
  }
  return requested
}
