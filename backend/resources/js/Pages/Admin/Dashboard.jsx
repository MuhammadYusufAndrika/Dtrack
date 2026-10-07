import { useState, useEffect, useMemo } from 'react';
import { Link } from '@inertiajs/react';
import { apiFetch } from '../../utils/api';
import AdminLayout from '../../Layouts/AdminLayout';
import StatCard from '../../Components/StatCard';
import PageHeader from '../../Components/PageHeader';
import { AreaChart, DonutChart, BarList } from '../../Components/Charts';
import { Truck, Users, AlertTriangle, Route, Activity, Shield, ArrowRight, Radar, Bell, MapPin, PieChart, BarChart3, CalendarDays } from 'lucide-react';

const VEHICLE_STATUS = {
    ACTIVE: { label: 'Aktif', color: '#16a34a' },
    MAINTENANCE: { label: 'Perawatan', color: '#d97706' },
    INACTIVE: { label: 'Nonaktif', color: '#94a3b8' },
    OUT_OF_SERVICE: { label: 'Rusak', color: '#dc2626' },
};
const DRIVER_STATUS = {
    DRIVING: { label: 'Menyetir', color: '#2563eb' },
    AVAILABLE: { label: 'Tersedia', color: '#0891b2' },
    ON_BREAK: { label: 'Istirahat', color: '#d97706' },
    OFF_DUTY: { label: 'Off duty', color: '#64748b' },
    INACTIVE: { label: 'Nonaktif', color: '#94a3b8' },
};
const SEVERITY = {
    CRITICAL: { label: 'Kritis', color: '#dc2626' },
    HIGH: { label: 'Tinggi', color: '#d97706' },
    MEDIUM: { label: 'Sedang', color: '#0891b2' },
    LOW: { label: 'Rendah', color: '#2563eb' },
};

function Skeleton() {
    return (
        <div className="space-y-6">
            <div className="skeleton h-14 w-2/3 max-w-md" />
            <div className="skeleton h-24 rounded-3xl w-full" />
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-[76px] rounded-2xl" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="skeleton h-72 rounded-2xl lg:col-span-2" />
                <div className="skeleton h-72 rounded-2xl" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="skeleton h-52 rounded-2xl" />
                <div className="skeleton h-52 rounded-2xl" />
            </div>
        </div>
    );
}

function ChartCard({ icon: Icon, title, subtitle, children, className = '' }) {
    return (
        <div className={`glass rounded-2xl p-5 pop-in ${className}`}>
            <div className="flex items-center gap-3 mb-5">
                <span className="w-9 h-9 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4.5 h-4.5 text-primary-600" />
                </span>
                <div className="min-w-0">
                    <h3 className="font-display text-sm font-bold text-dark-900 leading-tight">{title}</h3>
                    <p className="text-[11px] text-dark-400">{subtitle}</p>
                </div>
            </div>
            {children}
        </div>
    );
}

