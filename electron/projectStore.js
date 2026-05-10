import fs from 'fs'
import path from 'path'
import { app } from 'electron'

const PROJECTS_INDEX = path.join(app.getPath('userData'), 'projects.json')
const MEDIA_EXTS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm', '.mp3', '.wav', '.flac', '.aac', '.m4a', '.png', '.jpg', '.jpeg', '.webp', '.gif'])
const SKIP_DIRS = new Set(['chats', 'sessions'])

function loadIndex() {
  try {
    if (fs.existsSync(PROJECTS_INDEX)) return JSON.parse(fs.readFileSync(PROJECTS_INDEX, 'utf-8'))
  } catch (_) {}
  return { projects: [], lastProjectId: null }
}

function saveIndex(data) {
  fs.writeFileSync(PROJECTS_INDEX, JSON.stringify(data, null, 2), 'utf-8')
}

export function getAllProjects() {
  return loadIndex()
}

export function createProject({ name, folderPath }) {
  const id = `proj_${Date.now()}`
  const projectDir = path.join(folderPath, name.replace(/[^a-z0-9_-]/gi, '_'))
  
  // Create subdirectories
  fs.mkdirSync(path.join(projectDir, 'media'), { recursive: true })
  fs.mkdirSync(path.join(projectDir, 'output'), { recursive: true })
  fs.mkdirSync(path.join(projectDir, 'sessions'), { recursive: true })
  fs.mkdirSync(path.join(projectDir, 'chats'), { recursive: true })

  const project = {
    id,
    name,
    folderPath: projectDir,
    createdAt: new Date().toISOString(),
  }

  const index = loadIndex()
  index.projects.push(project)
  index.lastProjectId = id
  saveIndex(index)

  // Write project manifest inside folder
  fs.writeFileSync(
    path.join(projectDir, 'project.json'),
    JSON.stringify(project, null, 2),
    'utf-8'
  )

  return project
}

export function setLastProject(id) {
  const index = loadIndex()
  index.lastProjectId = id
  saveIndex(index)
}

