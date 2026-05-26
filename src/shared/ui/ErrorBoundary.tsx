import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '48px 24px',
            textAlign: 'center',
            color: '#A8B3C7',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          <p style={{ fontSize: 14, color: '#FF5C7A' }}>
            Algo salió mal al cargar este contenido.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              background: 'transparent',
              border: '1px solid #273244',
              borderRadius: 8,
              padding: '8px 18px',
              fontSize: 13,
              color: '#A8B3C7',
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
