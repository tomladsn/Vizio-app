import React, { useEffect, useRef } from 'react'
import './ContextMenu.css'

export default function ContextMenu({ x, y, items = [], onClose }) {
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose?.()
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // Adjust menu position if it overflows the window viewport
  const menuWidth = 200
  const menuHeight = items.length * 36 + 16
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 12)
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 12)

  return (
    <div
      ref={menuRef}
      className="vizio-context-menu"
      style={{
        left: `${Math.max(12, adjustedX)}px`,
        top: `${Math.max(12, adjustedY)}px`,
      }}
      onClick={e => e.stopPropagation()}
    >
      {items.map((item, idx) => {
        if (item.type === 'separator') {
          return <div key={idx} className="vizio-cm-separator" />
        }

        return (
          <button
            key={idx}
            className={`vizio-cm-item ${item.danger ? 'danger' : ''}`}
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return
              onClose?.()
              item.action?.()
            }}
          >
            <span className="vizio-cm-icon">{item.icon}</span>
            <span className="vizio-cm-label">{item.label}</span>
            {item.shortcut && <span className="vizio-cm-shortcut">{item.shortcut}</span>}
          </button>
        )
      })}
    </div>
  )
}
