import { fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SWIPE_DISTANCE, useSwipe } from './useSwipe'

/**
 * A row the way Today uses one: the swipe handlers on the row, a button inside
 * it that a swipe can end over, and the row's offset where a test can read it.
 */
function Row({
  onRight,
  onLeft,
  disabled,
  onTap,
}: {
  onRight?: () => void
  onLeft?: () => void
  disabled?: boolean
  onTap?: () => void
}) {
  const swipe = useSwipe({ onRight, onLeft, disabled })
  return createElement(
    'article',
    { 'aria-label': 'Water the ferns', ...swipe.handlers },
    createElement('button', { onClick: onTap }, 'Care'),
    createElement('output', { 'aria-label': 'Offset' }, String(swipe.offset)),
  )
}

function renderRow(props: { disabled?: boolean; right?: boolean; left?: boolean } = {}) {
  const { disabled, right = true, left = true } = props
  const onRight = vi.fn()
  const onLeft = vi.fn()
  const onTap = vi.fn()
  render(
    createElement(Row, {
      onRight: right ? onRight : undefined,
      onLeft: left ? onLeft : undefined,
      disabled,
      onTap,
    }),
  )
  return { onRight, onLeft, onTap }
}

const button = () => screen.getByRole('button', { name: 'Care' })
const offset = () => screen.getByRole('status', { name: 'Offset' }).textContent

type Pointer = { pointerType?: string; pointerId?: number }

/** Where the last drag left the finger, for the lift that follows it. */
let lastX = 0

/** A finger (by default) going down at the origin and moving through each point. */
function drag(points: Array<[x: number, y: number]>, pointer: Pointer = {}) {
  const init = { pointerType: 'touch', pointerId: 1, ...pointer }
  fireEvent.pointerDown(button(), { ...init, clientX: 0, clientY: 0 })
  lastX = 0
  for (const [clientX, clientY] of points) {
    fireEvent.pointerMove(button(), { ...init, clientX, clientY })
    lastX = clientX
  }
}

/** The finger leaves the screen, where the drag left it unless told otherwise. */
function lift(pointer: Pointer = {}, clientX = lastX) {
  fireEvent.pointerUp(button(), { pointerType: 'touch', pointerId: 1, clientX, clientY: 0, ...pointer })
}

afterEach(() => vi.useRealTimers())

