import { app, BrowserWindow, ipcMain, protocol, Menu, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'
import { BIN, runFfmpeg, probeFiles, scanTools, formatToolsBlock, createLogger } from './ffmpeg.js'
import {
  getAllProjects, createProject, setLastProject,
  getProjectMedia, getProjectOutputs, copyMediaToProject, deleteProjectMedia,
  listChats, loadChat, saveChat, createChat, deleteChat,
  listProjectDir, renameProjectFile, moveProjectFile, readProjectText, writeProjectText,
} from './projectStore.js'
import { dialog } from 'electron'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEV = process.env.NODE_ENV === 'development'
const execAsync = promisify(exec)

const MAX_RETRIES = 3
const workflowControllers = new Map()

const TOOL_INSTALLERS = {
  python: {
    command: 'winget install --id Python.Python.3.11 -e --accept-source-agreements --accept-package-agreements',
    note: 'Installs Python and pip.',
  },
  ffmpeg: {
    command: 'winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements',
    note: 'Installs ffmpeg and ffprobe.',
  },
  'yt-dlp': {
    command: 'python -m pip install -U yt-dlp',
    note: 'Requires Python and pip.',
  },
  whisper: {
    command: 'python -m pip install -U openai-whisper',
    note: 'Requires Python, pip, and ffmpeg.',
  },
  imagemagick: {
    command: 'winget install --id ImageMagick.ImageMagick -e --accept-source-agreements --accept-package-agreements',
    note: 'Installs ImageMagick magick.exe.',
  },
  pyannote: {
    command: 'python -m pip install -U pyannote.audio',
    note: 'Requires Python, pip, and a Hugging Face token for some models.',
  },
}

// ── helpers ────────────────────────────────────────────────────────────────────

function getSessionDir(sessionId) {
  return path.join(app.getPath('userData'), 'sessions', sessionId)
}

function getLogDir() {
  return path.join(app.getPath('userData'), 'logs')
}

function parseJson(raw) {
  if (!raw) return null
  let s = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  try { return JSON.parse(s) } catch (_) {}
  const start = s.indexOf('{'); const end = s.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)) } catch (_) {}
  }
  return null
}

function buildVerifyPrompt(step, result) {
  return `Step ${step.id} "${step.title}" just ran.

Command: ${result.command}
Exit: FAILED (non-zero exit)
stdout: ${result.stdout?.slice(0, 300) || '(empty)'}
stderr: ${result.stderr?.slice(0, 800) || '(empty)'}

Respond ONLY with JSON:
Success → {"mode":"verify","success":true,"message":"brief confirmation","fixed_command":null}
Fixable → {"mode":"verify","success":false,"message":"what went wrong","fixed_command":"corrected command"}
Unfixable → {"mode":"verify","success":false,"message":"explain what is missing and how to install it","fixed_command":null}

RULES:
- reverb filter does not exist — use aecho=0.8:0.88:60:0.4
- Only standard ffmpeg filters and codecs
- Always use -y flag
- Use full absolute paths`
}

function tokenizeCommand(command) {
  return command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []
}

function stripQuotes(token = '') {
  return token.replace(/^["']|["']$/g, '')
}

function isAbsoluteMediaPath(token) {
  const cleaned = stripQuotes(token)
  return /^[A-Za-z]:\\/.test(cleaned) && /\.[a-z0-9]{2,5}$/i.test(cleaned)
}

function extractCommandPaths(command) {
  const tokens = tokenizeCommand(command)
  const inputPaths = []
  const outputPaths = []

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token === '-i' && tokens[i + 1]) {
      inputPaths.push(stripQuotes(tokens[i + 1]))
      i += 1
      continue
    }

    if (!token.startsWith('-') && isAbsoluteMediaPath(token)) {
      outputPaths.push(stripQuotes(token))
    }
  }

  const inputSet = new Set(inputPaths.map(filePath => filePath.toLowerCase()))
  return {
    inputPaths,
    outputPaths: outputPaths.filter(filePath => !inputSet.has(filePath.toLowerCase())),
  }
}

