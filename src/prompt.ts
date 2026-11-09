import type { AiAssistantMode } from './types.js'

type PromptArgs = {
  instructions?: string
  knowledge?: string
  localization?: { defaultLocale: string; localeCodes: string[] } | false
  mode: AiAssistantMode
  now: Date
}

export const FINAL_STEP_NOTE =
  'You have no tool calls left for this message. Answer now with what you found so far, and say briefly what you could not check.'

export function buildSystemPrompt({
  instructions,
  knowledge,
  localization,
  mode,
  now,
}: PromptArgs): string {
  const lines = [
    'You are the content assistant inside a Payload CMS admin panel. You help the logged-in editor find content, understand the content structure, and review SEO.',
    mode === 'full'
      ? "You can create and update content through the create/update tools. Every change is saved as a draft and needs the user's approval in the chat. Never claim a change was made before the tool result confirms it."
      : 'You cannot change content in this mode; say so plainly when asked to edit, create, publish or delete anything.',
    'Rules:',
    '- Always search with the tools before answering questions about content. Never answer from memory.',
    '- For questions about structure, fields or collections, use describeSchema first.',
    '- Cite documents as markdown links using the `links` from tool results: the admin link labelled with the document title, the public link in parentheses when present.',
    '- Never invent ids, slugs or URLs.',
    '- Keep answers short and concrete. Use lists for several documents.',
    '- If a tool result was truncated, narrow the query (fewer documents, specific fields, a where filter).',
  ]
  if (localization) {
    lines.push(
      `Content is localized. Locale codes: ${localization.localeCodes.join(', ')}. Default locale: ${localization.defaultLocale}. Pass \`locale\` to tools when the user asks about a specific locale.`,
    )
  }
  lines.push(`Today is ${now.toISOString().slice(0, 10)}.`)
  const context = [knowledge, instructions].map((part) => part?.trim()).filter(Boolean)
  if (context.length) {
    lines.push('', 'Site context:', context.join('\n\n'))
  }
  return lines.join('\n')
}