describe('swiping a row', () => {
  it('moves the row with a finger going sideways', () => {
    renderRow()
    drag([[24, 3]])
    expect(offset()).toBe('24')
  })

  it('calls the right-hand action once a finger travels far enough right', () => {
    const { onRight, onLeft } = renderRow()
    drag([
      [20, 2],
      [SWIPE_DISTANCE, 4],
    ])
    expect(offset()).toBe(String(SWIPE_DISTANCE))
    lift()
    expect(onRight).toHaveBeenCalledOnce()
    expect(onLeft).not.toHaveBeenCalled()
    expect(offset()).toBe('0')
  })

  it('calls the left-hand action once a finger travels far enough left', () => {
    const { onRight, onLeft } = renderRow()
    drag([
      [-20, 2],
      [-SWIPE_DISTANCE - 30, -5],
    ])
    expect(offset()).toBe(String(-SWIPE_DISTANCE - 30))
    lift()
    expect(onLeft).toHaveBeenCalledOnce()
    expect(onRight).not.toHaveBeenCalled()
    expect(offset()).toBe('0')
  })

  it('does nothing for a swipe that stops short, and puts the row back', () => {
    const { onRight, onLeft } = renderRow()
    drag([[SWIPE_DISTANCE - 1, 0]])
    lift()
    drag([[-(SWIPE_DISTANCE - 1), 0]])
    lift()
    expect(onRight).not.toHaveBeenCalled()
    expect(onLeft).not.toHaveBeenCalled()
    expect(offset()).toBe('0')
  })

  it('leaves a mostly vertical drag to the page, however far sideways it goes later', () => {
    const { onRight, onLeft } = renderRow()
    drag([
      [6, 14],
      [SWIPE_DISTANCE + 40, 20],
    ])
    expect(offset()).toBe('0')
    lift()
    expect(onRight).not.toHaveBeenCalled()
    expect(onLeft).not.toHaveBeenCalled()
  })

  it('ignores a mouse, which has the buttons instead', () => {
    const { onRight, onLeft } = renderRow()
    drag([[SWIPE_DISTANCE + 40, 0]], { pointerType: 'mouse' })
    expect(offset()).toBe('0')
    lift({ pointerType: 'mouse' })
    drag([[-SWIPE_DISTANCE - 40, 0]], { pointerType: 'mouse' })
    lift({ pointerType: 'mouse' })
    expect(onRight).not.toHaveBeenCalled()
    expect(onLeft).not.toHaveBeenCalled()
  })

  it('ignores every finger while it is turned off', () => {
    const { onRight } = renderRow({ disabled: true })
    drag([[SWIPE_DISTANCE + 40, 0]])
    expect(offset()).toBe('0')
    lift()
    expect(onRight).not.toHaveBeenCalled()
  })

  it('waits for the finger to move a few pixels before deciding which way it is going', () => {
    const { onRight } = renderRow()
    // Mostly downward, but too small to count as the start of a scroll.
    drag([[2, 8]])
    expect(offset()).toBe('0')
    fireEvent.pointerMove(button(), { pointerType: 'touch', pointerId: 1, clientX: 40, clientY: 8 })
    expect(offset()).toBe('40')
    // Once it is sideways, the wobble of a thumb does not cancel it.
    fireEvent.pointerMove(button(), { pointerType: 'touch', pointerId: 1, clientX: 80, clientY: 70 })
    expect(offset()).toBe('80')
    lift({}, 80)
    expect(onRight).toHaveBeenCalledOnce()
  })

  it('does not move the row in a direction that has nothing to do', () => {
    const { onRight } = renderRow({ left: false })
    drag([[-SWIPE_DISTANCE - 40, 0]])
    expect(offset()).toBe('0')
    lift()
    // The other direction still works.
    drag([[SWIPE_DISTANCE, 0]])
    expect(offset()).toBe(String(SWIPE_DISTANCE))
    lift()
    expect(onRight).toHaveBeenCalledOnce()
  })

  it('follows only the finger that started the swipe', () => {
    renderRow()
    drag([[30, 0]])
    fireEvent.pointerMove(button(), { pointerType: 'touch', pointerId: 2, clientX: 200, clientY: 0 })
    expect(offset()).toBe('30')
  })

  it('puts the row back when the browser takes the gesture over', () => {
    const { onRight } = renderRow()
    drag([[SWIPE_DISTANCE + 20, 0]])
    fireEvent.pointerCancel(button(), { pointerType: 'touch', pointerId: 1 })
    expect(offset()).toBe('0')
    lift()
    expect(onRight).not.toHaveBeenCalled()
  })

  it('counts a quick flick by where the finger is lifted, not where the row last rendered', () => {
    // A flick lifts before its last move is drawn: the row shows 30, the
    // finger is at 120.
    const { onRight, onLeft } = renderRow()
    drag([[30, 0]])
    lift({}, 120)
    expect(onRight).toHaveBeenCalledOnce()
    // And the other way: drawn past the line, lifted well short of it.
    drag([[-SWIPE_DISTANCE - 10, 0]])
    lift({}, -10)
    expect(onLeft).not.toHaveBeenCalled()
  })

  it('counts nothing for a finger that never set off sideways', () => {
    const { onRight } = renderRow()
    fireEvent.pointerDown(button(), { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    lift({}, SWIPE_DISTANCE + 20)
    expect(onRight).not.toHaveBeenCalled()
  })

  it('swallows the click that ends a completed swipe, and only that one', () => {
    const { onRight, onTap } = renderRow()
    drag([[SWIPE_DISTANCE + 20, 0]])
    lift()
    fireEvent.click(button())
    expect(onRight).toHaveBeenCalledOnce()
    expect(onTap).not.toHaveBeenCalled()

    fireEvent.click(button())
    expect(onTap).toHaveBeenCalledOnce()
  })

  it('lets a later press through, by key or by voice, after a swipe that sent no click', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { onRight, onTap } = renderRow()
    drag([[SWIPE_DISTANCE + 20, 0]])
    lift()
    expect(onRight).toHaveBeenCalledOnce()
    vi.setSystemTime(Date.now() + 2000)
    fireEvent.click(button())
    expect(onTap).toHaveBeenCalledOnce()
  })

  it('lets an ordinary tap through, and a swipe that stops short', () => {
    const { onTap } = renderRow()
    fireEvent.pointerDown(button(), { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    lift()
    fireEvent.click(button())
    expect(onTap).toHaveBeenCalledOnce()

    drag([[SWIPE_DISTANCE - 1, 0]])
    lift()
    fireEvent.click(button())
    expect(onTap).toHaveBeenCalledTimes(2)
  })
})
