export default function ExpedientesLoading() {
  return (
    <div style={{ padding: '2rem', display: 'grid', gap: '1.5rem' }}>
      <style>{`
        @keyframes sk-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .sk { background: var(--border); border-radius: var(--radius-sm); animation: sk-pulse 1.6s ease-in-out infinite; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="sk" style={{ height: 28, width: 200 }} />
        <div className="sk" style={{ height: 38, width: 140 }} />
      </div>

      {/* Case rows */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'grid', gap: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="sk" style={{ height: 18, width: '45%' }} />
            <div className="sk" style={{ height: 22, width: 80 }} />
          </div>
          <div className="sk" style={{ height: 13, width: '65%', opacity: 0.7 }} />
          <div className="sk" style={{ height: 13, width: '50%', opacity: 0.6 }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <div className="sk" style={{ height: 28, width: 80 }} />
            <div className="sk" style={{ height: 28, width: 80 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
