const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  // Tool scanning
  scanTools: () =>
    ipcRenderer.invoke('tools:scan'),
  installTool: (toolId) =>
    ipcRenderer.invoke('tools:install', toolId),
  scanToolsBlock: () =>
    ipcRenderer.invoke('agent:scanTools'),

  // File probing via ffprobe
  probeFiles: (filePaths) =>
    ipcRenderer.invoke('files:probe', filePaths),

  // Workflow execution — called as runWorkflow(payload)
  runWorkflow: (payload) =>
    ipcRenderer.invoke('agent:runWorkflow', payload),

  // Sessions
  initSession: (payload) =>
    ipcRenderer.invoke('session:init', payload),
  readSessionLog: (sessionId) =>
    ipcRenderer.invoke('session:readLog', sessionId),
  listSessionFiles: (sessionId) =>
    ipcRenderer.invoke('session:listFiles', sessionId),

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
    getMedia:    (projectDir)               => ipcRenderer.invoke('project:getMedia', projectDir),
    getOutputs:  (projectDir)               => ipcRenderer.invoke('project:getOutputs', projectDir),
    copyMedia:   (sourcePath, projectDir)   => ipcRenderer.invoke('project:copyMedia', { sourcePath, projectDir }),
    deleteMedia: (filePath, projectDir)     => ipcRenderer.invoke('project:deleteMedia', { filePath, projectDir }),
    choosePath:  ()                         => ipcRenderer.invoke('project:choosePath'),
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

  // Remove all agent listeners (call on component unmount)
  removeAgentListeners: () => {
    ipcRenderer.removeAllListeners('agent:stepUpdate')
    ipcRenderer.removeAllListeners('agent:stepCmdUpdate')
    ipcRenderer.removeAllListeners('agent:stepDone')
    ipcRenderer.removeAllListeners('agent:done')
  },

  // Agent filesystem ops (sandboxed to project dir)
  agent: {
    listDir:    (projectDir, subdir)              => ipcRenderer.invoke('agent:listDir',    { projectDir, subdir }),
    renameFile: (projectDir, oldPath, newPath)    => ipcRenderer.invoke('agent:renameFile', { projectDir, oldPath, newPath }),
    moveFile:   (projectDir, srcPath, destPath)   => ipcRenderer.invoke('agent:moveFile',   { projectDir, srcPath, destPath }),
    readText:   (projectDir, filePath)            => ipcRenderer.invoke('agent:readText',   { projectDir, filePath }),
    writeText:  (projectDir, filePath, content)   => ipcRenderer.invoke('agent:writeText',  { projectDir, filePath, content }),
  },
})
