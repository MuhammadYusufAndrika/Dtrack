import { useEffect, useState } from 'react';
import DriverLayout from '../../Layouts/DriverLayout';
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

    const severityColor = (s) => s === 'CRITICAL' ? 'text-danger-400' : s === 'HIGH' ? 'text-warning-400' : 'text-primary-400';

    return (
        <DriverLayout>
            <div>
                <h1 className="text-2xl font-bold text-dark-50 mb-6">My Alerts</h1>
                {alerts.length === 0 ? (
                    <div className="text-center py-12">
                        <Bell className="w-12 h-12 text-dark-500 mx-auto mb-3" />
                        <p className="text-dark-400">No alerts.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {alerts.map((alert) => (
                            <div key={alert.id} className={`rounded-xl border p-4 ${alert.is_read ? 'bg-dark-800/30 border-dark-700/30' : 'bg-dark-800/50 border-dark-700/50'}`}>
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${severityColor(alert.severity)}`} />
                                    <div>
                                        <p className="text-sm text-dark-200">{alert.message}</p>
                                        <p className="text-xs text-dark-400 mt-1">{alert.created_at ? new Date(alert.created_at).toLocaleString() : ''}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DriverLayout>
    );
}
