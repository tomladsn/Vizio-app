import React, { useState, useEffect } from 'react'
import './PreviewPanel.css'

export default function PreviewPanel({ project, activeFile, sessionId }) {
  const [activeTab, setActiveTab] = useState('preview')
  const [allSessions, setAllSessions] = useState([]) // history of all session IDs
  const [viewingSession, setViewingSession] = useState(null)
  const [sessionData, setSessionData] = useState(null)
  const [outputFiles, setOutputFiles] = useState([])
  const [afterFile,   setAfterFile]   = useState(null)
  const [pollError,   setPollError]   = useState(null)

  // When session completes, auto-set the final output as afterFile
  useEffect(() => {
    if (!sessionData?.workflow?.final_output || outputFiles.length === 0) return
    const finalName = sessionData.workflow.final_output.split(/[\\/]/).pop()
    const match = outputFiles.find(f => f.name === finalName) ?? outputFiles[0]
    if (match) setAfterFile(match)
  }, [outputFiles, sessionData?.workflow?.final_output])

  useEffect(() => {
    if (!sessionId) return
    // Add to history if not already there
    setAllSessions(prev => prev.includes(sessionId) ? prev : [...prev, sessionId])
    setViewingSession(sessionId)
    setActiveTab('session log')
  }, [sessionId])

  // Poll only the target session
  useEffect(() => {
    const target = viewingSession ?? allSessions[allSessions.length - 1]
    if (!target) return

    async function fetchLog() {
      try {
        const data = await window.electron.readSessionLog(target)
        if (data) {
          setSessionData(data)
          setPollError(null)
        }
      } catch (err) {
        setPollError(err.message)
      }
    }

    fetchLog()
    const interval = setInterval(fetchLog, 1500)
    return () => clearInterval(interval)
  }, [allSessions, viewingSession])

  // When session completes, fetch output files
  useEffect(() => {
    if (!project) return

    window.electron.project.getOutputs(project.folderPath).then(files => {
      setOutputFiles(files ?? [])
    }).catch(() => { })
  }, [project, sessionData?.status, viewingSession])

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
            {tab === 'session log' && sessionData && (
              <span className={`tab-badge ${sessionData.status === 'completed' ? 'ok' : sessionData.status === 'completed_with_errors' ? 'err' : 'run'}`}>
                {sessionData.status === 'proposed' ? 'draft' : sessionData.status === 'in_progress' ? 'live' : sessionData.status === 'completed' ? 'done' : sessionData.status === 'cancelled' ? 'stopped' : 'errors'}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'preview' && (
        <div className="preview-split">
          <VideoPane label="BEFORE" file={activeFile} />
          <VideoPane
            label="AFTER"
            file={afterFile}
            processed={!!afterFile}
          />
        </div>
      )}

      {activeTab === 'output files' && (
        <div className="output-files">
          {outputFiles.length === 0 ? (
            <div className="empty-state">No output files yet</div>
          ) : (
            outputFiles.map(f => (
              <div
                key={f.name}
                className={`output-file-row ${afterFile?.name === f.name ? 'active' : ''}`}
              >
                <div className="of-info">
                  <span className="of-name">{f.name}</span>
                  <span className="of-size">{f.size}</span>
                </div>
                <div className="of-actions">
                  <button
                    className="of-btn preview-btn"
                    onClick={() => {
                      setAfterFile(f)
                      setActiveTab('preview')
                    }}
                  >
                    preview
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
          {!sessionData
            ? <div className="empty-state">No active session — start a task in the chat</div>
            : <SessionLog data={sessionData} />
          }
        </div>
      )}
    </div>
  )
}


function SessionLog({ data }) {
  return (
    <div className="session-log">
      <div className="slog-header">
        <div className="slog-meta-row">
          <span className="slog-label">goal</span>
          <span className="slog-val">{data.userGoal || '—'}</span>
        </div>
        <div className="slog-meta-row">
          <span className="slog-label">status</span>
          <span className={`slog-status ${data.status}`}>{data.status}</span>
        </div>
        <div className="slog-meta-row">
          <span className="slog-label">started</span>
          <span className="slog-val">{new Date(data.startedAt).toLocaleTimeString()}</span>
        </div>
        {data.completedAt && (
          <div className="slog-meta-row">
            <span className="slog-label">completed</span>
            <span className="slog-val">{new Date(data.completedAt).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {data.workflow && (
        <div className="slog-section">
          <div className="slog-section-title">Workflow plan</div>
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

function StepLog({ step }) {
  const [expanded, setExpanded] = useState(false)

  const statusColor = {
    proposed: 'var(--text-muted)',
    pending: 'var(--text-muted)',
    running: 'var(--purple-text)',
    completed: 'var(--green-text)',
    failed: 'var(--red-text)',
    cancelled: 'var(--amber-text)',
  }[step.status] ?? 'var(--text-muted)'

  return (
    <div className="slog-step">
      <div className="slog-step-header" onClick={() => setExpanded(e => !e)}>
        <div className="slog-step-num">{step.id}</div>
        <div className="slog-step-title">{step.title}</div>
        <div className="slog-step-status" style={{ color: statusColor }}>{step.status}</div>
        <div className="slog-step-chevron">{expanded ? '▾' : '▸'}</div>
      </div>

      {expanded && (
        <div className="slog-step-body">
          {step.attempts?.map((attempt, i) => (
            <div key={i} className="slog-attempt">
              <div className="slog-attempt-num">attempt {i + 1}</div>

              <div className="slog-field-label">command</div>
              <pre className="slog-cmd">{attempt.command}</pre>

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

              {attempt.stdout && (
                <>
                  <div className="slog-field-label">stdout</div>
                  <pre className="slog-stderr">{attempt.stdout.slice(0, 2000)}</pre>
                </>
              )}

              {attempt.stderr && !attempt.exitSuccess && (
                <>
                  <div className="slog-field-label">stderr</div>
                  <pre className="slog-stderr">{attempt.stderr.slice(0, 600)}</pre>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function VideoPane({ label, file, processed }) {
  if (!file) {
    return (
      <div className="video-pane">
        <div className="pane-label">{label} {processed && <span className="processed-badge">processed</span>}</div>
        <div className="pane-screen">
          <div className="no-file-placeholder">
            <div className="play-ring"><div className="play-tri" /></div>
            <span>{processed ? 'Execution pending' : 'No file selected'}</span>
          </div>
        </div>
      </div>
    )
  }

  const path = typeof file === 'string' ? file : file.path
  const name = typeof file === 'string' ? path.split(/[\\/]/).pop() : file.name
  const ext = name.split('.').pop().toLowerCase()

  const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(ext)
  const isAudio = ['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(ext)
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)

  return (
    <div className="video-pane">
      <div className="pane-label">
        {label}
        {processed && <span className="processed-badge">processed</span>}
      </div>
      <div className="pane-screen">
        <div className="media-container">
          {isVideo && (
            <video key={path} src={`atom://${path}`} controls className="preview-media" />
          )}
          {isAudio && (
            <div className="audio-preview">
              <div className="audio-icon">♪</div>
              <audio key={path} src={`atom://${path}`} controls className="preview-audio" />
              <div className="audio-name">{name}</div>
            </div>
          )}
          {isImage && (
            <img key={path} src={`atom://${path}`} alt={name} className="preview-media" />
          )}
          {!isVideo && !isAudio && !isImage && (
            <div className="unknown-file">
              <span>View file at:</span>
              <code className="path-code">{path}</code>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
