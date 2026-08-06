export default function DashboardLoading() {
  return (
    <div style={{ padding: '2rem', display: 'grid', gap: '1.5rem' }}>
      <style>{`
        @keyframes sk-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .sk { background: var(--border); border-radius: var(--radius-sm); animation: sk-pulse 1.6s ease-in-out infinite; }
      `}</style>

      {/* Header */}
      <div className="sk" style={{ height: 32, width: 260 }} />
      <div className="sk" style={{ height: 18, width: 400, opacity: 0.7 }} />

      {/* Cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', display: 'grid', gap: '0.75rem' }}>
            <div className="sk" style={{ height: 16, width: 100 }} />
            <div className="sk" style={{ height: 36, width: '70%' }} />
            <div className="sk" style={{ height: 14, width: '90%', opacity: 0.6 }} />
          </div>
        ))}
      </div>

      {/* List */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'grid', gap: '0.75rem' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="sk" style={{ height: 40, width: 40, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'grid', gap: '0.4rem' }}>
              <div className="sk" style={{ height: 14, width: '60%' }} />
              <div className="sk" style={{ height: 12, width: '40%', opacity: 0.6 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
