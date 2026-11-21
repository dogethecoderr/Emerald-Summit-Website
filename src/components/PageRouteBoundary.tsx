import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/button';

function LoadingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div role="status" aria-live="polite" className="max-w-md space-y-3 text-center">
        <h1 className="text-xl font-semibold">Opening page…</h1>
        <p className="text-sm text-muted-foreground">This may take a moment on a slow connection.</p>
        <Button variant="outline" asChild><Link to="/home">Back to Home</Link></Button>
      </div>
    </main>
  );
}

interface BoundaryProps { children: ReactNode; resetKey: string }
interface BoundaryState { failed: boolean; resetKey: string }

class PageErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromProps({ resetKey }: BoundaryProps, state: BoundaryState) {
    return resetKey === state.resetKey ? null : { failed: false, resetKey };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Keep this in the existing bug-report diagnostics, without exposing a
    // stack trace or implementation details in the recovery screen.
    console.error('Page failed to open', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div role="alert" className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">This page couldn’t open</h1>
          <p className="text-sm text-muted-foreground">
            Check your connection and reload the page. If the website was updated while you were here,
            reloading will get the latest version.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => window.location.reload()}>Reload page</Button>
            <Button variant="outline" asChild><Link to="/home">Back to Home</Link></Button>
          </div>
        </div>
      </main>
    );
  }
}

/**
 * Route chunks can be slow, unavailable after a deployment, or fail to render.
 * Keep both pending and failed navigation visible. A new history entry clears
 * an error without remounting healthy pages that use query-string navigation.
 */
export default function PageRouteBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <PageErrorBoundary resetKey={location.key}>
      <Suspense fallback={<LoadingPage />}>{children}</Suspense>
    </PageErrorBoundary>
  );
}
