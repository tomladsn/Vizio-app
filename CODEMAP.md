# VISIO MEDIA AGENT — CODEMAP

Generated: 2026-04-18T19:09:29.830Z

## PROJECT STRUCTURE

```
src/
  ├── components


│



├
─
─

c
h
a
t








│











│











├


─


─





C


h


a


t


P


a


n


e


l


.


c


s


s












│











│











└


─


─





C


h


a


t


P


a


n


e


l


.


j


s


x




│



├
─
─

l
a
y
o
u
t








│











│











├


─


─





E


x


e


c


u


t


i


o


n


B


a


r


.


c


s


s












│











│











├


─


─





E


x


e


c


u


t


i


o


n


B


a


r


.


j


s


x












│











│











├


─


─





M


e


n


u


B


a


r


.


c


s


s












│











│











└


─


─





M


e


n


u


B


a


r


.


j


s


x




│



├
─
─

l
i
b
r
a
r
y








│











│











├


─


─





M


e


d


i


a


L


i


b


r


a


r


y


.


c


s


s












│











│











└


─


─





M


e


d


i


a


L


i


b


r


a


r


y


.


j


s


x




│



└
─
─

p
r
e
v
i
e
w








│























├


─


─





P


r


e


v


i


e


w


P


a


n


e


l


.


c


s


s












│























└


─


─





P


r


e


v


i


e


w


P


a


n


e


l


.


j


s


x
  ├── pages


│



├
─
─

M
a
i
n
P
a
g
e
.
c
s
s




│



├
─
─

M
a
i
n
P
a
g
e
.
j
s
x




│



├
─
─

S
e
t
t
i
n
g
s
P
a
g
e
.
c
s
s




│



├
─
─

S
e
t
t
i
n
g
s
P
a
g
e
.
j
s
x




│



├
─
─

T
o
o
l
s
P
a
g
e
.
c
s
s




│



└
─
─

T
o
o
l
s
P
a
g
e
.
j
s
x
  ├── store


│



└
─
─

s
e
t
t
i
n
g
s
S
t
o
r
e
.
j
s
  ├── styles


│



└
─
─

g
l
o
b
a
l
s
.
c
s
s
  ├── App.css
  ├── App.jsx
  └── main.jsx
electron/
  ├── ffmpeg.js
  ├── main.js
  └── preload.js
```

## ARCHITECTURE

```
electron/main.js        — Electron main process. IPC handlers, ffmpeg execution, logger
electron/preload.js     — Context bridge. Exposes safe IPC API to renderer as window.electron
electron/ffmpeg.js      — runFfmpeg (spawn), probeFiles, scanTools, createLogger

src/App.jsx             — Root. Navigation history stack (back/forward). Page routing.
src/pages/MainPage.jsx  — Editor view. Owns activeFile, tasks, toolsBlock, probeData state.
src/pages/ToolsPage.jsx — Tool registry. Shows installed/missing CLI tools + setup guides.
src/pages/SettingsPage.jsx — API keys (per provider) + model input + appearance.

src/components/chat/ChatPanel.jsx   — AI chat. Calls AI, parses workflow, triggers execution.
src/components/library/MediaLibrary.jsx — File drag-drop. Manages file list + active file.
src/components/preview/PreviewPanel.jsx — Before/after video panes + output/log tabs.
src/components/layout/MenuBar.jsx   — App menu bar with back/forward navigation.
src/components/layout/ExecutionBar.jsx — Bottom bar. Session info + per-task progress.

src/store/settingsStore.js — localStorage store. Providers, models, keys. getActiveConfig().
```

## IPC CONTRACT (renderer ↔ main)

```
// renderer → main (invoke = await response)
window.electron.scanTools()                    → tool[]
window.electron.probeFiles([path])             → probeResult[]
window.electron.getSessionPath(sessionId)      → string (dir path)
window.electron.runWorkflow({workflow, sessionId, apiKey, model, providerId, baseUrl})

// main → renderer (streaming events)
window.electron.onStepUpdate({stepId, status, pct, message})
window.electron.onStepDone({stepId, success, stderr, stdout, message})
window.electron.onStepCmdUpdate({stepId, cmd, message})  // retry with new command
window.electron.onWorkflowDone({success, sessionDir, logFile, message})
window.electron.removeAgentListeners()
```

## DATA FLOW

```
1. App boots → MainPage scans tools via IPC → sets toolsBlock string for system prompt
2. User drops file → MediaLibrary → onSelectFile → probeFiles via IPC → probeData state
3. User types task → ChatPanel builds system prompt (tools + file + session dir)
4. ChatPanel calls AI (provider-agnostic callAI) → parses JSON response
5. mode=workflow → message shown → runWorkflow IPC called immediately (no permission gate)
6. main.js: for each step → spawn ffmpeg → stream progress → if fail → callAI verify loop
7. verify loop: exit 0 = pass. non-zero = send stderr to AI → get fixed_command → retry x3
8. Progress events stream back → ChatPanel log card updates + ExecutionBar task row updates
9. onWorkflowDone → loading false → success/fail message in chat
```

## SETTINGS STORE SHAPE

```js
// localStorage key: 'visio_settings'
// settingsStore.getActiveConfig() returns: { providerId, label, baseUrl, apiKey, model, isLocal }
// PROVIDERS: groq | openai | anthropic | gemini | ollama
// Per-provider keys: groqApiKey, openaiApiKey, anthropicApiKey, geminiApiKey, ollamaEndpoint
// Per-provider models: groqModel, openaiModel, anthropicModel, geminiModel, ollamaModel
```

## FILE SIGNATURES

### src/App.jsx

