import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts.css'
import './index.css'
import App from './App.tsx'
import { isAndroidApp } from './lib/platform'

// Lets android.css make room for the status and navigation bars the app is
// drawn beneath. The PWA's layout is left exactly as it was.
if (isAndroidApp()) document.documentElement.classList.add('android-app')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
