import React, { useEffect, useRef, useState } from 'react'
import { settingsStore } from '../../store/settingsStore'
import { useSecureKeys } from '../../hooks/useSecureKeys'
import { streamChat, completeChat } from '../../lib/aiBridge'
import './ChatPanel.css'

export const TASK_PRESETS = [
  { label: 'Trim 30s', prompt: 'Trim the selected video to the first 30 seconds and save to the output folder.' },
  { label: 'To WebP', prompt: 'Convert the attached images to WebP in the output folder.' },
  { label: 'Extract MP3', prompt: 'Extract audio from the selected video as MP3 in the output folder.' },
  { label: 'Compress', prompt: 'Compress the selected video for a smaller file (H.264, good quality) in the output folder.' },
  { label: '720p scale', prompt: 'Scale the selected video to 1280x720 and save to the output folder.' },
  { label: 'Mute audio', prompt: 'Remove audio from the selected video and save to the output folder.' },
]

const CHAT_MAX_TOKENS = 4000
const CHAT_HISTORY_LIMIT = 10
const MAX_CHAT_TITLE_LENGTH = 44
const MAX_CONTEXT_FILES = 12
const MAX_PROJECT_STATE_FILES = 20
const MAX_TEXT_CONTEXT_CHARS = 24000
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])
const TEXT_CONTEXT_EXTS = new Set(['srt', 'vtt', 'ass', 'ssa', 'txt', 'md'])

const GENERIC_OPENERS = new Set([
  'hi', 'hello', 'hey', 'yo', 'sup', 'help', 'chat', 'new chat',
])

function buildProjectStateBlock(projectFiles = [], outputFiles = [], projectDir = '', attachedFileNames = []) {
  const lines = ['## PROJECT STATE']
  if (projectDir) lines.push(`Project folder: ${projectDir}`)
  lines.push('')

  // Reorder so attached files are listed first (guarantees they appear even when truncated)
  const attachedSet = new Set(attachedFileNames.map(n => n.toLowerCase()))
  const attached = projectFiles.filter(f => attachedSet.has(f.name.toLowerCase()))
  const rest = projectFiles.filter(f => !attachedSet.has(f.name.toLowerCase()))
  const ordered = [...attached, ...rest]

  if (ordered.length === 0) {
    lines.push('Media files: none imported yet')
  } else {
    lines.push(`Media files (${ordered.length}):`)
    const showFiles = ordered.slice(0, MAX_PROJECT_STATE_FILES)
    showFiles.forEach(f => lines.push(`  - ${f.name}  [${f.ext}, ${f.size}]  path: ${f.path}`))
    if (ordered.length > MAX_PROJECT_STATE_FILES) {
      lines.push(`  ... and ${ordered.length - MAX_PROJECT_STATE_FILES} more (not shown to save tokens)`)
    }
  }

  lines.push('')
  if (outputFiles.length === 0) {
    lines.push('Output files: none yet')
  } else {
    lines.push(`Output files (${outputFiles.length}, newest first):`)
    const showOutputs = outputFiles.slice(0, MAX_PROJECT_STATE_FILES)
    showOutputs.forEach(f => lines.push(`  - ${f.name}  [${f.ext}, ${f.size}]  path: ${f.path}`))
    if (outputFiles.length > MAX_PROJECT_STATE_FILES) {
      lines.push(`  ... and ${outputFiles.length - MAX_PROJECT_STATE_FILES} more`)
    }
  }

  return lines.join('\n')
}

function buildSystemPrompt(toolsBlock, fileBlock, projectStateBlock, outputDir, memoryBlock = '', workflowBlock = '') {
  return `You are Vizio, a desktop media processing AGENT with direct control over the project folder.
You are not a chatbot -- you are an autonomous agent that can read, write, rename, move and delete files inside the project.

${toolsBlock}

${fileBlock}

${projectStateBlock}

${memoryBlock}

${workflowBlock}

## PLANNING CHECKLIST (follow before every workflow)
1. Identify every input file from PROJECT STATE, attached files, and @mentions -- use exact absolute paths.
2. Decide output path(s) under: ${outputDir}
3. Pick the simplest ffmpeg command that meets the goal (avoid re-encoding video if stream copy works).
4. For 4+ files with the SAME operation, use batch_shell (see below). Otherwise use individual shell steps.
5. If quality/format/duration is ambiguous, use clarify mode -- do not guess critical settings.
6. Never use bash loops, && chains, or mkdir for the output folder.

## COMPACT BATCH FORMAT
For 4 or more files with the identical operation, use batch_shell (preferred over repeating steps):
{
  "id": 1,
  "type": "batch_shell",
  "title": "Process selected files",
  "description": "Apply the same operation to every selected file",
  "input_paths": ["C:/absolute/input1.mp4", "C:/absolute/input2.mp4"],
  "output_template": "${outputDir}/{base}_fixed.{ext}",
  "command_template": "ffmpeg -y -i \\"{input}\\" -c copy \\"{output}\\""
}
Placeholders: {input}, {output}, {name}, {base}, {ext}. The app expands this into one shell step per file.

## COMMON FFMPEG PATTERNS (Windows paths, always -y)
- Trim: ffmpeg -y -i "IN" -t 30 -c copy "OUT"
- Scale 720p: ffmpeg -y -i "IN" -vf scale=1280:720 -c:v libx264 -crf 23 "OUT"
- Extract audio: ffmpeg -y -i "IN" -vn -c:a libmp3lame -q:a 2 "OUT.mp3"
- Mute: ffmpeg -y -i "IN" -an -c:v copy "OUT"
- Image to WebP: ffmpeg -y -i "IN" "OUT.webp"
- Re-encode smaller: ffmpeg -y -i "IN" -c:v libx264 -crf 28 -c:a aac -b:a 128k "OUT"
- No "reverb" filter -- use aecho=0.8:0.88:60:0.4 for echo effects

## OUTPUT DIRECTORY
${outputDir}
All output files must be saved here unless the user specifies otherwise. Use full absolute Windows paths.

## AGENT STEP TYPES
- "shell" -- ffmpeg, ffprobe, yt-dlp, whisper, etc.
- "rename" -- fields: from, to (absolute paths)
- "delete" -- field: path
- "move"   -- fields: from, to
- "write"  -- fields: path, content (text files)

## TEXT FILE ANALYSIS
When the user asks to analyze an attached or @mentioned .srt/.vtt/.txt/.md file and export a report:
- The file contents are already provided above under "Text File Contents" when available.
- Do not say "I will read", "Let me read", "I need to inspect", or ask to read the file later.
- Return a workflow with a single "write" step that writes the finished report to a .txt file in the output directory.
- Include the full report text in the "content" field. Use timestamps exactly as they appear in the source file.
- If the relevant file contents are not present, return clarify mode and ask the user to attach or mention the file.

## PLATFORM
Windows 10/11. PowerShell/cmd only. No bash syntax.

## RULES
1. Respond ONLY with a JSON object -- no markdown fences, no text outside JSON.
2. Always use -y in ffmpeg commands; use full absolute paths.
3. If a tool is missing, use chat mode and tell the user what to install in Tools.
4. Never show raw shell commands in "message" fields -- user-facing text only.
5. Workflows require user confirmation before running.
6. @mentions are syntax only -- never put @ in real paths.
7. Process ALL files the user mentioned or attached.
8. Use conversation memory for follow-ups (e.g. "make it smaller" refers to the last output).
9. Never narrate tool use. The UI cannot execute prose like "Let me read the file"; it can only execute the JSON modes below.

## RESPONSE MODES

### MODE 1 - workflow proposal
{
  "mode": "workflow",
  "message": "Short summary of the plan",
  "steps": [
    {
      "id": 1,
      "type": "shell",
      "title": "Step title",
      "description": "What this step does",
      "command": "ffmpeg -y ...",
      "durationSec": null
    },
    {
      "id": 2,
      "type": "write",
      "title": "Write analysis report",
      "description": "Save the finished recommendations as a text file",
      "path": "${outputDir}/analysis_report.txt",
      "content": "Report text here"
    },
    {
      "id": 3,
      "type": "rename",
      "title": "Rename output to final name",
      "description": "Rename the output file",
      "from": "${outputDir}/tmp_output.mp4",
      "to": "${outputDir}/final_output.mp4"
    }
  ],
  "final_output": "${outputDir}/final_output.mp4"
}

### MODE 2 - chat / answer / missing dependency
{
  "mode": "chat",
  "message": "Your reply to the user"
}

### MODE 3 - clarify before planning
{
  "mode": "clarify",
  "message": "Ask the smallest set of questions needed to remove ambiguity"
}`
}

