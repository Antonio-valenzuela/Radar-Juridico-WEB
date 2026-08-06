export default function LegalHubLoading() {
  return (
    <div style={{ padding: '2rem', display: 'grid', gap: '1.5rem' }}>
      <style>{`
        @keyframes sk-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .sk { background: var(--border); border-radius: var(--radius-sm); animation: sk-pulse 1.6s ease-in-out infinite; }
      `}</style>

      <div className="sk" style={{ height: 32, width: 200 }} />
      <div className="sk" style={{ height: 16, width: 360, opacity: 0.7 }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', display: 'grid', gap: '0.75rem' }}>
            <div className="sk" style={{ height: 32, width: 32, borderRadius: 8 }} />
            <div className="sk" style={{ height: 18, width: '70%' }} />
            <div className="sk" style={{ height: 13, width: '90%', opacity: 0.6 }} />
            <div className="sk" style={{ height: 13, width: '75%', opacity: 0.5 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
