import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supportLines } from '../data/support'
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
})
