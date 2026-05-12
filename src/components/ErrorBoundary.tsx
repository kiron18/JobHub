/**
 * ErrorBoundary — last-line defence against blank pages.
 *
 * Wraps the dashboard route content. If any child throws during render, we
 * show a calm fallback with the error message instead of a white screen.
 * A "Try again" button forces a remount; "Back to dashboard" navigates home.
 */
import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] caught:', error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{ maxWidth: 560, margin: '80px auto', padding: '0 24px' }}>
        <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#A0A4A8' }}>
          Something went wrong
        </p>
        <h1 style={{ margin: '0 0 16px', fontSize: 24, fontWeight: 700, color: '#E0E0E0', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
          This page hit an error.
        </h1>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#A0A4A8', lineHeight: 1.6 }}>
          Your data is safe. The page failed to render. You can try again, or go back to the dashboard.
        </p>
        <pre style={{
          margin: '0 0 24px',
          padding: '12px 14px',
          fontSize: 12,
          color: '#6B6F73',
          background: '#25282B',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8,
          overflow: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {this.state.error.message}
        </pre>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={this.reset}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              color: '#E0E0E0',
              background: '#2D5A6E',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <button
            onClick={() => { window.location.href = '/'; }}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              color: '#A0A4A8',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              cursor: 'pointer',
            }}
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }
}
