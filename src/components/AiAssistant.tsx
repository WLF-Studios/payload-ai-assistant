'use client'

import type { Chat } from '@ai-sdk/react'
import type { DynamicToolUIPart, ReasoningUIPart, ToolUIPart, UIMessage } from 'ai'
import type { FormEvent, KeyboardEvent } from 'react'

import { useChat } from '@ai-sdk/react'
import { getToolName, isToolUIPart } from 'ai'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { AiAssistantMode, AiAssistantModel } from '../types.js'

import styles from './AiAssistant.module.css'
import { useAiAssistant } from './AiAssistantProvider.js'
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronIcon,
  CrossIcon,
  PlusIcon,
  SearchIcon,
  SparkleIcon,
  StopIcon,
} from './icons.js'
import { Markdown } from './Markdown.js'
import { strings } from './strings.js'

type ViewProps = {
  mode: AiAssistantMode
  models: AiAssistantModel[]
  quickPrompts: Array<{ label: string; prompt: string }>
}

type Props = { initialModel?: string } & ViewProps

type Part = UIMessage['parts'][number]
type ToolPart = DynamicToolUIPart | ToolUIPart
type Respond = (args: { approved: boolean; id: string }) => void

const VERBS: Record<string, string> = { create: 'Creating', find: 'Searching', update: 'Updating' }

const humanise = (name: string) =>
  name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase())

function stepLabel(name: string): string {
  const match = /^(find|create|update)([A-Z].*)$/.exec(name)
  return match
    ? strings.toolRunning(VERBS[match[1]], humanise(match[2]).toLowerCase())
    : strings.toolRunning('Running', humanise(name))
}

function outputText(output: unknown): string {
  const content = (output as { content?: unknown } | undefined)?.content
  if (Array.isArray(content)) {
    return content
      .map((item: { text?: unknown; type?: unknown }) =>
        item?.type === 'text' && typeof item.text === 'string' ? item.text : '',
      )
      .join('\n')
  }
  return typeof output === 'string' ? output : JSON.stringify(output ?? '')
}

const firstLine = (text: string) => text.split('\n').find((line) => line.trim()) ?? ''

const isErrorOutput = (output: unknown) => Boolean((output as { isError?: unknown })?.isError)

function prettyInput(input: unknown): string {
  const { data, ...rest } = (input ?? {}) as Record<string, unknown>
  let parsed = data
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data)
    } catch {
      parsed = data
    }
  }
  return JSON.stringify(data === undefined ? rest : { ...rest, data: parsed }, null, 2)
}

const isApprovalPart = (part: ToolPart) => Boolean(part.approval) || part.state === 'output-denied'

function isVisiblePart(part: Part, live: boolean): boolean {
  if (part.type === 'text') {
    return Boolean(part.text.trim())
  }
  if (part.type === 'reasoning') {
    return Boolean(part.text.trim()) || (live && part.state === 'streaming')
  }
  return isToolUIPart(part)
}

const hasContent = (message: UIMessage, live: boolean) =>
  message.parts.some((part) => isVisiblePart(part, live))

const messageText = (message: UIMessage) =>
  message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('')

function Avatar() {
  return (
    <span aria-hidden="true" className={styles.avatar}>
      <SparkleIcon size={24} />
    </span>
  )
}

function Toggle({
  expanded,
  label,
  onToggle,
  pulse,
}: {
  expanded: boolean
  label: string
  onToggle: () => void
  pulse?: boolean
}) {
  return (
    <button
      aria-expanded={expanded}
      className={`${styles.toggle} ${pulse ? styles.pulse : ''}`}
      onClick={onToggle}
      type="button"
    >
      {label}
      <ChevronIcon size={12} />
    </button>
  )
}

function ToolStep({ part }: { part: ToolPart }) {
  const failed =
    part.state === 'output-error' ||
    (part.state === 'output-available' && isErrorOutput(part.output))
  if (failed) {
    return (
      <div className={`${styles.step} ${styles.stepError}`}>
        <span className={styles.stepIcon}>
          <CrossIcon size={12} />
        </span>
        <span className={styles.stepLabel}>
          {firstLine(part.errorText ?? outputText(part.output)) || strings.error}
        </span>
      </div>
    )
  }
  const done = part.state === 'output-available'
  return (
    <div className={styles.step}>
      <span className={styles.stepIcon}>
        {done ? <CheckIcon size={12} /> : <span className={styles.spinner} />}
      </span>
      <span className={styles.stepLabel}>
        {done ? firstLine(outputText(part.output)) : stepLabel(getToolName(part))}
      </span>
    </div>
  )
}

