# Payload AI Assistant

An AI assistant widget for the Payload 3 dashboard. Editors ask questions about content, structure and SEO; the model answers through a real MCP server that runs in-process, against the Payload local API, as the logged-in user.

- One `POST /api/ai-assistant` endpoint streams an AI SDK UI message stream.
- Per request it builds an MCP server (`@modelcontextprotocol/sdk`) with the session's tools and connects to it over an in-memory transport. No network hop, no MCP API keys, no shared admin identity.
- Every Payload call uses `req`, `user: req.user` and `overrideAccess: false`, so the chat can do exactly what the user can do in the admin panel, nothing more.
- The model runs on OpenRouter by default, or on any AI SDK provider you pass as `provider`.

## Setup

Requires `payload ^3.92.0`, `@payloadcms/ui ^3.92.0`, `next ^16`, `react ^19`, and an [OpenRouter](https://openrouter.ai) API key, or any AI SDK provider.

```bash
pnpm add payload-ai-assistant
```

Only `apiKey` (or `provider`) is needed for the chat to answer. This example shows every option with its default:

<!-- prettier-ignore -->
```ts
import { aiAssistantPlugin, defaultModels, defaultQuickPrompts } from 'payload-ai-assistant'

export const plugins = [
  aiAssistantPlugin({
    apiKey: process.env.OPENROUTER_API_KEY, // Built-in OpenRouter provider. Any env var name.
    // provider: createWorkersAI({ accountId, apiKey }), // Instead of apiKey; then pass models.
    mode: 'read', // 'full' adds draft-only create/update tools with chat approval.
    access: ({ user }) => Boolean(user), // Who sees and may use the chat. Default: any admin user.

    knowledgeFile: 'src/ai/site.md', // Markdown site facts, relative to process.cwd(). Default: none.
    instructions: 'Locales are markets.', // Short inline context, after the knowledge file. Default: none.

    models: defaultModels, // Models each user may pick from.
    defaultModel: 'anthropic/claude-haiku-5.5', // Must be in `models`. Default: the first one.
    quickPrompts: [...defaultQuickPrompts, { label: 'Leads', prompt: 'Leads this week?' }], // Chips.

    collections: ['pages', 'media'], // Allowlist. Default: collections the user sees in the sidebar.
    globals: ['header'], // Allowlist. Default: globals the user sees in the sidebar.

    documentURL: ({ collection, doc }) => // Public link next to the admin link. Default: none.
      collection === 'pages' ? { public: `https://example.com/${String(doc.slug)}/` } : undefined,

    tools: [ // Project tools on the same MCP server. Default: none.
      {
        name: 'siteStatus',
        description: 'Current build status of the public site.',
        kind: 'read', // 'write' tools exist only in full mode and need approval.
        inputSchema: {}, // Zod 4 raw shape, e.g. { id: z.string() }.
        handler: async (args, req) => ({ ok: true }), // A non-string result is JSON-stringified.
      },
    ],

    limits: {
      maxSteps: 12, // Model steps per message; the last one must answer without tools.
      maxDocuments: 20, // Per find call.
      maxToolOutputChars: 12_000,
      maxOutputTokens: 4096,
      maxUserMessageChars: 4000,
    },

    endpointPath: '/ai-assistant', // Under config.routes.api.
    widget: { slug: 'ai-assistant', label: 'Assistant', position: 'before-collections' },
    disabled: false, // True returns the config untouched.
  }),
]
```

The plugin reads no environment variables; pass the key from whichever variable your project uses. A missing key does not break the admin panel: the endpoint answers `503` with a plain message and the widget shows it. An invalid `mode` or a `defaultModel` outside `models` throws at config time.

Refresh the admin import map; it adds `payload-ai-assistant/rsc#AiAssistantWidget` and the provider `payload-ai-assistant/client#AiAssistantProvider`:

```bash
pnpm exec payload generate:importmap
```

## Configuration

