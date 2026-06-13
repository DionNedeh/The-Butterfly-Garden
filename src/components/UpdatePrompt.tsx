import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null
  return (
    <aside className="update-toast" role="status">
      <div>
        <strong>A fresh garden update is ready.</strong>
        <span>Choose when to load it.</span>
      </div>
      <button className="secondary-button" onClick={() => void updateServiceWorker(true)}>
        Update now
      </button>
      <button className="text-button" onClick={() => setNeedRefresh(false)}>
        Later
      </button>
    </aside>
  )
}
