import { useState, useEffect } from 'react';
import AdminLayout from '../../Layouts/AdminLayout';
import StatCard from '../../Components/StatCard';
import { PageLoader } from '../../Components/LoadingSpinner';
import { Truck, Users, AlertTriangle, Route, Activity, Shield, BatteryWarning } from 'lucide-react';

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/dashboard/stats', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, Accept: 'application/json' },
        }).then((r) => r.json()).then((j) => { if (j.success) setStats(j.data); })
          .catch(() => {}).finally(() => setLoading(false));
    }, []);

    if (loading) return <AdminLayout><PageLoader /></AdminLayout>;

    return (
        <AdminLayout>
            <div className="space-y-6 animate-fade-in">
                <div><h1 className="text-2xl font-bold text-dark-50">Dashboard</h1><p className="text-sm text-dark-400 mt-1">Overview of your fleet</p></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    {stats && <>
                        <StatCard icon={Truck} label="Total Vehicles" value={String(stats.total_vehicles ?? 0)} />
                        <StatCard icon={Activity} label="Active Vehicles" value={String(stats.active_vehicles ?? 0)} />
                        <StatCard icon={Users} label="Total Drivers" value={String(stats.total_drivers ?? 0)} />
                        <StatCard icon={Shield} label="Active Drivers" value={String(stats.active_drivers ?? 0)} />
                        <StatCard icon={AlertTriangle} label="Active Alerts" value={String(stats.active_alerts ?? 0)} />
                        <StatCard icon={Route} label="Today Trips" value={String(stats.today_trips ?? 0)} />
                    </>}
                </div>
            </div>
        </AdminLayout>
    );
}
