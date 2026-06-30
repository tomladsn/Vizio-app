import { exec, spawn, execFile }  from 'child_process'
import { promisify }    from 'util'
import path             from 'path'
import fs               from 'fs'
import os               from 'os'
import { app }          from 'electron'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

function resolveBin(name) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name
  const platform = process.platform

  // 1. Packaged/production candidate paths
  if (app.isPackaged) {
    const candidates = [
      path.join(process.resourcesPath, 'bin', exe),
      path.join(process.resourcesPath, 'bin', platform, exe),
      path.join(process.resourcesPath, exe),
      path.join(app.getAppPath(), '..', 'bin', exe),
      path.join(app.getAppPath(), '..', 'bin', platform, exe),
    ]

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        if (platform !== 'win32') {
          try {
            const stats = fs.statSync(p)
            if ((stats.mode & 0o100) === 0) {
              fs.chmodSync(p, 0o755)
              console.log(`[bin] ${name} -> chmod 755 applied`)
            }
          } catch (e) {
            console.warn(`[bin] Failed to chmod ${name}:`, e.message)
          }
        }
        console.log(`[bin] ${name} -> bundled (packaged) at: ${p}`)
        return p
      }
    }
  }

  // 2. Development candidate paths
  const appPath = app.getAppPath()
  const devCandidates = [
    path.join(appPath, 'resources', 'bin', platform, exe),
    path.join(process.cwd(), 'resources', 'bin', platform, exe),
    path.join(appPath, 'resources', 'bin', exe),
    path.join(process.cwd(), 'resources', 'bin', exe),
    path.join(appPath, '..', 'resources', 'bin', platform, exe),
  ]

  for (const p of devCandidates) {
    if (fs.existsSync(p)) {
      console.log(`[bin] ${name} -> bundled (dev) at: ${p}`)
      return p
    }
  }

  console.warn(`[bin] ${name} -> system PATH fallback`)
  return name
}

export const BIN = {
  ffmpeg: resolveBin('ffmpeg'),
  ffprobe: resolveBin('ffprobe'),
  ffplay: resolveBin('ffplay'),
  ytdlp: resolveBin('yt-dlp'),
}

console.log('[binaries]', BIN)

function resolveCommandBin(bin) {
  const cleanBin = bin.replace(/^["']|["']$/g, '')
  const key = path.basename(cleanBin).toLowerCase().replace(/\.exe$/, '')
  if (key === 'ffmpeg') return BIN.ffmpeg
  if (key === 'ffprobe') return BIN.ffprobe
  if (key === 'ffplay') return BIN.ffplay
  if (key === 'yt-dlp') return BIN.ytdlp
  return cleanBin
}

// Use Electron's userData path for logs — always predictable
const LOG_DIR = path.join(app.getPath('userData'), 'logs')

// ─── Command cleaner (same as your CLI version) ───────────────────────────────
function cleanCommand(raw) {
  return raw
    .replace(/```(?:bash|sh|ffmpeg|shell)?/gi, '')
    .replace(/```/g, '')
    .replace(/^\s*\$\s*/gm, '')
    .trim()
}

// ─── Parse ffmpeg stderr for progress ────────────────────────────────────────
// ffmpeg writes lines like: frame=  120 fps= 24 time=00:00:05.00 bitrate=...
function parseProgress(line, durationSec) {
  const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.?\d*)/)
  if (!timeMatch || !durationSec) return null
  const elapsed = (+timeMatch[1]) * 3600 + (+timeMatch[2]) * 60 + (+timeMatch[3])
  return Math.min(99, Math.round((elapsed / durationSec) * 100))
}