function validateCommandPaths(command) {
  const { inputPaths, outputPaths } = extractCommandPaths(command)
  const missingInput = inputPaths.find(filePath => !fs.existsSync(filePath))
  if (missingInput) {
    return {
      ok: false,
      message: `Input file not found: ${path.basename(missingInput)}. The workflow used the wrong path.`,
    }
  }

  outputPaths.forEach(filePath => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
  })

  return { ok: true }
}

function diagnoseStepFailure(step, command, result) {
  const lowerError = `${result.error || ''}\n${result.stderr || ''}`.toLowerCase()

  if (lowerError.includes('enoent') || lowerError.includes('not recognized as an internal or external command')) {
    const tool = tokenizeCommand(command)[0] || 'tool'
    return { message: `The step failed because ${tool} is not available on this system.` }
  }
  if (lowerError.includes('no such file or directory')) {
    return { message: `Step "${step.title}" failed because one of the file paths does not exist.` }
  }
  if (lowerError.includes('permission denied') || lowerError.includes('access is denied')) {
    return { message: `Step "${step.title}" failed because the app could not read or write one of the files.` }
  }
  if (lowerError.includes('moov atom not found')) {
    return { message: `Step "${step.title}" failed because the video file looks damaged or incomplete.` }
  }
  if (lowerError.includes('invalid data found')) {
    return { message: `Step "${step.title}" failed because the source file could not be parsed as valid media.` }
  }

  return null
}

// ── Agent step executor (non-shell steps) ─────────────────────────────────────

function fillBatchTemplate(template = '', inputPath = '', outputPath = '') {
  const parsed = path.parse(inputPath)
  const values = {
    input: inputPath,
    output: outputPath,
    name: parsed.base,
    base: parsed.name,
    ext: parsed.ext.replace(/^\./, ''),
  }

  return Object.entries(values).reduce((result, [key, value]) => (
    result.split(`{${key}}`).join(String(value))
  ), template)
}

function expandWorkflowSteps(workflow) {
  const expanded = []
  let nextId = 1

  for (const step of workflow.steps ?? []) {
    if (step.type !== 'batch_shell') {
      expanded.push({ ...step, id: nextId++ })
      continue
    }

    const inputPaths = Array.isArray(step.input_paths) ? step.input_paths : []
    inputPaths.forEach((inputPath) => {
      const parsed = path.parse(inputPath)
      const outputPath = fillBatchTemplate(
        step.output_template || path.join(path.dirname(inputPath), `${parsed.name}_output${parsed.ext}`),
        inputPath,
        ''
      )

      expanded.push({
        id: nextId++,
        type: 'shell',
        title: `${step.title || 'Process file'}: ${parsed.base}`,
        description: step.description || `Process ${parsed.base}`,
        command: fillBatchTemplate(step.command_template, inputPath, outputPath),
        durationSec: step.durationSec ?? null,
      })
    })
  }

  return { ...workflow, steps: expanded }
}

function executeAgentStep(step, projectDir) {
  switch (step.type) {
    case 'rename':
    case 'move': {
      const result = renameProjectFile(projectDir, step.from, step.to)
      if (!result.ok) throw new Error(result.message)
      break
    }
    case 'delete': {
      const result = deleteProjectMedia(projectDir, step.path)
      if (!result.ok) throw new Error(result.message)
      break
    }
    case 'write': {
      const result = writeProjectText(projectDir, step.path, step.content ?? '')
      if (!result.ok) throw new Error(result.message)
      break
    }
    default:
      throw new Error(`Unknown step type: "${step.type}"`)
  }
}

function runInstallerCommand(command) {
  return new Promise((resolve) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''

    child.stdout.on('data', chunk => { stdout += chunk.toString() })
    child.stderr.on('data', chunk => { stderr += chunk.toString() })
    child.on('error', err => resolve({ ok: false, stdout, stderr, message: err.message }))
    child.on('close', code => resolve({
      ok: code === 0,
      stdout,
      stderr,
      message: code === 0 ? 'Install completed.' : `Installer exited with code ${code}.`,
    }))
  })
}

// ── protocol & window ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
  protocol.registerFileProtocol('atom', (request, callback) => {
    const url = request.url.replace(/^atom:\/\//, '')
    try { return callback(decodeURIComponent(url)) } catch (e) {
      console.error('Failed to register protocol', e)
    }
  })
})

