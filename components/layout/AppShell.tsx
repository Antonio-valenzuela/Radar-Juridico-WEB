'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

type NavItem = {
  href: string;
  label: string;
  description?: string;
};

const USER_NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/search', label: 'Búsqueda' },
  { href: '/documents', label: 'Documentos' },
  {
    href: '/monitoreo',
    label: 'Vigilancia documental',
    description: 'Estado y cambios por hash del documento completo',
  },
  {
    href: '/legal-hub/cambios',
    label: 'Cambios por artículo',
    description: 'NormaDiff con desglose por artículo y resumen de IA',
  },
  { href: '/rag', label: 'IA Legal' },
  { href: '/watchlists', label: 'Alertas' },
  { href: '/legal-hub', label: 'Centro Jurídico' },
];

const ADMIN_NAV_ITEMS = [
  { href: '/ai', label: 'IA Sandbox' },
  { href: '/metrics', label: 'Métricas' },
  { href: '/admin/ingest/manual-url', label: 'Agregar link' },
  { href: '/admin/sources', label: 'Fuentes' },
  { href: '/admin/dashboard', label: 'Admin Dashboard' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = pathname.startsWith('/admin') || pathname === '/metrics' || pathname === '/ai';

  const isPublicDemo =
    typeof window !== 'undefined'
      ? false // env vars not available client-side this way; show admin always for non-demo
      : false;

  return (
    <>
      <header className="header">
        <Link href="/" className="logo">
          <div className="logo-icon" />
          Jurídico Radar
        </Link>
        <button
          className="appshell-menu-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Abrir menú"
        >
          <span /><span /><span />
        </button>
        <nav className={`nav-menu ${menuOpen ? 'nav-menu--open' : ''}`}>
          {/* ── Rutas de usuario ── */}
          {USER_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? 'appshell-active' : ''}
              onClick={() => setMenuOpen(false)}
              title={item.description}
              aria-label={item.description ? `${item.label}: ${item.description}` : item.label}
            >
              {item.label}
            </Link>
          ))}

          {/* ── Separador + rutas de admin ── */}
          {!isPublicDemo && (
            <>
              <span className="appshell-divider" />
              {ADMIN_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`appshell-admin-link ${pathname.startsWith(item.href) ? 'appshell-active' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>
      </header>
      {children}
    </>
  );
}