function extractFirstJsonValue(text) {
  const source = text.trim()
  let start = -1
  const stack = []
  let inString = false
  let escaped = false

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{' || char === '[') {
      if (stack.length === 0) start = i
      stack.push(char === '{' ? '}' : ']')
      continue
    }

    if ((char === '}' || char === ']') && stack[stack.length - 1] === char) {
      stack.pop()
      if (stack.length === 0 && start !== -1) {
        return source.slice(start, i + 1)
      }
    }
  }

  return null
}

function toJsonFromLooseObject(raw) {
  let output = ''
  let inSingle = false
  let singleBuffer = ''
  let escaped = false

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i]

    if (inSingle) {
      if (escaped) {
        singleBuffer += char
        escaped = false
      } else if (char === '\\') {
        singleBuffer += char
        escaped = true
      } else if (char === "'") {
        output += JSON.stringify(singleBuffer)
        singleBuffer = ''
        inSingle = false
      } else {
        singleBuffer += char
      }
      continue
    }

    if (char === "'") {
      inSingle = true
      continue
    }

    output += char
  }

  if (inSingle) return null

  return output
    .replace(/\bNone\b/g, 'null')
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
}

function parseLooseAIValue(raw) {
  const jsonLike = extractFirstJsonValue(raw)
  if (!jsonLike) return null

  const normalized = toJsonFromLooseObject(jsonLike)
  if (!normalized) return null

  try {
    return JSON.parse(normalized)
  } catch (_) {
    return null
  }
}

function parseAIResponse(raw) {
  const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch (_) { }

  const valueText = extractFirstJsonValue(cleaned)
  if (valueText) {
    try {
      return JSON.parse(valueText)
    } catch (_) { }
  }

  return parseLooseAIValue(cleaned)
}

function normalizeAIResponse(parsed) {
  if (!parsed || typeof parsed !== 'object') return null

  if (Array.isArray(parsed)) {
    const workflow = parsed.find(item => (
      item && typeof item === 'object' && (item.mode === 'workflow' || item.type === 'workflow' || Array.isArray(item.steps))
    ))
    if (workflow) return normalizeAIResponse(workflow)

    const textItem = parsed.find(item => (
      item && typeof item === 'object' && (item.mode === 'chat' || item.type === 'text' || item.type === 'chat' || typeof item.message === 'string' || typeof item.text === 'string')
    ))
    if (textItem) return normalizeAIResponse(textItem)

    return null
  }

  if (!parsed.mode && parsed.type) {
    if (parsed.type === 'workflow') parsed.mode = 'workflow'
    if (parsed.type === 'chat' || parsed.type === 'text') parsed.mode = 'chat'
    if (parsed.type === 'clarify') parsed.mode = 'clarify'
  }

  if (parsed.mode === 'chat' && typeof parsed.message !== 'string' && typeof parsed.text === 'string') {
    parsed.message = parsed.text
  }

  if (!parsed.mode) {
    if (Array.isArray(parsed.steps)) parsed.mode = 'workflow'
    else if (typeof parsed.message === 'string') parsed.mode = 'chat'
    else if (typeof parsed.text === 'string') {
      parsed.mode = 'chat'
      parsed.message = parsed.text
    }
  }

  if (parsed.mode === 'workflow') {
    if (!Array.isArray(parsed.steps)) return null
    parsed.message = parsed.message || 'I drafted a workflow for this task.'
    parsed.steps = parsed.steps.map((step, index) => ({
      id: step.id ?? index + 1,
      type: step.type || 'shell',
      title: step.title || `Step ${index + 1}`,
      description: step.description || step.title || `Step ${index + 1}`,
      ...step,
    }))
  }

  if ((parsed.mode === 'chat' || parsed.mode === 'clarify') && typeof parsed.message !== 'string') {
    return null
  }

  return parsed
}

function parseFilePath(filePath = '') {
  const normalized = String(filePath).replace(/\\/g, '/')
  const name = normalized.split('/').pop() || ''
  const dot = name.lastIndexOf('.')
  return {
    name,
    base: dot > 0 ? name.slice(0, dot) : name,
    ext: dot > 0 ? name.slice(dot + 1) : '',
  }
}

function fillTemplate(template = '', values = {}) {
  return Object.entries(values).reduce((result, [key, value]) => (
    result.split(`{${key}}`).join(String(value))
  ), template)
}

