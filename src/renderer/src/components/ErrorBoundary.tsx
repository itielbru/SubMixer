import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time crashes in the React tree and shows a recoverable
 * fallback instead of a blank window. The error is also forwarded to the main
 * process log (best-effort) so it lands in `userData/logs/main.log`.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Renderer crash:', error, info.componentStack);
    try {
      window.api?.debug?.log({
        sessionId: 'renderer',
        location: 'ErrorBoundary',
        message: error.message,
        data: { stack: error.stack, componentStack: info.componentStack },
        hypothesisId: '',
        timestamp: Date.now(),
      });
    } catch {
      /* logging is best-effort */
    }
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 32,
          background: '#0d0e11',
          color: '#e6e7ea',
          fontFamily: 'Heebo, system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 600 }}>משהו השתבש · Something went wrong</div>
        <div style={{ maxWidth: 520, opacity: 0.75, lineHeight: 1.6 }}>
          האפליקציה נתקלה בשגיאה בלתי צפויה. ניתן לטעון מחדש ולהמשיך.
          <br />
          The app hit an unexpected error. You can reload and continue.
        </div>
        <pre
          style={{
            maxWidth: 600,
            maxHeight: 160,
            overflow: 'auto',
            padding: 12,
            borderRadius: 8,
            background: '#16181d',
            color: '#c98a8a',
            fontSize: 12,
            textAlign: 'left',
            direction: 'ltr',
            whiteSpace: 'pre-wrap',
          }}
        >
          {error.message}
        </pre>
        <button
          onClick={this.handleReload}
          style={{
            padding: '10px 22px',
            borderRadius: 8,
            border: 'none',
            background: '#5b6cff',
            color: '#fff',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          טען מחדש · Reload
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