Menu.setApplicationMenu(null)

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, autoHideMenuBar: true,
    title: 'Vizio',
    icon: path.join(__dirname, '../icon.png'),
    backgroundColor: '#05070d',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#05070d',
      symbolColor: '#e8f6ff',
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  })
  if (DEV) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// ── AI call with retry + exponential backoff on 429 ───────────────────────────

async function callAI(messages, config, retries = 3) {
  const { baseUrl, apiKey, model, providerId } = config
  const maxTokens = Number(config.maxTokens) > 0 ? Number(config.maxTokens) : 2048
  const temperature = Number.isFinite(Number(config.temperature)) ? Number(config.temperature) : 0.2

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      let res
      if (providerId === 'anthropic') {
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model, max_tokens: maxTokens,
            system: messages.find(m => m.role === 'system')?.content ?? '',
            messages: messages.filter(m => m.role !== 'system'),
          }),
        })
      } else {
        res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model, max_tokens: maxTokens, temperature,
            messages,
          }),
        })
      }

      // 429 — wait and retry with backoff
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') ?? '0', 10)
        const wait = retryAfter > 0 ? retryAfter * 1000 : Math.min(2000 * attempt, 10000)
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, wait))
          continue
        }
        throw new Error('Rate limit — too many requests. Try again shortly.')
      }

      if (!res.ok) {
        let body = {}
        try { body = await res.json() } catch (_) {}
        throw new Error(body?.error?.message || `HTTP ${res.status}`)
      }

      if (providerId === 'anthropic') {
        const data = await res.json()
        return data.content?.[0]?.text?.trim() ?? ''
      }
      const data = await res.json()
      return data.choices?.[0]?.message?.content?.trim() ?? ''

    } catch (err) {
      if (attempt === retries) throw err
      if (err.message?.includes('Rate limit')) throw err // don't retry our own throw
      await new Promise(r => setTimeout(r, 1000 * attempt))
    }
  }
}

// ── IPC: run workflow ──────────────────────────────────────────────────────────

