import { useState, useEffect } from 'react';
import { Link, usePage, router } from '@inertiajs/react';
import {
    LayoutDashboard, Truck, Users, Route, Bell, Settings,
    Menu, ChevronLeft, LogOut,
} from 'lucide-react';

const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/fleet', label: 'Fleet', icon: Truck },
    { href: '/admin/drivers', label: 'Drivers', icon: Users },
    { href: '/admin/trips', label: 'Trips', icon: Route },
    { href: '/admin/alerts', label: 'Alerts', icon: Bell },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }) {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { url } = usePage();

    const isActive = (href) => {
        if (href === '/admin') return url === '/admin';
        return url.startsWith(href);
    };

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
        <div className="min-h-screen bg-dark-950">
            <button onClick={() => setMobileOpen(true)} className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-dark-800 border border-dark-700 text-dark-200">
                <Menu className="w-5 h-5" />
            </button>
            {mobileOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}
            <aside className={`fixed top-0 left-0 z-50 h-screen bg-dark-900/95 backdrop-blur-xl border-r border-dark-700/50 transition-all duration-300 flex flex-col ${collapsed ? 'w-[72px]' : 'w-[260px]'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="flex items-center justify-between p-4 border-b border-dark-700/50">
                    <Link href="/admin" className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
                            <Truck className="w-5 h-5 text-white" />
                        </div>
                        {!collapsed && <div className="min-w-0"><h1 className="text-sm font-bold text-dark-50 truncate">FleetVision</h1><p className="text-[10px] text-primary-400 font-medium">Admin</p></div>}
                    </Link>
                    <button onClick={() => setCollapsed(!collapsed)} className="hidden lg:flex p-1.5 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-800 transition-colors">
                        <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed && 'rotate-180'}`} />
                    </button>
                </div>
                <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        return (
                            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative ${active ? 'bg-primary-500/10 text-primary-400' : 'text-dark-400 hover:text-dark-200 hover:bg-dark-800/50'}`}>
                                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-500 rounded-r-full" />}
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                {!collapsed && <span>{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-4 border-t border-dark-700/50">
                    <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-dark-400 hover:text-dark-200 hover:bg-dark-800/50 transition-all w-full">
                        <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center text-xs font-semibold text-dark-300"><LogOut className="w-4 h-4" /></div>
                        {!collapsed && <div className="min-w-0 text-left"><p className="text-sm font-medium text-dark-200 truncate">Admin</p><p className="text-xs text-dark-400 truncate">Sign Out</p></div>}
                    </button>
                </div>
            </aside>
            <div className="lg:pl-[260px] transition-all duration-300">
                <header className="sticky top-0 z-30 bg-dark-900/80 backdrop-blur-xl border-b border-dark-700/50">
                    <div className="flex items-center justify-between px-4 lg:px-6 py-3">
                        <div />
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-dark-400">Admin</span>
                        </div>
                    </div>
                </header>
                <main className="p-4 lg:p-6">{children}</main>
            </div>
        </div>
    );
}
