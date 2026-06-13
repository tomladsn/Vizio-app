import React, { useState, useRef, useEffect, useCallback } from 'react'
import ChatPanel from '../components/chat/ChatPanel'
import { settingsStore } from '../store/settingsStore'
import './NodePage.css'

const STEP_TYPES = {
  shell: {
    label: 'Shell Command', icon: '⌨', color: '#4A6BC8',
    description: 'Run any shell command. Use {input} and {output} as placeholders.',
    defaultCommand: 'ffmpeg -y -i "{input}" "{output}"',
  },
  whisper: {
    label: 'Whisper Transcribe', icon: '🎙', color: '#8B35CC',
    description: 'Transcribe audio/video to SRT/VTT/TXT using Whisper.',
  },
  ai_analyse: {
    label: 'AI Analyse', icon: '🤖', color: '#6B1FA8',
    description: 'Send the previous step\'s output to the AI with a custom prompt.',
  },
  ffmpeg_clip: {
    label: 'Clip by Timestamps', icon: '✂', color: '#1B8FAD',
    description: 'Read timestamps from AI analysis JSON and clip the original video.',
  },
  for_each_shell: {
    label: 'For Each — Shell', icon: '🔁', color: '#1B9FD4',
    description: 'Run a shell command once per clip from a previous step.',
    defaultCommand: 'ffmpeg -y -i "{input}" "{output}"',
  },
  scale_916: {
    label: 'Scale to 9:16', icon: '📱', color: '#27AE85',
    description: 'Scale and pad to 1080×1920 for Shorts / TikTok / Reels.',
    defaultCommand: 'ffmpeg -y -i "{input}" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black" -c:v libx264 -crf 23 -c:a aac "{output}"',
  },
  burn_captions: {
    label: 'Burn Captions', icon: '💬', color: '#C8A020',
    description: 'Burn an SRT subtitle file into the video as hardcoded captions.',
  },
  compress: {
    label: 'Compress', icon: '📦', color: '#E67E22',
    description: 'Compress video for web, Twitter, Instagram etc.',
    defaultCommand: 'ffmpeg -y -i "{input}" -c:v libx264 -crf 28 -preset slow -c:a aac -b:a 128k "{output}"',
  },
}

const TEMPLATES = [
  {
    id: 'yt-shorts',
    name: 'YouTube Shorts Generator',
    description: 'Transcribe → AI picks moments → clip → caption → 9:16',
    icon: '📱',
    steps: [
      { type:'whisper',       title:'Transcribe video',       model:'base', wordsPerLine:'2',  outputFormat:'srt'  },
      { type:'ai_analyse',    title:'AI picks best moments',  prompt:'Read this SRT and return a JSON array of the 3-5 best moments for YouTube Shorts. Each: {start, end, reason}. Return ONLY valid JSON.', outputFormat:'json' },
      { type:'ffmpeg_clip',   title:'Clip segments',          sourceVideo:'{original}'         },
      { type:'whisper',       title:'Caption each clip',      model:'base', wordsPerLine:'2',  outputFormat:'srt', iteratesOver:'clips' },
      { type:'burn_captions', title:'Burn captions',          fontsize:'22', fontcolor:'white' },
      { type:'scale_916',     title:'Scale to 9:16'                                            },
    ],
  },
  {
    id: 'compress-web',
    name: 'Batch Compress for Web',
    description: 'H264 compression for web/social delivery',
    icon: '📦',
    steps: [
      { type:'compress', title:'Compress H264', command:'ffmpeg -y -i "{input}" -c:v libx264 -crf 28 -preset slow -c:a aac -b:a 128k "{output}"' },
    ],
  },
  {
    id: 'extract-transcribe',
    name: 'Extract + Transcribe Audio',
    description: 'Pull audio track then generate SRT',
    icon: '🎵',
    steps: [
      { type:'shell',   title:'Extract audio', command:'ffmpeg -y -i "{input}" -vn -acodec mp3 -ab 192k "{outputDir}/{basename}.mp3"' },
      { type:'whisper', title:'Transcribe',    model:'base', wordsPerLine:'8', outputFormat:'srt' },
    ],
  },
  { id:'blank', name:'Blank Pipeline', description:'Start from scratch', icon:'＋', steps:[] },
]

function uid() { return Math.random().toString(36).slice(2,9) }
function stepColor(t) { return STEP_TYPES[t]?.color ?? '#888' }
function stepIcon(t)  { return STEP_TYPES[t]?.icon  ?? '⚙'   }
function stepLabel(t) { return STEP_TYPES[t]?.label ?? t      }
function defaultStep(type) {
  const def = STEP_TYPES[type] ?? {}
  return {
    id: uid(), type, title: def.label ?? type,
    command: def.defaultCommand ?? '',
    model: 'base', wordsPerLine: '2', outputFormat: 'srt',
    prompt: '', sourceVideo: '{original}',
    fontsize: '22', fontcolor: 'white',
    iteratesOver: '',
  }
}

function normaliseCommand(cmd, inputFile) {
  if (!cmd || !inputFile) return cmd
  const basename = inputFile.split(/[\\/]/).pop().replace(/\.[^.]+$/, '')
  const dir      = inputFile.split(/[\\/]/).slice(0,-1).join('\\')
  return cmd
    .replace(new RegExp(inputFile.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi'), '{input}')
    .replace(new RegExp(basename.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),  'gi'), '{basename}')
    .replace(new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),       'gi'), '{inputDir}')
}

