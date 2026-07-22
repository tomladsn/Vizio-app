const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  // Tool scanning
  scanTools: (opts) =>
    ipcRenderer.invoke('tools:scan', opts),
  installTool: (toolId) =>
    ipcRenderer.invoke('tools:install', toolId),
  scanToolsBlock: () =>
    ipcRenderer.invoke('agent:scanTools'),
  bins: {
    status: () => ipcRenderer.invoke('bins:status'),
  },

  // File probing via ffprobe
  probeFiles: (filePaths) =>
    ipcRenderer.invoke('files:probe', filePaths),
  readFilesBase64: (filePaths) =>
    ipcRenderer.invoke('files:readBase64', filePaths),

  // Workflow execution — called as runWorkflow(payload)
  runWorkflow: (payload) =>
    ipcRenderer.invoke('agent:runWorkflow', payload),

  // Sessions
  initSession: (payload) =>
    ipcRenderer.invoke('session:init', payload),
  readSessionLog: (sessionId) =>
    ipcRenderer.invoke('session:readLog', sessionId),
  listSessionFiles: (sessionId, projectDir) =>
    ipcRenderer.invoke('session:listFiles', { sessionId, projectDir }),
  listProjectSessions: (projectDir) =>
    ipcRenderer.invoke('session:listForProject', { projectDir }),

  // File opening
  openFile: (filePath) =>
    ipcRenderer.send('shell:openFile', filePath),
  getSessionPath: (payload) =>
    ipcRenderer.invoke('agent:getSessionPath', payload),
  prepareWorkflow: (payload) =>
    ipcRenderer.invoke('agent:prepareWorkflow', payload),
  cancelWorkflow: (sessionId) =>
    ipcRenderer.invoke('agent:cancelWorkflow', sessionId),

  project: {
    getAll:      ()                         => ipcRenderer.invoke('project:getAll'),
    create:      (data)                     => ipcRenderer.invoke('project:create', data),
    setLast:     (id)                       => ipcRenderer.invoke('project:setLast', id),
    delete:      (id)                       => ipcRenderer.invoke('project:delete', id),
    getMedia:    (projectDir)               => ipcRenderer.invoke('project:getMedia', projectDir),
    getOutputs:  (projectDir)               => ipcRenderer.invoke('project:getOutputs', projectDir),
    copyMedia:   (sourcePath, projectDir)   => ipcRenderer.invoke('project:copyMedia', { sourcePath, projectDir }),
    deleteMedia: (filePath, projectDir)     => ipcRenderer.invoke('project:deleteMedia', { filePath, projectDir }),
    choosePath:  ()                         => ipcRenderer.invoke('project:choosePath'),
    exportFile:  (sourcePath, defaultName)  => ipcRenderer.invoke('project:exportFile', { sourcePath, defaultName }),
  },
  chat: {
    list:   (projectDir)             => ipcRenderer.invoke('chat:list', projectDir),
    load:   (projectDir, chatId)     => ipcRenderer.invoke('chat:load', { projectDir, chatId }),
    save:   (projectDir, chat)       => ipcRenderer.invoke('chat:save', { projectDir, chat }),
    create: (projectDir, title)      => ipcRenderer.invoke('chat:create', { projectDir, title }),
    delete: (projectDir, chatId)     => ipcRenderer.invoke('chat:delete', { projectDir, chatId }),
  },

  // Progress events: main → renderer
  onStepUpdate: (cb) => {
    const fn = (_, data) => cb(data)
    ipcRenderer.on('agent:stepUpdate', fn)
    return () => ipcRenderer.removeListener('agent:stepUpdate', fn)
  },
  onStepStart: (cb) => {
    const fn = (_, data) => cb(data)
    ipcRenderer.on('agent:stepStart', fn)
    return () => ipcRenderer.removeListener('agent:stepStart', fn)
  },
  onStepOutput: (cb) => {
    const fn = (_, data) => cb(data)
    ipcRenderer.on('agent:stepOutput', fn)
    return () => ipcRenderer.removeListener('agent:stepOutput', fn)
  },
  onStepCmdUpdate: (cb) => {
    const fn = (_, data) => cb(data)
    ipcRenderer.on('agent:stepCmdUpdate', fn)
    return () => ipcRenderer.removeListener('agent:stepCmdUpdate', fn)
  },
  onStepDone: (cb) => {
    const fn = (_, data) => cb(data)
    ipcRenderer.on('agent:stepDone', fn)
    return () => ipcRenderer.removeListener('agent:stepDone', fn)
  },
  onWorkflowDone: (cb) => {
    const fn = (_, data) => cb(data)
    ipcRenderer.on('agent:done', fn)
    return () => ipcRenderer.removeListener('agent:done', fn)
  },
  onMediaChanged: (cb) => {
    const fn = (_, data) => cb(data)
    ipcRenderer.on('project:mediaChanged', fn)
    return () => ipcRenderer.removeListener('project:mediaChanged', fn)
  },

  // Remove all agent listeners (call on component unmount)
  removeAgentListeners: () => {
    ipcRenderer.removeAllListeners('agent:stepUpdate')
    ipcRenderer.removeAllListeners('agent:stepStart')
    ipcRenderer.removeAllListeners('agent:stepOutput')
    ipcRenderer.removeAllListeners('agent:stepCmdUpdate')
    ipcRenderer.removeAllListeners('agent:stepDone')
    ipcRenderer.removeAllListeners('agent:done')
    ipcRenderer.removeAllListeners('project:mediaChanged')
  },

  // Agent filesystem ops (sandboxed to project dir)
  agent: {
    listDir:    (projectDir, subdir)              => ipcRenderer.invoke('agent:listDir',    { projectDir, subdir }),
    renameFile: (projectDir, oldPath, newPath)    => ipcRenderer.invoke('agent:renameFile', { projectDir, oldPath, newPath }),
    moveFile:   (projectDir, srcPath, destPath)   => ipcRenderer.invoke('agent:moveFile',   { projectDir, srcPath, destPath }),
    readText:   (projectDir, filePath)            => ipcRenderer.invoke('agent:readText',   { projectDir, filePath }),
    writeText:  (projectDir, filePath, content)   => ipcRenderer.invoke('agent:writeText',  { projectDir, filePath, content }),
  },

  // Secure key store — plaintext keys are encrypted by the OS and never leave the main process
  keys: {
    set:      (keyId, value) => ipcRenderer.invoke('keys:set',      { keyId, value }),
    getHint:  (keyId)        => ipcRenderer.invoke('keys:getHint',  keyId),
    has:      (keyId)        => ipcRenderer.invoke('keys:has',      keyId),
    listSet:  ()             => ipcRenderer.invoke('keys:listSet'),
    delete:   (keyId)        => ipcRenderer.invoke('keys:delete',   keyId),
    migrate:  (legacyKeys)   => ipcRenderer.invoke('keys:migrate',  legacyKeys),
  },

  // AI — all provider calls run in main; keys never sent from renderer
  ai: {
    complete: (payload) => ipcRenderer.invoke('ai:complete', payload),
    testProvider: (payload) => ipcRenderer.invoke('ai:testProvider', payload),
    startStream: (payload) => ipcRenderer.invoke('ai:streamStart', payload),
    abortStream: (requestId) => ipcRenderer.invoke('ai:streamAbort', requestId),
    onStream: (channel, cb) => {
      const fn = (_, data) => cb(data)
      ipcRenderer.on(channel, fn)
      return () => ipcRenderer.removeListener(channel, fn)
    },
  },
})
