import React from 'react'
import './MenuBar.css'
import logo from '../../assets/logo.png'

export default function MenuBar({ activePage, onNavigate, canGoBack, canGoForward, onBack, onForward, projectName, onChangeProject }) {
  const items = [
    { label: 'Workspace', value: 'main' },
    { label: 'Tools', value: 'tools' },
    { label: 'Settings', value: 'settings' },
  ]

  return (
    <div className="menubar">
      <div className="menubar-left">
        <div className="menubar-arrows">
          <button
            className={`nav-arrow ${!canGoBack ? 'disabled' : ''}`}
            onClick={onBack}
            disabled={!canGoBack}
            title="Back"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M7 1.5L3 5.5L7 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            className={`nav-arrow ${!canGoForward ? 'disabled' : ''}`}
            onClick={onForward}
            disabled={!canGoForward}
            title="Forward"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M4 1.5L8 5.5L4 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {projectName && (
          <div className="menubar-project" onClick={onChangeProject} title="Switch project">
            <img src={logo} className="project-icon-img" alt="V" />
            <span className="project-name">{projectName}</span>
            <span className="project-switch">↓</span>
          </div>
        )}
      </div>

      <nav className="menubar-nav">
        {items.map(item => (
          <button
            key={item.value}
            className={`menu-item ${activePage === item.value ? 'active' : ''}`}
            onClick={() => onNavigate(item.value)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <span className="menubar-title">Vizio</span>
    </div>
  )
}
