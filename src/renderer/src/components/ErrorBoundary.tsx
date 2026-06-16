import React from 'react';
import { useT } from '../hooks/useTranslation';

interface FallbackProps {
  error: Error;
  onReload: () => void;
}

function ErrorFallback({ error, onReload }: FallbackProps) {
  const { t } = useT();
  return (
    <div className="err-boundary">
      <div className="err-boundary-title">{t('error_boundary_title')}</div>
      <div className="err-boundary-desc">{t('error_boundary_desc')}</div>
      <pre className="err-boundary-code">{error.message}</pre>
      <button className="btn primary" type="button" onClick={onReload}>
        {t('error_boundary_reload')}
      </button>
    </div>
  );
}

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

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
    return <ErrorFallback error={error} onReload={this.handleReload} />;
  }
}

export default ErrorBoundary;