ipcMain.handle('agent:runWorkflow', async (event, { workflow, sessionId, projectDir, apiKey, model, providerId, baseUrl }) => {
  const config = { apiKey, model, providerId, baseUrl }
  workflow = expandWorkflowSteps(workflow)
  const controller = new AbortController()
  workflowControllers.set(sessionId, controller)

  // ── Create session output directory ─────────────────────────────────────────
  const sessionDir = getSessionDir(sessionId)
  fs.mkdirSync(sessionDir, { recursive: true })
  fs.mkdirSync(getLogDir(), { recursive: true })

  const log = createLogger(sessionId)
  log.setStatus('in_progress')
  log.setWorkflow(workflow)

  const verifyHistory = [] // separate history just for verify calls

  for (const step of workflow.steps) {
    if (controller.signal.aborted) {
      log.finish('cancelled')
      event.sender.send('agent:done', {
        success: false,
        cancelled: true,
        sessionDir,
        logFile: log.logFile,
        message: 'Workflow cancelled.',
      })
      workflowControllers.delete(sessionId)
      return
    }

    log.updateStepStatus(step.id, 'running')
    event.sender.send('agent:stepUpdate', { stepId: step.id, status: 'running', pct: 0 })

    // ── Non-shell step dispatch (rename / delete / move / write) ────────────────
    if (step.type && step.type !== 'shell') {
      try {
        executeAgentStep(step, projectDir)
        log.updateStepStatus(step.id, 'completed')
        event.sender.send('agent:stepDone', { stepId: step.id, success: true })
      } catch (err) {
        const msg = err.message || `Step "${step.title}" failed.`
        log.updateStepStatus(step.id, 'failed')
        event.sender.send('agent:stepDone', { stepId: step.id, success: false, message: msg })
        event.sender.send('agent:done', { success: false, sessionDir, logFile: log.logFile, message: msg })
        log.finish('completed_with_errors')
        workflowControllers.delete(sessionId)
        return
      }
      continue // skip the ffmpeg retry loop
    }

    let currentCommand = step.command
    let stepPassed = false

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 1) {
        event.sender.send('agent:stepUpdate', {
          stepId: step.id, status: 'running', pct: 0,
          message: `Retrying (attempt ${attempt}/${MAX_RETRIES})…`,
        })
      }

      const pathCheck = validateCommandPaths(currentCommand)
      if (!pathCheck.ok) {
        log.recordAttempt(step.id, {
          command: currentCommand,
          stdout: '',
          stderr: '',
          exitSuccess: false,
          aiSuccess: false,
          aiMessage: pathCheck.message,
          fixedCommand: null,
        })
        log.updateStepStatus(step.id, 'failed')
        event.sender.send('agent:stepDone', {
          stepId: step.id,
          success: false,
          message: pathCheck.message,
        })
        event.sender.send('agent:done', {
          success: false,
          sessionDir,
          logFile: log.logFile,
          message: pathCheck.message,
        })
        log.finish('completed_with_errors')
        workflowControllers.delete(sessionId)
        return
      }

      const result = await runFfmpeg(currentCommand, {
        signal: controller.signal,
        onProgress: (pct) => {
          event.sender.send('agent:stepUpdate', { stepId: step.id, status: 'running', pct })
        },
      })

      if (controller.signal.aborted || result.error === 'Cancelled') {
        log.recordAttempt(step.id, {
          command: currentCommand,
          stdout: result.stdout,
          stderr: result.stderr,
          exitSuccess: false,
          aiSuccess: false,
          aiMessage: 'Cancelled by user',
          fixedCommand: null,
        })
        log.updateStepStatus(step.id, 'cancelled')
        log.finish('cancelled')
        event.sender.send('agent:stepDone', { stepId: step.id, success: false, message: 'Cancelled by user' })
        event.sender.send('agent:done', {
          success: false,
          cancelled: true,
          sessionDir,
          logFile: log.logFile,
          message: 'Workflow cancelled.',
        })
        workflowControllers.delete(sessionId)
        return
      }

      // ── EXIT 0 = DONE. No AI call needed. ───────────────────────────────────
      if (result.success) {
        log.recordAttempt(step.id, {
          command:      currentCommand,
          stdout:       result.stdout,
          stderr:       result.stderr,
          exitSuccess:  true,
          aiSuccess:    true,
          aiMessage:    'Completed successfully (exit 0)',
          fixedCommand: null,
        })
        log.updateStepStatus(step.id, 'completed')
        event.sender.send('agent:stepDone', { stepId: step.id, success: true })
        stepPassed = true
        break
      }

      // ── FAILED — ask AI to diagnose and fix ─────────────────────────────────
      const localDiagnosis = diagnoseStepFailure(step, currentCommand, result)
      if (localDiagnosis) {
        log.recordAttempt(step.id, {
          command: currentCommand,
          stdout: result.stdout,
          stderr: result.stderr,
          exitSuccess: false,
          aiSuccess: false,
          aiMessage: localDiagnosis.message,
          fixedCommand: null,
        })
        log.updateStepStatus(step.id, 'failed')
        event.sender.send('agent:stepDone', {
          stepId: step.id,
          success: false,
          message: localDiagnosis.message,
        })
        event.sender.send('agent:done', {
          success: false,
          sessionDir,
          logFile: log.logFile,
          message: localDiagnosis.message,
        })
        log.finish('completed_with_errors')
        workflowControllers.delete(sessionId)
        return
      }

      const verifyPrompt = buildVerifyPrompt(step, { ...result, command: currentCommand })
      verifyHistory.push({ role: 'user', content: verifyPrompt })

      let verification = null
      try {
        const raw = await callAI(verifyHistory, config)
        verifyHistory.push({ role: 'assistant', content: raw })
        verification = parseJson(raw)
      } catch (aiErr) {
        log.recordAttempt(step.id, {
          command: currentCommand, stdout: result.stdout, stderr: result.stderr,
          exitSuccess: false, aiSuccess: false,
          aiMessage: `AI verify failed: ${aiErr.message}`, fixedCommand: null,
        })
        // Don't break — let the retry loop continue if attempts remain
        if (attempt === MAX_RETRIES) {
          log.updateStepStatus(step.id, 'failed')
          event.sender.send('agent:stepDone', {
            stepId: step.id, success: false,
            message: `AI could not verify step after ${MAX_RETRIES} attempts: ${aiErr.message}`,
          })
          event.sender.send('agent:done', {
            success: false,
            sessionDir,
            logFile: log.logFile,
            message: `Step "${step.title}" failed: ${aiErr.message}`,
          })
          log.finish('completed_with_errors')
          workflowControllers.delete(sessionId)
          return
        }
        continue
      }

      log.recordAttempt(step.id, {
        command:      currentCommand,
        stdout:       result.stdout,
        stderr:       result.stderr,
        exitSuccess:  false,
        aiSuccess:    verification?.success ?? false,
        aiMessage:    verification?.message ?? '',
        fixedCommand: verification?.fixed_command ?? null,
      })

      if (verification?.fixed_command) {
        currentCommand = verification.fixed_command
        event.sender.send('agent:stepCmdUpdate', {
          stepId: step.id, cmd: currentCommand, message: verification.message,
        })
        continue // retry with fixed command
      }

      // Unfixable — AI said no fixed_command
      log.updateStepStatus(step.id, 'failed')
      event.sender.send('agent:stepDone', {
        stepId: step.id, success: false, message: verification?.message,
      })
      event.sender.send('agent:done', {
        success: false, sessionDir, logFile: log.logFile,
        message: verification?.message ?? `Step "${step.title}" could not be completed.`,
      })
      log.finish('completed_with_errors')
      workflowControllers.delete(sessionId)
      return
    }

    if (!stepPassed) {
      log.updateStepStatus(step.id, 'failed')
      log.finish('completed_with_errors')
      workflowControllers.delete(sessionId)
      event.sender.send('agent:done', {
        success: false, sessionDir, logFile: log.logFile,
        message: `"${step.title}" failed after ${MAX_RETRIES} attempts.`,
      })
      return
    }
  }

  log.finish('completed')
  event.sender.send('agent:done', {
    success: true, sessionDir, logFile: log.logFile,
  })
  workflowControllers.delete(sessionId)
})

