export default function RouteLoading() {
  return (
    <div className="app-container">
      <aside className="sidebar-aside" aria-hidden="true" />
      <div className="main-content">
        <header className="app-header" />
        <main className="page-body" aria-busy="true" aria-live="polite">
          <div className="grid-responsive-4" style={{ marginBottom: 18 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card" style={{ height: 96 }} />
            ))}
          </div>
          <div className="glass-card" style={{ height: 280 }} />
        </main>
      </div>
    </div>
  );
}
