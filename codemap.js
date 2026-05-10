import fs from 'fs'
import path from 'path'

const ROOT = process.cwd()

const INCLUDE_DIRS = ['src', 'electron']
const INCLUDE_EXTS = ['.js', '.jsx', '.ts', '.tsx']
const EXCLUDE      = ['node_modules', 'dist', 'dist-electron', '.git', 'logs', 'scripts']

// ─── Walk directory recursively ───────────────────────────────────────────────
function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE.includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (INCLUDE_EXTS.includes(path.extname(entry.name))) files.push(full)
  }
  return files
}

// ─── Extract signatures from a file (no full bodies) ─────────────────────────
function extractSignatures(content) {
  const lines   = content.split('\n')
  const result  = []
  let   i       = 0

  while (i < lines.length) {
    const line = lines[i].trimEnd()
    const trim = line.trim()

    // imports
    if (trim.startsWith('import ')) {
      result.push(line)
      i++
      continue
    }

    // exports
    if (
      trim.startsWith('export ') ||
      trim.startsWith('export default ') ||
      trim.match(/^(async\s+)?function\s+\w+/) ||
      trim.match(/^const\s+\w+\s*=\s*(async\s+)?\(/) ||
      trim.match(/^export\s+const\s+\w+/)
    ) {
      // Grab the signature line(s) — stop at first {
      const sig = []
      let j = i
      while (j < lines.length) {
        const l = lines[j].trimEnd()
        sig.push(l)
        if (l.includes('{') || l.includes('=>')) break
        j++
      }
      const sigLine = sig.join(' ').replace(/\s+/g, ' ').trim()
      // Strip the body — just show up to the opening brace
      const clean = sigLine.replace(/\{.*$/, '{…}').replace(/=>.*$/, '=> {…}')
      result.push(clean)
      i = j + 1

      // Skip body — find matching closing brace
      let depth = (sigLine.match(/\{/g) || []).length - (sigLine.match(/\}/g) || []).length
      while (i < lines.length && depth > 0) {
        const l = lines[i]
        depth += (l.match(/\{/g) || []).length
        depth -= (l.match(/\}/g) || []).length
        i++
      }
      continue
    }

    // IPC handlers — important to capture
    if (trim.includes('ipcMain.handle') || trim.includes('ipcMain.on') || trim.includes('ipcRenderer')) {
      result.push(line.replace(/,\s*async.*$/, ', …)').replace(/,\s*\(.*$/, ', …)'))
    }

    i++
  }

  return result.filter(Boolean)
}

// ─── Build file tree string ───────────────────────────────────────────────────
function buildTree(dir, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !EXCLUDE.includes(e.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })

  return entries.map((entry, idx) => {
    const isLast     = idx === entries.length - 1
    const connector  = isLast ? '└── ' : '├── '
    const childPrefix = isLast ? '    ' : '│   '
    const line       = prefix + connector + entry.name
    if (entry.isDirectory()) {
      const children = buildTree(path.join(dir, entry.name), prefix + childPrefix)
      return [line, ...children].join('\n')
    }
    return line
  }).join('\n')
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function generate() {
  const out   = []
  const files = INCLUDE_DIRS.flatMap(d => walk(path.join(ROOT, d)))

  // Header
  out.push('# VISIO MEDIA AGENT — CODEMAP')
  out.push(`Generated: ${new Date().toISOString()}`)
  out.push('')

  // File tree
  out.push('## PROJECT STRUCTURE')
  out.push('```')
  for (const d of INCLUDE_DIRS) {
    const full = path.join(ROOT, d)
    if (fs.existsSync(full)) {
      out.push(d + '/')
      out.push(buildTree(full, '  '))
    }
  }
  out.push('```')
  out.push('')

  // Architecture summary
  out.push('## ARCHITECTURE')
  out.push('```')
  out.push('electron/main.js        — Electron main process. IPC handlers, ffmpeg execution, logger')
  out.push('electron/preload.js     — Context bridge. Exposes safe IPC API to renderer as window.electron')
  out.push('electron/ffmpeg.js      — runFfmpeg (spawn), probeFiles, scanTools, createLogger')
  out.push('')
  out.push('src/App.jsx             — Root. Navigation history stack (back/forward). Page routing.')
  out.push('src/pages/MainPage.jsx  — Editor view. Owns activeFile, tasks, toolsBlock, probeData state.')
  out.push('src/pages/ToolsPage.jsx — Tool registry. Shows installed/missing CLI tools + setup guides.')
  out.push('src/pages/SettingsPage.jsx — API keys (per provider) + model input + appearance.')
  out.push('')
  out.push('src/components/chat/ChatPanel.jsx   — AI chat. Calls AI, parses workflow, triggers execution.')
  out.push('src/components/library/MediaLibrary.jsx — File drag-drop. Manages file list + active file.')
  out.push('src/components/preview/PreviewPanel.jsx — Before/after video panes + output/log tabs.')
  out.push('src/components/layout/MenuBar.jsx   — App menu bar with back/forward navigation.')
  out.push('src/components/layout/ExecutionBar.jsx — Bottom bar. Session info + per-task progress.')
  out.push('')
  out.push('src/store/settingsStore.js — localStorage store. Providers, models, keys. getActiveConfig().')
  out.push('```')
  out.push('')

  // IPC contract
  out.push('## IPC CONTRACT (renderer ↔ main)')
  out.push('```')
  out.push('// renderer → main (invoke = await response)')
  out.push("window.electron.scanTools()                    → tool[]")
  out.push("window.electron.probeFiles([path])             → probeResult[]")
  out.push("window.electron.getSessionPath(sessionId)      → string (dir path)")
  out.push("window.electron.runWorkflow({workflow, sessionId, apiKey, model, providerId, baseUrl})")
  out.push('')
  out.push('// main → renderer (streaming events)')
  out.push("window.electron.onStepUpdate({stepId, status, pct, message})")
  out.push("window.electron.onStepDone({stepId, success, stderr, stdout, message})")
  out.push("window.electron.onStepCmdUpdate({stepId, cmd, message})  // retry with new command")
  out.push("window.electron.onWorkflowDone({success, sessionDir, logFile, message})")
  out.push("window.electron.removeAgentListeners()")
  out.push('```')
  out.push('')

  // Data flow
  out.push('## DATA FLOW')
  out.push('```')
  out.push('1. App boots → MainPage scans tools via IPC → sets toolsBlock string for system prompt')
  out.push('2. User drops file → MediaLibrary → onSelectFile → probeFiles via IPC → probeData state')
  out.push('3. User types task → ChatPanel builds system prompt (tools + file + session dir)')
  out.push('4. ChatPanel calls AI (provider-agnostic callAI) → parses JSON response')
  out.push('5. mode=workflow → message shown → runWorkflow IPC called immediately (no permission gate)')
  out.push('6. main.js: for each step → spawn ffmpeg → stream progress → if fail → callAI verify loop')
  out.push('7. verify loop: exit 0 = pass. non-zero = send stderr to AI → get fixed_command → retry x3')
  out.push('8. Progress events stream back → ChatPanel log card updates + ExecutionBar task row updates')
  out.push('9. onWorkflowDone → loading false → success/fail message in chat')
  out.push('```')
  out.push('')

  // settingsStore shape
  out.push('## SETTINGS STORE SHAPE')
  out.push('```js')
  out.push(`// localStorage key: 'visio_settings'`)
  out.push(`// settingsStore.getActiveConfig() returns: { providerId, label, baseUrl, apiKey, model, isLocal }`)
  out.push(`// PROVIDERS: groq | openai | anthropic | gemini | ollama`)
  out.push(`// Per-provider keys: groqApiKey, openaiApiKey, anthropicApiKey, geminiApiKey, ollamaEndpoint`)
  out.push(`// Per-provider models: groqModel, openaiModel, anthropicModel, geminiModel, ollamaModel`)
  out.push('```')
  out.push('')

  // Per-file signatures
  out.push('## FILE SIGNATURES')
  out.push('')

  for (const file of files) {
    const rel      = path.relative(ROOT, file).replace(/\\/g, '/')
    const content  = fs.readFileSync(file, 'utf-8')
    const sigs     = extractSignatures(content)

    if (sigs.length === 0) continue

    out.push(`### ${rel}`)
    out.push('```js')
    out.push(sigs.join('\n'))
    out.push('```')
    out.push('')
  }

  // Write output
  const outPath = path.join(ROOT, 'CODEMAP.md')
  fs.writeFileSync(outPath, out.join('\n'), 'utf-8')
  console.log(`✅ Codemap written to CODEMAP.md (${Math.round(out.join('\n').length / 1024)}KB)`)
  console.log(`   ${files.length} files processed`)
}

generate()