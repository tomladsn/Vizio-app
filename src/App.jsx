import React, { useState, useEffect, useRef } from 'react'
import ProjectGate  from './components/project/ProjectGate'
import MainPage    from './pages/MainPage'
import ToolsPage   from './pages/ToolsPage'
import SettingsPage from './pages/SettingsPage'
import MenuBar      from './components/layout/MenuBar'
import { settingsStore } from './store/settingsStore'
import './styles/globals.css'
import './App.css'

export default function App() {
  const [project,   setProject]   = useState(null)
  const [page,      setPage]      = useState('main')
  const [history,   setHistory]   = useState(['main'])
  const [histIdx,   setHistIdx]   = useState(0)

  // ── Lifted state — survives page navigation ──────────────────────────────
  const [tasks,     setTasks]     = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [activeChatId, setActiveChatId] = useState(null)

  const [settings, setSettings] = useState(settingsStore.get())

  // ── Global drag-and-drop ─────────────────────────────────────────────────
  const [globalDragging, setGlobalDragging] = useState(false)
  const [globalDropping, setGlobalDropping] = useState(false)
  const dragCounter   = useRef(0)
  const libraryReloadRef = useRef(null)   // set by MainPage

  useEffect(() => {
    function onDragEnter(e) {
      if (!e.dataTransfer?.types?.includes('Files')) return
      dragCounter.current++
      setGlobalDragging(true)
    }
    function onDragOver(e) {
      if (!e.dataTransfer?.types?.includes('Files')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
    function onDragLeave() {
      dragCounter.current--
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setGlobalDragging(false)
      }
    }
    async function onDrop(e) {
      e.preventDefault()
      dragCounter.current = 0
      setGlobalDragging(false)
      const dropped = Array.from(e.dataTransfer.files)
      if (!dropped.length || !project) return
      setGlobalDropping(true)
      for (const f of dropped) {
        await window.electron.project.copyMedia(f.path, project.folderPath)
      }
      setGlobalDropping(false)
      // Reload the library (works whether we're on main page or not)
      libraryReloadRef.current?.()
      // Make sure the main page is visible
      navigate('main')
    }
    document.addEventListener('dragenter', onDragEnter)
    document.addEventListener('dragover',  onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop',      onDrop)
    return () => {
      document.removeEventListener('dragenter', onDragEnter)
      document.removeEventListener('dragover',  onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop',      onDrop)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project])

  useEffect(() => settingsStore.subscribe(setSettings), [])

  useEffect(() => {
    document.documentElement.dataset.theme = settings.themeBase || 'dark'
    document.documentElement.dataset.accent = settings.themeAccent || 'green'
  }, [settings.themeBase, settings.themeAccent])

  function navigate(to) {
    if (to === page) return
    const next = [...history.slice(0, histIdx + 1), to]
    setHistory(next)
    setHistIdx(next.length - 1)
    setPage(to)
  }

  function goBack() {
    if (histIdx === 0) return
    const idx = histIdx - 1
    setHistIdx(idx); setPage(history[idx])
  }

  function goForward() {
    if (histIdx >= history.length - 1) return
    const idx = histIdx + 1
    setHistIdx(idx); setPage(history[idx])
  }

  // Show gate until a project is selected/created
  if (!project) return <ProjectGate onProjectReady={setProject} />

  return (
    <div className="app">
      <MenuBar
        activePage={page}
        onNavigate={navigate}
        canGoBack={histIdx > 0}
        canGoForward={histIdx < history.length - 1}
        onBack={goBack}
        onForward={goForward}
        projectName={project.name}
        onChangeProject={() => setProject(null)}
      />

      {/* Global drag-and-drop overlay */}
      {(globalDragging || globalDropping) && (
        <div className={`global-drop-overlay ${globalDropping ? 'dropping' : ''}`}>
          <div className="global-drop-card">
            <div className="global-drop-icon">
              {globalDropping ? (
                <div className="global-drop-spinner" />
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 4v12M8 12l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              )}
            </div>
            <div className="global-drop-title">
              {globalDropping ? 'Copying to library…' : 'Drop to add to library'}
            </div>
            {!globalDropping && (
              <div className="global-drop-sub">Files will be copied into your project</div>
            )}
          </div>
        </div>
      )}

      {/* Pages are always mounted — just hidden. State is preserved. */}
      <div className="app-body">
        <div style={{ display: page === 'main' ? 'contents' : 'none' }}>
          <MainPage
            project={project}
            tasks={tasks}
            onTaskUpdate={setTasks}
            sessionId={sessionId}
            onSessionId={setSessionId}
            activeChatId={activeChatId}
            onChatChange={setActiveChatId}
            onRegisterLibraryReload={fn => { libraryReloadRef.current = fn }}
          />
        </div>
        <div style={{ display: page === 'tools' ? 'contents' : 'none' }}>
          <ToolsPage />
        </div>
        <div style={{ display: page === 'settings' ? 'contents' : 'none' }}>
          <SettingsPage />
        </div>
      </div>
    </div>
  )
}
