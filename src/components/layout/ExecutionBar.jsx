import React, { useState, useEffect } from 'react'
import { settingsStore } from '../../store/settingsStore'
import { useSecureKeys } from '../../hooks/useSecureKeys'
import './ExecutionBar.css'

export default function ExecutionBar({ tasks = [], pendingWorkflow = null, height, onResizeStart }) {
  const [config, setConfig] = useState(settingsStore.getActiveConfig())
  const { isProviderReady } = useSecureKeys()
  const pendingSteps = pendingWorkflow?.steps ?? []

  useEffect(() => {
    return settingsStore.subscribe(() => {
      setConfig(settingsStore.getActiveConfig())
    })
  }, [])

  const hasKey = config.isLocal || isProviderReady(config.providerId)
  const hasModel = !!config.model?.trim()

  return (
    <div className="exec-bar" style={height ? { height } : undefined}>
      <div
        className="exec-resize-handle"
        onMouseDown={onResizeStart}
        title="Drag to resize"
      />
      <div className="exec-session">
        <div className="exec-label">Session</div>
        <div className="session-row">
          <span className="skey">provider</span>
          <span className="sval">{config.label}</span>
        </div>
        <div className="session-row">
          <span className="skey">model</span>
          <span className={`sval ${hasModel ? '' : 'sval-warn'}`}>
            {hasModel ? config.model : 'not set'}
          </span>
        </div>
        <div className="session-row">
          <span className="skey">status</span>
          <span className={`sval ${hasKey && hasModel ? 'sval-ok' : 'sval-warn'}`}>
            {config.isLocal ? 'local' : hasKey && hasModel ? 'ready' : 'not configured'}
          </span>
        </div>

        {pendingWorkflow && pendingSteps.length > 0 && (
          <div className="pending-preview">
            <div className="pending-label">
              <span className="pending-dot" />
              Pending approval - {pendingSteps.length} step{pendingSteps.length !== 1 ? 's' : ''}
            </div>
            <div className="pending-steps">
              {pendingSteps.slice(0, 4).map((step, i) => {
                const cmd = step.command || null
                return (
                  <div key={step.id ?? i} className="pending-step" title={cmd || step.title}>
                    <span className="pending-step-num">{i + 1}</span>
                    <div className="pending-step-body">
                      <span className="pending-step-title">{step.title}</span>
                      {cmd && (
                        <span className="pending-step-cmd">{cmd}</span>
                      )}
                    </div>
                  </div>
                )
              })}
              {pendingSteps.length > 4 && (
                <div className="pending-step pending-step-more">
                  +{pendingSteps.length - 4} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="exec-tasks">
        <div className="exec-label">
          Tasks
          {tasks.length > 0 && (
            <span className="task-count">{tasks.length}</span>
          )}
        </div>

        {tasks.length === 0 ? (
          <div className="exec-idle">No tasks yet -- describe an edit in the chat</div>
        ) : (
          <div className="task-list">
            {tasks.map(task => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TaskRow({ task }) {
  const totalSteps = task.steps?.length ?? 0
  const doneSteps = task.steps?.filter(s => s.status === 'done').length ?? 0
  const failedSteps = task.steps?.filter(s => s.status === 'failed').length ?? 0
  const runningStep = task.steps?.find(s => s.status === 'running')

  const overallPct = totalSteps === 0 ? 0 : Math.round(
    ((doneSteps * 100) + (runningStep?.pct ?? 0)) / totalSteps
  )

  const isCompleted = task.status === 'done'
  const isFailed = task.status === 'failed' || failedSteps > 0
  const isRunning = task.status === 'running'

  const barColor = isFailed
    ? 'var(--red-text)'
    : isCompleted
      ? 'var(--green)'
      : 'var(--purple)'

  const statusLabel = isFailed
    ? 'failed'
    : isCompleted
      ? 'done'
      : isRunning && totalSteps > 0
        ? `step ${doneSteps + 1}/${totalSteps}`
        : 'waiting'

  return (
    <div className={`task-row ${isCompleted ? 'completed' : ''} ${isFailed ? 'failed' : ''}`}>
      <div className="task-info">
        <span className="task-name" title={task.goal}>{task.goal}</span>
        <span className={`task-status-label ${isCompleted ? 'done' : isFailed ? 'fail' : 'run'}`}>
          {statusLabel}
        </span>
      </div>
      <div className="task-progress-row">
        <div className="bar-wrap">
          <div
            className="bar-fill"
            style={{ width: `${overallPct}%`, background: barColor }}
          />
        </div>
        <span className="step-pct">{overallPct}%</span>
      </div>
    </div>
  )
}
