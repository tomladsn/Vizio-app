import React, { useState, useEffect } from 'react'
import './ToolsPage.css'

const TOOLS = [
  {
    id: 'python',
    scanNames: ['python'],
    icon: 'py',
    color: 'blue',
    name: 'Python',
    tagline: 'Runtime required for pip-based tools like Whisper, yt-dlp and pyannote',
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
    id: 'pyannote',
    scanNames: ['pyannote'],
    icon: 'py',
    color: 'amber',
    name: 'pyannote',
    tagline: 'Speaker diarization — who spoke when',
    installed: false,
    badge: 'needs HuggingFace token',
    caps: ['speaker detection', 'diarization', 'timestamps'],
    requires: ['Python 3.9+', 'pip', 'PyTorch', 'Hugging Face token'],
    setup: {
      'all platforms': [
        { label: 'Accept model conditions at huggingface.co/pyannote/speaker-diarization', cmd: 'pip install pyannote.audio' },
        { label: 'Add your HuggingFace token in Settings → API keys', cmd: 'HF_TOKEN=your_token_here' },
      ],
      verify: 'python -c "import pyannote.audio"',
      docs: 'https://github.com/pyannote/pyannote-audio',
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

export default function ToolsPage() {
  const [filter, setFilter] = useState('All')
  const [expanded, setExpanded] = useState(null)
  const [scannedTools, setScannedTools] = useState([])
  const [isScanning, setIsScanning] = useState(false)
  const [installing, setInstalling] = useState(null)
  const [installLogs, setInstallLogs] = useState({})

  const scan = async () => {
    setIsScanning(true)
    try {
      const results = await window.electron.scanTools()
      setScannedTools(results)
    } catch (err) {
      console.error('Failed to scan tools:', err)
    } finally {
      setIsScanning(false)
    }
  }

  useEffect(() => {
    scan()
  }, [])

  // Merge static metadata with scan results
  const mergedTools = TOOLS.map(staticTool => {
    const names = staticTool.scanNames ?? [staticTool.name]
    const scanned = scannedTools.find(s => names.some(name => s.name.toLowerCase() === name.toLowerCase()))
    return {
      ...staticTool,
      installed: scanned ? scanned.available : false,
      version: scanned ? scanned.version : staticTool.version
    }
  })

  const filtered = mergedTools.filter(t => {
    if (filter === 'Installed')     return t.installed
    if (filter === 'Not installed') return !t.installed
    return true
  })

  const installedCount = mergedTools.filter(t => t.installed).length

  async function installTool(tool, { confirm = true } = {}) {
    if (tool.installed || installing) return
    if (confirm) {
      const ok = window.confirm(`Install ${tool.name} and its required dependencies?`)
      if (!ok) return
    }

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

  async function installMissingTools() {
    const missing = mergedTools.filter(tool => !tool.installed && tool.id !== 'ffprobe')
    if (missing.length === 0 || installing) return
    const ok = window.confirm(`Install ${missing.length} missing tool${missing.length === 1 ? '' : 's'}?`)
    if (!ok) return

    for (const tool of missing) {
      await installTool(tool, { confirm: false })
    }
  }

  return (
    <div className="tools-page">
      <div className="tools-toolbar">
        <span className="tools-title">Tools</span>
        <span className="tools-sub">{installedCount} of {mergedTools.length} installed · agent capabilities depend on what's set up</span>
        <button
          className="install-missing-btn"
          onClick={installMissingTools}
          disabled={!!installing || mergedTools.every(t => t.installed || t.id === 'ffprobe')}
        >
          install missing
        </button>
        <button 
          className={`rescan-btn ${isScanning ? 'scanning' : ''}`} 
          onClick={scan}
          disabled={isScanning}
        >
          {isScanning ? 'scanning...' : 're-scan'}
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
            <span>ffmpeg + ffprobe ready — core editing is available this session</span>
            <span className="status-right">last scanned just now</span>
          </div>

          {filtered.map(tool => (
            <ToolCard
              key={tool.id}
              tool={tool}
              isExpanded={expanded === tool.id}
              onToggle={() => setExpanded(expanded === tool.id ? null : tool.id)}
              installing={installing === tool.id}
              installLog={installLogs[tool.id]}
              onInstall={() => installTool(tool)}
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
              ? <span className="tbadge ok">installed</span>
              : tool.badge
              ? <span className="tbadge warn">{tool.badge}</span>
              : <span className="tbadge none">not installed</span>
            }
          </div>
          <div className="tool-tagline">{tool.tagline}</div>
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
