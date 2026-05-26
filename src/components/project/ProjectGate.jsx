import React, { useState, useEffect } from 'react'
import ConfirmDialog from '../ui/ConfirmDialog'
import './ProjectGate.css'
import logo from '../../assets/logo.png'
import { initBgAnimation } from '../../lib/bgAnimation'

export default function ProjectGate({ onProjectReady }) {
  const [screen,    setScreen]    = useState('loading') // loading | choose | create | new
  const [projects,  setProjects]  = useState([])
  const [name,      setName]      = useState('')
  const [folder,    setFolder]    = useState('')
  const [creating,  setCreating]  = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [error,     setError]     = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    window.electron.project.getAll().then(({ projects, lastProjectId }) => {
      setProjects(projects)
      if (projects.length === 0) {
        setScreen('create')
      } else {
        setScreen('choose')
      }
    })
  }, [])

  useEffect(() => {
    // Initialize background animation with accent color
    const accentRgb = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim()
    const cleanup = initBgAnimation('gate-bg-canvas', accentRgb)
    return () => {
      if (cleanup) cleanup()
    }
  }, [])

  async function handleChoosePath() {
    const p = await window.electron.project.choosePath()
    if (p) setFolder(p)
  }

  async function handleCreate() {
    if (!name.trim())   { setError('Enter a project name.'); return }
    if (!folder.trim()) { setError('Choose a folder location.'); return }
    setCreating(true)
    setError('')
    try {
      const project = await window.electron.project.create({ name: name.trim(), folderPath: folder })
      onProjectReady(project)
    } catch (e) {
      setError(e.message ?? 'Failed to create project.')
      setCreating(false)
    }
  }

  async function handleOpen(project) {
    await window.electron.project.setLast(project.id)
    onProjectReady(project)
  }

  async function handleDeleteConfirm() {
    const project = confirmDelete
    if (!project) return
    setConfirmDelete(null)
    setDeleting(true)
    setError('')
    try {
      const result = await window.electron.project.delete(project.id)
      if (!result?.ok) {
        setError(result?.message ?? 'Failed to delete project.')
        return
      }
      const remaining = projects.filter(p => p.id !== project.id)
      setProjects(remaining)
      if (remaining.length === 0) setScreen('create')
    } catch (e) {
      setError(e.message ?? 'Failed to delete project.')
    } finally {
      setDeleting(false)
    }
  }

  if (screen === 'loading') return (
    <div className="gate-overlay">
      <canvas id="gate-bg-canvas" />
      <div className="gate-spinner" />
    </div>
  )

  return (
    <div className="gate-overlay">
      <canvas id="gate-bg-canvas" />
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete project?"
        message={
          confirmDelete ? (
            <>
              &ldquo;{confirmDelete.name}&rdquo; will be removed from Vizio and all files in its
              folder will be permanently deleted.
              <br />
              <code className="gate-delete-path">{confirmDelete.folderPath}</code>
            </>
          ) : null
        }
        confirmLabel="Delete"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDelete(null)}
      />
      <div className="gate-card">
        <img src={logo} className="gate-logo-img" alt="Vizio" />

        {screen === 'choose' && (
          <>
            <div className="gate-title">Welcome back</div>
            <div className="gate-subtitle">Open a recent project or start a new one</div>

            {error && <div className="gate-error">{error}</div>}

            <div className="gate-projects">
              {projects.map(p => (
                <div key={p.id} className="gate-project-row">
                  <button
                    type="button"
                    className="gpr-open"
                    onClick={() => handleOpen(p)}
                    disabled={deleting}
                  >
                    <div className="gpr-icon">
                      <img src={logo} alt="" />
                    </div>
                    <div className="gpr-info">
                      <div className="gpr-name">{p.name}</div>
                      <div className="gpr-path">{p.folderPath}</div>
                    </div>
                    <div className="gpr-arrow">→</div>
                  </button>
                  <button
                    type="button"
                    className="gpr-delete"
                    title="Delete project"
                    aria-label={`Delete ${p.name}`}
                    disabled={deleting}
                    onClick={() => {
                      setError('')
                      setConfirmDelete(p)
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <button className="gate-new-btn" onClick={() => setScreen('create')}>
              + New project
            </button>
          </>
        )}

        {screen === 'create' && (
          <>
            <div className="gate-title">
              {projects.length === 0 ? 'Create your first project' : 'New project'}
            </div>
            <div className="gate-subtitle">All media, sessions and chats will be saved here</div>

            <div className="gate-form">
              <label className="gate-label">Project name</label>
              <input
                className="gate-input"
                placeholder="My Video Project"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />

              <label className="gate-label">Save location</label>
              <div className="gate-path-row">
                <input
                  className="gate-input path-input"
                  placeholder="Choose a folder…"
                  value={folder}
                  readOnly
                  onClick={handleChoosePath}
                />
                <button className="gate-browse-btn" onClick={handleChoosePath}>Browse</button>
              </div>

              {folder && name && (
                <div className="gate-preview-path">
                  Will create: <code>{folder}/{name.replace(/[^a-z0-9_-]/gi, '_')}/</code>
                </div>
              )}

              {error && <div className="gate-error">{error}</div>}

              <div className="gate-actions">
                {projects.length > 0 && (
                  <button className="gate-back-btn" onClick={() => setScreen('choose')}>
                    ← Back
                  </button>
                )}
                <button
                  className="gate-create-btn"
                  onClick={handleCreate}
                  disabled={creating}
                >
                  {creating ? 'Creating…' : 'Create project'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
