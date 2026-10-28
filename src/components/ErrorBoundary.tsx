import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  /** What to show instead of the children once they have thrown. */
  fallback: (error: Error, reset: () => void) => ReactNode
  children: ReactNode
  /**
   * Changing this clears a caught error -- moving to another page, for
   * instance, gives that page a fresh chance to render.
   */
  resetKey?: unknown
}

interface ErrorBoundaryState {
  error?: Error
  resetKey?: unknown
}

/**
 * Catches a render error so one broken part cannot blank the whole app.
 *
 * Before this existed, a single malformed entry anywhere in the garden left a
 * white page on every launch, with no way to reach Settings to restore a
 * backup. React only offers this as a class component.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return {
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey !== state.resetKey) {
      return { error: undefined, resetKey: props.resetKey }
    }
    return null
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept on this device: the app sends nothing anywhere, errors included.
    console.error('The Butterfly Garden hit a problem:', error, info.componentStack)
  }

  private reset = () => {
    this.setState({ error: undefined })
  }

  render() {
    if (this.state.error) return this.props.fallback(this.state.error, this.reset)
    return this.props.children
  }
}
