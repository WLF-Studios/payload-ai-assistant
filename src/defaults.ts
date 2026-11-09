import type { AiAssistantLimits, AiAssistantModel, AiAssistantQuickPrompt } from './types.js'

export const PLUGIN_SLUG = 'payload-ai-assistant'
export const DEFAULT_ENDPOINT_PATH = '/ai-assistant'
export const DEFAULT_WIDGET_SLUG = 'ai-assistant'
export const DEFAULT_WIDGET_LABEL = 'Assistant'
export const COLLECTIONS_WIDGET_SLUG = 'collections'

export const DEFAULT_LIMITS: AiAssistantLimits = {
  maxDocuments: 20,
  maxOutputTokens: 4096,
  maxSteps: 12,
  maxToolOutputChars: 12_000,
  maxUserMessageChars: 4000,
}

export const MODEL_PREFERENCE_KEY = 'payload-ai-assistant-model'

export const MAX_MESSAGES = 50
export const SCAN_CAP = 2000
export const SEO_BOUNDS = { description: [100, 150], title: [50, 60] } as const

export const TRUNCATION_NOTE = '[truncated: ask for fewer documents or specific fields]'

export const defaultModels: AiAssistantModel[] = [
  { id: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5' },
  { id: 'openai/gpt-6-luna', label: 'GPT-6 Luna' },
  { id: 'z-ai/glm-5.3-flash', label: 'GLM 5.3 Flash' },
  { id: 'deepseek/deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash' },
]

export const defaultQuickPrompts: AiAssistantQuickPrompt[] = [
  { label: 'SEO audit', prompt: 'Run an SEO audit and list the worst problems first.' },
  { label: 'Missing descriptions', prompt: 'Which documents have no meta description?' },
  { label: 'Changed this week', prompt: 'What changed in the last 7 days?' },
  { label: 'Broken links', prompt: 'Find broken references across the site, grouped by document.' },
  {
    label: 'Drafts waiting',
    prompt: 'Which documents have draft changes that are not published yet?',
  },
  {
    label: 'Content overview',
    prompt:
      'Give me a short overview of how the content is organised and what each collection is for.',
  },
]
