import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { FramedNotice } from './components/FramedNotice'
import { LockGate } from './components/LockGate'
import { SafeMode } from './components/SafeMode'
import { isFramed } from './lib/hosting'
import { isAndroidApp } from './lib/platform'

// Lets android.css make room for the status and navigation bars the app is
// drawn beneath. The PWA's layout is left exactly as it was.
if (isAndroidApp()) document.documentElement.classList.add('android-app')

// Which build this page is (vite.config.ts), for anyone looking: a person in
// the browser's tools, or a test speaking for another tab of the same build.
document.documentElement.dataset.build = __BUILD_ID__

// Framed by another page, the garden's storage is never opened: the frame
// only offers a link to open the app in its own tab (see lib/hosting).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isFramed() ? (
      <FramedNotice />
    ) : (
      // The last line of defence: whatever fails to draw, the gardener lands
      // somewhere that can save a copy of their garden and put a backup back.
      <ErrorBoundary fallback={(error) => <SafeMode error={error} />}>
        {/* A locked garden opens to the lock screen; without a lock, the app. */}
        <LockGate>
          <App />
        </LockGate>
      </ErrorBoundary>
    )}
  </StrictMode>,
)
