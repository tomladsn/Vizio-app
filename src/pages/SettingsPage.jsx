import React, { useState } from 'react'
import { settingsStore, PROVIDERS, ACCENTS, THEMES, MODEL_HINTS, MODEL_PRESETS } from '../store/settingsStore'
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

  return (
    <>
      {/* Provider selector */}
      <section className="settings-section">
        <div className="section-title">Active provider</div>
        <p className="section-desc">Pick which AI backend powers the agent. Configure keys and models below.</p>
        <div className="provider-tabs">
          {PROVIDERS.map(p => {
            const hasKey = p.requiresKey ? !!settings[`${p.id}ApiKey`]?.trim() : true
            const hasModel = !!settings[`${p.id}Model`]?.trim()
            const isReady = hasKey && hasModel
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

function ProviderConfig({ provider, settings, shown, onToggleShow, onUpdate }) {
  const pid = provider.id
  const hints = MODEL_HINTS[pid]
  const presets = MODEL_PRESETS[pid] ?? []
  const apiKey = settings[`${pid}ApiKey`] ?? ''
  const model = settings[`${pid}Model`] ?? ''
  const temperature = settings[`${pid}Temperature`] ?? 0.2
  const maxTokens = settings[`${pid}MaxTokens`] ?? 700
  const hasKey = !!apiKey.trim()
  const hasModel = !!model.trim()

  return (
    <>
      {/* API key — not for Ollama */}
      {provider.requiresKey && (
        <section className="settings-section">
          <div className="section-title">
            {provider.label} API key
          </div>
          <p className="section-desc">
            Get your key at{' '}
            <a href={`https://${provider.docsUrl}`} target="_blank" rel="noreferrer">
              {provider.docsUrl}
            </a>
          </p>

          <div className="key-row">
            <div className="key-meta">
              <div className="key-label">API key</div>
              <div className="key-env">{provider.envKey}</div>
            </div>
            <div className="key-input-wrap">
              <input
                type={shown ? 'text' : 'password'}
                className="key-input"
                placeholder={provider.keyPlaceholder}
                value={apiKey}
                onChange={e => onUpdate(`${pid}ApiKey`, e.target.value)}
              />
              <button className="reveal-btn" onClick={onToggleShow}>
                {shown ? 'hide' : 'show'}
              </button>
            </div>
            <div className={`key-status ${hasKey ? 'ok' : 'empty'}`}>
              {hasKey
                ? <><div className="key-dot" /><span>set</span></>
                : <span>not set</span>
              }
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
              min="0"
              max="2"
              step="0.1"
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
              min="100"
              max="8192"
              step="100"
              className="key-input"
              value={maxTokens}
              onChange={e => onUpdate(`${pid}MaxTokens`, Number(e.target.value))}
            />
            <div className="field-help">Caps response size to help control latency and cost.</div>
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
    </>
  )
}
