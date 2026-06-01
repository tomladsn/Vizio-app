import React, { useState, useEffect } from 'react'
import './PreviewPanel.css'

export default function PreviewPanel({ project, activeFile, sessionId, onMentionFile }) {
  const [activeTab,      setActiveTab]      = useState('preview')
  const [allSessions,    setAllSessions]    = useState([])
  const [viewingSession, setViewingSession] = useState(null)
  const [sessionData,    setSessionData]    = useState(null)
  const [outputFiles,    setOutputFiles]    = useState([])
  const [afterFile,      setAfterFile]      = useState(null)
  const [pollError,      setPollError]      = useState(null)

  // ── New session arrived ────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return
    setAllSessions(prev => prev.includes(sessionId) ? prev : [...prev, sessionId])
    setViewingSession(sessionId)
    setActiveTab('session log')
  }, [sessionId])

  // ── Poll session log ───────────────────────────────────────────────────────
  useEffect(() => {
    const target = viewingSession ?? allSessions[allSessions.length - 1]
    if (!target) return

    let cancelled = false

    async function fetchLog() {
      try {
        const data = await window.electron.readSessionLog(target)
        if (!cancelled && data) {
          setSessionData(data)
          setPollError(null)
        }
      } catch (err) {
        if (!cancelled) setPollError(err.message)
      }
    }

    fetchLog()
    const interval = setInterval(fetchLog, 1500)
    return () => { cancelled = true; clearInterval(interval) }
  }, [viewingSession, allSessions])

  // ── Fetch output files whenever project or session status changes ──────────
  useEffect(() => {
    if (!project?.folderPath) return
    window.electron.project.getOutputs(project.folderPath)
      .then(files => setOutputFiles(files ?? []))
      .catch(() => {})
  }, [project?.folderPath, sessionData?.status, viewingSession])

  // ── Auto-set after-file when workflow completes ────────────────────────────
  useEffect(() => {
    if (!sessionData?.workflow?.final_output || outputFiles.length === 0) return
    const finalName = sessionData.workflow.final_output.split(/[\\/]/).pop()
    const match = outputFiles.find(f => f.name === finalName) ?? outputFiles[outputFiles.length - 1]
    if (match) setAfterFile(match)
  }, [outputFiles, sessionData?.workflow?.final_output])

  const sessionBadge = (() => {
    if (!sessionData) return null
    const { status } = sessionData
    if (status === 'proposed')             return { label: 'draft',   cls: '' }
    if (status === 'in_progress')          return { label: 'live',    cls: 'run' }
    if (status === 'completed')            return { label: 'done',    cls: 'ok' }
    if (status === 'cancelled')            return { label: 'stopped', cls: '' }
    if (status === 'completed_with_errors') return { label: 'errors', cls: 'err' }
    return { label: status, cls: '' }
  })()

  async function handleExport(sourcePath, defaultName) {
    try {
      const res = await window.electron.project.exportFile(sourcePath, defaultName)
      if (res?.ok) {
        console.log('Exported successfully to:', res.dest)
      } else if (res?.message) {
        alert(`Export failed: ${res.message}`)
      }
    } catch (err) {
      alert(`Export failed: ${err.message}`)
    }
  }

  return (
    <div className="preview-panel">
      <div className="preview-tabs">
        {['preview', 'output files', 'session log'].map(tab => (
          <button
            key={tab}
            className={`preview-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab === 'output files' && outputFiles.length > 0 && (
              <span className="tab-badge">{outputFiles.length}</span>
            )}
            {tab === 'session log' && sessionBadge && (
              <span className={`tab-badge ${sessionBadge.cls}`}>{sessionBadge.label}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Preview tab ───────────────────────────────────────────────────── */}
      {activeTab === 'preview' && (
        <div className="preview-split">
          <VideoPane label="BEFORE" file={activeFile} projectDir={project?.folderPath} />
          <VideoPane label="AFTER"  file={afterFile} projectDir={project?.folderPath} processed={!!afterFile} />
        </div>
      )}

      {/* ── Output files tab ──────────────────────────────────────────────── */}
      {activeTab === 'output files' && (
        <div className="output-files">
          {outputFiles.length === 0 ? (
            <div className="empty-state">No output files yet</div>
          ) : (
            outputFiles.map(f => (
              <div
                key={f.path}
                className={`output-file-row ${afterFile?.path === f.path ? 'active' : ''}`}
              >
                <div className="of-info">
                  <span className="of-name" title={f.name}>{f.name}</span>
                  <span className="of-size">{f.size}</span>
                </div>
                <div className="of-actions">
                  <button
                    className="of-btn preview-btn"
                    onClick={() => { setAfterFile(f); setActiveTab('preview') }}
                  >
                    preview
                  </button>
                  <button
                    className="of-btn mention-btn"
                    title="Mention in chat"
                    onClick={() => onMentionFile?.(f.name)}
                  >
                    mention
                  </button>
                  <button
                    className="of-btn export-btn"
                    title="Export file"
                    onClick={() => handleExport(f.path, f.name)}
                  >
                    export
                  </button>
                  <button
                    className="of-btn open-btn"
                    onClick={() => window.electron.openFile(f.path)}
                  >
                    open
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Session log tab ───────────────────────────────────────────────── */}
      {activeTab === 'session log' && (
        <div className="session-log-wrap">
          {allSessions.length > 1 && (
            <div className="session-history-bar">
              {allSessions.map((sid, i) => (
                <button
                  key={sid}
                  className={`session-pill ${sid === viewingSession ? 'active' : ''}`}
                  onClick={() => setViewingSession(sid)}
                >
                  task {i + 1}
                </button>
              ))}
            </div>
          )}
          {!sessionData ? (
            <div className="empty-state">
              {pollError
                ? <span className="poll-err">Poll error: {pollError}</span>
                : 'No active session — start a task in chat'
              }
            </div>
          ) : (
            <SessionLog data={sessionData} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Session log components ─────────────────────────────────────────────────────

function SessionLog({ data }) {
  return (
    <div className="session-log">
      <div className="slog-header">
        <MetaRow label="goal"    value={data.userGoal || '—'} />
        <MetaRow label="status"  value={data.status} className={`slog-status ${data.status}`} />
        <MetaRow label="started" value={new Date(data.startedAt).toLocaleTimeString()} />
        {data.completedAt && (
          <MetaRow label="completed" value={new Date(data.completedAt).toLocaleTimeString()} />
        )}
      </div>

      {data.workflow && (
        <div className="slog-section">
          <div className="slog-section-title">Plan</div>
          <div className="slog-message">{data.workflow.message}</div>
        </div>
      )}

      {data.steps?.length > 0 && (
        <div className="slog-section">
          <div className="slog-section-title">Steps</div>
          {data.steps.map(step => (
            <StepLog key={step.id} step={step} />
          ))}
        </div>
      )}
    </div>
  )
}

function MetaRow({ label, value, className }) {
  return (
    <div className="slog-meta-row">
      <span className="slog-label">{label}</span>
      <span className={className ?? 'slog-val'}>{value}</span>
    </div>
  )
}

function StepLog({ step }) {
  const [expanded, setExpanded] = useState(false)

  const statusColor = {
    proposed:  'var(--text-muted)',
    pending:   'var(--text-muted)',
    running:   'var(--purple-text)',
    completed: 'var(--green-text)',
    failed:    'var(--red-text)',
    cancelled: 'var(--amber-text)',
  }[step.status] ?? 'var(--text-muted)'

  const hasDetail = step.attempts?.length > 0

  return (
    <div className="slog-step">
      <div
        className="slog-step-header"
        onClick={() => hasDetail && setExpanded(e => !e)}
        style={{ cursor: hasDetail ? 'pointer' : 'default' }}
      >
        <div className="slog-step-num">{step.id}</div>
        <div className="slog-step-title">{step.title}</div>
        <div className="slog-step-status" style={{ color: statusColor }}>{step.status}</div>
        {hasDetail && (
          <div className="slog-step-chevron">{expanded ? '▾' : '▸'}</div>
        )}
      </div>

      {expanded && (
        <div className="slog-step-body">
          {step.attempts.map((attempt, i) => (
            <AttemptLog key={i} attempt={attempt} num={i + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function AttemptLog({ attempt, num }) {
  return (
    <div className="slog-attempt">
      <div className="slog-attempt-num">attempt {num}</div>

      {attempt.command && (
        <>
          <div className="slog-field-label">command</div>
          <pre className="slog-cmd">{attempt.command}</pre>
        </>
      )}

      <div className="slog-attempt-result">
        <span className={`slog-exit ${attempt.exitSuccess ? 'ok' : 'fail'}`}>
          exit {attempt.exitSuccess ? '0 ✓' : 'non-zero ✗'}
        </span>
        {attempt.aiMessage && (
          <span className="slog-ai-msg">{attempt.aiMessage}</span>
        )}
      </div>

      {attempt.fixedCommand && (
        <>
          <div className="slog-field-label">fixed command</div>
          <pre className="slog-cmd fixed">{attempt.fixedCommand}</pre>
        </>
      )}

      {attempt.stderr && !attempt.exitSuccess && (
        <>
          <div className="slog-field-label">stderr</div>
          <pre className="slog-stderr">{attempt.stderr.slice(0, 800)}</pre>
        </>
      )}
    </div>
  )
}

function VideoPane({ label, file, projectDir, processed }) {
  const [textPreview, setTextPreview] = useState(null)
  const [probeInfo, setProbeInfo] = useState(null)
  
  const filePath = file ? (typeof file === 'string' ? file : file.path) : ''
  const name = file ? (typeof file === 'string' ? filePath.split(/[\\/]/).pop() : file.name) : ''
  const ext = name ? name.split('.').pop().toLowerCase() : ''

  const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv', 'flv', 'mpeg', 'mpg'].includes(ext)
  const isAudio = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma'].includes(ext)
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'svg'].includes(ext)
  const isText = ['srt', 'vtt', 'ass', 'ssa', 'txt', 'md'].includes(ext)

  useEffect(() => {
    let cancelled = false
    if (!filePath || !isText || !projectDir) {
      setTextPreview(null)
      return
    }

    window.electron.agent.readText(projectDir, filePath).then(result => {
      if (cancelled) return
      if (!result?.ok) {
        setTextPreview('Unable to load text preview.')
        return
      }
      setTextPreview((result.content || '').slice(0, 6000))
    }).catch(() => {
      if (!cancelled) setTextPreview('Unable to load text preview.')
    })

    return () => { cancelled = true }
  }, [filePath, isText, projectDir])

  useEffect(() => {
    if (!filePath) {
      setProbeInfo(null)
      return
    }
    let cancelled = false
    window.electron.probeFiles([filePath])
      .then(results => {
        if (!cancelled && results?.[0] && !results[0].error) {
          setProbeInfo(results[0])
        } else if (!cancelled) {
          setProbeInfo(null)
        }
      })
      .catch(() => {
        if (!cancelled) setProbeInfo(null)
      })
    return () => { cancelled = true }
  }, [filePath])

  function formatBytes(bytes) {
    if (!bytes) return ''
    const b = parseInt(bytes)
    if (isNaN(b)) return ''
    if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB'
    return (b / 1024 / 1024).toFixed(1) + ' MB'
  }

  const videoStream = probeInfo?.streams?.find(s => s.type === 'video')
  const audioStream = probeInfo?.streams?.find(s => s.type === 'audio')

  const metaChips = []
  if (ext) metaChips.push(ext.toUpperCase())
  if (videoStream?.width && videoStream?.height) {
    metaChips.push(`${videoStream.width}x${videoStream.height}`)
  }
  if (videoStream?.codec) {
    metaChips.push(videoStream.codec)
  } else if (audioStream?.codec) {
    metaChips.push(audioStream.codec)
  }
  const duration = probeInfo?.format?.duration_sec || videoStream?.duration_sec || audioStream?.duration_sec
  if (duration) {
    metaChips.push(`${parseFloat(duration).toFixed(1)}s`)
  }
  const sizeStr = file?.size || formatBytes(probeInfo?.format?.size_bytes)
  if (sizeStr) {
    metaChips.push(sizeStr)
  }

  if (!file) {
    return (
      <div className="video-pane">
        <div className="pane-label">
          <div className="pane-label-left">
            <span className="pane-label-text">{label}</span>
            {processed && <span className="processed-badge">processed</span>}
          </div>
        </div>
        <div className="pane-screen">
          <div className="no-file-placeholder">
            <div className="play-ring"><div className="play-tri" /></div>
            <span>{processed ? 'Processing...' : 'No file selected'}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="video-pane">
      <div className="pane-label">
        <div className="pane-label-left">
          <span className="pane-label-text">{label}</span>
          {processed && <span className="processed-badge">processed</span>}
        </div>
        {name && (
          <span className="pane-file-name" title={filePath}>
            {name}
          </span>
        )}
      </div>
      <div className="pane-screen">
        <div className="media-container">
          {isVideo && (
            <video key={filePath} src={`atom://${filePath}`} controls className="preview-media" />
          )}
          {isAudio && (
            <div className="audio-preview">
              <div className="audio-icon">Audio</div>
              <audio key={filePath} src={`atom://${filePath}`} controls className="preview-audio" />
              <div className="audio-name">{name}</div>
            </div>
          )}
          {isImage && (
            <img key={filePath} src={`atom://${filePath}`} alt={name} className="preview-media" />
          )}
          {isText && (
            <div className="text-preview">
              <pre>{textPreview ?? 'Loading text preview...'}</pre>
            </div>
          )}
          {!isVideo && !isAudio && !isImage && !isText && (
            <div className="unknown-file">
              <span>View file at:</span>
              <code className="path-code">{filePath}</code>
            </div>
          )}
        </div>
      </div>
      {metaChips.length > 0 && (
        <div className="pane-meta-bar">
          {metaChips.map((chip, idx) => (
            <span key={idx} className="pane-meta-chip">{chip}</span>
          ))}
        </div>
      )}
    </div>
  )
}