function Reasoning({ live, part }: { live: boolean; part: ReasoningUIPart }) {
  const [expanded, setExpanded] = useState(false)
  const thinking = live && part.state === 'streaming'
  return (
    <div className={styles.reasoning}>
      <Toggle
        expanded={expanded}
        label={thinking ? strings.thinking : strings.thought}
        onToggle={() => setExpanded(!expanded)}
        pulse={thinking}
      />
      {expanded && part.text.trim() && <div className={styles.reasoningText}>{part.text}</div>}
    </div>
  )
}

function ApprovalCard({
  busy,
  onRespond,
  part,
}: {
  busy: boolean
  onRespond: Respond
  part: ToolPart
}) {
  const result =
    part.state === 'output-available'
      ? outputText(part.output)
      : part.state === 'output-error'
        ? part.errorText
        : ''
  return (
    <div className={styles.approval}>
      <div className={styles.approvalTitle}>{humanise(getToolName(part))}</div>
      <pre className={styles.approvalInput}>{prettyInput(part.input)}</pre>
      {part.state === 'approval-requested' && (
        <div className={styles.approvalActions}>
          <button
            className={`${styles.button} ${styles.primary}`}
            disabled={busy}
            onClick={() => onRespond({ id: part.approval.id, approved: true })}
            type="button"
          >
            {strings.approve}
          </button>
          <button
            className={`${styles.button} ${styles.secondary}`}
            disabled={busy}
            onClick={() => onRespond({ id: part.approval.id, approved: false })}
            type="button"
          >
            {strings.deny}
          </button>
        </div>
      )}
      {part.state === 'approval-responded' && (
        <div className={styles.muted}>
          {part.approval.approved ? strings.approvalPending : strings.denied}
        </div>
      )}
      {part.state === 'output-denied' && <div className={styles.muted}>{strings.denied}</div>}
      {result && (
        <div
          className={`${styles.muted} ${
            part.state === 'output-error' || isErrorOutput(part.output) ? styles.danger : ''
          }`}
        >
          <Markdown>{firstLine(result)}</Markdown>
        </div>
      )}
    </div>
  )
}

