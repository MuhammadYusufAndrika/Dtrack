import { useState, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { apiFetch } from '../../utils/api';
import AdminLayout from '../../Layouts/AdminLayout';
import StatCard from '../../Components/StatCard';
import PageHeader from '../../Components/PageHeader';
import { PageLoader } from '../../Components/LoadingSpinner';
import { Truck, Users, AlertTriangle, Route, Activity, Shield, ArrowRight, Radar, Bell, MapPin } from 'lucide-react';

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch('/api/dashboard/stats')
            .then((r) => r.json()).then((j) => { if (j.success) setStats(j.data); })
            .catch(() => {}).finally(() => setLoading(false));
    }, []);

    if (loading) return <AdminLayout><PageLoader label="Memuat dashboard…" /></AdminLayout>;

    const cards = stats ? [
        { icon: Truck, label: 'Total Unit', value: String(stats.total_vehicles ?? 0), sub: `${stats.active_vehicles ?? 0} aktif`, accent: 'blue' },
        { icon: Activity, label: 'Unit Aktif', value: String(stats.active_vehicles ?? 0), sub: 'Sedang jalan', accent: 'green' },
        { icon: Users, label: 'Driver', value: String(stats.total_drivers ?? 0), sub: `${stats.active_drivers ?? 0} bertugas`, accent: 'violet' },
        { icon: Shield, label: 'Driver Aktif', value: String(stats.active_drivers ?? 0), sub: 'On duty', accent: 'cyan' },
        { icon: AlertTriangle, label: 'Alert Aktif', value: String(stats.active_alerts ?? 0), sub: 'Butuh perhatian', accent: 'amber' },
        { icon: Route, label: 'Trip Hari Ini', value: String(stats.today_trips ?? 0), sub: 'Perjalanan', accent: 'red' },
    ] : [];

    return (
        <AdminLayout>
            <div className="space-y-6">
                <PageHeader
                    eyebrow="Command Center"
                    title="Selamat datang di FleetVision"
                    description="Pantau seluruh armada, driver, dan alert dari satu tempat — live."
                    action={
                        <div className="flex items-center gap-2">
                            <Link href="/admin/fleet" className="btn-glow flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-xs font-bold">
                                <MapPin className="w-3.5 h-3.5" /> Live Map <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                            <Link href="/admin/alerts" className="glass glass-hover flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-dark-900">
                                <Bell className="w-3.5 h-3.5" /> Alerts
                                {stats?.active_alerts > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-danger-500 text-white text-[10px] flex items-center justify-center">{stats.active_alerts}</span>}
                            </Link>
                        </div>
                    }
                />

                <div className="relative overflow-hidden rounded-3xl p-[1.5px] bg-gradient-to-r from-primary-500/60 via-violet-500/40 to-accent-500/50 animate-fade-up">
                    <div className="rounded-3xl bg-white/90 backdrop-blur-xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 via-violet-500 to-accent-500 flex items-center justify-center flex-shrink-0 shadow-[0_10px_32px_rgba(59,130,246,0.5)]">
                            <Radar className="w-6 h-6 text-white animate-pulse" />
                        </div>
                        <div className="flex-1">
                            <p className="font-display font-bold text-dark-900">Semua sistem operasional</p>
                            <p className="text-xs text-dark-400 mt-0.5">GPS Reverb · AI Service · Database terhubung — update setiap 5 detik.</p>
                        </div>
                        <div className="flex items-center gap-5 text-center">
                            <div><p className="font-display text-2xl font-bold text-success-500">{stats?.active_vehicles ?? 0}</p><p className="text-[10px] uppercase tracking-widest text-dark-500 font-bold">On road</p></div>
                            <div className="w-px h-10 bg-dark-200/70" />
                            <div><p className="font-display text-2xl font-bold text-warning-500">{stats?.active_alerts ?? 0}</p><p className="text-[10px] uppercase tracking-widest text-dark-500 font-bold">Alert</p></div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
                    {cards.map((c, i) => (
                        <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} sub={c.sub} accent={c.accent} delay={`delay-${(i % 4) + 1}`} />
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {[
                        { href: '/admin/fleet', icon: Truck, title: 'Fleet Live Map', desc: 'Lihat semua unit di peta + status live', cta: 'Buka peta', grad: 'from-primary-500 to-accent-500' },
                        { href: '/admin/drivers', icon: Users, title: 'Kelola Driver', desc: 'Assign unit, pantau status & kamera AI', cta: 'Kelola driver', grad: 'from-violet-500 to-fuchsia-400' },
                        { href: '/admin/trips', icon: Route, title: 'Riwayat Trip', desc: 'Jarak, durasi & rute perjalanan', cta: 'Lihat trip', grad: 'from-success-500 to-accent-500' },
                    ].map((a) => (
                        <Link key={a.href} href={a.href} className="glass glass-hover rounded-3xl p-5 group block animate-fade-up delay-2">
                            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${a.grad} flex items-center justify-center mb-4 shadow-lg`}>
                                <a.icon className="w-5 h-5 text-white" />
                            </div>
                            <p className="font-display font-bold text-dark-900">{a.title}</p>
                            <p className="text-xs text-dark-400 mt-1 mb-4">{a.desc}</p>
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 group-hover:gap-2 transition-all">{a.cta} <ArrowRight className="w-3.5 h-3.5" /></span>
                        </Link>
                    ))}
                </div>
            </div>
        </AdminLayout>
    );
}
