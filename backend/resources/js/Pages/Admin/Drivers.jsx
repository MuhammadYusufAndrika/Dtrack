import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../utils/api';
import { Link } from '@inertiajs/react';
import AdminLayout from '../../Layouts/AdminLayout';
import DataTable from '../../Components/DataTable';
import StatusBadge from '../../Components/StatusBadge';
import { PageLoader } from '../../Components/LoadingSpinner';
import { User, Truck, Phone } from 'lucide-react';

export default function Drivers() {
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchDrivers = useCallback(() => {
        apiFetch('/api/drivers')
            .then((r) => r.json()).then((j) => { if (j.success) setDrivers(j.data); })
            .catch(() => {}).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchDrivers();
        const interval = setInterval(fetchDrivers, 10000);
        return () => clearInterval(interval);
    }, [fetchDrivers]);

    if (loading) return <AdminLayout><PageLoader /></AdminLayout>;

    const columns = [
        { key: 'name', header: 'Driver', render: (d) => (
            <Link href={`/admin/drivers/${d.id}`} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary-500/10 flex items-center justify-center"><User className="w-4 h-4 text-primary-400" /></div>
                <div><p className="font-medium text-dark-100">{d.name}</p><p className="text-xs text-dark-400">{d.email}</p></div>
            </Link>
        )},
        { key: 'phone', header: 'Phone', render: (d) => (
            <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-dark-400" /><span className="text-sm text-dark-200">{d.phone}</span></div>
        )},
        { key: 'license_number', header: 'License' },
        { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} />, sortable: true },
        { key: 'vehicle', header: 'Vehicle', render: (d) => (
            d.vehicle ? <div className="flex items-center gap-2"><Truck className="w-3.5 h-3.5 text-dark-400" /><span className="text-sm text-dark-200">{d.vehicle.plate_number}</span></div>
            : <span className="text-sm text-dark-500">—</span>
        )},
    ];

    return (
        <AdminLayout>
            <div className="space-y-6"><div><h1 className="text-2xl font-bold text-dark-50">Drivers</h1><p className="text-sm text-dark-400 mt-1">{drivers.length} total</p></div>
                <DataTable columns={columns} data={drivers} keyExtractor={(d) => d.id} searchable searchKeys={['name', 'email']} searchPlaceholder="Search drivers..." />
            </div>
        </AdminLayout>
    );
}
