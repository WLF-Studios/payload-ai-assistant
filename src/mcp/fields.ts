import { isLexical, lexicalToText } from '../text.js'

export type BlockLike = { fields: FieldLike[]; slug: string }

export type FieldLike = {
  blockReferences?: Array<BlockLike | string>
  blocks?: BlockLike[]
  fields?: FieldLike[]
  hasMany?: boolean
  localized?: boolean
  name?: string
  options?: Array<{ value: string } | string>
  relationTo?: string | string[]
  required?: boolean
  tabs?: Array<{ fields: FieldLike[]; name?: string }>
  type: string
}

export type BlocksConfig = { blocks?: BlockLike[] }

export type Reference = { id: number | string; path: string; relationTo: string }

const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined

export function blocksOf(field: FieldLike, config: BlocksConfig): BlockLike[] {
  const blocks = new Map<string, BlockLike>()
  for (const block of field.blocks ?? []) {
    blocks.set(block.slug, block)
  }
  for (const ref of field.blockReferences ?? []) {
    const block = typeof ref === 'string' ? config.blocks?.find((b) => b.slug === ref) : ref
    if (block) {
      blocks.set(block.slug, block)
    }
  }
  return [...blocks.values()]
}

/** Named data fields with rows, collapsibles, unnamed groups and unnamed tabs flattened; named tabs become groups. */
export function topLevelFields(fields: FieldLike[] = []): FieldLike[] {
  const out: FieldLike[] = []
  for (const field of fields) {
    if (
      field.type === 'row' ||
      field.type === 'collapsible' ||
      (field.type === 'group' && !field.name)
    ) {
      out.push(...topLevelFields(field.fields))
    } else if (field.type === 'tabs') {
      for (const tab of field.tabs ?? []) {
        if (tab.name) {
          out.push({ name: tab.name, type: 'group', fields: tab.fields })
        } else {
          out.push(...topLevelFields(tab.fields))
        }
      }
    } else if (field.name && field.type !== 'ui') {
      out.push(field)
    }
  }
  return out
}

export function describeFields(fields: FieldLike[], config: BlocksConfig, depth = 0): string[] {
  const lines: string[] = []
  for (const field of topLevelFields(fields)) {
    const attrs = [field.type]
    if (field.required) {
      attrs.push('required')
    }
    if (field.localized) {
      attrs.push('localized')
    }
    if (field.hasMany) {
      attrs.push('hasMany')
    }
    if (field.relationTo) {
      attrs.push(`relationTo: ${[field.relationTo].flat().join(' | ')}`)
    }
    if (field.options?.length) {
      attrs.push(
        `options: ${field.options.map((o) => (typeof o === 'string' ? o : o.value)).join(' | ')}`,
      )
    }
    if (field.type === 'blocks') {
      attrs.push(
        `blocks: ${blocksOf(field, config)
          .map((b) => b.slug)
          .join(', ')}`,
      )
    }
    lines.push(`${'  '.repeat(depth)}- ${field.name} (${attrs.join(', ')})`)
    if (field.type === 'group' || field.type === 'array') {
      lines.push(...describeFields(field.fields ?? [], config, depth + 1))
    }
  }
  return lines
}

export function containsType(field: FieldLike, type: string, config: BlocksConfig): boolean {
  if (field.type === type) {
    return true
  }
  const children = [
    ...(field.fields ?? []),
    ...(field.tabs ?? []).flatMap((tab) => tab.fields),
    ...(field.type === 'blocks' ? blocksOf(field, config).flatMap((b) => b.fields) : []),
  ]
  return children.some((child) => containsType(child, type, config))
}

export function hasLocalizedField(fields: FieldLike[], config: BlocksConfig): boolean {
  return fields.some(
    (field) =>
      field.localized ||
      hasLocalizedField(
        [
          ...(field.fields ?? []),
          ...(field.tabs ?? []).flatMap((tab) => tab.fields),
          ...(field.type === 'blocks' ? blocksOf(field, config).flatMap((b) => b.fields) : []),
        ],
        config,
      ),
  )
}

export function lexicalTexts(value: unknown): string[] {
  if (isLexical(value)) {
    return [lexicalToText(value)].filter(Boolean)
  }
  if (Array.isArray(value)) {
    return value.flatMap(lexicalTexts)
  }
  const obj = record(value)
  return obj ? Object.values(obj).flatMap(lexicalTexts) : []
}

function refId(value: unknown): number | string | undefined {
  const id = record(value)?.id ?? value
  return typeof id === 'string' || typeof id === 'number' ? id : undefined
}

function richTextReferences(value: unknown, path: string, out: Reference[]): void {
  if (Array.isArray(value)) {
    value.forEach((item) => richTextReferences(item, path, out))
    return
  }
  const node = record(value)
  if (!node) {
    return
  }
  if (
    (node.type === 'upload' || node.type === 'relationship') &&
    typeof node.relationTo === 'string'
  ) {
    const id = refId(node.value)
    if (id !== undefined) {
      out.push({ id, path, relationTo: node.relationTo })
    }
  }
  Object.values(node).forEach((child) => richTextReferences(child, path, out))
}

/** Relationship, upload and rich-text references in a document, walking groups, tabs, arrays and blocks. */
export function collectReferences(
  fields: FieldLike[],
  data: unknown,
  config: BlocksConfig,
  out: Reference[] = [],
  prefix = '',
): Reference[] {
  const values = record(data)
  if (!values) {
    return out
  }
  for (const field of topLevelFields(fields)) {
    const name = field.name!
    const path = prefix ? `${prefix}.${name}` : name
    const value = values[name]
    if (field.type === 'group') {
      collectReferences(field.fields ?? [], value, config, out, path)
    } else if (field.type === 'array' && Array.isArray(value)) {
      value.forEach((item, i) =>
        collectReferences(field.fields ?? [], item, config, out, `${path}.${i}`),
      )
    } else if (field.type === 'blocks' && Array.isArray(value)) {
      const blocks = blocksOf(field, config)
      value.forEach((item, i) => {
        const block = blocks.find((b) => b.slug === record(item)?.blockType)
        if (block) {
          collectReferences(block.fields, item, config, out, `${path}.${i}`)
        }
      })
    } else if (field.type === 'richText') {
      richTextReferences(value, path, out)
    } else if ((field.type === 'relationship' || field.type === 'upload') && field.relationTo) {
      for (const item of [value].flat()) {
        if (item == null) {
          continue
        }
        if (Array.isArray(field.relationTo)) {
          const poly = record(item)
          const id = refId(poly?.value)
          if (typeof poly?.relationTo === 'string' && id !== undefined) {
            out.push({ id, path, relationTo: poly.relationTo })
          }
        } else {
          const id = refId(item)
          if (id !== undefined) {
            out.push({ id, path, relationTo: field.relationTo })
          }
        }
      }
    }
  }
  return out
}
