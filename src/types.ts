import type { LanguageModel } from 'ai'
import type { CollectionSlug, GlobalSlug, PayloadRequest, TypedUser } from 'payload'
import type { ZodRawShape } from 'zod'

export type AiAssistantModelProvider = (modelId: string) => LanguageModel

export type AiAssistantMode = 'full' | 'read'

export type AiAssistantTool = {
  description: string
  handler: (args: Record<string, unknown>, req: PayloadRequest) => unknown
  inputSchema: ZodRawShape
  /** 'read' tools run in both modes; 'write' tools exist only in full mode and need approval. */
  kind: 'read' | 'write'
  name: string
}

export type AiAssistantAccess = (args: {
  req: PayloadRequest
  user: TypedUser
}) => boolean | Promise<boolean>

export type AiAssistantDocumentURL = (args: {
  collection?: CollectionSlug
  doc: Record<string, unknown>
  global?: GlobalSlug
  req: PayloadRequest
}) => { public?: string } | Promise<{ public?: string } | undefined> | undefined

export type AiAssistantModel = { description?: string; id: string; label: string }

export type AiAssistantQuickPrompt = { label: string; prompt: string }

export type AiAssistantLimits = {
  maxDocuments: number
  maxOutputTokens: number
  maxSteps: number
  maxToolOutputChars: number
  maxUserMessageChars: number
}

export type AiAssistantPluginConfig = {
  /** Who sees and may use the chat. Default: any logged-in admin-panel user. */
  access?: AiAssistantAccess
  /** OpenRouter API key for the built-in provider. Without it the endpoint answers 503. */
  apiKey?: string
  /** Allowlist of collection slugs. Default: collections the user sees in the admin sidebar. */
  collections?: CollectionSlug[]
  /** Must be an id in `models`. Default: the first model. */
  defaultModel?: string
  disabled?: boolean
  /** Public/preview links per document. Admin links are built by the plugin. */
  documentURL?: AiAssistantDocumentURL
  endpointPath?: string
  /** Allowlist of global slugs. Default: globals the user sees in the admin sidebar. */
  globals?: GlobalSlug[]
  /** Short site context, appended after the knowledge file. */
  instructions?: string
  /** Markdown file with site facts, relative to process.cwd(). */
  knowledgeFile?: string
  limits?: Partial<AiAssistantLimits>
  /** 'full' adds draft-only create/update tools with chat approval. Default: 'read'. */
  mode?: AiAssistantMode
  /** Models each user may pick from. Default: `defaultModels`. */
  models?: AiAssistantModel[]
  /** Any AI SDK provider, e.g. `createWorkersAI({...})`. Replaces apiKey; needs `models`. */
  provider?: AiAssistantModelProvider
  /** Default: `defaultQuickPrompts`. */
  quickPrompts?: AiAssistantQuickPrompt[]
  tools?: AiAssistantTool[]
  widget?: {
    label?: string
    position?: 'after-collections' | 'before-collections'
    slug?: string
  }
}

export type ScopeEntry = {
  description?: string
  drafts: boolean
  label: string
  slug: string
  writable: boolean
}

export type ResolvedScope = {
  collections: ScopeEntry[]
  globals: ScopeEntry[]
}

export type DocumentLinks = { admin: string; public?: string }

export type LinkResolver = (args: {
  collection?: string
  doc: Record<string, unknown>
  global?: string
}) => Promise<DocumentLinks>

export type StoredChatConfig = {
  access?: AiAssistantAccess
  defaultModel: string
  endpointPath: string
  limits: AiAssistantLimits
  mode: AiAssistantMode
  models: AiAssistantModel[]
  quickPrompts: AiAssistantQuickPrompt[]
  widgetSlug: string
}
