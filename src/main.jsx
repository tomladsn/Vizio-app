import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { initWebMock } from './lib/webMock'

if (typeof window.electron === 'undefined') {
  initWebMock()
}

// Suppress spurious dragEvent ReferenceError from DevTools/extensions
window.addEventListener('error', (e) => {
  if (e.message && e.message.includes('dragEvent is not defined')) {
    e.preventDefault()
    e.stopPropagation()
  }
}, true)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
