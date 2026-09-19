import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import AdminLayout from '../../Layouts/AdminLayout';
import DataTable from '../../Components/DataTable';
import StatusBadge from '../../Components/StatusBadge';
import PageHeader from '../../Components/PageHeader';
import { PageLoader } from '../../Components/LoadingSpinner';
import { Route, Truck, User, MapPin } from 'lucide-react';

export default function Trips() {
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        apiFetch('/api/trips')
            .then((r) => r.json()).then((j) => { if (j.success) setTrips(j.data); })
            .catch(() => {}).finally(() => setLoading(false));
    }, []);

    if (loading) return <AdminLayout><PageLoader /></AdminLayout>;

    const filtered = filter === 'all' ? trips : trips.filter((t) => t.status === filter);

    const fmtDist = (km) => km != null ? (km >= 1 ? `${km.toFixed(1)} km` : `${(km * 1000).toFixed(0)} m`) : '—';

    const columns = [
        { key: 'id', header: 'Trip', render: (t) => (
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary-500/10 flex items-center justify-center"><Route className="w-4 h-4 text-primary-400" /></div>
                <div><p className="font-medium text-dark-900">Trip #{t.id}</p><p className="text-xs text-dark-400">{t.start_time ? new Date(t.start_time).toLocaleDateString() : ''}</p></div>
            </div>
        )},
        { key: 'vehicle', header: 'Vehicle', render: (t) => t.vehicle ? <div className="flex items-center gap-2"><Truck className="w-3.5 h-3.5 text-dark-400" /><span className="text-sm text-dark-700">{t.vehicle.plate_number}</span></div> : <span className="text-sm text-dark-500">N/A</span> },
        { key: 'driver', header: 'Driver', render: (t) => t.driver ? <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-dark-400" /><span className="text-sm text-dark-700">{t.driver.name}</span></div> : <span className="text-sm text-dark-500">N/A</span> },
        { key: 'distance_km', header: 'Distance', render: (t) => <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-dark-400" /><span className="text-sm text-dark-700">{fmtDist(t.distance_km)}</span></div>, sortable: true },
        { key: 'status', header: 'Status', render: (t) => <StatusBadge status={t.status} />, sortable: true },
        { key: 'end_time', header: 'Duration', render: (t) => {
            if (!t.end_time) return <span className="text-sm text-success-500 font-semibold">In progress</span>;
            const mins = Math.round((new Date(t.end_time) - new Date(t.start_time)) / 60000);
            return <span className="text-sm text-dark-700">{Math.floor(mins / 60)}h {mins % 60}m</span>;
        }},
    ];

    return (
        <AdminLayout>
            <div className="space-y-6">
                <PageHeader
                    eyebrow="Operations"
                    title="Riwayat Trip"
                    description={`${trips.length} perjalanan tercatat.`}
                    action={
                    <div className="flex rounded-xl border border-dark-200/60 overflow-hidden glass">
                        {['all', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => (
                            <button key={s} onClick={() => setFilter(s)}
                                className={`px-3.5 py-2 text-xs font-bold transition-all ${filter === s ? 'btn-glow text-white' : 'text-dark-400 hover:text-dark-900'}`}>
                                {s === 'all' ? 'Semua' : s === 'IN_PROGRESS' ? 'Aktif' : s.charAt(0) + s.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                    }
                />
                <DataTable columns={columns} data={filtered} keyExtractor={(t) => t.id} searchable searchKeys={['id']} searchPlaceholder="Search trip ID..." />
            </div>
        </AdminLayout>
    );
}
