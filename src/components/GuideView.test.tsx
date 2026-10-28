import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../lib/progression'
import type { Profile } from '../types'
import { GuideView } from './GuideView'

function renderGuide(profile: Partial<Profile> = {}) {
  const state = createInitialState('Tester', 'Test Garden')
  render(
    <GuideView state={{ ...state, profile: { ...state.profile!, ...profile } }} onShowSeed={vi.fn()} />,
  )
}

describe('the Guide on Moonlight and Sunlight', () => {
  it('speaks of the gardener’s own evening and late night', () => {
    renderGuide({ recapOpensHour: 21, recapGraceEndsHour: 6 })
    expect(screen.getByText(/From 9\s?PM you can round out your day/)).toBeInTheDocument()
    expect(screen.getByText(/keeps offering yesterday until 6\s?AM/)).toBeInTheDocument()
  })

  it('says nothing of a late night that ends at midnight', () => {
    renderGuide({ recapGraceEndsHour: 0 })
    expect(screen.queryByText(/keeps offering yesterday/)).toBeNull()
    expect(screen.getByText(/Both hours can be moved in Settings/)).toBeInTheDocument()
  })

  it('says the next Sunlight tends the plant chosen on Today', () => {
    renderGuide()
    expect(screen.getByText(/tending the plant you chose on Today/)).toBeInTheDocument()
  })
})

function renderGuideWith(
  props: Partial<Parameters<typeof GuideView>[0]> = {},
  profile: Partial<Profile> = {},
) {
  const state = createInitialState('Tester', 'Test Garden')
  const handlers = { onShowSeed: vi.fn(), onOpenSection: vi.fn(), onReturn: vi.fn() }
  const view = render(
    <GuideView
      state={{ ...state, profile: { ...state.profile!, ...profile } }}
      {...handlers}
      {...props}
    />,
  )
  return { ...handlers, ...view }
}

