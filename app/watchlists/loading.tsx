export default function WatchlistsLoading() {
  return (
    <div style={{ padding: '2rem', display: 'grid', gap: '1.5rem' }}>
      <style>{`
        @keyframes sk-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .sk { background: var(--border); border-radius: var(--radius-sm); animation: sk-pulse 1.6s ease-in-out infinite; }
      `}</style>

      <div className="sk" style={{ height: 28, width: 180 }} />

      {/* Form panel */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', display: 'grid', gap: '1rem' }}>
        <div className="sk" style={{ height: 16, width: 100 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="sk" style={{ height: 40 }} />
          <div className="sk" style={{ height: 40 }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div className="sk" style={{ height: 36, width: 80 }} />
          <div className="sk" style={{ height: 36, flex: 1 }} />
          <div className="sk" style={{ height: 36, width: 110 }} />
        </div>
      </div>

      {/* Rules list */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', display: 'grid', gap: '0.75rem' }}>
        <div className="sk" style={{ height: 16, width: 130 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'grid', gap: '0.3rem' }}>
              <div className="sk" style={{ height: 14, width: 90 }} />
              <div className="sk" style={{ height: 12, width: 120, opacity: 0.6 }} />
            </div>
            <div className="sk" style={{ height: 28, width: 55 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
