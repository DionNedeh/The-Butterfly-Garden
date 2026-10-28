import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveTextFile } from '../lib/download'
import { gardenRepository } from '../repository/gardenRepository'
import { ArrayBufferFileReader, unreadablePhoto } from '../test/fileReader'
import { ViewProblem } from './ViewProblem'

vi.mock('../lib/download', async (original) => ({
  ...(await original<typeof import('../lib/download')>()),
  saveTextFile: vi.fn(),
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.mocked(saveTextFile).mockReset()
})

describe('a page that could not be shown', () => {
  it('leads back to the garden', async () => {
    const onHome = vi.fn()
    render(<ViewProblem onHome={onHome} />)
    expect(screen.getByRole('alert')).toHaveTextContent('This page could not be shown')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Back to the garden' }))
    expect(onHome).toHaveBeenCalledOnce()
  })

  it('keeps a copy of everything stored, or says why not', async () => {
    const readRaw = vi.spyOn(gardenRepository, 'readRaw').mockResolvedValue({ garden: {} })
    const user = userEvent.setup()
    render(<ViewProblem onHome={vi.fn()} />)
    const download = screen.getByRole('button', { name: "Download what's stored" })

    vi.mocked(saveTextFile).mockResolvedValueOnce('started')
    await user.click(download)
    expect(await screen.findByText(/Keep that file/)).toBeInTheDocument()

    vi.mocked(saveTextFile).mockResolvedValueOnce('cancelled')
    await user.click(download)
    expect(await screen.findByText('Nothing was saved.')).toBeInTheDocument()

    readRaw.mockRejectedValueOnce(new Error('blocked'))
    await user.click(download)
    expect(await screen.findByText('What is stored could not be read just now.')).toBeInTheDocument()
  })

  it('keeps everything stored when a photo cannot be read, and says which was left out', async () => {
    vi.stubGlobal('FileReader', ArrayBufferFileReader)
    vi.spyOn(gardenRepository, 'readRaw').mockResolvedValue({
      stores: { sightings: { current: [{ id: 'lost', photo: unreadablePhoto() }] } },
    })
    vi.mocked(saveTextFile).mockResolvedValueOnce('started')
    render(<ViewProblem onHome={vi.fn()} />)
    await userEvent.setup().click(screen.getByRole('button', { name: "Download what's stored" }))
    expect(
      await screen.findByText(
        'Keep that file: it holds everything this app has stored. One photo in the field book could not be read on this device, so the file keeps its sighting without it.',
      ),
    ).toBeInTheDocument()
    expect(vi.mocked(saveTextFile).mock.calls[0][2]).toContain('"unreadable": true')
  })
})