// ─── Run ffmpeg with real-time progress ──────────────────────────────────────
export function runFfmpeg(command, { onProgress, onOutput, onStderr, durationSec, signal } = {}) {
  return new Promise((resolve) => {
    const cmd     = cleanCommand(command)
    const parts   = cmd.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? []
    const bin     = resolveCommandBin(parts[0])
    const args    = parts.slice(1).map(a => a.replace(/^["']|["']$/g, ''))

    const proc    = spawn(bin, args)
    let stdout    = ''
    let stderr    = ''
    let settled   = false

    function finish(result) {
      if (settled) return
      settled = true
      resolve(result)
    }

    if (signal?.aborted) {
      finish({ command: cmd, success: false, stdout, stderr, error: 'Cancelled' })
      return
    }

    const abortHandler = () => {
      try {
        if (process.platform === 'win32' && proc.pid) {
          exec(`taskkill /F /T /PID ${proc.pid}`, () => {})
        } else {
          proc.kill('SIGTERM')
        }
      } catch (_) {}
      finish({ command: cmd, success: false, stdout, stderr, error: 'Cancelled' })
    }

    signal?.addEventListener?.('abort', abortHandler, { once: true })

    proc.stdout.on('data', chunk => {
      const text = chunk.toString()
      stdout += text
      onOutput?.({ stream: 'stdout', text })
    })

    proc.stderr.on('data', chunk => {
      const text = chunk.toString()
      stderr += text
      onOutput?.({ stream: 'stderr', text })
      onStderr?.(text)
      if (onProgress) {
        const pct = parseProgress(text, durationSec)
        if (pct !== null) onProgress(pct)
      }
    })

    proc.on('close', code => {
      signal?.removeEventListener?.('abort', abortHandler)
      finish({
        command: cmd,
        success: code === 0,
        stdout,
        stderr,
        error: code !== 0 ? `Exit code ${code}` : null,
      })
    })

    proc.on('error', err => {
      signal?.removeEventListener?.('abort', abortHandler)
      finish({ command: cmd, success: false, stdout, stderr, error: err.message })
    })
  })
}

// ─── Probe files with ffprobe ─────────────────────────────────────────────────
export async function probeFiles(filePaths) {
  const results = []
  for (const file of filePaths) {
    const cmd = `"${BIN.ffprobe}" -v quiet -print_format json -show_streams -show_format "${file}"`
    try {
      const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 })
      const raw        = JSON.parse(stdout)

      const streams = (raw.streams ?? []).map(s => ({
        index:          s.index,
        type:           s.codec_type,
        codec:          s.codec_name,
        profile:        s.profile         ?? null,
        width:          s.width           ?? null,
        height:         s.height          ?? null,
        fps:            s.r_frame_rate    ?? null,
        pix_fmt:        s.pix_fmt         ?? null,
        sample_rate:    s.sample_rate     ?? null,
        channels:       s.channels        ?? null,
        channel_layout: s.channel_layout  ?? null,
        bit_rate:       s.bit_rate        ?? null,
        duration_sec:   s.duration ? parseFloat(s.duration).toFixed(2) : null,
        language:       s.tags?.language  ?? null,
      }))

      const format = {
        filename:     raw.format?.filename,
        format_name:  raw.format?.format_name,
        duration_sec: raw.format?.duration ? parseFloat(raw.format.duration).toFixed(2) : null,
        size_bytes:   raw.format?.size     ?? null,
        bit_rate:     raw.format?.bit_rate ?? null,
      }

      results.push({ file, format, streams })
    } catch (err) {
      results.push({ file, error: `ffprobe failed: ${err.message}` })
    }
  }
  return results
}

// ─── Scan installed tools ─────────────────────────────────────────────────────
export const KNOWN_TOOLS = [
  { name: 'ffmpeg',  category: 'Media',    description: 'Video/audio encoding, filtering, trimming, muxing', bundled: true },
  { name: 'ffprobe', category: 'Media',    description: 'Media file inspection and stream analysis', bundled: true },
  { name: 'ffplay',  category: 'Media',    description: 'Media playback and preview', bundled: true },
  { name: 'yt-dlp',  category: 'Download', description: 'Download video/audio from 1000+ sites', bundled: true },
  { name: 'whisper', category: 'AI / ML',  description: 'Speech-to-text transcription (OpenAI Whisper)', bundled: false },
  {
    name: 'magick',
    category: 'Image',
    description: 'Frame-level image manipulation (ImageMagick)',
    bundled: false,
    windowsSearch: {
      baseDirs: ['ProgramFiles', 'ProgramFiles(x86)', 'LOCALAPPDATA'],
      subdirs: ['ImageMagick-*', 'ImageMagick'],
      exe: 'magick.exe',
    },
  },
]

const SCAN_CACHE_MS = 30_000
const EXEC_TIMEOUT_MS = 3500
const FIND_TIMEOUT_MS = 1200
const WINDOWS_APPS_RE = /WindowsApps/i

let scanCache = null

function matchWindowsDirs(baseDir, patterns) {
  if (!baseDir || !fs.existsSync(baseDir)) return []
  try {
    const entries = fs.readdirSync(baseDir, { withFileTypes: true })
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(baseDir, entry.name))
      .filter(fullPath => patterns.some(pattern => {
        const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`, 'i')
        return regex.test(path.basename(fullPath))
      }))
  } catch {
    return []
  }
}

async function execCheck(cmd, timeout = EXEC_TIMEOUT_MS) {
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout,
      windowsHide: true,
      maxBuffer: 512 * 1024,
    })
    const output = (stdout || stderr || '').trim()
    if (!output) return { success: false }
    return { success: true, version: output.split('\n')[0].trim().slice(0, 80) }
  } catch {
    return { success: false }
  }
}

function quoteCmd(bin) {
  return bin.includes(' ') ? `"${bin}"` : bin
}

function listWhisperModels() {
  const cacheDir = path.join(os.homedir(), '.cache', 'whisper')
  if (!fs.existsSync(cacheDir)) return []
  try {
    return fs.readdirSync(cacheDir)
      .filter(f => f.endsWith('.pt'))
      .map(f => f.replace(/\.pt$/i, ''))
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

function discoverPythonPaths() {
  const found = new Set()
  const add = (p) => {
    if (!p || WINDOWS_APPS_RE.test(p) || !fs.existsSync(p)) return
    if (/\\venv\\|blender|conda|node_modules|pyenv/i.test(p)) return
    found.add(path.normalize(p))
  }

  if (process.platform === 'win32') {
    const roots = [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python'),
      path.join(process.env.LOCALAPPDATA || '', 'Python'),
    ]
    for (const root of roots) {
      if (!root || !fs.existsSync(root)) continue
      try {
        for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue
          const base = path.join(root, entry.name)
          add(path.join(base, 'python.exe'))
        }
      } catch (_) {}
    }
  }

  return [...found].slice(0, 4)
}

function discoverScriptsDirs() {
  const dirs = new Set()
  if (process.platform !== 'win32') return []

  for (const py of discoverPythonPaths()) {
    dirs.add(path.join(path.dirname(py), 'Scripts'))
  }

  const roots = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python'),
    path.join(process.env.LOCALAPPDATA || '', 'Python'),
  ]
  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue
    try {
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        dirs.add(path.join(root, entry.name, 'Scripts'))
      }
    } catch (_) {}
  }

  return [...dirs].filter(d => fs.existsSync(d))
}

async function findWhereExe(name) {
  if (process.platform !== 'win32') {
    try {
      const { stdout } = await execAsync(`which ${name}`, { timeout: FIND_TIMEOUT_MS, windowsHide: true })
      const hit = stdout.trim().split('\n')[0]?.trim()
      return hit || null
    } catch {
      return null
    }
  }

  try {
    const { stdout } = await execAsync(`where.exe ${name}`, { timeout: FIND_TIMEOUT_MS, windowsHide: true })
    const hit = stdout.trim().split(/\r?\n/)
      .map(l => l.trim())
      .find(l => l && !WINDOWS_APPS_RE.test(l) && fs.existsSync(l))
    return hit || null
  } catch {
    return null
  }
}

async function findPythonCandidates(max = 3) {
  const candidates = []
  const seen = new Set()

  function push(cmd, version) {
    if (seen.has(cmd) || candidates.length >= max) return
    seen.add(cmd)
    candidates.push({ cmd, version })
  }

  const fsHits = await Promise.all(
    discoverPythonPaths().map(async pyPath => {
      const cmd = quoteCmd(pyPath)
      const res = await execCheck(`${cmd} --version`, 2500)
      return res.success ? { cmd, version: res.version } : null
    })
  )
  for (const hit of fsHits) if (hit) push(hit.cmd, hit.version)
  if (candidates.length >= max) return candidates

  if (process.platform === 'win32') {
    for (const launcher of ['py -3', 'py']) {
      if (candidates.length >= max) break
      const res = await execCheck(`${launcher} --version`, 2500)
      if (res.success) push(launcher, res.version)
    }
  } else {
    for (const name of ['python3', 'python']) {
      if (candidates.length >= max) break
      const res = await execCheck(`${name} --version`, 2500)
      if (res.success) push(name, res.version)
    }
  }

  return candidates
}

async function execFileCheck(file, args = [], timeout = EXEC_TIMEOUT_MS) {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      timeout,
      windowsHide: true,
      maxBuffer: 512 * 1024,
    })
    const output = (stdout || stderr || '').trim()
    if (!output) return { success: false }
    return { success: true, version: output.split('\n')[0].trim().slice(0, 80) }
  } catch (err) {
    return { success: false }
  }
}

async function detectBundledBin(binPath, flag, toolKey) {
  const systemCmd = toolKey === 'ytdlp' ? 'yt-dlp' : toolKey
  const bundled = binPath !== systemCmd
  const res = await execFileCheck(binPath, [flag])
  return res.success
    ? { available: true, version: res.version, bundled }
    : { available: false, version: null, bundled: false }
}

async function detectYtDlp(pythonCandidates) {
  const bundledRes = await detectBundledBin(BIN.ytdlp, '--version', 'ytdlp')
  if (bundledRes.available) return bundledRes

  const whereHit = await findWhereExe('yt-dlp')
  if (whereHit) {
    const res = await execCheck(`${quoteCmd(whereHit)} --version`)
    if (res.success) return { ...res, available: true, bundled: false }
  }

  for (const scriptsDir of discoverScriptsDirs()) {
    const exe = path.join(scriptsDir, 'yt-dlp.exe')
    if (!fs.existsSync(exe)) continue
    const res = await execCheck(`${quoteCmd(exe)} --version`)
    if (res.success) return { ...res, available: true, bundled: false }
  }

  for (const { cmd } of pythonCandidates.slice(0, 2)) {
    const res = await execCheck(`${cmd} -m yt_dlp --version`)
    if (res.success) return { ...res, available: true, bundled: false }
  }

  return { available: false, version: null, bundled: false }
}

async function detectWhisper(pythonCandidates) {
  const whisperModels = listWhisperModels()

  if (whisperModels.length > 0) {
    const cmd = pythonCandidates[0]?.cmd
    if (cmd) {
      const res = await execCheck(`${cmd} -c "import whisper; print(whisper.__version__)"`, 3000)
      if (res.success) {
        return { available: true, version: res.version, bundled: false, whisperModels }
      }
    }
    return {
      available: true,
      version: `${whisperModels.length} model(s) cached`,
      bundled: false,
      whisperModels,
    }
  }

  const whereHit = await findWhereExe('whisper')
  if (whereHit) {
    const res = await execCheck(`${quoteCmd(whereHit)} --help`, 2500)
    if (res.success) {
      return { available: true, version: res.version || 'installed', bundled: false, whisperModels }
    }
  }

  for (const scriptsDir of discoverScriptsDirs()) {
    const exe = path.join(scriptsDir, 'whisper.exe')
    if (!fs.existsSync(exe)) continue
    const res = await execCheck(`${quoteCmd(exe)} --help`, 2500)
    if (res.success) {
      return { available: true, version: res.version || 'installed', bundled: false, whisperModels }
    }
  }

  for (const { cmd } of pythonCandidates.slice(0, 1)) {
    const res = await execCheck(`${cmd} -c "import whisper; print(whisper.__version__)"`, 6000)
    if (res.success) {
      return { available: true, version: res.version, bundled: false, whisperModels }
    }
  }

  return { available: false, version: null, bundled: false, whisperModels: [] }
}

async function detectMagick(isWin, meta) {
  for (const cmd of ['magick', 'magick.exe']) {
    const res = await execCheck(`${cmd} --version`)
    if (res.success) return { ...res, available: true, bundled: false }
  }

  if (isWin && meta.windowsSearch) {
    const candidates = meta.windowsSearch.baseDirs.flatMap(envName =>
      matchWindowsDirs(process.env[envName], meta.windowsSearch.subdirs)
    )
    for (const dir of candidates) {
      const exePath = path.join(dir, meta.windowsSearch.exe)
      if (fs.existsSync(exePath)) {
        return { available: true, version: path.basename(dir), bundled: false }
      }
    }
  }

  return { available: false, version: null, bundled: false }
}

export async function scanTools({ force = false } = {}) {
  if (!force && scanCache && Date.now() - scanCache.at < SCAN_CACHE_MS) {
    return scanCache.tools
  }

  const isWin = process.platform === 'win32'
  const pythonCandidates = await findPythonCandidates()

  const checks = KNOWN_TOOLS.map(async meta => {
    const base = { ...meta, available: false, version: null }

    if (meta.name === 'ffmpeg') {
      const det = await detectBundledBin(BIN.ffmpeg, '-version', 'ffmpeg')
      return { ...base, ...det, bundled: det.bundled ?? true }
    }
    if (meta.name === 'ffprobe') {
      const det = await detectBundledBin(BIN.ffprobe, '-version', 'ffprobe')
      return { ...base, ...det, bundled: det.bundled ?? true }
    }
    if (meta.name === 'ffplay') {
      const det = await detectBundledBin(BIN.ffplay, '-version', 'ffplay')
      return { ...base, ...det, bundled: det.bundled ?? true }
    }
    if (meta.name === 'yt-dlp') {
      const det = await detectYtDlp(pythonCandidates)
      return { ...base, ...det }
    }
    if (meta.name === 'whisper') {
      const det = await detectWhisper(pythonCandidates)
      return { ...base, ...det }
    }
    if (meta.name === 'magick') {
      const det = await detectMagick(isWin, meta)
      return { ...base, ...det }
    }

    return base
  })

  const tools = await Promise.all(checks)
  scanCache = { at: Date.now(), tools }
  return tools
}

export function formatToolsBlock(results) {
  const categories = [...new Set(results.map(t => t.category))]
  const lines = ['## Tools Available on This System']
  lines.push('You may ONLY write commands using ✅ tools. For ❌ tools, tell the user what to install.\n')

  for (const cat of categories) {
    lines.push(`### ${cat}`)
    for (const t of results.filter(x => x.category === cat)) {
      const icon    = t.available ? '✅' : '❌'
      let version = t.available ? `  [${t.version}]` : '  not installed'
      if (t.name === 'whisper' && t.whisperModels?.length) {
        version += `  [models: ${t.whisperModels.join(', ')}]`
      }
      lines.push(`  ${icon} ${t.name.padEnd(14)} — ${t.description}${version}`)
    }
    lines.push('')
  }

  const available = results.filter(t => t.available).map(t => t.name).join(', ')
  lines.push(`Usable tools this session: ${available}`)
  return lines.join('\n')
}

export async function scanToolsWithBlock({ force = false } = {}) {
  const tools = await scanTools({ force })
  return { tools, block: formatToolsBlock(tools) }
}

// ─── Logger (Electron version) ────────────────────────────────────────────────
// Saves to app.getPath('userData')/logs/ — always a writable, predictable path
export function createLogger(sessionId, projectPath = '') {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })

  const logFile = path.join(LOG_DIR, `session-${sessionId}.json`)

  let data = null
  if (fs.existsSync(logFile)) {
    try {
      data = JSON.parse(fs.readFileSync(logFile, 'utf-8'))
    } catch (e) {
      console.error('Failed to parse existing log file:', e)
    }
  }

  if (!data) {
    data = {
      sessionId,
      projectPath,
      startedAt:  new Date().toISOString(),
      status:     'in_progress',
      mediaFiles: [],
      userGoal:   '',
      workflow:   null,
      steps:      [],
      completedAt: null,
    }
  } else if (projectPath) {
    data.projectPath = projectPath
  }

  function save() {
    fs.writeFileSync(logFile, JSON.stringify(data, null, 2), 'utf-8')
  }

  save()

  return {
    logFile,
    setMeta({ mediaFiles, userGoal }) {
      data.mediaFiles = mediaFiles
      data.userGoal   = userGoal
      save()
    },
    setWorkflow(workflow) {
      data.workflow = workflow
      data.steps    = workflow.steps.map(s => ({
        id: s.id, title: s.title, status: 'pending', attempts: [],
      }))
      save()
    },
    setStatus(status) {
      data.status = status
      if (status === 'in_progress') data.completedAt = null
      save()
    },
    startAttempt(stepId, command) {
      const record = data.steps.find(s => s.id === stepId)
      if (!record) return
      // Clear any previous running attempt if it somehow got stuck, or reuse it
      const running = record.attempts.find(att => att.status === 'running')
      if (running) {
        running.command = command
        running.stdout = ''
        running.stderr = ''
        running.at = new Date().toISOString()
      } else {
        record.attempts.push({
          command,
          stdout: '',
          stderr: '',
          status: 'running',
          at: new Date().toISOString()
        })
      }
      save()
    },
    updateAttemptOutput(stepId, stream, text) {
      const record = data.steps.find(s => s.id === stepId)
      if (!record) return
      const running = record.attempts.find(att => att.status === 'running')
      if (running) {
        if (stream === 'stdout') {
          running.stdout = (running.stdout || '') + text
        } else {
          running.stderr = (running.stderr || '') + text
        }
        save()
      }
    },
    recordAttempt(stepId, attempt) {
      const record = data.steps.find(s => s.id === stepId)
      if (!record) return
      const running = record.attempts.find(att => att.status === 'running')
      if (running) {
        // Merge the final attempt details into the running attempt
        Object.assign(running, attempt, {
          status: attempt.exitSuccess ? 'completed' : 'failed',
          completedAt: new Date().toISOString()
        })
      } else {
        // Fallback: create a new record
        record.attempts.push({
          ...attempt,
          status: attempt.exitSuccess ? 'completed' : 'failed',
          completedAt: new Date().toISOString()
        })
      }
      record.status = attempt.aiSuccess ? 'completed' : 'failed'
      save()
    },
    updateStepStatus(stepId, status) {
      const record = data.steps.find(s => s.id === stepId)
      if (record) { record.status = status; save() }
    },
    finish(status = 'completed') {
      data.status      = status
      data.completedAt = new Date().toISOString()
      save()
    },
  }
}
