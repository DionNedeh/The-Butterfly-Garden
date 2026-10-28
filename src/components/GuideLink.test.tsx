import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GuideLink } from './GuideLink'

describe('GuideLink', () => {
  it('is a link to the section, named first by the words it shows', async () => {
    const onOpen = vi.fn()
    render(<GuideLink section="stardust" topic="Stardust" onOpen={onOpen} />)
    const link = screen.getByRole('link', { name: 'What does this do? Stardust, in the Guide' })
    expect(link).toHaveTextContent(/^What does this do\?$/)
    expect(link).toHaveAttribute('href', '#/guide/stardust')
    await userEvent.click(link)
    expect(onOpen).toHaveBeenCalledWith('stardust')
  })

  it('leaves a new tab, or any but the main button, to the browser', () => {
    const onOpen = vi.fn()
    render(<GuideLink section="bond" topic="Bond levels" onOpen={onOpen} />)
    const link = screen.getByRole('link')
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      fireEvent.click(link, init)
    }
    expect(onOpen).not.toHaveBeenCalled()
  })
})
