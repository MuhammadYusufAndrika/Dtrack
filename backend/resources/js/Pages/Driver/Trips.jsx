import { useEffect, useState } from 'react';
import DriverLayout from '../../Layouts/DriverLayout';
import PageHeader from '../../Components/PageHeader';
import TripDetail from '../../Components/TripDetail';
import StatusBadge from '../../Components/StatusBadge';
import { formatKm } from '../../utils/route';
import { Route, X, ChevronRight } from 'lucide-react';

export default function DriverTrips() {
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [detailId, setDetailId] = useState(null);

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
                <PageHeader eyebrow="Riwayat" title="Trip Saya" description={`${trips.length} perjalanan — manual maupun assign admin.`} />
                {trips.length === 0 ? (
                    <div className="glass rounded-3xl text-center py-14"><p className="text-4xl mb-3">🛣️</p><p className="text-dark-900 font-semibold">Belum ada trip</p><p className="text-dark-500 text-sm mt-1">Mulai trip pertama dari dashboard.</p></div>
                ) : (
                    <div className="space-y-3">
                        {trips.map((t) => (
                            <button key={t.id} onClick={() => setDetailId(t.id)} className="w-full text-left glass glass-hover rounded-2xl p-4 flex items-center gap-4">
                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-success-500 to-accent-500 flex items-center justify-center flex-shrink-0"><Route className="w-5 h-5 text-white" /></div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-dark-900">
                                        {t.origin || t.destination ? `${t.origin || 'Titik awal'} → ${t.destination || 'Tujuan'}` : `Trip manual #${t.id}`}
                                    </p>
                                    <p className="text-xs text-dark-400 mt-0.5">
                                        {t.start_time ? new Date(t.start_time).toLocaleString('id-ID') : '—'}
                                        {t.end_time ? ` — ${new Date(t.end_time).toLocaleString('id-ID')}` : ''}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <StatusBadge status={t.status} />
                                        <span className="text-xs font-bold font-mono text-primary-600">{formatKm(t.distance_km)}</span>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-dark-300 flex-shrink-0" />
                            </button>
                        ))}
                    </div>
                )}

                {detailId && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDetailId(null)}>
                        <div className="glass-strong rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-display text-lg font-bold text-dark-900">History Perjalanan</h3>
                                <button onClick={() => setDetailId(null)} className="p-2 rounded-xl glass glass-hover"><X className="w-4 h-4" /></button>
                            </div>
                            <TripDetail tripId={detailId} />
                        </div>
                    </div>
                )}
            </div>
        </DriverLayout>
    );
}
