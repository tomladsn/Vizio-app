import React, { useState, useEffect } from 'react'
import { settingsStore, PROVIDERS, ACCENTS, THEMES, FONT_PRESETS, MODEL_HINTS, MODEL_PRESETS } from '../store/settingsStore'
import { useSecureKeys } from '../hooks/useSecureKeys'
import './SettingsPage.css'

export default function SettingsPage() {
  const [settings, setSettings] = useState(settingsStore.get())
  const [activeTab, setActiveTab] = useState('api')
  const [shown, setShown] = useState({})
  const [saved, setSaved] = useState(false)

  function update(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    settingsStore.save(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="settings-page">
      <div className="settings-toolbar">
        <span className="settings-title">Settings</span>
        <button className={`save-btn ${saved ? 'saved' : ''}`} onClick={handleSave}>
          {saved ? 'saved!' : 'save changes'}
        </button>
      </div>

      <div className="settings-body">
        <aside className="settings-nav">
          <div className="snav-label">Preferences</div>
          <div className={`snav-item ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}>
            API & models
          </div>
          <div className={`snav-item ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}>
            Appearance
          </div>
        </aside>

        <div className="settings-content">
          {activeTab === 'api' && (
            <ApiTab
              settings={settings}
              shown={shown}
              onToggleShow={id => setShown(prev => ({ ...prev, [id]: !prev[id] }))}
              onUpdate={update}
            />
          )}
          {activeTab === 'appearance' && (
            <AppearanceTab settings={settings} onUpdate={update} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── API Tab ──────────────────────────────────────────────────────────────────
function ApiTab({ settings, shown, onToggleShow, onUpdate }) {
  const activeProvider = settings.activeProvider
  const { hasKeyForProvider } = useSecureKeys()

  return (
    <>

      <section className="settings-section">
        <div className="section-title">Connected AI accounts</div>
        <p className="section-desc">Connect each provider once. Vizio stores credentials securely and uses the selected account for chat and workflows.</p>
        <div className="provider-tabs">
          {PROVIDERS.map(p => {
            const hasKey = p.requiresKey ? hasKeyForProvider(p.id) : true
            const hasModel = !!settings[`${p.id}Model`]?.trim()
            const isReady = hasKey && hasModel
            const status = isReady ? 'connected' : hasKey ? 'needs model' : 'connect'
            return (
              <button
                key={p.id}
                className={`provider-tab ${activeProvider === p.id ? 'active' : ''}`}
                onClick={() => onUpdate('activeProvider', p.id)}
              >
                <div className="ptab-top">
                  <span className="ptab-label">{p.label}</span>
                  <span className={`ptab-dot ${isReady ? 'ready' : hasKey ? 'partial' : 'empty'}`} />
                </div>
                <div className="ptab-desc">{p.desc}</div>
                <div className={`ptab-status ${isReady ? 'ready' : hasKey ? 'partial' : 'empty'}`}>{status}</div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Active provider config */}
      {PROVIDERS.map(p => activeProvider === p.id && (
        <ProviderConfig
          key={p.id}
          provider={p}
          settings={settings}
          shown={shown[p.id]}
          onToggleShow={() => onToggleShow(p.id)}
          onUpdate={onUpdate}
        />
      ))}
    </>
  )
}

function buildProviderPayload(pid, settings) {
  let baseUrl = settings[`${pid}Endpoint`] || null
  if (pid === 'ollama') {
    baseUrl = settings.ollamaEndpoint || 'http://localhost:11434'
    if (baseUrl && !baseUrl.endsWith('/v1') && !baseUrl.endsWith('/v1/')) {
      baseUrl = baseUrl.replace(/\/$/, '') + '/v1'
    }
  }

  return {
    providerId: pid,
    baseUrl,
    model: settings[`${pid}Model`] || '',
    maxTokens: settings[`${pid}MaxTokens`] ?? 700,
    temperature: settings[`${pid}Temperature`] ?? 0.2,
  }
}

function ProviderConfig({ provider, settings, onUpdate }) {
  const pid = provider.id
  const hints = MODEL_HINTS[pid]
  const presets = MODEL_PRESETS[pid] ?? []
  const model = settings[`${pid}Model`] ?? ''
  const temperature = settings[`${pid}Temperature`] ?? 0.2
  const maxTokens = settings[`${pid}MaxTokens`] ?? 700
  const hasModel = !!model.trim()

  // ── Secure key state ──────────────────────────────────────────────────────
  // keyDraft  = what the user is currently typing (never persisted)
  // keyHint   = masked display string loaded from encrypted store ("••••••••3f2a")
  // keyExists = whether a key is saved in the encrypted store
  const [keyDraft,   setKeyDraft]   = useState('')
  const [keyHint,    setKeyHint]    = useState('')
  const [keyExists,  setKeyExists]  = useState(false)
  const [showDraft,  setShowDraft]  = useState(false)
  const [keySaving,  setKeySaving]  = useState(false)
  const [keyMsg,     setKeyMsg]     = useState(null) // { ok, text }
  const [testState,  setTestState]  = useState(null) // { status, text }

  const keyId = pid + 'ApiKey'

  useEffect(() => {
    if (!provider.requiresKey && pid !== 'ollama') return
    window.electron.keys.getHint(keyId).then(res => {
      setKeyExists(res.exists)
      setKeyHint(res.hint)
    })
  }, [keyId, provider.requiresKey])

  async function handleSaveKey() {
    if (!keyDraft.trim()) return
    setKeySaving(true)
    setKeyMsg(null)
    setTestState(null)
    const res = await window.electron.keys.set(keyId, keyDraft.trim())
    if (res.ok) {
      const hint = await window.electron.keys.getHint(keyId)
      setKeyExists(hint.exists)
      setKeyHint(hint.hint)
      setKeyDraft('')   // discard the draft immediately
      setShowDraft(false)
      setKeyMsg({ ok: true, text: 'Account connected securely.' })
      settingsStore.notifyKeysUpdated()
      if (hasModel) {
        await handleTestConnection({ assumesKey: true })
      }
    } else {
      setKeyMsg({ ok: false, text: res.message || 'Failed to connect account.' })
    }
    setKeySaving(false)
    setTimeout(() => setKeyMsg(null), 3000)
  }

  async function handleClearKey() {
    setKeySaving(true)
    await window.electron.keys.delete(keyId)
    setKeyExists(false)
    setKeyHint('')
    setKeyDraft('')
    setTestState(null)
    setKeySaving(false)
    setKeyMsg({ ok: true, text: 'Account disconnected.' })
    settingsStore.notifyKeysUpdated()
    setTimeout(() => setKeyMsg(null), 2000)
  }

  async function handleTestConnection({ assumesKey = false } = {}) {
    if (!hasModel) {
      setTestState({ status: 'err', text: 'Choose a model before testing.' })
      return
    }
    if (provider.requiresKey && !keyExists && !assumesKey) {
      setTestState({ status: 'err', text: 'Connect this account before testing.' })
      return
    }

    setTestState({ status: 'loading', text: 'Testing connection...' })
    const res = await window.electron.ai.testProvider(buildProviderPayload(pid, settings))
    setTestState({
      status: res.ok ? 'ok' : 'err',
      text: res.ok ? (res.message || 'Connection verified.') : (res.message || 'Connection test failed.'),
    })
  }

  return (
    <>
      {/* API key — requiresKey OR Ollama */}
      {(provider.requiresKey || pid === 'ollama') && (
        <section className="settings-section">
          <div className="section-title">
            {provider.label} account {pid === 'ollama' && <span className="optional-badge">(Optional)</span>}
          </div>
          <p className="section-desc">
            {pid === 'ollama' ? (
              <span>Use local Ollama without a key, or connect Ollama Cloud with an API key.</span>
            ) : (
              <>
                Connect with a key from{' '}
                <a href={`https://${provider.docsUrl}`} target="_blank" rel="noreferrer">
                  {provider.docsUrl}
                </a>
              </>
            )}
          </p>

          <div className="key-row">
            <div className="key-meta">
              <div className="key-label">Connection credential</div>
              <div className="key-env">{pid === 'ollama' ? 'OLLAMA_API_KEY' : provider.envKey}</div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Current status */}
              {keyExists && !keyDraft && (
                <div className="key-saved-row">
                  <div className="key-status ok">
                    <div className="key-dot" />
                    <span className="key-hint-text">{keyHint}</span>
                  </div>
                  <button
                    className="reveal-btn"
                    onClick={() => { setShowDraft(true); setKeyDraft('') }}
                  >
                    replace
                  </button>
                  <button
                    className="reveal-btn"
                    onClick={() => handleTestConnection()}
                    disabled={testState?.status === 'loading'}
                  >
                    {testState?.status === 'loading' ? 'testing...' : 'test'}
                  </button>
                  <button
                    className="reveal-btn danger"
                    onClick={handleClearKey}
                    disabled={keySaving}
                  >
                    disconnect
                  </button>
                </div>
              )}

              {/* Input for new key */}
              {(!keyExists || keyDraft || showDraft) && (
                <div className="key-input-wrap">
                  <input
                    type={showDraft ? 'text' : 'password'}
                    className="key-input"
                    placeholder={keyExists ? 'Enter new key to replace...' : (pid === 'ollama' ? 'optional API key for Ollama Cloud...' : provider.keyPlaceholder)}
                    value={keyDraft}
                    onChange={e => setKeyDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveKey() }}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button className="reveal-btn" onClick={() => setShowDraft(s => !s)}>
                    {showDraft ? 'hide' : 'show'}
                  </button>
                  <button
                    className="save-btn"
                    style={{ padding: '4px 12px', fontSize: 11 }}
                    onClick={handleSaveKey}
                    disabled={keySaving || !keyDraft.trim()}
                  >
                    {keySaving ? 'connecting...' : keyExists ? 'replace' : 'connect'}
                  </button>
                  {keyExists && (
                    <button className="reveal-btn" onClick={() => { setKeyDraft(''); setShowDraft(false) }}>
                      cancel
                    </button>
                  )}
                </div>
              )}

              {keyMsg && (
                <div className={`key-msg ${keyMsg.ok ? 'ok' : 'err'}`}>{keyMsg.text}</div>
              )}

              {testState && (
                <div className={`connection-test ${testState.status}`}>
                  {testState.text}
                </div>
              )}

              {!keyExists && !keyDraft && (
                <div className="key-status empty">
                  <span>
                    {pid === 'ollama' ? 'optional — leave blank for local Ollama' : 'not set — key will be encrypted on save'}
                  </span>
                </div>
              )}

              {pid === 'ollama' && !keyDraft && (
                <button
                  className="reveal-btn account-test-btn"
                  onClick={() => handleTestConnection({ assumesKey: true })}
                  disabled={testState?.status === 'loading'}
                >
                  {testState?.status === 'loading' ? 'testing local...' : 'test local connection'}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Ollama endpoint */}
      {pid === 'ollama' && (
        <section className="settings-section">
          <div className="section-title">Ollama endpoint</div>
          <p className="section-desc">
            The URL where Ollama is running. Default is localhost.
          </p>
          <div className="key-row">
            <div className="key-meta">
              <div className="key-label">Base URL</div>
              <div className="key-env">OLLAMA_HOST</div>
            </div>
            <div className="key-input-wrap" style={{ flex: 1 }}>
              <input
                type="text"
                className="key-input"
                placeholder="http://localhost:11434"
                value={settings.ollamaEndpoint ?? ''}
                onChange={e => onUpdate('ollamaEndpoint', e.target.value)}
              />
            </div>
          </div>
        </section>
      )}

      {/* Model — free text for all providers */}
      <section className="settings-section">
        <div className="section-title">Model</div>
        <p className="section-desc">{hints.hint}</p>

        {presets.length > 0 && (
          <div className="model-preset-wrap">
            <label className="field-label">Suggested models</label>
            <div className="preset-grid">
              {presets.map(option => (
                <button
                  key={option}
                  type="button"
                  className={`preset-card ${model === option ? 'active' : ''}`}
                  onClick={() => onUpdate(`${pid}Model`, option)}
                >
                  <div className="preset-name">{option}</div>
                  <div className="preset-tag">{model === option ? 'selected' : 'preset'}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="model-input-wrap">
          <input
            type="text"
            className="key-input model-input"
            placeholder={hints.placeholder}
            value={model}
            onChange={e => onUpdate(`${pid}Model`, e.target.value)}
          />
          {hasModel && (
            <div className="model-set-badge">
              <div className="key-dot" />
              <span>{model}</span>
            </div>
          )}
        </div>

        {!hasModel && (
          <div className="model-empty-hint">
            Enter a model name to get started. You can find available models at the link above.
          </div>
        )}
      </section>

      <section className="settings-section">
        <div className="section-title">Advanced</div>
        <p className="section-desc">Tune how creative the model should be and how long responses are allowed to get.</p>

        <div className="advanced-grid">
          <div className="advanced-field">
            <label className="field-label">Temperature</label>
            <input
              type="number"
              min="0" max="2" step="0.1"
              className="key-input"
              value={temperature}
              onChange={e => onUpdate(`${pid}Temperature`, Number(e.target.value))}
            />
            <div className="field-help">Lower is steadier. Higher is more exploratory.</div>
          </div>

          <div className="advanced-field">
            <label className="field-label">Max tokens</label>
            <input
              type="number"
              min="100" max="8192" step="100"
              className="key-input"
              value={maxTokens}
              onChange={e => onUpdate(`${pid}MaxTokens`, Number(e.target.value))}
            />
            <div className="field-help">Caps response size to help control latency and cost.</div>
          </div>
        </div>

        <div className="advanced-grid" style={{ marginTop: '16px' }}>
          <div className="advanced-field" style={{ gridColumn: '1 / -1' }}>
            <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.autoApproveWorkflows || false}
                onChange={e => onUpdate('autoApproveWorkflows', e.target.checked)}
              />
              Auto-approve workflows (don't ask for permission)
            </label>
            <div className="field-help" style={{ marginLeft: '22px' }}>When enabled, the AI will immediately execute its planned tasks.</div>
          </div>
          <div className="advanced-field">
            <label className="field-label">Chat context length</label>
            <input
              type="number"
              min="2" max="50" step="1"
              className="key-input"
              value={settings.contextLength ?? 10}
              onChange={e => onUpdate('contextLength', Number(e.target.value))}
            />
            <div className="field-help">Number of previous messages the AI remembers.</div>
          </div>
        </div>
      </section>
    </>
  )
}

// ─── Appearance Tab ───────────────────────────────────────────────────────────
function AppearanceTab({ settings, onUpdate }) {
  return (
    <>
      <section className="settings-section">
        <div className="section-title">Theme</div>
        <div className="theme-grid">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`theme-card ${settings.themeBase === t.id ? 'active' : ''}`}
              onClick={() => onUpdate('themeBase', t.id)}
            >
              <div className={`theme-preview ${t.id}`}>
                <div className="tp-bar" />
                <div className="tp-content">
                  <div className="tp-line long" />
                  <div className="tp-line short" />
                </div>
              </div>
              <div className="theme-label">{t.label}</div>
              <div className="theme-desc">{t.desc}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="section-title">Accent color</div>
        <p className="section-desc">Used for active states, progress bars and highlights throughout the app.</p>
        <div className="accent-grid">
          {ACCENTS.map(a => (
            <button
              key={a.id}
              className={`accent-card ${settings.themeAccent === a.id ? 'active' : ''}`}
              onClick={() => onUpdate('themeAccent', a.id)}
            >
              <div
                className="accent-swatch"
                style={{ background: a.color }}
              >
                {settings.themeAccent === a.id && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div className="accent-label">{a.label}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="section-title">Font style</div>
        <p className="section-desc">Choose the reading feel for labels, panels and controls.</p>
        <div className="font-grid">
          {FONT_PRESETS.map(font => (
            <button
              key={font.id}
              className={`font-card ${settings.fontPreset === font.id ? 'active' : ''}`}
              style={{ fontFamily: font.stack }}
              onClick={() => onUpdate('fontPreset', font.id)}
            >
              <span className="font-card-label">{font.label}</span>
              <span className="font-card-sample">{font.sample}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="section-title">Font size</div>
        <p className="section-desc">Adjust the base font size for the application.</p>
        <div className="advanced-grid" style={{ maxWidth: '200px' }}>
          <div className="advanced-field">
            <input
              type="number"
              min="10"
              max="24"
              step="1"
              className="key-input"
              value={settings.fontSize || 13}
              onChange={e => onUpdate('fontSize', Number(e.target.value))}
            />
          </div>
        </div>
      </section>
    </>
  )
}
