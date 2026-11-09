'use client'

import type { ComponentProps } from 'react'
import type { ExtraProps } from 'react-markdown'

import { Link } from '@payloadcms/ui'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import styles from './AiAssistant.module.css'
import { isExternal, sameOriginPath } from './href.js'

function Anchor({ children, href, node: _node, ...rest }: ComponentProps<'a'> & ExtraProps) {
  const origin = window.location.origin
  const path = sameOriginPath(href, origin)
  if (path) {
    return (
      <Link {...rest} href={path}>
        {children}
      </Link>
    )
  }
  return isExternal(href, origin) ? (
    <a {...rest} href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  ) : (
    <a {...rest} href={href}>
      {children}
    </a>
  )
}

function Table({ node: _node, ...rest }: ComponentProps<'table'> & ExtraProps) {
  return (
    <div className={styles.tableWrap}>
      <table {...rest} />
    </div>
  )
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown components={{ a: Anchor, table: Table }} remarkPlugins={[remarkGfm]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
