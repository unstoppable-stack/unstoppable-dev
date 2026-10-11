// UTF-8 byte bounds are conservative input limits, not token counts.
function byteLength(text) {
  let bytes = 0
  for (const char of text) {
    const code = char.codePointAt(0)
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4
  }
  return bytes
}

export function prepareChatHistory(history, byteBudget) {
  if (!Number.isSafeInteger(byteBudget) || byteBudget <= 0) throw new Error('Invalid history byte budget')
  if (!Array.isArray(history) || !history.length || history.some(m =>
    !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string')) {
    throw new Error('Chat history must contain user and assistant text messages.')
  }
  if (history.at(-1).role !== 'user') throw new Error('The latest message must be from the user.')
  const cost = messages => messages.reduce((n, m) => n + byteLength(m.content) + 32, 0)
  if (cost(history.slice(-1)) > byteBudget) throw new Error('Message too long for this model. Shorten it and try again.')
  const selected = history.map(m => ({ role: m.role, content: m.content }))
  while (cost(selected) > byteBudget && selected.length > 1) {
    selected.shift()
    while (selected.length > 1 && selected[0].role !== 'user') selected.shift()
  }
  return selected
}

export async function* streamChat(adapter, modelId, history, byteBudget, onTrim = () => {}) {
  let selected = prepareChatHistory(history, byteBudget)
  if (selected.length < history.length) onTrim()
  let emitted = false
  for (;;) {
    try {
      for await (const token of adapter.stream(modelId, selected)) {
        if (token) emitted = true
        yield token
      }
      return
    } catch (err) {
      if (emitted || selected.length <= 1 || err?.name !== 'ContextOverflowError') throw err
      selected = selected.slice(-1)
      onTrim()
    }
  }
}
