'use client'

import type { UIMessage } from 'ai'
import type { ReactNode } from 'react'

import { Chat } from '@ai-sdk/react'
import { useAuth, useConfig, usePreferences } from '@payloadcms/ui'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai'
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { MODEL_PREFERENCE_KEY } from '../defaults.js'
import { clearStoredChats, loadMessages, saveMessages, storageKey } from './session.js'

type Session = { chat: Chat<UIMessage>; key: string }

type AiAssistantContextValue = {
  chat?: Chat<UIMessage>
  model?: string
  /** Creates the chat for the current user on first use and seeds the model. */
  open: (initialModel?: string) => void
  reset: () => void
  setModel: (id: string) => void
}

const AiAssistantContext = createContext<AiAssistantContextValue | null>(null)

export function useAiAssistant(): AiAssistantContextValue {
  const value = use(AiAssistantContext)
  if (!value) {
    throw new Error('payload-ai-assistant: AiAssistantProvider is not registered')
  }
  return value
}

export function AiAssistantProvider({
  children,
  endpointPath,
}: {
  children?: ReactNode
  endpointPath: string
}) {
  const { config } = useConfig()
  const { user } = useAuth()
  const { setPreference } = usePreferences()
  const key = user ? storageKey(user) : undefined
  const api = `${config.routes.api}${endpointPath}`
  const [session, setSession] = useState<Session>()
  const sessionRef = useRef<Session>(undefined)
  const [model, setModelState] = useState<string>()
  const modelRef = useRef<string>(undefined)

  const drop = useCallback(() => {
    const current = sessionRef.current
    if (!current) {
      return
    }
    sessionRef.current = undefined
    void current.chat.stop()
    saveMessages(current.key, [])
    setSession(undefined)
    modelRef.current = undefined
    setModelState(undefined)
  }, [])

  // Logout or a different user drops the chat and its stored copy.
  useEffect(() => {
    if (!key) {
      clearStoredChats()
    }
    if (sessionRef.current && sessionRef.current.key !== key) {
      drop()
    }
  }, [drop, key])

  const open = useCallback(
    (initialModel?: string) => {
      if (!key || sessionRef.current?.key === key) {
        return
      }
      drop()
      modelRef.current = initialModel
      setModelState(initialModel)
      const chat: Chat<UIMessage> = new Chat<UIMessage>({
        messages: loadMessages(key),
        onFinish: ({ messages }) => {
          if (sessionRef.current?.chat === chat) {
            saveMessages(key, messages)
          }
        },
        sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
        transport: new DefaultChatTransport({
          api,
          body: () => (modelRef.current ? { model: modelRef.current } : {}),
          credentials: 'include',
        }),
      })
      sessionRef.current = { chat, key }
      setSession(sessionRef.current)
    },
    [api, drop, key],
  )

  const reset = useCallback(() => {
    const current = sessionRef.current
    if (!current) {
      return
    }
    if (current.chat.status === 'submitted' || current.chat.status === 'streaming') {
      void current.chat.stop()
    }
    current.chat.clearError()
    current.chat.messages = []
    saveMessages(current.key, [])
  }, [])

  const setModel = useCallback(
    (id: string) => {
      modelRef.current = id
      setModelState(id)
      void setPreference(MODEL_PREFERENCE_KEY, { id })
    },
    [setPreference],
  )

  const value = useMemo(
    () => ({
      chat: session && session.key === key ? session.chat : undefined,
      model,
      open,
      reset,
      setModel,
    }),
    [key, model, open, reset, session, setModel],
  )

  return <AiAssistantContext value={value}>{children}</AiAssistantContext>
}
