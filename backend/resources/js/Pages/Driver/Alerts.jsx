import { useEffect, useState } from 'react';
import DriverLayout from '../../Layouts/DriverLayout';
import PageHeader from '../../Components/PageHeader';
import { AlertTriangle, Bell } from 'lucide-react';

export default function DriverAlerts() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const token = localStorage.getItem('token');
            try {
                const res = await fetch('/api/alerts', {
                    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
                });
                const json = await res.json();
                if (json.success) setAlerts(json.data);
            } catch {}
            setLoading(false);
        })();
    }, []);

    if (loading) return <DriverLayout><div className="flex items-center justify-center h-[60vh]"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div></DriverLayout>;

    const severityColor = (s) => s === 'CRITICAL' ? 'text-danger-600' : s === 'HIGH' ? 'text-warning-600' : 'text-primary-600';

    return (
        <DriverLayout>
            <div className="space-y-5">
                <PageHeader accent="amber" eyebrow="Keselamatan" title="Alert Saya" description={`${alerts.length} notifikasi.`} />
                {alerts.length === 0 ? (
                    <div className="glass tint-amber rounded-3xl text-center py-14">
                        <div className="inline-flex w-14 h-14 rounded-2xl bg-warning-50 border border-warning-100 items-center justify-center mb-3"><Bell className="w-7 h-7 text-warning-500" /></div>
                        <p className="text-dark-900 font-semibold">Tidak ada alert</p>
                        <p className="text-dark-500 text-sm mt-1">Berkendara aman, ya!</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {alerts.map((alert) => (
                            <div key={alert.id} className={`glass rounded-2xl p-4 transition-all ${!alert.is_read ? 'tint-amber !border-warning-300 shadow-[0_10px_30px_rgba(217,119,6,0.12)]' : 'opacity-75'}`}>
                                <div className="flex items-start gap-3">
                                    <span className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${alert.is_read ? 'bg-warning-50 border-warning-200' : 'bg-warning-100 border-warning-200'}`}>
                                        <AlertTriangle className={`w-4 h-4 ${severityColor(alert.severity)}`} />
                                    </span>
                                    <div className="min-w-0">
                                        <p className={`text-sm ${!alert.is_read ? 'text-dark-900 font-medium' : 'text-dark-700'}`}>{alert.message}</p>
                                        <p className="text-xs text-dark-500 mt-1">{alert.created_at ? new Date(alert.created_at).toLocaleString('id-ID') : ''}</p>
                                    </div>
                                    {!alert.is_read && <span className="ml-auto w-2 h-2 rounded-full bg-warning-500 flex-shrink-0 mt-1.5" />}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DriverLayout>
    );
}
