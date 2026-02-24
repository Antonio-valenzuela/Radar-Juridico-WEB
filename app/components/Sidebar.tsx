"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
    { href: "/", label: "Dashboard", icon: "📊" },
    { href: "/fuentes", label: "Fuentes", icon: "🔗" },
    { href: "/documentos", label: "Base Jurídica", icon: "📄" },
    { href: "/reformas", label: "Reformas", icon: "⚖️" },
    { href: "/notificaciones", label: "Notificaciones", icon: "🔔", showBadge: true },
    { href: "/configuracion", label: "Configuración", icon: "⚙️" },
];

export default function Sidebar() {
    const pathname = usePathname();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        async function fetchUnread() {
            try {
                const res = await fetch("/api/notifications?unread=true&limit=1");
                const data = await res.json();
                if (data.ok) {
                    setUnreadCount(data.unreadCount || 0);
                }
            } catch {
                // silently fail
            }
        }

        fetchUnread();
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <h1>Jurídico Radar</h1>
                <p>Legal Monitoring</p>
            </div>

            <ul className="sidebar-nav">
                {NAV_ITEMS.map((item) => {
                    const isActive =
                        item.href === "/"
                            ? pathname === "/"
                            : pathname.startsWith(item.href);

                    return (
                        <li key={item.href}>
                            <Link
                                href={item.href}
                                className={`sidebar-link${isActive ? " active" : ""}`}
                            >
                                <span className="icon">{item.icon}</span>
                                <span>{item.label}</span>
                                {item.showBadge && unreadCount > 0 && (
                                    <span className="sidebar-badge">{unreadCount}</span>
                                )}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </aside>
    );
}