function expandBatchSteps(workflow) {
  const steps = []
  let nextId = 1

  for (const step of workflow.steps ?? []) {
    if (step.type !== 'batch_shell') {
      steps.push({ ...step, id: nextId++ })
      continue
    }

    const inputPaths = Array.isArray(step.input_paths) ? step.input_paths : []
    inputPaths.forEach(inputPath => {
      const file = parseFilePath(inputPath)
      const output = fillTemplate(step.output_template || `{base}_output.{ext}`, {
        input: inputPath,
        output: '',
        name: file.name,
        base: file.base,
        ext: file.ext,
      })

      steps.push({
        id: nextId++,
        type: 'shell',
        title: `${step.title || 'Process file'}: ${file.name}`,
        description: step.description || `Process ${file.name}`,
        command: fillTemplate(step.command_template || '', {
          input: inputPath,
          output,
          name: file.name,
          base: file.base,
          ext: file.ext,
        }),
        durationSec: step.durationSec ?? null,
      })
    })
  }

  return { ...workflow, steps }
}

function uniqueFiles(files = []) {
  const seen = new Set()
  return files.filter(file => {
    if (!file?.path || seen.has(file.path)) return false
    seen.add(file.path)
    return true
  })
}

function getRequestedFiles(text, projectFiles = [], attachedFileNames = []) {
  const attached = attachedFileNames
    .map(name => projectFiles.find(file => file.name === name))
    .filter(Boolean)

  return uniqueFiles([...attached, ...extractMentionedFiles(text, projectFiles)])
}

function joinOutputPath(outputDir, fileName) {
  return `${outputDir.replace(/[\\/]$/, '')}\\${fileName}`
}

function quotePath(filePath) {
  return `"${String(filePath).replace(/"/g, '\\"')}"`
}

function buildLocalWorkflow(text, projectFiles, attachedFileNames, outputDir) {
  const lower = text.toLowerCase()
  const wantsWebp = /\b(to|into|as)\s+webp\b/.test(lower) || /\bconvert\b[\s\S]*\bwebp\b/.test(lower)
  if (!wantsWebp) return null

  const files = getRequestedFiles(text, projectFiles, attachedFileNames)
    .filter(file => IMAGE_EXTS.has(file.ext))

  if (files.length === 0) return null

  let finalOutput = null
  const steps = files.map((file, index) => {
    const parsed = parseFilePath(file.path)
    const outputName = parsed.ext === 'webp' ? `${parsed.base}_converted.webp` : `${parsed.base}.webp`
    const outputPath = joinOutputPath(outputDir, outputName)
    finalOutput = outputPath
    return {
      id: index + 1,
      type: 'shell',
      title: `Convert ${file.name} to WebP`,
      description: `Create ${outputName}`,
      command: `ffmpeg -y -i ${quotePath(file.path)} ${quotePath(outputPath)}`,
      durationSec: null,
    }
  })

  return {
    mode: 'workflow',
    message: `Convert ${files.length} image${files.length === 1 ? '' : 's'} to WebP.`,
    steps,
    final_output: finalOutput,
  }
}

function buildRequestMessages(systemPrompt, history) {
  const cleanHistory = history.filter(message => {
    if (message.role === 'user') return true
    if (message.role !== 'assistant') return false
    return !!normalizeAIResponse(parseAIResponse(message.content ?? ''))
  })
  return [{ role: 'system', content: systemPrompt }, ...cleanHistory.slice(-CHAT_HISTORY_LIMIT)]
}

function normalizeTitle(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.?!,:;\-\s]+$/g, '')
    .trim()
}

function looksGeneric(text) {
  const normalized = normalizeTitle(text).toLowerCase()
  if (!normalized) return true
  if (GENERIC_OPENERS.has(normalized)) return true
  return normalized.split(' ').length === 1 && normalized.length < 5
}

function shortenTitle(text) {
  const normalized = normalizeTitle(text)
  if (normalized.length <= MAX_CHAT_TITLE_LENGTH) return normalized
  return `${normalized.slice(0, MAX_CHAT_TITLE_LENGTH - 1).trimEnd()}...`
}

function deriveChatTitle(messages, existingTitle = '') {
  if (existingTitle && !looksGeneric(existingTitle) && existingTitle !== 'New chat') {
    return existingTitle
  }

  const userTexts = messages
    .filter(msg => msg.role === 'user' && msg.type === 'text')
    .map(msg => normalizeTitle(msg.content))
    .filter(Boolean)

  const preferred = userTexts.find(text => !looksGeneric(text) && text.length >= 8)
  if (preferred) return shortenTitle(preferred)

  const fallback = userTexts.find(text => !looksGeneric(text)) || userTexts.find(Boolean)
  if (fallback) return shortenTitle(fallback)

  return 'New chat'
}

function extractMentionedFiles(text, projectFiles) {
  const lowerText = text.toLowerCase()
  return projectFiles.filter(file => {
    const lowerName = file.name.toLowerCase()
    return lowerText.includes(`@${lowerName}`) || lowerText.includes(`@[${lowerName}]`)
  })
}

function buildFileBlock(activeFile, probeData, projectFiles = [], inputText = '', attachedFileNames = []) {
  let block = ''
  const usedPaths = new Set()

  // Show detailed probe data ONLY when no batch files are attached (saves tokens)
  if (attachedFileNames.length === 0 && activeFile && probeData && !probeData.error) {
    block += `## Active File\nPath: ${probeData.file}\nFormat: ${probeData.format?.format_name}\nDuration: ${probeData.format?.duration_sec}s\nStreams:\n${JSON.stringify(probeData.streams, null, 2)}\n\n`
    usedPaths.add(activeFile.path)
  } else if (attachedFileNames.length === 0 && activeFile) {
    block += `## Active File\nPath: ${activeFile.path}\nName: ${activeFile.name}\nSize: ${activeFile.size}\n\n`
    usedPaths.add(activeFile.path)
  }

  // Include ALL explicitly attached files with their full paths
  const attachedFiles = attachedFileNames
    .map(name => projectFiles.find(f => f.name === name))
    .filter(Boolean)
    .filter(file => !usedPaths.has(file.path))

  if (attachedFiles.length > 0) {
    block += `## Attached Files (${attachedFiles.length})\n`
    block += attachedFiles.map(file => `- ${file.name}  [${file.ext}, ${file.size}]  path: ${file.path}`).join('\n') + '\n'
    attachedFiles.forEach(f => usedPaths.add(f.path))
  }

  // Also pick up any inline @mentions from the message text
  const extraFiles = extractMentionedFiles(inputText, projectFiles)
    .filter(file => !usedPaths.has(file.path))
    .slice(0, Math.max(0, MAX_CONTEXT_FILES - usedPaths.size))

  if (extraFiles.length > 0) {
    block += '## Mentioned Files\n'
    block += extraFiles.map(file => `- ${file.name}  [${file.ext}, ${file.size}]  path: ${file.path}`).join('\n')
  }

  return block || '## No file loaded'
}

