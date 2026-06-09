/**
 * Provider-agnostic AI client — runs in main process only.
 * API keys are never sent to the renderer.
 */

function getProviderBaseUrl(providerId) {
  const baseUrls = {
    openai: 'https://api.openai.com/v1',
    google: 'https://generativelanguage.googleapis.com/v1beta/openai',
    deepseek: 'https://api.deepseek.com',
    openrouter: 'https://openrouter.ai/api/v1',
  }
  return baseUrls[providerId] || null
}

function buildHeaders(providerId, apiKey) {
  if (providerId === 'anthropic') {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }
  }
  return {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  }
}

async function parseErrorResponse(res) {
  let body = {}
  try {
    body = await res.json()
  } catch (_) {}
  const message = body?.error?.message || body?.message || `HTTP ${res.status}`
  const err = new Error(typeof message === 'string' ? message : JSON.stringify(message))
  err.status = res.status
  return err
}

function normalizeMessageForOpenAI(message) {
  if (typeof message.content === 'string') return message
  if (!Array.isArray(message.content)) return message

  return {
    ...message,
    content: message.content.map(block => {
      if (block.type === 'text') return { type: 'text', text: block.text }
      if (block.type === 'image' && block.source?.type === 'base64') {
        return {
          type: 'image_url',
          image_url: {
            url: `data:${block.source.media_type};base64,${block.source.data}`,
          },
        }
      }
      return block
    }),
  }
}

function normalizeMessagesForOpenAI(messages) {
  return messages.map(normalizeMessageForOpenAI)
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const err = new Error('Aborted')
      err.cancelled = true
      reject(err)
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener?.('abort', () => {
      clearTimeout(timer)
      const err = new Error('Aborted')
      err.cancelled = true
      reject(err)
    }, { once: true })
  })
}

async function readOpenAIStream(res, onDelta, signal) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    if (signal?.aborted) {
      const err = new Error('Aborted')
      err.cancelled = true
      throw err
    }
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) {
          fullText += delta
          onDelta?.(delta)
        }
      } catch (_) {}
    }
  }

  return fullText.trim()
}

async function readAnthropicStream(res, onDelta, signal) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    if (signal?.aborted) {
      const err = new Error('Aborted')
      err.cancelled = true
      throw err
    }
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        if (json.type === 'content_block_delta' && json.delta?.text) {
          fullText += json.delta.text
          onDelta?.(json.delta.text)
        }
      } catch (_) {}
    }
  }

  return fullText.trim()
}

export async function callAI(messages, config, { retries = 3, signal } = {}) {
  let { baseUrl, apiKey, model, providerId } = config
  const maxTokens = Number(config.maxTokens) > 0 ? Number(config.maxTokens) : 2048
  const temperature = Number.isFinite(Number(config.temperature)) ? Number(config.temperature) : 0.2

  // Determine baseUrl if not provided
  if (!baseUrl && providerId !== 'anthropic') {
    baseUrl = getProviderBaseUrl(providerId)
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    if (signal?.aborted) {
      const err = new Error('Aborted')
      err.cancelled = true
      throw err
    }

    try {
      let res
      const payloadMessages = providerId === 'anthropic'
        ? messages
        : normalizeMessagesForOpenAI(messages)

      if (providerId === 'anthropic') {
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal,
          headers: buildHeaders(providerId, apiKey),
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            system: messages.find(m => m.role === 'system')?.content ?? '',
            messages: messages.filter(m => m.role !== 'system'),
          }),
        })
      } else {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          signal,
          headers: buildHeaders(providerId, apiKey),
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature,
            stream: false,
            messages: payloadMessages,
          }),
        })
      }

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') ?? '0', 10)
        const wait = retryAfter > 0 ? retryAfter * 1000 : Math.min(2000 * attempt, 10000)
        if (attempt < retries) {
          await sleep(wait, signal)
          continue
        }
        throw new Error('Rate limit — too many requests. Try again shortly.')
      }

      if (!res.ok) throw await parseErrorResponse(res)

      if (providerId === 'anthropic') {
        const data = await res.json()
        return data.content?.[0]?.text?.trim() ?? ''
      }
      const data = await res.json()
      return data.choices?.[0]?.message?.content?.trim() ?? ''
    } catch (err) {
      if (err.cancelled || signal?.aborted) throw err
      if (attempt === retries) throw err
      if (err.message?.includes('Rate limit')) throw err
      await sleep(1000 * attempt, signal)
    }
  }

  return ''
}

export async function streamAI(messages, config, { onDelta, signal } = {}) {
  let { baseUrl, apiKey, model, providerId } = config
  const maxTokens = Number(config.maxTokens) > 0 ? Number(config.maxTokens) : 2048
  const temperature = Number.isFinite(Number(config.temperature)) ? Number(config.temperature) : 0.2

  // Determine baseUrl if not provided
  if (!baseUrl && providerId !== 'anthropic') {
    baseUrl = getProviderBaseUrl(providerId)
  }

  const payloadMessages = providerId === 'anthropic'
    ? messages
    : normalizeMessagesForOpenAI(messages)

  if (providerId === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: buildHeaders(providerId, apiKey),
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        stream: true,
        system: messages.find(m => m.role === 'system')?.content ?? '',
        messages: messages.filter(m => m.role !== 'system'),
      }),
    })
    if (!res.ok) throw await parseErrorResponse(res)
    return readAnthropicStream(res, onDelta, signal)
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: buildHeaders(providerId, apiKey),
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      stream: true,
      messages: payloadMessages,
    }),
  })

  if (!res.ok) throw await parseErrorResponse(res)
  return readOpenAIStream(res, onDelta, signal)
}

export function buildAIConfig({ providerId, baseUrl, model, maxTokens, temperature, apiKey }) {
  return {
    providerId,
    baseUrl,
    model,
    maxTokens,
    temperature,
    apiKey: apiKey ?? '',
  }
}