// ── IPC: file ops ──────────────────────────────────────────────────────────────

ipcMain.handle('agent:scanTools',   () => scanTools().then(formatToolsBlock))
ipcMain.handle('agent:probeFiles',  (_, paths) => probeFiles(paths))
ipcMain.handle('tools:scan',        () => scanTools()) // For MainPage UI status
ipcMain.handle('bins:status', async () => {
  const results = {}

  for (const [name, binPath] of Object.entries(BIN)) {
    const systemCommand = name === 'ytdlp' ? 'yt-dlp' : name
    const bundled = binPath !== systemCommand
    const flag = name === 'ytdlp' ? '--version' : '-version'
    let version = null
    let available = false

    try {
      const { stdout, stderr } = await execAsync(`"${binPath}" ${flag}`, { timeout: 5000 })
      version = (stdout || stderr || '').split('\n')[0].trim().slice(0, 80)
      available = true
    } catch (_) {}

    results[name] = { path: binPath, available, version, bundled }
  }

  return results
})
ipcMain.handle('tools:install', async (_, toolId) => {
  const installer = TOOL_INSTALLERS[toolId]
  if (!installer) return { ok: false, message: 'No installer is configured for this tool.' }
  const result = await runInstallerCommand(installer.command)
  return { ...result, command: installer.command, note: installer.note }
})
ipcMain.handle('files:probe',       (_, paths) => probeFiles(paths))

// Project handlers
ipcMain.handle('project:getAll',    () => getAllProjects())
ipcMain.handle('project:create',    (_, { name, folderPath }) => createProject({ name, folderPath }))
ipcMain.handle('project:setLast',   (_, id) => setLastProject(id))
ipcMain.handle('project:getMedia',  (_, projectDir) => getProjectMedia(projectDir))
ipcMain.handle('project:getOutputs', (_, projectDir) => getProjectOutputs(projectDir))
ipcMain.handle('project:copyMedia', (_, { sourcePath, projectDir }) => copyMediaToProject(sourcePath, projectDir))
ipcMain.handle('project:deleteMedia', (_, { filePath, projectDir }) => deleteProjectMedia(projectDir, filePath))

