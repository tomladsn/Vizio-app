import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BIN_DIR = path.join(__dirname, '..', 'resources', 'bin', process.platform)

const BINS = [
  { name: 'ffmpeg', flag: '-version' },
  { name: 'ffprobe', flag: '-version' },
  { name: 'ffplay', flag: '-version' },
  { name: 'yt-dlp', flag: '--version' },
]

console.log(`\nTesting bundled binaries in: ${BIN_DIR}\n`)
console.log('-'.repeat(60))

let allOk = true

for (const { name, flag } of BINS) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name
  const binPath = path.join(BIN_DIR, exe)

  if (!fs.existsSync(binPath)) {
    console.log(`[MISSING] ${name.padEnd(12)} not found at ${binPath}`)
    allOk = false
    continue
  }

  try {
    const out = execSync(`"${binPath}" ${flag} 2>&1`, { timeout: 5000 }).toString()
    const version = out.split('\n')[0].trim().slice(0, 70)
    const sizeKB = Math.round(fs.statSync(binPath).size / 1024)
    const size = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)}MB` : `${sizeKB}KB`

    console.log(`[OK]      ${name.padEnd(12)} ${version}`)
    console.log(`          path: ${binPath}`)
    console.log(`          size: ${size}`)
  } catch (err) {
    console.log(`[FAILED]  ${name.padEnd(12)} exists but failed to run: ${err.message.slice(0, 80)}`)
    allOk = false
  }

  console.log()
}

console.log('-'.repeat(60))
console.log(allOk
  ? '\nAll binaries ready. Safe to run dev or build.\n'
  : '\nSome binaries are missing or broken. Fix before building.\n'
)

process.exit(allOk ? 0 : 1)