| Option          | Default                                                                        | Purpose                                                           |
| --------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `apiKey`        | None; `apiKey` or `provider` is needed to answer                               | API key for the built-in OpenRouter provider                      |
| `provider`      | OpenRouter via `apiKey`                                                        | Any AI SDK provider, `(modelId) => LanguageModel`; needs `models` |
| `mode`          | `'read'`                                                                       | `'full'` adds create/update tools (drafts only, chat approval)    |
| `access`        | Any logged-in admin user                                                       | Who sees and may use the chat                                     |
| `knowledgeFile` | None                                                                           | Markdown file with site facts, relative to `process.cwd()`        |
| `instructions`  | None                                                                           | Short inline site context, appended after the knowledge file      |
| `models`        | `defaultModels`                                                                | Models each user may pick from                                    |
| `defaultModel`  | First of `models`                                                              | Preselected model; must be an id in `models`                      |
| `quickPrompts`  | `defaultQuickPrompts`                                                          | Chips under the input                                             |
| `tools`         | `[]`                                                                           | Project tools                                                     |
| `documentURL`   | None                                                                           | Public links next to admin links                                  |
| `collections`   | Sidebar-visible collections                                                    | Allowlist of collection slugs                                     |
| `globals`       | Sidebar-visible globals                                                        | Allowlist of global slugs                                         |
| `limits`        | See Setup                                                                      | Steps, documents, output and message sizes                        |
| `endpointPath`  | `'/ai-assistant'`                                                              | Chat endpoint under `config.routes.api`                           |
| `widget`        | `{ slug: 'ai-assistant', label: 'Assistant', position: 'before-collections' }` | Dashboard widget                                                  |
| `disabled`      | `false`                                                                        | Disable the plugin                                                |

`defaultModels` and `defaultQuickPrompts` are exported, so projects extend them instead of copying them:

- Models: Claude Haiku 5.5, GPT-6 Luna, GLM 5.3 Flash, DeepSeek V4.1 Flash (in that order).
- Quick prompts: SEO audit, Missing descriptions, Changed this week, Broken links, Drafts waiting, Content overview.

## Other providers

`provider` takes any AI SDK provider instance, which is already a `(modelId) => LanguageModel` function. It replaces `apiKey` (passing both throws) and requires `models`, because `defaultModels` are OpenRouter ids.

Compatibility: this plugin streams through `ai@7`, whose `LanguageModel` accepts models with `specificationVersion` `v4` (native), `v3` or `v2` (compatibility mode). Use provider packages built for AI SDK 7 / `@ai-sdk/provider` v4 — for reference, `ai@7.0.163` depends on `@ai-sdk/provider` 4.0.x and is tested against `@ai-sdk/openai` 4.x.

Cloudflare Workers AI, in REST mode, so it also works outside Workers:

```ts
import { createWorkersAI } from 'workers-ai-provider'

const workersai = createWorkersAI({
  accountId: process.env.CF_ACCOUNT_ID,
  apiKey: process.env.CF_AI_TOKEN,
})

aiAssistantPlugin({
  provider: workersai,
  models: [{ id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B' }],
})
```

Anthropic:

```ts
import { createAnthropic } from '@ai-sdk/anthropic'

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

aiAssistantPlugin({
  provider: anthropic,
  models: [{ id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' }],
})
```

OpenAI:

```ts
import { createOpenAI } from '@ai-sdk/openai'

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

aiAssistantPlugin({ provider: openai, models: [{ id: 'gpt-6-luna', label: 'GPT-6 Luna' }] })
```

Any OpenAI-compatible endpoint (Ollama, LM Studio, gateways):

```ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

const local = createOpenAICompatible({
  name: 'ollama',
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama',
})

aiAssistantPlugin({ provider: local, models: [{ id: 'qwen3:14b', label: 'Qwen3 14B' }] })
```

Mixing providers is one routing function:

```ts
aiAssistantPlugin({
  provider: (id) => (id.startsWith('@cf/') ? workersai(id) : anthropic(id)),
  models: [
    { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
  ],
})
```

The model must support streaming and tool calling, and small models handle dozens of tools poorly.

## Site knowledge

`knowledgeFile` points to a Markdown file with what the schema cannot tell the model: what the site is, how URLs map to documents, folder-only pages, naming conventions, which collections matter for SEO. It is sent with every message, so keep it short.

The file is read once, on the first chat request, and cached until the server restarts. A missing or unreadable file logs one warning with the resolved path; the chat answers without it.

The path resolves against `process.cwd()`, which is the Payload app folder for the Payload CLI, `next dev` and Next's standalone server. With Next `output: 'standalone'`, add the file to the build trace so it ships with the server:

```js
// next.config.mjs
const nextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/**': ['./src/ai/site.md'],
  },
}
```

Other setups need nothing.

## Modes

The mode comes from the `mode` option only, never from the UI or the request body. It decides which tools exist on the MCP server, so it is enforced by construction rather than by the prompt.

- `read`: find, count, describe and audit tools only. The assistant says it cannot edit when asked.
- `full`: adds `create<Collection>`, `update<Collection>` and `update<Global>` for collections and globals with `versions.drafts`, plus project tools of kind `write`.

### Writes

- Always drafts: `draft: true` and `_status: 'draft'` are set server-side; the model cannot publish.
- Only on entities with drafts enabled. Collections without drafts stay read-only even in `full` mode.
- Every write tool has `needsApproval: true`. The stream stops at an approval card in the chat; nothing runs until the user clicks Approve. Deny ends the call.
- No delete tool. Updates are by id only, never by `where`.
- The approval response travels in the client's messages. That is acceptable because the write still runs through the local API as the same session user with `overrideAccess: false`: a forged approval cannot do more than the admin UI already allows that user.