async function buildTextFileContextBlock(projectDir, inputText, projectFiles = [], attachedFileNames = []) {
  const files = getRequestedFiles(inputText, projectFiles, attachedFileNames)
    .filter(file => TEXT_CONTEXT_EXTS.has(String(file.ext).toLowerCase()))
    .slice(0, 3)

  if (files.length === 0) return ''

  const sections = []
  let remainingChars = MAX_TEXT_CONTEXT_CHARS

  for (const file of files) {
    if (remainingChars <= 0) break

    try {
      const result = await window.electron.agent.readText(projectDir, file.path)
      if (!result?.ok || typeof result.content !== 'string') {
        sections.push(`### ${file.name}\nCould not read file: ${result?.message || 'Unknown error'}`)
        continue
      }

      const content = result.content.slice(0, remainingChars)
      remainingChars -= content.length
      const truncated = result.content.length > content.length
        ? `\n\n[Truncated after ${content.length} characters to keep the request manageable.]`
        : ''

      sections.push(`### ${file.name}\nPath: ${file.path}\n\n${content}${truncated}`)
    } catch (err) {
      sections.push(`### ${file.name}\nCould not read file: ${err.message}`)
    }
  }

  return sections.length > 0
    ? `## Text File Contents\n${sections.join('\n\n')}`
    : ''
}

function buildCompletionSummary(workflow) {
  const lines = ['Done! Here\'s what was executed:']
  lines.push('')
  workflow.steps.slice(0, 6).forEach((step, index) => {
    lines.push(`${index + 1}. ${step.title}`)
  })
  if (workflow.steps.length > 6) {
    lines.push(`+ ${workflow.steps.length - 6} more step(s)`)
  }
  if (workflow.final_output) {
    const fname = String(workflow.final_output).replace(/\\/g, '/').split('/').pop()
    lines.push('')
    lines.push(`Output: **${fname}**`)
  }
  return lines.join('\n')
}