export default function NodePage({
  project,
  projectFiles: propProjectFiles,
  outputFiles:  propOutputFiles,
  onRunPipeline,
  onWorkflowComplete,
  onNavigateToOutputs,
  toolsBlock,
  probeData,
  activeChatId,
  onChatSaved,
  onSessionId,
  onTaskUpdate,
}) {
  const [projectFiles, setProjectFiles] = useState(propProjectFiles ?? [])
  const [outputFiles,  setOutputFiles]  = useState(propOutputFiles ?? [])
  const [pipelines,     setPipelines]     = useState(() => loadLocalPipelines())
  const [activePipeId,  setActivePipeId]  = useState(pipelines[0]?.id ?? null)
  const [selectedStepId,setSelectedStep]  = useState(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [inputFile,     setInputFile]     = useState(null)
  const [running,       setRunning]       = useState(false)
  const [runSteps,      setRunSteps]      = useState([])
  const [runDone,       setRunDone]       = useState(null)
  const [activeProvider,setActiveProvider] = useState('—')
  const [nodeChats,     setNodeChats]     = useState([])
  const [nodeChatId,    setNodeChatId]    = useState(null)
  const [showNodeChats, setShowNodeChats] = useState(false)

  const dragStep = useRef(null)
  const dragOver = useRef(null)
  const pipelinesRef = useRef([])
  const activePipeIdRef = useRef(null)
  useEffect(() => { pipelinesRef.current = pipelines }, [pipelines])
  useEffect(() => { activePipeIdRef.current = activePipeId }, [activePipeId])

  const activePipeline = pipelines.find(p => p.id === activePipeId) ?? null
  const selectedStep   = activePipeline?.steps.find(s => s.id === selectedStepId) ?? null

  function loadLocalPipelines() {
    try {
      const raw = localStorage.getItem('vizio_pipelines')
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  }

  function savePipelines(updated) {
    setPipelines(updated)
    try { localStorage.setItem('vizio_pipelines', JSON.stringify(updated)) } catch {}
    updated.forEach(p => window.electron?.pipeline?.save?.(p))
  }

  useEffect(() => {
    window.electron?.pipeline?.getAll?.().then(all => {
      if (all?.length) {
        setPipelines(all)
        setActivePipeId(all[0].id)
      }
    })
  }, [])

  useEffect(() => {
    if (!project?.folderPath) return
    window.electron?.project?.getMedia?.(project.folderPath).then(setProjectFiles)
    window.electron?.project?.getOutputs?.(project.folderPath).then(setOutputFiles)
    const cfg = settingsStore.getActiveConfig()
    setActiveProvider(cfg?.label ?? cfg?.providerId ?? '—')
  }, [project?.folderPath])

  async function refreshNodeChats() {
    if (!project?.folderPath) return
    const list = await window.electron.chat.list(project.folderPath)
    setNodeChats(list)
    if (list.length === 0) {
      const newChat = await window.electron.chat.create(project.folderPath, 'New chat')
      setNodeChats([{ id: newChat.id, title: newChat.title, updatedAt: newChat.updatedAt, messageCount: 0 }])
      setNodeChatId(newChat.id)
    } else if (!nodeChatId) {
      setNodeChatId(list[0].id)
    }
  }

  useEffect(() => {
    refreshNodeChats()
  }, [project?.folderPath])

  async function handleNewNodeChat() {
    const chat = await window.electron.chat.create(project?.folderPath, 'New chat')
    await refreshNodeChats()
    setNodeChatId(chat.id)
    setShowNodeChats(false)
  }

  async function handleDeleteNodeChat(chatId) {
    if (!project?.folderPath) return
    const currentIndex = nodeChats.findIndex(chat => chat.id === chatId)
    await window.electron.chat.delete(project.folderPath, chatId)
    const list = await window.electron.chat.list(project.folderPath)
    if (list.length === 0) {
      const newChat = await window.electron.chat.create(project.folderPath, 'New chat')
      setNodeChats([{ id: newChat.id, title: newChat.title, updatedAt: newChat.updatedAt, messageCount: 0 }])
      setNodeChatId(newChat.id)
      return
    }
    setNodeChats(list)
    if (chatId === nodeChatId) {
      const nextChat = list[Math.min(currentIndex, list.length - 1)] ?? list[0]
      setNodeChatId(nextChat.id)
    }
  }

  useEffect(() => {
    const cleanups = [
      window.electron?.pipeline?.onStart?.(({ totalSteps }) => {
        setRunning(true)
        setRunDone(null)
      }),
      window.electron?.pipeline?.onStepStart?.(({ stepNum, title }) => {
        setRunSteps(prev => prev.map(s => s.num === stepNum ? { ...s, status:'running' } : s))
      }),
      window.electron?.pipeline?.onStepProgress?.(({ stepNum, pct }) => {
        setRunSteps(prev => prev.map(s => s.num === stepNum ? { ...s, pct } : s))
      }),
      window.electron?.pipeline?.onStepDone?.(({ stepNum, output }) => {
        setRunSteps(prev => prev.map(s => s.num === stepNum ? { ...s, status:'done', pct:100, output } : s))
      }),
      window.electron?.pipeline?.onStepError?.(({ stepNum, message }) => {
        setRunSteps(prev => prev.map(s => s.num === stepNum ? { ...s, status:'error', message } : s))
      }),
      window.electron?.pipeline?.onDone?.(({ success, message, outputDir }) => {
        setRunning(false)
        setRunDone({ success, message, outputDir })
        if (success) {
          onWorkflowComplete?.()
          setTimeout(() => onNavigateToOutputs?.(), 800)
        }
      }),
    ]
    return () => cleanups.forEach(fn => fn?.())
  }, [])

  function createFromTemplate(tpl) {
    const p = {
      id: uid(),
      name: tpl.id === 'blank' ? 'Untitled Pipeline' : tpl.name,
      description: tpl.description,
      steps: tpl.steps.map(s => ({ ...defaultStep(s.type), ...s, id: uid() })),
      createdAt: Date.now(),
    }
    savePipelines([...pipelines, p])
    setActivePipeId(p.id)
    setShowTemplates(false)
  }

  function deletePipeline(id) {
    const updated = pipelines.filter(p => p.id !== id)
    savePipelines(updated)
    window.electron?.pipeline?.delete?.(id)
    setActivePipeId(updated[0]?.id ?? null)
  }

  function updatePipeline(updated) {
    savePipelines(pipelines.map(p => p.id === updated.id ? updated : p))
  }

  function addStep(type) {
    if (!activePipeline) return
    const s = defaultStep(type)
    updatePipeline({ ...activePipeline, steps: [...activePipeline.steps, s] })
    setSelectedStep(s.id)
  }

  function removeStep(id) {
    if (!activePipeline) return
    updatePipeline({ ...activePipeline, steps: activePipeline.steps.filter(s => s.id !== id) })
    if (selectedStepId === id) setSelectedStep(null)
  }

  function updateStep(id, patch) {
    if (!activePipeline) return
    updatePipeline({ ...activePipeline, steps: activePipeline.steps.map(s => s.id === id ? { ...s, ...patch } : s) })
  }

  function appendFromWorkflowStep(workflowStepOrSteps, sourceInputFile) {
    const stepsToAdd = Array.isArray(workflowStepOrSteps)
      ? workflowStepOrSteps
      : [workflowStepOrSteps]

    setPipelines(prev => {
      let all = [...prev]
      let targetId = activePipeIdRef.current

      // Auto-create a pipeline if none exists
      if (!all.find(p => p.id === targetId)) {
        const p = {
          id: uid(), name: 'From Chat',
          description: 'Converted from AI workflow',
          steps: [], createdAt: Date.now(),
        }
        all = [...all, p]
        targetId = p.id
        setActivePipeId(p.id)
        window.electron?.pipeline?.save?.(p)
      }

      const newSteps = stepsToAdd.map(workflowStep => ({
        ...defaultStep(STEP_TYPES[workflowStep.type] ? workflowStep.type : 'shell'),
        title:   workflowStep.title ?? workflowStep.description ?? 'Converted step',
        command: normaliseCommand(workflowStep.command, sourceInputFile) ?? workflowStep.command ?? '',
        // Carry over whisper/ai_analyse specific fields if present
        ...(workflowStep.model        ? { model:        workflowStep.model }        : {}),
        ...(workflowStep.outputFormat ? { outputFormat: workflowStep.outputFormat } : {}),
        ...(workflowStep.wordsPerLine ? { wordsPerLine: workflowStep.wordsPerLine } : {}),
        ...(workflowStep.prompt       ? { prompt:       workflowStep.prompt }       : {}),
        ...(workflowStep.fontsize     ? { fontsize:     workflowStep.fontsize }     : {}),
        ...(workflowStep.fontcolor    ? { fontcolor:    workflowStep.fontcolor }    : {}),
        ...(workflowStep.iteratesOver ? { iteratesOver: workflowStep.iteratesOver } : {}),
        id: uid(),
      }))

      const updated = all.map(p => {
        if (p.id !== targetId) return p
        return { ...p, steps: [...p.steps, ...newSteps] }
      })

      const target = updated.find(p => p.id === targetId)
      if (target) {
        window.electron?.pipeline?.save?.(target)
        try { localStorage.setItem('vizio_pipelines', JSON.stringify(updated)) } catch {}
      }

      return updated
    })
    setSelectedStep(null)
    setTimeout(() => setSelectedStep(null), 1200)
  }

  function onDragStart(e, idx) { dragStep.current = idx }
  function onDragEnter(e, idx) { dragOver.current = idx }
  function onDragEnd() {
    if (!activePipeline) return
    const steps = [...activePipeline.steps]
    const from  = dragStep.current
    const to    = dragOver.current
    if (from === null || to === null || from === to) return
    const [moved] = steps.splice(from, 1)
    steps.splice(to, 0, moved)
    updatePipeline({ ...activePipeline, steps })
    dragStep.current = null
    dragOver.current = null
  }

  function runPipeline() {
    if (!activePipeline || !inputFile || running) return
    if (activePipeline.steps.length === 0) {
      alert('Add at least one step before running.')
      return
    }

    setRunning(true)
    setRunDone(null)
    setRunSteps(activePipeline.steps.map((s,i) => ({
      num: i+1, title: s.title, type: s.type,
      status:'waiting', pct:0, output:null, message:null,
    })))

    // Check if pipeline IPC is available
    const hasIPC = typeof window.electron?.pipeline?.run === 'function'

    if (hasIPC) {
      const cfg = settingsStore.getActiveConfig() ?? {}
      window.electron.pipeline.run({
        pipeline:   activePipeline,
        inputFile:  inputFile.path,
        projectDir: project?.folderPath ?? '',
        providerId: cfg.providerId,
        baseUrl:    cfg.baseUrl,
        model:      cfg.model,
        maxTokens:  cfg.maxTokens,
        temperature: cfg.temperature,
      }).catch(err => {
        setRunning(false)
        setRunDone({ success: false, message: `IPC error: ${err.message}` })
      })
      return
    }

    // ── Fallback: run via existing runWorkflow IPC ──
    console.warn('[NodePage] pipeline:run IPC not available — falling back to runWorkflow')
    const workflow = buildWorkflow(activePipeline, inputFile.path, project)

    const u1 = window.electron.onStepUpdate?.(({ stepId, status, pct }) => {
      setRunSteps(prev => prev.map(s =>
        s.num === stepId ? { ...s, status: status === 'running' ? 'running' : s.status, pct } : s
      ))
    })
    const u2 = window.electron.onStepDone?.(({ stepId, success, message }) => {
      setRunSteps(prev => prev.map(s =>
        s.num === stepId
          ? { ...s, status: success ? 'done' : 'error', pct: success ? 100 : s.pct, message: message ?? null }
          : s
      ))
    })
    const u3 = window.electron.onWorkflowDone?.(({ success, message }) => {
      setRunning(false)
      setRunDone({ success, message: message ?? (success ? 'Pipeline complete.' : 'Pipeline failed.') })
      if (success) {
        onWorkflowComplete?.()
        setTimeout(() => onNavigateToOutputs?.(), 800)
      }
      u1?.(); u2?.(); u3?.()
    })

    const cfg = settingsStore.getActiveConfig() ?? {}
    const sessionId = new Date().toISOString().replace(/[:.]/g, '-')
    window.electron.getSessionPath?.({ sessionId, projectDir: project?.folderPath ?? '' })
    window.electron.runWorkflow?.({
      workflow,
      sessionId,
      projectDir:  project?.folderPath ?? '',
      providerId:  cfg.providerId,
      baseUrl:     cfg.baseUrl,
      model:       cfg.model,
      maxTokens:   cfg.maxTokens,
      temperature: cfg.temperature,
    })
  }

  function cancelRun() {
    window.electron?.pipeline?.cancel?.(activePipeline?.id)
    setRunning(false)
    setRunSteps(prev => prev.map(s =>
      s.status === 'running' || s.status === 'waiting'
        ? { ...s, status: 'cancelled' }
        : s
    ))
    setRunDone({ success: false, message: 'Cancelled by user.' })
  }

  function exportPipeline() {
    if (!activePipeline) return
    const blob = new Blob([JSON.stringify(activePipeline, null, 2)], { type:'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${activePipeline.name.replace(/\s+/g,'_')}.pipeline.json`
    a.click()
  }

  function importPipeline(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const p = { ...JSON.parse(ev.target.result), id: uid() }
        savePipelines([...pipelines, p])
        setActivePipeId(p.id)
      } catch { alert('Invalid pipeline file') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="np-root">

      <NodeMediaLibrary
        projectFiles={projectFiles}
        inputFile={inputFile}
        onSelectFile={setInputFile}
        project={project}
        activeProvider={activeProvider}
      />

      <main className="np-canvas">
        <div className="np-pipe-bar">
          <div className="np-pipe-tabs">
            {pipelines.map(p => (
              <div
                key={p.id}
                className={`np-pipe-tab ${p.id === activePipeId ? 'active' : ''}`}
                onClick={() => { setActivePipeId(p.id); setSelectedStep(null) }}
              >
                <span className="np-pipe-tab-name">{p.name}</span>
                <span
                  className="np-pipe-tab-del"
                  onClick={e => { e.stopPropagation(); deletePipeline(p.id) }}
                >×</span>
              </div>
            ))}
          </div>
          <div className="np-pipe-actions">
            <button className="np-icon-btn" title="New pipeline" onClick={() => setShowTemplates(true)}>＋</button>
            <button className="np-icon-btn" title="Export pipeline" onClick={exportPipeline}>↓</button>
            <label className="np-icon-btn" title="Import pipeline">
              ↑ <input type="file" accept=".json" style={{display:'none'}} onChange={importPipeline}/>
            </label>

          </div>
        </div>

        {!activePipeline ? (
          <div className="np-empty">
            <div className="np-empty-icon">⬡</div>
            <div className="np-empty-title">No pipeline selected</div>
            <button className="np-create-btn" onClick={() => setShowTemplates(true)}>Create pipeline</button>
          </div>
        ) : (
          <>
            <div className="np-input-bar">
              <span className="np-input-label">INPUT</span>
              {inputFile ? (
                <div className="np-input-file">
                  <span className="np-input-ext">{inputFile.ext?.toUpperCase() ?? 'FILE'}</span>
                  <span className="np-input-name">{inputFile.name}</span>
                  <button className="np-input-clear" onClick={() => setInputFile(null)}>×</button>
                </div>
              ) : (
                <span className="np-input-hint">← Select a file from the media library</span>
              )}
            </div>

            <div className="np-steps-scroll">
              {activePipeline.steps.length === 0 && (
                <div className="np-steps-empty">Add steps from the panel on the right →</div>
              )}

              {activePipeline.steps.map((step, idx) => {
                const runStep = runSteps[idx]
                return (
                  <React.Fragment key={step.id}>
                    <div
                      className={`np-step ${selectedStepId === step.id ? 'selected' : ''} ${runStep?.status ?? ''}`}
                      onClick={() => setSelectedStep(step.id)}
                      draggable
                      onDragStart={e => onDragStart(e, idx)}
                      onDragEnter={e => onDragEnter(e, idx)}
                      onDragEnd={onDragEnd}
                      onDragOver={e => e.preventDefault()}
                    >
                      <div className="np-step-accent" style={{ background: stepColor(step.type) }} />

                      <div className="np-step-num" style={{ background: stepColor(step.type) }}>
                        {runStep?.status === 'done'    ? '✓'
                       : runStep?.status === 'error'   ? '✗'
                       : runStep?.status === 'running' ? <Spinner/>
                       : idx + 1}
                      </div>

                      <div className="np-step-body">
                        <div className="np-step-row1">
                          <span className="np-step-icon">{stepIcon(step.type)}</span>
                          <span className="np-step-title">{step.title}</span>
                          <span className="np-step-badge" style={{ borderColor:stepColor(step.type), color:stepColor(step.type) }}>
                            {stepLabel(step.type)}
                          </span>
                        </div>
                        <div className="np-step-preview">
                          {step.type === 'shell' || step.type === 'for_each_shell' || step.type === 'compress' || step.type === 'scale_916'
                            ? <code>{(step.command||'').slice(0,90)}{(step.command||'').length>90?'…':''}</code>
                            : step.type === 'whisper'
                            ? <span>model:{step.model} · {step.wordsPerLine}w/line · {step.outputFormat}{step.iteratesOver ? ' · per clip' : ''}</span>
                            : step.type === 'ai_analyse'
                            ? <span className="italic">{(step.prompt||'').slice(0,72)}{(step.prompt||'').length>72?'…':''}</span>
                            : step.type === 'ffmpeg_clip'
                            ? <span>Clips from AI analysis timestamps</span>
                            : step.type === 'burn_captions'
                            ? <span>fontsize:{step.fontsize} · {step.fontcolor}</span>
                            : null
                          }
                        </div>

                        {runStep?.status === 'running' && (
                          <div className="np-step-progress">
                            <div className="np-step-progress-fill"
                              style={{
                                width: runStep.pct > 0 ? `${runStep.pct}%` : '35%',
                                animation: runStep.pct === 0 ? 'indeterminate 1.5s ease-in-out infinite' : 'none',
                              }}
                            />
                          </div>
                        )}

                        {runStep?.status === 'done' && runStep.output && (
                          <div className="np-step-output">
                            → {runStep.output.split(/[\\/]/).pop()}
                          </div>
                        )}

                        {runStep?.status === 'error' && (
                          <div className="np-step-error">{runStep.message}</div>
                        )}
                      </div>

                      <button
                        className="np-step-remove"
                        onClick={e => { e.stopPropagation(); removeStep(step.id) }}
                      >×</button>
                    </div>

                    {idx < activePipeline.steps.length - 1 && (
                      <div className="np-connector">
                        <div className="np-conn-line" style={{background:stepColor(step.type)}}/>
                        <div className="np-conn-arrow" style={{color:stepColor(activePipeline.steps[idx+1].type)}}>▼</div>
                        <span className="np-conn-label">output → input</span>
                      </div>
                    )}
                  </React.Fragment>
                )
              })}
            </div>

            {/* ── Live run overlay ── */}
            {(running || runDone) && runSteps.length > 0 && (
              <div className="np-run-overlay">
                <div className="np-run-overlay-header">
                  <span className="np-run-overlay-title">
                    {running ? '▶ Running pipeline…' : runDone?.success ? '✓ Pipeline complete' : '✗ Pipeline failed'}
                  </span>
                  {!running && (
                    <button className="np-run-overlay-close"
                      onClick={() => { setRunSteps([]); setRunDone(null) }}>
                      ×
                    </button>
                  )}
                </div>

                {/* Overall progress */}
                <div className="np-run-overall-bar">
                  <div className="np-run-overall-fill" style={{
                    width: `${Math.round(
                      runSteps.reduce((acc,s) => acc + (s.status==='done'||s.status==='error' ? 100 : s.pct), 0)
                      / Math.max(runSteps.length, 1)
                    )}%`,
                    background: runDone?.success ? '#1D9E75'
                              : runDone && !runDone.success ? '#E24B4A'
                              : 'linear-gradient(90deg,#8B35CC,#1B9FD4)',
                  }} />
                </div>

                {/* Per-step rows */}
                <div className="np-run-steps">
                  {runSteps.map(s => (
                    <div key={s.num} className={`np-run-step-row ${s.status}`}>
                      <div className="np-run-step-indicator">
                        {s.status==='done'      ? <span style={{color:'#1D9E75'}}>✓</span>
                       : s.status==='error'      ? <span style={{color:'#E24B4A'}}>✗</span>
                       : s.status==='running'    ? <RunningDot/>
                       : s.status==='cancelled'  ? <span style={{color:'#F59E0B'}}>—</span>
                       : <span style={{color:'rgba(200,216,232,0.2)'}}>{s.num}</span>}
                      </div>
                      <div className="np-run-step-info">
                        <div className="np-run-step-title">{s.title}</div>
                        {s.status==='running' && (
                          <div className="np-run-step-bar">
                            <div className="np-run-step-bar-fill" style={{
                              width: s.pct > 0 ? `${s.pct}%` : '30%',
                              animation: s.pct===0 ? 'indeterminate 1.5s ease-in-out infinite' : 'none',
                            }} />
                          </div>
                        )}
                        {s.status==='done' && s.output && (
                          <div className="np-run-step-out">
                            → {s.output.split(/[\\/]/).pop()}
                          </div>
                        )}
                        {s.status==='error' && s.message && (
                          <div className="np-run-step-err">{s.message}</div>
                        )}
                      </div>
                      <div className="np-run-step-pct">
                        {s.status==='running' && s.pct > 0 ? `${s.pct}%`
                       : s.status==='done'    ? '100%'
                       : ''}
                      </div>
                    </div>
                  ))}
                </div>

                {runDone && (
                  <div className={`np-run-done-banner ${runDone.success ? 'ok' : 'fail'}`}>
                    <span>{runDone.success ? '✓ All steps complete' : `✗ ${runDone.message}`}</span>
                    {runDone.success && runDone.outputDir && (
                      <button className="np-open-output"
                        onClick={() => window.electron?.openFile?.(runDone.outputDir)}>
                        Open folder ↗
                      </button>
                    )}
                    {runDone.success && (
                      <button className="np-open-output" style={{marginLeft:4}}
                        onClick={() => onNavigateToOutputs?.()}>
                        Output files →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="np-run-bar">
              <div className="np-run-controls">
                {running ? (
                  <button className="np-run-btn cancel" onClick={cancelRun}>■ Cancel</button>
                ) : (
                  <button
                    className={`np-run-btn ${(!inputFile || activePipeline.steps.length===0) ? 'disabled':''}`}
                    onClick={runPipeline}
                    disabled={!inputFile || activePipeline.steps.length===0}
                    title={!inputFile ? 'Select an input file first' : ''}
                  >
                    ▶ Run Pipeline
                    {!inputFile && <span className="np-run-hint-inline"> — select a file first</span>}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <aside className="np-editor-col">
        {selectedStep ? (
          <StepEditor
            step={selectedStep}
            onUpdate={patch => updateStep(selectedStep.id, patch)}
            onClose={() => setSelectedStep(null)}
          />
        ) : (
          <AddStepPanel onAdd={addStep} />
        )}
      </aside>

      <aside className="np-chat-col">
        <div className="np-chat-topbar">
          <button
            className="np-chat-history-btn"
            onClick={() => setShowNodeChats(s => !s)}
            title="Chat history"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 3H10M2 6H10M2 9H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
          <span className="np-chat-topbar-title">
            {nodeChats.find(c => c.id === nodeChatId)?.title ?? 'New chat'}
          </span>
          <button className="np-new-chat-btn" onClick={handleNewNodeChat}>+ New chat</button>
        </div>

        {showNodeChats && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 99 }}
              onClick={() => setShowNodeChats(false)}
            />
            <div className="np-chat-sidebar">
              {nodeChats.length === 0 && (
                <div className="np-chat-sidebar-empty">No chats yet</div>
              )}
              {nodeChats.map(chat => (
                <div
                  key={chat.id}
                  className={`np-chat-sidebar-row ${chat.id === nodeChatId ? 'active' : ''}`}
                  onClick={() => { setNodeChatId(chat.id); setShowNodeChats(false) }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setNodeChatId(chat.id)
                      setShowNodeChats(false)
                    }
                  }}
                >
                  <div className="np-csr-head">
                    <div className="np-csr-title">{chat.title}</div>
                    <button
                      className="np-chat-delete-btn"
                      title="Delete chat"
                      onClick={async (e) => {
                        e.stopPropagation()
                        await handleDeleteNodeChat(chat.id)
                      }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  <div className="np-csr-meta">
                    {chat.messageCount} msg{chat.messageCount !== 1 ? 's' : ''} · {new Date(chat.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <NodeChatBridge
          project={project}
          toolsBlock={toolsBlock}
          projectFiles={projectFiles}
          outputFiles={outputFiles}
          activeChatId={nodeChatId}
          onChatSaved={refreshNodeChats}
          onSessionId={onSessionId}
          onTaskUpdate={onTaskUpdate}
          onAppendStep={appendFromWorkflowStep}
          inputFile={inputFile}
        />
      </aside>

      {showTemplates && (
        <TemplateModal onSelect={createFromTemplate} onClose={() => setShowTemplates(false)} />
      )}
    </div>
  )
}

function NodeMediaLibrary({ projectFiles, inputFile, onSelectFile, project, activeProvider }) {
  const EXT_COLORS = {
    mp4:'#8B35CC', mov:'#8B35CC', avi:'#8B35CC', mkv:'#8B35CC', webm:'#8B35CC',
    mp3:'#1B9FD4', wav:'#1B9FD4', aac:'#1B9FD4', flac:'#1B9FD4',
    png:'#27AE85',  jpg:'#27AE85', jpeg:'#27AE85', webp:'#27AE85',
    gif:'#C8A020',
  }
  const EXT_GROUPS = {
    video: ['mp4','mov','avi','mkv','webm','m4v'],
    audio: ['mp3','wav','aac','flac','m4a','ogg'],
    image: ['png','jpg','jpeg','webp','gif'],
  }

  function groupLabel(ext) {
    for (const [g, exts] of Object.entries(EXT_GROUPS)) {
      if (exts.includes(ext?.toLowerCase())) return g
    }
    return 'other'
  }

  const grouped = projectFiles.reduce((acc, f) => {
    const g = groupLabel(f.ext)
    if (!acc[g]) acc[g] = []
    acc[g].push(f)
    return acc
  }, {})

  return (
    <aside className="np-library">
      <div className="np-library-header">
        <span className="np-section-label">MEDIA</span>
        <span className="np-file-count">{projectFiles.length} files</span>
      </div>

      <div className="np-library-list">
        {projectFiles.length === 0 && (
          <div className="np-library-empty">No files in project yet</div>
        )}

        {Object.entries(grouped).map(([group, files]) => (
          <div key={group} className="np-lib-group">
            <div className="np-lib-group-label">{group}</div>
            {files.map(f => (
              <div
                key={f.path}
                className={`np-lib-file ${inputFile?.path === f.path ? 'selected' : ''}`}
                onClick={() => onSelectFile(f)}
                title={f.path}
              >
                <div
                  className="np-lib-ext"
                  style={{ background: EXT_COLORS[f.ext?.toLowerCase()] ?? '#888' }}
                >
                  {f.ext?.toUpperCase().slice(0,4)}
                </div>
                <div className="np-lib-info">
                  <div className="np-lib-name">{f.name}</div>
                  <div className="np-lib-size">{f.size}</div>
                </div>
                {inputFile?.path === f.path && <span className="np-lib-check">✓</span>}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="np-library-footer">
        <div className="np-section-label" style={{marginBottom:6}}>SESSION</div>
        {[
          ['provider', activeProvider],
          ['files',    `${projectFiles.length}`],
        ].map(([k,v]) => (
          <div key={k} className="np-session-row">
            <span className="np-session-key">{k}</span>
            <span className="np-session-val">{v}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}

function StepEditor({ step, onUpdate, onClose }) {
  const def = STEP_TYPES[step.type] ?? {}
  return (
    <div className="np-step-editor">
      <div className="np-editor-hdr">
        <span style={{color:stepColor(step.type), fontSize:18}}>{stepIcon(step.type)}</span>
        <span className="np-editor-hdr-title">Edit Step</span>
        <button className="np-editor-back" onClick={onClose}>← Add</button>
      </div>

      <div className="np-editor-body">
        <Field label="Title">
          <input className="np-input" value={step.title}
            onChange={e => onUpdate({title:e.target.value})} />
        </Field>

        {(step.type==='shell'||step.type==='for_each_shell'||step.type==='compress'||step.type==='scale_916') && (
          <Field label="Command" hint="Tokens: {input} {output} {outputDir} {basename} {original} {srt} {n}">
            <textarea className="np-textarea" rows={6}
              value={step.command || def.defaultCommand || ''}
              onChange={e => onUpdate({command:e.target.value})}/>
          </Field>
        )}

        {step.type==='whisper' && <>
          <Field label="Model">
            <select className="np-select" value={step.model} onChange={e=>onUpdate({model:e.target.value})}>
              {['tiny','base','small','medium','large'].map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Output format">
            <select className="np-select" value={step.outputFormat} onChange={e=>onUpdate({outputFormat:e.target.value})}>
              {['srt','vtt','txt','json'].map(f=><option key={f} value={f}>{f}</option>)}
            </select>
          </Field>
          <Field label="Words per line">
            <input className="np-input" type="number" min="1" max="20"
              value={step.wordsPerLine} onChange={e=>onUpdate({wordsPerLine:e.target.value})}/>
          </Field>
          <Field label="Iterate over">
            <select className="np-select" value={step.iteratesOver??''} onChange={e=>onUpdate({iteratesOver:e.target.value})}>
              <option value="">Single file (input)</option>
              <option value="clips">Each clip (from clip step)</option>
            </select>
          </Field>
        </>}

        {step.type==='ai_analyse' && <>
          <Field label="Prompt" hint="The AI receives the previous step's output file content + this prompt.">
            <textarea className="np-textarea" rows={9}
              value={step.prompt}
              onChange={e=>onUpdate({prompt:e.target.value})}
              placeholder="e.g. Read this SRT and return a JSON array of the best 3-5 clips. Each: {start, end, reason}. Return ONLY valid JSON."/>
          </Field>
          <Field label="Save output as">
            <select className="np-select" value={step.outputFormat} onChange={e=>onUpdate({outputFormat:e.target.value})}>
              <option value="json">JSON</option>
              <option value="txt">TXT</option>
            </select>
          </Field>
        </>}

        {step.type==='burn_captions' && <>
          <Field label="Font size">
            <input className="np-input" type="number" min="10" max="60"
              value={step.fontsize} onChange={e=>onUpdate({fontsize:e.target.value})}/>
          </Field>
          <Field label="Font color">
            <input className="np-input" value={step.fontcolor}
              onChange={e=>onUpdate({fontcolor:e.target.value})}
              placeholder="white, #FFFFFF, yellow..."/>
          </Field>
        </>}

        {step.type==='ffmpeg_clip' && (
          <div className="np-type-note">
            Reads the JSON output from the previous AI Analyse step.
            Each item's start/end timestamps becomes one clip from the original input file.
          </div>
        )}

        <div className="np-type-desc">{def.description}</div>
      </div>
    </div>
  )
}

function AddStepPanel({ onAdd }) {
  return (
    <div className="np-add-panel">
      <div className="np-editor-hdr">
        <span className="np-editor-hdr-title">Add Step</span>
      </div>
      <div className="np-add-list">
        {Object.entries(STEP_TYPES).map(([type, def]) => (
          <button key={type} className="np-add-btn" onClick={() => onAdd(type)}
            style={{'--sc':def.color}}>
            <span className="np-add-icon">{def.icon}</span>
            <div className="np-add-btn-body">
              <div className="np-add-label">{def.label}</div>
              <div className="np-add-desc">{def.description}</div>
              {def.defaultCommand && (
                <code className="np-add-cmd">{def.defaultCommand.slice(0, 80)}{def.defaultCommand.length > 80 ? '…' : ''}</code>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function NodeChatBridge({ project, toolsBlock, projectFiles, outputFiles,
  activeChatId, onChatSaved, onSessionId, onTaskUpdate, onAppendStep, inputFile }) {

  return (
    <ChatPanel
      project={project}
      toolsBlock={toolsBlock}
      projectFiles={projectFiles}
      outputFiles={outputFiles}
      activeChatId={activeChatId}
      onChatSaved={onChatSaved}
      onSessionId={onSessionId}
      onTaskUpdate={onTaskUpdate}
      onConvertStepToNode={(step) => onAppendStep(step, inputFile?.path)}
      onWorkflowComplete={() => {}}
      onPendingWorkflow={() => {}}
      attachedFiles={inputFile ? [inputFile.name] : []}
      onClearAttachments={() => {}}
      context="node"
    />
  )
}

function TemplateModal({ onSelect, onClose }) {
  return (
    <div className="np-modal-bg" onClick={onClose}>
      <div className="np-modal" onClick={e=>e.stopPropagation()}>
        <div className="np-modal-hdr">
          <span>Choose a template</span>
          <button className="np-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="np-modal-grid">
          {TEMPLATES.map(t => (
            <button key={t.id} className="np-tpl-card" onClick={()=>onSelect(t)}>
              <div className="np-tpl-icon">{t.icon}</div>
              <div className="np-tpl-name">{t.name}</div>
              <div className="np-tpl-desc">{t.description}</div>
              <div className="np-tpl-dots">
                {t.steps.map((s,i)=>(
                  <span key={i} className="np-tpl-dot" style={{background:stepColor(s.type)}}/>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="np-field">
      <div className="np-field-label">{label}</div>
      {hint && <div className="np-field-hint">{hint}</div>}
      {children}
    </div>
  )
}

function Spinner() {
  return <span className="np-spinner">◌</span>
}

// ── RunningDot ───────────────────────────────────────────────────────────────────
function RunningDot() {
  return (
    <div style={{
      width:8, height:8, borderRadius:'50%', background:'#8B35CC',
      animation:'pulse 1s ease-in-out infinite', flexShrink:0,
    }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}`}</style>
    </div>
  )
}

export function buildWorkflow(pipeline, inputFilePath, project) {
  const outputDir = project
    ? `${project.folderPath}\\output`
    : 'output'
  const basename = inputFilePath.split(/[\\/]/).pop().replace(/\.[^.]+$/,'')

  const steps = pipeline.steps.map((step, idx) => {
    const num = idx + 1
    const ext = step.outputFormat ?? 'mp4'

    const resolveCmd = (cmd) => (cmd || '')
      .replace(/\{input\}/g,    inputFilePath)
      .replace(/\{output\}/g,   `${outputDir}\\${basename}_step${num}.${ext}`)
      .replace(/\{outputDir\}/g, outputDir)
      .replace(/\{basename\}/g,  basename)
      .replace(/\{original\}/g,  inputFilePath)

    if (step.type==='shell'||step.type==='for_each_shell'||step.type==='compress'||step.type==='scale_916') {
      return { id:num, type:'shell', title:step.title, description:step.title,
        command: resolveCmd(step.command || STEP_TYPES[step.type]?.defaultCommand || ''), durationSec:null }
    }
    if (step.type==='whisper') {
      const inp = step.iteratesOver==='clips' ? '{clip}' : inputFilePath
      return { id:num, type:'shell', title:step.title, durationSec:null,
        command:`whisper "${inp}" --model ${step.model} --output_format ${step.outputFormat} --word_timestamps True --max_words_per_line ${step.wordsPerLine} --output_dir "${outputDir}"` }
    }
    if (step.type==='ai_analyse') {
      return { id:num, type:'ai_analyse', title:step.title, prompt:step.prompt, outputFormat:step.outputFormat }
    }
    if (step.type==='ffmpeg_clip') {
      return { id:num, type:'ffmpeg_clip', title:step.title, sourceVideo:inputFilePath }
    }
    if (step.type==='burn_captions') {
      return { id:num, type:'shell', title:step.title,
        command:`ffmpeg -y -i "${outputDir}\\clip_{n}.mp4" -vf "subtitles=${outputDir}\\clip_{n}.srt:force_style='FontSize=${step.fontsize},PrimaryColour=&Hffffff&'" "${outputDir}\\clip_{n}_captioned.mp4"`,
        durationSec:null }
    }
    return { id:num, type:'shell', title:step.title, command:'', durationSec:null }
  })

  return { message:pipeline.name, steps, final_output:`${outputDir}\\${basename}_final.mp4` }
}
