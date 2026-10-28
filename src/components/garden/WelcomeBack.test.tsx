import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../../lib/progression'
import { welcomeBackLine } from '../../lib/welcomeBack'
import { WelcomeBack } from './WelcomeBack'

describe('WelcomeBack', () => {
  const garden = createInitialState('Tester', 'Test Garden')

  it('says the line for the day, with one thing to do: put it away', async () => {
    const onPutAway = vi.fn()
    render(<WelcomeBack garden={garden} returnedOn="2026-10-27" onPutAway={onPutAway} />)
    const card = screen.getByRole('group', { name: 'Welcome back' })
    expect(card).toHaveTextContent(welcomeBackLine(garden, '2026-10-27'))
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    // The name starts with the words on the button, for voice control.
    expect(buttons[0]).toHaveAccessibleName('Put away')
    await userEvent.setup().click(buttons[0])
    expect(onPutAway).toHaveBeenCalledTimes(1)
  })

  it('keeps its line while the garden changes under it', () => {
    const { rerender } = render(
      <WelcomeBack garden={garden} returnedOn="2026-10-27" onPutAway={() => undefined} />,
    )
    const said = screen.getByRole('group', { name: 'Welcome back' }).textContent
    rerender(
      <WelcomeBack
        garden={{ ...garden, plants: [], creatures: [] }}
        returnedOn="2026-10-27"
        onPutAway={() => undefined}
      />,
    )
    expect(screen.getByRole('group', { name: 'Welcome back' }).textContent).toBe(said)
  })
})
