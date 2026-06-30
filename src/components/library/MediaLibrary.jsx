import React, { useState, useEffect, useRef } from 'react'
import './MediaLibrary.css'

const MEDIA_COLORS = {
  mp4:'#5C6BC0', mov:'#5C6BC0', avi:'#5C6BC0', mkv:'#5C6BC0', webm:'#5C6BC0',
  mp3:'#26A69A', wav:'#26A69A', flac:'#26A69A', aac:'#26A69A', m4a:'#26A69A',
  png:'#EF6C00', jpg:'#EF6C00', jpeg:'#EF6C00', webp:'#EF6C00', gif:'#EF6C00',
}

export default function MediaLibrary({ project, activeFile, onSelectFile, onMentionFile, onMentionFiles, onDeleteFile, onFilesChange, reloadTrigger }) {
  const [files,     setFiles]     = useState([])
  const [dragging,  setDragging]  = useState(false)
  const [copying,   setCopying]   = useState(false)
  const [selected,  setSelected]  = useState(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const dropRef = useRef(null)

  // Load project media on mount and when project changes
  useEffect(() => {
    if (!project) return
    loadMedia()
  }, [project, reloadTrigger])

  async function loadMedia() {
    const media = await window.electron.project.getMedia(project.folderPath)
    setFiles(media)
    onFilesChange?.(media)
    // Clean up selected set – remove paths that no longer exist
    setSelected(prev => {
      const validPaths = new Set(media.map(f => f.path))
      const next = new Set([...prev].filter(p => validPaths.has(p)))
      if (next.size === 0) setSelectMode(false)
      return next
    })
  }

  // Drag and drop
  function onDragOver(e) { e.preventDefault(); setDragging(true) }
  function onDragLeave() { setDragging(false) }

  async function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    if (!dropped.length) return
    setCopying(true)
    for (const f of dropped) {
      await window.electron.project.copyMedia(f.path, project.folderPath)
    }
    await loadMedia()
    setCopying(false)
  }

  async function handleAddMore() {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'video/*,audio/*,image/*,.srt,.vtt,.ass,.ssa,.txt,.md'
    input.onchange = async () => {
      const picked = Array.from(input.files)
      if (!picked.length) return
      setCopying(true)
      for (const f of picked) {
        await window.electron.project.copyMedia(f.path, project.folderPath)
      }
      await loadMedia()
      setCopying(false)
    }
    input.click()
  }

  function handleDeleteRequest(file) {
    setDeleteError(null)
    setConfirmingDelete(file)
  }

  function handleDeleteCancel() {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur()
    }
    setConfirmingDelete(null)
  }

  async function handleDeleteConfirm() {
    const file = confirmingDelete
    if (!file) return
    
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur()
    }
    setConfirmingDelete(null)

    const result = await window.electron.project.deleteMedia(file.path, project.folderPath)
    if (!result?.ok) {
      setDeleteError(result?.message || 'Could not delete this file.')
      return
    }
    if (activeFile?.path === file.path) onDeleteFile?.(file)
    await loadMedia()
  }

  function toggleFileSelected(filePath) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(filePath)) {
        next.delete(filePath)
      } else {
        next.add(filePath)
      }
      if (next.size === 0) setSelectMode(false)
      return next
    })
  }

  function handleSelectAll() {
    setSelected(new Set(files.map(f => f.path)))
  }

  function handleSelectNone() {
    setSelected(new Set())
    setSelectMode(false)
  }

  function handleSendSelectedToChat() {
    const selectedFiles = files.filter(f => selected.has(f.path))
    if (selectedFiles.length === 0) return
    const names = selectedFiles.map(f => f.name)
    onMentionFiles?.(names)
    setSelected(new Set())
    setSelectMode(false)
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return
    const msg = `Are you sure you want to delete ${selected.size} selected file${selected.size === 1 ? '' : 's'}?`
    if (!confirm(msg)) return

    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur()
    }

    setDeleteError(null)
    const paths = Array.from(selected)
    let failedCount = 0
    let lastError = null

    for (const filePath of paths) {
      const result = await window.electron.project.deleteMedia(filePath, project.folderPath)
      if (!result?.ok) {
        failedCount++
        lastError = result?.message || 'Unknown error'
      } else {
        const file = files.find(f => f.path === filePath)
        if (file && activeFile?.path === file.path) {
          onDeleteFile?.(file)
        }
      }
    }

    if (failedCount > 0) {
      setDeleteError(`Failed to delete ${failedCount} file(s). Error: ${lastError}`)
    }

    setSelected(new Set())
    setSelectMode(false)
    await loadMedia()
  }

  return (
    <div
      ref={dropRef}
      className={`library ${dragging ? 'dragging' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="library-header">
        <span className="section-label">Media</span>
        {files.length > 0 && (
          <>
            <button
              className={`select-mode-btn ${selectMode ? 'active' : ''}`}
              title={selectMode ? 'Exit select mode' : 'Select files'}
              onClick={() => {
                if (selectMode) {
                  setSelectMode(false)
                  setSelected(new Set())
                } else {
                  setSelectMode(true)
                }
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
                {selectMode && <path d="M3 6l2 2 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />}
              </svg>
            </button>
            <span className="file-count">{files.length} file{files.length !== 1 ? 's' : ''}</span>
          </>
        )}
      </div>

      {selectMode && files.length > 0 && (
        <div className="select-controls">
          <button className="select-ctrl-btn" onClick={handleSelectAll}>All</button>
          <button className="select-ctrl-btn" onClick={handleSelectNone}>None</button>
          <span className="select-count">{selected.size} selected</span>
        </div>
      )}

      {confirmingDelete && (
        <div className="delete-confirm-bar">
          <span className="delete-confirm-text">Delete "{confirmingDelete.name}"?</span>
          <div className="delete-confirm-actions">
            <button className="delete-confirm-btn yes" onClick={handleDeleteConfirm}>Delete</button>
            <button className="delete-confirm-btn no" onClick={handleDeleteCancel}>Cancel</button>
          </div>
        </div>
      )}

      {deleteError && (
        <div className="delete-error-bar">
          <span className="delete-error-text">{deleteError}</span>
          <button className="delete-error-close" onClick={() => setDeleteError(null)}>×</button>
        </div>
      )}

      {files.length === 0 ? (
        <div className="empty-library" onClick={handleAddMore}>
          <div className="empty-icon">⬇</div>
          <div className="empty-title">Drop media files here</div>
          <div className="empty-sub">They'll be copied into your project</div>
        </div>
      ) : (
        <div className="file-list">
          {files.map(file => (
            <FileRow
              key={file.path}
              file={file}
              active={activeFile?.path === file.path}
              isConfirming={confirmingDelete?.path === file.path}
              selectMode={selectMode}
              isSelected={selected.has(file.path)}
              onToggleSelect={() => {
                if (!selectMode) setSelectMode(true)
                toggleFileSelected(file.path)
              }}
              onSelect={() => onSelectFile(file)}
              onMention={() => onMentionFile?.(file.name)}
              onDelete={() => handleDeleteRequest(file)}
            />
          ))}
        </div>
      )}

      {files.length > 0 && !selectMode && (
        <button className="add-more-btn" onClick={handleAddMore}>
          + add more files
        </button>
      )}

      {selectMode && selected.size > 0 && (
        <div className="select-action-bar">
          <button className="select-send-btn" onClick={handleSendSelectedToChat}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Send {selected.size} to chat
          </button>
          <button className="select-delete-btn" onClick={handleDeleteSelected}>
            Delete {selected.size}
          </button>
        </div>
      )}

      {copying && (
        <div className="lib-copying">
          <div className="lib-copy-spinner" />
          Copying to project…
        </div>
      )}

      {dragging && (
        <div className="drag-overlay">
          <div className="drag-hint">Drop to add</div>
        </div>
      )}
    </div>
  )
}

function FileRow({ file, active, isConfirming, selectMode, isSelected, onToggleSelect, onSelect, onMention, onDelete }) {
  return (
    <div
      className={`file-item ${active ? 'active' : ''} ${isSelected ? 'selected' : ''} ${isConfirming ? 'confirming' : ''}`}
      onClick={selectMode ? onToggleSelect : onSelect}
    >
      {selectMode && (
        <div className="file-checkbox" onClick={e => { e.stopPropagation(); onToggleSelect() }}>
          <div className={`checkbox-box ${isSelected ? 'checked' : ''}`}>
            {isSelected && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </div>
      )}
      <div className={`file-thumb ext-${file.ext}`}>
        {file.ext.toUpperCase().slice(0, 3)}
      </div>
      <div className="file-meta">
        <div className="file-name" title={file.name}>{file.name}</div>
        <div className="file-info">{file.size} · .{file.ext}</div>
      </div>
      {!selectMode && (
        <div className="file-actions">
          <button
            className="file-action-btn context-btn"
            title="Mention in chat"
            onClick={e => { e.stopPropagation(); onMention() }}
          >
            <span style={{ fontSize: '14px' }}>@</span>
          </button>
          <button
            className="file-action-btn remove-btn"
            title="Delete file"
            onClick={e => { e.stopPropagation(); onDelete() }}
          >
            <span style={{ fontSize: '14px' }}>x</span>
          </button>
        </div>
      )}
    </div>
  )
}
