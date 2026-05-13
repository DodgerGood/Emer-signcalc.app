import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ error, info });
    console.error('Frontend crash:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: 'Arial' }}>
          <h1>Frontend crash captured</h1>
          <p>Send this screenshot back to ChatGPT.</p>

          <h2>Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f1f5f9', padding: 16 }}>
            {String(this.state.error)}
          </pre>

          <h2>Component Stack</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f8fafc', padding: 16 }}>
            {this.state.info?.componentStack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
