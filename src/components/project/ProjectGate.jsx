import React, { useState, useEffect } from 'react'
import './ProjectGate.css'

export default function ProjectGate({ onProjectReady }) {
  const [screen,    setScreen]    = useState('loading') // loading | choose | create | new
  const [projects,  setProjects]  = useState([])
  const [name,      setName]      = useState('')
  const [folder,    setFolder]    = useState('')
  const [creating,  setCreating]  = useState(false)
  const [error,     setError]     = useState('')

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

  if (screen === 'loading') return (
    <div className="gate-overlay">
      <div className="gate-spinner" />
    </div>
  )

  return (
    <div className="gate-overlay">
      <div className="gate-card">
        <img src="/src/assets/logo.png" className="gate-logo-img" alt="Visio" />

        {screen === 'choose' && (
          <>
            <div className="gate-title">Welcome back</div>
            <div className="gate-subtitle">Open a recent project or start a new one</div>

            <div className="gate-projects">
              {projects.map(p => (
                <button key={p.id} className="gate-project-row" onClick={() => handleOpen(p)}>
                  <div className="gpr-icon">V</div>
                  <div className="gpr-info">
                    <div className="gpr-name">{p.name}</div>
                    <div className="gpr-path">{p.folderPath}</div>
                  </div>
                  <div className="gpr-arrow">→</div>
                </button>
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
