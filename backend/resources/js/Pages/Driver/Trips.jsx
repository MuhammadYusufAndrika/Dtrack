import { useEffect, useState } from 'react';
import DriverLayout from '../../Layouts/DriverLayout';
import PageHeader from '../../Components/PageHeader';
import { Route } from 'lucide-react';

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
            <div className="space-y-5">
                <PageHeader eyebrow="Riwayat" title="Trip Saya" description={`${trips.length} perjalanan.`} />
                {trips.length === 0 ? (
                    <div className="glass rounded-3xl text-center py-14"><p className="text-4xl mb-3">🛣️</p><p className="text-dark-900 font-semibold">Belum ada trip</p><p className="text-dark-500 text-sm mt-1">Mulai trip pertama dari dashboard.</p></div>
                ) : (
                    <div className="space-y-3">
                        {trips.map((t) => (
                            <div key={t.id} className="glass glass-hover rounded-2xl p-4 flex items-center gap-4">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-success-500 to-accent-500 flex items-center justify-center flex-shrink-0"><Route className="w-5 h-5 text-white" /></div>
                                <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-dark-900">{t.origin || '—'} → {t.destination || '—'}</p>
                                <p className="text-xs text-dark-400 mt-0.5">
                                    {t.start_time ? new Date(t.start_time).toLocaleString('id-ID') : '—'}
                                    {t.end_time ? ` — ${new Date(t.end_time).toLocaleString('id-ID')}` : ''}
                                </p>
                                </div>
                                {t.distance_km != null && <span className="text-xs font-bold font-mono text-primary-600 flex-shrink-0">{t.distance_km} km</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DriverLayout>
    );
}
