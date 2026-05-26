import React, { useState, useEffect } from 'react'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import './ToolsPage.css'

const TOOLS = [
  {
    id: 'python',
    scanNames: ['python'],
    icon: 'py',
    color: 'blue',
    name: 'Python',
    tagline: 'Runtime required for pip-based tools like Whisper and yt-dlp',
    installed: false,
    caps: ['pip packages', 'AI tools', 'tool runtime'],
    requires: ['Windows package manager or python.org installer'],
    setup: {
      Windows: [{ label: 'Install Python 3.11 with pip', cmd: 'winget install Python.Python.3.11' }],
      macOS: [{ label: 'Install Python', cmd: 'brew install python' }],
      Linux: [{ label: 'Install Python and pip', cmd: 'sudo apt install python3 python3-pip' }],
      verify: 'python --version',
      docs: 'https://www.python.org/downloads/',
    },
  },
  {
    id: 'ffmpeg',
    scanNames: ['ffmpeg'],
    icon: 'ff',
    color: 'teal',
    name: 'ffmpeg',
    tagline: 'Video/audio encoding, filtering, trimming, muxing',
    installed: true,
    version: 'ffmpeg 6.1.1',
    caps: ['trim', 'compress', 'convert', 'filter', 'merge', 'stream'],
    requires: ['Windows package manager or manual ffmpeg install'],
    setup: {
      macOS: [
        { label: 'Install Homebrew if you don\'t have it', cmd: '/bin/bash -c "$(curl -fsSL https://brew.sh/install.sh)"' },
        { label: 'Install ffmpeg', cmd: 'brew install ffmpeg' },
      ],
      Windows: [
        { label: 'Download the Windows build from ffmpeg.org', cmd: 'winget install ffmpeg' },
      ],
      Linux: [
        { label: 'Install via apt', cmd: 'sudo apt install ffmpeg' },
      ],
      verify: 'ffmpeg -version',
      docs: 'https://ffmpeg.org',
    },
  },
  {
    id: 'ffprobe',
    scanNames: ['ffprobe'],
    icon: 'fp',
    color: 'teal',
    name: 'ffprobe',
    tagline: 'Media file inspection — streams, codecs, bitrate, duration',
    installed: true,
    version: 'ships with ffmpeg',
    caps: ['file analysis', 'stream info', 'metadata'],
    requires: ['ffmpeg package'],
    setup: {
      macOS:   [{ label: 'Ships with ffmpeg — no separate install needed', cmd: 'brew install ffmpeg' }],
      Windows: [{ label: 'Ships with ffmpeg', cmd: 'winget install ffmpeg' }],
      Linux:   [{ label: 'Ships with ffmpeg', cmd: 'sudo apt install ffmpeg' }],
      verify: 'ffprobe -version',
      docs: 'https://ffmpeg.org/ffprobe.html',
    },
  },
  {
    id: 'ffplay',
    scanNames: ['ffplay'],
    icon: 'fp',
    color: 'teal',
    name: 'ffplay',
    tagline: 'Media playback and quick preview from ffmpeg',
    installed: true,
    version: 'ships with ffmpeg',
    caps: ['playback', 'preview', 'media QA'],
    requires: ['ffmpeg package'],
    setup: {
      macOS:   [{ label: 'Ships with ffmpeg', cmd: 'brew install ffmpeg' }],
      Windows: [{ label: 'Ships with ffmpeg', cmd: 'winget install ffmpeg' }],
      Linux:   [{ label: 'Ships with ffmpeg', cmd: 'sudo apt install ffmpeg' }],
      verify: 'ffplay -version',
      docs: 'https://ffmpeg.org/ffplay.html',
    },
  },
  {
    id: 'whisper',
    scanNames: ['whisper'],
    icon: 'wh',
    color: 'purple',
    name: 'whisper',
    tagline: 'OpenAI speech-to-text — transcription in 90+ languages',
    installed: false,
    caps: ['transcription', 'subtitles', 'SRT / VTT export', 'translation'],
    requires: ['Python 3.9+', 'pip', 'ffmpeg'],
    note: 'First run downloads the model (~140MB for base). Larger models are more accurate but slower.',
    setup: {
      'macOS / Linux': [
        { label: 'Requires Python 3.9+', cmd: 'pip install openai-whisper' },
        { label: 'ffmpeg is also required', cmd: 'brew install ffmpeg' },
      ],
      Windows: [
        { label: 'Requires Python 3.9+ from python.org', cmd: 'pip install openai-whisper' },
      ],
      verify: 'whisper --version',
      docs: 'https://github.com/openai/whisper',
    },
  },
  {
    id: 'yt-dlp',
    scanNames: ['yt-dlp'],
    icon: 'yt',
    color: 'coral',
    name: 'yt-dlp',
    tagline: 'Download video/audio from YouTube, Vimeo and 1000+ sites',
    installed: false,
    caps: ['download', 'extract audio', 'subtitles', 'playlists'],
    requires: ['Python 3.9+', 'pip'],
    setup: {
      macOS: [
        { label: 'Install via pip', cmd: 'pip install yt-dlp' },
        { label: 'Or via Homebrew', cmd: 'brew install yt-dlp' },
      ],
      Windows: [{ label: 'Install via pip', cmd: 'pip install yt-dlp' }],
      Linux:   [{ label: 'Install via pip', cmd: 'pip install yt-dlp' }],
      verify: 'yt-dlp --version',
      docs: 'https://github.com/yt-dlp/yt-dlp',
    },
  },
  {
    id: 'imagemagick',
    scanNames: ['magick', 'imagemagick'],
    icon: 'im',
    color: 'blue',
    name: 'ImageMagick',
    tagline: 'Frame-level image manipulation — resize, annotate, composite',
    caps: ['thumbnails', 'watermark', 'frame edit', 'format convert'],
    requires: ['ImageMagick magick.exe'],
    setup: {
      macOS:   [{ label: 'Install via Homebrew', cmd: 'brew install imagemagick' }],
      Windows: [{ label: 'Download installer from imagemagick.org', cmd: 'winget install ImageMagick' }],
      Linux:   [{ label: 'Install via apt', cmd: 'sudo apt install imagemagick' }],
      verify: 'magick --version',
      docs: 'https://imagemagick.org',
    },
  },
]

