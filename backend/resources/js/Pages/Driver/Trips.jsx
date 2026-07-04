import { useEffect, useState } from 'react';
import DriverLayout from '../../Layouts/DriverLayout';

export default function DriverTrips() {
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
            try {
                const meRes = await fetch('/api/auth/me', { headers });
                const meJson = await meRes.json();
                const email = meJson.data?.email;
                if (!email) return;

                const dRes = await fetch('/api/drivers', { headers });
                const dJson = await dRes.json();
                const myDriver = dJson.data?.find((d) => d.email === email);
                if (!myDriver) return;

                const tRes = await fetch('/api/trips', { headers });
                const tJson = await tRes.json();
                setTrips(tJson.data?.filter((t) => t.driver_id === myDriver.id) || []);
            } catch {}
            setLoading(false);
        })();
    }, []);

    if (loading) return <DriverLayout><div className="flex items-center justify-center h-[60vh]"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div></DriverLayout>;

    return (
        <DriverLayout>
            <div>
                <h1 className="text-2xl font-bold text-dark-50 mb-6">My Trips</h1>
                {trips.length === 0 ? (
                    <p className="text-dark-400">No trips found.</p>
                ) : (
                    <div className="space-y-3">
                        {trips.map((t) => (
                            <div key={t.id} className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-4">
                                <p className="text-sm font-medium text-dark-100">{t.origin || '—'} → {t.destination || '—'}</p>
                                <p className="text-xs text-dark-400 mt-1">
                                    {t.start_time ? new Date(t.start_time).toLocaleString() : '—'}
                                    {t.end_time ? ` — ${new Date(t.end_time).toLocaleString()}` : ''}
                                </p>
                                {t.distance_km != null && <p className="text-xs text-dark-400 mt-0.5">{t.distance_km} km</p>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DriverLayout>
    );
}