ipcMain.handle('project:choosePath', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

// Chat handlers
ipcMain.handle('chat:list',   (_, projectDir) => listChats(projectDir))
ipcMain.handle('chat:load',   (_, { projectDir, chatId }) => loadChat(projectDir, chatId))
ipcMain.handle('chat:save',   (_, { projectDir, chat }) => saveChat(projectDir, chat))
ipcMain.handle('chat:create', (_, { projectDir, title }) => createChat(projectDir, title))
ipcMain.handle('chat:delete', (_, { projectDir, chatId }) => deleteChat(projectDir, chatId))

// Session dir now uses project folder
ipcMain.handle('agent:getSessionPath', (_, { sessionId, projectDir }) => {
  const sessionDir = path.join(projectDir, 'sessions', sessionId)
  const outputDir = path.join(projectDir, 'output')
  fs.mkdirSync(sessionDir, { recursive: true })
  fs.mkdirSync(outputDir, { recursive: true })
  return { sessionDir, outputDir }
})

ipcMain.handle('agent:prepareWorkflow', (_, { workflow, sessionId, projectDir, userGoal, mediaFiles = [] }) => {
  try {
    const sessionDir = path.join(projectDir, 'sessions', sessionId)
    const outputDir = path.join(projectDir, 'output')
    fs.mkdirSync(sessionDir, { recursive: true })
    fs.mkdirSync(outputDir, { recursive: true })
    fs.mkdirSync(getLogDir(), { recursive: true })

    const log = createLogger(sessionId)
    log.setMeta({ userGoal, mediaFiles })
    log.setWorkflow(expandWorkflowSteps(workflow))
    log.setStatus('proposed')
    return { ok: true, sessionDir, outputDir, logFile: log.logFile }
  } catch (err) {
    return { ok: false, message: err.message || 'Could not prepare workflow log.' }
  }
})

ipcMain.handle('agent:cancelWorkflow', (_, sessionId) => {
  const controller = workflowControllers.get(sessionId)
  if (!controller) return { ok: false, message: 'No running workflow found.' }
  controller.abort()
  workflowControllers.delete(sessionId)
  return { ok: true }
})

ipcMain.handle('session:readLog', (_, sessionId) => {
  try {
    const f = path.join(getLogDir(), `session-${sessionId}.json`)
    if (!fs.existsSync(f)) return null
    return JSON.parse(fs.readFileSync(f, 'utf-8'))
  } catch { return null }
})

ipcMain.handle('session:listFiles', (_, sessionId) => {
  try {
    const dir = getSessionDir(sessionId)
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
      .filter(f => !f.startsWith('.'))
      .map(f => {
        const full = path.join(dir, f)
        const stat = fs.statSync(full)
        const bytes = stat.size
        const size = bytes < 1024 * 1024
          ? `${(bytes / 1024).toFixed(0)} KB`
          : `${(bytes / 1024 / 1024).toFixed(1)} MB`
        return { name: f, path: full, size }
      })
  } catch { return [] }
})

ipcMain.on('shell:openFile', (_, filePath) => shell.openPath(filePath))

ipcMain.handle('session:init', async (_, { sessionId, userGoal, mediaFiles }) => {
  try {
    const log = createLogger(sessionId)
    log.setMeta({ userGoal, mediaFiles })
    return true
  } catch (err) {
    console.error('Failed to init session:', err)
    return false
  }
})

// ── IPC: agent file operations ────────────────────────────────────────────────────

ipcMain.handle('agent:listDir',     (_, { projectDir, subdir })         => listProjectDir(projectDir, subdir))
ipcMain.handle('agent:renameFile',  (_, { projectDir, oldPath, newPath }) => renameProjectFile(projectDir, oldPath, newPath))
ipcMain.handle('agent:moveFile',    (_, { projectDir, srcPath, destPath }) => moveProjectFile(projectDir, srcPath, destPath))
ipcMain.handle('agent:readText',    (_, { projectDir, filePath })        => readProjectText(projectDir, filePath))
ipcMain.handle('agent:writeText',   (_, { projectDir, filePath, content }) => writeProjectText(projectDir, filePath, content))

