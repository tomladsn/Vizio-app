import React from 'react'
import './ErrorBoundary.css'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  handleReload = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-card">
            <div className="error-boundary-title">Something went wrong</div>
            <p className="error-boundary-msg">
              {this.state.error?.message || 'An unexpected error occurred in the UI.'}
            </p>
            <button type="button" className="error-boundary-btn" onClick={this.handleReload}>
              Reload app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