function AssistantMessage({
  busy,
  live,
  message,
  onRespond,
}: {
  busy: boolean
  live: boolean
  message: UIMessage
  onRespond: Respond
}) {
  const [expanded, setExpanded] = useState(false)
  const steps = message.parts.filter(
    (part): part is ToolPart => isToolUIPart(part) && !isApprovalPart(part),
  )

  return (
    <div className={styles.assistantRow}>
      <div className={`${styles.bubble} ${styles.assistant}`}>
        {message.parts.map((part, index) => {
          if (part.type === 'text') {
            return part.text.trim() ? <Markdown key={index}>{part.text}</Markdown> : null
          }
          if (part.type === 'reasoning') {
            return isVisiblePart(part, live) ? (
              <Reasoning key={index} live={live} part={part} />
            ) : null
          }
          if (!isToolUIPart(part)) {
            return null
          }
          if (isApprovalPart(part)) {
            return <ApprovalCard busy={busy} key={index} onRespond={onRespond} part={part} />
          }
          if (live) {
            return <ToolStep key={index} part={part} />
          }
          // Finished turns collapse all steps into one pill at the first step's position.
          if (part !== steps[0]) {
            return null
          }
          return (
            <div className={styles.steps} key={index}>
              <Toggle
                expanded={expanded}
                label={strings.toolsUsed(steps.length)}
                onToggle={() => setExpanded(!expanded)}
              />
              {expanded && steps.map((step) => <ToolStep key={step.toolCallId} part={step} />)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TypingBubble() {
  return (
    <div className={styles.assistantRow}>
      <div
        aria-label={strings.typing}
        className={`${styles.bubble} ${styles.assistant} ${styles.typing}`}
        role="status"
      >
        <span />
        <span />
        <span />
      </div>
    </div>
  )
}

function ChatView({ chat, mode, models, quickPrompts }: { chat: Chat<UIMessage> } & ViewProps) {
  const { model, reset, setModel } = useAiAssistant()
  const {
    addToolApprovalResponse,
    clearError,
    error,
    messages,
    regenerate,
    sendMessage,
    status,
    stop,
  } = useChat({ chat })
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastUserRef = useRef<HTMLDivElement>(null)
  const sentRef = useRef(false)
  const busy = status === 'submitted' || status === 'streaming'
  const last = messages.at(-1)
  const lastUser = messages.filter((message) => message.role === 'user').at(-1)
  const typing = busy && (!last || last.role === 'user' || !hasContent(last, true))

  useLayoutEffect(() => {
    const textarea = inputRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [input])

  useEffect(() => {
    if (sentRef.current) {
      sentRef.current = false
      inputRef.current?.focus({ preventScroll: true })
      lastUserRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [messages.length])

  const send = (text: string) => {
    const value = text.trim()
    if (!value || busy) {
      return
    }
    clearError()
    sentRef.current = true
    void sendMessage({ text: value })
    setInput('')
  }
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    send(input)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send(input)
    }
  }
  const onRespond: Respond = (args) => void addToolApprovalResponse(args)

  return (
    <div className={styles.widget}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <Avatar />
          <span className={styles.title}>{strings.title}</span>
          <span className={styles.modeChip}>
            {mode === 'full' ? strings.modeFull : strings.modeRead}
          </span>
        </div>
        <div className={styles.headerActions}>
          {models.length > 0 && (
            <span className={styles.select}>
              <select
                aria-label={strings.model}
                onChange={(event) => setModel(event.target.value)}
                value={model ?? ''}
              >
                {models.map((item) => (
                  <option key={item.id} title={item.description} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronIcon size={12} />
            </span>
          )}
          {messages.length > 0 && (
            <button className={`${styles.button} ${styles.ghost}`} onClick={reset} type="button">
              <PlusIcon size={12} />
              {strings.newConversation}
            </button>
          )}
        </div>
      </div>
      {messages.length > 0 && (
        <div className={styles.messages}>
          {messages.map((message) => {
            if (message.role === 'user') {
              return (
                <div
                  className={`${styles.bubble} ${styles.user}`}
                  key={message.id}
                  ref={message === lastUser ? lastUserRef : undefined}
                >
                  {messageText(message)}
                </div>
              )
            }
            const live = busy && message === last
            return hasContent(message, live) ? (
              <AssistantMessage
                busy={busy}
                key={message.id}
                live={live}
                message={message}
                onRespond={onRespond}
              />
            ) : null
          })}
          {typing && <TypingBubble />}
        </div>
      )}
      {error && (
        <div className={styles.error}>
          <span>{error.message || strings.error}</span>
          {messages.length > 0 && (
            <button
              className={`${styles.button} ${styles.secondary}`}
              onClick={() => {
                clearError()
                void regenerate()
              }}
              type="button"
            >
              {strings.retry}
            </button>
          )}
        </div>
      )}
      <form className={styles.composer} onSubmit={onSubmit}>
        <span className={styles.searchIcon}>
          <SearchIcon />
        </span>
        <textarea
          aria-label={strings.placeholder}
          className={styles.input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={strings.placeholder}
          ref={inputRef}
          rows={1}
          value={input}
        />
        {busy ? (
          <button
            aria-label={strings.stop}
            className={`${styles.sendButton} ${styles.stop}`}
            key="stop"
            onClick={() => void stop()}
            title={strings.stop}
            type="button"
          >
            <StopIcon size={10} />
          </button>
        ) : (
          <button
            aria-label={strings.send}
            className={styles.sendButton}
            disabled={!input.trim()}
            key="send"
            title={strings.send}
            type="submit"
          >
            <ArrowUpIcon />
          </button>
        )}
      </form>
      {quickPrompts.length > 0 && (
        <div className={styles.prompts}>
          {quickPrompts.map((item) => (
            <button
              className={`${styles.button} ${styles.chip}`}
              key={item.label}
              onClick={() => send(item.prompt)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function AiAssistant({ initialModel, ...props }: Props) {
  const { chat, open } = useAiAssistant()
  // The chat is created after mount so the server render never reads sessionStorage.
  useEffect(() => {
    if (!chat) {
      open(initialModel)
    }
  }, [chat, initialModel, open])
  return chat ? <ChatView chat={chat} {...props} /> : null
}