function formatProjectFile(fullPath, stat) {
  const bytes = stat.size
  return {
    name: path.basename(fullPath),
    path: fullPath,
    ext: path.extname(fullPath).slice(1).toLowerCase(),
    size: bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`,
    addedAt: stat.birthtime.toISOString(),
  }
}

function walkProjectMedia(dir, { skipDirs = SKIP_DIRS } = {}) {
  if (!fs.existsSync(dir)) return []
  const results = []

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name.toLowerCase())) continue
      results.push(...walkProjectMedia(fullPath, { skipDirs }))
      continue
    }

    if (!MEDIA_EXTS.has(path.extname(entry.name).toLowerCase())) continue
    const stat = fs.statSync(fullPath)
    results.push(formatProjectFile(fullPath, stat))
  }

  return results
}

export function getProjectMedia(projectDir) {
  try {
    return walkProjectMedia(projectDir).sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

export function getProjectOutputs(projectDir) {
  try {
    const outputDir = path.join(projectDir, 'output')
    if (!fs.existsSync(outputDir)) return []
    return walkProjectMedia(outputDir, { skipDirs: new Set() })
      .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
  } catch {
    return []
  }
}

export function copyMediaToProject(sourcePath, projectDir) {
  const mediaDir  = path.join(projectDir, 'media')
  fs.mkdirSync(mediaDir, { recursive: true })
  const name = path.basename(sourcePath)
  const dest = path.join(mediaDir, name)
  // Avoid overwriting if same file
  if (!fs.existsSync(dest)) fs.copyFileSync(sourcePath, dest)
  const stat = fs.statSync(dest)
  const bytes = stat.size
  return {
    name,
    path: dest,
    ext:  path.extname(name).slice(1).toLowerCase(),
    size: bytes < 1024*1024
      ? `${(bytes/1024).toFixed(0)} KB`
      : `${(bytes/1024/1024).toFixed(1)} MB`,
    addedAt: stat.birthtime.toISOString(),
  }
}

export function deleteProjectMedia(projectDir, filePath) {
  try {
    const resolvedProjectDir = path.resolve(projectDir)
    const resolvedFilePath = path.resolve(filePath)

    if (!resolvedFilePath.startsWith(`${resolvedProjectDir}${path.sep}`)) {
      return { ok: false, message: 'Refused to delete a file outside this project.' }
    }
    if (!fs.existsSync(resolvedFilePath)) {
      return { ok: false, message: 'File not found.' }
    }

    const stat = fs.statSync(resolvedFilePath)
    if (!stat.isFile()) {
      return { ok: false, message: 'Only files can be deleted from the media library.' }
    }

    fs.unlinkSync(resolvedFilePath)
    return { ok: true }
  } catch (err) {
    return { ok: false, message: err.message || 'Failed to delete file.' }
  }
}

// ── Chat storage ───────────────────────────────────────────────────────────────

export function listChats(projectDir) {
  try {
    const chatsDir = path.join(projectDir, 'chats')
    if (!fs.existsSync(chatsDir)) return []
    return fs.readdirSync(chatsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(chatsDir, f), 'utf-8'))
          return { id: data.id, title: data.title, updatedAt: data.updatedAt, messageCount: data.messages?.length ?? 0 }
        } catch { return null }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
  } catch { return [] }
}

export function loadChat(projectDir, chatId) {
  try {
    const f = path.join(projectDir, 'chats', `${chatId}.json`)
    if (!fs.existsSync(f)) return null
    return JSON.parse(fs.readFileSync(f, 'utf-8'))
  } catch { return null }
}

export function saveChat(projectDir, chat) {
  const chatsDir = path.join(projectDir, 'chats')
  fs.mkdirSync(chatsDir, { recursive: true })
  chat.updatedAt = new Date().toISOString()
  fs.writeFileSync(path.join(chatsDir, `${chat.id}.json`), JSON.stringify(chat, null, 2), 'utf-8')
}

export function createChat(projectDir, title = 'New chat') {
  const chat = {
    id: `chat_${Date.now()}`,
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages:  [],   // display messages
    history:   [],   // AI API history
  }
  saveChat(projectDir, chat)
  return chat
}

export function deleteChat(projectDir, chatId) {
  try {
    const file = path.join(projectDir, 'chats', `${chatId}.json`)
    if (fs.existsSync(file)) fs.unlinkSync(file)
    return true
  } catch {
    return false
  }
}

// ── Agent file operations (sandboxed to projectDir) ───────────────────────────

function assertInsideProject(projectDir, filePath) {
  const base     = path.resolve(projectDir)
  const resolved = path.resolve(filePath)
  // Allow exact match (the root itself) or any path inside it
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`Path "${path.basename(resolved)}" is outside the project folder.`)
  }
  return resolved
}

export function listProjectDir(projectDir, subdir = '') {
  try {
    const target = subdir ? path.join(projectDir, subdir) : projectDir
    const resolved = assertInsideProject(projectDir, target)
    if (!fs.existsSync(resolved)) return { ok: true, files: [] }
    const entries = fs.readdirSync(resolved, { withFileTypes: true })
    return {
      ok: true,
      files: entries.map(e => {
        const full = path.join(resolved, e.name)
        let size = 0
        try { if (e.isFile()) size = fs.statSync(full).size } catch (_) {}
        return { name: e.name, isDir: e.isDirectory(), path: full, size }
      }),
    }
  } catch (err) {
    return { ok: false, message: err.message }
  }
}

export function renameProjectFile(projectDir, oldPath, newPath) {
  try {
    const from = assertInsideProject(projectDir, oldPath)
    const to   = assertInsideProject(projectDir, newPath)
    if (!fs.existsSync(from)) return { ok: false, message: `File not found: ${path.basename(from)}` }
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.renameSync(from, to)
    return { ok: true, path: to }
  } catch (err) {
    return { ok: false, message: err.message }
  }
}

export function moveProjectFile(projectDir, srcPath, destPath) {
  // move is just an alias for rename (works across dirs within the project)
  return renameProjectFile(projectDir, srcPath, destPath)
}

export function readProjectText(projectDir, filePath) {
  try {
    const resolved = assertInsideProject(projectDir, filePath)
    if (!fs.existsSync(resolved)) return { ok: false, message: 'File not found.' }
    return { ok: true, content: fs.readFileSync(resolved, 'utf-8') }
  } catch (err) {
    return { ok: false, message: err.message }
  }
}

export function writeProjectText(projectDir, filePath, content = '') {
  try {
    const resolved = assertInsideProject(projectDir, filePath)
    fs.mkdirSync(path.dirname(resolved), { recursive: true })
    fs.writeFileSync(resolved, content, 'utf-8')
    return { ok: true, path: resolved }
  } catch (err) {
    return { ok: false, message: err.message }
  }
}