## Tools

Generic read tools: `describeSchema`, `countDocuments`, `recentChanges`, `seoAudit`, `findBrokenReferences`, `unusedMedia`.

Per collection in scope: `find<Collection>` (e.g. `findPages`, names mirror `@payloadcms/plugin-mcp`), `create<Collection>`, `update<Collection>`. Per global: `find<Global>`, `update<Global>`.

- `find*` returns a compact summary per document (id, `useAsTitle`, `slug`, `_status`, dates, `meta` title/description/image) plus `links: { admin, public? }`. `fields` adds top-level fields; `includeContent` adds rich text as plain text. Reads drafts by default. Max `limits.maxDocuments` per call.
- `seoAudit` finds collections with a plugin-seo style `meta` group (`title`, `description`, optional `image`) and reports missing values, titles outside 50-60 characters, descriptions outside 100-150 characters, duplicate titles and missing images. Bounds are fixed in this version.
- `findBrokenReferences` walks relationship, upload and rich-text references (groups, tabs, arrays, blocks) in one collection or one global and reports targets that are missing or unpublished. A document referencing itself, such as its own nested-docs breadcrumb, is skipped.
- `unusedMedia` lists uploads no in-scope collection or global references. Coarse: at most 2000 documents scanned per collection; the output says when the cap was hit.
- Tool output is cut at `limits.maxToolOutputChars` with a note asking the model to narrow the query.

## Scope

By default the chat sees what the logged-in user sees in the admin sidebar: every collection and global whose `admin.hidden` is not set for that user. `admin.hidden` functions are called with the request user, per chat request; a function that throws counts as hidden. `collections` and `globals` replace that default with exact slug lists; unknown slugs are ignored with a warning. Auth collections and `payload-*` internals are always excluded.

## Model select

- The widget shows a dropdown of `models` (`description` is the option's tooltip), preselected to `defaultModel`.
- The client sends the chosen id as `model` in the request body. The endpoint answers `400 Unknown model.` for any id outside the list; the mode never comes from the body.
- The choice is per user, stored in Payload's `payload-preferences` collection under the key `payload-ai-assistant-model` as `{ id }`. It survives reloads and other browsers; changing it mid-conversation applies to the next message. Everyone with access to the widget may pick.

## Widget

Full width on the dashboard. It is a card styled after Payload v4 (scoped custom properties, light and dark): a header with the title, mode chip and model picker, a search-style composer and the quick prompts. Once a conversation starts it shows chat bubbles and grows with the content (no inner scroll). Reasoning shows as a collapsible "Thinking..." line; tool calls show as one-line steps that collapse into a "Used n tools" toggle when the answer is done. Enter sends, Shift+Enter adds a newline.

The conversation lives in an admin-wide provider (`admin.components.providers`), so it survives client-side navigation and keeps streaming while the dashboard is not shown. Same-origin links in answers navigate client-side. Completed turns are saved to `sessionStorage` per user: a reload restores them, closing the tab, logging out, switching user or "New" clears them. Nothing is stored on the server.

### Dashboard preferences

The plugin adds the widget to `admin.dashboard.defaultLayout` (it wraps a function layout, inserts into an array layout, or creates `[chat, collections]`). Users who already rearranged their dashboard have a saved layout preference and will not see the widget until they add it in the dashboard's edit mode. The plugin does not touch preferences.

## Testing a local build

```sh
pnpm build && pnpm pack   # payload-ai-assistant-1.0.0.tgz
```

In the consuming project:

```json
"payload-ai-assistant": "file:../payload-ai-assistant-plugin/payload-ai-assistant-1.0.0.tgz"
```

Run `pnpm install` and `payload generate:importmap`. After every repack, reinstall (pnpm caches tarballs by integrity; `pnpm install --force` if it does not pick up the change).

## Development

Built on the official Payload plugin template. `dev/` is a Payload app that loads the plugin straight from `src/`.

```sh
pnpm install
cp dev/.env.example dev/.env   # DATABASE_URL (MongoDB), PAYLOAD_SECRET, OPENROUTER_API_KEY
pnpm dev                       # http://localhost:3000/admin, dev@payloadcms.com / test
```

```sh
pnpm test:int   # Unit specs in src/ plus dev/int.spec.ts on in-memory MongoDB; no API key needed
pnpm test:e2e   # Playwright against pnpm dev
pnpm lint
pnpm build
```

After changing component paths, run `pnpm generate:importmap`; after changing the dev schema, `pnpm generate:types`.

## License

MIT, WLF Studios.
