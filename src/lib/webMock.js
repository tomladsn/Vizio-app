/**
 * Vizio Web Mock Environment
 * Provides a mock implementation of window.electron for standard web browsers.
 * Persists data in localStorage and simulates workflow progress & AI responses.
 */

export function initWebMock() {
  if (typeof window === 'undefined') return
  if (typeof window.electron !== 'undefined') return

  console.log('[Vizio Web] Initializing Web Mock Environment...')

  // ── Local Storage Keys & Defaults ──────────────────────────────────────────
  const STORAGE_KEYS = {
    PROJECTS: 'vizio-web-projects',
    KEYS: 'vizio-web-keys',
    CHATS_PREFIX: 'vizio-web-chats-',
    CHAT_LIST_PREFIX: 'vizio-web-chatlist-',
    MEDIA_PREFIX: 'vizio-web-media-',
    OUTPUTS_PREFIX: 'vizio-web-outputs-',
  }

  // Helper: Load JSON from localStorage
  const dbLoad = (key, fallback) => {
    try {
      const val = localStorage.getItem(key)
      return val ? JSON.parse(val) : fallback
    } catch {
      return fallback
    }
  }

  // Helper: Save JSON to localStorage
  const dbSave = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data))
    } catch (e) {
      console.error('[Vizio Web] Failed to save storage key:', key, e)
    }
  }

  // Initialize Default Mock Project
  const defaultProjects = [
    {
      id: 'demo-proj',
      name: 'My Demo Project',
      folderPath: '/vizio/projects/demo-proj',
      lastActive: true,
    },
  ]
  if (!localStorage.getItem(STORAGE_KEYS.PROJECTS)) {
    dbSave(STORAGE_KEYS.PROJECTS, defaultProjects)
  }

  const defaultMedia = [
    { name: 'vizio_promo_clip.mp4', path: '/vizio/projects/demo-proj/vizio_promo_clip.mp4', sizeBytes: 15420100, ext: 'mp4' },
    { name: 'narration_en.wav', path: '/vizio/projects/demo-proj/narration_en.wav', sizeBytes: 4501200, ext: 'wav' },
    { name: 'poster_thumbnail.jpg', path: '/vizio/projects/demo-proj/poster_thumbnail.jpg', sizeBytes: 245000, ext: 'jpg' },
  ]
  const mediaKey = STORAGE_KEYS.MEDIA_PREFIX + 'demo-proj'
  if (!localStorage.getItem(mediaKey)) {
    dbSave(mediaKey, defaultMedia)
  }

  const defaultOutputs = [
    { name: 'vizio_rendered_video.mp4', path: '/vizio/projects/demo-proj/outputs/vizio_rendered_video.mp4', sizeBytes: 11200500, ext: 'mp4' },
    { name: 'vizio_subtitles.srt', path: '/vizio/projects/demo-proj/outputs/vizio_subtitles.srt', sizeBytes: 4500, ext: 'srt' },
  ]
  const outputsKey = STORAGE_KEYS.OUTPUTS_PREFIX + 'demo-proj'
  if (!localStorage.getItem(outputsKey)) {
    dbSave(outputsKey, defaultOutputs)
  }

  const defaultChatList = [
    { id: 'chat-demo-1', title: 'Getting Started', lastUpdated: Date.now() },
  ]
  const chatListKey = STORAGE_KEYS.CHAT_LIST_PREFIX + 'demo-proj'
  if (!localStorage.getItem(chatListKey)) {
    dbSave(chatListKey, defaultChatList)
  }

  const defaultChatMessages = [
    { id: 1, role: 'ai', content: '{"mode":"chat","message":"Welcome to Vizio Web Demo! I am your AI media assistant. You can request transcription, translations, audio processing, or convert files directly in the browser using simulated workflows."}' },
  ]
  const chatMessagesKey = STORAGE_KEYS.CHATS_PREFIX + 'demo-proj-chat-demo-1'
  if (!localStorage.getItem(chatMessagesKey)) {
    dbSave(chatMessagesKey, defaultChatMessages)
  }

  // ── IPC Listeners Registry ──────────────────────────────────────────────────
  const listeners = {
    stepStart: [],
    stepUpdate: [],
    stepOutput: [],
    stepCmdUpdate: [],
    stepDone: [],
    done: [],
    mediaChanged: [],
  }

  // Handle stream event channels dynamically
  const streamListeners = {}

  // Helper to dispatch event
  const dispatch = (event, data) => {
    if (listeners[event]) {
      listeners[event].forEach(cb => {
        try { cb(data) } catch (e) { console.error(e) }
      })
    }
  }

  // ── Mock AI Assistant Responses ─────────────────────────────────────────────
  function generateMockResponse(promptText) {
    const text = promptText.toLowerCase()
    
    // Check for captions/srt/transcription requests
    if (text.includes('caption') || text.includes('subtitle') || text.includes('transcribe') || text.includes('srt')) {
      return JSON.stringify({
        mode: 'workflow',
        message: 'I have created a workflow to transcribe your video and generate a subtitle file.',
        steps: [
          {
            id: 1,
            type: 'shell',
            title: 'Extract Audio',
            description: 'Extract raw audio stream using FFmpeg',
            command: 'ffmpeg -y -i "/vizio/projects/demo-proj/vizio_promo_clip.mp4" -vn -acodec pcm_s16le -ar 16000 -ac 1 "/tmp/audio.wav"',
          },
          {
            id: 2,
            type: 'shell',
            title: 'Whisper Transcribe',
            description: 'Transcribe audio stream using OpenAI Whisper model',
            command: 'whisper --model base --language en --output_format srt --output_dir "/vizio/projects/demo-proj/outputs" "/tmp/audio.wav"',
          },
          {
            id: 3,
            type: 'shell',
            title: 'Merge Captions',
            description: 'Overlay subtitles onto the output video file',
            command: 'ffmpeg -y -i "/vizio/projects/demo-proj/vizio_promo_clip.mp4" -vf "subtitles=/vizio/projects/demo-proj/outputs/audio.srt" "/vizio/projects/demo-proj/outputs/vizio_promo_clip_subtitled.mp4"',
          }
        ],
        final_output: '/vizio/projects/demo-proj/outputs/vizio_promo_clip_subtitled.mp4',
      })
    }

    // Check for audio extraction/normalisation requests
    if (text.includes('audio') || text.includes('extract') || text.includes('volume') || text.includes('sound')) {
      return JSON.stringify({
        mode: 'workflow',
        message: 'I have drafted a workflow to extract and normalize the audio channel of the selected clip.',
        steps: [
          {
            id: 1,
            type: 'shell',
            title: 'Analyze volume',
            description: 'Measure peak audio levels',
            command: 'ffmpeg -i "/vizio/projects/demo-proj/vizio_promo_clip.mp4" -filter:a volumedetect -f null -',
          },
          {
            id: 2,
            type: 'shell',
            title: 'Normalize & Output Audio',
            description: 'Apply volume gain filter and export WAV file',
            command: 'ffmpeg -i "/vizio/projects/demo-proj/vizio_promo_clip.mp4" -filter:a "volume=3.5dB" -vn "/vizio/projects/demo-proj/outputs/normalized_audio.wav"',
          }
        ],
        final_output: '/vizio/projects/demo-proj/outputs/normalized_audio.wav',
      })
    }

    // Convert format requests (e.g. convert to webp)
    if (text.includes('convert') || text.includes('webp') || text.includes('format')) {
      return JSON.stringify({
        mode: 'workflow',
        message: 'I have set up a workflow to convert media files to WebP / web formats.',
        steps: [
          {
            id: 1,
            type: 'shell',
            title: 'Convert poster',
            description: 'Convert poster_thumbnail.jpg to poster_thumbnail.webp',
            command: 'ffmpeg -y -i "/vizio/projects/demo-proj/poster_thumbnail.jpg" -qscale 80 "/vizio/projects/demo-proj/outputs/poster_thumbnail.webp"',
          }
        ],
        final_output: '/vizio/projects/demo-proj/outputs/poster_thumbnail.webp',
      })
    }

    // Default chat fallback
    return JSON.stringify({
      mode: 'chat',
      message: `I received your prompt: "${promptText}". In this web preview mode, I can draft workflows for transcribing video files, processing audio, or converting formats. Try asking "generate subtitles for vizio_promo_clip.mp4"!`,
    })
  }

  // ── Running Workflows Simulation ───────────────────────────────────────────
  let workflowTimer = null
  function simulateWorkflow(payload) {
    if (workflowTimer) clearInterval(workflowTimer)

    const { workflow, projectDir } = payload
    const steps = workflow.steps || []
    let stepIndex = 0
    let stepPct = 0

    dispatch('stepStart', { stepId: steps[0]?.id, cmd: steps[0]?.command })
    dispatch('stepCmdUpdate', { stepId: steps[0]?.id, cmd: steps[0]?.command, message: 'Launching command...' })

    workflowTimer = setInterval(() => {
      if (stepIndex >= steps.length) {
        clearInterval(workflowTimer)
        workflowTimer = null
        
        // Add final output to simulated outputs list
        if (workflow.final_output) {
          const outName = workflow.final_output.split('/').pop() || 'new_output.mp4'
          const projId = projectDir.split('/').pop() || 'demo-proj'
          const outKey = STORAGE_KEYS.OUTPUTS_PREFIX + projId
          const currentOuts = dbLoad(outKey, [])
          if (!currentOuts.some(o => o.name === outName)) {
            currentOuts.push({
              name: outName,
              path: workflow.final_output,
              sizeBytes: 8500200,
              ext: outName.split('.').pop() || 'mp4',
            })
            dbSave(outKey, currentOuts)
            dispatch('mediaChanged', {})
          }
        }

        dispatch('done', { success: true, message: 'Workflow completed successfully.', aiReply: null })
        return
      }

      const activeStep = steps[stepIndex]

      if (stepPct < 100) {
        stepPct += Math.floor(Math.random() * 20) + 10
        if (stepPct > 100) stepPct = 100

        // Emit stdout logs
        dispatch('stepOutput', {
          stepId: activeStep.id,
          stream: 'stdout',
          text: `[DEBUG] Running mock operations: ${stepPct}%\r\n`,
        })

        dispatch('stepUpdate', {
          stepId: activeStep.id,
          status: 'running',
          pct: stepPct,
        })
      } else {
        // Complete current step
        dispatch('stepDone', {
          stepId: activeStep.id,
          success: true,
          message: `Step ${stepIndex + 1} completed.`,
        })

        stepIndex++
        stepPct = 0

        if (stepIndex < steps.length) {
          const nextStep = steps[stepIndex]
          dispatch('stepStart', { stepId: nextStep.id, cmd: nextStep.command })
          dispatch('stepCmdUpdate', { stepId: nextStep.id, cmd: nextStep.command, message: 'Running next action...' })
        }
      }
    }, 600)
  }

  // ── Construct window.electron ──────────────────────────────────────────────
  window.electron = {
    // Tool scans
    scanTools: () => Promise.resolve({
      tools: [
        { name: 'Python', available: true, version: '3.11.0', bundled: false },
        { name: 'ffmpeg', available: true, version: '6.1.1', bundled: true },
        { name: 'ffprobe', available: true, version: '6.1.1', bundled: true },
        { name: 'ffplay', available: true, version: '6.1.1', bundled: true },
        { name: 'yt-dlp', available: true, version: '2024.03.10', bundled: false },
        { name: 'whisper', available: true, version: '20231117', bundled: false, whisperModels: ['base', 'small', 'medium'] },
        { name: 'magick', available: true, version: '7.1.1', bundled: false },
      ],
      block: 'Web mock mode: Local system tools are simulated.',
    }),
    installTool: (toolId) => Promise.resolve({ ok: true }),
    scanToolsBlock: () => Promise.resolve('Tools are active.'),
    bins: {
      status: () => Promise.resolve({
        ffmpeg: 'installed',
        ffprobe: 'installed',
        ytDlp: 'installed',
        whisper: 'installed',
      }),
    },

    // File Probing
    probeFiles: (filePaths) => Promise.resolve(
      filePaths.map(p => ({
        path: p,
        duration: 120.5,
        width: 1920,
        height: 1080,
        sizeBytes: 15420100,
        formatName: 'mov,mp4,m4a,3gp,3g2,mj2',
      }))
    ),
    readFilesBase64: (filePaths) => Promise.resolve(
      filePaths.map(() => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=')
    ),

    // Workflow execution
    runWorkflow: (payload) => {
      simulateWorkflow(payload)
      return Promise.resolve({ ok: true })
    },

    // Sessions
    initSession: (payload) => Promise.resolve({ ok: true, sessionId: 'web-session-1' }),
    readSessionLog: (sessionId) => Promise.resolve('[SYSTEM] Mock session logs active.\n[CMD] ffmpeg -version\n[INFO] Simulated successful execution on Web Browser.'),
    listSessionFiles: (sessionId, projectDir) => Promise.resolve([]),
    listProjectSessions: (projectDir) => Promise.resolve([]),

    // File opening & misc
    openFile: (filePath) => console.log('[Vizio Web] Mock open file:', filePath),
    getSessionPath: (payload) => Promise.resolve('/tmp/vizio-web-session'),
    prepareWorkflow: (payload) => Promise.resolve({ ok: true }),
    cancelWorkflow: (sessionId) => {
      if (workflowTimer) {
        clearInterval(workflowTimer)
        workflowTimer = null
        dispatch('done', { success: false, message: 'Workflow cancelled by user.', aiReply: null })
      }
      return Promise.resolve({ ok: true })
    },

    // Secure Store Credentials
    keys: {
      set: (keyId, value) => {
        const store = dbLoad(STORAGE_KEYS.KEYS, {})
        store[keyId] = value
        dbSave(STORAGE_KEYS.KEYS, store)
        return Promise.resolve({ ok: true })
      },
      getHint: (keyId) => {
        const store = dbLoad(STORAGE_KEYS.KEYS, {})
        const val = store[keyId]
        if (!val) return Promise.resolve({ exists: false, hint: '' })
        return Promise.resolve({ exists: true, hint: val.slice(0, 8) + '...' })
      },
      has: (keyId) => {
        const store = dbLoad(STORAGE_KEYS.KEYS, {})
        return Promise.resolve(!!store[keyId])
      },
      listSet: () => {
        const store = dbLoad(STORAGE_KEYS.KEYS, {})
        return Promise.resolve(Object.keys(store))
      },
      delete: (keyId) => {
        const store = dbLoad(STORAGE_KEYS.KEYS, {})
        delete store[keyId]
        dbSave(STORAGE_KEYS.KEYS, store)
        return Promise.resolve({ ok: true })
      },
      migrate: (legacyKeys) => Promise.resolve({ migrated: [], skipped: [] }),
    },

    // AI Complete & Streaming
    ai: {
      complete: (payload) => {
        const lastMsg = payload.messages[payload.messages.length - 1]?.content || ''
        const reply = generateMockResponse(lastMsg)
        return Promise.resolve({ ok: true, text: reply })
      },
      testProvider: (payload) => Promise.resolve({ ok: true, message: 'Connection verified (Web Mock).' }),
      startStream: (payload) => {
        const requestId = payload.requestId
        const lastMsg = payload.messages[payload.messages.length - 1]?.content || ''
        const fullReply = generateMockResponse(lastMsg)
        const channel = `ai:stream:${requestId}`

        const emit = (data) => {
          const cbs = streamListeners[channel] || []
          cbs.forEach(cb => { try { cb(data) } catch (_) {} })
        }

        // Stream reply in delta chunks, then fire done
        let chunkIndex = 0
        const chunkSize = 12
        const interval = setInterval(() => {
          if (chunkIndex < fullReply.length) {
            const delta = fullReply.slice(chunkIndex, chunkIndex + chunkSize)
            chunkIndex += chunkSize
            emit({ delta })
          } else {
            clearInterval(interval)
            emit({ done: true, fullText: fullReply })
            delete streamListeners[channel]
          }
        }, 25)

        return Promise.resolve({ ok: true })
      },
      abortStream: (requestId) => Promise.resolve({ ok: true }),
      onStream: (channel, cb) => {
        streamListeners[channel] = streamListeners[channel] || []
        streamListeners[channel].push(cb)
        return () => {
          streamListeners[channel] = streamListeners[channel].filter(x => x !== cb)
        }
      },
    },

    // Project Management
    project: {
      getAll: () => {
        const projects = dbLoad(STORAGE_KEYS.PROJECTS, [])
        const last = projects.find(p => p.lastActive)
        return Promise.resolve({ projects, lastProjectId: last?.id ?? null })
      },
      create: (data) => {
        const projects = dbLoad(STORAGE_KEYS.PROJECTS, [])
        const cleanPath = data.folderPath || `/vizio/projects/${data.name.toLowerCase().replace(/\s+/g, '-')}`
        const newProj = {
          id: 'proj-' + Date.now(),
          name: data.name,
          folderPath: cleanPath,
        }
        projects.push(newProj)
        dbSave(STORAGE_KEYS.PROJECTS, projects)
        return Promise.resolve(newProj)
      },
      setLast: (id) => {
        const projects = dbLoad(STORAGE_KEYS.PROJECTS, [])
        projects.forEach(p => { p.lastActive = p.id === id })
        dbSave(STORAGE_KEYS.PROJECTS, projects)
        return Promise.resolve({ ok: true })
      },
      delete: (id) => {
        let projects = dbLoad(STORAGE_KEYS.PROJECTS, [])
        projects = projects.filter(p => p.id !== id)
        dbSave(STORAGE_KEYS.PROJECTS, projects)
        return Promise.resolve({ ok: true })
      },
      getMedia: (projectDir) => {
        const projId = projectDir.split('/').pop() || 'demo-proj'
        const list = dbLoad(STORAGE_KEYS.MEDIA_PREFIX + projId, [])
        return Promise.resolve(list)
      },
      getOutputs: (projectDir) => {
        const projId = projectDir.split('/').pop() || 'demo-proj'
        const list = dbLoad(STORAGE_KEYS.OUTPUTS_PREFIX + projId, [])
        return Promise.resolve(list)
      },
      copyMedia: (sourcePath, projectDir) => {
        const fileName = sourcePath.split(/[\\/]/).pop() || 'imported_file.mp4'
        const projId = projectDir.split('/').pop() || 'demo-proj'
        const key = STORAGE_KEYS.MEDIA_PREFIX + projId
        const list = dbLoad(key, [])
        if (!list.some(m => m.name === fileName)) {
          list.push({
            name: fileName,
            path: sourcePath,
            sizeBytes: 8120400,
            ext: fileName.split('.').pop() || 'mp4',
          })
          dbSave(key, list)
          dispatch('mediaChanged', {})
        }
        return Promise.resolve({ ok: true })
      },
      deleteMedia: (filePath, projectDir) => {
        const projId = projectDir.split('/').pop() || 'demo-proj'
        const mKey = STORAGE_KEYS.MEDIA_PREFIX + projId
        const oKey = STORAGE_KEYS.OUTPUTS_PREFIX + projId
        
        let media = dbLoad(mKey, [])
        media = media.filter(m => m.path !== filePath)
        dbSave(mKey, media)

        let outputs = dbLoad(oKey, [])
        outputs = outputs.filter(o => o.path !== filePath)
        dbSave(oKey, outputs)

        dispatch('mediaChanged', {})
        return Promise.resolve({ ok: true })
      },
      choosePath: () => Promise.resolve(`/vizio/projects/project-${Date.now()}`),
      exportFile: (sourcePath, defaultName) => {
        alert(`[Vizio Web] File exported: ${defaultName || sourcePath}`)
        return Promise.resolve({ ok: true })
      },
    },

    // Chat Storage
    chat: {
      list: (projectDir) => {
        const projId = projectDir.split('/').pop() || 'demo-proj'
        const list = dbLoad(STORAGE_KEYS.CHAT_LIST_PREFIX + projId, [])
        return Promise.resolve(list)
      },
      load: (projectDir, chatId) => {
        const projId = projectDir.split('/').pop() || 'demo-proj'
        const list = dbLoad(STORAGE_KEYS.CHATS_PREFIX + projId + '-' + chatId, [])
        return Promise.resolve(list)
      },
      save: (projectDir, payload) => {
        const { id, title, messages } = payload
        const projId = projectDir.split('/').pop() || 'demo-proj'
        
        // Save messages
        dbSave(STORAGE_KEYS.CHATS_PREFIX + projId + '-' + id, messages)
        
        // Update title in chat list
        const listKey = STORAGE_KEYS.CHAT_LIST_PREFIX + projId
        const list = dbLoad(listKey, [])
        const index = list.findIndex(c => c.id === id)
        if (index >= 0) {
          list[index].title = title
          list[index].lastUpdated = Date.now()
        } else {
          list.push({ id, title, lastUpdated: Date.now() })
        }
        dbSave(listKey, list)
        return Promise.resolve({ ok: true })
      },
      create: (projectDir, title) => {
        const projId = projectDir.split('/').pop() || 'demo-proj'
        const chatId = 'chat-' + Date.now()
        
        // Add to list
        const listKey = STORAGE_KEYS.CHAT_LIST_PREFIX + projId
        const list = dbLoad(listKey, [])
        list.push({ id: chatId, title, lastUpdated: Date.now() })
        dbSave(listKey, list)
        
        // Initialize empty messages
        dbSave(STORAGE_KEYS.CHATS_PREFIX + projId + '-' + chatId, [])
        return Promise.resolve({ id: chatId, title, messages: [] })
      },
      delete: (projectDir, chatId) => {
        const projId = projectDir.split('/').pop() || 'demo-proj'
        
        // Delete list item
        const listKey = STORAGE_KEYS.CHAT_LIST_PREFIX + projId
        let list = dbLoad(listKey, [])
        list = list.filter(c => c.id !== chatId)
        dbSave(listKey, list)
        
        // Delete messages
        localStorage.removeItem(STORAGE_KEYS.CHATS_PREFIX + projId + '-' + chatId)
        return Promise.resolve({ ok: true })
      },
    },

    // Agent Filesystem
    agent: {
      listDir: (projectDir, subdir) => Promise.resolve([]),
      renameFile: (projectDir, oldPath, newPath) => Promise.resolve({ ok: true }),
      moveFile: (projectDir, srcPath, destPath) => Promise.resolve({ ok: true }),
      readText: (projectDir, filePath) => Promise.resolve(`[SYSTEM] Mock text preview for ${filePath}`),
      writeText: (projectDir, filePath, content) => Promise.resolve({ ok: true }),
    },

    // Event Registrations
    onStepUpdate: (cb) => {
      listeners.stepUpdate.push(cb)
      return () => { listeners.stepUpdate = listeners.stepUpdate.filter(x => x !== cb) }
    },
    onStepStart: (cb) => {
      listeners.stepStart.push(cb)
      return () => { listeners.stepStart = listeners.stepStart.filter(x => x !== cb) }
    },
    onStepOutput: (cb) => {
      listeners.stepOutput.push(cb)
      return () => { listeners.stepOutput = listeners.stepOutput.filter(x => x !== cb) }
    },
    onStepCmdUpdate: (cb) => {
      listeners.stepCmdUpdate.push(cb)
      return () => { listeners.stepCmdUpdate = listeners.stepCmdUpdate.filter(x => x !== cb) }
    },
    onStepDone: (cb) => {
      listeners.stepDone.push(cb)
      return () => { listeners.stepDone = listeners.stepDone.filter(x => x !== cb) }
    },
    onWorkflowDone: (cb) => {
      listeners.done.push(cb)
      return () => { listeners.done = listeners.done.filter(x => x !== cb) }
    },
    onMediaChanged: (cb) => {
      listeners.mediaChanged.push(cb)
      return () => { listeners.mediaChanged = listeners.mediaChanged.filter(x => x !== cb) }
    },

    removeAgentListeners: () => {
      listeners.stepUpdate = []
      listeners.stepStart = []
      listeners.stepOutput = []
      listeners.stepCmdUpdate = []
      listeners.stepDone = []
      listeners.done = []
      listeners.mediaChanged = []
    },
  }
}
