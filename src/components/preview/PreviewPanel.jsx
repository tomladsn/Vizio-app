import React, { useState, useEffect, useRef } from 'react'
import './PreviewPanel.css'

export default function PreviewPanel({ project, activeFile, sessionId, onMentionFile }) {
  const [activeTab,      setActiveTab]      = useState('preview')
  const [allSessions,    setAllSessions]    = useState([])
  const [viewingSession, setViewingSession] = useState(null)
  const [sessionData,    setSessionData]    = useState(null)
  const [outputFiles,    setOutputFiles]    = useState([])
  const [afterFile,      setAfterFile]      = useState(null)
  const [pollError,      setPollError]      = useState(null)
  const [seekTime,       setSeekTime]       = useState(null)

  // Before/After split resize
  const [beforePct, setBeforePct]   = useState(50)
  const splitRef                    = useRef(null)
  const splitDraggingRef            = useRef(null)

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

  async function handleDeleteOutput(filePath) {
    if (!confirm('Are you sure you want to delete this output file?')) return
    const res = await window.electron.project.deleteMedia(filePath, project.folderPath)
    if (res?.ok) {
      const files = await window.electron.project.getOutputs(project.folderPath)
      setOutputFiles(files ?? [])
      if (afterFile?.path === filePath) {
        setAfterFile(null)
      }
    } else {
      alert(`Delete failed: ${res?.message || 'Unknown error'}`)
    }
  }

  // Before/After pane drag-to-resize
  function onSplitMouseDown(e) {
    e.preventDefault()
    const rect = splitRef.current?.getBoundingClientRect()
    if (!rect) return
    splitDraggingRef.current = { startX: e.clientX, startPct: beforePct, totalW: rect.width }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    function onMouseMove(e) {
      if (!splitDraggingRef.current) return
      const { startX, startPct, totalW } = splitDraggingRef.current
      const delta = e.clientX - startX
      const deltaPct = (delta / totalW) * 100
      const newPct = Math.min(80, Math.max(20, startPct + deltaPct))
      setBeforePct(newPct)
    }
    function onMouseUp() {
      if (!splitDraggingRef.current) return
      splitDraggingRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

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

      {/* ── Preview tab ─────────────────────────────────────────────────── */}
      {activeTab === 'preview' && (
        <div className="preview-split" ref={splitRef}>
          <div style={{ width: `${beforePct}%`, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <VideoPane label="BEFORE" file={activeFile} projectDir={project?.folderPath} seekTime={seekTime} setSeekTime={setSeekTime} />
          </div>
          <div
            className="preview-split-handle"
            onMouseDown={onSplitMouseDown}
            title="Drag to resize"
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <VideoPane label="AFTER"  file={afterFile} projectDir={project?.folderPath} processed={!!afterFile} seekTime={seekTime} setSeekTime={setSeekTime} />
          </div>
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
                  <button
                    className="of-btn delete-btn"
                    title="Delete output file"
                    onClick={() => handleDeleteOutput(f.path)}
                  >
                    delete
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

  useEffect(() => {
    if (step.status === 'running') {
      setExpanded(true)
    }
  }, [step.status])

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

function TerminalOutput({ stdout, stderr, isRunning }) {
  const terminalRef = React.useRef(null)

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [stdout, stderr])

  return (
    <div className="slog-terminal-container" ref={terminalRef}>
      {stdout && <pre className="stdout-line">{stdout}</pre>}
      {stderr && <pre className="stderr-line">{stderr}</pre>}
      {isRunning && !stdout && !stderr && (
        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Waiting for output...</span>
      )}
    </div>
  )
}

function AttemptLog({ attempt, num }) {
  const isRunning = attempt.status === 'running'
  return (
    <div className="slog-attempt">
      <div className="slog-attempt-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="slog-attempt-num">attempt {num}</div>
        {isRunning && (
          <span className="slog-status-badge running" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '9px', color: 'var(--purple-text)', fontFamily: 'var(--font-mono)' }}>
            <span className="live-dot" />
            running
          </span>
        )}
      </div>

      {attempt.command && (
        <>
          <div className="slog-field-label">command</div>
          <pre className="slog-cmd">{attempt.command}</pre>
        </>
      )}

      {!isRunning && (
        <div className="slog-attempt-result">
          <span className={`slog-exit ${attempt.exitSuccess ? 'ok' : 'fail'}`}>
            exit {attempt.exitSuccess ? '0 ✓' : 'non-zero ✗'}
          </span>
          {attempt.aiMessage && (
            <span className="slog-ai-msg">{attempt.aiMessage}</span>
          )}
        </div>
      )}

      {attempt.fixedCommand && (
        <>
          <div className="slog-field-label">fixed command</div>
          <pre className="slog-cmd fixed">{attempt.fixedCommand}</pre>
        </>
      )}

      {(isRunning || attempt.stdout || attempt.stderr) && (
        <>
          <div className="slog-field-label">{isRunning ? 'live output' : 'terminal log'}</div>
          <TerminalOutput stdout={attempt.stdout} stderr={attempt.stderr} isRunning={isRunning} />
        </>
      )}
    </div>
  )
}

function parseSubtitles(text) {
  if (!text) return []
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = cleanText.split('\n\n')
  const items = []

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 2) continue

    let timeLine = ''
    let textStartIndex = 1

    if (lines[0].includes('-->')) {
      timeLine = lines[0]
      textStartIndex = 1
    } else if (lines[1] && lines[1].includes('-->')) {
      timeLine = lines[1]
      textStartIndex = 2
    } else {
      continue
    }

    const timeMatch = timeLine.split('-->')
    if (timeMatch.length !== 2) continue

    const startStr = timeMatch[0].trim()
    const endStr = timeMatch[1].trim()

    const parseTime = (timeStr) => {
      const parts = timeStr.split(':')
      if (parts.length < 2) return 0
      let secs = 0
      let mins = 0
      let hrs = 0
      if (parts.length === 3) {
        hrs = parseFloat(parts[0])
        mins = parseFloat(parts[1])
        secs = parseFloat(parts[2].replace(',', '.'))
      } else {
        mins = parseFloat(parts[0])
        secs = parseFloat(parts[1].replace(',', '.'))
      }
      return hrs * 3600 + mins * 60 + secs
    }

    const startTime = parseTime(startStr)
    const endTime = parseTime(endStr)
    const textContent = lines.slice(textStartIndex).join('\n')

    items.push({
      startStr,
      endStr,
      startTime,
      endTime,
      text: textContent
    })
  }
  return items
}

function VideoPane({ label, file, projectDir, processed, seekTime, setSeekTime }) {
  const [textPreview, setTextPreview] = useState(null)
  const [probeInfo, setProbeInfo] = useState(null)
  const videoRef = React.useRef(null)
  
  const filePath = file ? (typeof file === 'string' ? file : file.path) : ''
  const name = file ? (typeof file === 'string' ? filePath.split(/[\\/]/).pop() : file.name) : ''
  const ext = name ? name.split('.').pop().toLowerCase() : ''

  const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv', 'flv', 'mpeg', 'mpg'].includes(ext)
  const isAudio = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'opus', 'wma'].includes(ext)
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'svg'].includes(ext)
  const isText = ['srt', 'vtt', 'ass', 'ssa', 'txt', 'md'].includes(ext)
  const isSrt = ['srt', 'vtt', 'ass', 'ssa'].includes(ext)

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
      setTextPreview(result.content || '')
    }).catch(() => {
      if (!cancelled) setTextPreview('Unable to load text preview.')
    })

    return () => { cancelled = true }
  }, [filePath, isText, projectDir])

  useEffect(() => {
    if (seekTime && videoRef.current && isVideo) {
      videoRef.current.currentTime = seekTime.time
      videoRef.current.play().catch(() => {})
    }
  }, [seekTime, isVideo])

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

  const subtitles = isSrt && textPreview ? parseSubtitles(textPreview) : []

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
            <video ref={videoRef} key={filePath} src={`atom://${filePath}`} controls className="preview-media" />
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
          {isSrt && (
            <div className="subtitle-viewer">
              {textPreview === null ? (
                <div className="empty-subtitles">Loading subtitles...</div>
              ) : textPreview === 'Unable to load text preview.' ? (
                <div className="empty-subtitles">Unable to load subtitles.</div>
              ) : subtitles.length === 0 ? (
                <div className="empty-subtitles">No subtitles parsed or empty file.</div>
              ) : (
                subtitles.map((sub, index) => (
                  <div
                    key={index}
                    className="subtitle-segment"
                    onClick={() => setSeekTime({ time: sub.startTime, timestamp: Date.now() })}
                  >
                    <div className="subtitle-time">
                      <span>{sub.startStr}</span>
                      <span className="time-arrow">→</span>
                      <span>{sub.endStr}</span>
                    </div>
                    <div className="subtitle-text">{sub.text}</div>
                  </div>
                ))
              )}
            </div>
          )}
          {isText && !isSrt && (
            <div className="text-viewer">
              {textPreview === null ? (
                <div className="empty-subtitles">Loading file...</div>
              ) : textPreview === 'Unable to load text preview.' ? (
                <div className="empty-subtitles">Unable to load text file.</div>
              ) : (
                <pre className="text-content-pre">{textPreview}</pre>
              )}
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
