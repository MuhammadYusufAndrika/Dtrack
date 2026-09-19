import { useState, useEffect } from 'react';
import { Link, usePage, router } from '@inertiajs/react';
import {
    LayoutDashboard, Truck, Users, Route, Bell, Settings,
    Menu, ChevronLeft, LogOut, Search, Radar,
} from 'lucide-react';

const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/fleet', label: 'Fleet', icon: Truck },
    { href: '/admin/drivers', label: 'Drivers', icon: Users },
    { href: '/admin/trips', label: 'Trips', icon: Route },
    { href: '/admin/alerts', label: 'Alerts', icon: Bell },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
];

function useClock() {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const t = setInterval(() => setNow(new Date()), 10000);
        return () => clearInterval(t);
    }, []);
    return now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminLayout({ children }) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { url } = usePage();
    const clock = useClock();

    const isActive = (href) => {
        if (href === '/admin') return url === '/admin';
        return url.startsWith(href);
    };

    const activeLabel = [...navItems].reverse().find((n) => isActive(n.href))?.label ?? 'Dashboard';

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, Accept: 'application/json' },
            });
        } catch {}
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        router.visit('/login');
    };

    return (
        <div className="min-h-screen text-dark-600 relative">
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="orb orb-blue w-[420px] h-[420px] -top-32 -left-32" />
                <div className="orb orb-violet w-[360px] h-[360px] top-1/3 -right-32" />
            </div>

            <button onClick={() => setMobileOpen(true)} className="fixed top-4 left-4 z-50 lg:hidden p-2.5 rounded-xl glass-strong text-dark-700">
                <Menu className="w-5 h-5" />
            </button>
            {mobileOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}

            <aside className={`fixed top-0 left-0 z-50 h-screen glass-strong !rounded-none border-y-0 border-l-0 transition-all duration-300 flex flex-col ${collapsed ? 'w-[76px]' : 'w-[264px]'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="flex items-center justify-between p-4 border-b border-dark-200/60">
                    <Link href="/admin" className="flex items-center gap-3 min-w-0">
                        <div className="relative flex-shrink-0">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 via-violet-500 to-accent-500 flex items-center justify-center shadow-[0_8px_28px_rgba(59,130,246,0.5)]">
                                <Truck className="w-5 h-5 text-white" />
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success-400 border-2 border-dark-900 animate-pulse-ring" />
                        </div>
                        {!collapsed && (
                            <div className="min-w-0">
                                <h1 className="font-display text-[15px] font-bold text-dark-900 truncate leading-tight">FleetVision</h1>
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gradient">Admin Console</p>
                            </div>
                        )}
                    </Link>
                    <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex p-1.5 rounded-lg text-dark-400 hover:text-dark-900 hover:bg-dark-100 transition-colors">
                        <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed && 'rotate-180'}`} />
                    </button>
                </div>

                {!collapsed && (
                    <div className="mx-3 mt-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-primary-600/20 to-accent-500/10 border border-primary-500/20 flex items-center gap-2.5">
                        <Radar className="w-4 h-4 text-success-400 animate-pulse flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-success-500">System Live</p>
                            <p className="text-[10px] text-dark-400">GPS + AI monitoring aktif</p>
                        </div>
                    </div>
                )}

                <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
                    {!collapsed && <p className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-dark-500">Menu</p>}
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        return (
                            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative overflow-hidden ${active ? 'text-white shadow-[0_8px_24px_rgba(37,99,235,0.4)]' : 'text-dark-400 hover:text-dark-900 hover:bg-dark-100/70'}`}>
                                {active && <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-violet-600 opacity-90" />}
                                {active && <span className="absolute inset-0 bg-gradient-to-t from-white/0 via-white/10 to-white/10" />}
                                <Icon className="w-[18px] h-[18px] flex-shrink-0 relative" />
                                {!collapsed && <span className="relative">{item.label}</span>}
                                {active && !collapsed && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white relative" />}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-3 border-t border-dark-200/60">
                    <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-dark-400 hover:text-dark-900 hover:bg-dark-100/70 transition-all w-full">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">A</div>
                        {!collapsed && <div className="min-w-0 text-left flex-1"><p className="text-sm font-semibold text-dark-900 truncate">Administrator</p><p className="text-[11px] text-dark-500 flex items-center gap-1"><LogOut className="w-3 h-3" /> Keluar</p></div>}
                    </button>
                </div>
            </aside>

            <div className={`transition-all duration-300 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-[264px]'}`}>
                <header className="sticky top-0 z-30 glass !rounded-none border-x-0 border-t-0">
                    <div className="flex items-center gap-3 px-4 lg:px-7 py-3.5 pl-14 lg:pl-7">
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-dark-500">FleetVision AI</p>
                            <h2 className="font-display text-sm font-bold text-dark-900 truncate">{activeLabel}</h2>
                        </div>
                        <div className="hidden md:flex items-center gap-2 ml-6 px-3 py-2 rounded-xl bg-dark-100/60 border border-dark-200/60 text-dark-400 text-xs flex-1 max-w-xs">
                            <Search className="w-3.5 h-3.5" />
                            <span className="truncate">Cari kendaraan, driver, trip…</span>
                            <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white text-dark-500 border border-dark-200/60">⌘K</kbd>
                        </div>
                        <div className="ml-auto flex items-center gap-2.5">
                            <span className="hidden sm:block text-xs text-dark-400 tabular-nums">{clock} WIB</span>
                            <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-full bg-success-500/10 border border-success-500/30 text-success-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-success-400 animate-pulse" /> Live
                            </span>
                        </div>
                    </div>
                </header>
                <main className="p-4 lg:p-7 max-w-[1400px] mx-auto">{children}</main>
            </div>
        </div>
    );
}
