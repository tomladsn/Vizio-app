import React, { useState, useEffect, useRef } from 'react'
import ProjectGate  from './components/project/ProjectGate'
import MainPage    from './pages/MainPage'
import ToolsPage   from './pages/ToolsPage'
import SettingsPage from './pages/SettingsPage'
import NodePage     from './pages/NodePage'
import MenuBar      from './components/layout/MenuBar'
import { settingsStore, collectLegacyApiKeys } from './store/settingsStore'
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
  const [scannedTools, setScannedTools] = useState([])
  const [toolsBlock, setToolsBlock] = useState('')
  const [toolsScanning, setToolsScanning] = useState(true)

  // ── Global drag-and-drop ─────────────────────────────────────────────────
  const [globalDragging, setGlobalDragging] = useState(false)
  const [globalDropping, setGlobalDropping] = useState(false)
  const dragCounter   = useRef(0)
  const libraryReloadRef = useRef(null)   // set by MainPage

  useEffect(() => {
    let cancelled = false

    async function migrateLegacyKeys() {
      const legacyKeys = collectLegacyApiKeys()
      if (Object.keys(legacyKeys).length === 0) return
      await window.electron.keys.migrate(legacyKeys)
      const cleaned = settingsStore.get()
      settingsStore.save(cleaned)
      settingsStore.notifyKeysUpdated()
    }

    async function scanToolsInBackground() {
      setToolsScanning(true)
      try {
        const { tools, block } = await window.electron.scanTools()
        if (cancelled) return
        setScannedTools(tools)
        setToolsBlock(block)
      } catch (e) {
        console.error('Scan failed', e)
      } finally {
        if (!cancelled) setToolsScanning(false)
      }
    }

    migrateLegacyKeys().catch(e => console.error('Key migration failed', e))
    scanToolsInBackground()
    return () => { cancelled = true }
  }, [])

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
    document.documentElement.dataset.accent = settings.themeAccent || 'vizio'
    document.documentElement.dataset.font = settings.fontPreset || 'inter'
    document.documentElement.style.fontSize = (settings.fontSize || 13) + 'px'
  }, [settings.themeBase, settings.themeAccent, settings.fontPreset, settings.fontSize])

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
        projectName={project?.name}
        onChangeProject={() => {
          setProject(null)
          setTasks([])
          setSessionId(null)
          setActiveChatId(null)
        }}
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
            toolsBlock={toolsBlock}
            page={page}
          />
        </div>
        <div style={{ display: page === 'tools' ? 'contents' : 'none' }}>
          <ToolsPage
            initialTools={scannedTools}
            isScanning={toolsScanning}
            onRescan={async () => {
              const { tools, block } = await window.electron.scanTools({ force: true })
              setToolsBlock(block)
              setScannedTools(tools)
            }}
          />
        </div>
        <div style={{ display: page === 'settings' ? 'contents' : 'none' }}>
          <SettingsPage />
        </div>
        <div style={{ display: page === 'node' ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
          <NodePage
            project={project}
            toolsBlock={toolsBlock}
            activeChatId={activeChatId}
            onChatSaved={() => {}}
            onSessionId={setSessionId}
            onTaskUpdate={setTasks}
            page={page}
          />
        </div>
      </div>
    </div>
  )
}
