import Link from 'next/link';

export default function WorkspaceNotFound() {
  return (
    <div className="glass-card" style={{ padding: 28, maxWidth: 540, margin: '24px auto' }}>
      <h2>Page not found</h2>
      <p style={{ margin: '12px 0', color: 'var(--text-secondary)' }}>The requested record is unavailable.</p>
      <Link href="/dashboard" className="btn btn-primary btn-sm">Back to dashboard</Link>
    </div>
  );
}
