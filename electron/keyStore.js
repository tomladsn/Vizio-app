import { app, safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'

const KEY_STORE_FILE = () => path.join(app.getPath('userData'), 'secure-keys.enc.json')

function loadEncryptedKeys() {
  try {
    const f = KEY_STORE_FILE()
    if (!fs.existsSync(f)) return {}
    return JSON.parse(fs.readFileSync(f, 'utf-8'))
  } catch {
    return {}
  }
}

function saveEncryptedKeys(store) {
  fs.writeFileSync(KEY_STORE_FILE(), JSON.stringify(store), 'utf-8')
}

export function setEncryptedKey(keyId, value) {
  if (!safeStorage.isEncryptionAvailable()) {
    return { ok: false, message: 'OS encryption is not available on this machine.' }
  }
  const store = loadEncryptedKeys()
  if (value === '' || value == null) {
    delete store[keyId]
  } else {
    store[keyId] = safeStorage.encryptString(value).toString('base64')
  }
  saveEncryptedKeys(store)
  return { ok: true }
}

export function deleteEncryptedKey(keyId) {
  const store = loadEncryptedKeys()
  delete store[keyId]
  saveEncryptedKeys(store)
  return { ok: true }
}

export function listEncryptedKeyIds() {
  return Object.keys(loadEncryptedKeys())
}

export function hasEncryptedKey(keyId) {
  const store = loadEncryptedKeys()
  return !!store[keyId]
}

export function getKeyHint(keyId) {
  try {
    const store = loadEncryptedKeys()
    if (!store[keyId]) return { exists: false, hint: '' }
    if (!safeStorage.isEncryptionAvailable()) return { exists: true, hint: '(encrypted)' }
    const plain = safeStorage.decryptString(Buffer.from(store[keyId], 'base64'))
    if (plain.length <= 8) return { exists: true, hint: '••••••••' }
    return { exists: true, hint: '••••••••' + plain.slice(-4) }
  } catch {
    return { exists: false, hint: '' }
  }
}

/** Decrypt key — main process only (never expose to renderer). */
export function getDecryptedKey(keyId) {
  try {
    const store = loadEncryptedKeys()
    if (!store[keyId]) return ''
    if (!safeStorage.isEncryptionAvailable()) return ''
    return safeStorage.decryptString(Buffer.from(store[keyId], 'base64'))
  } catch {
    return ''
  }
}

/** Import legacy plaintext keys from localStorage once. */
export function migrateLegacyKeys(legacyKeys = {}) {
  const migrated = []
  const skipped = []
  for (const [keyId, value] of Object.entries(legacyKeys)) {
    if (!value || typeof value !== 'string' || !value.trim()) continue
    if (hasEncryptedKey(keyId)) {
      skipped.push(keyId)
      continue
    }
    const res = setEncryptedKey(keyId, value.trim())
    if (res.ok) migrated.push(keyId)
  }
  return { migrated, skipped }
}

export function isEncryptionAvailable() {
  return safeStorage.isEncryptionAvailable()
}
