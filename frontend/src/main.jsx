import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

import App from './App'
import queryClient from './utils/queryClient'

class DebugBoundary extends React.Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Uncaught React render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <pre style={{ color: 'red', padding: 20, whiteSpace: 'pre-wrap' }}>
          {this.state.error.stack || String(this.state.error)}
        </pre>
      )
    }

    return this.props.children
  }
}

const renderApp = () => {
  const root = document.getElementById('root')

  if (!root) {
    document.body.innerHTML = '<pre style="color:red;padding:20px;white-space:pre-wrap">React root element #root was not found.</pre>'
    return
  }

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <DebugBoundary>
            <App />
          </DebugBoundary>
        </HashRouter>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </React.StrictMode>,
  )
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderApp, { once: true })
} else {
  renderApp()
}
