/**
 * How long a page loaded for the first time may take to appear in a test that
 * renders the whole app. Pages arrive as lazy chunks, which a busy machine (a
 * loaded CI runner) can take seconds to transform; finding one sooner is what
 * every wait expects.
 */
export const LAZY_PAGE_MS = 8000