```js
import React, { useState, useCallback, useEffect } from 'react'
import MenuBar from './components/layout/MenuBar'
import MainPage from './pages/MainPage'
import ToolsPage from './pages/ToolsPage'
import SettingsPage from './pages/SettingsPage'
import { settingsStore } from './store/settingsStore'
import './styles/globals.css'
import './App.css'
export default function App() {…}
```

### src/components/chat/ChatPanel.jsx

```js
import React, { useState, useRef, useEffect } from 'react'
import { settingsStore } from '../../store/settingsStore'
import './ChatPanel.css'
function buildSystemPrompt(toolsBlock, fileBlock, sessionDir) {…}
function buildFileBlock(activeFile, probeData, contextFiles = []) {…}
function parseAIResponse(raw) {…}
function formatSize(bytes) {…}
async function callAI(messages, config) {…}
function parseAPIError(err, providerId) {…}
export default function ChatPanel({…}
function Message({…}
function LogMessage({…}
function StatusIcon({…}
function LogProgress({…}
function MessageContent({…}
function SendIcon() {…}
```

### src/components/layout/ExecutionBar.jsx

```js
import React, { useState, useEffect } from 'react'
import { settingsStore } from '../../store/settingsStore'
import './ExecutionBar.css'
export default function ExecutionBar({…}
function TaskRow({…}
```

### src/components/layout/MenuBar.jsx

```js
import React from 'react'
import './MenuBar.css'
export default function MenuBar({…}
```

### src/components/library/MediaLibrary.jsx

```js
import React, { useState, useRef, useCallback } from 'react'
import './MediaLibrary.css'
function getExt(name) {…}
function formatSize(bytes) {…}
export default function MediaLibrary({…}
function FileItem({…}
```

### src/components/preview/PreviewPanel.jsx

```js
import React, { useState } from 'react'
import './PreviewPanel.css'
export default function PreviewPanel({…}
function VideoPane({…}
```

### src/main.jsx

```js
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
```

### src/pages/MainPage.jsx

```js
import React, { useState, useEffect } from 'react'
import MediaLibrary from '../components/library/MediaLibrary'
import PreviewPanel from '../components/preview/PreviewPanel'
import ChatPanel from '../components/chat/ChatPanel'
import ExecutionBar from '../components/layout/ExecutionBar'
import './MainPage.css'
export default function MainPage() {…}
```

### src/pages/SettingsPage.jsx

```js
import React, { useState } from 'react'
import { settingsStore, PROVIDERS, ACCENTS, THEMES, MODEL_HINTS } from '../store/settingsStore'
import './SettingsPage.css'
export default function SettingsPage() {…}
function ApiTab({…}
function ProviderConfig({…}
function AppearanceTab({…}
```

### src/pages/ToolsPage.jsx

```js
import React, { useState } from 'react'
import './ToolsPage.css'
export default function ToolsPage() {…}
function ToolCard({…}
function CmdLine({…}
```

### src/store/settingsStore.js

```js
export const PROVIDERS = [ {…}
export const ACCENTS = [ {…}
export const THEMES = [ {…}
export const MODEL_HINTS = {…}
function load() {…}
function save(data) {…}
export const settingsStore = {…}
```

### electron/ffmpeg.js

```js
import { exec, spawn }  from 'child_process'
import { promisify }    from 'util'
import path             from 'path'
import fs               from 'fs'
import { app }          from 'electron'
function cleanCommand(raw) {…}
function parseProgress(line, durationSec) {…}
export function runFfmpeg(command, {…}
export async function probeFiles(filePaths) {…}
export async function scanTools() {…}
export function formatToolsBlock(results) {…}
export function createLogger(sessionId) {…}
```

### electron/main.js

```js
import { app, BrowserWindow, ipcMain, protocol, Menu } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'
import { scanTools, probeFiles, runFfmpeg, createLogger } from './ffmpeg.js'
import fs from 'fs'
function createWindow() {…}
ipcMain.handle('tools:scan', …)
ipcMain.handle('files:probe', …)
ipcMain.handle('agent:runWorkflow', …)
ipcMain.handle('agent:getSessionPath', …)
ipcMain.handle('files:openPath', …)
function buildVerifyPrompt(step, result) {…}
async function callAI(messages, {…}
function parseJson(raw) {…}
function getSessionDir(sessionId) {…}
```

### electron/preload.js

```js
const { contextBridge, ipcRenderer } = require('electron')
    ipcRenderer.invoke('tools:scan'),
    ipcRenderer.invoke('files:probe', filePaths),
    ipcRenderer.invoke('agent:runWorkflow', payload),
    ipcRenderer.invoke('agent:getSessionPath', sessionId),
    ipcRenderer.invoke('files:openPath', filePath),
const fn = (_, data) => {…}
    ipcRenderer.on('agent:stepUpdate', fn)
    return () => ipcRenderer.removeListener('agent:stepUpdate', fn)
const fn = (_, data) => {…}
    ipcRenderer.on('agent:stepCmdUpdate', fn)
    return () => ipcRenderer.removeListener('agent:stepCmdUpdate', fn)
const fn = (_, data) => {…}
    ipcRenderer.on('agent:stepDone', fn)
    return () => ipcRenderer.removeListener('agent:stepDone', fn)
const fn = (_, data) => {…}
    ipcRenderer.on('agent:done', fn)
    return () => ipcRenderer.removeListener('agent:done', fn)
    ipcRenderer.removeAllListeners('agent:token')
    ipcRenderer.removeAllListeners('agent:stepUpdate')
    ipcRenderer.removeAllListeners('agent:stepCmdUpdate')
    ipcRenderer.removeAllListeners('agent:stepDone')
    ipcRenderer.removeAllListeners('agent:done')
```
