import { app, BrowserWindow, ipcMain, protocol, Menu, shell, net } from 'electron'
import path from 'path'
import fs from 'fs'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath, pathToFileURL } from 'url'
import { BIN, runFfmpeg, probeFiles, scanTools, scanToolsWithBlock, formatToolsBlock, createLogger } from './ffmpeg.js'
import {
  getAllProjects, createProject, setLastProject, deleteProject,
  getProjectMedia, getProjectOutputs, copyMediaToProject, deleteProjectMedia,
  listChats, loadChat, saveChat, createChat, deleteChat,
  listProjectDir, renameProjectFile, moveProjectFile, readProjectText, writeProjectText,
} from './projectStore.js'
import { dialog } from 'electron'
import {
  setEncryptedKey, deleteEncryptedKey, listEncryptedKeyIds,
  getKeyHint, getDecryptedKey, migrateLegacyKeys, hasEncryptedKey, isEncryptionAvailable,
} from './keyStore.js'
import { callAI, streamAI, buildAIConfig, testAIConnection } from './aiClient.js'

// ── Secure key store (OS credential manager via safeStorage) ──────────────────
ipcMain.handle('keys:set', (_, { keyId, value }) => {
  try {
    if (!isEncryptionAvailable()) {
      return { ok: false, message: 'OS encryption is not available on this machine.' }
    }
    return setEncryptedKey(keyId, value)
  } catch (err) {
    return { ok: false, message: err.message }
  }
})

ipcMain.handle('keys:getHint', (_, keyId) => getKeyHint(keyId))
ipcMain.handle('keys:has', (_, keyId) => hasEncryptedKey(keyId))
ipcMain.handle('keys:listSet', () => listEncryptedKeyIds())
ipcMain.handle('keys:delete', (_, keyId) => {
  try {
    return deleteEncryptedKey(keyId)
  } catch (err) {
    return { ok: false, message: err.message }
  }
})

ipcMain.handle('keys:migrate', (_, legacyKeys) => {
  try {
    return migrateLegacyKeys(legacyKeys ?? {})
  } catch (err) {
    return { ok: false, message: err.message, migrated: [], skipped: [] }
  }
})

const aiStreamControllers = new Map()

function resolveAIConfig({ providerId, baseUrl, model, maxTokens, temperature }) {
  const apiKey = getDecryptedKey(`${providerId}ApiKey`)
  return buildAIConfig({ providerId, baseUrl, model, maxTokens, temperature, apiKey })
}

ipcMain.handle('ai:complete', async (_, payload) => {
  try {
    const config = resolveAIConfig(payload)
    const text = await callAI(payload.messages, config, { retries: payload.retries ?? 2, signal: null })
    return { ok: true, text }
  } catch (err) {
    return { ok: false, message: err.message, status: err.status ?? 0, cancelled: !!err.cancelled }
  }
})

ipcMain.handle('ai:testProvider', async (_, payload) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    const config = resolveAIConfig(payload)
    const res = await testAIConnection(config, { signal: controller.signal })
    return res
  } catch (err) {
    return {
      ok: false,
      message: err.cancelled ? 'Connection test timed out.' : (err.message || 'Connection test failed.'),
      status: err.status ?? 0,
    }
  } finally {
    clearTimeout(timeout)
  }
})

