import { useState, useEffect, useCallback } from 'react'
import { settingsStore, PROVIDERS } from '../store/settingsStore'

/**
 * Tracks which provider API keys exist in the OS-encrypted store.
 * Never exposes plaintext keys to the renderer.
 */
export function useSecureKeys() {
  const [keyIds, setKeyIds] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const ids = await window.electron?.keys?.listSet?.() ?? []
      setKeyIds(ids)
    } catch {
      setKeyIds([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const unsubSettings = settingsStore.subscribe(() => refresh())
    const unsubKeys = settingsStore.subscribeKeys(() => refresh())
    return () => {
      unsubSettings()
      unsubKeys()
    }
  }, [refresh])

  function hasKeyForProvider(providerId) {
    const provider = PROVIDERS.find(p => p.id === providerId)
    if (!provider?.requiresKey) return true
    return keyIds.includes(`${providerId}ApiKey`)
  }

  function isProviderReady(providerId) {
    const s = settingsStore.get()
    const hasModel = !!s[`${providerId}Model`]?.trim()
    if (providerId === 'ollama') return hasModel
    return hasKeyForProvider(providerId) && hasModel
  }

  const activeProvider = settingsStore.get().activeProvider

  return {
    keyIds,
    loading,
    refresh,
    hasKeyForProvider,
    isProviderReady,
    isActiveReady: isProviderReady(activeProvider),
    activeProvider,
  }
}
