import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supportLines } from '../data/support'
import { createInitialState } from '../lib/progression'
import { SupportView } from './SupportView'

describe('if you need support now', () => {
  it('hands every contact to the phone or the browser, never to the app', () => {
    render(<SupportView onBack={vi.fn()} backLabel="Back to Settings" />)
    expect(screen.getByRole('heading', { level: 1, name: 'If you need support now' })).toBeInTheDocument()
    expect(screen.getByText(/911 in the United States and Canada, 999 or 112/)).toBeInTheDocument()

    for (const line of supportLines) {
      expect(screen.getByRole('heading', { name: line.name })).toBeInTheDocument()
      for (const contact of line.contacts) {
        const link = screen.getAllByRole('link', { name: contact.label })[0]
        expect(link).toHaveAttribute('href', contact.href)
        expect(contact.href).toMatch(/^(tel:|sms:|https:\/\/)/)
        if (contact.href.startsWith('https:')) {
          expect(link).toHaveAttribute('target', '_blank')
          expect(link).toHaveAttribute('rel', 'noopener noreferrer')
        }
      }
    }
    expect(screen.getByRole('link', { name: 'Call 116 123' })).toHaveAttribute('href', 'tel:116123')
    expect(screen.getByText(/checked with each service on/)).toBeInTheDocument()
  })

  it('goes back to where it was opened from', async () => {
    const onBack = vi.fn()
    render(<SupportView onBack={onBack} backLabel="Back to Today" />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Back to Today' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('offers breathing with a butterfly quietly, beneath the people and never in their place', async () => {
    const onBreathe = vi.fn()
    render(
      <SupportView
        onBack={vi.fn()}
        backLabel="Back to Settings"
        state={createInitialState('Robin', 'Calm')}
        onBreathe={onBreathe}
      />,
    )
    const link = screen.getByRole('link', { name: 'breathe with Marigold' })
    expect(link.closest('p')).toHaveTextContent(
      'If a quiet minute would help, you can breathe with Marigold. It is a calming exercise, not a substitute for the people above.',
    )
    // Below every line of support.
    const lastLine = screen.getAllByRole('listitem').at(-1)!
    expect(lastLine.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await userEvent.setup().click(link)
    expect(onBreathe).toHaveBeenCalledOnce()
  })

  it('says nothing of breathing where it cannot be opened', () => {
    render(<SupportView onBack={vi.fn()} backLabel="Back to Settings" />)
    expect(screen.queryByRole('link', { name: /breathe/i })).toBeNull()
  })
})
