import { TRUNCATION_NOTE } from './defaults.js'

type LexicalNode = { children?: unknown; text?: unknown; type?: unknown }

const BLOCK_TYPES = new Set([
  'code',
  'heading',
  'list',
  'listitem',
  'paragraph',
  'quote',
  'table',
  'tablecell',
  'tablerow',
])

const isNode = (value: unknown): value is LexicalNode =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

function walk(node: LexicalNode): string {
  if (typeof node.text === 'string') {
    return node.text
  }
  if (node.type === 'linebreak') {
    return '\n'
  }
  const children = Array.isArray(node.children) ? node.children.filter(isNode) : []
  let out = ''
  children.forEach((child, index) => {
    const value = walk(child)
    if (index > 0 && BLOCK_TYPES.has(String(child.type)) && value) {
      out += '\n'
    }
    out += value
  })
  return out
}

export function isLexical(value: unknown): value is { root: LexicalNode } {
  return isNode(value) && isNode((value as { root?: unknown }).root)
}

export function lexicalToText(value: unknown): string {
  if (!isLexical(value)) {
    return ''
  }
  const children = Array.isArray(value.root.children) ? value.root.children.filter(isNode) : []
  return children
    .map(walk)
    .filter((part) => part.trim())
    .join('\n')
}

export function truncate(text: string, limit: number, note: string = TRUNCATION_NOTE): string {
  return text.length <= limit ? text : `${text.slice(0, limit)}\n${note}`
}
