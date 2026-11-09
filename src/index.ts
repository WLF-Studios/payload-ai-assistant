import type { Config, DashboardConfig, WidgetInstance } from 'payload'

import { definePlugin } from 'payload'

import type { AiAssistantPluginConfig, StoredChatConfig } from './types.js'

import {
  COLLECTIONS_WIDGET_SLUG,
  DEFAULT_ENDPOINT_PATH,
  DEFAULT_LIMITS,
  DEFAULT_WIDGET_LABEL,
  DEFAULT_WIDGET_SLUG,
  defaultModels,
  defaultQuickPrompts,
  PLUGIN_SLUG,
} from './defaults.js'
import { createChatHandler } from './endpoints/chat.js'
import { resolveMode } from './mode.js'
import { resolveDefaultModel, resolveProvider } from './model.js'

export { defaultModels, defaultQuickPrompts } from './defaults.js'

export type {
  AiAssistantAccess,
  AiAssistantDocumentURL,
  AiAssistantLimits,
  AiAssistantMode,
  AiAssistantModel,
  AiAssistantModelProvider,
  AiAssistantPluginConfig,
  AiAssistantQuickPrompt,
  AiAssistantTool,
  ResolvedScope,
} from './types.js'

export function placeWidget(
  layout: WidgetInstance[],
  widgetSlug: string,
  position: 'after-collections' | 'before-collections',
): WidgetInstance[] {
  if (layout.some((widget) => widget.widgetSlug === widgetSlug)) {
    return layout
  }
  const entry = { widgetSlug, width: 'full' } as WidgetInstance
  const index = layout.findIndex((widget) => widget.widgetSlug === COLLECTIONS_WIDGET_SLUG)
  const at =
    position === 'before-collections'
      ? Math.max(index, 0)
      : index === -1
        ? layout.length
        : index + 1
  return [...layout.slice(0, at), entry, ...layout.slice(at)]
}

export const aiAssistantPlugin = definePlugin<AiAssistantPluginConfig>({
  slug: PLUGIN_SLUG,
  order: 20,
  plugin: ({ config, plugins: _plugins, ...options }): Config => {
    if (options.disabled) {
      return config
    }
    const endpointPath = options.endpointPath?.startsWith('/')
      ? options.endpointPath
      : `/${options.endpointPath ?? DEFAULT_ENDPOINT_PATH.slice(1)}`
    const widgetSlug = options.widget?.slug ?? DEFAULT_WIDGET_SLUG
    const position = options.widget?.position ?? 'before-collections'
    const models = options.models ?? defaultModels
    const stored: StoredChatConfig = {
      access: options.access,
      defaultModel: resolveDefaultModel(models, options.defaultModel),
      endpointPath,
      limits: { ...DEFAULT_LIMITS, ...options.limits },
      mode: resolveMode(options.mode),
      models,
      quickPrompts: options.quickPrompts ?? defaultQuickPrompts,
      widgetSlug,
    }
    const provider = resolveProvider(options)

    const dashboard: DashboardConfig = config.admin?.dashboard ?? { widgets: [] }
    const existing = dashboard.defaultLayout
    const defaultLayout: DashboardConfig['defaultLayout'] =
      typeof existing === 'function'
        ? async (args) => placeWidget(await existing(args), widgetSlug, position)
        : placeWidget(
            existing ?? [{ widgetSlug: COLLECTIONS_WIDGET_SLUG, width: 'full' } as WidgetInstance],
            widgetSlug,
            position,
          )

    return {
      ...config,
      admin: {
        ...config.admin,
        components: {
          ...config.admin?.components,
          providers: [
            ...(config.admin?.components?.providers ?? []),
            {
              clientProps: { endpointPath },
              path: 'payload-ai-assistant/client#AiAssistantProvider',
            },
          ],
        },
        dashboard: {
          ...dashboard,
          defaultLayout,
          widgets: [
            ...dashboard.widgets,
            {
              slug: widgetSlug,
              Component: 'payload-ai-assistant/rsc#AiAssistantWidget',
              label: options.widget?.label ?? DEFAULT_WIDGET_LABEL,
              minWidth: 'full',
            },
          ],
        },
      },
      custom: { ...config.custom, [PLUGIN_SLUG]: stored },
      endpoints: [
        ...(config.endpoints ?? []),
        {
          handler: createChatHandler(options, stored, provider),
          method: 'post',
          path: endpointPath,
        },
      ],
    }
  },
})
