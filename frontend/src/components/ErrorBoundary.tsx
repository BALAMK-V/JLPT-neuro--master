/**
 * React error boundary component.
 *
 * Catches unhandled render/lifecycle errors in any descendant component tree
 * and renders a user-friendly fallback instead of crashing the whole page.
 *
 * Usage
 * -----
 * Wrap any section of the tree that may throw:
 * ```tsx
 * <ErrorBoundary>
 *   <SomePage />
 * </ErrorBoundary>
 *
 * // Custom fallback UI:
 * <ErrorBoundary fallback={<p>Something went wrong.</p>}>
 *   <RiskyWidget />
 * </ErrorBoundary>
 * ```
 *
 * Limitation: Error boundaries only catch errors during rendering,
 * in lifecycle methods, and in constructors.  Async errors (e.g. inside
 * event handlers or `useEffect`) must be handled separately.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** Component tree to render when no error has occurred. */
  children: ReactNode;
  /**
   * Optional custom fallback UI.  When omitted a default card with a
   * "Reload page" button is shown.
   */
  fallback?: ReactNode;
  /**
   * Optional callback invoked whenever an error is caught.
   * Use it to send error reports to a monitoring service.
   */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  /** True after a render error has been caught. */
  hasError: boolean;
  /** The caught error instance (null before any error occurs). */
  error: Error | null;
}

/**
 * Class-based error boundary (class components are required by React for
 * `componentDidCatch` / `getDerivedStateFromError`).
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * Update state so the next render shows the fallback UI.
   * Called synchronously during the render phase that threw.
   */
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * Log error details after the component tree has finished rendering
   * the fallback.  This is the right place to report to an error tracker.
   */
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary] Caught render error:", error, info);
    this.props.onError?.(error, info);
  }

  /** Reset the error state so the user can try again. */
  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback !== undefined) {
      return this.props.fallback;
    }

    return (
      <div
        role="alert"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "200px",
          padding: "2rem",
          gap: "1rem",
          textAlign: "center",
          color: "var(--text-secondary, #888)",
        }}
      >
        <div style={{ fontSize: "2rem" }}>⚠</div>
        <p style={{ margin: 0, fontWeight: 600, color: "var(--text, #ccc)" }}>
          Something went wrong
        </p>
        <p style={{ margin: 0, fontSize: "0.875rem" }}>
          {this.state.error?.message ?? "An unexpected error occurred."}
        </p>
        <button
          className="btn btn--primary"
          onClick={this.handleReset}
          style={{ marginTop: "0.5rem" }}
        >
          Try again
        </button>
      </div>
    );
  }
}
