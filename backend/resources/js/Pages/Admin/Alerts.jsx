import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import AdminLayout from '../../Layouts/AdminLayout';
import DataTable from '../../Components/DataTable';
import StatusBadge from '../../Components/StatusBadge';
import PageHeader from '../../Components/PageHeader';
import { PageLoader } from '../../Components/LoadingSpinner';
import { AlertTriangle, Truck } from 'lucide-react';
import { router } from '@inertiajs/react';

export default function Alerts() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch('/api/alerts')
            .then((r) => r.json()).then((j) => { if (j.success) setAlerts(j.data); })
            .catch(() => {}).finally(() => setLoading(false));
    }, []);

    if (loading) return <AdminLayout><PageLoader /></AdminLayout>;

    const markRead = async (id) => {
        try {
            await apiFetch(`/api/alerts/${id}/read`, { method: 'PATCH' });
            setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, is_read: true } : a));
        } catch {}
    };

    const severityColor = (s) => s === 'CRITICAL' ? 'bg-danger-100 border-danger-200 text-danger-600' : s === 'HIGH' ? 'bg-warning-100 border-warning-200 text-warning-600' : 'bg-primary-100 border-primary-200 text-primary-600';

    const columns = [
        { key: 'message', header: 'Alert', render: (a) => (
            <div className="flex items-start gap-3">
                <AlertTriangle className={`w-8 h-8 p-1.5 mt-0.5 rounded-lg border flex-shrink-0 ${severityColor(a.severity)}`} />
                <div className="min-w-0">
                    <p className="text-sm text-dark-700">{a.message}</p>
                    <p className="text-xs text-dark-400 mt-0.5">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</p>
                </div>
            </div>
        )},
        { key: 'vehicle', header: 'Vehicle', render: (a) => a.vehicle ? <div className="flex items-center gap-2"><Truck className="w-3.5 h-3.5 text-dark-400" /><span className="text-sm text-dark-700">{a.vehicle.plate_number}</span></div> : <span className="text-sm text-dark-500">—</span> },
        { key: 'severity', header: 'Severity', render: (a) => <StatusBadge status={a.severity} />, sortable: true },
        { key: 'is_read', header: '', render: (a) => !a.is_read && <button onClick={() => markRead(a.id)} className="text-xs font-bold px-2.5 py-1 rounded-full bg-warning-100 border border-warning-200 text-warning-700 hover:bg-warning-200 hover:border-warning-300 transition-colors">Mark Read</button> },
    ];

    return (
        <AdminLayout>
            <div className="space-y-6">
                <PageHeader
                    eyebrow="Safety"
                    title="Alert & Peringatan"
                    description={`${alerts.length} alert — ${alerts.filter((a) => !a.is_read).length} belum dibaca.`}
                    accent="amber"
                />
                <DataTable columns={columns} data={alerts} keyExtractor={(a) => a.id} searchable searchKeys={['message']} searchPlaceholder="Search alerts..." />
            </div>
        </AdminLayout>
    );
}
