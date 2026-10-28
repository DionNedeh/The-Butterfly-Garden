import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { SafeMode } from './SafeMode'

vi.mock('./move/ArriveRestore', () => { throw new Error('Chunk unavailable') })
it('keeps ordinary restore available when the arrival chunk cannot load', async () => {
  const user = userEvent.setup()
  render(<SafeMode error={new Error('Broken view')} />)
  await user.click(screen.getByRole('button', { name: 'Arrive from another device' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Restore a backup still works')
  expect(screen.getByLabelText('Restore a backup')).toHaveAttribute('type', 'file')
})
