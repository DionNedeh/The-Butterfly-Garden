import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

const saveTextFile = vi.fn()
vi.mock('../lib/download', () => ({
  saveTextFile: (...args: unknown[]) => saveTextFile(...args) as unknown,
  datedFileName: (what: string) => `${what}.json`,
}))

const { FramedNotice } = await import('./FramedNotice')
const { MovedBanner } = await import('./MovedBanner')
const { Onboarding } = await import('./Onboarding')

afterEach(() => {
  saveTextFile.mockReset()
  window.history.replaceState(null, '', '/')
})

describe('framed by another page', () => {
  it('offers only a way out to a tab of its own', () => {
    render(<FramedNotice />)
    const link = screen.getByRole('link', { name: 'Open The Butterfly Garden' })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })
})

describe('carrying a garden to its new address', () => {
  const target = new URL('https://garden.example.org/')

  it('saves the garden first, then offers the new address', async () => {
    const user = userEvent.setup()
    saveTextFile.mockResolvedValue('saved')
    const exportGarden = vi.fn(() => ({ text: '{"format":"the-butterfly-garden"}' }))
    render(<MovedBanner target={target} onExportGarden={exportGarden} />)

    expect(screen.queryByRole('link')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Save my garden to a file' }))

    expect(saveTextFile).toHaveBeenCalledWith(
      'garden-backup.json',
      'application/json',
      '{"format":"the-butterfly-garden"}',
    )
    const link = screen.getByRole('link', { name: 'Open garden.example.org' })
    expect(link.getAttribute('href')).toBe('https://garden.example.org/#/arrive')
  })

  it('does not send anyone on before their backup exists', async () => {
    const user = userEvent.setup()
    saveTextFile.mockResolvedValue('cancelled')
    render(<MovedBanner target={target} onExportGarden={() => ({ text: '{}' })} />)
    await user.click(screen.getByRole('button', { name: 'Save my garden to a file' }))
    expect(screen.getByText(/nothing was saved/i)).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('says so when the garden cannot be exported', async () => {
    const user = userEvent.setup()
    render(<MovedBanner target={target} onExportGarden={() => undefined} />)
    await user.click(screen.getByRole('button', { name: 'Save my garden to a file' }))
    expect(saveTextFile).not.toHaveBeenCalled()
    expect(screen.getByText(/cannot be saved just now/i)).toBeInTheDocument()
  })

  it('says so when making the file fails, rather than doing nothing', async () => {
    const user = userEvent.setup()
    const exportGarden = vi.fn(() => Promise.reject(new DOMException('gone', 'NotReadableError')))
    render(<MovedBanner target={target} onExportGarden={exportGarden} />)
    await user.click(screen.getByRole('button', { name: 'Save my garden to a file' }))
    expect(await screen.findByText(/could not be put into a file just now/i)).toBeInTheDocument()
    expect(saveTextFile).not.toHaveBeenCalled()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('says which photos the file had to leave out', async () => {
    const user = userEvent.setup()
    saveTextFile.mockResolvedValue('saved')
    const leftOut = 'One photo in the field book could not be read on this device, so the file keeps its sighting without it.'
    render(<MovedBanner target={target} onExportGarden={() => Promise.resolve({ text: '{}', leftOut })} />)
    await user.click(screen.getByRole('button', { name: 'Save my garden to a file' }))
    expect(await screen.findByText(leftOut)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open garden.example.org' })).toBeInTheDocument()
  })
})

describe('arriving with a backup', () => {
  const backup = () =>
    new File(['{"format":"the-butterfly-garden"}'], 'garden.json', {
      type: 'application/json',
    })

  it('lets a newcomer bring a garden in instead of starting one', async () => {
    const user = userEvent.setup()
    const onRestore = vi.fn(() => Promise.resolve({ ok: true, message: 'Restored.' }))
    render(<Onboarding onComplete={vi.fn()} onRestore={onRestore} />)

    await user.click(screen.getByRole('button', { name: 'I have a backup' }))
    await user.upload(screen.getByLabelText('Choose a backup'), backup())
    expect(onRestore).toHaveBeenCalledWith('{"format":"the-butterfly-garden"}')
  })

  it('opens ready to restore when sent from the old address, and tidies the address after', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '/garden/#/arrive')
    const onRestore = vi.fn(() => Promise.resolve({ ok: true, message: 'Restored.' }))
    render(<Onboarding onComplete={vi.fn()} onRestore={onRestore} arriving />)

    expect(screen.getByText(/welcome to the garden’s new home/i)).toBeInTheDocument()
    await user.upload(screen.getByLabelText('Choose a backup'), backup())
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/garden/')
  })

  it('explains a refused backup and keeps the choice open', async () => {
    const user = userEvent.setup()
    const onRestore = vi.fn(() =>
      Promise.resolve({ ok: false, message: 'That file is not a garden backup.' }),
    )
    render(<Onboarding onComplete={vi.fn()} onRestore={onRestore} arriving />)
    await user.upload(screen.getByLabelText('Choose a backup'), backup())
    expect(screen.getByRole('status')).toHaveTextContent('That file is not a garden backup.')
  })

  it('points a newcomer at the old address to the new one', () => {
    render(
      <Onboarding onComplete={vi.fn()} movedTo={new URL('https://garden.example.org/')} />,
    )
    expect(screen.getByRole('link', { name: 'garden.example.org' })).toBeInTheDocument()
  })
})
