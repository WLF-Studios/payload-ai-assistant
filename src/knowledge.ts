import type { Payload } from 'payload'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

/** Reads the site knowledge Markdown (cwd-relative); warns and returns undefined when unreadable. */
export async function readKnowledge(
  file: string,
  logger: Pick<Payload['logger'], 'warn'>,
): Promise<string | undefined> {
  const resolved = path.resolve(file)
  try {
    return await readFile(resolved, 'utf8')
  } catch {
    logger.warn(
      `payload-ai-assistant: knowledgeFile not readable, answering without it: ${resolved}`,
    )
    return undefined
  }
}
