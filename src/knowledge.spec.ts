import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { readKnowledge } from './knowledge.js'

describe('readKnowledge', () => {
  it('returns the file text', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ai-assistant-'))
    const file = path.join(dir, 'site.md')
    await writeFile(file, '# Site\n')
    const warn = vi.fn()
    expect(await readKnowledge(file, { warn })).toBe('# Site\n')
    expect(warn).not.toHaveBeenCalled()
  })

  it('warns with the resolved path and returns undefined when missing', async () => {
    const warn = vi.fn()
    expect(await readKnowledge('missing/site.md', { warn })).toBeUndefined()
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toContain(path.resolve('missing/site.md'))
  })
})