function parseAPIError(err, providerId) {
  const msg = err.message ?? ''
  const status = err.status ?? 0
  const lower = msg.toLowerCase()
  const label = { groq: 'Groq', openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Google Gemini', openrouter: 'OpenRouter', ollama: 'Ollama' }[providerId] ?? providerId
  const withDetails = (fallback) => msg && msg !== `HTTP ${status}` ? msg : fallback

  if (status === 401 || lower.includes('invalid api key') || lower.includes('authentication')) {
    return { type: 'auth', title: 'Invalid API key', body: withDetails(`Your ${label} API key was rejected. Check it in Settings.`) }
  }
  if (status === 429 || lower.includes('rate limit')) {
    const fallback = providerId === 'gemini'
      ? 'Google Gemini throttled this request. Free tier can still work, but Google may temporarily limit a model, project, or token budget. Try again shortly, switch to gemini-2.5-flash-lite or gemini-2.0-flash, or lower max tokens in Settings.'
      : `Too many requests from ${label}. Wait a moment and try again.`
    return { type: 'rate_limit', title: 'Rate limit hit', body: withDetails(fallback) }
  }
  if ((lower.includes('token') && (lower.includes('limit') || lower.includes('exceed'))) || lower.includes('context length')) {
    return { type: 'tokens', title: 'Token limit reached', body: withDetails('This conversation is too long. Start a new session or use a model with a larger context window.') }
  }
  if (lower.includes('quota') || lower.includes('billing')) {
    return { type: 'quota', title: 'API quota exceeded', body: withDetails(`You've run out of credits on ${label}. Check your billing dashboard.`) }
  }
  if (lower.includes('model') && (lower.includes('not found') || lower.includes('does not exist'))) {
    return { type: 'model', title: 'Model not found', body: withDetails('The model name you entered does not exist. Check it in Settings.') }
  }
  if (status === 503 || lower.includes('unavailable') || lower.includes('overloaded')) {
    return { type: 'server', title: 'Provider unavailable', body: withDetails(`${label} is currently down or overloaded. Try again shortly.`) }
  }
  if (lower.includes('econnrefused') || lower.includes('failed to fetch') || status === 0) {
    return { type: 'network', title: 'Connection failed', body: withDetails(providerId === 'ollama' ? 'Cannot reach Ollama. Make sure it is running locally.' : 'Network error - check your internet connection.') }
  }
  return { type: 'unknown', title: 'Something went wrong', body: msg || 'An unexpected error occurred.' }
}

function buildWorkflowContext(state) {
  if (!state?.status) return ''

  if (state.status === 'failed') {
    return `## Latest Workflow Result\nStatus: failed\nSummary: ${state.message}`
  }
  if (state.status === 'completed') {
    return `## Latest Workflow Result\nStatus: completed\nSummary: ${state.message}`
  }
  if (state.status === 'running' || state.status === 'pending') {
    return `## Latest Workflow Result\nStatus: ${state.status}\nSummary: ${state.message}`
  }

  return ''
}

function buildConversationMemory(history, outputFiles = [], workflowState = null) {
  const lines = ['## CONVERSATION MEMORY']
  const recent = history.slice(-CHAT_HISTORY_LIMIT)

  const userTurns = recent
    .filter(m => m.role === 'user')
    .slice(-4)
    .map(m => m.content?.slice(0, 180))
    .filter(Boolean)

  if (userTurns.length > 0) {
    lines.push('Recent user requests (oldest first):')
    userTurns.forEach((text, i) => lines.push(`  ${i + 1}. ${text}`))
  }

  const lastAssistant = [...recent].reverse().find(m => m.role === 'assistant')
  if (lastAssistant?.content) {
    const snippet = lastAssistant.content.slice(0, 300)
    lines.push(`Last assistant response (snippet): ${snippet}`)
  }

  if (outputFiles.length > 0) {
    lines.push('Recent output files (newest first):')
    outputFiles.slice(0, 6).forEach(f => {
      lines.push(`  - ${f.name} [${f.ext}, ${f.size}] path: ${f.path}`)
    })
  }

  const wf = buildWorkflowContext(workflowState)
  if (wf) lines.push(wf)

  return lines.join('\n')
}

function pushAssistantHistory(historyRef, content) {
  historyRef.current = [...historyRef.current, { role: 'assistant', content }]
}

export default function ChatPanel({
  project,
  activeFile,
  toolsBlock,
  probeData,
  projectFiles = [],
  outputFiles = [],
  onTaskUpdate,
  onSessionId,
  activeChatId,
  onMentionReady,
  onChatSaved,
  onWorkflowComplete,
  attachedFiles = [],
  onClearAttachments,
  onMentionFiles,
  onPendingWorkflow,
}) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false)
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [editingSourceMessage, setEditingSourceMessage] = useState(null)

  const historyRef = useRef([])
  const lastInputRef = useRef('')
  const inputRef = useRef(null)
  const mediaPickerRef = useRef(null)
  const attachImageBtnRef = useRef(null)
  const endRef = useRef(null)
  const saveChatTimer = useRef(null)
  const currentChatId = useRef(null)
  const currentTitleRef = useRef('New chat')
  const pendingWorkflowRef = useRef(null)
  const pendingSessionIdRef = useRef(null)
  const workflowStateRef = useRef(null)
  const currentWorkflowRef = useRef(null)
  const currentSessionIdRef = useRef(null)
  const aiAbortRef = useRef(null)
  const streamMsgIdRef = useRef(null)
  const { isActiveReady } = useSecureKeys()
  const config = settingsStore.getActiveConfig()
  const imageLibraryFiles = projectFiles.filter(file => IMAGE_EXTS.has(file.ext))

  function resizeInput() {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 156)}px`
  }

  useEffect(() => {
    onMentionReady?.(insertMention)
  }, [onMentionReady])

  useEffect(() => {
    resizeInput()
  }, [input])

  function insertMention(filename) {
    setInput(prev => {
      const tag = `@[${filename}]`
      return prev.trim() ? `${prev.trim()} ${tag} ` : `${tag} `
    })
    setTimeout(() => {
      inputRef.current?.focus()
      resizeInput()
    }, 0)
  }

  useEffect(() => {
    if (!project || !activeChatId) return
    if (currentChatId.current === activeChatId) return

    setMessages([])
    setInput('')
    setApiError(null)
    historyRef.current = []
    currentChatId.current = activeChatId
    currentTitleRef.current = 'New chat'
    pendingWorkflowRef.current = null
    pendingSessionIdRef.current = null
    workflowStateRef.current = null
    currentWorkflowRef.current = null
    currentSessionIdRef.current = null
    aiAbortRef.current?.abort()
    aiAbortRef.current = null

    window.electron.chat.load(project.folderPath, activeChatId).then(chat => {
      if (!chat) return
      if (currentChatId.current !== activeChatId) return
      setMessages(chat.messages ?? [])
      historyRef.current = chat.history ?? []
      currentTitleRef.current = chat.title || 'New chat'
    })
  }, [activeChatId, project])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => clearTimeout(saveChatTimer.current)
  }, [])

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!showMediaPicker) return
      const target = event.target
      const clickedInsidePicker = mediaPickerRef.current?.contains(target)
      const clickedAttachBtn = attachImageBtnRef.current?.contains(target)
      if (!clickedInsidePicker && !clickedAttachBtn) {
        setShowMediaPicker(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showMediaPicker])

  function persistChat(msgs, hist, chatId) {
    if (!project || !chatId) return
    clearTimeout(saveChatTimer.current)
    saveChatTimer.current = setTimeout(async () => {
      const title = deriveChatTitle(msgs, currentTitleRef.current)
      currentTitleRef.current = title

      await window.electron.chat.save(project.folderPath, {
        id: chatId,
        title,
        messages: msgs,
        history: hist,
      })

      onChatSaved?.()
    }, 600)
  }

  function addAiMessage(content, remember = false) {
    if (remember) pushAssistantHistory(historyRef, content)
    setMessages(prev => {
      const next = [...prev, { id: Date.now(), role: 'ai', type: 'text', content }]
      persistChat(next, historyRef.current, currentChatId.current)
      return next
    })
  }

  async function queueWorkflowForConfirmation(workflow, sid) {
    await window.electron.prepareWorkflow({
      workflow,
      sessionId: sid,
      projectDir: project.folderPath,
      userGoal: lastInputRef.current,
      mediaFiles: getRequestedFiles(lastInputRef.current, projectFiles, attachedFiles).map(file => file.path),
    })

    const currentSettings = settingsStore.get()
    if (currentSettings.autoApproveWorkflows) {
      startWorkflowExecution(workflow, sid)
      return
    }

    pendingWorkflowRef.current = workflow
    pendingSessionIdRef.current = sid
    workflowStateRef.current = {
      status: 'pending',
      message: workflow.message || 'Workflow drafted and waiting for confirmation.',
    }
    onSessionId?.(sid)
    // Expose the pending steps to the ExecutionBar session panel
    onPendingWorkflow?.(workflow)
    // Show inline approval card instead of a text prompt
    setMessages(prev => {
      const card = { id: Date.now() + 2, role: 'ai', type: 'approval', workflow }
      const next = [...prev, card]
      return next
    })
  }

  function startWorkflowExecution(workflow, sid) {
    currentWorkflowRef.current = workflow
    currentSessionIdRef.current = sid
    workflowStateRef.current = {
      status: 'running',
      message: workflow.message || 'Workflow is running.',
    }
    // Clear pending workflow from sidebar now that it's running
    onPendingWorkflow?.(null)

    const logSteps = workflow.steps.map(step => ({
      id: step.id,
      label: step.title,
      cmd: step.command,
      status: 'waiting',
      pct: 0,
    }))

    // Use the AI's workflow message as the task name in the ExecutionBar
    const taskName = workflow.message || lastInputRef.current
    onTaskUpdate?.(prev => [...prev, {
      id: Date.now(),
      goal: taskName,
      status: 'running',
      steps: logSteps,
    }])

    onSessionId?.(sid)
    pushAssistantHistory(historyRef, `Workflow started. ${workflow.message || ''}`.trim())

    const cfg = settingsStore.getActiveConfig()
    window.electron.runWorkflow({
      workflow,
      sessionId: sid,
      projectDir: project.folderPath,
      model: cfg.model,
      providerId: cfg.providerId,
      baseUrl: cfg.baseUrl,
      maxTokens: cfg.maxTokens,
      temperature: cfg.temperature,
    })
  }

  async function handleStop() {
    aiAbortRef.current?.abort()
    aiAbortRef.current = null

    const sid = currentSessionIdRef.current || pendingSessionIdRef.current
    if (sid) {
      await window.electron.cancelWorkflow?.(sid)
    }

    pendingWorkflowRef.current = null
    pendingSessionIdRef.current = null
    currentSessionIdRef.current = null
    setLoading(false)
    setMessages(prev => prev.filter(message => message.type !== 'thinking'))
    addAiMessage('Stopped.')
  }

  useEffect(() => {
    const u1 = window.electron.onStepUpdate(({ stepId, status, pct }) => {
      onTaskUpdate?.(prev => prev.map(task => {
        if (!task.steps?.find(step => step.id === stepId)) return task
        const steps = task.steps.map(step => step.id === stepId ? { ...step, status, pct } : step)
        return { ...task, steps }
      }))
    })

    const u2 = window.electron.onStepDone(({ stepId, success, message }) => {
      onTaskUpdate?.(prev => prev.map(task => {
        if (!task.steps?.find(step => step.id === stepId)) return task
        const steps = task.steps.map(step =>
          step.id === stepId ? { ...step, status: success ? 'done' : 'failed', pct: success ? 100 : step.pct } : step
        )
        return { ...task, steps }
      }))

      if (!success) {
        const failedStep = currentWorkflowRef.current?.steps?.find(step => step.id === stepId)
        workflowStateRef.current = {
          status: 'failed',
          message: message || `Step "${failedStep?.title || stepId}" failed.`,
        }
      }
    })

    const u3 = window.electron.onWorkflowDone(({ success, message, aiReply }) => {
      setLoading(false)
      currentSessionIdRef.current = null
      onTaskUpdate?.(prev => prev.map((task, index) =>
        index === prev.length - 1 ? { ...task, status: success ? 'done' : 'failed' } : task
      ))

      if (success) {
        workflowStateRef.current = {
          status: 'completed',
          message: 'The last workflow completed successfully.',
        }
        onWorkflowComplete?.()

        // Use AI-composed reply if available, otherwise fall back
        const reply = (aiReply && message)
          ? message
          : currentWorkflowRef.current
            ? buildCompletionSummary(currentWorkflowRef.current)
            : 'All done! Check the output files tab.'

        addAiMessage(reply)
      } else {
        workflowStateRef.current = {
          status: 'failed',
          message: message || 'The last workflow failed.',
        }
        // Use AI-composed failure explanation if available
        const reply = (aiReply && message)
          ? message
          : message || 'Task failed. Check the session log for details.'

        addAiMessage(reply)
      }
    })

    return () => {
      u1?.()
      u2?.()
      u3?.()
    }
  }, [onTaskUpdate])

  function handleApprove() {
    const workflow = pendingWorkflowRef.current
    if (!workflow) return
    const sid = pendingSessionIdRef.current || new Date().toISOString().replace(/[:.]/g, '-')
    pendingWorkflowRef.current = null
    pendingSessionIdRef.current = null
    // Remove the approval card from messages
    setMessages(prev => prev.filter(m => m.type !== 'approval'))
    setLoading(true)
    startWorkflowExecution(workflow, sid)
  }

  function handleDismiss() {
    pendingWorkflowRef.current = null
    pendingSessionIdRef.current = null
    onPendingWorkflow?.(null)
    setMessages(prev => prev.filter(m => m.type !== 'approval'))
    addAiMessage('Workflow dismissed. Let me know if you\'d like to try something different.')
  }

  function toggleAttachLibraryFile(fileName) {
    if (attachedFiles.includes(fileName)) {
      onClearAttachments?.(attachedFiles.filter(name => name !== fileName))
      return
    }
    onMentionFiles?.([fileName])
  }

  function beginEditPrompt(msg) {
    setEditingSourceMessage(msg.id)
    setInput(msg.content || '')
    setShowMediaPicker(false)
    setTimeout(() => {
      inputRef.current?.focus()
      resizeInput()
    }, 0)
  }

  async function redoPrompt(msg) {
    setEditingSourceMessage(null)
    setShowMediaPicker(false)
    await handleSend(msg.content || '')
  }

  async function handleSend(promptOverride = null) {
    const overrideText = typeof promptOverride === 'string' ? promptOverride : null
    const text = (overrideText ?? inputRef.current?.value ?? input).trim()
    if ((!text && attachedFiles.length === 0) || loading) return

    if (!config.isLocal && !isActiveReady) {
      setApiError({ type: 'auth', title: 'No API key', body: `Add your ${config.label} API key in Settings.` })
      return
    }
    if (!config.model?.trim()) {
      setApiError({ type: 'model', title: 'No model', body: `Enter a model name for ${config.label} in Settings.` })
      return
    }

    setApiError(null)

    let fullText
    if (attachedFiles.length === 0) {
      fullText = text
    } else if (attachedFiles.length <= 10) {
      const mentionTags = attachedFiles.map(name => `@[${name}]`).join(' ')
      fullText = text ? `${mentionTags} ${text}`.trim() : mentionTags
    } else {
      fullText = text ? `Process ${attachedFiles.length} attached files: ${text}` : `Process ${attachedFiles.length} attached files`
    }
    lastInputRef.current = fullText
    if (promptOverride === null) {
      setInput('')
    }
    setEditingSourceMessage(null)
    onClearAttachments?.()

    const imageAttachments = attachedFiles.filter(name => {
      const ext = name.split('.').pop().toLowerCase()
      return IMAGE_EXTS.has(ext)
    })

    let imageBlocks = []
    if (imageAttachments.length > 0) {
      const imagePaths = imageAttachments
        .map(name => projectFiles.find(f => f.name === name))
        .filter(Boolean)
        .map(f => f.path)

      try {
        const results = await window.electron.readFilesBase64(imagePaths)
        imageBlocks = results
          .filter(result => result.ok)
          .map(result => ({
            type: 'image',
            source: { type: 'base64', media_type: result.mediaType, data: result.base64 },
          }))
      } catch (err) {
        console.warn('Failed to read image files:', err)
      }
    }

    const userMsg = { id: Date.now(), role: 'user', type: 'text', content: fullText }
    const nextMsgs = [...messages, userMsg]
    setMessages(nextMsgs)

    historyRef.current = [...historyRef.current, { role: 'user', content: fullText }]
    persistChat(nextMsgs, historyRef.current, currentChatId.current)

    pendingWorkflowRef.current = null

    setLoading(true)
    const thinkingId = Date.now() + 1
    setMessages(prev => [...prev, { id: thinkingId, role: 'ai', type: 'thinking' }])

    try {
      const sid = new Date().toISOString().replace(/[:.]/g, '-')
      const paths = await window.electron.getSessionPath({
        sessionId: sid,
        projectDir: project.folderPath,
      })

      const localWorkflow = buildLocalWorkflow(fullText, projectFiles, attachedFiles, paths.outputDir)
      if (localWorkflow) {
        setMessages(prev => prev.filter(message => message.id !== thinkingId))
        await queueWorkflowForConfirmation(localWorkflow, sid)
        setLoading(false)
        return
      }

      const memoryBlock = buildConversationMemory(
        historyRef.current,
        outputFiles,
        workflowStateRef.current,
      )

      const textFileContextBlock = await buildTextFileContextBlock(
        project.folderPath,
        fullText,
        projectFiles,
        attachedFiles,
      )

      const systemPrompt = buildSystemPrompt(
        toolsBlock ?? '## Tools\nffmpeg available\nffprobe available',
        [
          buildFileBlock(activeFile, probeData, projectFiles, fullText, attachedFiles),
          textFileContextBlock,
        ].filter(Boolean).join('\n\n'),
        buildProjectStateBlock(projectFiles, outputFiles, project?.folderPath, attachedFiles),
        paths.outputDir,
        memoryBlock,
        buildWorkflowContext(workflowStateRef.current),
      )

      const requestMessages = buildRequestMessages(systemPrompt, historyRef.current)
      let messagesForAI = requestMessages
      if (imageBlocks.length > 0) {
        const withoutLast = requestMessages.slice(0, -1)
        const lastMsg = requestMessages[requestMessages.length - 1]
        messagesForAI = [
          ...withoutLast,
          {
            role: 'user',
            content: [
              ...imageBlocks,
              { type: 'text', text: lastMsg.content },
            ],
          },
        ]
      }

      aiAbortRef.current = new AbortController()

      const streamId = thinkingId
      streamMsgIdRef.current = streamId
      setMessages(prev => prev.map(m =>
        m.id === thinkingId ? { ...m, type: 'streaming', content: '' } : m,
      ))

      const raw = await streamChat(messagesForAI, {
        signal: aiAbortRef.current.signal,
        onDelta: (delta) => {
          setMessages(prev => prev.map(m =>
            m.id === streamId ? { ...m, content: (m.content || '') + delta } : m,
          ))
        },
      })

      aiAbortRef.current = null
      streamMsgIdRef.current = null
      setMessages(prev => prev.filter(message => message.id !== thinkingId && message.type !== 'streaming'))

      let parsed = normalizeAIResponse(parseAIResponse(raw))
      let responseForHistory = raw

      // -- Auto-retry if the response isn't valid JSON --------------------------
      if (!parsed) {
        const fixMessages = [
          ...messagesForAI,
          { role: 'assistant', content: raw },
          {
            role: 'user',
            content:
              'Your last response was not valid JSON. You MUST respond with ONLY a raw JSON object -- ' +
              'no markdown fences, no explanation, no text before or after the JSON. ' +
              'If you said you would read or inspect a file, stop narrating and instead use the provided file context. ' +
              'For analysis reports or exported notes, return a workflow with a write step containing the final text. ' +
              'Try again now.',
          },
        ]
        try {
          aiAbortRef.current = new AbortController()
          const raw2 = await completeChat(fixMessages, { retries: 1 })
          aiAbortRef.current = null
          parsed = normalizeAIResponse(parseAIResponse(raw2))
          if (parsed) responseForHistory = raw2
        } catch (_) {
          // retry failed -- fall through to the error below
        }
      }

      if (!parsed) {
        const trimmedResponse = responseForHistory.trim()
        const narratedToolUse = /\b(let me|i(?:'ll| will| need to| can)?)\s+(read|inspect|open|check|analy[sz]e)\b/i.test(trimmedResponse)
        if (trimmedResponse && !narratedToolUse) {
          parsed = { mode: 'chat', message: responseForHistory.trim() }
        } else {
          addAiMessage('The model answered with narration instead of an executable plan. I need it to return JSON, such as a `write` step for a text report. Please send the prompt again; mentioned text and subtitle files are now included in the request context.', true)
          setLoading(false)
          return
        }
      }

      pushAssistantHistory(historyRef, responseForHistory)

      if (parsed.mode === 'chat' || parsed.mode === 'clarify') {
        addAiMessage(parsed.message)
        setLoading(false)
        return
      }

      if (parsed.mode === 'workflow') {
        const expandedWorkflow = expandBatchSteps(parsed)
        // Name the chat after the AI's workflow message on first real task
        if (currentTitleRef.current === 'New chat' || looksGeneric(currentTitleRef.current)) {
          const taskTitle = shortenTitle(expandedWorkflow.message || fullText)
          currentTitleRef.current = taskTitle
        }
        await queueWorkflowForConfirmation(expandedWorkflow, sid)
        setLoading(false)
        return
      }

      addAiMessage(parsed.message ?? raw)
      setLoading(false)
    } catch (err) {
      setMessages(prev => prev.filter(message =>
        message.id !== thinkingId && message.type !== 'streaming',
      ))
      aiAbortRef.current = null
      streamMsgIdRef.current = null
      if (!err.cancelled) {
        setApiError(parseAPIError(err, settingsStore.getActiveConfig().providerId))
      }
      setLoading(false)
    }
  }

  async function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      await handleSend()
    }
  }

  const isReady = config.isLocal || isActiveReady

  function applyPreset(prompt) {
    setInput(prompt)
    setTimeout(() => {
      inputRef.current?.focus()
      resizeInput()
    }, 0)
  }

  return (
    <div className="chat-panel">
      <div className="messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">+</div>
            <div className="chat-empty-text">What do you want to do?</div>
            <div className="chat-empty-sub">Describe an edit, ask a question, or mention a file with @</div>
            <div className="task-presets">
              {TASK_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  className="task-preset-chip"
                  disabled={!isReady || loading}
                  onClick={() => applyPreset(preset.prompt)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map(message => (
          message.type === 'approval'
            ? <ApprovalCard key={message.id} workflow={message.workflow} onAllow={handleApprove} onDismiss={handleDismiss} />
            : <Message
                key={message.id}
                msg={message}
                canEdit={message.role === 'user' && message.type === 'text' && !loading}
                onEdit={() => beginEditPrompt(message)}
                onRedo={() => redoPrompt(message)}
              />
        ))}
        <div ref={endRef} />
      </div>

      {apiError && (
        <div className={`chat-error error-${apiError.type}`}>
          <div className="error-body">
            <div className="error-title">{apiError.title}</div>
            <div className="error-msg">{apiError.body}</div>
          </div>
          <button className="error-close" onClick={() => setApiError(null)}>x</button>
        </div>
      )}

      {!isReady && (
        <div className="chat-gate">
          <div className="chat-gate-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6"/>
              <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="chat-gate-title">API key required</div>
          <div className="chat-gate-body">Go to <strong>Settings</strong> and add your {config.label} API key to start chatting.</div>
        </div>
      )}

      <div className={`chat-input-wrap ${!isReady ? 'chat-input-blocked' : ''}`}>
        {editingSourceMessage && (
          <div className="editing-banner">
            <span>Editing previous prompt. Sending will submit this as a new prompt.</span>
            <button onClick={() => setEditingSourceMessage(null)}>Cancel</button>
          </div>
        )}

        {showMediaPicker && (
          <div className="media-picker media-picker-slideup" ref={mediaPickerRef}>
            <div className="media-picker-title">Add image as context</div>
            {imageLibraryFiles.length === 0 && (
              <div className="media-picker-empty">No images in Media Library yet.</div>
            )}
            {imageLibraryFiles.length > 0 && imageLibraryFiles.map(file => {
              const selected = attachedFiles.includes(file.name)
              return (
                <button
                  key={file.path}
                  className={`media-picker-item ${selected ? 'selected' : ''}`}
                  type="button"
                  onClick={() => toggleAttachLibraryFile(file.name)}
                >
                  <img src={`atom://${file.path}`} alt="" />
                  <span>{file.name}</span>
                </button>
              )
            })}
          </div>
        )}

        {attachedFiles.length > 0 && (
          <div
            className="chat-attachments"
            onMouseEnter={() => setAttachmentsExpanded(true)}
            onMouseLeave={() => setAttachmentsExpanded(false)}
          >
            {(attachmentsExpanded || attachedFiles.length <= 3
              ? attachedFiles
              : attachedFiles.slice(0, 2)
            ).map(name => {
              const isImage = ['png','jpg','jpeg','webp','gif'].includes(name.split('.').pop().toLowerCase())
              const fileObj = isImage ? projectFiles.find(f => f.name === name) : null

              return (
                <span key={name} className={`attachment-chip ${isImage ? 'image-chip' : ''}`}>
                  {isImage && fileObj && (
                    <img
                      src={`atom://${fileObj.path}`}
                      className="chip-thumb"
                      alt=""
                    />
                  )}
                  {isImage ? '👁 ' : '@'}{name}
                  <button
                    className="attachment-remove"
                    onClick={() => onClearAttachments?.(attachedFiles.filter(n => n !== name))}
                    title="Remove"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                  </button>
                </span>
              )
            })}
            {!attachmentsExpanded && attachedFiles.length > 3 && (
              <span className="attachment-chip attachment-more">
                +{attachedFiles.length - 2} more
              </span>
            )}
          </div>
        )}
        <div className="chat-input-area">
          <button
            ref={attachImageBtnRef}
            className="attach-image-icon"
            type="button"
            disabled={!isReady || loading}
            onClick={() => setShowMediaPicker(prev => !prev)}
            title="Add image as context"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="9" cy="10" r="1.6" fill="currentColor" />
              <path d="M6 16l4-4 3 3 3-2 2 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder={isReady ? 'Describe an edit or ask anything...' : 'Add an API key in Settings to start...'}
            value={input}
            disabled={loading || !isReady}
            onChange={e => {
              setInput(e.target.value)
              resizeInput()
            }}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            type="button"
            className={`send-btn ${loading ? 'loading' : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={() => {
              if (loading) handleStop()
              else handleSend()
            }}
            title={loading ? 'Stop' : 'Send'}
            disabled={!isReady && !loading}
          >
            {loading ? <StopIcon /> : <SendIcon />}
          </button>
        </div>
        <div className="input-hint">Enter to send · Shift+Enter for new line · Use @ to mention files</div>
      </div>
    </div>
  )
}

function ApprovalCard({ workflow, onAllow, onDismiss }) {
  const [expanded, setExpanded] = useState(null)
  const steps = workflow?.steps ?? []

  function getStepCmd(step) {
    if (step.command) return step.command
    if (step.type === 'rename') return `rename  "${step.from}"  ->  "${step.to}"`
    if (step.type === 'delete') return `delete  "${step.path}"`
    if (step.type === 'move')   return `move  "${step.from}"  ->  "${step.to}"`
    if (step.type === 'write')  return `write  "${step.path}"`
    return null
  }

  return (
    <div className="approval-card">
      <div className="approval-header">
        <div className="approval-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
          </svg>
        </div>
        <div className="approval-title">Workflow ready</div>
        <span className="approval-step-count">{steps.length} step{steps.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="approval-summary">{workflow?.message || 'Ready to execute.'}</div>
      {steps.length > 0 && (
        <div className="approval-steps">
          {steps.map((step, i) => {
            const cmd = getStepCmd(step)
            const isOpen = expanded === i
            return (
              <div key={step.id ?? i} className={`approval-step ${cmd ? 'has-cmd' : ''} ${isOpen ? 'open' : ''}`}>
                <div
                  className="approval-step-header"
                  onClick={() => cmd && setExpanded(isOpen ? null : i)}
                  role={cmd ? 'button' : undefined}
                  title={cmd ? (isOpen ? 'Hide command' : 'Show command') : undefined}
                >
                  <span className="approval-step-num">{i + 1}</span>
                  <span className="approval-step-title">{step.title}</span>
                  {cmd && (
                    <svg
                      className={`approval-chevron ${isOpen ? 'up' : ''}`}
                      width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"
                    >
                      <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                {isOpen && cmd && (
                  <div className="approval-cmd">{cmd}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="approval-actions">
        <button className="approval-btn allow" onClick={onAllow}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Allow
        </button>
        <button className="approval-btn dismiss" onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  )
}

function Message({ msg, canEdit, onEdit, onRedo }) {
  if (msg.type === 'thinking') {
    return (
      <div className="msg ai">
        <div className="bubble">
          <div className="typing-dots"><span /><span /><span /></div>
        </div>
      </div>
    )
  }

  if (msg.type === 'streaming') {
    return (
      <div className="msg ai">
        <div className="bubble streaming">
          {msg.content ? <MessageContent content={msg.content} /> : (
            <div className="typing-dots"><span /><span /><span /></div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`msg ${msg.role}`}>
      <div className="bubble">
        <MessageContent content={msg.content} />
        {canEdit && (
          <div className="msg-actions">
            <button type="button" onClick={onEdit} title="Edit prompt">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 20h4l10-10-4-4L4 16v4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
              </svg>
            </button>
            <button type="button" onClick={onRedo} title="Redo prompt">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 12a8 8 0 1 1-2.34-5.66L20 9M20 4v5h-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function MessageContent({ content }) {
  const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
        if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="inline-code">{part.slice(1, -1)}</code>
        return <span key={index}>{part}</span>
      })}
    </>
  )
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 12V2M2 7l5-5 5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="4" y="4" width="6" height="6" rx="1.2" fill="white" />
    </svg>
  )
}
