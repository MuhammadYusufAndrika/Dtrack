import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';
import AdminLayout from '../../Layouts/AdminLayout';
import { PageLoader } from '../../Components/LoadingSpinner';
import StatusBadge from '../../Components/StatusBadge';
import { User, Truck, Phone, Mail, FileText } from 'lucide-react';

export default function DriversShow({ id }) {
    const [driver, setDriver] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch(`/api/drivers/${id}`)
            .then((r) => r.json()).then((j) => { if (j.success) setDriver(j.data); })
            .catch(() => {}).finally(() => setLoading(false));
    }, [id]);

    if (loading) return <AdminLayout><PageLoader /></AdminLayout>;
    if (!driver) return <AdminLayout><div className="text-center py-12 text-dark-400">Driver not found</div></AdminLayout>;

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center"><User className="w-7 h-7 text-white" /></div>
                    <div><h1 className="text-2xl font-bold text-dark-50">{driver.name}</h1><StatusBadge status={driver.status} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoBox icon={Mail} label="Email" value={driver.email} />
                    <InfoBox icon={Phone} label="Phone" value={driver.phone} />
                    <InfoBox icon={FileText} label="License" value={driver.license_number} />
                    <InfoBox icon={Truck} label="Vehicle" value={driver.vehicle?.plate_number || 'None'} />
                </div>
            </div>
        </AdminLayout>
    );
}

function InfoBox({ icon: Icon, label, value }) {
    return (
        <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center"><Icon className="w-5 h-5 text-primary-400" /></div>
            <div><p className="text-xs text-dark-400">{label}</p><p className="text-sm font-semibold text-dark-100">{value}</p></div>
        </div>
    );
}