ipcMain.handle('ai:streamStart', async (event, payload) => {
  const { requestId, messages } = payload
  const channel = `ai:stream:${requestId}`
  const controller = new AbortController()
  aiStreamControllers.set(requestId, controller)

  const config = resolveAIConfig(payload)

  let throttleTimer = null
  let buffer = ''
  
  const flush = () => {
    if (buffer.length > 0 && !event.sender.isDestroyed()) {
      event.sender.send(channel, { delta: buffer })
      buffer = ''
    }
    throttleTimer = null
  }

  streamAI(messages, config, {
    signal: controller.signal,
    onStatus: (status) => {
      if (!event.sender.isDestroyed()) event.sender.send(channel, { status })
    },
    onDelta: (delta) => {
      buffer += delta
      if (!throttleTimer) {
        throttleTimer = setTimeout(flush, 50)
      }
    },
  })
    .then((fullText) => {
      if (throttleTimer) { clearTimeout(throttleTimer); flush() }
      if (!event.sender.isDestroyed()) event.sender.send(channel, { done: true, fullText })
    })
    .catch((err) => {
      if (throttleTimer) { clearTimeout(throttleTimer); flush() }
      if (!event.sender.isDestroyed()) {
        event.sender.send(channel, {
          error: err.message || 'Stream failed',
          status: err.status ?? 0,
          cancelled: !!err.cancelled,
        })
      }
    })
    .finally(() => aiStreamControllers.delete(requestId))

  return { ok: true }
})

ipcMain.handle('ai:streamAbort', (_, requestId) => {
  aiStreamControllers.get(requestId)?.abort()
  aiStreamControllers.delete(requestId)
  return { ok: true }
})

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
}

// ── helpers ────────────────────────────────────────────────────────────────────

let projectWatcher = null
let currentWatchedDir = null

function watchProjectDir(projectDir, webContents) {
  if (currentWatchedDir === projectDir) return
  if (projectWatcher) {
    try {
      projectWatcher.close()
    } catch (_) {}
    projectWatcher = null
  }
  currentWatchedDir = projectDir
  if (!projectDir || !fs.existsSync(projectDir)) return

  try {
    projectWatcher = fs.watch(projectDir, { recursive: true }, (eventType, filename) => {
      if (filename) {
        const normalized = filename.replace(/\\/g, '/')
        if (normalized.startsWith('sessions/') || normalized.startsWith('chats/') || normalized.startsWith('.')) {
          return
        }
      }
      if (!webContents.isDestroyed()) {
        webContents.send('project:mediaChanged', { eventType, filename })
      }
    })
  } catch (err) {
    console.error('Failed to start project watcher:', err)
  }
}

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

/** After ffmpeg exit 0, verify outputs exist and are non-empty. */
function validateStepOutputs(command) {
  const { outputPaths } = extractCommandPaths(command)
  if (outputPaths.length === 0) return { ok: true }

  for (const filePath of outputPaths) {
    if (!fs.existsSync(filePath)) {
      return {
        ok: false,
        message: `ffmpeg exited successfully but no output was created: ${path.basename(filePath)}`,
      }
    }
    try {
      const stat = fs.statSync(filePath)
      if (stat.size === 0) {
        return {
          ok: false,
          message: `Output file is empty (0 bytes): ${path.basename(filePath)}. The command may have failed silently.`,
        }
      }
    } catch (err) {
      return { ok: false, message: `Could not read output file: ${path.basename(filePath)}` }
    }
  }

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

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const mimes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  }
  return mimes[ext] || 'application/octet-stream'
}

// ── protocol & window ─────────────────────────────────────────────────────────

protocol.registerSchemesAsPrivileged([
  { scheme: 'atom', privileges: { secure: true, standard: true, supportFetchAPI: true, stream: true, bypassCSP: true } },
])

