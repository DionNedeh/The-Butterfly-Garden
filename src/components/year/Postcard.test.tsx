import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backdropAssets } from '../../data/backdropAssets'
import { createInitialState } from '../../lib/progression'
import { saveImageFile } from '../../lib/saveImage'
import { fakeDevice, picture } from '../../test/fakePostcard'
import type { AppState, CustomBackdrop } from '../../types'
import { Postcard } from './Postcard'

vi.mock('../../lib/saveImage', () => ({ saveImageFile: vi.fn() }))
const save = vi.mocked(saveImageFile)

const created = vi.fn((blob: Blob) => {
  void blob
  return 'blob:postcard'
})
const revoked = vi.fn()

beforeEach(() => {
  // jsdom has no object URLs; the preview needs one.
  Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'canShare')
  Reflect.deleteProperty(navigator, 'share')
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

/** A garden with words in its journal that must never reach the card. */
function garden(extra: Partial<AppState> = {}): AppState {
  const base = createInitialState('Robin', 'Quiet Corner', new Date(2026, 2, 1, 9))
  return {
    ...base,
    moods: [
      {
        id: 'mood-1',
        localDate: '2026-04-05',
        level: 4,
        note: 'Private words, starred',
        starred: true,
        createdAt: '2026-04-05T16:00:00.000Z',
        updatedAt: '2026-04-05T16:00:00.000Z',
      },
    ],
    creatures: [
      { ...base.creatures[0], name: 'Sol', stage: 'butterfly' },
      { ...base.creatures[0], id: 'fern', name: 'Fern', speciesId: 'red-admiral', stage: 'butterfly' },
    ],
    ...extra,
  }
}

/** Give jsdom the share sheet a phone browser would have. */
function stubShareSheet(share: () => Promise<void> = () => Promise.resolve()) {
  const sheet = { canShare: vi.fn(() => true), share: vi.fn(share) }
  Object.defineProperty(navigator, 'canShare', { value: sheet.canShare, configurable: true })
  Object.defineProperty(navigator, 'share', { value: sheet.share, configurable: true })
  return sheet
}

async function makePostcard(state = garden(), device = fakeDevice()) {
  const user = userEvent.setup()
  render(<Postcard state={state} year={2026} today="2026-10-27" device={device.device} />)
  const make = screen.getByRole('button', { name: 'Make a postcard' })
  expect(screen.queryByRole('img')).toBeNull()
  expect(device.load).not.toHaveBeenCalled()
  await user.click(make)
  return { user, make, ...device }
}

describe('the year’s postcard', () => {
  it('is made only when asked, from the scene, the butterflies, the name and the year', async () => {
    const { make, surfaces, load } = await makePostcard()
    expect(await screen.findByRole('status')).toHaveTextContent('Your postcard is ready.')
    const preview = screen.getByRole('img', {
      name: 'A postcard of Quiet Corner for 2026: a Monarch and a Red Admiral, over the Sunlit Meadow.',
    })
    expect(preview).toHaveAttribute('src', 'blob:postcard')
    expect(load).toHaveBeenCalledWith(backdropAssets['sunlit-meadow'].image)
    // Nothing from the journal is ever drawn: only the name and the year.
    const words = surfaces[0].calls.filter((call) => call[0] === 'fillText').map((call) => call[1])
    expect(words).toEqual(['Quiet Corner', '2026'])
    // The button that made it stays, so focus never falls to the page.
    expect(make).toHaveAccessibleName('Make it again')
    expect(make).toHaveFocus()
  })

  it('names only what made it onto the card', async () => {
    await makePostcard(
      garden(),
      fakeDevice({ pictures: (src) => (src.startsWith('data:image/svg') ? picture('butterfly') : undefined) }),
    )
    expect(
      await screen.findByRole('img', {
        name: 'A postcard of Quiet Corner for 2026: a Monarch and a Red Admiral.',
      }),
    ).toBeInTheDocument()
  })

  it('is drawn on the gardener’s own picture when the garden shows it by day', async () => {
    const own: CustomBackdrop = {
      id: 'own',
      name: 'The beach',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      mimeType: 'image/webp',
      width: 4,
      height: 4,
      byteLength: 3,
      imageData: 'AAAA',
      crop: { x: 0.5, y: 0.5, zoom: 1 },
    }
    const base = garden()
    const { load } = await makePostcard({
      ...base,
      customBackdrops: [own],
      profile: { ...base.profile!, selectedCustomBackdropId: 'own' },
    })
    await screen.findByRole('img', { name: /over your own picture\.$/ })
    expect(load).toHaveBeenCalledWith('data:image/webp;base64,AAAA')
  })

  it('says so when this device cannot make it', async () => {
    const { make } = await makePostcard(garden(), fakeDevice({ canvas: false }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'The postcard could not be made on this device.',
    )
    expect(screen.queryByRole('img')).toBeNull()
    expect(make).toHaveFocus()
  })

  it('lets go of the preview’s address when it leaves', async () => {
    const { unmount } = render(
      <Postcard state={garden()} year={2026} today="2026-10-27" device={fakeDevice().device} />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Make a postcard' }))
    await screen.findByRole('img')
    expect(revoked).not.toHaveBeenCalled()
    unmount()
    expect(revoked).toHaveBeenCalledWith('blob:postcard')
  })
})

describe('sharing the postcard', () => {
  it('is offered only where the browser can share an image', async () => {
    await makePostcard()
    await screen.findByRole('img')
    expect(screen.queryByRole('button', { name: /^Share/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Save image' })).toBeInTheDocument()
  })

  it('hands the image to the share sheet, and says what became of it', async () => {
    const sheet = stubShareSheet()
    const { user } = await makePostcard()
    await screen.findByRole('img')
    await user.click(screen.getByRole('button', { name: 'Share…' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Postcard shared.'))
    const [shared] = sheet.share.mock.calls[0] as unknown as [ShareData]
    expect(shared.files?.[0]?.name).toBe('butterfly-garden-postcard-2026.jpg')
    expect(shared.files?.[0]?.type).toBe('image/jpeg')
    expect(shared.title).toBe('Quiet Corner, 2026')
  })

  it('says nothing was shared when the sheet is closed', async () => {
    stubShareSheet(() => Promise.reject(new DOMException('Share canceled', 'AbortError')))
    const { user } = await makePostcard()
    await screen.findByRole('img')
    await user.click(screen.getByRole('button', { name: 'Share…' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Nothing was shared.'))
  })

  it('says so when the browser will not share it', async () => {
    stubShareSheet(() => Promise.reject(new DOMException('No gesture', 'NotAllowedError')))
    const { user } = await makePostcard()
    await screen.findByRole('img')
    await user.click(screen.getByRole('button', { name: 'Share…' }))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'This browser would not share the postcard. Save it instead.',
      ),
    )
  })
})

describe('saving the postcard', () => {
  const saved = async (outcome: () => ReturnType<typeof saveImageFile>, said: string) => {
    save.mockImplementationOnce(outcome)
    const { user } = await makePostcard()
    await screen.findByRole('img')
    await user.click(screen.getByRole('button', { name: 'Save image' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(said))
    expect(save).toHaveBeenCalledWith('butterfly-garden-postcard-2026.jpg', expect.any(Blob))
  }

  it('says a browser download has started, and no more', async () => {
    await saved(() => Promise.resolve('started'), 'Your postcard is downloading. Check your downloads.')
  })

  it('says it was saved when the app’s save screen wrote it', async () => {
    await saved(() => Promise.resolve('saved'), 'Postcard saved.')
  })

  it('says nothing was saved when the save screen was closed', async () => {
    await saved(() => Promise.resolve('cancelled'), 'No image was saved.')
  })

  it('says so when a browser will not start the download', async () => {
    await saved(() => Promise.reject(new Error('no')), 'This browser would not start the download.')
  })

  it('says so when the app could not write it there', async () => {
    vi.stubEnv('VITE_PLATFORM', 'android')
    await saved(
      () => Promise.reject(new Error('no')),
      'The postcard could not be saved there. Try choosing another place.',
    )
  })
})