function groupCount(list, keyFn, mapRef) {
    const counts = {};
    list.forEach((item) => {
        const k = keyFn(item);
        if (k != null) counts[k] = (counts[k] || 0) + 1;
    });
    return Object.entries(counts)
        .map(([k, v]) => ({ key: k, ...(mapRef[String(k).toUpperCase()] || { label: k, color: '#64748b' }), value: v }))
        .sort((a, b) => b.value - a.value);
}

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [trips, setTrips] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            apiFetch('/api/dashboard/stats').then((r) => r.json()).catch(() => ({})),
            apiFetch('/api/trips').then((r) => r.json()).catch(() => ({})),
            apiFetch('/api/vehicles').then((r) => r.json()).catch(() => ({})),
            apiFetch('/api/drivers').then((r) => r.json()).catch(() => ({})),
            apiFetch('/api/alerts').then((r) => r.json()).catch(() => ({})),
        ])
            .then(([s, t, v, d, a]) => {
                if (s.success) setStats(s.data);
                if (t.success && Array.isArray(t.data)) setTrips(t.data);
                if (v.success && Array.isArray(v.data)) setVehicles(v.data);
                if (d.success && Array.isArray(d.data)) setDrivers(d.data);
                if (a.success && Array.isArray(a.data)) setAlerts(a.data);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const days = useMemo(() => {
        const out = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            d.setDate(d.getDate() - i);
            out.push(d);
        }
        return out;
    }, []);

    const activity = useMemo(() => {
        return days.map((day) => {
            const list = trips.filter((t) => {
                if (!t.start_time) return false;
                const s = new Date(t.start_time);
                return s.getFullYear() === day.getFullYear() && s.getMonth() === day.getMonth() && s.getDate() === day.getDate();
            });
            const km = list.reduce((sum, t) => sum + (parseFloat(t.distance_km) || 0), 0);
            return {
                label: day.toLocaleDateString('id-ID', { weekday: 'short' }),
                value: list.length,
                km,
            };
        });
    }, [days, trips]);

    const weekTrips = activity.reduce((s, d) => s + d.value, 0);
    const weekKm = activity.reduce((s, d) => s + d.km, 0);

    const vehicleSeg = useMemo(() => groupCount(vehicles, (v) => v.status, VEHICLE_STATUS), [vehicles]);
    const driverBars = useMemo(() => groupCount(drivers, (d) => d.status, DRIVER_STATUS), [drivers]);
    const alertBars = useMemo(() => groupCount(alerts, (a) => a.severity, SEVERITY), [alerts]);

    if (loading) return <AdminLayout><Skeleton /></AdminLayout>;

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

                <div className="relative overflow-hidden rounded-3xl p-[1.5px] bg-gradient-to-r from-primary-500/80 via-violet-500/60 to-accent-500/70 animate-fade-up">
                    <div className="rounded-3xl bg-gradient-to-r from-primary-50/95 via-violet-50/85 to-accent-50/95 backdrop-blur-xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-[0_8px_20px_-8px_rgba(37,99,235,0.6)]">
                            <Radar className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                            <p className="font-display font-bold text-dark-900">Semua sistem operasional</p>
                            <p className="text-xs text-dark-500 mt-0.5">GPS Reverb · AI Service · Database terhubung — update setiap 5 detik.</p>
                        </div>
                        <div className="flex items-center gap-3 text-center">
                            <div className="px-4 py-2 rounded-2xl bg-white/70 border border-success-200"><p className="font-display text-2xl font-bold text-success-700">{stats?.active_vehicles ?? 0}</p><p className="text-[10px] uppercase tracking-widest text-success-600 font-bold">On road</p></div>
                            <div className="px-4 py-2 rounded-2xl bg-white/70 border border-warning-200"><p className="font-display text-2xl font-bold text-warning-700">{stats?.active_alerts ?? 0}</p><p className="text-[10px] uppercase tracking-widest text-warning-600 font-bold">Alert</p></div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 stagger">
                    {cards.map((c) => (
                        <StatCard key={c.label} icon={c.icon} label={c.label} value={c.value} sub={c.sub} accent={c.accent} />
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <ChartCard icon={CalendarDays} title="Aktivitas Trip" subtitle="7 hari terakhir" className="lg:col-span-2 pb-11">
                        <div className="flex flex-wrap gap-2 mb-4">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary-50 border border-primary-200 text-primary-700">
                                {weekTrips} trip
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-success-50 border border-success-200 text-success-700">
                                {weekKm.toFixed(1)} km
                            </span>
                        </div>
                        <AreaChart
                            data={activity}
                            color="#2563eb"
                            height={200}
                            formatValue={(d) => `${d.value} trip`}
                            renderTooltip={(d) => `${d.km.toFixed(1)} km ditempuh`}
                        />
                    </ChartCard>

                    <ChartCard icon={PieChart} title="Status Armada" subtitle="Distribusi unit">
                        {vehicleSeg.length ? (
                            <DonutChart segments={vehicleSeg} total={vehicles.length} unit="unit" />
                        ) : (
                            <p className="text-sm text-dark-400 py-8 text-center">Belum ada data kendaraan.</p>
                        )}
                    </ChartCard>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <ChartCard icon={Users} title="Status Driver" subtitle="Kesiapan tim">
                        <BarList items={driverBars} />
                    </ChartCard>
                    <ChartCard icon={BarChart3} title="Alert per Severity" subtitle="Seluruh waktu">
                        <BarList items={alertBars} />
                    </ChartCard>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 stagger">
                    {[
                        { href: '/admin/fleet', icon: Truck, title: 'Fleet Live Map', desc: 'Lihat semua unit di peta + status live', cta: 'Buka peta', grad: 'from-primary-500 to-accent-500', tint: 'tint-indigo', link: 'text-primary-600' },
                        { href: '/admin/drivers', icon: Users, title: 'Kelola Driver', desc: 'Assign unit, pantau status & kamera AI', cta: 'Kelola driver', grad: 'from-violet-500 to-violet-600', tint: 'tint-violet', link: 'text-violet-600' },
                        { href: '/admin/trips', icon: Route, title: 'Riwayat Trip', desc: 'Jarak, durasi & rute perjalanan', cta: 'Lihat trip', grad: 'from-success-500 to-accent-500', tint: 'tint-emerald', link: 'text-success-600' },
                    ].map((a) => (
                        <Link key={a.href} href={a.href} className={`glass glass-hover ${a.tint} rounded-2xl p-5 group block`}>
                            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${a.grad} flex items-center justify-center mb-4 shadow-[0_8px_18px_-8px_rgba(15,23,42,0.4)]`}>
                                <a.icon className="w-5 h-5 text-white" />
                            </div>
                            <p className="font-display font-bold text-dark-900">{a.title}</p>
                            <p className="text-xs text-dark-500 mt-1 mb-4">{a.desc}</p>
                            <span className={`inline-flex items-center gap-1 text-xs font-bold ${a.link} group-hover:gap-2 transition-all`}>{a.cta} <ArrowRight className="w-3.5 h-3.5" /></span>
                        </Link>
                    ))}
                </div>
            </div>
        </AdminLayout>
    );
}
