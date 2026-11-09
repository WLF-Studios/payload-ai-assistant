import type { AiAssistantMode } from './types.js'

export function resolveMode(option: string | undefined): AiAssistantMode {
  const value = option ?? 'read'
  if (value !== 'read' && value !== 'full') {
    throw new Error(`payload-ai-assistant: invalid mode "${value}". Use "read" or "full".`)
  }
  return value
}
