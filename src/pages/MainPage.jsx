import React, { useState, useEffect, useRef } from 'react'
import MediaLibrary from '../components/library/MediaLibrary'
import ChatPanel from '../components/chat/ChatPanel'
import PreviewPanel from '../components/preview/PreviewPanel'
import ExecutionBar from '../components/layout/ExecutionBar'
import './MainPage.css'

export default function MainPage({ project, tasks, onTaskUpdate, sessionId, onSessionId, activeChatId, onChatChange, onRegisterLibraryReload, toolsBlock }) {
  const [activeFile, setActiveFile] = useState(null)
  const [probeData, setProbeData] = useState(null)
  const [projectFiles, setProjectFiles] = useState([])
  const [outputFiles, setOutputFiles]   = useState([])
  const [reloadTrigger, setReloadTrigger] = useState(0)
  const [chats, setChats] = useState([])

  // Holds files selected from MediaLibrary to attach to the next chat message
  const [attachedFiles, setAttachedFiles] = useState([])

  function handleAttachFiles(names) {
    // Merge and deduplicate
    setAttachedFiles(prev => {
      const set = new Set([...prev, ...names])
      return Array.from(set)
    })
  }
  const [showChats, setShowChats] = useState(false)
  const [pendingWorkflow, setPendingWorkflow] = useState(null)
  const mentionFnRef = useRef(null)

  useEffect(() => {
    if (!project) return
    refreshMedia()
    refreshOutputs()
    refreshChats()
  }, [project])

  async function refreshMedia() {
    const media = await window.electron.project.getMedia(project.folderPath)
    setProjectFiles(media)
    setReloadTrigger(t => t + 1)
  }

  async function refreshOutputs() {
    const outputs = await window.electron.project.getOutputs(project.folderPath)
    setOutputFiles(outputs)
  }

  // Subscribe to filesystem changes
  useEffect(() => {
    if (!project) return
    let debounceTimer = null

    const unlisten = window.electron.onMediaChanged(() => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        refreshMedia()
        refreshOutputs()
      }, 500)
    })

    return () => {
      unlisten()
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [project])

  async function handleWorkflowComplete() {
    await refreshMedia()
    await refreshOutputs()
  }

  // Register our reload fn with App so the global drop handler can call it
  useEffect(() => {
    onRegisterLibraryReload?.(refreshMedia)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project])

  async function refreshChats() {
    const list = await window.electron.chat.list(project.folderPath)
    setChats(list)
    if (list.length === 0) {
      const newChat = await window.electron.chat.create(project.folderPath, 'New chat')
      setChats([{ id: newChat.id, title: newChat.title, updatedAt: newChat.updatedAt, messageCount: 0 }])
      onChatChange?.(newChat.id)
    } else if (!activeChatId) {
      onChatChange?.(list[0].id)
    }
  }

  async function handleSelectFile(file) {
    setActiveFile(file)
    try {
      const results = await window.electron.probeFiles([file.path])
      setProbeData(results?.[0] ?? null)
    } catch {
      setProbeData(null)
    }
  }

  function handleLibraryFilesChange(files) {
    setProjectFiles(files)
  }

  function handleDeleteFile(file) {
    if (activeFile?.path === file.path) {
      setActiveFile(null)
      setProbeData(null)
    }
  }

  async function handleNewChat() {
    const chat = await window.electron.chat.create(project.folderPath, 'New chat')
    await refreshChats()
    onChatChange?.(chat.id)
    setShowChats(false)
  }

  async function handleDeleteChat(chatId) {
    const currentIndex = chats.findIndex(chat => chat.id === chatId)
    await window.electron.chat.delete(project.folderPath, chatId)
    const list = await window.electron.chat.list(project.folderPath)

    if (list.length === 0) {
      const newChat = await window.electron.chat.create(project.folderPath, 'New chat')
      setChats([{ id: newChat.id, title: newChat.title, updatedAt: newChat.updatedAt, messageCount: 0 }])
      onChatChange?.(newChat.id)
      return
    }

    setChats(list)

    if (chatId === activeChatId) {
      const nextChat = list[Math.min(currentIndex, list.length - 1)] ?? list[0]
      onChatChange?.(nextChat.id)
    }
  }

  function handleMentionFile(filename) {
    mentionFnRef.current?.(filename)
  }

  return (
    <div className="main-page">
      <div className="main-body">
        <MediaLibrary
          project={project}
          activeFile={activeFile}
          onSelectFile={handleSelectFile}
          onMentionFile={handleMentionFile}
          onMentionFiles={handleAttachFiles}
          onDeleteFile={handleDeleteFile}
          onFilesChange={handleLibraryFilesChange}
          reloadTrigger={reloadTrigger}
        />

        <PreviewPanel
          project={project}
          activeFile={activeFile}
          sessionId={sessionId}
          onMentionFile={handleMentionFile}
        />

        <div className="center-panel" style={{ position: 'relative' }}>
          <div className="chat-topbar">
            <button
              className="chat-history-btn"
              onClick={() => setShowChats(s => !s)}
              title="Chat history"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 3H10M2 6H10M2 9H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
            <span className="chat-topbar-title">
              {chats.find(chat => chat.id === activeChatId)?.title ?? 'New chat'}
            </span>
            <button className="new-chat-btn" onClick={handleNewChat}>+ New chat</button>
          </div>

          {showChats && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                onClick={() => setShowChats(false)}
              />
              <div className="chat-sidebar">
                {chats.length === 0 && (
                  <div style={{ padding: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>No chats yet</div>
                )}
                {chats.map(chat => (
                  <div
                    key={chat.id}
                    className={`chat-sidebar-row ${chat.id === activeChatId ? 'active' : ''}`}
                    onClick={() => { onChatChange?.(chat.id); setShowChats(false) }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onChatChange?.(chat.id)
                        setShowChats(false)
                      }
                    }}
                  >
                    <div className="csr-head">
                      <div className="csr-title">{chat.title}</div>
                      <button
                        className="chat-delete-btn"
                        title="Delete chat"
                        onClick={async (e) => {
                          e.stopPropagation()
                          await handleDeleteChat(chat.id)
                        }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                          <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                    <div className="csr-meta">
                      {chat.messageCount} msg{chat.messageCount !== 1 ? 's' : ''} · {new Date(chat.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <ChatPanel
            project={project}
            activeFile={activeFile}
            toolsBlock={toolsBlock}
            probeData={probeData}
            projectFiles={projectFiles}
            outputFiles={outputFiles}
            onTaskUpdate={onTaskUpdate}
            onSessionId={onSessionId}
            activeChatId={activeChatId}
            onMentionReady={fn => { mentionFnRef.current = fn }}
            onChatSaved={refreshChats}
            onWorkflowComplete={handleWorkflowComplete}
            attachedFiles={attachedFiles}
            onClearAttachments={(names) => setAttachedFiles(names ?? [])}
            onMentionFiles={handleAttachFiles}
            onPendingWorkflow={setPendingWorkflow}
          />
        </div>
      </div>

      <ExecutionBar tasks={tasks} pendingWorkflow={pendingWorkflow} />
    </div>
  )
}
