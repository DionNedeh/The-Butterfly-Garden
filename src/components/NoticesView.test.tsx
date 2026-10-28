import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NoticesView } from './NoticesView'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

/** Open the Google notices the way a toggle of the details element does. */
function openGoogleNotices() {
  const details = document.querySelector('details')!
  details.open = true
  fireEvent(details, new Event('toggle'))
}

describe('open-source notices', () => {
  it('shows the notices that ship with the app, and goes back', async () => {
    const onBack = vi.fn()
    render(<NoticesView onBack={onBack} />)
    expect(screen.getByRole('status')).toHaveTextContent('Opening…')
    expect(await screen.findByText(/MIT License/)).toBeInTheDocument()
    expect(screen.queryByText(/Google's libraries/)).toBeNull()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Back to Settings' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('fetches Google’s notices in the Android app only when they are opened, and once', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const fetch = vi.fn(() => Promise.resolve(new Response('Play Billing notice text')))
    vi.stubGlobal('fetch', fetch)
    render(<NoticesView onBack={vi.fn()} />)
    expect(fetch).not.toHaveBeenCalled()

    openGoogleNotices()
    expect(await screen.findByText('Play Billing notice text')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/google-notices\.txt$/))

    openGoogleNotices()
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('says so when Google’s notices cannot be opened, and does not keep asking', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    const fetch = vi.fn(() => Promise.resolve(new Response('', { status: 404 })))
    vi.stubGlobal('fetch', fetch)
    render(<NoticesView onBack={vi.fn()} />)
    openGoogleNotices()
    expect(await screen.findByText('These notices could not be opened.')).toBeInTheDocument()
    openGoogleNotices()
    expect(fetch).toHaveBeenCalledOnce()

    // Closing the details asks for nothing.
    const details = document.querySelector('details')!
    details.open = false
    fireEvent(details, new Event('toggle'))
    expect(fetch).toHaveBeenCalledOnce()
  })
})
