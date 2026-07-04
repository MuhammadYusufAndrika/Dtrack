import { useState, useEffect } from 'react';
import AdminLayout from '../../Layouts/AdminLayout';
import DataTable from '../../Components/DataTable';
import StatusBadge from '../../Components/StatusBadge';
import { PageLoader } from '../../Components/LoadingSpinner';
import { AlertTriangle, Truck, Bell } from 'lucide-react';
import { router } from '@inertiajs/react';

export default function Alerts() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/alerts', {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, Accept: 'application/json' },
        }).then((r) => r.json()).then((j) => { if (j.success) setAlerts(j.data); })
          .catch(() => {}).finally(() => setLoading(false));
    }, []);

    if (loading) return <AdminLayout><PageLoader /></AdminLayout>;

    const markRead = async (id) => {
        try {
            await fetch(`/api/alerts/${id}/read`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, Accept: 'application/json' },
            });
            setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, is_read: true } : a));
        } catch {}
    };

    const severityColor = (s) => s === 'CRITICAL' ? 'text-danger-400' : s === 'HIGH' ? 'text-warning-400' : 'text-primary-400';

    const columns = [
        { key: 'message', header: 'Alert', render: (a) => (
            <div className="flex items-start gap-3">
                <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${severityColor(a.severity)}`} />
                <div className="min-w-0">
                    <p className="text-sm text-dark-200">{a.message}</p>
                    <p className="text-xs text-dark-400 mt-0.5">{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</p>
                </div>
            </div>
        )},
        { key: 'vehicle', header: 'Vehicle', render: (a) => a.vehicle ? <div className="flex items-center gap-2"><Truck className="w-3.5 h-3.5 text-dark-400" /><span className="text-sm text-dark-200">{a.vehicle.plate_number}</span></div> : <span className="text-sm text-dark-500">—</span> },
        { key: 'severity', header: 'Severity', render: (a) => <StatusBadge status={a.severity} />, sortable: true },
        { key: 'is_read', header: '', render: (a) => !a.is_read && <button onClick={() => markRead(a.id)} className="text-xs text-primary-400 hover:text-primary-300">Mark Read</button> },
    ];

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Bell className="w-6 h-6 text-dark-300" />
                    <div><h1 className="text-2xl font-bold text-dark-50">Alerts</h1><p className="text-sm text-dark-400 mt-1">{alerts.length} total</p></div>
                </div>
                <DataTable columns={columns} data={alerts} keyExtractor={(a) => a.id} searchable searchKeys={['message']} searchPlaceholder="Search alerts..." />
            </div>
        </AdminLayout>
    );
}
