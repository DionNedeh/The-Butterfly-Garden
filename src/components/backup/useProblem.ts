import { useCallback, useState } from 'react'

/**
 * What went wrong, to be said aloud in a dialog's alert. Each telling gets
 * an alert of its own (its `said` is the element's key), so the same words a
 * second time, after a second wrong try, are heard a second time; an alert
 * whose text does not change says nothing.
 */
export function useProblem() {
  const [problem, setProblem] = useState({ text: '', said: 0 })
  const say = useCallback(
    (text: string) => setProblem((before) => ({ text, said: before.said + 1 })),
    [],
  )
  return [problem, say] as const
}
