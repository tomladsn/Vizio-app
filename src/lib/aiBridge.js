import { settingsStore } from '../store/settingsStore'

function buildPayload(messages, overrides = {}) {
  const cfg = settingsStore.getActiveConfig()
  return {
    messages,
    providerId: cfg.providerId,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    maxTokens: cfg.maxTokens,
    temperature: cfg.temperature,
    ...overrides,
  }
}

export async function completeChat(messages, { retries = 2 } = {}) {
  const res = await window.electron.ai.complete(buildPayload(messages, { retries }))
  if (!res.ok) {
    const err = new Error(res.message || 'AI request failed')
    err.status = res.status ?? 0
    err.cancelled = !!res.cancelled
    throw err
  }
  return res.text ?? ''
}

export function streamChat(messages, { onDelta, onStatus, signal } = {}) {
  const requestId = crypto.randomUUID()
  const channel = `ai:stream:${requestId}`
  const cfg = settingsStore.getActiveConfig()

  return new Promise((resolve, reject) => {
    let unsub = null

    function cleanup() {
      unsub?.()
      unsub = null
    }

    unsub = window.electron.ai.onStream(channel, (payload) => {
      if (payload.status) onStatus?.(payload.status)
      if (payload.delta) onDelta?.(payload.delta)
      if (payload.done) {
        cleanup()
        resolve(payload.fullText ?? '')
      }
      if (payload.error) {
        cleanup()
        const err = new Error(payload.error)
        err.status = payload.status ?? 0
        err.cancelled = !!payload.cancelled
        reject(err)
      }
    })

    const onAbort = () => {
      window.electron.ai.abortStream(requestId)
      cleanup()
      const err = new Error('Aborted')
      err.cancelled = true
      reject(err)
    }

    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener?.('abort', onAbort, { once: true })

    window.electron.ai.startStream({
      requestId,
      messages,
      providerId: cfg.providerId,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      maxTokens: cfg.maxTokens,
      temperature: cfg.temperature,
    }).catch(err => {
      cleanup()
      reject(err)
    })
  })
}
