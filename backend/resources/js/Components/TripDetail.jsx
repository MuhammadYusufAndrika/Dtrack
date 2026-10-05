import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import MapTiles from './MapTiles';
import StatusBadge from './StatusBadge';
import L from 'leaflet';
import { haversineKm, fetchRoadRoute, straightLine, formatKm, matchRoadTrail } from '../utils/route';
import { Route, Gauge, Clock, Flag, Navigation, Video } from 'lucide-react';

function resolveAiBase() {
    const envUrl = import.meta.env?.VITE_AI_SERVICE_URL;
    if (envUrl) return envUrl.replace(/\/$/, '');
    const { protocol, hostname } = window.location;
    if (protocol === 'https:') return `https://${hostname}/ai`;
    return `http://${hostname}:5000`;
}

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
export default function TripDetail({ tripId, fetchFn, onDeleted }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [planCoords, setPlanCoords] = useState([]);
    const [snappedTrail, setSnappedTrail] = useState(null);
    const [recordings, setRecordings] = useState([]);
    const [recLoading, setRecLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const doFetch = fetchFn || ((url, opts = {}) => {
        // Default: sertakan token Bearer (halaman sopir tidak mengoper fetchFn).
        const token = localStorage.getItem('token');
        return fetch(url, {
            ...opts,
            headers: {
                Accept: 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(opts.headers || {}),
            },
        });
    });

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

    // Rekaman video trip ini (filter rentang waktu trip).
    const loadRecordings = () => {
        const code = data?.trip?.vehicle?.vehicle_id;
        if (!code) return;
        setRecLoading(true);
        const q = new URLSearchParams();
        if (data.trip.start_time) q.set('from_time', new Date(data.trip.start_time).toISOString());
        if (data.trip.end_time) q.set('to_time', new Date(data.trip.end_time).toISOString());
        fetch(`${resolveAiBase()}/inference/recordings/${encodeURIComponent(code)}?${q.toString()}`, { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => setRecordings(j?.recordings || []))
            .catch(() => {})
            .finally(() => setRecLoading(false));
    };
    useEffect(() => {
        loadRecordings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data?.trip?.id]);

    const handleDeleteRecording = async (file) => {
        if (!window.confirm(`Hapus rekaman ${file}? File video di server ikut terhapus.`)) return;
        const code = data?.trip?.vehicle?.vehicle_id;
        if (!code) return;
        try {
            await fetch(`${resolveAiBase()}/inference/recordings/${encodeURIComponent(code)}/${encodeURIComponent(file)}`, { method: 'DELETE' });
            loadRecordings();
        } catch {}
    };

    const handleDeleteTrip = async () => {
        if (!window.confirm(`Hapus Trip #${tripId} beserta rekaman videonya? History GPS + file di server ikut terhapus, tidak bisa dibatalkan.`)) return;
        setDeleting(true);
        try {
            const res = await doFetch(`/api/trips/${tripId}`, { method: 'DELETE' });
            const json = await res.json().catch(() => null);
            if (json?.success) {
                // Hapus juga rekaman pada rentang trip ini (hemat disk).
                try {
                    const code = data?.trip?.vehicle?.vehicle_id;
                    if (code) {
                        const q = new URLSearchParams();
                        if (data.trip.start_time) q.set('from_time', new Date(data.trip.start_time).toISOString());
                        if (data.trip.end_time) q.set('to_time', new Date(data.trip.end_time).toISOString());
                        await fetch(`${resolveAiBase()}/inference/recordings/${encodeURIComponent(code)}?${q.toString()}`, { method: 'DELETE' });
                    }
                } catch {}
                if (onDeleted) onDeleted(tripId);
            } else {
                alert(json?.message || 'Gagal menghapus trip.');
            }
        } catch {
            alert('Tidak dapat terhubung ke server.');
        } finally {
            setDeleting(false);
        }
    };
    const rawTrail = (data?.path || [])
        .map((p) => [Number(p.latitude), Number(p.longitude)])
        .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
    useEffect(() => {
        setSnappedTrail(null);
        if (rawTrail.length < 2) return;
        let cancelled = false;
        matchRoadTrail(rawTrail).then((r) => {
            if (!cancelled && r) setSnappedTrail(r);
        });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data?.trip?.id, data?.path?.length]);

    if (loading) return <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
    if (error) return <div className="p-4 rounded-xl bg-danger-500/10 border border-danger-500/30 text-sm text-danger-500">⚠️ {error}</div>;
    if (!data) return null;

    const { trip: t, session, path = [], path_source, path_truncated } = data;
    const traveled = Number(t.total_distance_km) > 0 ? Number(t.total_distance_km) : Number(session?.total_distance_km || 0);
    const trail = rawTrail;

    const displayTrail = snappedTrail && snappedTrail.length > 1 ? snappedTrail : trail;
    const lastPos = trail.length ? trail[trail.length - 1] : null;
    const sisa = lastPos && t.dest_latitude && t.dest_longitude
        ? haversineKm(lastPos[0], lastPos[1], Number(t.dest_latitude), Number(t.dest_longitude))
        : null;
    const fitPoints = [...displayTrail, ...planCoords];
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
                        {displayTrail.length > 1 && <Polyline positions={displayTrail} pathOptions={{ color: '#22c55e', weight: 4, opacity: 0.9 }} />}
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
                <span className="flex items-center gap-1.5"><span className="w-4 h-1 rounded bg-success-500 inline-block" /> Jejak aktual ({trail.length} titik{snappedTrail ? ', mengikuti jalan' : ''}{path_truncated ? ', dipotong 2000' : ''})</span>
                {t.status === 'PLANNED' && <span>Belum jalan — belum ada jejak GPS.</span>}
                {path_source === 'timerange' && <span>Jejak diambil dari rentang waktu (sesi tak tertaut).</span>}
                {trail.length === 0 && t.status !== 'PLANNED' && <span className="font-semibold text-warning-500">Belum ada titik GPS untuk trip ini — pastikan trip sudah dimulai dan GPS kendaraan terkirim.</span>}
            </div>

            <div className="glass rounded-2xl p-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-dark-400 mb-3 flex items-center gap-1.5">
                    <Video className="w-4 h-4" /> Rekaman kamera trip ini
                </h4>
                {recLoading ? (
                    <p className="text-xs text-dark-400">Memuat daftar rekaman…</p>
                ) : recordings.length === 0 ? (
                    <p className="text-xs text-dark-400">
                        Belum ada rekaman pada rentang trip ini. Rekaman dibuat otomatis dari frame kamera
                        yang masuk saat trip berjalan (kualitas timelapse ±2 FPS).
                    </p>
                ) : (
                    <div className="space-y-3">
                        {recordings.map((rec) => {
                            const url = `${resolveAiBase()}${rec.url}`;
                            const label = new Date(rec.start).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                            return (
                                <div key={rec.file} className="rounded-xl overflow-hidden border border-dark-200/60">
                                    <video src={url} controls preload="none" className="w-full max-h-64 bg-black" />
                                    <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                                        <span className="text-dark-500">{label} · {rec.size_kb} KB</span>
                                        <span className="flex items-center gap-3 flex-shrink-0">
                                            <a href={url} download={rec.file} className="font-bold text-primary-600 hover:underline">Unduh Video</a>
                                            <button onClick={() => handleDeleteRecording(rec.file)} className="font-bold text-danger-500 hover:underline">Hapus</button>
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="glass rounded-2xl p-4 !border-danger-500/20 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-dark-900">Hapus history trip ini</p>
                    <p className="text-xs text-dark-400">Trip + jejak GPS + rekaman videonya ikut terhapus (hemat DB & disk).</p>
                </div>
                <button onClick={handleDeleteTrip} disabled={deleting}
                    className="px-4 py-2.5 rounded-xl bg-danger-500/10 border border-danger-500/30 text-danger-500 text-xs font-bold hover:bg-danger-500 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0">
                    {deleting ? 'Menghapus…' : 'Hapus Trip'}
                </button>
            </div>
        </div>
    );
}
