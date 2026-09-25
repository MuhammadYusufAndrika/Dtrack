import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import MapTiles from './MapTiles';
import StatusBadge from './StatusBadge';
import L from 'leaflet';
import { haversineKm, fetchRoadRoute, straightLine, formatKm } from '../utils/route';
import { Route, Gauge, Clock, Flag, Navigation } from 'lucide-react';

const originIcon = L.divIcon({ className: '', html: '<div style="width:32px;height:32px;background:linear-gradient(135deg,#22c55e,#06b6d4);border:3px solid #fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:14px;">📍</div>', iconSize: [32, 32], iconAnchor: [16, 16] });
const destIcon = L.divIcon({ className: '', html: '<div style="width:32px;height:32px;background:linear-gradient(135deg,#f59e0b,#ef4444);border:3px solid #fff;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:14px;">🎯</div>', iconSize: [32, 32], iconAnchor: [16, 16] });
const posIcon = L.divIcon({ className: '', html: '<div style="width:30px;height:30px;background:linear-gradient(135deg,#2563eb,#06b6d4);border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;">🚛</div>', iconSize: [30, 30], iconAnchor: [15, 15] });

function FitBounds({ points }) {
    const map = useMap();
    const key = points.map((p) => p.join(',')).join(';');
    useEffect(() => {
        if (points.length > 1) map.fitBounds(points, { padding: [36, 36] });
        else if (points.length === 1) map.setView(points[0], 14);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    return null;
}

const fmtDur = (start, end) => {
    if (!start) return '—';
    const mins = Math.max(0, Math.round(((end ? new Date(end) : new Date()) - new Date(start)) / 60000));
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

/**
 * Detail history perjalanan per trip — dipakai Admin & Driver.
 * Menampilkan rute rencana (assign admin) + jejak GPS aktual + km ditempuh.
 * Trip manual sopir (tanpa tujuan) tetap tampil jejak + km-nya.
 */
export default function TripDetail({ tripId, fetchFn }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [planCoords, setPlanCoords] = useState([]);

    const doFetch = fetchFn || ((url, opts) => fetch(url, opts));

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        doFetch(`/api/trips/${tripId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, Accept: 'application/json' } })
            .then((r) => r.json())
            .then((j) => {
                if (cancelled) return;
                if (j.success) setData(j.data);
                else setError(j.message || 'Trip tidak ditemukan.');
            })
            .catch(() => { if (!cancelled) setError('Gagal memuat detail trip.'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [tripId]);

    useEffect(() => {
        const t = data?.trip;
        if (!t) return;
        const oLat = Number(t.start_latitude);
        const oLng = Number(t.start_longitude);
        const dLat = Number(t.dest_latitude);
        const dLng = Number(t.dest_longitude);
        if (!oLat || !oLng || !dLat || !dLng) { setPlanCoords([]); return; }
        let cancelled = false;
        fetchRoadRoute({ lat: oLat, lng: oLng }, { lat: dLat, lng: dLng }).then((r) => {
            if (cancelled) return;
            setPlanCoords(r && r.length > 1 ? r : straightLine({ lat: oLat, lng: oLng }, { lat: dLat, lng: dLng }));
        });
        return () => { cancelled = true; };
    }, [data?.trip?.id]);

    if (loading) return <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
    if (error) return <div className="p-4 rounded-xl bg-danger-500/10 border border-danger-500/30 text-sm text-danger-500">⚠️ {error}</div>;
    if (!data) return null;

    const { trip: t, session, path = [], path_source, path_truncated } = data;
    const traveled = Number(t.total_distance_km) > 0 ? Number(t.total_distance_km) : Number(session?.total_distance_km || 0);
    const trail = path
        .map((p) => [Number(p.latitude), Number(p.longitude)])
        .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
    const lastPos = trail.length ? trail[trail.length - 1] : null;
    const sisa = lastPos && t.dest_latitude && t.dest_longitude
        ? haversineKm(lastPos[0], lastPos[1], Number(t.dest_latitude), Number(t.dest_longitude))
        : null;
    const fitPoints = [...trail, ...planCoords];
    if (!fitPoints.length && t.start_latitude && t.start_longitude) fitPoints.push([Number(t.start_latitude), Number(t.start_longitude)]);

    const stats = [
        { icon: Navigation, label: 'Estimasi rencana', value: t.planned_distance_km != null ? formatKm(t.planned_distance_km) : '—' },
        { icon: Gauge, label: 'Sudah jalan', value: `${traveled.toFixed(2)} km` },
        { icon: Flag, label: 'Sisa ke tujuan', value: sisa != null ? formatKm(sisa) : '—' },
        { icon: Clock, label: 'Durasi', value: fmtDur(t.start_time, t.end_time) },
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center flex-shrink-0"><Route className="w-5 h-5 text-white" /></div>
                <div className="min-w-0 flex-1">
                    <p className="font-display font-bold text-dark-900">Trip #{t.id} · {t.vehicle?.plate_number || ''}</p>
                    <p className="text-sm text-dark-500 truncate">
                        {t.origin || t.destination ? `${t.origin || 'Titik awal'} → ${t.destination || 'Tujuan'}` : 'Trip manual sopir (tanpa rute assign)'}
                    </p>
                </div>
                <StatusBadge status={t.status} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {stats.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="glass rounded-2xl px-3.5 py-3">
                        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-dark-500 font-bold"><Icon className="w-3.5 h-3.5" />{label}</p>
                        <p className="text-sm font-bold text-dark-900 mt-1">{value}</p>
                    </div>
                ))}
            </div>

            <div className="rounded-2xl overflow-hidden border border-dark-200/60">
                <div className="h-[320px]">
                    <MapContainer center={[-6.2088, 106.8456]} zoom={11} className="h-full w-full z-0">
                        <MapTiles />
                        <FitBounds points={fitPoints} />
                        {planCoords.length > 1 && <Polyline positions={planCoords} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.7, dashArray: '10 8' }} />}
                        {trail.length > 1 && <Polyline positions={trail} pathOptions={{ color: '#22c55e', weight: 4, opacity: 0.9 }} />}
                        {t.start_latitude && t.start_longitude && (
                            <Marker position={[Number(t.start_latitude), Number(t.start_longitude)]} icon={originIcon}>
                                <Popup><div className="text-sm"><p className="font-bold">📍 {t.origin || 'Titik awal'}</p></div></Popup>
                            </Marker>
                        )}
                        {t.dest_latitude && t.dest_longitude && (
                            <Marker position={[Number(t.dest_latitude), Number(t.dest_longitude)]} icon={destIcon}>
                                <Popup><div className="text-sm"><p className="font-bold">🎯 {t.destination || 'Tujuan'}</p></div></Popup>
                            </Marker>
                        )}
                        {lastPos && (
                            <Marker position={lastPos} icon={posIcon}>
                                <Popup><div className="text-sm"><p className="font-bold">Posisi terakhir</p><p className="font-mono text-xs">{lastPos[0].toFixed(5)}, {lastPos[1].toFixed(5)}</p></div></Popup>
                            </Marker>
                        )}
                    </MapContainer>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-dark-500">
                <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-primary-600 inline-block" style={{ borderTop: '2px dashed #2563eb' }} /> Rute rencana</span>
                <span className="flex items-center gap-1.5"><span className="w-4 h-1 rounded bg-success-500 inline-block" /> Jejak aktual ({trail.length} titik{path_truncated ? ', dipotong 2000' : ''})</span>
                {t.status === 'PLANNED' && <span>Belum jalan — belum ada jejak GPS.</span>}
                {path_source === 'timerange' && <span>Jejak diambil dari rentang waktu (sesi tak tertaut).</span>}
                {trail.length === 0 && t.status !== 'PLANNED' && <span className="font-semibold text-warning-500">Belum ada titik GPS untuk trip ini — pastikan trip sudah dimulai dan GPS kendaraan terkirim.</span>}
            </div>
        </div>
    );
}
