import React from 'react';

// 페이지 트리 어디에서 발생한 에러든 잡아 fallback UI 표시.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--theme-bg-primary, #0f0f23)', color: 'var(--theme-text-primary)', gap: '16px' }}>
          <i className="bi bi-exclamation-triangle" style={{ fontSize: '48px', color: '#ef4444' }}></i>
          <h2 style={{ margin: 0 }}>페이지 로드 중 오류가 발생했습니다</h2>
          <p style={{ color: '#94a3b8', margin: 0 }}>{this.state.error?.message}</p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', cursor: 'pointer', fontSize: '14px' }}>
            새로고침
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
