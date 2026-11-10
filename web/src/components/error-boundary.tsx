import { Component, type ErrorInfo, type ReactNode } from "react";
import { exportWorkspace, resetWorkspace } from "@/lib/persist";

type State = { failed: boolean };

/** If saved data ever breaks the page, offer a way out instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("OpenSecMaturity hit an error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-ink">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-sm text-ink-muted">
          The saved assessment in this browser could not be shown. You can save a copy of it to a file first, then start over.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={exportWorkspace} className="min-h-11 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink">
            Save a copy to file
          </button>
          <button type="button" onClick={resetWorkspace} className="min-h-11 rounded-lg bg-brand px-4 text-sm font-medium text-on-brand">
            Start over
          </button>
        </div>
      </main>
    );
  }
}
