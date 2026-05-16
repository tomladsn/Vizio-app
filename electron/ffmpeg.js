import { exec, spawn }  from 'child_process'
import { promisify }    from 'util'
import path             from 'path'
import fs               from 'fs'
import { app }          from 'electron'

const execAsync = promisify(exec)

function resolveBin(name) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name

  if (app.isPackaged) {
    const packagedPath = path.join(process.resourcesPath, 'bin', exe)
    if (fs.existsSync(packagedPath)) {
      console.log(`[bin] ${name} -> bundled`)
      return packagedPath
    }
  }

  const devPath = path.join(process.cwd(), 'resources', 'bin', process.platform, exe)
  if (fs.existsSync(devPath)) {
    console.log(`[bin] ${name} -> dev local`)
    return devPath
  }

  console.warn(`[bin] ${name} -> system PATH`)
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
export function runFfmpeg(command, { onProgress, durationSec, signal } = {}) {
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
        proc.kill('SIGTERM')
      } catch (_) {}
      finish({ command: cmd, success: false, stdout, stderr, error: 'Cancelled' })
    }

    signal?.addEventListener?.('abort', abortHandler, { once: true })

    proc.stdout.on('data', chunk => { stdout += chunk.toString() })

    proc.stderr.on('data', chunk => {
      const text = chunk.toString()
      stderr += text
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
  { name: 'ffmpeg',  check: BIN.ffmpeg,  flag: '-version',  category: 'Media',    description: 'Video/audio encoding, filtering, trimming, muxing', bundled: true },
  { name: 'ffprobe', check: BIN.ffprobe, flag: '-version',  category: 'Media',    description: 'Media file inspection and stream analysis', bundled: true },
  { name: 'ffplay',  check: BIN.ffplay,  flag: '-version',  category: 'Media',    description: 'Media playback and preview', bundled: true },
  { name: 'yt-dlp',  check: BIN.ytdlp,   flag: '--version', category: 'Download', description: 'Download video/audio from 1000+ sites', bundled: true },
  { name: 'whisper', check: 'whisper',   flag: '--version', category: 'AI / ML',  description: 'Speech-to-text transcription (OpenAI Whisper)', fallback: 'python -m whisper --version', bundled: false },
  {
    name: 'magick',
    check: 'magick',
    flag: '--version',
    category: 'Image',
    description: 'Frame-level image manipulation (ImageMagick)',
    fallback: 'magick.exe --version',
    bundled: false,
    windowsSearch: {
      baseDirs: ['ProgramFiles', 'ProgramFiles(x86)', 'LOCALAPPDATA'],
      subdirs: ['ImageMagick-*', 'ImageMagick'],
      exe: 'magick.exe',
    },
  },
  { name: 'python', check: 'python', flag: '--version', category: 'System', description: 'Python runtime (needed for AI tools like whisper)', bundled: false },
]

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

export async function scanTools() {
  const isWin = process.platform === 'win32'

  const checks = KNOWN_TOOLS.map(async tool => {
    async function tryCommand(cmd) {
      try {
        const { stdout, stderr } = await execAsync(cmd, { timeout: 5000 })
        const output = (stdout || stderr || '').trim()
        return { success: true, version: output.split('\n')[0].trim().slice(0, 60) }
      } catch (_) {
        return { success: false }
      }
    }

    // 1. Try primary check
    let res = await tryCommand(`"${tool.check}" ${tool.flag}`)
    if (res.success) return { ...tool, available: true, version: res.version }

    // 2. Try fallback if defined
    if (tool.fallback) {
      res = await tryCommand(tool.fallback)
      if (res.success) return { ...tool, available: true, version: res.version }
    }

    // 3. Try 'where.exe' (Windows) or 'which' (Unix)
    try {
      const findCommands = isWin
        ? [`where.exe ${tool.name}`, `where.exe ${tool.name}.exe`]
        : [`which ${tool.name}`]

      for (const findCmd of findCommands) {
        const { stdout } = await execAsync(findCmd, { timeout: 2000 })
        if (stdout && stdout.trim()) {
          return { ...tool, available: true, version: 'available' }
        }
      }
    } catch (findErr) {
      // find command failed too
    }

    // 4. Try common Windows install folders for tools that ship outside PATH
    if (isWin && tool.windowsSearch) {
      const candidates = tool.windowsSearch.baseDirs.flatMap(envName =>
        matchWindowsDirs(process.env[envName], tool.windowsSearch.subdirs)
      )

      for (const dir of candidates) {
        const exePath = path.join(dir, tool.windowsSearch.exe)
        if (fs.existsSync(exePath)) {
          return { ...tool, available: true, version: exePath }
        }
      }
    }

    return { ...tool, available: false, version: null }
  })
  return Promise.all(checks)
}

export function formatToolsBlock(results) {
  const categories = [...new Set(results.map(t => t.category))]
  const lines = ['## Tools Available on This System']
  lines.push('You may ONLY write commands using ✅ tools. For ❌ tools, tell the user what to install.\n')

  for (const cat of categories) {
    lines.push(`### ${cat}`)
    for (const t of results.filter(x => x.category === cat)) {
      const icon    = t.available ? '✅' : '❌'
      const version = t.available ? `  [${t.version}]` : '  not installed'
      lines.push(`  ${icon} ${t.name.padEnd(14)} — ${t.description}${version}`)
    }
    lines.push('')
  }

  const available = results.filter(t => t.available).map(t => t.name).join(', ')
  lines.push(`Usable tools this session: ${available}`)
  return lines.join('\n')
}

// ─── Logger (Electron version) ────────────────────────────────────────────────
// Saves to app.getPath('userData')/logs/ — always a writable, predictable path
export function createLogger(sessionId) {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })

  const logFile = path.join(LOG_DIR, `session-${sessionId}.json`)

  const data = {
    sessionId,
    startedAt:  new Date().toISOString(),
    status:     'in_progress',
    mediaFiles: [],
    userGoal:   '',
    workflow:   null,
    steps:      [],
    completedAt: null,
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
    recordAttempt(stepId, attempt) {
      const record = data.steps.find(s => s.id === stepId)
      if (!record) return
      record.attempts.push({ ...attempt, at: new Date().toISOString() })
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
