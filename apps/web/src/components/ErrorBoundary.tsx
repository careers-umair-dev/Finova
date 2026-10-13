import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Last line of defence: a render error shows a calm fallback instead of a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('UI error:', error, info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="grid min-h-screen place-items-center p-6 text-center">
        <div className="max-w-sm rounded-[28px] bg-white p-8 shadow-lift">
          <h1 className="text-xl font-medium">Something went wrong</h1>
          <p className="mb-5 mt-2 text-mu">The page hit an unexpected problem. Your data is safe. Reloading usually fixes it.</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>Reload Finova</button>
        </div>
      </div>
    );
  }
}
