import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SafeMode } from './components/SafeMode'
import { isAndroidApp } from './lib/platform'

// Lets android.css make room for the status and navigation bars the app is
// drawn beneath. The PWA's layout is left exactly as it was.
if (isAndroidApp()) document.documentElement.classList.add('android-app')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* The last line of defence: whatever fails to draw, the gardener lands
        somewhere that can save a copy of their garden and put a backup back. */}
    <ErrorBoundary fallback={(error) => <SafeMode error={error} />}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
