import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surface to console for debugging — published preview otherwise blanks out silently.
    console.error("App ErrorBoundary caught:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.assign("/");
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
          <div className="max-w-md w-full glass glass-purple p-8 text-center">
            <h1 className="font-display text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-sm text-muted-foreground mb-6">
              The app hit an unexpected error. Reload to get back on track.
            </p>
            <pre className="text-[11px] text-left whitespace-pre-wrap text-muted-foreground bg-muted/30 rounded-lg p-3 mb-5 overflow-auto max-h-40">
              {this.state.error?.message ?? "Unknown error"}
            </pre>
            <button
              onClick={this.handleReset}
              className="w-full rounded-lg bg-gradient-to-r from-primary to-secondary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              Reload app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
