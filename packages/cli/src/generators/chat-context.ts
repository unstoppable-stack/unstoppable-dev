/** Shared generated Bare helper. UTF-8 bytes bound input conservatively; SDK overflow remains authoritative. */
export const chatContextSource = `import b4a from 'b4a'

export function prepareChatHistory(history, byteBudget) {
  if (!Array.isArray(history) || !history.length || history.some(m =>
    !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string')) {
    throw new Error('Chat history must contain user and assistant text messages.')
  }
  if (history[history.length - 1].role !== 'user') throw new Error('The latest message must be from the user.')
  const cost = messages => messages.reduce((n, m) => n + b4a.byteLength(m.content, 'utf8') + 32, 0)
  const latest = history.slice(-1)
  if (cost(latest) > byteBudget) throw new Error('Message too long for this model. Shorten it and try again.')
  let selected = history.slice()
  while (cost(selected) > byteBudget && selected.length > 1) {
    selected.shift()
    while (selected.length > 1 && selected[0].role !== 'user') selected.shift()
  }
  return selected
}

export async function* streamChat(sdk, modelId, history, byteBudget, onTrim = () => {}) {
  let selected = prepareChatHistory(history, byteBudget)
  if (selected.length < history.length) onTrim()
  let emitted = false
  for (;;) {
    try {
      const result = sdk.completion({ modelId, history: selected, stream: true })
      for await (const token of result.tokenStream) {
        if (token) emitted = true
        yield token
      }
      return
    } catch (err) {
      // Retry only before visible output, once with the latest user message.
      if (emitted || selected.length <= 1 || err?.name !== 'ContextOverflowError') throw err
      selected = selected.slice(-1)
      onTrim()
    }
  }
}
`
