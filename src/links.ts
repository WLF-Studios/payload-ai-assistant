import type { PayloadRequest } from 'payload'

import type { AiAssistantDocumentURL, DocumentLinks, LinkResolver } from './types.js'

type URLConfig = { routes?: { admin?: string }; serverURL?: string }

export function adminURL(
  config: URLConfig,
  target: { collection: string; id: number | string } | { global: string },
): string {
  const base = `${config.serverURL ?? ''}${config.routes?.admin ?? '/admin'}`
  return 'global' in target
    ? `${base}/globals/${target.global}`
    : `${base}/collections/${target.collection}/${encodeURIComponent(String(target.id))}`
}

export function resolveDocumentURLs(
  req: PayloadRequest,
  documentURL: AiAssistantDocumentURL | undefined,
): LinkResolver {
  return async ({ collection, doc, global }) => {
    const links: DocumentLinks = {
      admin: global
        ? adminURL(req.payload.config, { global })
        : adminURL(req.payload.config, { id: doc.id as number | string, collection: collection! }),
    }
    if (documentURL) {
      try {
        const result = await documentURL({
          collection,
          doc,
          global,
          req,
        } as Parameters<AiAssistantDocumentURL>[0])
        if (result?.public) {
          links.public = result.public
        }
      } catch (error) {
        req.payload.logger.warn({ err: error, msg: 'payload-ai-assistant: documentURL failed' })
      }
    }
    return links
  }
}
