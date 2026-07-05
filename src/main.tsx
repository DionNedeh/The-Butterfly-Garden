import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fraunces needs full.css: the display face leans on the SOFT and WONK
// variation axes, which the default wght-only build does not carry.
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/nunito/index.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
