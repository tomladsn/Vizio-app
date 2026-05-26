import React from 'react'
import './ConfirmDialog.css'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  return (
    <div className="confirm-overlay" role="dialog" aria-modal="true" onMouseDown={onCancel}>
      <div className="confirm-card" onMouseDown={e => e.stopPropagation()}>
        <div className="confirm-title">{title}</div>
        {message && <p className="confirm-message">{message}</p>}
        <div className="confirm-actions">
          <button type="button" className="confirm-btn cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-btn ${danger ? 'danger' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
