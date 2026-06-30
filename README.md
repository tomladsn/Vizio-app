<div align="center">

<img src="public/icon.ico" alt="Vizio" width="120" />

# Vizio

**From raw files to ready — just describe it.**

[![Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows&logoColor=white)](https://www.microsoft.com/windows)
[![License](https://img.shields.io/badge/License-MIT-green)](#license)

</div>

---

Vizio is a desktop app that uses AI  for media processing (largely video, image and audio processin). You describe what you want —compress for Twitter, generate captions, extract clips from a long video, batch convert a folder— and Vizio plans the steps, runs the commands, and fixes its own errors automatically.

It is not a video editor. There is no timeline, no drag-and-drop trim bar. It is the tool you reach for when you have files that need work and you do not want to spend an hour learning  and text command flags or writing shell scripts to do it.

---

## How it works

You type a goal in plain English. Vizio sends that to an LLM alongside your file metadata and a list of available tools. The model returns a structured workflow — a list of steps with shell commands. Vizio executes each step, streams progress back to you, and if a command fails it sends the error back to the AI, gets a corrected command, and retries automatically up to three times before giving up and explaining what went wrong.

```
You type:   "clip the first 30 seconds from the video and aspect ratio for youtube shorts"

Vizio:    
 step 1: command to clip videos
 step 2: adjust aspect ratio
```

Every command that ran, every retry, every fix the AI made — all of it is in the session log.

---

## What makes it different

**It executes, not just suggests.** Most "AI + command line" tools generate the command and copy it to your clipboard. Vizio runs it, watches the exit code, and handles failures without asking you.

**Self-healing.** When a step fails — wrong codec, missing filter, bad path — the AI reads the actual stderr, writes a corrected command, and retries. You watch it fix itself.

**Everything is saved.** Projects have their own folders. Every chat, every session log, every output file is organized and persists between sessions. Your conversation with the AI has full context of what ran before.

**Bring your own key, keep your own files.** Nothing is uploaded to a cloud service. Your media stays on your machine. API keys are encrypted via the OS credential manager. The AI providers you connect to see only what you send them.


---

## Screenshots

| | |
|---|---|
| ![Workspace](docs/workspace.png) | **Workspace** — media library left, session log center, AI chat right |
| ![Session log](docs/session-log.png) | **Session log** — every command, attempt, and fix logged live |
| ![Settings](docs/settings.png) | **Settings** — provider, model, theme, accent color |

---

## Supported tools

Vizio detects these automatically. Missing ones can be installed from the Tools page with one click on Windows.

| Tool | What it does |
|---|---|
| **python** | dependencies for whisper |
| **ffmpeg** | Video/audio encoding, filtering, trimming, captioning, scaling |
| **ffprobe** | Reads codec, resolution, duration, bitrate metadata |
| **Whisper** | Speech-to-text — generates SRT/VTT/TXT from any audio or video |
| **yt-dlp** | Downloads video and audio from YouTube and 1000+ other sites |
| **ImageMagick** | Frame-level image manipulation, conversion, compositing |

---

## Supported AI providers

| Provider | Notes |
|---|---|
| **Anthropic** | Claude 3.5 Sonnet / Opus |
| **OpenAI** | GPT-4o / GPT-4 Turbo |
| **Ollama** | Fully local, no API key, no internet required |
| **OpenRouter** | Access to many models through one key (recommended) |


---

## Getting started

**Requirements:** Node.js 18+, npm, ffmpeg on your PATH (or use the bundled version).

```bash
# Clone
git clone https://github.com/your-username/Vizio-app.git
cd Vizio-app

# Install
npm install

# Run
npm run dev
```


---

## Project structure

```
Vizio-app/
├── electron/          Main process — IPC handlers, ffmpeg execution, AI client
│   ├── main.js        Workflow runner, pipeline executor, session logger
│   ├── ffmpeg.js      runFfmpeg, probeFiles, scanTools, binary resolution
│   ├── aiClient.js    Provider-agnostic callAI + streaming
│   └── projectStore.js  Project, media, chat, and session file management
│
├── src/               Renderer — React + Vite
│   ├── pages/
│   │   ├── MainPage.jsx      Three-panel workspace
│   │   ├── NodePage.jsx      Visual pipeline builder
│   │   ├── ToolsPage.jsx     Tool detection and install
│   │   └── SettingsPage.jsx  Provider config and appearance
│   ├── components/
│   │   ├── chat/             ChatPanel — AI conversation, approval cards
│   │   ├── preview/          PreviewPanel — before/after, output files, session log
│   │   └── library/          MediaLibrary — file browser and mention system
│
└── resources/
    └── bin/win32/     Bundled ffmpeg, ffprobe, ffplay, yt-dlp binaries
```

---

## Development scripts

```bash
npm run dev        # Vite + Electron (hot reload)
npm run build      # Production build + NSIS installer
Graphify extract   #codemap


---

## Contributing

Issues and pull requests are welcome. If you find a bug, please include the session log from the relevant run — it contains the exact commands and errors that will make it much faster to diagnose.

1. Fork the repo
2. Create a branch — `git checkout -b fix/something`
3. Commit and push
4. Open a pull request

---

## License


---

<div align="center">
Built with Electron, React and Vite
</div>
