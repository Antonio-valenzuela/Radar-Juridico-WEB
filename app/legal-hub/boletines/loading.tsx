export default function BoletinesLoading() {
  return (
    <div style={{ padding: '2rem', display: 'grid', gap: '1.5rem' }}>
      <style>{`
        @keyframes sk-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .sk { background: var(--border); border-radius: var(--radius-sm); animation: sk-pulse 1.6s ease-in-out infinite; }
      `}</style>

      <div className="sk" style={{ height: 28, width: 220 }} />
      <div className="sk" style={{ height: 16, width: 380, opacity: 0.7 }} />

      {/* Bulletin rows */}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'grid', gap: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="sk" style={{ height: 16, width: '40%' }} />
            <div className="sk" style={{ height: 20, width: 110 }} />
          </div>
          <div className="sk" style={{ height: 13, width: '75%', opacity: 0.7 }} />
          <div className="sk" style={{ height: 13, width: '60%', opacity: 0.6 }} />
        </div>
      ))}
    </div>
  );
}