const CATEGORIES = ['All', 'Installed', 'Not installed']

export default function ToolsPage({ initialTools, onRescan, isScanning: parentScanning }) {
  const [filter, setFilter] = useState('All')
  const [expanded, setExpanded] = useState(null)
  const [scannedTools, setScannedTools] = useState(initialTools || [])
  const [isScanning, setIsScanning] = useState(false)
  const [lastScannedAt, setLastScannedAt] = useState(null)
  const [installing, setInstalling] = useState(null)
  const [installLogs, setInstallLogs] = useState({})
  const [confirmState, setConfirmState] = useState(null)

  const scanning = isScanning || parentScanning

  const scan = async () => {
    setIsScanning(true)
    try {
      if (onRescan) await onRescan()
      setLastScannedAt(new Date())
    } catch (err) {
      console.error('Failed to scan tools:', err)
    } finally {
      setIsScanning(false)
    }
  }

  useEffect(() => {
    setScannedTools(initialTools || [])
    if (initialTools?.length) setLastScannedAt(new Date())
  }, [initialTools])

  // Merge static metadata with scan results
  const mergedTools = TOOLS.map(staticTool => {
    const names = staticTool.scanNames ?? [staticTool.name]
    const scanned = scannedTools.find(s => names.some(name => s.name.toLowerCase() === name.toLowerCase()))
    return {
      ...staticTool,
      installed: scanned ? scanned.available : false,
      version: scanned ? scanned.version : staticTool.version,
      bundled: scanned ? scanned.bundled : staticTool.bundled,
      whisperModels: scanned?.whisperModels ?? [],
    }
  })

  const filtered = mergedTools.filter(t => {
    if (filter === 'Installed')     return t.installed
    if (filter === 'Not installed') return !t.installed
    return true
  })

  const installedCount = mergedTools.filter(t => t.installed).length

  function requestInstallTool(tool) {
    if (tool.installed || installing) return
    setConfirmState({
      type: 'single',
      tool,
      title: `Install ${tool.name}?`,
      message: 'This will run the system installer and may take a few minutes.',
    })
  }

  async function runInstallTool(tool) {
    if (tool.installed || installing) return

    setInstalling(tool.id)
    setInstallLogs(prev => ({ ...prev, [tool.id]: 'Starting installer...' }))
    try {
      const result = await window.electron.installTool(tool.id)
      const log = [
        result.command ? `Command: ${result.command}` : '',
        result.note || '',
        result.message || '',
        result.stdout || '',
        result.stderr || '',
      ].filter(Boolean).join('\n\n')
      setInstallLogs(prev => ({ ...prev, [tool.id]: log }))
      await scan()
    } catch (err) {
      setInstallLogs(prev => ({ ...prev, [tool.id]: err.message || 'Install failed.' }))
    } finally {
      setInstalling(null)
    }
  }

  function requestInstallMissing() {
    const missing = mergedTools.filter(tool => !tool.installed && tool.id !== 'ffprobe')
    if (missing.length === 0 || installing) return
    setConfirmState({
      type: 'batch',
      tools: missing,
      title: `Install ${missing.length} missing tool${missing.length === 1 ? '' : 's'}?`,
      message: 'Tools will be installed one at a time. Keep this window open until finished.',
    })
  }

  async function handleConfirmInstall() {
    const state = confirmState
    setConfirmState(null)
    if (!state) return
    if (state.type === 'single') {
      await runInstallTool(state.tool)
    } else if (state.type === 'batch') {
      for (const tool of state.tools) {
        await runInstallTool(tool)
      }
    }
  }

  return (
    <div className="tools-page">
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title ?? ''}
        message={confirmState?.message}
        confirmLabel="Install"
        onConfirm={handleConfirmInstall}
        onCancel={() => setConfirmState(null)}
      />
      <div className="tools-toolbar">
        <span className="tools-title">Tools</span>
        <span className="tools-sub">{installedCount} of {mergedTools.length} installed · agent capabilities depend on what's set up</span>
        <button
          className="install-missing-btn"
          onClick={requestInstallMissing}
          disabled={!!installing || mergedTools.every(t => t.installed || t.id === 'ffprobe')}
        >
          install missing
        </button>
        <button 
          className={`rescan-btn ${scanning ? 'scanning' : ''}`} 
          onClick={scan}
          disabled={scanning}
        >
          {scanning ? 'scanning...' : 're-scan'}
        </button>
      </div>

      <div className="tools-body">
        <aside className="tools-nav">
          <div className="nav-label">Filter</div>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`nav-item ${filter === cat ? 'active' : ''}`}
              onClick={() => setFilter(cat)}
            >
              {cat}
              <span className={`nav-count ${cat === 'Installed' ? 'green' : 'gray'}`}>
                {cat === 'All'           ? mergedTools.length :
                 cat === 'Installed'     ? mergedTools.filter(t => t.installed).length :
                 mergedTools.filter(t => !t.installed).length}
              </span>
            </button>
          ))}
        </aside>

        <div className="tools-list">
          <div className="status-bar">
            <div className="status-dot" />
            <span>ffmpeg, ffprobe, ffplay and yt-dlp are checked for bundled/dev availability</span>
            <span className="status-right">
              {scanning
                ? 'scanning tools…'
                : lastScannedAt
                ? `last scanned ${lastScannedAt.toLocaleTimeString()}`
                : 'not scanned yet'}
            </span>
          </div>

          {filtered.map(tool => (
            <ToolCard
              key={tool.id}
              tool={tool}
              isExpanded={expanded === tool.id}
              onToggle={() => setExpanded(expanded === tool.id ? null : tool.id)}
              installing={installing === tool.id}
              installLog={installLogs[tool.id]}
              onInstall={() => requestInstallTool(tool)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ToolCard({ tool, isExpanded, onToggle, installing, installLog, onInstall }) {
  const [os, setOs] = useState(0)

  const osList = tool.setup ? Object.keys(tool.setup).filter(k => k !== 'verify' && k !== 'docs') : []
  const steps  = tool.setup ? tool.setup[osList[os]] : []

  return (
    <div className={`tool-card ${tool.installed ? 'installed' : ''}`}>
      <div className="tool-header" onClick={onToggle}>
        <div className={`tool-icon ${tool.color}`}>{tool.icon}</div>
        <div className="tool-info">
          <div className="tool-name">
            {tool.name}
            {tool.installed
              ? <span className="tbadge ok">{tool.bundled ? 'bundled' : 'installed'}</span>
              : tool.badge
              ? <span className="tbadge warn">{tool.badge}</span>
              : <span className="tbadge none">not installed</span>
            }
          </div>
          <div className="tool-tagline">{tool.tagline}</div>
          {tool.id === 'whisper' && tool.installed && tool.whisperModels?.length > 0 && (
            <div className="tool-whisper-summary">
              {tool.whisperModels.length} model{tool.whisperModels.length === 1 ? '' : 's'}: {tool.whisperModels.join(', ')}
            </div>
          )}
          <div className="tool-caps">
            {tool.caps.map(c => (
              <span key={c} className={`cap ${tool.installed ? 'lit' : ''}`}>{c}</span>
            ))}
          </div>
        </div>
        {!tool.installed && (
          <button
            className="tool-install-btn"
            onClick={e => { e.stopPropagation(); onInstall() }}
            disabled={installing}
          >
            {installing ? 'installing...' : 'install'}
          </button>
        )}
        <span className={`chevron ${isExpanded ? 'open' : ''}`}>▶</span>
      </div>

      {isExpanded && tool.setup && (
        <div className="tool-body">
          <div className="os-tabs">
            {osList.map((o, i) => (
              <button key={o} className={`os-tab ${os === i ? 'active' : ''}`} onClick={() => setOs(i)}>
                {o}
              </button>
            ))}
          </div>

          <div className="install-steps">
            {tool.requires?.length > 0 && (
              <div className="requirements-row">
                <span className="requirements-label">Requires</span>
                <div className="requirements-list">
                  {tool.requires.map(req => <span key={req} className="requirement-pill">{req}</span>)}
                </div>
              </div>
            )}

            {!tool.installed && (
              <button className="install-now-btn" onClick={onInstall} disabled={installing}>
                {installing ? 'Installing...' : `Install ${tool.name}`}
              </button>
            )}

            {steps.map((step, i) => (
              <div className="install-step" key={i}>
                <span className="step-i">{i + 1}</span>
                <div className="step-body">
                  <div className="step-label">{step.label}</div>
                  <CmdLine cmd={step.cmd} />
                </div>
              </div>
            ))}

            {tool.note && <div className="tool-note">{tool.note}</div>}

            {tool.id === 'whisper' && tool.installed && tool.whisperModels?.length > 0 && (
              <div className="whisper-models-section">
                <span className="whisper-models-label">Installed models</span>
                <div className="whisper-models-list">
                  {tool.whisperModels.map(model => (
                    <span key={model} className="whisper-model-pill">{model}</span>
                  ))}
                </div>
                <div className="whisper-models-path">
                  Cached in <code>~/.cache/whisper/</code>
                </div>
              </div>
            )}

            {tool.id === 'whisper' && tool.installed && !tool.whisperModels?.length && (
              <div className="tool-note">Whisper is installed. No cached models yet — the first run downloads one (e.g. base).</div>
            )}

            <div className="verify-row">
              <span className="verify-label">Verify:</span>
              <code className="verify-cmd">{tool.setup.verify}</code>
              <a className="docs-link" href={tool.setup.docs} target="_blank" rel="noreferrer">
                official docs ↗
              </a>
            </div>
          </div>

          {tool.installed && tool.version && (
            <div className="installed-note">✓ {tool.version} detected on your system</div>
          )}

          {installLog && (
            <pre className="install-log">{installLog.slice(0, 3000)}</pre>
          )}
        </div>
      )}
    </div>
  )
}

function CmdLine({ cmd }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(cmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="cmd-line">
      <span className="cmd-text">{cmd}</span>
      <button className="copy-btn" onClick={copy}>{copied ? 'copied!' : 'copy'}</button>
    </div>
  )
}
