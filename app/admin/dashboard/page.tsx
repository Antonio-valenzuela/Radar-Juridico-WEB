// app/admin/dashboard/page.tsx

'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DashboardMetrics {
  timestamp: string;
  documentos_procesados: number;
  jobs_pendientes: number;
  jobs_fallidos: number;
  tiempo_promedio_procesamiento: number;
  estado_fuentes: Record<string, boolean>;
  workers_activos: number;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const configuredWsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL?.trim();
      const wsUrl = configuredWsUrl || `${protocol}//${window.location.hostname}:3002`;
      console.log('Intentando conectar WebSocket a:', wsUrl);

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('Conectado al WebSocket de Telemetría');
        setConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as DashboardMetrics;
          setMetrics(data);

          // Formatear marca de tiempo corta para el eje X (HH:MM:SS)
          const timeLabel = new Date(data.timestamp).toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          setHistory((prev) => {
            const nextHistory = [
              ...prev,
              {
                time: timeLabel,
                Procesados: data.documentos_procesados,
                Pendientes: data.jobs_pendientes,
                Fallidos: data.jobs_fallidos,
              },
            ];
            // Conservar últimos 20 puntos en el gráfico
            return nextHistory.slice(-20);
          });
        } catch (err) {
          console.error('Error parseando datos WebSocket:', err);
        }
      };

      ws.onclose = () => {
        console.warn('Conexión WebSocket cerrada. Reintentando en 5s...');
        setConnected(false);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = (err) => {
        console.error('Error de WebSocket:', err);
        ws?.close();
      };
    };

    connectWebSocket();

    return () => {
      ws?.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div className="bg-gradient" style={{ opacity: 0.15 }}></div>

      <header className="header" style={{ position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Link href="/" className="logo">
          <div className="logo-icon" style={{ background: 'linear-gradient(135deg, #a855f7, #3b82f6)' }}></div>
          Jurídico Radar <span style={{ fontSize: '10px', background: 'rgba(168, 85, 247, 0.2)', padding: '2px 6px', borderRadius: '10px', color: '#a855f7', marginLeft: '6px' }}>CONSOLE</span>
        </Link>
        <input type="checkbox" id="menu-toggle" className="menu-toggle" />
        <label htmlFor="menu-toggle" className="menu-icon">
          <span></span>
          <span></span>
          <span></span>
        </label>
        <nav className="nav-menu">
          <Link href="/">Dashboard</Link>
          <Link href="/search">Búsqueda</Link>
          <Link href="/rag">Consultor RAG</Link>
          <Link href="/admin/dashboard" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>📡 Telemetría</Link>
          <Link href="/admin/ingest/manual-url" style={{ border: '1px solid var(--accent)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--accent)', fontWeight: 'bold' }}>Agregar link</Link>
          <Link href="/admin/sources" style={{ border: '1px dashed var(--secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--secondary)' }}>⚙ Fuentes</Link>
        </nav>
      </header>

      <main className="container" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Telemetría Operativa
            </h1>
            <p style={{ color: '#64748b', margin: '0.5rem 0 0 0' }}>Estadísticas de procesamiento e ingesta de documentos en tiempo real.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '30px', background: connected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', border: connected ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: connected ? '#22c55e' : '#ef4444', display: 'inline-block', boxShadow: connected ? '0 0 8px #22c55e' : '0 0 8px #ef4444' }}></span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: connected ? '#22c55e' : '#ef4444' }}>
              {connected ? 'WS CONECTADO' : 'WS DESCONECTADO (REINTENTANDO)'}
            </span>
          </div>
        </div>

        {metrics ? (
          <>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
              <div className="glass-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)' }}></div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Documentos Procesados</span>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', margin: '0.5rem 0 0 0' }}>
                  {metrics.documentos_procesados.toLocaleString()}
                </h2>
              </div>

              <div className="glass-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)' }}></div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trabajos Activos / En Cola</span>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#3b82f6', margin: '0.5rem 0 0 0' }}>
                  {metrics.jobs_pendientes.toLocaleString()}
                </h2>
              </div>

              <div className="glass-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)' }}></div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fallas en Ingesta</span>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: metrics.jobs_fallidos > 0 ? '#ef4444' : '#fff', margin: '0.5rem 0 0 0' }}>
                  {metrics.jobs_fallidos.toLocaleString()}
                </h2>
              </div>

              <div className="glass-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)' }}></div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tiempo Promedio</span>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#22c55e', margin: '0.5rem 0 0 0' }}>
                  {metrics.tiempo_promedio_procesamiento.toFixed(2)}s
                </h2>
              </div>
            </div>

            {/* Grafico + Sidebar Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '2rem', marginBottom: '4rem' }}>
              
              {/* Chart */}
              <div className="glass-card" style={{ padding: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 1.5rem 0' }}>Rendimiento de Ingesta (Tiempo Real)</h3>
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <AreaChart data={history.length > 0 ? history : [{ time: 'Iniciando', Procesados: metrics.documentos_procesados }]}>
                      <defs>
                        <linearGradient id="colorProcesados" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip 
                        contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        labelStyle={{ color: '#94a3b8', fontWeight: 600 }}
                      />
                      <Area type="monotone" dataKey="Procesados" stroke="#a855f7" fillOpacity={1} fill="url(#colorProcesados)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Status sources */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem', flex: 1 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Estado de Fuentes</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {Object.entries(metrics.estado_fuentes).map(([source, status]) => (
                      <div key={source} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{source}</span>
                        <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '12px', background: status ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: status ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                          {status ? '● ACTIVA' : '○ ERROR'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Consolas Conectadas</span>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', marginTop: '0.25rem' }}>
                    {metrics.workers_activos}
                  </div>
                </div>
              </div>

            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.05)' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(168, 85, 247, 0.3)', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.9rem' }}>Esperando telemetría del servidor en puerto 3002...</p>
            <style jsx>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
      </main>
    </>
  );
}
