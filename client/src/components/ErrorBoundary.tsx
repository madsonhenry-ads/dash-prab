import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-dark-950 p-4">
          <div className="card max-w-md p-6 text-center">
            <h2 className="text-lg font-bold text-white mb-2">Algo deu errado</h2>
            <p className="text-sm text-dark-400 mb-4">{this.state.error?.message || 'Erro desconhecido'}</p>
            <button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }} className="btn-primary text-sm">
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}