app.whenReady().then(() => {
  protocol.handle('atom', (request) => {
    try {
      let rawUrl = request.url
      let urlPath = rawUrl.replace(/^atom:\/\/?\/?/, '')
      let decoded = decodeURIComponent(urlPath)

      if (process.platform === 'win32') {
        if (/^\/[a-zA-Z]:/.test(decoded)) {
          decoded = decoded.slice(1)
        } else if (/^[a-zA-Z]\//.test(decoded)) {
          decoded = decoded[0] + ':/' + decoded.slice(2)
        }
      }

      const normalizedPath = path.normalize(decoded)
      if (!fs.existsSync(normalizedPath)) {
        return new Response('File not found', { status: 404 })
      }

      const rangeHeader = request.headers.get('range')
      const stat = fs.statSync(normalizedPath)
      const fileSize = stat.size

      if (rangeHeader && fileSize > 0) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1

        if (!isNaN(start) && start < fileSize) {
          const actualEnd = Math.min(end, fileSize - 1)
          const chunkSize = (actualEnd - start) + 1
          const nodeStream = fs.createReadStream(normalizedPath, { start, end: actualEnd })
          const webStream = new ReadableStream({
            start(controller) {
              nodeStream.on('data', chunk => controller.enqueue(chunk))
              nodeStream.on('end', () => controller.close())
              nodeStream.on('error', err => controller.error(err))
            },
            cancel() {
              nodeStream.destroy()
            }
          })

          return new Response(webStream, {
            status: 206,
            statusText: 'Partial Content',
            headers: {
              'Content-Range': `bytes ${start}-${actualEnd}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunkSize.toString(),
              'Content-Type': getMimeType(normalizedPath),
            },
          })
        }
      }

      const fileUrl = pathToFileURL(normalizedPath).toString()

      return net.fetch(fileUrl, {
        bypassCustomProtocolHandlers: true,
        headers: request.headers,
        method: request.method,
      })
    } catch (e) {
      console.error('Failed to handle atom protocol request:', e)
      return new Response('File not found', { status: 404 })
    }
  })
})

Menu.setApplicationMenu(null)

function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(app.getAppPath(), 'build', 'icon.ico')
    : path.join(__dirname, '../build/icon.ico')

  const win = new BrowserWindow({
    width: 1280, height: 800, autoHideMenuBar: true,
    title: 'Vizio',
    icon: iconPath,
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
    win.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// ── IPC: run workflow ──────────────────────────────────────────────────────────

ipcMain.handle('agent:runWorkflow', async (event, { workflow, sessionId, projectDir, model, providerId, baseUrl, maxTokens, temperature, maxHealingRetries }) => {
  const config = resolveAIConfig({ providerId, baseUrl, model, maxTokens, temperature })
  const MAX_HEAL = (typeof maxHealingRetries === 'number' && maxHealingRetries >= 1) ? maxHealingRetries : MAX_RETRIES

  workflow = expandWorkflowSteps(workflow)
  const controller = new AbortController()
  workflowControllers.set(sessionId, controller)

  const sessionDir = path.join(projectDir, 'sessions', sessionId)
  const outputDir  = path.join(projectDir, 'output')
  fs.mkdirSync(sessionDir, { recursive: true })
  fs.mkdirSync(outputDir,  { recursive: true })
  fs.mkdirSync(getLogDir(), { recursive: true })

  const log = createLogger(sessionId, projectDir)
  log.setStatus('in_progress')
  log.setWorkflow(workflow)

  // ── Verify history — only used on failures ─────────────────────────────────────────────
  const verifyHistory = [{
    role: 'system',
    content: 'You are a command verification assistant for a media processing agent on Windows.\n' +
      'Available tools: ffmpeg, ffprobe, yt-dlp.\n' +
      'RULES:\n' +
      '- reverb does not exist as an ffmpeg filter — use aecho=0.8:0.88:60:0.4\n' +
      '- Only use standard ffmpeg filters available in gyan.dev builds\n' +
      '- Always include -y flag\n' +
      '- Use full absolute Windows paths\n' +
      '- Return ONLY valid JSON, no markdown, no explanation outside JSON',
  }]

  // ── Step execution result accumulator ──────────────────────────────────────
  // This is what gets sent to AI at the end for the organic reply
  const stepResults = []

  for (const step of workflow.steps) {
    if (controller.signal.aborted) {
      log.finish('cancelled')
      event.sender.send('agent:done', {
        success: false, cancelled: true,
        sessionDir, logFile: log.logFile,
        message: 'Workflow cancelled.',
      })
      workflowControllers.delete(sessionId)
      return
    }

    log.updateStepStatus(step.id, 'running')
    event.sender.send('agent:stepUpdate', { stepId: step.id, status: 'running', pct: 0 })

    // ── Non-shell steps ──────────────────────────────────────────────────────
    if (step.type && step.type !== 'shell') {
      try {
        executeAgentStep(step, projectDir)
        log.updateStepStatus(step.id, 'completed')
        event.sender.send('agent:stepDone', { stepId: step.id, success: true })
        stepResults.push({
          stepId:  step.id,
          title:   step.title,
          type:    step.type,
          success: true,
          note:    step.type + ' operation completed',
        })
      } catch (err) {
        const msg = err.message || ('Step "' + step.title + '" failed.')
        log.updateStepStatus(step.id, 'failed')
        event.sender.send('agent:stepDone', { stepId: step.id, success: false, message: msg })
        event.sender.send('agent:done', { success: false, sessionDir, logFile: log.logFile, message: msg })
        log.finish('completed_with_errors')
        workflowControllers.delete(sessionId)
        return
      }
      continue
    }

    // ── Shell steps ──────────────────────────────────────────────────────────
    let currentCommand = step.command
    let stepPassed     = false
    let finalResult    = null

    for (let attempt = 1; attempt <= MAX_HEAL; attempt++) {
      if (attempt > 1) {
        event.sender.send('agent:stepUpdate', {
          stepId: step.id, status: 'running', pct: 0,
          message: 'Retrying (attempt ' + attempt + '/' + MAX_HEAL + ')…',
        })
      }

      const pathCheck = validateCommandPaths(currentCommand)
      if (!pathCheck.ok) {
        log.recordAttempt(step.id, {
          command: currentCommand, stdout: '', stderr: '',
          exitSuccess: false, aiSuccess: false,
          aiMessage: pathCheck.message, fixedCommand: null,
        })
        log.updateStepStatus(step.id, 'failed')
        event.sender.send('agent:stepDone', { stepId: step.id, success: false, message: pathCheck.message })
        event.sender.send('agent:done', { success: false, sessionDir, logFile: log.logFile, message: pathCheck.message })
        log.finish('completed_with_errors')
        workflowControllers.delete(sessionId)
        return
      }

      // Notify renderer which command is about to run
      event.sender.send('agent:stepStart', { stepId: step.id, cmd: currentCommand })

      // Start attempt in session log file
      log.startAttempt?.(step.id, currentCommand)

      const result = await runFfmpeg(currentCommand, {
        signal: controller.signal,
        onProgress: (pct) => {
          event.sender.send('agent:stepUpdate', { stepId: step.id, status: 'running', pct })
        },
        onStderr: (text) => {
          event.sender.send('agent:stepUpdate', { stepId: step.id, status: 'running', pct: null, stderr: text })
        },
        onOutput: ({ stream, text }) => {
          event.sender.send('agent:stepOutput', { stepId: step.id, stream, text })
          // Stream output to the session log file
          log.updateAttemptOutput?.(step.id, stream, text)
        },
      })

      if (controller.signal.aborted || result.error === 'Cancelled') {
        log.updateStepStatus(step.id, 'cancelled')
        log.finish('cancelled')
        event.sender.send('agent:stepDone', { stepId: step.id, success: false, message: 'Cancelled by user' })
        event.sender.send('agent:done', { success: false, cancelled: true, sessionDir, logFile: log.logFile, message: 'Workflow cancelled.' })
        workflowControllers.delete(sessionId)
        return
      }

      // ── Exit 0 — verify outputs then mark complete ─────────────────────────
      if (result.success) {
        const outputCheck = validateStepOutputs(currentCommand)
        if (!outputCheck.ok) {
          result = {
            ...result,
            success: false,
            error: outputCheck.message,
            stderr: `${result.stderr}\n${outputCheck.message}`,
          }
        }
      }

      if (result.success) {
        log.recordAttempt(step.id, {
          command: currentCommand, stdout: result.stdout, stderr: result.stderr,
          exitSuccess: true, aiSuccess: true,
          aiMessage: 'Completed (exit 0)', fixedCommand: null,
        })
        log.updateStepStatus(step.id, 'completed')
        event.sender.send('agent:stepDone', { stepId: step.id, success: true, stderr: result.stderr })
        finalResult = result
        stepPassed  = true
        stepResults.push({
          stepId:      step.id,
          title:       step.title,
          description: step.description,
          type:        'shell',
          success:     true,
          command:     currentCommand,
          summary:     extractFfmpegSummary(result.stderr),
        })
        break
      }

      // ── Failed — local diagnosis first ──────────────────────────────────
      const localDiagnosis = diagnoseStepFailure(step, currentCommand, result)
      if (localDiagnosis) {
        log.recordAttempt(step.id, {
          command: currentCommand, stdout: result.stdout, stderr: result.stderr,
          exitSuccess: false, aiSuccess: false,
          aiMessage: localDiagnosis.message, fixedCommand: null,
        })
        log.updateStepStatus(step.id, 'failed')
        event.sender.send('agent:stepDone', { stepId: step.id, success: false, message: localDiagnosis.message })
        event.sender.send('agent:done', { success: false, sessionDir, logFile: log.logFile, message: localDiagnosis.message })
        log.finish('completed_with_errors')
        workflowControllers.delete(sessionId)
        return
      }

      // ── Ask AI to diagnose and fix ───────────────────────────────────────
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
          aiMessage: 'AI verify failed: ' + aiErr.message, fixedCommand: null,
        })
        if (attempt === MAX_HEAL) {
          log.updateStepStatus(step.id, 'failed')
          const msg = 'Step "' + step.title + '" could not be verified: ' + aiErr.message
          event.sender.send('agent:stepDone', { stepId: step.id, success: false, message: msg })
          event.sender.send('agent:done', { success: false, sessionDir, logFile: log.logFile, message: msg })
          log.finish('completed_with_errors')
          workflowControllers.delete(sessionId)
          return
        }
        continue
      }

      log.recordAttempt(step.id, {
        command: currentCommand, stdout: result.stdout, stderr: result.stderr,
        exitSuccess: false,
        aiSuccess:   verification?.success ?? false,
        aiMessage:   verification?.message ?? '',
        fixedCommand: verification?.fixed_command ?? null,
      })

      if (verification?.fixed_command) {
        currentCommand = verification.fixed_command
        event.sender.send('agent:stepCmdUpdate', { stepId: step.id, cmd: currentCommand, message: verification.message })
        continue
      }

      // Unfixable
      log.updateStepStatus(step.id, 'failed')
      const failMsg = verification?.message ?? ('Step "' + step.title + '" could not be completed.')
      event.sender.send('agent:stepDone', { stepId: step.id, success: false, message: failMsg })

      const errorReply = await buildAICompletionReply({
        config, workflow, stepResults,
        failedStep: { ...step, message: failMsg },
        outputDir, success: false,
      })
      event.sender.send('agent:done', {
        success: false, sessionDir, logFile: log.logFile,
        message: errorReply, aiReply: true,
      })
      log.finish('completed_with_errors')
      workflowControllers.delete(sessionId)
      return
    }

    if (!stepPassed) {
      log.updateStepStatus(step.id, 'failed')
      log.finish('completed_with_errors')
      workflowControllers.delete(sessionId)
      const errorReply = await buildAICompletionReply({
        config, workflow, stepResults,
        failedStep: { ...step, message: 'Failed after ' + MAX_HEAL + ' attempts' },
        outputDir, success: false,
      })
      event.sender.send('agent:done', {
        success: false, sessionDir, logFile: log.logFile,
        message: errorReply, aiReply: true,
      })
      return
    }
  }

  // ── All steps done — ask AI to compose a natural completion reply ──────────
  log.finish('completed')
  const completionReply = await buildAICompletionReply({
    config, workflow, stepResults, outputDir, success: true,
  })
  event.sender.send('agent:done', {
    success: true, sessionDir, logFile: log.logFile,
    message: completionReply, aiReply: true,
  })
  workflowControllers.delete(sessionId)
})

// ── Extract key info from ffmpeg stderr for the AI summary ────────────────────
function extractFfmpegSummary(stderr) {
  if (!stderr) return null
  const lines = stderr.split('\n')
  const useful = []
  for (const line of lines) {
    const l = line.trim()
    if (/^Output #/.test(l))             useful.push(l)
    if (/Stream.*Video:/.test(l))        useful.push(l.slice(0, 120))
    if (/Stream.*Audio:/.test(l))        useful.push(l.slice(0, 120))
    if (/Lsize=|muxing overhead/.test(l)) useful.push(l)
  }
  const progressLines = lines.filter(l => /Lsize=/.test(l))
  if (progressLines.length > 0) useful.push(progressLines[progressLines.length - 1].trim())
  return useful.slice(0, 8).join('\n') || null
}

// ── Ask AI to write a natural language completion/failure reply ────────────────
async function buildAICompletionReply({ config, workflow, stepResults, failedStep, outputDir, success }) {
  try {
    let outputFileList = ''
    try {
      if (fs.existsSync(outputDir)) {
        const files = fs.readdirSync(outputDir)
          .filter(f => !f.startsWith('.'))
          .map(f => {
            const full  = path.join(outputDir, f)
            const bytes = fs.statSync(full).size
            const size  = bytes < 1024 * 1024
              ? Math.round(bytes / 1024) + ' KB'
              : (bytes / 1024 / 1024).toFixed(1) + ' MB'
            return f + ' (' + size + ')'
          })
        outputFileList = files.length > 0 ? files.join(', ') : 'none'
      }
    } catch (_) {}

    const stepSummary = stepResults.map(r => {
      let line = 'Step ' + r.stepId + ' "' + r.title + '": ' + (r.success ? 'succeeded' : 'failed')
      if (r.summary) line += '\n  ffmpeg output: ' + r.summary
      return line
    }).join('\n')

    const failureNote = failedStep
      ? '\nFailed at step "' + failedStep.title + '": ' + failedStep.message
      : ''

    const prompt = success
      ? 'A media processing workflow just completed successfully.\n\n' +
        'Workflow goal: "' + workflow.message + '"\n' +
        'Steps executed:\n' + stepSummary + '\n\n' +
        'Output files created: ' + outputFileList + '\n' +
        'Output folder: ' + outputDir + '\n\n' +
        'Write a SHORT, friendly, plain English reply to the user confirming what was done and what files were created.\n' +
        '- Mention the output filename(s) specifically\n' +
        '- If relevant, mention key details like duration, format, or size\n' +
        '- Do NOT use markdown, bullet points, or headers\n' +
        '- Keep it under 3 sentences\n' +
        '- Do NOT say "as an AI" or similar\n' +
        '- Reply as if you just did the work yourself'
      : 'A media processing workflow failed.\n\n' +
        'Workflow goal: "' + workflow.message + '"\n' +
        'Steps that ran:\n' + stepSummary + '\n' + failureNote + '\n\n' +
        'Write a SHORT, honest reply explaining what failed and what the user can try.\n' +
        '- Be specific about what went wrong\n' +
        '- Suggest one concrete fix if possible\n' +
        '- Do NOT use markdown or bullet points\n' +
        '- Keep it under 3 sentences\n' +
        '- Do NOT say "as an AI" or similar'

    const raw = await callAI([
      { role: 'system', content: 'You are Vizio, a desktop media processing agent. Respond only with plain conversational text — no JSON, no markdown.' },
      { role: 'user', content: prompt },
    ], config, 2)

    if (raw && raw.trim()) return raw.trim()
    return success
      ? 'Done! Output: ' + (outputFileList !== 'none' ? outputFileList : 'Check the output files tab.')
      : 'The workflow failed at "' + (failedStep ? failedStep.title : 'a step') + '". Check the session log for details.'

  } catch (err) {
    return success
      ? 'Workflow complete. Check the output files tab for results.'
      : 'Workflow failed. Check the session log for details.'
  }
}
// ── IPC: file ops ──────────────────────────────────────────────────────────────

ipcMain.handle('agent:scanTools',   () => scanTools().then(formatToolsBlock))
ipcMain.handle('agent:probeFiles',  (_, paths) => probeFiles(paths))
ipcMain.handle('tools:scan',        (_, opts) => scanToolsWithBlock(opts))
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
ipcMain.handle('files:readBase64', async (_, filePaths) => {
  const results = []
  for (const filePath of filePaths) {
    try {
      const data = fs.readFileSync(filePath)
      const base64 = data.toString('base64')
      const ext = path.extname(filePath).toLowerCase().replace('.', '')
      const mimeMap = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg',
        png: 'image/png', webp: 'image/webp',
        gif: 'image/gif',
      }
      const mediaType = mimeMap[ext] ?? 'image/jpeg'
      results.push({ path: filePath, base64, mediaType, ok: true })
    } catch (err) {
      results.push({ path: filePath, ok: false, error: err.message })
    }
  }
  return results
})
ipcMain.handle('files:probe',       (_, paths) => probeFiles(paths))

// Project handlers
ipcMain.handle('project:getAll',    () => getAllProjects())
ipcMain.handle('project:create',    (_, { name, folderPath }) => createProject({ name, folderPath }))
ipcMain.handle('project:setLast',   (_, id) => setLastProject(id))
ipcMain.handle('project:delete',    (_, id) => deleteProject(id))
ipcMain.handle('project:getMedia',  (event, projectDir) => {
  watchProjectDir(projectDir, event.sender)
  return getProjectMedia(projectDir)
})
ipcMain.handle('project:getOutputs', (event, projectDir) => {
  watchProjectDir(projectDir, event.sender)
  return getProjectOutputs(projectDir)
})
ipcMain.handle('project:copyMedia', (_, { sourcePath, projectDir }) => copyMediaToProject(sourcePath, projectDir))
ipcMain.handle('project:deleteMedia', (_, { filePath, projectDir }) => deleteProjectMedia(projectDir, filePath))

ipcMain.handle('project:choosePath', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('project:exportFile', async (_, { sourcePath, defaultName }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName,
  })
  if (canceled || !filePath) return { ok: false }
  try {
    fs.copyFileSync(sourcePath, filePath)
    return { ok: true, dest: filePath }
  } catch (err) {
    return { ok: false, message: err.message }
  }
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

    const log = createLogger(sessionId, projectDir)
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

ipcMain.handle('session:listForProject', (_, { projectDir }) => {
  try {
    const dir = getLogDir()
    if (!fs.existsSync(dir)) return []
    const files = fs.readdirSync(dir)
    const sessions = []
    for (const file of files) {
      if (!file.startsWith('session-') || !file.endsWith('.json')) continue
      try {
        const filePath = path.join(dir, file)
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        if (
          content.projectPath === projectDir ||
          (content.mediaFiles && content.mediaFiles.some(f => f.startsWith(projectDir)))
        ) {
          sessions.push({
            sessionId: content.sessionId,
            startedAt: content.startedAt
          })
        }
      } catch (err) {
        // ignore malformed JSON files
      }
    }
    // Sort by startedAt ascending (oldest first) so they align with chronological order
    sessions.sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt))
    return sessions.map(s => s.sessionId)
  } catch {
    return []
  }
})

ipcMain.handle('session:listFiles', (_, { sessionId, projectDir }) => {
  try {
    const dir = path.join(projectDir, 'sessions', sessionId)
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
ipcMain.on('shell:showInFolder', (_, filePath) => {
  if (filePath) shell.showItemInFolder(filePath)
})

ipcMain.handle('session:init', async (_, { sessionId, userGoal, mediaFiles, projectDir = '' }) => {
  try {
    const log = createLogger(sessionId, projectDir)
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
