export default function RouteLoading() {
  return (
    <div aria-busy="true" aria-live="polite" aria-label="Loading page content">
      <div className="grid-responsive-4" style={{ marginBottom: 18 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card" style={{ height: 96 }} />
        ))}
      </div>
      <div className="glass-card" style={{ height: 280 }} />
    </div>
  );
}
