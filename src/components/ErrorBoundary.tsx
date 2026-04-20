import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-sm">
          <p className="font-medium text-destructive mb-1">Something went wrong loading this section.</p>
          <p className="text-muted-foreground">
            {this.state.error?.message ?? "Unknown error"}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;