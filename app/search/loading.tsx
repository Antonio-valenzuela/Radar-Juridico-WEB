export default function SearchLoading() {
  return (
    <div style={{ padding: '2rem', display: 'grid', gap: '1.5rem' }}>
      <style>{`
        @keyframes sk-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .sk { background: var(--border); border-radius: var(--radius-sm); animation: sk-pulse 1.6s ease-in-out infinite; }
      `}</style>

      {/* Search bar skeleton */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <div className="sk" style={{ height: 44, flex: 1 }} />
        <div className="sk" style={{ height: 44, width: 120 }} />
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {[120, 100, 140, 110, 90].map((w, i) => (
          <div key={i} className="sk" style={{ height: 32, width: w }} />
        ))}
      </div>

      {/* Result rows */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'grid', gap: '0.6rem' }}>
          <div className="sk" style={{ height: 18, width: '70%' }} />
          <div className="sk" style={{ height: 13, width: '90%', opacity: 0.7 }} />
          <div className="sk" style={{ height: 13, width: '80%', opacity: 0.6 }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <div className="sk" style={{ height: 24, width: 70 }} />
            <div className="sk" style={{ height: 24, width: 90 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