describe('the Guide as a reference', () => {
  it('lists its sections, each a link to its own address', () => {
    renderGuideWith()
    const contents = within(screen.getByRole('navigation', { name: 'In this guide' }))
    expect(contents.getByRole('link', { name: 'Find your next companion' })).toHaveAttribute(
      'href',
      '#/guide/species',
    )
    expect(contents.getByRole('link', { name: 'Nectar and Stardust' })).toHaveAttribute(
      'href',
      '#/guide/nectar-and-stardust',
    )
    expect(contents.getByRole('link', { name: 'Bond levels' })).toHaveAttribute('href', '#/guide/bond')
    // No region chosen, so no section for one.
    expect(contents.queryByRole('link', { name: 'Where you live' })).toBeNull()
  })

  it('moves focus to a section’s heading when its link is followed', async () => {
    const user = userEvent.setup()
    const { onOpenSection } = renderGuideWith()
    const contents = within(screen.getByRole('navigation', { name: 'In this guide' }))
    await user.click(contents.getByRole('link', { name: 'Bond levels' }))
    expect(onOpenSection).toHaveBeenCalledWith('bond')
    expect(screen.getByRole('heading', { level: 2, name: 'Bond levels' })).toHaveFocus()
    // Followed again, it takes focus again.
    screen.getByRole('searchbox', { name: 'Search the guide' }).focus()
    await user.click(contents.getByRole('link', { name: 'Bond levels' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Bond levels' })).toHaveFocus()
    await user.click(contents.getByRole('link', { name: 'Find your next companion' }))
    expect(screen.getByRole('heading', { level: 2, name: 'Find your next companion' })).toHaveFocus()
  })

  it('opens at the section the address names, and leaves a modified click to the browser', async () => {
    const user = userEvent.setup()
    const { onOpenSection, rerender } = renderGuideWith({ section: 'moonlight' })
    expect(
      screen.getByRole('heading', { level: 2, name: 'Moonlight — round out the evening' }),
    ).toHaveFocus()
    // Back or Forward names another section.
    const state = createInitialState('Tester', 'Test Garden')
    rerender(<GuideView state={state} onShowSeed={vi.fn()} section="jars" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Letter jars' })).toHaveFocus()
    // A new tab is the browser's business.
    const contents = within(screen.getByRole('navigation', { name: 'In this guide' }))
    await user.keyboard('{Control>}')
    await user.click(contents.getByRole('link', { name: 'Sound' }))
    await user.keyboard('{/Control}')
    expect(onOpenSection).not.toHaveBeenCalled()
  })

  it('opens at the top for a section it does not have', () => {
    renderGuideWith({ section: 'no-such-section' })
    expect(document.body).toHaveFocus()
  })

  it('finds sections and butterflies by any of their words', async () => {
    const user = userEvent.setup()
    renderGuideWith()
    const search = screen.getByRole('searchbox', { name: 'Search the guide' })
    await user.type(search, 'stardust atelier')
    expect(screen.getByRole('heading', { level: 2, name: 'Nectar and Stardust' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Letter jars' })).toBeNull()
    expect(screen.getByText('1 section matches.')).toBeInTheDocument()
    expect(document.querySelectorAll('.species-card')).toHaveLength(0)

    await user.clear(search)
    await user.type(search, 'Danaus')
    // By scientific name, and the sections say nothing of it.
    expect(document.querySelectorAll('.species-card')).toHaveLength(2)
    expect(screen.getByText('No section matches. The butterflies below may.')).toBeInTheDocument()
    expect(search).toHaveFocus()

    await user.clear(search)
    expect(screen.getByRole('heading', { level: 2, name: 'Letter jars' })).toBeInTheDocument()
    expect(document.querySelectorAll('.species-card')).toHaveLength(25)
  })

  it('clears a search hiding the section a link leads to', async () => {
    const user = userEvent.setup()
    renderGuideWith()
    await user.type(screen.getByRole('searchbox', { name: 'Search the guide' }), 'stardust')
    expect(screen.queryByRole('heading', { level: 2, name: 'Letter jars' })).toBeNull()
    const contents = within(screen.getByRole('navigation', { name: 'In this guide' }))
    await user.click(contents.getByRole('link', { name: 'Letter jars' }))
    expect(screen.getByRole('searchbox', { name: 'Search the guide' })).toHaveValue('')
    expect(screen.getByRole('heading', { level: 2, name: 'Letter jars' })).toHaveFocus()
  })

  it('offers the way back to the page a link came from', async () => {
    const user = userEvent.setup()
    const { onReturn } = renderGuideWith({ returnTo: 'care' })
    await user.click(screen.getByRole('button', { name: 'Back to Care' }))
    expect(onReturn).toHaveBeenCalled()
  })

  it('says which publishers each species was checked with', () => {
    renderGuideWith()
    const queen = screen.getByRole('heading', { level: 3, name: 'Queen' }).closest('article')!
    expect(within(queen).getByText('Checked with Butterflies and Moths of North America.')).toBeInTheDocument()
  })
})

describe('the Guide and the gardener’s region', () => {
  it('marks nothing until a region is chosen', () => {
    renderGuideWith()
    expect(screen.queryByText(/^Native to/)).toBeNull()
    expect(screen.queryByText(/^Seen in/)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Butterflies where you live' })).toBeNull()
  })

  it('marks butterflies and their host plants native to North America', () => {
    renderGuideWith({}, { region: 'north-america' })
    const queen = screen.getByRole('heading', { level: 3, name: 'Queen' }).closest('article')!
    // The butterfly, and then its host plant, named so the two are not confused.
    const [butterfly, plant] = within(queen).getAllByText(/^Native to North America/)
    expect(butterfly).toHaveTextContent('Mostly in the far south of the United States.')
    expect(plant).toHaveTextContent(/^Milkweed: Native to North America$/)
    // Brought from Europe, so seen rather than native.
    const white = screen.getByRole('heading', { level: 3, name: 'Cabbage White' }).closest('article')!
    expect(within(white).getByText(/^Seen in North America/)).toBeInTheDocument()
    // A Central American butterfly says nothing of itself; only its host
    // plant, wild in Mexico, is marked, and says so.
    const glasswing = screen.getByRole('heading', { level: 3, name: 'Glasswing' }).closest('article')!
    const marks = within(glasswing).getAllByText(/^(Native to|Seen in)/)
    expect(marks).toHaveLength(1)
    expect(marks[0]).toHaveTextContent(
      'Tropical Nightshade: Native to North America. Wild only from Mexico south.',
    )
  })

  it('says “Seen in the UK and Europe” for a visitor, and nothing for one that never comes', () => {
    renderGuideWith({}, { region: 'europe' })
    const monarch = screen.getByRole('heading', { level: 3, name: 'Monarch' }).closest('article')!
    expect(within(monarch).getByText(/^Seen in the UK and Europe/)).toBeInTheDocument()
    const admiral = screen.getByRole('heading', { level: 3, name: 'Red Admiral' }).closest('article')!
    // The butterfly and its stinging nettle.
    expect(within(admiral).getAllByText(/^Native to the UK and Europe/)).toHaveLength(2)
    const queen = screen.getByRole('heading', { level: 3, name: 'Queen' }).closest('article')!
    expect(within(queen).queryByText(/Native to|Seen in/)).toBeNull()
  })

  it('tailors the planting tips, and finds them in a search', async () => {
    const user = userEvent.setup()
    renderGuideWith({}, { region: 'europe' })
    const section = screen.getByRole('heading', { level: 2, name: 'Butterflies where you live' })
      .closest('section')!
    expect(within(section).getByText('Holly and ivy, for holly blues')).toBeInTheDocument()
    expect(within(section).getByText('Red Admiral, Painted Lady, Mourning Cloak and Cabbage White')).toBeInTheDocument()
    expect(within(section).getByText('From Butterfly Conservation.')).toBeInTheDocument()
    const contents = within(screen.getByRole('navigation', { name: 'In this guide' }))
    expect(contents.getByRole('link', { name: 'Where you live' })).toHaveAttribute(
      'href',
      '#/guide/region',
    )
    await user.type(screen.getByRole('searchbox', { name: 'Search the guide' }), 'holly blues')
    expect(screen.getByRole('heading', { level: 2, name: 'Butterflies where you live' })).toBeInTheDocument()
    await user.clear(screen.getByRole('searchbox', { name: 'Search the guide' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search the guide' }), 'jars')
    expect(screen.queryByRole('heading', { level: 2, name: 'Butterflies where you live' })).toBeNull()
  })

  it('says when none of the garden’s butterflies is native, and what to plant anyway', () => {
    renderGuideWith({}, { region: 'australasia' })
    const section = screen.getByRole('heading', { level: 2, name: 'Butterflies where you live' })
      .closest('section')!
    expect(within(section).getByText(/None of them, though the plants below/)).toBeInTheDocument()
    expect(within(section).getByText(/Painted Lady \(in Australia\)/)).toBeInTheDocument()
    expect(within(section).getByText('Finger lime, for orchard swallowtails')).toBeInTheDocument()
  })

  it('gives Elsewhere the advice that holds anywhere, and no marks', () => {
    renderGuideWith({}, { region: 'elsewhere' })
    expect(screen.queryByText(/^Native to/)).toBeNull()
    const section = screen.getByRole('heading', { level: 2, name: 'Butterflies where you live' })
      .closest('section')!
    expect(within(section).getByText('Leave out insecticides')).toBeInTheDocument()
    expect(within(section).getByText(/marks native butterflies and plants for North America/)).toBeInTheDocument()
  })
})
